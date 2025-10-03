import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET mon profil
------------------------ */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nom_complet, cree_le FROM utilisateurs WHERE id=$1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Profil introuvable" });
    }
    res.json(rows[0]);
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
      "UPDATE utilisateurs SET nom_complet=$1 WHERE id=$2 RETURNING id, nom_complet, cree_le",
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
------------------------ */
router.post("/upgrade", requireAuth, async (req, res) => {
  const { plan } = req.body; // "Premium" ou "Free"
  if (!plan || !["Free", "Premium"].includes(plan)) {
    return res.status(400).json({ error: "Plan invalide" });
  }

  try {
    // Exemple : abonnement premium valable 30 jours
    let expiration = null;
    if (plan === "Premium") {
      expiration = new Date();
      expiration.setDate(expiration.getDate() + 30);
    }

    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET plan=$1, payment_status=$2, expiration=$3
       WHERE id=$4
       RETURNING id, email, plan, payment_status, expiration`,
      [
        plan,
        plan === "Premium" ? "effectue" : "en_attente",
        expiration,
        req.user.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    res.json({
      message: `✅ Votre compte est maintenant en ${plan}`,
      utilisateur: rows[0]
    });
  } catch (err) {
    console.error("Erreur upgrade abonnement:", err.message);
    res.status(500).json({ error: err.message });
  }
});


export default router;
