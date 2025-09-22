// routes/tirages.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const requireAuth = require("../middleware/auth");

/* -----------------------
   📌 GET historique des tirages d’une tontine
------------------------ */
router.get("/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // Récupérer les tirages avec info du membre + montant gagné
    const { rows } = await pool.query(
      `SELECT t.id, t.date_tirage, t.montant_gagne,
              m.nom AS nom_membre, m.id AS membre_id
       FROM tirages t
       JOIN membres m ON m.id = t.membre_id
       WHERE t.tontine_id=$1
       ORDER BY t.date_tirage ASC`,
      [tontineId]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur fetch tirages:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST effectuer un tirage
------------------------ */
router.post("/run/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine existe et appartient à l’utilisateur
    const { rows: tontineRows } = await pool.query(
      "SELECT * FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontineRows.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }
    const tontine = tontineRows[0];

    // Récupérer le cycle actif
    const { rows: cycleRows } = await pool.query(
      `SELECT * FROM cycles 
       WHERE tontine_id=$1 AND cloture=false
       ORDER BY numero ASC LIMIT 1`,
      [tontineId]
    );
    if (cycleRows.length === 0) {
      return res.status(400).json({ error: "Aucun cycle actif trouvé" });
    }
    const cycleActif = cycleRows[0];

    // Récupérer les membres éligibles (jamais gagnés dans ce cycle)
    const { rows: membresEligibles } = await pool.query(
      `SELECT m.*
       FROM membres m
       WHERE m.tontine_id=$1
         AND NOT EXISTS (
           SELECT 1 FROM tirages t
           WHERE t.membre_id = m.id
             AND t.cycle_id=$2
         )`,
      [tontineId, cycleActif.id]
    );

    if (membresEligibles.length === 0) {
      return res.status(400).json({ error: "Tous les membres ont déjà gagné ce cycle" });
    }

    // Tirage aléatoire
    const gagnant = membresEligibles[Math.floor(Math.random() * membresEligibles.length)];

    // Calcul du montant gagné (fixé par les règles de la tontine)
    const montantGagne = tontine.montant_cotisation * tontine.nombre_membres;

    // Enregistrer le tirage
    const { rows: tirageRows } = await pool.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id, montant_gagne) 
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tontineId, gagnant.id, cycleActif.id, montantGagne]
    );

    res.status(201).json({
      tirage: tirageRows[0],
      gagnant: { id: gagnant.id, nom: gagnant.nom },
    });
  } catch (err) {
    console.error("❌ Erreur tirage:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

module.exports = router;
