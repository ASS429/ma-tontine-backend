import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   💰 GET mes revenus personnels (utilisateur)
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    // Un utilisateur voit uniquement ses propres revenus
    const { rows } = await pool.query(
      `SELECT id, source, montant, methode, statut, description, cree_le
       FROM revenus
       WHERE utilisateur_id = $1
       ORDER BY cree_le DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur revenus utilisateur:", err.message);
    res.status(500).json({ error: "Impossible de charger vos revenus" });
  }
});

/* =========================================================
   💰 POST ajouter un revenu lié à une action utilisateur
   (ex: gain tontine, remboursement, etc.)
========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { source, montant, methode, statut, description } = req.body;

    if (!source || !montant)
      return res.status(400).json({ error: "Champs obligatoires manquants" });

    const { rows } = await pool.query(
      `INSERT INTO revenus (source, montant, methode, statut, description, utilisateur_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [source, montant, methode || "autre", statut || "effectue", description || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout revenu utilisateur:", err.message);
    res.status(500).json({ error: "Impossible d’ajouter le revenu" });
  }
});

export default router;
