import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -----------------------
   📌 GET tirages d’une tontine
------------------------ */
router.get("/:tontineId", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ti.*, m.nom AS membre_nom
       FROM tirages ti
       JOIN membres m ON m.id = ti.membre_id
       WHERE ti.tontine_id = $1
       ORDER BY ti.date_tirage ASC`,
      [req.params.tontineId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET tirages:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST exécuter un tirage
------------------------ */
router.post("/run/:tontineId", async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l'utilisateur connecté
    const t = await pool.query(
      `SELECT id FROM tontines WHERE id = $1 AND createur = $2`,
      [tontineId, req.user.id]
    );
    if (t.rowCount === 0) {
      return res.status(404).json({ error: "Tontine non trouvée" });
    }

    // Sélectionner un membre restant aléatoirement
    const remaining = await pool.query(
      `SELECT m.id 
       FROM membres m
       WHERE m.tontine_id = $1 
         AND m.id NOT IN (SELECT membre_id FROM tirages WHERE tontine_id = $1)
       ORDER BY random()
       LIMIT 1`,
      [tontineId]
    );
    if (remaining.rowCount === 0) {
      return res.status(400).json({ error: "Tous les membres ont été tirés" });
    }

    // Insérer le tirage (date_tirage est auto-générée par défaut)
    const chosen = remaining.rows[0].id;
    const r = await pool.query(
      `INSERT INTO tirages (tontine_id, membre_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [tontineId, chosen]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("Erreur POST tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 DELETE supprimer un tirage
------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM tirages ti
       USING tontines t
       WHERE ti.id = $1
         AND t.id = ti.tontine_id
         AND t.createur = $2`,
      [req.params.id, req.user.id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Tirage non trouvé" });
    }

    res.status(204).end();
  } catch (err) {
    console.error("Erreur DELETE tirage:", err.stack);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
