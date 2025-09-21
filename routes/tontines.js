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
      `SELECT id, nom, type, montant_cotisation, frequence_cotisation, jour_cotisation,
              frequence_tirage, nombre_membres, description, statut, cree_le
       FROM tontines
       WHERE createur=$1
       ORDER BY cree_le DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur fetch tontines:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 GET une tontine avec détails (membres + cotisations)
------------------------ */
router.get("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;

  try {
    // Vérifier appartenance
    const { rows: tontineRows } = await pool.query(
      `SELECT *
       FROM tontines 
       WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );

    if (tontineRows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    const t = tontineRows[0];

    // Récupérer membres
    const { rows: membres } = await pool.query(
      `SELECT id, nom, cree_le 
       FROM membres 
       WHERE tontine_id=$1 
       ORDER BY cree_le ASC`,
      [tontineId]
    );

    // Récupérer cotisations
    const { rows: cotisations } = await pool.query(
      `SELECT id, membre_id, montant, date_cotisation 
       FROM cotisations 
       WHERE tontine_id=$1 
       ORDER BY date_cotisation DESC`,
      [tontineId]
    );

    // Récupérer tirages
    const { rows: tirages } = await pool.query(
      `SELECT id, membre_id, date_tirage 
       FROM tirages 
       WHERE tontine_id=$1 
       ORDER BY date_tirage ASC`,
      [tontineId]
    );

    // Récupérer gagnants
    const { rows: gagnants } = await pool.query(
      `SELECT membre_id, date_tirage
       FROM tirages 
       WHERE tontine_id=$1`,
      [tontineId]
    );

    // ✅ Normalisation pour correspondre au frontend
    const tontine = {
      id: t.id,
      nom: t.nom,
      type: t.type,
      montant: t.montant_cotisation,
      frequenceCotisation: t.frequence_cotisation,
      jourCotisation: t.jour_cotisation,
      frequenceTirage: t.frequence_tirage,
      nombreMembresMax: t.nombre_membres,
      description: t.description,
      statut: t.statut || "active",
      creeLe: t.cree_le,

      membres,
      cotisations,
      tirages,
      gagnants
    };

    res.json(tontine);
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
    statut // 🔹 facultatif, sinon "active" par défaut
  } = req.body;

  if (!nom || !type || !montant_cotisation) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tontines (
         nom, type, montant_cotisation, frequence_cotisation,
         jour_cotisation, frequence_tirage, nombre_membres,
         description, statut, createur
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'active'),$10)
       RETURNING *`,
      [
        nom,
        type,
        montant_cotisation,
        frequence_cotisation,
        jour_cotisation,
        frequence_tirage,
        nombre_membres,
        description || null,
        statut || null, // si non fourni → "active"
        req.user.id
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur création tontine:", err.message);
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
    statut // 🔹 important pour garder le statut à jour
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE tontines
       SET nom=$1, type=$2, montant_cotisation=$3, frequence_cotisation=$4,
           jour_cotisation=$5, frequence_tirage=$6, nombre_membres=$7,
           description=$8, statut=COALESCE($9,statut)
       WHERE id=$10 AND createur=$11
       RETURNING *`,
      [
        nom,
        type,
        montant_cotisation,
        frequence_cotisation,
        jour_cotisation,
        frequence_tirage,
        nombre_membres,
        description || null,
        statut || null,
        tontineId,
        req.user.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur modification tontine:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
