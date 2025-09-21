import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -------------------------------
   📌 GET toutes les alertes
-------------------------------- */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM alertes
       WHERE "utilisateurId" = $1
       ORDER BY "dateCreation" DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération alertes:", err);
    res.status(500).json({ error: "Erreur récupération alertes" });
  }
});

/* -------------------------------
   📌 POST créer une nouvelle alerte
-------------------------------- */
router.post("/", async (req, res) => {
  const { tontineId, type, message, urgence } = req.body;

  if (!tontineId || !type || !message || !urgence) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO alertes ("utilisateurId", "tontineId", type, message, urgence, "dateCreation")
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [req.user.id, tontineId, type, message, urgence]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur création alerte:", err);
    res.status(500).json({ error: "Erreur création alerte" });
  }
});

/* -------------------------------
   📌 DELETE une alerte par ID
-------------------------------- */
router.delete("/:id", async (req, res) => {
  const alerteId = req.params.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM alertes
       WHERE id = $1 AND "utilisateurId" = $2`,
      [alerteId, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Alerte introuvable ou non autorisée" });
    }

    res.json({ success: true, message: "Alerte supprimée avec succès" });
  } catch (err) {
    console.error("❌ Erreur suppression alerte:", err);
    res.status(500).json({ error: "Erreur suppression alerte" });
  }
});

export default router;
