// routes/tirages.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 POST Créer un tirage
------------------------ */
router.post("/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;
  const { membre_id } = req.body;

  try {
    // Vérifier que la tontine appartient à l'utilisateur connecté
    const { rows: tontine } = await pool.query(
      "SELECT * FROM tontines WHERE id = $1 AND createur = $2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "⛔ Accès refusé à cette tontine" });
    }

    // Récupérer le cycle actif
    const { rows: cycles } = await pool.query(
      "SELECT * FROM cycles WHERE tontine_id = $1 AND cloture = false ORDER BY numero ASC LIMIT 1",
      [tontineId]
    );
    if (cycles.length === 0) {
      return res.status(400).json({ error: "⚠️ Aucun cycle actif trouvé" });
    }
    const cycle = cycles[0];

    // Vérifier que le membre appartient bien à cette tontine
    const { rows: membres } = await pool.query(
      "SELECT * FROM membres WHERE id = $1 AND tontine_id = $2",
      [membre_id, tontineId]
    );
    if (membres.length === 0) {
      return res.status(400).json({ error: "⚠️ Ce membre n'appartient pas à la tontine" });
    }

    // Vérifier que le membre n'a pas déjà été tiré pour ce cycle
    const { rows: dejaTire } = await pool.query(
      "SELECT 1 FROM tirages WHERE membre_id = $1 AND cycle_id = $2",
      [membre_id, cycle.id]
    );
    if (dejaTire.length > 0) {
      return res.status(400).json({ error: "⚠️ Ce membre a déjà été tiré pour ce cycle" });
    }

    // Insérer le tirage
    const { rows: newTirage } = await pool.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id, date_tirage)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [tontineId, membre_id, cycle.id]
    );

    res.json(newTirage[0]);
  } catch (err) {
    console.error("❌ Erreur création tirage:", err.message);
    res.status(500).json({ error: "Erreur serveur lors du tirage" });
  }
});

/* -----------------------
   📌 GET Historique tirages
------------------------ */
router.get("/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT * FROM tontines WHERE id = $1 AND createur = $2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "⛔ Accès refusé à cette tontine" });
    }

    // Récupérer tous les tirages
    const { rows: tirages } = await pool.query(
      `
      SELECT t.id, t.date_tirage, m.nom AS nom_membre, 
             c.numero AS numero_cycle,
             ton.montant_cotisation * ton.nombre_membres AS montant_gagne
      FROM tirages t
      JOIN membres m ON t.membre_id = m.id
      JOIN cycles c ON t.cycle_id = c.id
      JOIN tontines ton ON t.tontine_id = ton.id
      WHERE t.tontine_id = $1
      ORDER BY c.numero ASC, t.date_tirage ASC
      `,
      [tontineId]
    );

    res.json(tirages);
  } catch (err) {
    console.error("❌ Erreur récupération tirages:", err.message);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des tirages" });
  }
});

export default router;
