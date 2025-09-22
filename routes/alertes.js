// routes/alertes.js
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
    const { rows } = await pool.query(
      `SELECT * FROM public.alertes 
       WHERE "utilisateurId"=$1 
         AND "estResolue" = false
       ORDER BY "dateCreation" DESC`,
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
      const { rows: cycleActif } = await pool.query(
        `SELECT * FROM public.cycles 
         WHERE tontine_id=$1 AND cloture=false 
         ORDER BY numero DESC LIMIT 1`,
        [tontine.id]
      );

      if (cycleActif.length > 0) {
        const cycle = cycleActif[0];

        // 🔹 Vérifier combien ont cotisé dans ce cycle
        const { rows: cotises } = await pool.query(
          `SELECT COUNT(DISTINCT membre_id)::int AS nb_cotisants
           FROM cotisations
           WHERE tontine_id=$1 AND cycle_id=$2`,
          [tontine.id, cycle.id]
        );

        const nbCotisants = cotises[0].nb_cotisants;
        const nbMembres = membres.length;

        if (nbCotisants < nbMembres) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "cycle_retard",
            message: `⚠️ Cycle ${cycle.numero} bloqué : ${nbMembres - nbCotisants} membre(s) n’ont pas encore cotisé`,
            urgence: "moyenne"
          });
        }
      }

      // 👉 Tu peux compléter ici pour d'autres alertes (retard, tirage manqué, etc.)
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
    const { estResolue = true } = req.body;

    const { rows } = await pool.query(
      `UPDATE public.alertes
       SET "estResolue"=$1
       WHERE id=$2 AND "utilisateurId"=$3
       RETURNING *`,
      [estResolue, id, req.user.id]
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
