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

// 📌 GET tous les utilisateurs (réservé admin)
router.get("/", requireAuth, async (req, res) => {
  try {
    // Vérifie si c'est bien un admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { rows } = await pool.query(
      `SELECT id, nom_complet, email, role, plan, payment_status, expiration, phone, cree_le
       FROM utilisateurs
       ORDER BY cree_le DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Erreur liste utilisateurs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT bloquer un utilisateur
------------------------ */
router.put("/:id/block", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux admins" });

    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET status='Bloqué' 
       WHERE id=$1 
       RETURNING id, nom_complet, email, role, plan, status, payment_status`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ message: "🚫 Utilisateur bloqué", utilisateur: rows[0] });
  } catch (err) {
    console.error("Erreur block:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT activer un utilisateur
------------------------ */
router.put("/:id/activate", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux admins" });

    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET status='Actif' 
       WHERE id=$1 
       RETURNING id, nom_complet, email, role, plan, status, payment_status`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ message: "✅ Utilisateur activé", utilisateur: rows[0] });
  } catch (err) {
    console.error("Erreur activate:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 DELETE supprimer un utilisateur
------------------------ */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux admins" });

    const { rowCount } = await pool.query(`DELETE FROM utilisateurs WHERE id=$1`, [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Utilisateur introuvable" });

    res.json({ message: "🗑️ Utilisateur supprimé" });
  } catch (err) {
    console.error("Erreur suppression utilisateur:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT valider un abonné Premium
------------------------ */
router.put("/:id/approve", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux admins" });

    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET payment_status='effectue', expiration=NOW() + INTERVAL '30 days'
       WHERE id=$1 
       RETURNING id, nom_complet, email, plan, payment_status, expiration`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ message: "✅ Abonnement validé", utilisateur: rows[0] });
  } catch (err) {
    console.error("Erreur approve:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------
   📌 PUT rejeter une demande Premium
------------------------ */
router.put("/:id/reject", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux admins" });

    const { rows } = await pool.query(
      `UPDATE utilisateurs 
       SET plan='Free', payment_status='rejete', expiration=NULL
       WHERE id=$1 
       RETURNING id, nom_complet, email, plan, payment_status, expiration`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
    res.json({ message: "❌ Demande rejetée", utilisateur: rows[0] });
  } catch (err) {
    console.error("Erreur reject:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
