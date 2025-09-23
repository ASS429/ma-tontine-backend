// routes/paiements.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();
router.use(requireAuth);

// 📌 GET paiements d’une tontine
router.get("/:tontineId", async (req, res) => {
  try {
    const { tontineId } = req.params;
    const { rows } = await pool.query(
      `SELECT p.*, m.nom as membre_nom
       FROM paiements p
       JOIN membres m ON p.membre_id = m.id
       WHERE p.tontine_id=$1
       ORDER BY date_paiement DESC`,
      [tontineId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur récupération paiements:", err.message);
    res.status(500).json({ error: "Erreur récupération paiements" });
  }
});

// 📌 POST créer un paiement
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { tontine_id, membre_id, type, montant, moyen, statut } = req.body;

    if (!tontine_id || !membre_id || !type || !montant || !moyen) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    // Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontine } = await client.query(
      `SELECT id FROM tontines WHERE id=$1 AND createur=$2`,
      [tontine_id, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    await client.query("BEGIN");

    // 🔹 Insérer le paiement
    const { rows: inserted } = await client.query(
      `INSERT INTO paiements (tontine_id, membre_id, type, montant, moyen, statut)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [tontine_id, membre_id, type, montant, moyen, statut || "en_attente"]
    );

    // 🔹 Si le paiement est déjà "effectué", mettre à jour ou créer le compte
    if ((statut || "en_attente") === "effectue") {
      const { rowCount } = await client.query(
        `UPDATE comptes
         SET solde = solde + CASE WHEN $1='cotisation' THEN $2 ELSE -$2 END
         WHERE utilisateur_id=$3 AND type=$4`,
        [type, montant, req.user.id, moyen]
      );

      // Si aucun compte n’existe → créer automatiquement
      if (rowCount === 0) {
        await client.query(
          `INSERT INTO comptes (utilisateur_id, type, solde)
           VALUES ($1,$2,$3)`,
          [
            req.user.id,
            moyen,
            type === "cotisation" ? montant : -montant
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(inserted[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erreur création paiement:", err.message);
    res.status(500).json({ error: "Erreur création paiement", details: err.message });
  } finally {
    client.release();
  }
});

// 📌 PUT mise à jour paiement
router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { statut } = req.body;

    await client.query("BEGIN");

    // récupérer paiement
    const { rows: existing } = await client.query(
      `SELECT * FROM paiements WHERE id=$1`,
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Paiement introuvable" });
    }
    const paiement = existing[0];

    // update statut
    const { rows } = await client.query(
      `UPDATE paiements
       SET statut=$1
       WHERE id=$2
       RETURNING *`,
      [statut, id]
    );

    // si passage en "effectue"
    if (paiement.statut !== "effectue" && statut === "effectue") {
      const { rowCount } = await client.query(
        `UPDATE comptes
         SET solde = solde + CASE WHEN $1='cotisation' THEN $2 ELSE -$2 END
         WHERE utilisateur_id=$3 AND type=$4`,
        [paiement.type, paiement.montant, req.user.id, paiement.moyen]
      );

      if (rowCount === 0) {
        await client.query(
          `INSERT INTO comptes (utilisateur_id, type, solde)
           VALUES ($1,$2,$3)`,
          [
            req.user.id,
            paiement.moyen,
            paiement.type === "cotisation" ? paiement.montant : -paiement.montant
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erreur update paiement:", err.message);
    res.status(500).json({ error: "Erreur mise à jour paiement", details: err.message });
  } finally {
    client.release();
  }
});

// 📌 DELETE supprimer un paiement
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");

    // Vérifier paiement
    const { rows: existing } = await client.query(
      `SELECT * FROM paiements WHERE id=$1`,
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Paiement introuvable" });
    }
    const paiement = existing[0];

    // Si paiement déjà effectue → réajuster solde
    if (paiement.statut === "effectue") {
      await client.query(
        `UPDATE comptes
         SET solde = solde - CASE WHEN $1='cotisation' THEN $2 ELSE -$2 END
         WHERE utilisateur_id=$3 AND type=$4`,
        [paiement.type, paiement.montant, req.user.id, paiement.moyen]
      );
    }

    await client.query(`DELETE FROM paiements WHERE id=$1`, [id]);

    await client.query("COMMIT");
    res.json({ success: true, message: "Paiement supprimé ✅" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erreur suppression paiement:", err.message);
    res.status(500).json({ error: "Erreur suppression paiement", details: err.message });
  } finally {
    client.release();
  }
});

export default router;
