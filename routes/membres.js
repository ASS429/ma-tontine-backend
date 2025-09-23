import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";

const router = express.Router();

/* -----------------------
   📌 GET membres d’une tontine (liste simple)
   ➝ Utilisé pour "Enregistrer un paiement"
------------------------ */
router.get("/tontine/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontines } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [id, req.user.id]
    );
    if (tontines.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // Retourner uniquement la liste des membres
    const { rows: membres } = await pool.query(
      `SELECT id, nom, telephone, adresse, cree_le
       FROM membres
       WHERE tontine_id=$1
       ORDER BY cree_le ASC`,
      [id]
    );

    res.json(membres);
  } catch (err) {
    console.error("❌ Erreur GET /membres/tontine/:id:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 GET détail complet d’une tontine
   (infos + membres + cotisations)
------------------------ */
router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Vérifier que la tontine appartient à l’utilisateur
    const { rows: tontines } = await pool.query(
      "SELECT * FROM tontines WHERE id=$1 AND createur=$2",
      [id, req.user.id]
    );
    if (tontines.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }
    const tontine = tontines[0];

    // 2️⃣ Charger membres + cotisations
    const { rows } = await pool.query(
      `SELECT m.id AS membre_id, m.nom, m.telephone, m.adresse, m.cree_le,
              c.id AS cotisation_id, c.montant, c.date_cotisation
       FROM membres m
       LEFT JOIN cotisations c ON c.membre_id = m.id
       WHERE m.tontine_id=$1
       ORDER BY m.cree_le ASC, c.date_cotisation ASC`,
      [id]
    );

    // 3️⃣ Normaliser côté backend
    const membresMap = {};
    for (const r of rows) {
      if (!membresMap[r.membre_id]) {
        membresMap[r.membre_id] = {
          id: r.membre_id,
          nom: r.nom,
          telephone: r.telephone,
          adresse: r.adresse,
          dateAjout: r.cree_le,
          cotisationsPayees: []
        };
      }
      if (r.cotisation_id) {
        membresMap[r.membre_id].cotisationsPayees.push({
          id: r.cotisation_id,
          montant: Number(r.montant),
          date: r.date_cotisation
        });
      }
    }

    // 4️⃣ Ajouter les membres normalisés dans l’objet tontine
    tontine.membres = Object.values(membresMap);

    res.json(tontine);
  } catch (err) {
    console.error("❌ Erreur GET /membres/:id:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 POST ajouter un membre
------------------------ */
router.post("/", requireAuth, async (req, res) => {
  const { tontineId, nom, telephone, adresse } = req.body;

  if (!tontineId || !nom || !telephone || !adresse) {
    return res.status(400).json({ error: "Champs manquants (tontineId, nom, téléphone, adresse)" });
  }

  try {
    // Vérifier que la tontine existe et appartient à l'utilisateur
    const { rows: tontine } = await pool.query(
      "SELECT id FROM tontines WHERE id=$1 AND createur=$2",
      [tontineId, req.user.id]
    );
    if (tontine.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    // Insertion du membre
    const { rows } = await pool.query(
      `INSERT INTO membres (tontine_id, nom, telephone, adresse, cree_le) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, nom, telephone, adresse, cree_le`,
      [tontineId, nom, telephone, adresse]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Erreur ajout membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 DELETE supprimer un membre
------------------------ */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: membre } = await pool.query(
      `SELECT m.id, m.tontine_id
       FROM membres m
       JOIN tontines t ON t.id = m.tontine_id
       WHERE m.id=$1 AND t.createur=$2`,
      [id, req.user.id]
    );

    if (membre.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    await pool.query("DELETE FROM membres WHERE id=$1", [id]);

    res.json({ success: true, message: "Membre supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

/* -----------------------
   📌 PUT modifier un membre
------------------------ */
router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse } = req.body;

  if (!nom) {
    return res.status(400).json({ error: "Le nom est obligatoire" });
  }

  try {
    const { rows: membre } = await pool.query(
      `SELECT m.id
       FROM membres m
       JOIN tontines t ON t.id = m.tontine_id
       WHERE m.id=$1 AND t.createur=$2`,
      [id, req.user.id]
    );

    if (membre.length === 0) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const { rows } = await pool.query(
      `UPDATE membres 
       SET nom=$1, telephone=$2, adresse=$3, modifie_le=NOW()
       WHERE id=$4 
       RETURNING *`,
      [nom, telephone || null, adresse || null, id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Erreur modification membre:", err.message);
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

export default router;
