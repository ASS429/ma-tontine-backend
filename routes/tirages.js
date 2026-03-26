// routes/tirages.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

router.use(requireAuth);

/* -----------------------
   📌 GET historique global des tirages (toutes les tontines de l'utilisateur)
   ✅ CORRECTIF : déclarée AVANT /:tontineId pour qu'Express l'atteigne
------------------------ */
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT ti.*, m.nom AS membre_nom, t.nom AS tontine_nom, 
             t.montant_cotisation, cy.numero AS cycle_numero
      FROM tirages ti
      JOIN membres m ON m.id = ti.membre_id
      JOIN tontines t ON t.id = ti.tontine_id
      LEFT JOIN cycles cy ON cy.id = ti.cycle_id
      WHERE t.createur = $1
      ORDER BY ti.date_tirage DESC
      `,
      [req.user.id]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("❌ Erreur GET tirages globaux:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 GET tous les tirages d'une tontine
------------------------ */
router.get("/:tontineId", async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT ti.*, m.nom AS membre_nom, cy.numero AS cycle_numero
      FROM tirages ti
      JOIN membres m ON m.id = ti.membre_id
      LEFT JOIN cycles cy ON cy.id = ti.cycle_id
      WHERE ti.tontine_id = $1
      ORDER BY ti.date_tirage ASC
      `,
      [req.params.tontineId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("❌ Erreur GET tirages:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST exécuter ou prévisualiser un tirage
   - force=0 → preview (possible ou non)
   - force=1 → exécution réelle
   ✅ CORRECTIF : toutes les écritures enveloppées dans une transaction
      BEGIN / COMMIT / ROLLBACK pour éviter la corruption en cas de panne.
------------------------ */
router.post("/run/:tontineId", async (req, res) => {
  const { tontineId } = req.params;
  const force = req.query.force === "1";

  // On acquiert un client dédié pour la transaction
  const client = await pool.connect();

  try {
    // 1️⃣ Vérifier la tontine (hors transaction — lecture seule)
    const t = await client.query(
      `SELECT id, montant_cotisation, nombre_membres 
       FROM tontines 
       WHERE id = $1 AND createur = $2`,
      [tontineId, req.user.id]
    );
    if (t.rowCount === 0) {
      return res.status(404).json({ error: "Tontine non trouvée" });
    }
    const tontine = t.rows[0];

    // 2️⃣ Récupérer cycle actif (ou créer si inexistant)
    let cycle = await client.query(
      `SELECT * FROM cycles 
       WHERE tontine_id = $1 AND cloture = false 
       ORDER BY numero DESC LIMIT 1`,
      [tontineId]
    );

    // Si aucun cycle actif en mode preview, on en crée un temporairement pour vérifier
    // (en mode force=1 on l'insèrera dans la transaction)
    let cycleActif;
    let needsNewCycle = false;

    if (cycle.rowCount === 0) {
      if (!force) {
        // En preview, on simule un cycle numéro 1
        cycleActif = { id: null, numero: 1 };
        needsNewCycle = true;
      } else {
        // En mode force, on crée le cycle dans la transaction plus bas
        cycleActif = null;
        needsNewCycle = true;
      }
    } else {
      cycleActif = cycle.rows[0];
    }

    // 3️⃣ Vérifier cotisations (uniquement si on a un vrai cycle)
    if (cycleActif?.id) {
      const { rows: membresNonCotisants } = await client.query(
        `
        SELECT m.id, m.nom
        FROM membres m
        WHERE m.tontine_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM cotisations c 
          WHERE c.membre_id = m.id AND c.cycle_id = $2
        )
        `,
        [tontineId, cycleActif.id]
      );
      if (membresNonCotisants.length > 0) {
        return res.status(force ? 400 : 200).json({
          possible: false,
          error: "Tous les membres n'ont pas encore cotisé",
          retardataires: membresNonCotisants.map(m => m.nom),
        });
      }

      // 4️⃣ Vérifier qu'un tirage n'existe pas déjà pour ce cycle
      const dejaTirage = await client.query(
        `SELECT * FROM tirages WHERE tontine_id = $1 AND cycle_id = $2`,
        [tontineId, cycleActif.id]
      );
      if (dejaTirage.rowCount > 0) {
        return res.status(force ? 400 : 200).json({
          possible: false,
          error: "Un tirage a déjà été effectué pour ce cycle",
        });
      }
    }

    // 5️⃣ Trouver candidats éligibles (pas encore gagnants)
    const { rows: candidats } = await client.query(
      `
      SELECT m.id, m.nom
      FROM membres m
      WHERE m.tontine_id = $1
      AND m.id NOT IN (
        SELECT membre_id FROM tirages WHERE tontine_id = $1
      )
      ORDER BY random() LIMIT 1
      `,
      [tontineId]
    );
    if (candidats.length === 0) {
      return res.status(force ? 400 : 200).json({
        possible: false,
        error: "Tous les membres ont déjà gagné — tontine terminée",
      });
    }
    const gagnant = candidats[0];
    const montantGagne = tontine.montant_cotisation * tontine.nombre_membres;

    // ⚡ Mode preview (force=0) — pas d'écriture
    if (!force) {
      return res.json({
        possible: true,
        message: "✅ Tirage possible",
        gagnantPotentiel: gagnant.nom,
        cycle: cycleActif?.numero ?? 1,
        montant_gagne: montantGagne,
      });
    }

    // =========================================================
    // 6️⃣ Exécution réelle — TRANSACTION ATOMIQUE
    //    Toutes les écritures réussissent ou toutes sont annulées.
    // =========================================================
    await client.query("BEGIN");

    // Créer le cycle s'il n'existait pas
    if (needsNewCycle) {
      const r = await client.query(
        `INSERT INTO cycles (tontine_id, numero) VALUES ($1, 1) RETURNING *`,
        [tontineId]
      );
      cycleActif = r.rows[0];
    }

    // Insérer le tirage
    const r = await client.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id, date_tirage, montant_gagne) 
       VALUES ($1, $2, $3, NOW(), $4) RETURNING *`,
      [tontineId, gagnant.id, cycleActif.id, montantGagne]
    );

    // Clôturer le cycle actuel
    await client.query(`UPDATE cycles SET cloture = true WHERE id = $1`, [cycleActif.id]);

    // Nouveau cycle ou fin de tontine
    const nbTirages = await client.query(
      `SELECT COUNT(*)::int as total FROM tirages WHERE tontine_id = $1`,
      [tontineId]
    );

    if (nbTirages.rows[0].total < tontine.nombre_membres) {
      await client.query(
        `INSERT INTO cycles (tontine_id, numero) VALUES ($1, $2)`,
        [tontineId, cycleActif.numero + 1]
      );
    } else {
      await client.query(
        `UPDATE tontines SET statut = 'terminee' WHERE id = $1`,
        [tontineId]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...r.rows[0],
      membre_nom: gagnant.nom,
      cycle: cycleActif.numero,
      montant: tontine.montant_cotisation,
      montant_total: montantGagne,
    });

  } catch (err) {
    // En cas d'erreur : annuler toutes les écritures de cette transaction
    await client.query("ROLLBACK");
    console.error("❌ Erreur POST tirage (rollback effectué):", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  } finally {
    // Toujours libérer le client vers le pool
    client.release();
  }
});

/* -----------------------
   📌 DELETE un tirage
------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `
      DELETE FROM tirages ti
      USING tontines t
      WHERE ti.id = $1 
      AND t.id = ti.tontine_id 
      AND t.createur = $2
      `,
      [req.params.id, req.user.id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Tirage non trouvé" });
    }

    res.json({ success: true, message: "Tirage supprimé" });
  } catch (err) {
    console.error("❌ Erreur DELETE tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
