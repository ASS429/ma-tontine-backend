import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   📈 GET revenus admin (statistiques)
========================================================= */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });

    const query = `
      WITH
      daily AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE(cree_le) = CURRENT_DATE
      ),
      monthly AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE)
          AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE)
      ),
      prev_month AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
          AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE - INTERVAL '1 month')
      )
      SELECT
        (SELECT total FROM daily) AS daily_total,
        (SELECT total FROM monthly) AS monthly_total,
        (SELECT total FROM prev_month) AS prev_month_total;
    `;

    const { rows } = await pool.query(query);
    const stats = rows[0];

    const growth = stats.prev_month_total > 0
      ? ((stats.monthly_total - stats.prev_month_total) / stats.prev_month_total * 100).toFixed(2)
      : "100.00";

    res.json({
      daily_total: Number(stats.daily_total),
      monthly_total: Number(stats.monthly_total),
      prev_month_total: Number(stats.prev_month_total),
      growth: Number(growth)
    });

  } catch (err) {
    console.error("Erreur /revenus_admin/stats:", err.message);
    res.status(500).json({ error: "Impossible de charger les statistiques" });
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

/* =========================================================
   📋 GET /revenus_admin/transactions → liste formatée
========================================================= */
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });

    const { rows } = await pool.query(
      `SELECT id, source AS description, montant, methode, statut, cree_le
       FROM revenus_admin
       ORDER BY cree_le DESC
       LIMIT 50`
    );

    const formatted = rows.map(r => ({
      id: r.id,
      description: r.description,
      amount: Number(r.montant),
      method: r.methode || "cash",
      date: new Date(r.cree_le).toLocaleDateString("fr-FR"),
      type: r.statut === "effectue" ? "income" : "expense"
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Erreur /revenus_admin/transactions:", err.message);
    res.status(500).json({ error: "Impossible de charger les transactions" });
  }
});

export default router;
