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
      `SELECT id, nom_complet, email, role, plan, status, payment_status, expiration, cree_le
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
  `SELECT id, nom_complet, email, role, plan, status, payment_status, payment_method, expiration, phone, cree_le
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
    if (req.user.role !== "admin") 
      return res.status(403).json({ error: "Accès réservé aux admins" });

    // Vérifier si l’utilisateur existe
    const { rows } = await pool.query(`SELECT id, email FROM utilisateurs WHERE id=$1`, [req.params.id]);
    if (rows.length === 0) 
      return res.status(404).json({ error: "Utilisateur introuvable" });

    // Supprimer → la cascade s’occupe des tontines, membres, etc.
    await pool.query(`DELETE FROM utilisateurs WHERE id=$1`, [req.params.id]);

    res.json({ message: `🗑️ Utilisateur ${rows[0].email} supprimé avec succès (et toutes ses données liées)` });
  } catch (err) {
    console.error("Erreur suppression utilisateur:", err.message);
    res.status(500).json({ error: "Impossible de supprimer cet utilisateur" });
  }
});

/* -----------------------
   📌 PUT valider un abonné Premium
------------------------ */
router.put("/:id/approve", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux admins" });
    }

    // 1️⃣ Récupérer l’utilisateur à valider
    const { rows: userRows } = await pool.query(
      `SELECT id, email, nom_complet, plan, payment_method 
       FROM utilisateurs 
       WHERE id=$1`,
      [req.params.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = userRows[0];
    const montant = 29.99;

    // 2️⃣ Mettre à jour son statut d’abonnement
    const { rows: updatedUser } = await pool.query(
      `UPDATE utilisateurs 
       SET payment_status='effectue',
           plan='Premium',
           expiration=NOW() + INTERVAL '30 days'
       WHERE id=$1
       RETURNING id, nom_complet, email, plan, payment_status, expiration, payment_method`,
      [req.params.id]
    );

    // 3️⃣ Enregistrer un revenu utilisateur (revenus)
    await pool.query(
      `INSERT INTO revenus (source, montant, methode, statut, description, utilisateur_id)
       VALUES ($1, $2, $3, 'effectue', $4, $5)`,
      [
        "Abonnement Premium",
        montant,
        user.payment_method || "autre",
        "Paiement Premium validé par administrateur",
        user.id
      ]
    );

    // 4️⃣ Créer ou mettre à jour le compte utilisateur (table comptes)
    const { rows: compteRows } = await pool.query(
      `SELECT id FROM comptes WHERE utilisateur_id=$1 AND type=$2`,
      [user.id, user.payment_method || "autre"]
    );

    if (compteRows.length === 0) {
      await pool.query(
        `INSERT INTO comptes (utilisateur_id, type, solde)
         VALUES ($1, $2, 0)`,
        [user.id, user.payment_method || "autre"]
      );
    }

    // 5️⃣ Créditer le compte admin global (comptes_admin)
    const { rows: adminRows } = await pool.query(
      `SELECT id FROM utilisateurs WHERE role='admin' LIMIT 1`
    );

    if (adminRows.length > 0) {
      const adminId = adminRows[0].id;

      // Vérifie si le compte admin existe
      const { rows: compteAdminRows } = await pool.query(
        `SELECT id FROM comptes_admin WHERE admin_id=$1 AND type=$2`,
        [adminId, user.payment_method || "wave"]
      );

      if (compteAdminRows.length === 0) {
        await pool.query(
          `INSERT INTO comptes_admin (admin_id, type, solde)
           VALUES ($1, $2, $3)`,
          [adminId, user.payment_method || "wave", montant]
        );
      } else {
        await pool.query(
          `UPDATE comptes_admin
           SET solde = solde + $1
           WHERE id=$2`,
          [montant, compteAdminRows[0].id]
        );
      }

      // Enregistrer aussi dans revenus_admin
      await pool.query(
        `INSERT INTO revenus_admin (source, montant, methode, statut, description, admin_id)
         VALUES ($1, $2, $3, 'effectue', $4, $5)`,
        [
          "Abonnement Premium",
          montant,
          user.payment_method || "autre",
          `Abonnement validé pour ${user.email}`,
          adminId
        ]
      );
    }

    res.json({
      message: "✅ Abonnement Premium validé, comptes mis à jour (utilisateur + admin)",
      utilisateur: updatedUser[0]
    });
  } catch (err) {
    console.error("Erreur approve Premium:", err.message);
    res.status(500).json({ error: "Impossible de valider l’abonnement" });
  }
});

/* -----------------------
   📌 PUT rejeter une demande Premium
------------------------ */
router.put("/:id/reject", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux admins" });
    }

    // 1. Récupérer l’utilisateur
    const { rows: userRows } = await pool.query(
      `SELECT id, email, nom_complet, plan, payment_status 
       FROM utilisateurs 
       WHERE id=$1`,
      [req.params.id]
    );

    if (userRows.length === 0)
      return res.status(404).json({ error: "Utilisateur introuvable" });

    const user = userRows[0];

    // 2. Supprimer un éventuel revenu lié à un abonnement Premium
    await pool.query(
      `DELETE FROM revenus
       WHERE utilisateur_id=$1 AND source='Abonnement Premium'`,
      [user.id]
    );

    // 3. Repasser en Free avec statut rejeté
    const { rows: updatedUser } = await pool.query(
      `UPDATE utilisateurs 
       SET plan='Free', 
           payment_status='rejete', 
           expiration=NULL
       WHERE id=$1
       RETURNING id, nom_complet, email, plan, payment_status, expiration`,
      [user.id]
    );

    res.json({
      message: "❌ Demande rejetée, revenu annulé si existant",
      utilisateur: updatedUser[0]
    });
  } catch (err) {
    console.error("Erreur reject Premium:", err.message);
    res.status(500).json({ error: "Impossible de rejeter l’abonnement" });
  }
});

/* -----------------------
   📌 POST envoyer un rappel à un utilisateur
   (admin uniquement)
------------------------ */
router.post("/:id/reminder", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { id } = req.params;

    // Vérifier si l'utilisateur existe
    const { rows } = await pool.query(
      "SELECT id, nom_complet, email FROM utilisateurs WHERE id=$1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = rows[0];

    // 👉 Ici, tu peux envoyer un vrai email ou SMS
    // Exemple minimal : juste un log
    console.log(`📩 Rappel envoyé à ${user.email} (${user.nom_complet})`);

    res.json({ message: `Rappel envoyé à ${user.nom_complet} (${user.email})` });
  } catch (err) {
    console.error("Erreur envoi rappel:", err.message);
    res.status(500).json({ error: "Impossible d’envoyer le rappel" });
  }
});

/* -----------------------
   📌 POST ajouter un nouvel utilisateur (admin uniquement)
------------------------ */
import supabaseAdmin from "../supabaseAdmin.js"; // ⬅️ assure-toi d’avoir bien ce fichier

router.post("/", requireAuth, async (req, res) => {
  try {
    // ✅ Vérifie si c’est bien un admin connecté
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { nom_complet, email, phone, plan, payment_method } = req.body;

    if (!nom_complet || !email || !phone) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }
      console.log("🔍 Test Supabase URL:", process.env.SUPABASE_URL);
console.log("🔍 Test clé:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK ✅" : "❌ Manquante");

    // ✅ 1. Créer un utilisateur dans Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "123456", // mot de passe par défaut (tu pourras le rendre aléatoire ensuite)
      email_confirm: true,
      user_metadata: { full_name: nom_complet }
    });

    if (error) {
      console.error("Erreur création Auth:", error.message);
      return res.status(400).json({ error: "Impossible de créer le compte Supabase Auth" });
    }

    const authUser = data.user;

    // ✅ 2. Déterminer le statut de paiement
    const payment_status = plan === "Premium" ? "effectue" : "none";

    // ✅ 3. Mettre à jour la table utilisateurs (le trigger a déjà créé une ligne)
    await pool.query(
      `UPDATE utilisateurs
       SET phone=$1, plan=$2, payment_method=$3, role='user', status='Actif', payment_status=$4
       WHERE id=$5`,
      [phone, plan, payment_method, payment_status, authUser.id]
    );

    // ✅ 4. Retourner la réponse finale
    res.status(201).json({
      message: "✅ Abonné créé avec succès (compte actif)",
      utilisateur: {
        id: authUser.id,
        email,
        nom_complet,
        phone,
        plan,
        payment_method,
        payment_status,
      },
    });

    console.log(`👤 Nouvel abonné créé : ${email} (${plan})`);
  } catch (err) {
    console.error("Erreur ajout abonné:", err.message);
    res.status(500).json({ error: "Impossible d’ajouter l’abonné" });
  }
});


export default router;
