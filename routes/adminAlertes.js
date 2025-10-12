import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   🔔 GET /api/admin/alertes
   → Récupérer toutes les alertes en attente
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    // Vérification du rôle
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const query = `
      SELECT 
        a.id, 
        a.type, 
        a.message, 
        a.statut, 
        a.cree_le, 
        u.nom_complet AS utilisateur_nom
      FROM alertes_admin a
      LEFT JOIN utilisateurs u ON a.utilisateur_id = u.id
      WHERE a.statut = 'en_attente'
      ORDER BY a.cree_le DESC
      LIMIT 50;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur GET /admin/alertes:", err.message);
    res.status(500).json({ error: "Impossible de charger les alertes" });
  }
});

/* =========================================================
   🟢 POST /api/admin/alertes
   → Créer une alerte (manuelle ou automatique)
========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const { type, message, utilisateur_id } = req.body;

    // Vérification du type valide
    const typesValides = [
      'paiement_en_retard', 'paiement_effectue', 'solde_compte_faible', 'revenu_enregistre', 'transaction_refusee', 'remboursement_effectue',
      'nouvel_utilisateur', 'abonnement_premium_demande', 'abonnement_premium_valide', 'abonnement_expire', 'utilisateur_suspendu', 'utilisateur_reactive',
      'nouvelle_tontine', 'tontine_cloturee', 'retard_cotisation', 'tirage_effectue', 'cycle_termine', 'cycle_retard',
      'erreur_serveur', 'operation_suspecte', 'sauvegarde_effectuee', 'maj_systeme', 'erreur_api',
      'rapport_disponible', 'validation_requise', 'compte_admin_cree', 'compte_admin_modifie', 'operation_manquante'
    ];

    if (!typesValides.includes(type)) {
      return res.status(400).json({ error: "Type d’alerte invalide" });
    }

    // Message par défaut si non fourni
    const msg = message || `Nouvelle alerte de type ${type}`;

    const { rows } = await pool.query(
      `INSERT INTO alertes_admin (type, message, utilisateur_id)
       VALUES ($1, $2, $3)
       RETURNING *;`,
      [type, msg, utilisateur_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erreur POST /admin/alertes:", err.message);
    res.status(500).json({ error: "Impossible de créer l’alerte" });
  }
});


/* =========================================================
   ✏️ PATCH /api/admin/alertes/:id
   → Mettre à jour le statut d’une alerte
========================================================= */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const { id } = req.params;
    const { statut } = req.body;

    if (!["resolue", "ignoree"].includes(statut)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    await pool.query(
      `UPDATE alertes_admin
       SET statut = $1, resolu_le = NOW()
       WHERE id = $2;`,
      [statut, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur PATCH /admin/alertes:", err.message);
    res.status(500).json({ error: "Impossible de modifier l’alerte" });
  }
});

/* =========================================================
   🗑️ DELETE /api/admin/alertes/:id
   → Supprimer définitivement une alerte
========================================================= */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const { id } = req.params;
    await pool.query("DELETE FROM alertes_admin WHERE id = $1;", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur DELETE /admin/alertes:", err.message);
    res.status(500).json({ error: "Impossible de supprimer l’alerte" });
  }
});

export default router;
