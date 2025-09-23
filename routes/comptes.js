// routes/comptes.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

// 📌 GET tous les comptes de l’utilisateur
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM comptes WHERE utilisateur_id=$1 ORDER BY cree_le ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération comptes:", err.message);
    res.status(500).json({ error: "Erreur récupération comptes" });
  }
});

// 📌 POST ajouter un compte
router.post("/", async (req, res) => {
  try {
    const { type, solde } = req.body;
    if (!type) return res.status(400).json({ error: "Type de compte requis" });

    const { rows } = await pool.query(
      `INSERT INTO comptes (utilisateur_id, type, solde)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [req.user.id, type, solde || 0]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur ajout compte:", err.message);
    res.status(500).json({ error: "Erreur ajout compte" });
  }
});

// 📌 PUT mettre à jour un solde
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { solde } = req.body;

    const { rows } = await pool.query(
      `UPDATE comptes
       SET solde=$1
       WHERE id=$2 AND utilisateur_id=$3
       RETURNING *`,
      [solde, id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur update compte:", err.message);
    res.status(500).json({ error: "Erreur mise à jour compte" });
  }
});

// 📌 DELETE supprimer un compte
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM comptes WHERE id=$1 AND utilisateur_id=$2`,
      [id, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Compte introuvable" });
    }

    res.json({ success: true, message: "Compte supprimé ✅" });
  } catch (err) {
    console.error("❌ Erreur suppression compte:", err.message);
    res.status(500).json({ error: "Erreur suppression compte" });
  }
});

export default router;
