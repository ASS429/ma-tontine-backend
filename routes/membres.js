import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Ajouter un membre (seulement si la tontine appartient à l'utilisateur)
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, nom } = req.body;
  try {
    const { rows } = await pool.query(
      `WITH allowed AS (
         SELECT id FROM tontines WHERE id = $1 AND createur = $2
       )
       INSERT INTO membres (tontine_id, nom)
       SELECT $1, $3 FROM allowed
       RETURNING *`,
      [tontineId, req.user.id, nom]
    );
    if (!rows.length) return res.status(403).json({ error: "Accès refusé" });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lister les membres d’une tontine (seulement si elle appartient à l’utilisateur)
router.get("/:tontineId", requireAuth, async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      `SELECT m.*
       FROM membres m
       JOIN tontines t ON t.id = m.tontine_id
       WHERE m.tontine_id = $1 AND t.createur = $2
       ORDER BY m.cree_le DESC`,
      [tontineId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
