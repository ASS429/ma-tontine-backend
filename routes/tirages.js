// routes/tirages.js
import express from "express";
import db from "../db.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// ➤ Créer un tirage pour une tontine
router.post("/:tontineId", verifyToken, async (req, res) => {
  const { tontineId } = req.params;
  const { membre_id } = req.body;

  try {
    // 🔹 Vérifier que la tontine appartient à l'utilisateur connecté
    const tontine = await db.query(
      "SELECT * FROM tontines WHERE id = $1 AND createur = $2",
      [tontineId, req.user.id]
    );

    if (tontine.rows.length === 0) {
      return res.status(403).json({ error: "⛔ Accès refusé à cette tontine" });
    }

    // 🔹 Récupérer le cycle actif
    const cycleRes = await db.query(
      "SELECT * FROM cycles WHERE tontine_id = $1 AND cloture = false ORDER BY numero ASC LIMIT 1",
      [tontineId]
    );

    if (cycleRes.rows.length === 0) {
      return res.status(400).json({ error: "⚠️ Aucun cycle actif trouvé" });
    }

    const cycle = cycleRes.rows[0];

    // 🔹 Vérifier si le membre appartient bien à cette tontine
    const membre = await db.query(
      "SELECT * FROM membres WHERE id = $1 AND tontine_id = $2",
      [membre_id, tontineId]
    );

    if (membre.rows.length === 0) {
      return res.status(400).json({ error: "⚠️ Ce membre n'appartient pas à la tontine" });
    }

    // 🔹 Vérifier que le membre n'a pas déjà été tiré pour ce cycle
    const dejaTire = await db.query(
      "SELECT 1 FROM tirages WHERE membre_id = $1 AND cycle_id = $2",
      [membre_id, cycle.id]
    );

    if (dejaTire.rows.length > 0) {
      return res.status(400).json({ error: "⚠️ Ce membre a déjà été tiré pour ce cycle" });
    }

    // 🔹 Insérer le tirage
    const newTirage = await db.query(
      `INSERT INTO tirages (tontine_id, membre_id, cycle_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tontineId, membre_id, cycle.id]
    );

    res.json(newTirage.rows[0]);
  } catch (err) {
    console.error("❌ Erreur création tirage:", err);
    res.status(500).json({ error: "Erreur serveur lors du tirage" });
  }
});

// ➤ Récupérer l’historique des tirages d’une tontine (avec montant et cycle)
router.get("/:tontineId", verifyToken, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l’utilisateur
    const tontine = await db.query(
      "SELECT * FROM tontines WHERE id = $1 AND createur = $2",
      [tontineId, req.user.id]
    );

    if (tontine.rows.length === 0) {
      return res.status(403).json({ error: "⛔ Accès refusé à cette tontine" });
    }

    // Récupérer tous les tirages de la tontine avec nom + montant + cycle
    const tirages = await db.query(
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

    res.json(tirages.rows);
  } catch (err) {
    console.error("❌ Erreur récupération tirages:", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des tirages" });
  }
});

export default router;
