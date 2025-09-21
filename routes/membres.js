import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET membres d’une tontine
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

    // Récupérer les membres
    const { rows } = await pool.query(
      "SELECT * FROM membres WHERE tontine_id=$1 ORDER BY cree_le ASC",
      [tontineId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur fetch membres:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST ajouter un membre
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, nom, telephone, adresse } = req.body;

  if (!tontineId || !nom) {
    return res.status(400).json({ error: "Champs manquants (tontineId, nom)" });
  }

  try {
    const { rows: tontine } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const { rows } = await pool.query(
      `INSERT INTO membres (tontine_id, nom, telephone, adresse) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [tontineId, nom, telephone || null, adresse || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur ajout membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 DELETE supprimer un membre
------------------------ */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier que le membre appartient bien à une tontine de l'utilisateur connecté
    const { rows: membre } = await pool.query(
      `SELECT m.id, m.tontine_id
       FROM membres m
       JOIN tontines t ON t.id = m.tontine_id
       WHERE m.id=$1 AND t.createur=$2`,
      [id, req.user.id]
    );

    if (membre.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // Supprimer le membre (⚠️ cascade = supprime cotisations et tirages liés)
    await pool.query("DELETE FROM membres WHERE id=$1", [id]);

    res.json({ success: true, message: "Membre supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 PUT modifier un membre
------------------------ */
router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse } = req.body;

  if (!nom) {
    return res.status(400).json({ error: "Le nom est obligatoire" });
  }

  try {
    // Vérifier droits
    const { rows: membre } = await pool.query(
      `SELECT m.id
       FROM membres m
       JOIN tontines t ON t.id = m.tontine_id
       WHERE m.id=$1 AND t.createur=$2`,
      [id, req.user.id]
    );

    if (membre.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // Mise à jour (⚠️ on garde cree_le intact)
    const { rows } = await pool.query(
      `UPDATE membres 
       SET nom=$1, telephone=$2, adresse=$3, modifie_le=NOW()
       WHERE id=$4 
       RETURNING *`,
      [nom, telephone || null, adresse || null, id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur modification membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});


export default router;
