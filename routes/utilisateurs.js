import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";
import { createAdminAlert } from "../utils/alertes.js";
import { getSetting } from "../utils/settings.js";
import { checkGracePeriod } from "../utils/checkGracePeriod.js";
import { checkLatePayments } from "../utils/payments.js";
import { getRecentLogs } from "../utils/logger.js";
import { generateMonthlyReport } from "../utils/reports.js";

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
------------------------ */
router.post("/upgrade", requireAuth, async (req, res) => {
  const { plan, phone, payment_method, montant } = req.body;

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
    // avant l'insertion dans revenus
const montant = await getSetting("prix_plan_premium", 5000);

    // 🔹 Enregistrer une trace du paiement dans "revenus" (en attente)
    if (montant) {
      await pool.query(
        `INSERT INTO revenus (source, montant, methode, statut, description, utilisateur_id)
         VALUES ($1, $2, $3, 'en_attente', $4, $5)`,
        [
          "Demande Abonnement Premium",
          montant,
          payment_method || "autre",
          "En attente de validation admin",
          req.user.id
        ]
      );
       if (await getSetting("alertes_automatiques", true)) {
  await createAdminAlert(
    "abonnement_premium_demande",
    `${req.user.email} a demandé un abonnement Premium.`,
    req.user.id
  );
}
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

/* -----------------------
   📌 GET tous les utilisateurs (admin)
------------------------ */
router.get("/", requireAuth, async (req, res) => {
  try {
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
         await createAdminAlert(
  "utilisateur_suspendu",
  `L’utilisateur ${rows[0].nom_complet} (${rows[0].email}) a été suspendu.`,
  rows[0].id
);
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
     if (await getSetting("alertes_automatiques", true)) {
     await createAdminAlert(
  "utilisateur_reactive",
  `L’utilisateur ${rows[0].nom_complet} (${rows[0].email}) a été réactivé.`,
  rows[0].id
); 
     }

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
      if (await getSetting("alertes_automatiques", true)) {
     await createAdminAlert(
  "operation_manquante",
  `Suppression du compte ${rows[0].email} effectuée par un administrateur.`,
  rows[0].id
);
      }
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
    // 🔒 Vérifie que seul un admin peut valider
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux admins" });
    }

    // 🔹 On récupère le montant envoyé (sinon 5000 par défaut)
    const { montant: montantBody } = req.body;

    // 1️⃣ Récupération de l’utilisateur à valider
    const { rows: userRows } = await pool.query(
      `SELECT id, email, nom_complet, plan, payment_method
       FROM utilisateurs
       WHERE id = $1`,
      [req.params.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const user = userRows[0];
    const montant = montantBody || await getSetting("prix_plan_premium", 5000);
    const methode = user.payment_method || "autre";

    // 2️⃣ Validation de l’abonnement
    const { rows: updatedUser } = await pool.query(
      `UPDATE utilisateurs
       SET payment_status = 'effectue',
           plan = 'Premium',
           expiration = NOW() + INTERVAL '30 days'
       WHERE id = $1
       RETURNING id, nom_complet, email, plan, payment_status, expiration, payment_method`,
      [user.id]
    );
     if (await getSetting("alertes_automatiques", true)) {
      await createAdminAlert(
  "abonnement_premium_valide",
  `${user.nom_complet} (${user.email}) vient d'être validé Premium.`,
  user.id
);
     }
     if (await getSetting("alertes_automatiques", true)) {
await createAdminAlert(
  "revenu_enregistre",
  `Un revenu de ${montant} FCFA a été ajouté au compte admin via ${methode}.`
);
     }

    // 3️⃣ Vérifie s’il y a déjà une ligne de revenus correspondante
    const { rowCount: revenusExist } = await pool.query(
      `SELECT 1 FROM revenus WHERE utilisateur_id = $1 AND source = 'Abonnement Premium'`,
      [user.id]
    );

    if (revenusExist === 0) {
      // 👉 Créer un nouveau revenu si absent
      await pool.query(
        `INSERT INTO revenus (source, montant, methode, statut, description, utilisateur_id)
         VALUES ($1, $2, $3, 'effectue', $4, $5)`,
        [
          "Abonnement Premium",
          montant,
          methode,
          "Paiement Premium validé par administrateur",
          user.id
        ]
      );
    } else {
      // 👉 Sinon mettre à jour le revenu existant
      await pool.query(
        `UPDATE revenus
         SET statut = 'effectue',
             montant = $2,
             methode = $3,
             description = 'Paiement Premium validé par administrateur'
         WHERE utilisateur_id = $1 AND source = 'Abonnement Premium'`,
        [user.id, montant, methode]
      );
    }

    // 4️⃣ Créditer ou créer le compte admin
    const adminId = req.user.id;
    const { rows: compteAdminRows } = await pool.query(
      `SELECT id FROM comptes_admin WHERE admin_id = $1 AND type = $2`,
      [adminId, methode]
    );

    if (compteAdminRows.length === 0) {
      await pool.query(
        `INSERT INTO comptes_admin (admin_id, type, solde)
         VALUES ($1, $2, $3)`,
        [adminId, methode, montant]
      );
    } else {
      await pool.query(
        `UPDATE comptes_admin
         SET solde = solde + $1
         WHERE id = $2`,
        [montant, compteAdminRows[0].id]
      );
    }

    // 5️⃣ Enregistrer le revenu admin
    await pool.query(
      `INSERT INTO revenus_admin (source, montant, methode, statut, description, admin_id)
       VALUES ($1, $2, $3, 'effectue', $4, $5)`,
      [
        "Abonnement Premium",
        montant,
        methode,
        `Abonnement validé pour ${user.email}`,
        adminId
      ]
    );

    // ✅ Réponse finale
    res.json({
      message: "✅ Abonnement Premium validé et comptes mis à jour (utilisateur + admin)",
      utilisateur: updatedUser[0],
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
     if (await getSetting("alertes_automatiques", true)) {
     await createAdminAlert(
  "validation_requise",
  `La demande Premium de ${user.nom_complet} (${user.email}) a été rejetée.`,
  user.id
);
     }
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
/* =========================================================
   📊 GET /utilisateurs/stats → Statistiques globales utilisateurs
========================================================= */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }

    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE plan='Premium') AS premium,
        COUNT(*) FILTER (WHERE plan='Premium' AND expiration > NOW()) AS actifs
      FROM utilisateurs
    `);

    const stats = rows[0];
    const total = Number(stats.total);
    const premium = Number(stats.premium);
    const actifs = Number(stats.actifs);

    const tauxConversion = total > 0 ? (premium / total * 100).toFixed(1) : 0;
    const tauxRetention = premium > 0 ? (actifs / premium * 100).toFixed(1) : 0;

    res.json({
      total_utilisateurs: total,
      premium,
      actifs,
      taux_conversion: Number(tauxConversion),
      taux_retention: Number(tauxRetention)
    });
  } catch (err) {
    console.error("Erreur /utilisateurs/stats:", err.message);
    res.status(500).json({ error: "Impossible de charger les statistiques utilisateurs" });
  }
});
/* =========================================================
   📊 GET /utilisateurs/dashboard → Statistiques du tableau de bord admin
========================================================= */
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
         // 🔎 Vérifie et met à jour les comptes expirés
    if (req.user.role === "admin") {
      await checkGracePeriod();
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    }
     // 🕒 Vérification automatique du délai de grâce
const delaiGrace = await getSetting("delai_grace", 7); // valeur par défaut : 7 jours

// 🔹 Bloquer automatiquement les comptes expirés depuis plus que delaiGrace
await pool.query(`
  UPDATE utilisateurs
  SET status = 'Bloqué'
  WHERE plan = 'Premium'
    AND expiration IS NOT NULL
    AND expiration < NOW() - INTERVAL '${delaiGrace} days'
    AND status != 'Bloqué'
`);
console.log(`⏳ Comptes Premium bloqués selon délai de grâce (${delaiGrace} jours)`);

// 🔔 Créer une alerte automatique
if (await getSetting("alertes_automatiques", true)) {
  await createAdminAlert(
    "utilisateur_suspendu",
    `Des comptes Premium ont été bloqués automatiquement après ${delaiGrace} jours de grâce.`,
    req.user.id
  );
}

   await checkLatePayments(req.user.id);
     await generateMonthlyReport();

    const query = `
      WITH
      total_abonnes AS (
        SELECT COUNT(*) AS total FROM utilisateurs
      ),
      total_abonnes_prec_mois AS (
        SELECT COUNT(*) AS total FROM utilisateurs
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
      ),
      abonnes_actifs AS (
        SELECT COUNT(*) AS total FROM utilisateurs
        WHERE plan='Premium' AND expiration > NOW()
      ),
      abonnes_actifs_prec_mois AS (
        SELECT COUNT(*) AS total FROM utilisateurs
        WHERE plan='Premium' AND expiration BETWEEN 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
          AND DATE_TRUNC('month', CURRENT_DATE)
      ),
      revenus_mensuels AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE)
          AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE)
      ),
      revenus_prec_mois AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
          AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE - INTERVAL '1 month')
      ),
      alertes AS (
        SELECT COUNT(*) AS total FROM alertes_admin WHERE statut='en_attente'
      )
      SELECT 
        (SELECT total FROM total_abonnes) AS total_abonnes,
        (SELECT total FROM total_abonnes_prec_mois) AS total_abonnes_prec_mois,
        (SELECT total FROM abonnes_actifs) AS abonnes_actifs,
        (SELECT total FROM abonnes_actifs_prec_mois) AS abonnes_actifs_prec_mois,
        (SELECT total FROM revenus_mensuels) AS revenus_mensuels,
        (SELECT total FROM revenus_prec_mois) AS revenus_prec_mois,
        (SELECT total FROM alertes) AS alertes_paiement;
    `;

    const { rows } = await pool.query(query);
    const stats = rows[0];

    // Calculs des croissances (%)
    const croissanceAbonnes = stats.total_abonnes_prec_mois > 0
      ? ((stats.total_abonnes - stats.total_abonnes_prec_mois) / stats.total_abonnes_prec_mois * 100).toFixed(1)
      : 100.0;

    const croissanceActifs = stats.abonnes_actifs_prec_mois > 0
      ? ((stats.abonnes_actifs - stats.abonnes_actifs_prec_mois) / stats.abonnes_actifs_prec_mois * 100).toFixed(1)
      : 100.0;

    const croissanceRevenus = stats.revenus_prec_mois > 0
      ? ((stats.revenus_mensuels - stats.revenus_prec_mois) / stats.revenus_prec_mois * 100).toFixed(1)
      : 100.0;

    // 🔹 Récupération des logs récents
const logs = await getRecentLogs(10); // 10 dernières exécutions système

res.json({
  total_abonnes: Number(stats.total_abonnes),
  abonnes_actifs: Number(stats.abonnes_actifs),
  revenus_mensuels: Number(stats.revenus_mensuels),
  croissance_abonnes: Number(croissanceAbonnes),
  croissance_actifs: Number(croissanceActifs),
  croissance_revenus: Number(croissanceRevenus),
  alertes_paiement: Number(stats.alertes_paiement),
  system_logs: logs.map(log => ({
    id: log.id,
    action: log.action,
    details: log.details,
    cree_le: log.cree_le
  }))
});

  } catch (err) {
    console.error("Erreur /utilisateurs/dashboard:", err.message);
    res.status(500).json({ error: "Impossible de charger les stats du tableau de bord" });
  }
});


export default router;
