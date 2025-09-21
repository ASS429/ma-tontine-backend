// routes/alertes.js
import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// 📌 Récupérer (et générer si besoin) les alertes pour l’utilisateur
router.get("/", async (req, res) => {
  try {
    // Récupérer les tontines actives de l’utilisateur
    const tontinesRes = await query(
      `SELECT id, nom, montant_cotisation, type, statut
       FROM tontines WHERE createur=$1`,
      [req.user.id]
    );
    const tontines = tontinesRes.rows;

    let nouvellesAlertes = [];

    for (const tontine of tontines) {
      // Membres
      const membresRes = await query(
        `SELECT id, nom, cree_le 
         FROM membres WHERE tontine_id=$1`,
        [tontine.id]
      );
      const membres = membresRes.rows;

      // Cotisations
      const cotisationsRes = await query(
        `SELECT membre_id, montant, date_cotisation 
         FROM cotisations WHERE tontine_id=$1`,
        [tontine.id]
      );
      const cotisations = cotisationsRes.rows;

      // Tirages
      const tiragesRes = await query(
        `SELECT * FROM tirages WHERE tontine_id=$1`,
        [tontine.id]
      );
      const tirages = tiragesRes.rows;

      // 🔔 Générer les alertes dynamiques

      // Retards de cotisation
      membres.forEach(m => {
        const aCotise = cotisations.some(c => c.membre_id === m.id);
        if (!aCotise) {
          nouvellesAlertes.push({
            type: "retard",
            tontineId: tontine.id,
            message: `${m.nom} est en retard dans "${tontine.nom}"`,
            urgence: "moyenne",
            utilisateurId: req.user.id
          });
        }
      });

      // Tirage dispo
      if (cotisations.length >= membres.length && tirages.length < membres.length) {
        nouvellesAlertes.push({
          type: "tirage",
          tontineId: tontine.id,
          message: `🎲 Tirage disponible pour "${tontine.nom}"`,
          urgence: "haute",
          utilisateurId: req.user.id
        });
      }
    }

    // ➕ Insérer les nouvelles alertes dans la table
    for (const alerte of nouvellesAlertes) {
      await query(
        `INSERT INTO alertes (utilisateurId, tontineId, type, message, urgence)
         VALUES ($1, $2, $3, $4, $5)`,
        [alerte.utilisateurId, alerte.tontineId, alerte.type, alerte.message, alerte.urgence]
      );
    }

    // 🔄 Retourner toutes les alertes en base
    const { rows: alertesFinales } = await query(
      `SELECT * FROM alertes WHERE utilisateurId=$1 ORDER BY dateCreation DESC`,
      [req.user.id]
    );

    res.json(alertesFinales);
  } catch (err) {
    console.error("❌ Erreur récupération alertes:", err.message);
    res.status(500).json({ error: "Erreur récupération alertes" });
  }
});

// 📌 Supprimer une alerte
router.delete("/:id", async (req, res) => {
  try {
    await query(
      `DELETE FROM alertes WHERE id=$1 AND utilisateurId=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur suppression alerte:", err.message);
    res.status(500).json({ error: "Erreur suppression alerte" });
  }
});

export default router;
