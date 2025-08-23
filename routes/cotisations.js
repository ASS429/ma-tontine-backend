import express from 'express';
import pool from '../db.js';

const router = express.Router();

// 🔹 Enregistrer une cotisation
router.post('/', async (req, res) => {
  const { tontineId, membreId, montant, date } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cotisations (tontine_id, membre_id, montant, date_cotisation)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tontineId, membreId, montant, date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Récupérer toutes les cotisations d’une tontine
router.get('/:tontineId', async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      `SELECT c.id, c.montant, c.date_cotisation, m.nom AS membre
       FROM cotisations c
       JOIN membres m ON c.membre_id = m.id
       WHERE c.tontine_id = $1
       ORDER BY c.date_cotisation DESC`,
      [tontineId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
