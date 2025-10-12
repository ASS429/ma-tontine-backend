import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateMonthlyReport } from "../utils/reports.js";

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

**
 * 📊 POST /api/admin/rapports/generate → Génère un rapport manuel
 */
router.post("/generate", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé" });
    }

    await generateMonthlyReport(req.user.id);
    res.json({ success: true, message: "Rapport généré avec succès" });
  } catch (err) {
    console.error("Erreur POST /rapports/generate:", err.message);
    res.status(500).json({ error: "Impossible de générer le rapport" });
  }
});

export default router;
