// ESM
import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Lister les tontines de l'utilisateur connecté
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tontines WHERE createur = $1 ORDER BY cree_le DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Créer une tontine (createur = utilisateur courant)
router.post("/", requireAuth, async (req, res) => {
  const { nom, type, montant, frequence, jour, tirage, nbMembres, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tontines (nom, type, montant_cotisation, frequence_cotisation, jour_cotisation,
                             frequence_tirage, nombre_membres, description, createur)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [nom, type, montant, frequence, jour, tirage, nbMembres, description, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

/* CJS:
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
... module.exports = router;
*/
