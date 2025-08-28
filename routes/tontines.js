import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET toutes mes tontines avec résumé
------------------------ */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
          t.*,
          COALESCE(m.nb_membres, 0) AS nombre_membres,
          COALESCE(c.nb_cotisations, 0) AS nombre_cotisations
       FROM tontines t
       LEFT JOIN (
          SELECT tontineid, COUNT(*) AS nb_membres
          FROM membres
          GROUP BY tontineid
       ) m ON t.id = m.tontineid
       LEFT JOIN (
          SELECT tontineid, COUNT(*) AS nb_cotisations
          FROM cotisations
          GROUP BY tontineid
       ) c ON t.id = c.tontineid
       WHERE t.createur = $1
       ORDER BY t.cree_le DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur fetch tontines:", err.message);
    res.status(500).json({ error: err.message });
  }
});


/* -----------------------
   📌 POST créer une tontine
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { nom, type, montant, frequence, jour, tirage, nbMembres, description } = req.body;

  if (!nom || !type) {
    return res.status(400).json({ error: "Nom et type obligatoires" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tontines 
        (nom, type, montant_cotisation, frequence_cotisation, jour_cotisation, 
         frequence_tirage, nombre_membres, description, createur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [nom, type, montant, frequence, jour, tirage, nbMembres, description, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur création tontine:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT modifier une tontine
------------------------ */
router.put("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;
  const { nom, type, montant, frequence, jour, tirage, nbMembres, description } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE tontines
       SET nom=$1, type=$2, montant_cotisation=$3, frequence_cotisation=$4, 
           jour_cotisation=$5, frequence_tirage=$6, nombre_membres=$7, description=$8
       WHERE id=$9 AND createur=$10
       RETURNING *`,
      [nom, type, montant, frequence, jour, tirage, nbMembres, description, tontineId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: "Non autorisé ou tontine introuvable" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur maj tontine:", err.message);
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
      return res.status(403).json({ error: "Non autorisé ou tontine introuvable" });
    }

    res.json({ message: "Tontine supprimée ✅" });
  } catch (err) {
    console.error("Erreur suppression tontine:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 GET une tontine avec détails (membres + cotisations)
------------------------ */
router.get("/:id", requireAuth, async (req, res) => {
  const tontineId = req.params.id;

  try {
    // 1. Vérifier que la tontine existe et appartient à l’utilisateur
    const { rows: tontineRows } = await pool.query(
      `SELECT * FROM tontines WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );

    if (tontineRows.length === 0) {
      return res.status(404).json({ error: "Tontine introuvable ou non autorisée" });
    }

    const tontine = tontineRows[0];

    // 2. Récupérer les membres de la tontine (triés par date d’ajout ASC)
    const { rows: membres } = await pool.query(
      `SELECT id, nom, cree_le 
       FROM membres 
       WHERE tontine_id=$1 
       ORDER BY cree_le ASC`,
      [tontineId]
    );

    // 3. Récupérer les cotisations (triées par date DESC)
    const { rows: cotisations } = await pool.query(
      `SELECT id, membre_id, montant, date_cotisation 
       FROM cotisations 
       WHERE tontine_id=$1 
       ORDER BY date_cotisation DESC`,
      [tontineId]
    );

    // 4. Retourner un objet complet
    res.json({
      ...tontine,
      membres,
      cotisations
    });

  } catch (err) {
    console.error("Erreur fetch tontine complète:", err);
    res.status(500).json({ error: err.message });
  }
});

  } catch (err) {
    console.error("Erreur fetch tontine complète:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
