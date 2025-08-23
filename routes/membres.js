import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// 📌 Lister les membres d’une tontine
router.get("/:tontineId", async (req, res) => {
  try {
    const r = await query(
      `SELECT m.* 
       FROM membres m 
       JOIN tontines t ON t.id = m.tontine_id 
       WHERE m.tontine_id = $1 AND t.user_id = $2 
       ORDER BY m.created_at DESC`,
      [req.params.tontineId, req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET /membres/:tontineId:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Ajouter un membre
router.post("/:tontineId", async (req, res) => {
  try {
    const { nom, prenom = null, identifiant = null } = req.body;

    if (!nom || nom.trim() === "") {
      return res.status(400).json({ error: "Nom requis" });
    }

    // Vérifier que la tontine appartient bien à l’utilisateur
    const t = await query(
      `SELECT id FROM tontines WHERE id = $1 AND user_id = $2`,
      [req.params.tontineId, req.user.id]
    );
    if (t.rowCount === 0) return res.status(404).json({ error: "Tontine non trouvée" });

    const r = await query(
      `INSERT INTO membres (tontine_id, nom, prenom, identifiant) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [req.params.tontineId, nom.trim(), prenom, identifiant]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("Erreur POST /membres/:tontineId:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Modifier un membre
router.put("/:id", async (req, res) => {
  try {
    const { nom, prenom, identifiant } = req.body;
    const r = await query(
      `UPDATE membres m 
       SET nom = COALESCE($1, nom), 
           prenom = COALESCE($2, prenom), 
           identifiant = COALESCE($3, identifiant)
       FROM tontines t 
       WHERE m.id = $4 AND t.id = m.tontine_id AND t.user_id = $5
       RETURNING m.*`,
      [nom, prenom, identifiant, req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Membre non trouvé" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("Erreur PUT /membres/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Supprimer un membre
router.delete("/:id", async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM membres m 
       USING tontines t 
       WHERE m.id = $1 AND t.id = m.tontine_id AND t.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Membre non trouvé" });
    res.status(204).end();
  } catch (err) {
    console.error("Erreur DELETE /membres/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
