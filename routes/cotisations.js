import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Enregistrer une cotisation (montant récupéré automatiquement depuis la tontine)
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, membreId, date } = req.body;
  try {
    const { rows } = await pool.query(
      `WITH t AS (
         SELECT id, montant_cotisation
         FROM tontines
         WHERE id = $1 AND createur = $2
       ),
       m AS (
         SELECT id FROM membres WHERE id = $3 AND tontine_id = $1
       ),
       ins AS (
         INSERT INTO cotisations (tontine_id, membre_id, montant, date_cotisation)
         SELECT $1, $3, t.montant_cotisation, COALESCE($4::date, NOW()::date)
         FROM t JOIN m ON true
         RETURNING *
       )
       SELECT * FROM ins`,
      [tontineId, req.user.id, membreId, date || null]
    );
    if (!rows.length) return res.status(403).json({ error: "Accès refusé" });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lister cotisations d’une tontine (avec nom du membre), accès limité au propriétaire
router.get("/:tontineId", requireAuth, async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      `SELECT c.id, c.montant, c.date_cotisation, m.nom AS membre
       FROM cotisations c
       JOIN membres m   ON m.id = c.membre_id
       JOIN tontines t  ON t.id = c.tontine_id
       WHERE c.tontine_id = $1 AND t.createur = $2
       ORDER BY c.date_cotisation DESC`,
      [tontineId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
