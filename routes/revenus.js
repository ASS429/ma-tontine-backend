import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   📈 GET tous les revenus (admin uniquement)
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { period } = req.query; // daily, weekly, monthly ou all

    let query = `
      SELECT id, source, montant, methode, statut, description, cree_le
      FROM revenus
      ORDER BY cree_le DESC
    `;

    if (period === "daily") query = `SELECT * FROM revenus WHERE DATE(cree_le) = CURRENT_DATE ORDER BY cree_le DESC`;
    if (period === "weekly") query = `SELECT * FROM revenus WHERE DATE_PART('week', cree_le) = DATE_PART('week', CURRENT_DATE) ORDER BY cree_le DESC`;
    if (period === "monthly") query = `SELECT * FROM revenus WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE) ORDER BY cree_le DESC`;

    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Erreur GET revenus:", err.message);
    res.status(500).json({ error: "Impossible de charger les revenus" });
  }
});

/* =========================================================
   💰 POST ajouter un revenu (admin uniquement)
========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { source, montant, methode, statut, description } = req.body;

    if (!source || !montant) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const { rows } = await pool.query(
      `INSERT INTO revenus (source, montant, methode, statut, description, utilisateur_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [source, montant, methode || "autre", statut || "effectue", description || null, req.user.id]
    );

    res.status(201).json({ message: "Revenu ajouté ✅", revenu: rows[0] });
  } catch (err) {
    console.error("Erreur POST revenus:", err.message);
    res.status(500).json({ error: "Impossible d’ajouter le revenu" });
  }
});

export default router;
