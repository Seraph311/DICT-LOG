import { Router } from 'express';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../lib/http-error.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const [purposes, offices, regions, ageGroups] = await Promise.all([
    pool.query('SELECT name FROM purposes WHERE active = true ORDER BY sort_order, id'),
    pool.query('SELECT name, service_type FROM offices WHERE active = true ORDER BY id'),
    pool.query('SELECT name FROM regions WHERE active = true ORDER BY sort_order, id'),
    pool.query('SELECT label FROM age_groups WHERE active = true ORDER BY sort_order, id'),
  ]);

  const groupedOffices = {};
  for (const office of offices.rows) {
    (groupedOffices[office.service_type] ??= []).push(office.name);
  }

  res.json({
    purposes: purposes.rows.map((row) => row.name),
    offices: groupedOffices,
    regions: regions.rows.map((row) => row.name),
    age_groups: ageGroups.rows.map((row) => row.label),
  });
}));

export default router;
