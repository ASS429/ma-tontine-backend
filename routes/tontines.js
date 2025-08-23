import express from 'express';
import pool from '../db.js';

const router = express.Router();

// 🔹 Récupérer toutes les tontines de l’utilisateur connecté
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId; // récupéré depuis le frontend ou middleware auth
    const { rows } = await pool.query(
      'SELECT * FROM tontines WHERE createur = $1 ORDER BY cree_le DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Créer une nouvelle tontine
router.post('/', async (req, res) => {
  const { nom, type, montant, frequence, jour, tirage, nbMembres, description, createur } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tontines 
        (nom, type, montant_cotisation, frequence_cotisation, jour_cotisation, frequence_tirage, nombre_membres, description, createur) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
       RETURNING *`,
      [nom, type, montant, frequence, jour, tirage, nbMembres, description, createur]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
