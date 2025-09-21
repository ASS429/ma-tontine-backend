import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -------------------------------
   📌 GET toutes les alertes d’un utilisateur
-------------------------------- */
router.get("/", async (req, res) => {
  try {
    console.log("🔍 GET /alertes utilisateur:", req.user?.id);

    const { rows } = await pool.query(
      `SELECT * FROM public.alertes 
       WHERE "utilisateurId"=$1 
         AND estresolue = false
       ORDER BY "datecreation" DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération alertes:", err.message);
    res.status(500).json({ error: "Erreur récupération alertes" });
  }
});

/* -------------------------------
   📌 POST générer automatiquement des alertes dynamiques
-------------------------------- */
router.post("/generer", async (req, res) => {
  try {
    const { rows: tontines } = await pool.query(
      `SELECT * FROM public.tontines WHERE createur=$1`,
      [req.user.id]
    );

    let nouvellesAlertes = [];

    for (const tontine of tontines) {
      const { rows: membres } = await pool.query(
        `SELECT * FROM public.membres WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: paiements } = await pool.query(
        `SELECT * FROM public.cotisations WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: tirages } = await pool.query(
        `SELECT * FROM public.tirages WHERE tontine_id=$1 ORDER BY date_tirage ASC`,
        [tontine.id]
      );

      // ⚡ logiques inchangées (retard, tirage, cycle, paiement_attente)
      // ...
    }

    // 🔹 Insertion en DB
    const inserted = [];
    for (const alerte of nouvellesAlertes) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO public.alertes ("utilisateurId","tontineId",type,message,urgence)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT ("utilisateurId","tontineId",type,message) DO NOTHING
           RETURNING *`,
          [
            alerte.utilisateurId,
            alerte.tontineId,
            alerte.type,
            alerte.message,
            alerte.urgence
          ]
        );
        if (rows.length > 0) inserted.push(rows[0]);
      } catch (e) {
        console.error("⚠️ Erreur insertion alerte:", e.message);
      }
    }

    res.json({ success: true, inserted });
  } catch (err) {
    console.error("❌ Erreur génération alertes:", err.message);
    res.status(500).json({ error: "Erreur génération alertes" });
  }
});

/* -------------------------------
   📌 PUT marquer une alerte comme résolue
-------------------------------- */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { estresolue = true } = req.body; // ⚠ doit matcher le champ DB

    const { rows } = await pool.query(
      `UPDATE public.alertes
       SET estresolue=$1
       WHERE id=$2 AND "utilisateurId"=$3
       RETURNING *`,
      [estresolue, id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Alerte introuvable ou non autorisée" });
    }

    res.json({ success: true, alerte: rows[0] });
  } catch (err) {
    console.error("❌ Erreur update alerte:", err.message);
    res.status(500).json({ error: "Erreur mise à jour alerte" });
  }
});

/* -------------------------------
   📌 DELETE ignorer une alerte
-------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM public.alertes 
       WHERE id=$1 AND "utilisateurId"=$2`,
      [id, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Alerte introuvable ou non autorisée" });
    }

    res.json({ success: true, message: `Alerte ${id} supprimée ✅` });
  } catch (err) {
    console.error("❌ Erreur suppression alerte:", err.message);
    res.status(500).json({ error: "Erreur suppression alerte" });
  }
});

export default router;
