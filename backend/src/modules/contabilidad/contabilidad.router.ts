import { Router } from 'express';
const router = Router();
router.get('/', (_, res) => res.json({ module: 'contabilidad', status: 'ok' }));
export default router;
