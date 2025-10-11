// routes/comptes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* =========================================================
   👤 GET /api/comptes → Comptes de l'utilisateur courant
========================================================= */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM comptes WHERE utilisateur_id = $1 ORDER BY cree_le ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération comptes:", err.message);
    res.status(500).json({ error: "Erreur récupération comptes" });
  }
});

/* =========================================================
   ➕ POST /api/comptes → Ajouter un compte
========================================================= */
router.post("/", async (req, res) => {
  try {
    const { type, solde } = req.body;
    if (!type) return res.status(400).json({ error: "Type de compte requis" });

    const { rows } = await pool.query(
      `INSERT INTO comptes (utilisateur_id, type, solde)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, type, solde || 0]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur ajout compte:", err.message);
    res.status(500).json({ error: "Erreur ajout compte" });
  }
});

/* =========================================================
   ✏️ PUT /api/comptes/:id → Mettre à jour un solde
========================================================= */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { solde } = req.body;

    const { rows } = await pool.query(
      `UPDATE comptes
       SET solde = $1
       WHERE id = $2 AND utilisateur_id = $3
       RETURNING *`,
      [solde, id, req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Compte introuvable" });

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur update compte:", err.message);
    res.status(500).json({ error: "Erreur mise à jour compte" });
  }
});

/* =========================================================
   ❌ DELETE /api/comptes/:id → Supprimer un compte
========================================================= */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM comptes WHERE id = $1 AND utilisateur_id = $2`,
      [id, req.user.id]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Compte introuvable" });

    res.json({ success: true, message: "Compte supprimé ✅" });
  } catch (err) {
    console.error("❌ Erreur suppression compte:", err.message);
    res.status(500).json({ error: "Erreur suppression compte" });
  }
});

/* =========================================================
   👑 GET /api/comptes/admin → Comptes de l'administrateur (filtrés)
========================================================= */
router.get("/admin", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé à l’administrateur" });
    }

    const { period } = req.query; // daily, weekly, monthly, all
    let condition = "TRUE";

    // 🔹 Périodes dynamiques
    if (period === "daily") {
      condition = `DATE(cree_le) = CURRENT_DATE`;
    } else if (period === "weekly") {
      condition = `DATE_PART('week', cree_le) = DATE_PART('week', CURRENT_DATE)
                   AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE)`;
    } else if (period === "monthly") {
      condition = `DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE)
                   AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE)`;
    }

    // 🔹 Récupération des comptes admin selon la période
    const { rows } = await pool.query(
      `
      SELECT id, type, solde, cree_le
      FROM comptes
      WHERE utilisateur_id = $1
        AND ${condition}
      ORDER BY cree_le ASC
      `,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json([]);
    }

    // 🔹 Optionnel : Calculer des totaux groupés par type
    const summary = {
      orange_money: 0,
      wave: 0,
      especes: 0,
      total: 0,
    };

    rows.forEach((r) => {
      const type = r.type;
      summary[type] = Number(r.solde);
      summary.total += Number(r.solde);
    });

    res.json(rows); // 🔹 ou bien => res.json(summary) si tu veux des totaux
  } catch (err) {
    console.error("❌ Erreur /api/comptes/admin:", err.message);
    res.status(500).json({ error: "Impossible de charger les comptes admin" });
  }
});

export default router;
