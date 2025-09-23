// routes/paiements.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

// 📌 GET tous les paiements d’une tontine
router.get("/:tontineId", async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      `SELECT p.*, m.nom as membre_nom
       FROM paiements p
       JOIN membres m ON p.membre_id = m.id
       WHERE p.tontine_id=$1
       ORDER BY date_paiement DESC`,
      [tontineId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération paiements:", err.message);
    res.status(500).json({ error: "Erreur récupération paiements" });
  }
});

// 📌 POST enregistrer un paiement
router.post("/", async (req, res) => {
  try {
    const { tontine_id, membre_id, type, montant, moyen, statut } = req.body;

    if (!tontine_id || !membre_id || !type || !montant || !moyen) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const { rows } = await pool.query(
      `INSERT INTO paiements (tontine_id, membre_id, type, montant, moyen, statut)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [tontine_id, membre_id, type, montant, moyen, statut || "en_attente"]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur création paiement:", err.message);
    res.status(500).json({ error: "Erreur création paiement" });
  }
});

// 📌 PUT mettre à jour un paiement (ex: statut → effectué)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const { rows } = await pool.query(
      `UPDATE paiements
       SET statut=$1
       WHERE id=$2
       RETURNING *`,
      [statut, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Paiement introuvable" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur update paiement:", err.message);
    res.status(500).json({ error: "Erreur mise à jour paiement" });
  }
});

export default router;
