import express from "express";
import pool from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

// ✅ Récupérer tous les revenus admin
router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé à l’administrateur" });

    const { rows } = await pool.query(
      `SELECT id, source, montant, methode, statut, description, cree_le
       FROM revenus_admin
       ORDER BY cree_le DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur revenus_admin:", err.message);
    res.status(500).json({ error: "Impossible de charger les revenus admin" });
  }
});

// ✅ Ajouter un revenu manuel (admin)
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé à l’administrateur" });

    const { source, montant, methode, statut, description } = req.body;
    if (!source || !montant)
      return res.status(400).json({ error: "Champs obligatoires manquants" });

    const { rows } = await pool.query(
      `INSERT INTO revenus_admin (source, montant, methode, statut, description, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [source, montant, methode || "autre", statut || "effectue", description || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout revenu_admin:", err.message);
    res.status(500).json({ error: "Impossible d’ajouter le revenu" });
  }
});

export default router;
