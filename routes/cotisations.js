// routes/cotisations.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET cotisations d’une tontine
------------------------ */
router.get("/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l'utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const { rows } = await pool.query(
      `SELECT c.*, m.nom AS membre, cy.numero AS cycle_numero
       FROM cotisations c
       JOIN membres m ON m.id = c.membre_id
       LEFT JOIN cycles cy ON cy.id = c.cycle_id
       WHERE c.tontine_id=$1
       ORDER BY c.date_cotisation DESC`,
      [tontineId]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur fetch cotisations:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 GET statut cotisations (tous les membres ont-ils payé ?)
------------------------ */
router.get("/statut/:tontineId", requireAuth, async (req, res) => {
  const { tontineId } = req.params;

  try {
    // Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontine } = await pool.query(
      `SELECT id, nombre_membres 
       FROM tontines 
       WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }
    const nbMembres = tontine[0].nombre_membres;

    // 🔹 Récupérer le cycle actif
    let cycle = await pool.query(
      `SELECT * FROM cycles 
       WHERE tontine_id=$1 AND cloture=false
       ORDER BY numero DESC LIMIT 1`,
      [tontineId]
    );

    if (cycle.rowCount === 0) {
      return res.json({ pret: false, message: "Aucun cycle actif" });
    }
    const cycleActif = cycle.rows[0];

    // 🔹 Compter combien de membres ont cotisé dans ce cycle
    const { rows: cotises } = await pool.query(
      `SELECT COUNT(DISTINCT membre_id)::int AS nb_cotisants
       FROM cotisations
       WHERE tontine_id=$1 AND cycle_id=$2`,
      [tontineId, cycleActif.id]
    );

    const nbCotisants = cotises[0].nb_cotisants;
    const pret = nbCotisants === nbMembres;

    res.json({
      pret,
      cycle: cycleActif.numero,
      nbCotisants,
      nbMembres,
      message: pret
        ? "✅ Tous les membres ont cotisé, tirage possible"
        : `⚠️ ${nbMembres - nbCotisants} membre(s) n'ont pas encore cotisé`
    });
  } catch (err) {
    console.error("❌ Erreur GET statut cotisations:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST ajouter une cotisation
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, membreId, dateCotisation } = req.body;

  if (!tontineId || !membreId) {
    return res.status(400).json({ error: "Champs manquants (tontineId, membreId)" });
  }

  try {
    // Vérifier que la tontine appartient à l'utilisateur
    const { rows: tontine } = await pool.query(
      `SELECT id, montant_cotisation 
       FROM tontines 
       WHERE id=$1 AND createur=$2`,
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }
    const montant = tontine[0].montant_cotisation;

    // 🔹 Récupérer (ou créer) le cycle actif
    let cycle = await pool.query(
      `SELECT * FROM cycles 
       WHERE tontine_id=$1 AND cloture=false
       ORDER BY numero DESC LIMIT 1`,
      [tontineId]
    );

    if (cycle.rowCount === 0) {
      const r = await pool.query(
        `INSERT INTO cycles (tontine_id, numero) 
         VALUES ($1, 1) RETURNING *`,
        [tontineId]
      );
      cycle = r;
    }
    const cycleActif = cycle.rows[0];

    // 🔹 Insérer la cotisation
    const { rows } = await pool.query(
      `INSERT INTO cotisations (tontine_id, membre_id, montant, date_cotisation, cycle_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        tontineId,
        membreId,
        montant,
        dateCotisation || new Date().toISOString().split("T")[0],
        cycleActif.id
      ]
    );

    res.status(201).json({
      ...rows[0],
      cycle_numero: cycleActif.numero
    });

  } catch (err) {
    console.error("❌ Erreur ajout cotisation:", err.message);

    if (err.code === "23505") {
      return res.status(400).json({
        error: "Ce membre a déjà cotisé pour ce cycle"
      });
    }

    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
