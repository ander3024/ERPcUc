import { Router } from 'express';
import * as pres from './presupuestos.controller';
import * as ped from './pedidos.controller';
import * as alb from './albaranes.controller';
import * as fact from './facturas.controller';
import * as cobros from './cobros.controller';

const router = Router();
// authMiddleware ya aplicado en app.ts

// ── PRESUPUESTOS ──
router.get('/presupuestos/stats', pres.getStats);
router.get('/presupuestos', pres.getPresupuestos);
router.get('/presupuestos/:id', pres.getPresupuesto);
router.post('/presupuestos', pres.createPresupuesto);
router.put('/presupuestos/:id', pres.updatePresupuesto);
router.delete('/presupuestos/:id', pres.deletePresupuesto);
router.post('/presupuestos/:id/convertir-pedido', pres.convertirAPedido);

// ── PEDIDOS VENTA ──
router.get('/pedidos/stats', ped.getStats);
router.get('/pedidos', ped.getPedidos);
router.get('/pedidos/:id', ped.getPedido);
router.post('/pedidos', ped.createPedido);
router.put('/pedidos/:id', ped.updatePedido);
router.delete('/pedidos/:id', ped.deletePedido);
router.post('/pedidos/:id/convertir-albaran', ped.convertirAAlbaran);
router.post('/pedidos/:id/convertir-factura', ped.convertirAFactura);

// ── ALBARANES VENTA ──
router.get('/albaranes/stats', alb.getStats);
router.get('/albaranes', alb.getAlbaranes);
router.get('/albaranes/:id', alb.getAlbaran);
router.post('/albaranes', alb.createAlbaran);
router.put('/albaranes/:id', alb.updateAlbaran);
router.delete('/albaranes/:id', alb.deleteAlbaran);
router.post('/albaranes/:id/convertir-factura', alb.convertirAFactura);

// ── FACTURAS VENTA ──
router.get('/facturas/stats', fact.getStats);
router.get('/facturas', fact.getFacturas);
router.get('/facturas/:id', fact.getFactura);
router.post('/facturas', fact.createFactura);
router.put('/facturas/:id', fact.updateFactura);
router.delete('/facturas/:id', fact.deleteFactura);

// ── COBROS ──
router.get('/cobros/pendientes', cobros.getCobrosPendientes);
router.get('/cobros', cobros.getCobros);
router.post('/cobros', cobros.createCobro);
router.delete('/cobros/:id', cobros.deleteCobro);

export default router;
