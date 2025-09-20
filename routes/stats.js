import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

/* -------------------------------
   📊 Récupérer les stats globales
-------------------------------- */
router.get("/overview", async (req, res) => {
  try {
    const client = await pool.connect();

    const [
      tontinesActives,
      membresTotal,
      montantCollecte,
      tiragesEffectues,
      retards,
      paiementsAttente,
      tiragesDisponibles
    ] = await Promise.all([
      client.query(
        `SELECT count(*)::int as total
         FROM tontines
         WHERE createur = $1 AND statut = 'active'`,
        [req.user.id]
      ),
      client.query(
        `SELECT count(*)::int as total
         FROM membres m
         JOIN tontines t ON t.id = m.tontine_id
         WHERE t.createur = $1`,
        [req.user.id]
      ),
      client.query(
        `SELECT coalesce(sum(c.montant),0)::float as total
         FROM cotisations c
         JOIN tontines t ON t.id = c.tontine_id
         WHERE t.createur = $1`,
        [req.user.id]
      ),
      client.query(
        `SELECT count(*)::int as total
         FROM tirages ti
         JOIN tontines t ON t.id = ti.tontine_id
         WHERE t.createur = $1`,
        [req.user.id]
      ),
      // 🔹 Retards (cotisations en retard par rapport à la date du jour)
      client.query(
        `SELECT count(*)::int as total
         FROM membres m
         JOIN tontines t ON t.id = m.tontine_id
         WHERE t.createur = $1
           AND NOT EXISTS (
             SELECT 1 FROM cotisations c
             WHERE c.membre_id = m.id
             AND c.date_cotisation = current_date
           )`,
        [req.user.id]
      ),
      // 🔹 Paiements en attente (membres sans cotisation pour la période en cours)
      client.query(
        `SELECT count(*)::int as total
         FROM membres m
         JOIN tontines t ON t.id = m.tontine_id
         WHERE t.createur = $1
           AND NOT EXISTS (
             SELECT 1 FROM cotisations c
             WHERE c.membre_id = m.id
               AND date_trunc('month', c.date_cotisation) = date_trunc('month', current_date)
           )`,
        [req.user.id]
      ),
      // 🔹 Tirages disponibles (toutes cotisations faites ce mois)
      client.query(
        `SELECT count(*)::int as total
         FROM tontines t
         WHERE t.createur = $1
           AND NOT EXISTS (
             SELECT 1 FROM membres m
             WHERE m.tontine_id = t.id
             AND NOT EXISTS (
               SELECT 1 FROM cotisations c
               WHERE c.membre_id = m.id
                 AND date_trunc('month', c.date_cotisation) = date_trunc('month', current_date)
             )
           )`,
        [req.user.id]
      )
    ]);

    res.json({
      tontines_actives: tontinesActives.rows[0].total,
      membres_total: membresTotal.rows[0].total,
      montant_collecte: montantCollecte.rows[0].total,
      tirages_effectues: tiragesEffectues.rows[0].total,
      retards: retards.rows[0].total,
      paiements_attente: paiementsAttente.rows[0].total,
      tirages_disponibles: tiragesDisponibles.rows[0].total
    });

    client.release();
  } catch (err) {
    console.error("❌ Erreur stats overview:", err);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
