import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* =========================================================
   🔹 GET /api/admin/parametres → Récupérer les paramètres
========================================================= */
router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé" });

    const { rows } = await pool.query(
      "SELECT * FROM parametres_admin ORDER BY maj_le DESC LIMIT 1;"
    );

    res.json(rows[0] || {});
  } catch (err) {
    console.error("Erreur GET /parametres:", err.message);
    res.status(500).json({ error: "Impossible de charger les paramètres" });
  }
});

/* =========================================================
   🔹 POST /api/admin/parametres → Mettre à jour les paramètres
========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès réservé" });

    const p = req.body;

    const query = `
      INSERT INTO parametres_admin (
        nom_app, email_contact, fuseau_horaire,
        prix_plan_premium, delai_grace, alertes_automatiques,
        notif_nouveaux_abonnements, notif_paiements_retard, notif_rapports_mensuels,
        sessions_multiples, deux_fa, admin_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (admin_id)
      DO UPDATE SET
        nom_app = EXCLUDED.nom_app,
        email_contact = EXCLUDED.email_contact,
        fuseau_horaire = EXCLUDED.fuseau_horaire,
        prix_plan_premium = EXCLUDED.prix_plan_premium,
        delai_grace = EXCLUDED.delai_grace,
        alertes_automatiques = EXCLUDED.alertes_automatiques,
        notif_nouveaux_abonnements = EXCLUDED.notif_nouveaux_abonnements,
        notif_paiements_retard = EXCLUDED.notif_paiements_retard,
        notif_rapports_mensuels = EXCLUDED.notif_rapports_mensuels,
        sessions_multiples = EXCLUDED.sessions_multiples,
        deux_fa = EXCLUDED.deux_fa,
        maj_le = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [
      p.nom_app,
      p.email_contact,
      p.fuseau_horaire,
      p.prix_plan_premium,
      p.delai_grace,
      p.alertes_automatiques,
      p.notif_nouveaux_abonnements,
      p.notif_paiements_retard,
      p.notif_rapports_mensuels,
      p.sessions_multiples,
      p.deux_fa,
      req.user.id
    ]);

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur POST /parametres:", err.message);
    res.status(500).json({ error: "Impossible de sauvegarder les paramètres" });
  }
});

export default router;
