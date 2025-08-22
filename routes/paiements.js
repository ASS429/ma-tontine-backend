import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// List payments for a tontine
router.get("/:tontineId", async (req, res) => {
  const r = await query(
    `select p.*, m.nom as membre_nom, m.prenom as membre_prenom
     from paiements p
     join membres m on m.id = p.membre_id
     join tontines t on t.id = p.tontine_id
     where p.tontine_id = $1 and t.user_id = $2
     order by p.created_at desc`,
    [req.params.tontineId, req.user.id]
  );
  res.json(r.rows);
});

// Add payment
router.post("/", async (req, res) => {
  const { tontine_id, membre_id, montant, periode } = req.body;
  // Verify ownership
  const t = await query(`select id from tontines where id = $1 and user_id = $2`, [tontine_id, req.user.id]);
  if (t.rowCount === 0) return res.status(404).json({ error: "Tontine not found" });

  try {
    const r = await query(
      `insert into paiements (tontine_id, membre_id, montant, periode) values ($1, $2, $3, $4) returning *`,
      [tontine_id, membre_id, montant, periode]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    // unique(tontine_id, membre_id, periode) -> already paid
    if (e.message && e.message.includes("duplicate key"))
      return res.status(409).json({ error: "Paiement déjà enregistré pour cette période" });
    console.error(e);
    res.status(500).json({ error: "Payment failed" });
  }
});

export default router;
