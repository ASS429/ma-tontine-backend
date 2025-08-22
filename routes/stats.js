import express from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = express.Router();
router.use(authenticate);

// Overview stats for user's tontines
router.get("/overview", async (req, res) => {
  const [{ rows: tCount }, { rows: mCount }, { rows: pSum }, { rows: dCount }] = await Promise.all([
    query(`select count(*)::int as total from tontines where user_id = $1`, [req.user.id]),
    query(`select count(*)::int as total from membres m join tontines t on t.id = m.tontine_id where t.user_id = $1`, [req.user.id]),
    query(`select coalesce(sum(montant),0)::float as total from paiements p join tontines t on t.id = p.tontine_id where t.user_id = $1`, [req.user.id]),
    query(`select count(*)::int as total from tirages ti join tontines t on t.id = ti.tontine_id where t.user_id = $1`, [req.user.id])
  ]);
  res.json({
    tontines_actives: tCount[0].total,
    membres_total: mCount[0].total,
    montant_collecte: pSum[0].total,
    tirages_effectues: dCount[0].total
  });
});

export default router;
