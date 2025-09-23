// routes/stats.js
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
      cyclesRetard,
      tiragesDisponibles,
      paiementsAttente,
      paiementsTotal
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
      ),
      client.query(
        `SELECT count(*)::int as total
         FROM paiements p
         JOIN tontines t ON t.id = p.tontine_id
         WHERE t.createur = $1
           AND p.statut = 'en_attente'`,
        [req.user.id]
      ),
      client.query(
        `SELECT count(*)::int as total
         FROM paiements p
         JOIN tontines t ON t.id = p.tontine_id
         WHERE t.createur = $1`,
        [req.user.id]
      )
    ]);

    res.json({
      tontines_actives: tontinesActives.rows[0].total,
      membres_total: membresTotal.rows[0].total,
      montant_collecte: montantCollecte.rows[0].total,
      tirages_effectues: tiragesEffectues.rows[0].total,
      retards: retards.rows[0].total,
      cycles_retard: cyclesRetard.rows[0].total,
      tirages_disponibles: tiragesDisponibles.rows[0].total,
      paiements_attente: paiementsAttente.rows[0].total,
      paiements_total: paiementsTotal.rows[0].total
    });

    client.release();
  } catch (err) {
    console.error("❌ Erreur stats overview:", err);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -------------------------------
   📊 Récupérer les stats détaillées
-------------------------------- */
router.get("/details", async (req, res) => {
  try {
    const client = await pool.connect();

    // 1️⃣ Répartition par type
    const types = await client.query(
      `SELECT type, count(*)::int as total
       FROM tontines
       WHERE createur = $1
       GROUP BY type`,
      [req.user.id]
    );

    // 2️⃣ Cotisations par mois
    const cotisations = await client.query(
      `SELECT to_char(date_trunc('month', c.date_cotisation), 'YYYY-MM') as mois,
              sum(c.montant)::float as total
       FROM cotisations c
       JOIN tontines t ON t.id = c.tontine_id
       WHERE t.createur = $1
       GROUP BY 1
       ORDER BY 1 ASC`,
      [req.user.id]
    );

    // 3️⃣ Tableau de performance
    const performance = await client.query(
      `SELECT t.id, t.nom, t.type, t.statut, t.nombre_membres,
              count(DISTINCT m.id)::int as membres_actuels,
              coalesce(sum(c.montant),0)::float as total_cotisations,
              count(DISTINCT ti.id)::int as tirages_effectues
       FROM tontines t
       LEFT JOIN membres m ON m.tontine_id = t.id
       LEFT JOIN cotisations c ON c.tontine_id = t.id
       LEFT JOIN tirages ti ON ti.tontine_id = t.id
       WHERE t.createur = $1
       GROUP BY t.id, t.nom, t.type, t.statut, t.nombre_membres
       ORDER BY t.cree_le DESC`,
      [req.user.id]
    );

    res.json({
      types: types.rows,
      cotisations: cotisations.rows,
      performance: performance.rows
    });

    client.release();
  } catch (err) {
    console.error("❌ Erreur stats details:", err);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
