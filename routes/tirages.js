import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -----------------------
   📌 GET tirages d’une tontine
------------------------ */
router.get("/:tontineId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ti.*, m.nom AS membre_nom, c.numero AS cycle_numero
       FROM tirages ti
       JOIN membres m ON m.id = ti.membre_id
       JOIN cycles c ON c.id = ti.cycle_id
       WHERE ti.tontine_id = $1
       ORDER BY ti.date_tirage ASC`,
      [req.params.tontineId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET tirages:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 GET tous les tirages (historique global)
------------------------ */
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ti.*, m.nom AS membre_nom, t.nom AS tontine_nom, 
              t.montant_cotisation, c.numero AS cycle_numero
       FROM tirages ti
       JOIN membres m ON m.id = ti.membre_id
       JOIN tontines t ON t.id = ti.tontine_id
       JOIN cycles c ON c.id = ti.cycle_id
       WHERE t.createur = $1
       ORDER BY ti.date_tirage DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET tirages globaux:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST exécuter un tirage
------------------------ */
router.post("/run/:tontineId", async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine existe et appartient à l'utilisateur
    const t = await pool.query(
      `SELECT id, nombre_membres, montant_cotisation 
       FROM tontines WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );
    if (t.rowCount === 0) {
      return res.status(404).json({ error: "Tontine non trouvée" });
    }
    const tontine = t.rows[0];

    // Récupérer cycle actif
    let cycleRes = await pool.query(
      `SELECT * FROM cycles 
       WHERE tontine_id=$1 AND cloture=false
       ORDER BY numero DESC LIMIT 1`,
      [tontineId]
    );

    if (cycleRes.rowCount === 0) {
      // Créer le premier cycle si inexistant
      cycleRes = await pool.query(
        `INSERT INTO cycles (tontine_id, numero) 
         VALUES ($1, 1) RETURNING *`,
        [tontineId]
      );
    }

    const cycle = cycleRes.rows[0];

    // Vérifier cotisations
    const membresCount = await pool.query(
      `SELECT COUNT(*)::int FROM membres WHERE tontine_id=$1`,
      [tontineId]
    );

    const cotisationsCount = await pool.query(
      `SELECT COUNT(DISTINCT membre_id)::int 
       FROM cotisations WHERE cycle_id=$1`,
      [cycle.id]
    );

    if (cotisationsCount.rows[0].count < membresCount.rows[0].count) {
      return res.status(400).json({ error: "Tous les membres n’ont pas encore cotisé" });
    }

    // Sélectionner un membre qui n’a pas encore gagné
    const remaining = await pool.query(
      `SELECT m.id, m.nom
       FROM membres m
       WHERE m.tontine_id=$1
         AND m.id NOT IN (SELECT membre_id FROM tirages WHERE tontine_id=$1)
       ORDER BY random()
       LIMIT 1`,
      [tontineId]
    );

    if (remaining.rowCount === 0) {
      return res.status(400).json({ error: "Tous les membres ont déjà gagné. Tontine terminée." });
    }

    const chosen = remaining.rows[0];

    // Enregistrer le tirage
    const r = await pool.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id) 
       VALUES ($1,$2,$3) RETURNING *`,
      [tontineId, chosen.id, cycle.id]
    );

    // Clôturer le cycle
    await pool.query(`UPDATE cycles SET cloture=true WHERE id=$1`, [cycle.id]);

    // Vérifier s’il reste encore des gagnants possibles
    const encoreEligibles = await pool.query(
      `SELECT COUNT(*)::int 
       FROM membres m
       WHERE m.tontine_id=$1
         AND m.id NOT IN (SELECT membre_id FROM tirages WHERE tontine_id=$1)`,
      [tontineId]
    );

    if (encoreEligibles.rows[0].count > 0) {
      // Nouveau cycle
      await pool.query(
        `INSERT INTO cycles (tontine_id, numero) 
         VALUES ($1, $2)`,
        [tontineId, cycle.numero + 1]
      );
    } else {
      // Tous les membres ont gagné → tontine terminée
      await pool.query(`UPDATE tontines SET statut='terminee' WHERE id=$1`, [tontineId]);
    }

    res.status(201).json({
      ...r.rows[0],
      membre_nom: chosen.nom,
      montant: tontine.montant_cotisation,
      cycle_numero: cycle.numero
    });
  } catch (err) {
    console.error("Erreur POST tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 DELETE supprimer un tirage
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

    res.status(204).end();
  } catch (err) {
    console.error("Erreur DELETE tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
