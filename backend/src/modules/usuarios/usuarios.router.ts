import { Router } from 'express';
const router = Router();
router.get('/', (_, res) => res.json({ module: 'usuarios', status: 'ok' }));
export default router;
