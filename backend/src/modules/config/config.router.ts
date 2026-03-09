import { Router } from 'express';
const router = Router();
router.get('/', (_, res) => res.json({ module: 'config', status: 'ok' }));
export default router;
