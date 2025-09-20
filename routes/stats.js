import express from "express";
import { requireAuth } from "../middleware/auth.js"; // tu avais authenticate → garde le même nom que dans tes autres routes
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

// 📊 Récupérer les stats globales de l’utilisateur connecté
router.get("/overview", async (req, res) => {
  try {
    const [{ rows: tCount }, { rows: mCount }, { rows: cSum }, { rows: dCount }] = await Promise.all([
      pool.query(`SELECT count(*)::int as total 
                  FROM tontines 
                  WHERE createur = $1`, [req.user.id]),

      pool.query(`SELECT count(*)::int as total 
                  FROM membres m 
                  JOIN tontines t ON t.id = m.tontine_id 
                  WHERE t.createur = $1`, [req.user.id]),

      pool.query(`SELECT coalesce(sum(montant),0)::float as total 
                  FROM cotisations c 
                  JOIN tontines t ON t.id = c.tontine_id 
                  WHERE t.createur = $1`, [req.user.id]),

      pool.query(`SELECT count(*)::int as total 
                  FROM tirages ti 
                  JOIN tontines t ON t.id = ti.tontine_id 
                  WHERE t.createur = $1`, [req.user.id])
    ]);

    res.json({
      tontines_actives: tCount[0].total,
      membres_total: mCount[0].total,
      montant_collecte: cSum[0].total,
      tirages_effectues: dCount[0].total
    });
  } catch (err) {
    console.error("Erreur stats overview:", err);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
