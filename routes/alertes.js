import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// Récupérer les alertes pour l’utilisateur connecté
router.get("/", async (req, res) => {
  try {
    // Récupérer toutes les tontines de l’utilisateur
    const tontinesRes = await query(
      `select t.id, t.nom, t.montant, t.type, t.statut, t.frequence_cotisation, t.frequence_tirage 
       from tontines t where t.user_id = $1`,
      [req.user.id]
    );
    const tontines = tontinesRes.rows;

    const alertes = [];

    for (const tontine of tontines) {
      // Récupérer membres et paiements
      const membresRes = await query(
        `select m.id, m.nom, m.created_at 
         from membres m where m.tontine_id = $1`,
        [tontine.id]
      );
      const membres = membresRes.rows;

      const paiementsRes = await query(
        `select p.membre_id, p.periode, p.montant, p.created_at
         from paiements p where p.tontine_id = $1`,
        [tontine.id]
      );
      const paiements = paiementsRes.rows;

      const tiragesRes = await query(
        `select * from tirages where tontine_id = $1 order by ordre asc`,
        [tontine.id]
      );
      const tirages = tiragesRes.rows;

      // --- Exemple simple d’alertes ---
      // Retards cotisations
      membres.forEach(m => {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          alertes.push({
            type: "retard",
            tontineId: tontine.id,
            tontine: tontine.nom,
            membreId: m.id,
            membre: m.nom,
            message: `${m.nom} est en retard dans "${tontine.nom}"`,
            urgence: "moyenne",
            dateCreation: new Date().toISOString()
          });
        }
      });

      // Tirage dispo si tout le monde a payé
      const totalCotisations = paiements.length;
      if (totalCotisations >= membres.length && tirages.length < membres.length) {
        alertes.push({
          type: "tirage",
          tontineId: tontine.id,
          tontine: tontine.nom,
          message: `🎲 Tirage disponible pour "${tontine.nom}"`,
          urgence: "haute",
          dateCreation: new Date().toISOString()
        });
      }
    }

    res.json(alertes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération alertes" });
  }
});

export default router;
