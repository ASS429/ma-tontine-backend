// routes/comptesAdmin.js
import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// Vérifie que c’est bien un admin
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé à l’administrateur" });
  }
  next();
}

/* =========================================================
   👑 GET /api/admin/comptes → Liste des comptes admin
========================================================= */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { period } = req.query; // daily, weekly, monthly, all
    let condition = "TRUE";

    if (period === "daily") {
      condition = "DATE(cree_le) = CURRENT_DATE";
    } else if (period === "weekly") {
      condition = "DATE_PART('week', cree_le) = DATE_PART('week', CURRENT_DATE)";
    } else if (period === "monthly") {
      condition = "DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE)";
    }

    const { rows } = await pool.query(
      `SELECT * FROM comptes_admin WHERE admin_id = $1 AND ${condition} ORDER BY cree_le ASC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur /api/admin/comptes:", err.message);
    res.status(500).json({ error: "Erreur récupération comptes admin" });
  }
});

/* =========================================================
   ➕ POST /api/admin/comptes → Ajouter un compte admin
========================================================= */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { type, solde } = req.body;
    if (!type) return res.status(400).json({ error: "Type de compte requis" });

    const { rows } = await pool.query(
      `INSERT INTO comptes_admin (admin_id, type, solde)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, type, solde || 0]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur ajout compte admin:", err.message);
    res.status(500).json({ error: "Erreur ajout compte admin" });
  }
});

/* =========================================================
   ✏️ PUT /api/admin/comptes/:id → Modifier un solde
========================================================= */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { solde } = req.body;

    const { rows } = await pool.query(
      `UPDATE comptes_admin
       SET solde = $1
       WHERE id = $2 AND admin_id = $3
       RETURNING *`,
      [solde, id, req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Compte introuvable" });

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur update compte admin:", err.message);
    res.status(500).json({ error: "Erreur mise à jour compte admin" });
  }
});

/* =========================================================
   ❌ DELETE /api/admin/comptes/:id → Supprimer un compte
========================================================= */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM comptes_admin WHERE id = $1 AND admin_id = $2`,
      [id, req.user.id]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Compte introuvable" });

    res.json({ success: true, message: "Compte supprimé ✅" });
  } catch (err) {
    console.error("❌ Erreur suppression compte admin:", err.message);
    res.status(500).json({ error: "Erreur suppression compte admin" });
  }
});

export default router;
