import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET toutes les tontines de l’utilisateur
------------------------ */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT t.*,
             CASE 
               WHEN (SELECT COUNT(*) FROM tirages WHERE tontine_id = t.id) >= t.nombre_membres
               THEN 'terminee'
               ELSE t.statut
             END AS statut_calcule
      FROM tontines t
      WHERE t.createur=$1
      ORDER BY t.cree_le DESC
      `,
      [req.user.id]
    );

    const tontines = rows.map(t => ({
      id: t.id,
      nom: t.nom,
      type: t.type,
      montant: t.montant_cotisation,
      frequenceCotisation: t.frequence_cotisation,
      jourCotisation: t.jour_cotisation,
      frequenceTirage: t.frequence_tirage,
      nombreMembresMax: t.nombre_membres,
      description: t.description,
      statut: t.statut_calcule,
      creeLe: t.cree_le,
      membres: [],
      cotisations: [],
      tirages: [],
      gagnants: []
    }));

    res.json(tontines);
  } catch (err) {
    console.error("Erreur fetch tontines:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 GET une tontine avec détails
------------------------ */
router.get("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;

  try {
    const { rows: tontineRows } = await pool.query(
      `
      SELECT t.*,
             CASE 
               WHEN (SELECT COUNT(*) FROM tirages WHERE tontine_id = t.id) >= t.nombre_membres
               THEN 'terminee'
               ELSE t.statut
             END AS statut_calcule
      FROM tontines t
      WHERE t.id=$1 AND t.createur=$2
      `,
      [tontineId, req.user.id]
    );

    if (tontineRows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    const t = tontineRows[0];

    // Membres
    const { rows: membres } = await pool.query(
      `SELECT id, nom, cree_le 
       FROM membres 
       WHERE tontine_id=$1 
       ORDER BY cree_le ASC`,
      [tontineId]
    );

    // Cotisations
    const { rows: cotisations } = await pool.query(
      `SELECT id, membre_id, montant, date_cotisation 
       FROM cotisations 
       WHERE tontine_id=$1 
       ORDER BY date_cotisation DESC`,
      [tontineId]
    );

    // Tirages
    const { rows: tirages } = await pool.query(
      `SELECT id, membre_id, date_tirage
       FROM tirages
       WHERE tontine_id=$1
       ORDER BY date_tirage DESC`,
      [tontineId]
    );

    res.json({
      id: t.id,
      nom: t.nom,
      type: t.type,
      montant: t.montant_cotisation,
      frequenceCotisation: t.frequence_cotisation,
      jourCotisation: t.jour_cotisation,
      frequenceTirage: t.frequence_tirage,
      nombreMembresMax: t.nombre_membres,
      description: t.description,
      statut: t.statut_calcule, // ✅ calcul auto
      creeLe: t.cree_le,
      membres,
      cotisations,
      tirages,
      gagnants: tirages
    });
  } catch (err) {
    console.error("Erreur fetch tontine complète:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 POST créer une tontine
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const {
    nom,
    type,
    montant_cotisation,
    frequence_cotisation,
    jour_cotisation,
    frequence_tirage,
    nombre_membres,
    description,
  } = req.body;

  if (!nom || !type || !montant_cotisation) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  try {
    // 🔎 Vérifier le plan + statut paiement de l’utilisateur
    const { rows: userRows } = await pool.query(
      "SELECT plan, payment_status FROM utilisateurs WHERE id=$1",
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(403).json({ error: "Utilisateur introuvable" });
    }

    const plan = userRows[0].plan || "Free";
    const paymentStatus = userRows[0].payment_status || "none";

    // 🚫 Bloquer si Premium mais pas encore validé
    if (plan === "Premium" && paymentStatus === "en_attente") {
      return res.status(403).json({
        error: "⏳ Votre abonnement Premium est en attente de validation par un administrateur."
      });
    }

    if (plan === "Premium" && paymentStatus === "rejete") {
      return res.status(403).json({
        error: "❌ Votre demande Premium a été rejetée. Contactez un administrateur."
      });
    }

    // 🚫 Si Free → limite de 2 tontines
    if (plan === "Free") {
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) FROM tontines WHERE createur=$1",
        [req.user.id]
      );

      const tontineCount = parseInt(countRows[0].count);
      if (tontineCount >= 2) {
        return res.status(403).json({
          error: "🚫 Limite atteinte : en plan Free vous ne pouvez créer que 2 tontines."
        });
      }
    }

    const jourFinal =
  frequence_cotisation === "quotidien" ? null : jour_cotisation;

const { rows } = await pool.query(
  `INSERT INTO tontines (
     nom, type, montant_cotisation, frequence_cotisation,
     jour_cotisation, frequence_tirage, nombre_membres,
     description, createur
   )
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   RETURNING *`,
  [
    nom,
    type,
    montant_cotisation,
    frequence_cotisation,
    jourFinal,
    frequence_tirage,
    nombre_membres,
    description || null,
    req.user.id
  ]
);

    const t = rows[0];

    res.status(201).json({
      id: t.id,
      nom: t.nom,
      type: t.type,
      montant: t.montant_cotisation,
      frequenceCotisation: t.frequence_cotisation,
      jourCotisation: t.jour_cotisation,
      frequenceTirage: t.frequence_tirage,
      nombreMembresMax: t.nombre_membres,
      description: t.description,
      statut: "active",
      creeLe: t.cree_le,
      membres: [],
      cotisations: [],
      tirages: [],
      gagnants: []
    });
  } catch (err) {
    console.error("Erreur création tontine:", err.message);
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

/* -----------------------
   📌 PUT modifier une tontine
------------------------ */
router.put("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;
  const {
    nom,
    type,
    montant_cotisation,
    frequence_cotisation,
    jour_cotisation,
    frequence_tirage,
    nombre_membres,
    description,
    statut
  } = req.body;
   
const jourFinal =
  frequence_cotisation === "quotidien" ? null : jour_cotisation;

  try {
    const { rows } = await pool.query(
      `UPDATE tontines
       SET nom=$1, type=$2, montant_cotisation=$3, frequence_cotisation=$4,
           jourFinal=$5, frequence_tirage=$6, nombre_membres=$7,
           description=$8, statut=$9
       WHERE id=$10 AND createur=$11
       RETURNING *`,
      [
        nom,
        type,
        montant_cotisation,
        frequence_cotisation,
        jourFinal,
        frequence_tirage,
        nombre_membres,
        description || null,
        statut || "active",
        tontineId,
        req.user.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    const t = rows[0];

    // ✅ recalcul auto
    const { rows: tiragesCount } = await pool.query(
      `SELECT COUNT(*)::int AS nb FROM tirages WHERE tontine_id = $1`,
      [t.id]
    );

    const statut_calcule = tiragesCount[0].nb >= t.nombre_membres ? "terminee" : t.statut;

    res.json({
      id: t.id,
      nom: t.nom,
      type: t.type,
      montant: t.montant_cotisation,
      frequenceCotisation: t.frequence_cotisation,
      jourCotisation: t.jour_cotisation,
      frequenceTirage: t.frequence_tirage,
      nombreMembresMax: t.nombre_membres,
      description: t.description,
      statut: statut_calcule,
      creeLe: t.cree_le,
      membres: [],
      cotisations: [],
      tirages: [],
      gagnants: []
    });
  } catch (err) {
    console.error("Erreur modification tontine:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 DELETE supprimer une tontine
------------------------ */
router.delete("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM tontines WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    res.json({ success: true, message: "Tontine supprimée avec succès" });
  } catch (err) {
    console.error("Erreur suppression tontine:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
