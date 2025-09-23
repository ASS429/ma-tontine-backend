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
    if (!req.user?.id) {
      return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    const { rows } = await pool.query(
      `SELECT * FROM public.alertes 
       WHERE "utilisateurId"=$1 
         AND COALESCE(estResolue, false) = false
       ORDER BY dateCreation DESC`,
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
      // 🔹 Récup membres, cotisations, tirages, cycles
      const { rows: membres } = await pool.query(
        `SELECT * FROM public.membres WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: cotisations } = await pool.query(
        `SELECT * FROM public.cotisations WHERE tontine_id=$1`,
        [tontine.id]
      );
      const { rows: tirages } = await pool.query(
        `SELECT * FROM public.tirages WHERE tontine_id=$1 ORDER BY date_tirage ASC`,
        [tontine.id]
      );
      const { rows: cycles } = await pool.query(
        `SELECT * FROM public.cycles WHERE tontine_id=$1 ORDER BY numero DESC LIMIT 1`,
        [tontine.id]
      );
      const cycleActif = cycles[0];

      // 1️⃣ Tirage disponible
      if (cycleActif) {
        // Vérifier si tous les membres ont cotisé pour ce cycle
        const retardataires = [];
        for (const m of membres) {
          const aCotise = cotisations.some(c => c.membre_id === m.id && c.cycle_id === cycleActif.id);
          if (!aCotise) retardataires.push(m.nom);
        }

        const dejaTire = tirages.some(t => t.cycle_id === cycleActif.id);

        if (retardataires.length === 0 && !dejaTire) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "tirage",
            message: `🎲 Tirage disponible pour "${tontine.nom}" (Cycle ${cycleActif.numero})`,
            urgence: "haute",
          });
        }

        // 2️⃣ Retards de paiement
        if (retardataires.length > 0) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "retard",
            message: `⚠️ Retard de paiement dans "${tontine.nom}" : ${retardataires.join(", ")}`,
            urgence: "haute",
          });
        }

        // 3️⃣ Cycle en retard (par ex : fréquence mensuelle et aucun tirage après la date prévue)
        const dateLimite = new Date(cycleActif.cree_le);
        if (tontine.frequence_tirage === "mensuel") {
          dateLimite.setMonth(dateLimite.getMonth() + 1);
        } else if (tontine.frequence_tirage === "hebdomadaire") {
          dateLimite.setDate(dateLimite.getDate() + 7);
        }

        if (new Date() > dateLimite && !dejaTire) {
          nouvellesAlertes.push({
            utilisateurId: req.user.id,
            tontineId: tontine.id,
            type: "cycle_retard",
            message: `⏳ Cycle en retard pour "${tontine.nom}" (tirage manquant)`,
            urgence: "moyenne",
          });
        }
      }

      // 4️⃣ Résultat de tirage (dernier gagnant)
      if (tirages.length > 0) {
        const dernier = tirages[tirages.length - 1];
        nouvellesAlertes.push({
          utilisateurId: req.user.id,
          tontineId: tontine.id,
          type: "resultat_tirage",
          message: `🏆 ${dernier.membre_nom} a gagné ${Number(dernier.montant_gagne).toLocaleString()} FCFA dans "${tontine.nom}"`,
          urgence: "basse",
        });
      }
    }

    // 🔹 Insertion en DB
    const inserted = [];
    for (const alerte of nouvellesAlertes) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO public.alertes 
           ("utilisateurId","tontineId","type","message","urgence")
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT ("utilisateurId","tontineId","type","message") DO NOTHING
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
       SET estResolue=$1
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
