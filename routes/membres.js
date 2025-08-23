import express from 'express';
import pool from '../db.js';

const router = express.Router();

// 🔹 Ajouter un membre à une tontine
router.post('/', async (req, res) => {
  const { tontineId, nom } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO membres (tontine_id, nom) VALUES ($1, $2) RETURNING *`,
      [tontineId, nom]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Récupérer les membres d’une tontine
router.get('/:tontineId', async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM membres WHERE tontine_id = $1',
      [tontineId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
