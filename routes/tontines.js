import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// List user tontines
router.get("/", async (req, res) => {
  const r = await query(`select * from tontines where user_id = $1 order by created_at desc`, [req.user.id]);
  res.json(r.rows);
});

// Create tontine
router.post("/", async (req, res) => {
  const { nom, type, montant, membres_max, statut } = req.body;
  const r = await query(
    `insert into tontines (user_id, nom, type, montant, membres_max, statut) 
     values ($1, $2, $3, $4, $5, coalesce($6, 'active')) returning *`,
    [req.user.id, nom, type, montant, membres_max, statut]
  );
  res.status(201).json(r.rows[0]);
});

// Read one
router.get("/:id", async (req, res) => {
  const r = await query(`select * from tontines where id = $1 and user_id = $2`, [req.params.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.json(r.rows[0]);
});

// Update
router.put("/:id", async (req, res) => {
  const { nom, type, montant, membres_max, statut } = req.body;
  const r = await query(
    `update tontines set nom = coalesce($1, nom), type = coalesce($2, type), montant = coalesce($3, montant),
     membres_max = coalesce($4, membres_max), statut = coalesce($5, statut)
     where id = $6 and user_id = $7 returning *`,
    [nom, type, montant, membres_max, statut, req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.json(r.rows[0]);
});

// Delete
router.delete("/:id", async (req, res) => {
  const r = await query(`delete from tontines where id = $1 and user_id = $2`, [req.params.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
