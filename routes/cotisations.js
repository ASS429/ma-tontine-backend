import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET cotisations d’une tontine
------------------------ */
router.get("/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l'utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const { rows } = await pool.query(
      `SELECT c.*, m.nom AS membre
       FROM cotisations c
       JOIN membres m ON m.id = c.membre_id
       WHERE c.tontine_id=$1
       ORDER BY c.date_cotisation DESC`,
      [tontineId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur fetch cotisations:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 POST ajouter une cotisation
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, membreId, date } = req.body;

  if (!tontineId || !membreId) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  try {
    // Vérifier que la tontine appartient à l'utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT montant_cotisation FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const montant = tontine[0].montant_cotisation;

    const { rows } = await pool.query(
      `INSERT INTO cotisations (tontine_id, membre_id, montant, date_cotisation)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tontineId, membreId, montant, date || new Date().toISOString().split("T")[0]]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout cotisation:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
