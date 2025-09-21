import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -------------------------------
   📌 GET toutes les alertes dynamiques
-------------------------------- */
router.get("/", async (req, res) => {
  try {
    // Récupérer toutes les tontines de l’utilisateur
    const { rows: tontines } = await pool.query(
      `SELECT *
       FROM tontines
       WHERE createur = $1`,
      [req.user.id]
    );

    let alertes = [];

    for (const tontine of tontines) {
      // Membres
      const { rows: membres } = await pool.query(
        `SELECT * FROM membres WHERE tontine_id = $1`,
        [tontine.id]
      );

      // Cotisations
      const { rows: paiements } = await pool.query(
        `SELECT * FROM cotisations WHERE tontine_id = $1`,
        [tontine.id]
      );

      // Tirages
      const { rows: tirages } = await pool.query(
        `SELECT * FROM tirages WHERE tontine_id = $1 ORDER BY date_tirage ASC`,
        [tontine.id]
      );

      /* -------------------------
         1. Retards cotisations
      ------------------------- */
      membres.forEach(m => {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          alertes.push({
            id: `${tontine.id}-${m.id}-retard`,
            tontineId: tontine.id,
            type: "retard",
            message: `${m.nom} est en retard dans "${tontine.nom}"`,
            urgence: "moyenne",
            dateCreation: new Date()
          });
        }
      });

      /* -------------------------
         2. Tirage disponible
      ------------------------- */
      if (paiements.length >= membres.length && tirages.length < membres.length) {
        alertes.push({
          id: `${tontine.id}-tirage`,
          tontineId: tontine.id,
          type: "tirage",
          message: `🎲 Tirage disponible pour "${tontine.nom}"`,
          urgence: "haute",
          dateCreation: new Date()
        });
      }

      /* -------------------------
         3. Cycle en retard
      ------------------------- */
      if (paiements.length >= membres.length && tirages.length === 0) {
        alertes.push({
          id: `${tontine.id}-cycle-retard`,
          tontineId: tontine.id,
          type: "cycle_retard",
          message: `⏳ Cycle en retard pour "${tontine.nom}" (tirage manquant)`,
          urgence: "moyenne",
          dateCreation: new Date()
        });
      }

      /* -------------------------
         4. Paiements en attente
      ------------------------- */
      membres.forEach(m => {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          alertes.push({
            id: `${tontine.id}-${m.id}-paiement-attente`,
            tontineId: tontine.id,
            type: "paiement_attente",
            message: `💳 Paiement attendu de ${m.nom} dans "${tontine.nom}"`,
            urgence: "basse",
            dateCreation: new Date()
          });
        }
      });
    }

    // 🔹 Retourner les alertes générées dynamiquement
    res.json(alertes);
  } catch (err) {
    console.error("❌ Erreur récupération alertes dynamiques:", err);
    res.status(500).json({ error: "Erreur récupération alertes dynamiques" });
  }
});

/* -------------------------------
   📌 DELETE ignorer une alerte (simulation côté serveur)
-------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Comme les alertes sont générées dynamiquement, on ne les supprime pas en DB.
    // On fait juste renvoyer un succès pour que le frontend retire l’alerte.
    res.json({ success: true, message: `Alerte ${id} ignorée côté serveur ✅` });
  } catch (err) {
    console.error("❌ Erreur suppression alerte:", err);
    res.status(500).json({ error: "Erreur suppression alerte" });
  }
});

export default router;
