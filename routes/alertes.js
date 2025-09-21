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
      `SELECT * FROM alertes 
       WHERE "utilisateurId"=$1 
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
   📌 POST générer automatiquement des alertes dynamiques
-------------------------------- */
router.post("/generer", async (req, res) => {
  try {
    const { rows: tontines } = await pool.query(
      `SELECT * FROM tontines WHERE createur=$1`,
      [req.user.id]
    );

    let nouvellesAlertes = [];

    for (const tontine of tontines) {
      const { rows: membres } = await pool.query(
        `SELECT * FROM membres WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: paiements } = await pool.query(
        `SELECT * FROM cotisations WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: tirages } = await pool.query(
        `SELECT * FROM tirages WHERE tontine_id=$1 ORDER BY date_tirage ASC`,
        [tontine.id]
      );

      // 1. Retards cotisations
      for (const m of membres) {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "retard",
            message: `${m.nom} est en retard dans "${tontine.nom}"`,
            urgence: "moyenne"
          });
        }
      }

      // 2. Tirage disponible
      if (paiements.length >= membres.length && tirages.length < membres.length) {
        nouvellesAlertes.push({
          utilisateurId: req.user.id,
          tontineId: tontine.id,
          type: "tirage",
          message: `🎲 Tirage disponible pour "${tontine.nom}"`,
          urgence: "haute"
        });
      }

      // 3. Cycle en retard
      if (paiements.length >= membres.length && tirages.length === 0) {
        nouvellesAlertes.push({
          utilisateurId: req.user.id,
          tontineId: tontine.id,
          type: "cycle_retard",
          message: `⏳ Cycle en retard pour "${tontine.nom}" (tirage manquant)`,
          urgence: "moyenne"
        });
      }

      // 4. Paiements en attente
      for (const m of membres) {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "paiement_attente",
            message: `💳 Paiement attendu de ${m.nom} dans "${tontine.nom}"`,
            urgence: "basse"
          });
        }
      }
    }

    // 🔹 Insertion sans ON CONFLICT (plus safe si tu n’as pas encore ajouté la contrainte unique)
    const inserted = [];
    for (const alerte of nouvellesAlertes) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO alertes ("utilisateurId","tontineId",type,message,urgence)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING
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
    console.error("❌ Erreur génération alertes:", err);
    res.status(500).json({ error: "Erreur génération alertes" });
  }
});

/* -------------------------------
   📌 DELETE ignorer une alerte
-------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM alertes 
       WHERE id=$1 AND "utilisateurId"=$2`,
      [id, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Alerte introuvable ou non autorisée" });
    }

    res.json({ success: true, message: `Alerte ${id} supprimée ✅` });
  } catch (err) {
    console.error("❌ Erreur suppression alerte:", err);
    res.status(500).json({ error: "Erreur suppression alerte" });
  }
});

export default router;
