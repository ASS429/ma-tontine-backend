// routes/tirages.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -----------------------
   📌 GET tous les tirages d'une tontine
------------------------ */
router.get("/:tontineId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ti.*, m.nom AS membre_nom, cy.numero AS cycle_numero
       FROM tirages ti
       JOIN membres m ON m.id = ti.membre_id
       LEFT JOIN cycles cy ON cy.id = ti.cycle_id
       WHERE ti.tontine_id = $1
       ORDER BY ti.date_tirage ASC`,
      [req.params.tontineId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("❌ Erreur GET tirages:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 GET historique global des tirages
------------------------ */
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ti.*, m.nom AS membre_nom, t.nom AS tontine_nom, 
              t.montant_cotisation, cy.numero AS cycle_numero
       FROM tirages ti
       JOIN membres m ON m.id = ti.membre_id
       JOIN tontines t ON t.id = ti.tontine_id
       LEFT JOIN cycles cy ON cy.id = ti.cycle_id
       WHERE t.createur = $1
       ORDER BY ti.date_tirage DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("❌ Erreur GET tirages globaux:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST exécuter un tirage
------------------------ */
router.post("/run/:tontineId", async (req, res) => {
  const { tontineId } = req.params;

  try {
    // 1️⃣ Vérifier la tontine
    const t = await pool.query(
      `SELECT id, montant_cotisation, nombre_membres 
       FROM tontines 
       WHERE id = $1 AND createur = $2`,
      [tontineId, req.user.id]
    );
    if (t.rowCount === 0) {
      return res.status(404).json({ error: "Tontine non trouvée" });
    }
    const tontine = t.rows[0];

    // 2️⃣ Cycle actif
    let cycle = await pool.query(
      `SELECT * FROM cycles 
       WHERE tontine_id = $1 AND cloture = false
       ORDER BY numero DESC LIMIT 1`,
      [tontineId]
    );
    if (cycle.rowCount === 0) {
      const r = await pool.query(
        `INSERT INTO cycles (tontine_id, numero) VALUES ($1, 1) RETURNING *`,
        [tontineId]
      );
      cycle = r;
    }
    const cycleActif = cycle.rows[0];

    // 3️⃣ Vérifier cotisations
    const { rows: membresNonCotisants } = await pool.query(
      `SELECT m.id, m.nom
       FROM membres m
       WHERE m.tontine_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM cotisations c
         WHERE c.membre_id = m.id 
           AND c.cycle_id = $2
       )`,
      [tontineId, cycleActif.id]
    );
    if (membresNonCotisants.length > 0) {
      return res.status(400).json({
        error: "Tous les membres n'ont pas encore cotisé",
        manquants: membresNonCotisants.map(m => m.nom)
      });
    }

    // 4️⃣ Vérifier pas déjà tiré
    const dejaTirage = await pool.query(
      `SELECT * FROM tirages 
       WHERE tontine_id = $1 AND cycle_id = $2`,
      [tontineId, cycleActif.id]
    );
    if (dejaTirage.rowCount > 0) {
      return res.status(400).json({ error: "Un tirage a déjà été effectué pour ce cycle" });
    }

    // 5️⃣ Choisir gagnant
    const { rows: candidats } = await pool.query(
      `SELECT m.id, m.nom
       FROM membres m
       WHERE m.tontine_id = $1
         AND m.id NOT IN (
           SELECT membre_id FROM tirages WHERE tontine_id = $1
         )
       ORDER BY random()
       LIMIT 1`,
      [tontineId]
    );
    if (candidats.length === 0) {
      return res.status(400).json({ error: "Tous les membres ont déjà gagné — tontine terminée" });
    }
    const gagnant = candidats[0];

    // 6️⃣ Créer le tirage
    const r = await pool.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id) 
       VALUES ($1, $2, $3) RETURNING *`,
      [tontineId, gagnant.id, cycleActif.id]
    );

    // 7️⃣ Clôturer cycle
    await pool.query(`UPDATE cycles SET cloture = true WHERE id = $1`, [cycleActif.id]);

    // 8️⃣ Nouveau cycle ou clôture
    const nbTirages = await pool.query(
      `SELECT COUNT(*)::int as total FROM tirages WHERE tontine_id = $1`,
      [tontineId]
    );
    if (nbTirages.rows[0].total < tontine.nombre_membres) {
      await pool.query(
        `INSERT INTO cycles (tontine_id, numero) VALUES ($1, $2)`,
        [tontineId, cycleActif.numero + 1]
      );
    } else {
      await pool.query(`UPDATE tontines SET statut = 'terminee' WHERE id = $1`, [tontineId]);
    }

    // ✅ Réponse enrichie
    res.status(201).json({
      ...r.rows[0],
      membre_nom: gagnant.nom,
      cycle: cycleActif.numero,
      montant: tontine.montant_cotisation,
      montant_total: tontine.montant_cotisation * tontine.nombre_membres
    });
  } catch (err) {
    console.error("❌ Erreur POST tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 DELETE un tirage
------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM tirages ti
       USING tontines t
       WHERE ti.id = $1
         AND t.id = ti.tontine_id
         AND t.createur = $2`,
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
