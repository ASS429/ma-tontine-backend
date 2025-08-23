import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// List members for a tontine
router.get("/:tontineId", async (req, res) => {
  const r = await query(
    `select m.* from membres m join tontines t on t.id = m.tontine_id 
     where m.tontine_id = $1 and t.user_id = $2 order by m.created_at desc`,
    [req.params.tontineId, req.user.id]
  );
  res.json(r.rows);
});

// Add member to a tontine
router.post("/:tontineId", async (req, res) => {
  const { nom, prenom = null, identifiant = null } = req.body;

  if (!nom || nom.trim() === "") {
    return res.status(400).json({ error: "Nom requis" });
  }

  // Ensure tontine belongs to user
  const t = await query(
    `select id from tontines where id = $1 and user_id = $2`,
    [req.params.tontineId, req.user.id]
  );
  if (t.rowCount === 0) return res.status(404).json({ error: "Tontine not found" });

  const r = await query(
    `insert into membres (tontine_id, nom, prenom, identifiant) 
     values ($1, $2, $3, $4) returning *`,
    [req.params.tontineId, nom.trim(), prenom, identifiant]
  );

  res.status(201).json(r.rows[0]);
});


// Update member
router.put("/edit/:id", async (req, res) => {
  const { nom, prenom, identifiant } = req.body;
  // Verify ownership through join
  const r = await query(
    `update membres m set nom = coalesce($1, nom), prenom = coalesce($2, prenom), identifiant = coalesce($3, identifiant)
     from tontines t where m.id = $4 and t.id = m.tontine_id and t.user_id = $5
     returning m.*`,
    [nom, prenom, identifiant, req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Member not found" });
  res.json(r.rows[0]);
});

// Delete member
router.delete("/delete/:id", async (req, res) => {
  const r = await query(
    `delete from membres m using tontines t where m.id = $1 and t.id = m.tontine_id and t.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Member not found" });
  res.status(204).end();
});

export default router;
