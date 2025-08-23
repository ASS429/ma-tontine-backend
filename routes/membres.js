import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { tontineId, nom } = req.body;

  if (!tontineId || !nom) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO membres (tontine_id, nom)
       VALUES ($1, $2) RETURNING *`,
      [tontineId, nom]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout membre:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
