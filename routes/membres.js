import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET membres d’une tontine
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
      "SELECT * FROM membres WHERE tontine_id=$1 ORDER BY cree_le ASC",
      [tontineId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erreur fetch membres:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 POST ajouter un membre
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, nom } = req.body;

  if (!tontineId || !nom) {
    return res.status(400).json({ error: "Champs manquants" });
  }

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
      `INSERT INTO membres (tontine_id, nom) 
       VALUES ($1,$2) RETURNING *`,
      [tontineId, nom]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout membre:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
