import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * 📊 GET /api/admin/rapports → liste des rapports mensuels
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé" });

    const { rows } = await pool.query(
      `SELECT mois, total_revenus, total_abonnes, total_premium, nouveaux_abonnes, cree_le
       FROM rapports_admin
       WHERE admin_id = $1
       ORDER BY mois DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur GET /rapports:", err.message);
    res.status(500).json({ error: "Impossible de charger les rapports" });
  }
});

export default router;
