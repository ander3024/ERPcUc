import { Router } from 'express';
const router = Router();
router.get('/', (_, res) => res.json({ module: 'articulos', status: 'ok' }));
export default router;
