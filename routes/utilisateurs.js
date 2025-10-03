import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET mon profil complet
------------------------ */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nom_complet, email, role, plan, payment_status, expiration, cree_le
       FROM utilisateurs
       WHERE id=$1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Profil introuvable" });
    }

    res.json(rows[0]); // ✅ renvoie toutes les infos
  } catch (err) {
    console.error("Erreur profil:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT mettre à jour mon profil
------------------------ */
router.put("/me", requireAuth, async (req, res) => {
  const { nom_complet } = req.body;
  if (!nom_complet) return res.status(400).json({ error: "nom_complet obligatoire" });

  try {
    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET nom_complet=$1 
       WHERE id=$2 
       RETURNING id, nom_complet, email, role, plan, payment_status, expiration, cree_le`,
      [nom_complet, req.user.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur maj profil:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 DELETE supprimer mon profil
------------------------ */
router.delete("/me", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM utilisateurs WHERE id=$1", [req.user.id]);
    res.json({ message: "Profil supprimé ✅" });
  } catch (err) {
    console.error("Erreur suppression profil:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 POST upgrade abonnement (Free → Premium)
   → L’utilisateur fait une demande, statut "en_attente"
------------------------ */
router.post("/upgrade", requireAuth, async (req, res) => {
  const { plan, phone, payment_method } = req.body;

  if (!plan || plan !== "Premium") {
    return res.status(400).json({ error: "Plan invalide (seul Premium est accepté)" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET plan='Premium',
           payment_status='en_attente',
           expiration=NULL,
           phone=$1,
           payment_method=$2
       WHERE id=$3
       RETURNING id, email, role, plan, payment_status, expiration, cree_le`,
      [phone || null, payment_method || null, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({
      message: "✅ Demande d’upgrade envoyée. Contactez un administrateur pour valider.",
      utilisateur: rows[0]
    });
  } catch (err) {
    console.error("Erreur upgrade abonnement:", err.message);
    res.status(500).json({ error: "Impossible de passer en Premium" });
  }
});


export default router;
