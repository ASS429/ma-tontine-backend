import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   📈 GET revenus (admin uniquement)
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });

    const { period } = req.query; // daily, weekly, monthly, all
    let condition = "TRUE"; // par défaut → tout

    if (period === "daily") condition = "DATE(cree_le) = CURRENT_DATE";
    else if (period === "weekly") condition = "DATE_PART('week', cree_le) = DATE_PART('week', CURRENT_DATE)";
    else if (period === "monthly") condition = "DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE)";

    const { rows } = await pool.query(
      `SELECT id, source, montant, methode, statut, description, cree_le
       FROM revenus
       WHERE ${condition}
       ORDER BY cree_le DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur revenus:", err.message);
    res.status(500).json({ error: "Impossible de charger les revenus" });
  }
});

/* =========================================================
   💰 POST ajouter un revenu (admin)
========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });

    const { source, montant, methode, statut, description } = req.body;

    if (!source || !montant)
      return res.status(400).json({ error: "Champs obligatoires manquants" });

    const { rows } = await pool.query(
      `INSERT INTO revenus (source, montant, methode, statut, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [source, montant, methode || "autre", statut || "effectue", description || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout revenu:", err.message);
    res.status(500).json({ error: "Impossible d’ajouter le revenu" });
  }
});

export default router;
