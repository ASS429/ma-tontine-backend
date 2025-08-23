import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET toutes mes tontines
------------------------ */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tontines WHERE createur = $1 ORDER BY cree_le DESC`,
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

export default router;
