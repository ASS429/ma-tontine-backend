import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// List tirages for tontine
router.get("/:tontineId", async (req, res) => {
  const r = await query(
    `select ti.*, m.nom as membre_nom, m.prenom as membre_prenom
     from tirages ti
     join membres m on m.id = ti.membre_id
     join tontines t on t.id = ti.tontine_id
     where ti.tontine_id = $1 and t.user_id = $2
     order by ti.ordre asc`,
    [req.params.tontineId, req.user.id]
  );
  res.json(r.rows);
});

// Run a new tirage (random among members not yet drawn)
router.post("/run/:tontineId", async (req, res) => {
  const tontineId = req.params.tontineId;
  // verify ownership
  const t = await query(`select id from tontines where id = $1 and user_id = $2`, [tontineId, req.user.id]);
  if (t.rowCount === 0) return res.status(404).json({ error: "Tontine not found" });

  // find remaining members
  const remaining = await query(
    `select m.id from membres m
     where m.tontine_id = $1 and m.id not in (select membre_id from tirages where tontine_id = $1)
     order by random() limit 1`,
    [tontineId]
  );
  if (remaining.rowCount === 0) return res.status(400).json({ error: "Tous les membres ont été tirés" });

  const nextOrderRes = await query(`select coalesce(max(ordre), 0) + 1 as next from tirages where tontine_id = $1`, [tontineId]);
  const nextOrder = nextOrderRes.rows[0].next;

  const chosen = remaining.rows[0].id;
  const r = await query(
    `insert into tirages (tontine_id, membre_id, ordre) values ($1, $2, $3) returning *`,
    [tontineId, chosen, nextOrder]
  );
  res.status(201).json(r.rows[0]);
});

// Supprimer un tirage
router.delete("/:id", async (req, res) => {
  const r = await query(
    `delete from tirages ti
     using tontines t
     where ti.id = $1
       and t.id = ti.tontine_id
       and t.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Tirage non trouvé" });
  res.status(204).end();
});


export default router;
