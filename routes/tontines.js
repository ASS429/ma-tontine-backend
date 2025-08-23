import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// 📌 Liste des tontines de l’utilisateur
router.get("/", async (req, res) => {
  try {
    const r = await query(
      `SELECT * FROM tontines 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET /tontines:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Créer une nouvelle tontine
router.post("/", async (req, res) => {
  try {
    const { nom, type, montant, membres_max, statut } = req.body;

    if (!nom || !type || !montant) {
      return res.status(400).json({ error: "Nom, type et montant requis" });
    }

    const r = await query(
      `INSERT INTO tontines (user_id, nom, type, montant, membres_max, statut) 
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'active')) 
       RETURNING *`,
      [req.user.id, nom, type, montant, membres_max, statut]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("Erreur POST /tontines:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Récupérer une tontine précise
router.get("/:id", async (req, res) => {
  try {
    const r = await query(
      `SELECT * FROM tontines WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Tontine non trouvée" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("Erreur GET /tontines/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Modifier une tontine
router.put("/:id", async (req, res) => {
  try {
    const { nom, type, montant, membres_max, statut } = req.body;
    const r = await query(
      `UPDATE tontines 
       SET nom = COALESCE($1, nom), 
           type = COALESCE($2, type), 
           montant = COALESCE($3, montant),
           membres_max = COALESCE($4, membres_max), 
           statut = COALESCE($5, statut)
       WHERE id = $6 AND user_id = $7 
       RETURNING *`,
      [nom, type, montant, membres_max, statut, req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Tontine non trouvée" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("Erreur PUT /tontines/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Supprimer une tontine
router.delete("/:id", async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM tontines WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Tontine non trouvée" });
    res.status(204).end();
  } catch (err) {
    console.error("Erreur DELETE /tontines/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
