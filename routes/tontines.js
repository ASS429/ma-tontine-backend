import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET une tontine avec détails (membres + cotisations)
------------------------ */
router.get("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;

  try {
    // 1. Vérifier que la tontine existe et appartient à l’utilisateur
    const { rows: tontineRows } = await pool.query(
      `SELECT * FROM tontines WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );

    if (tontineRows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    const tontine = tontineRows[0];

    // 2. Récupérer les membres de la tontine
    const { rows: membres } = await pool.query(
      `SELECT id, nom, cree_le 
       FROM membres 
       WHERE tontine_id=$1 
       ORDER BY cree_le ASC`,
      [tontineId]
    );

    // 3. Récupérer les cotisations
    const { rows: cotisations } = await pool.query(
      `SELECT id, membre_id, montant, date_cotisation 
       FROM cotisations 
       WHERE tontine_id=$1 
       ORDER BY date_cotisation DESC`,
      [tontineId]
    );

    // 4. Retourner un objet complet
    res.json({
      ...tontine,
      membres,
      cotisations
    });
  } catch (err) {
    console.error("Erreur fetch tontine complète:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
