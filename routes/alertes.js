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
      `SELECT * FROM alertes 
       WHERE utilisateurid=$1 
       ORDER BY datecreation DESC`,
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

      // 1️⃣ Retards cotisations
      for (const m of membres) {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          nouvellesAlertes.push({
            utilisateurid: req.user.id,
            tontineid: tontine.id,
            type: "retard",
            message: `${m.nom} est en retard dans "${tontine.nom}"`,
            urgence: "moyenne"
          });
        }
      }

      // 2️⃣ Tirage disponible
      if (paiements.length >= membres.length && tirages.length < membres.length) {
        nouvellesAlertes.push({
          utilisateurid: req.user.id,
          tontineid: tontine.id,
          type: "tirage",
          message: `🎲 Tirage disponible pour "${tontine.nom}"`,
          urgence: "haute"
        });
      }

      // 3️⃣ Cycle en retard
      if (paiements.length >= membres.length && tirages.length === 0) {
        nouvellesAlertes.push({
          utilisateurid: req.user.id,
          tontineid: tontine.id,
          type: "cycle_retard",
          message: `⏳ Cycle en retard pour "${tontine.nom}" (tirage manquant)`,
          urgence: "moyenne"
        });
      }

      // 4️⃣ Paiements en attente
      for (const m of membres) {
        const aCotise = paiements.some(p => p.membre_id === m.id);
        if (!aCotise) {
          nouvellesAlertes.push({
            utilisateurid: req.user.id,
            tontineid: tontine.id,
            type: "paiement_attente",
            message: `💳 Paiement attendu de ${m.nom} dans "${tontine.nom}"`,
            urgence: "basse"
          });
        }
      }
    }

    // 🔹 Insertion sans doublons
    const inserted = [];
    for (const alerte of nouvellesAlertes) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO alertes (utilisateurid, tontineid, type, message, urgence)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            alerte.utilisateurid,
            alerte.tontineid,
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
   📌 DELETE ignorer une alerte
-------------------------------- */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM alertes 
       WHERE id=$1 AND utilisateurid=$2`,
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
