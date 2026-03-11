import { Router } from 'express';
import {
  getStats, getClientes, getCliente, createCliente, updateCliente, deleteCliente,
  getContactos, createContacto, deleteContacto,
  getFacturasCliente, getPedidosCliente, getCuentaCorriente, getRiesgo,
  getPresupuestosCliente, getAlbaranesCliente, getActividadCliente,
  getGrupos, getFormasPago, exportCSV
} from './clientes.controller';

const router = Router();
// authMiddleware ya aplicado en app.ts

// Rutas estáticas ANTES de /:id para evitar conflictos
router.get('/stats', getStats);
router.get('/grupos/list', getGrupos);
router.get('/formas-pago/list', getFormasPago);
router.get('/export/csv', exportCSV);

// CRUD
router.get('/', getClientes);
router.get('/:id', getCliente);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);

// Sub-recursos
router.get('/:id/contactos', getContactos);
router.post('/:id/contactos', createContacto);
router.delete('/:id/contactos/:contactoId', deleteContacto);
router.get('/:id/facturas', getFacturasCliente);
router.get('/:id/pedidos', getPedidosCliente);
router.get('/:id/cuenta-corriente', getCuentaCorriente);
router.get('/:id/riesgo', getRiesgo);
router.get('/:id/presupuestos', getPresupuestosCliente);
router.get('/:id/albaranes', getAlbaranesCliente);
router.get('/:id/actividad', getActividadCliente);

export default router;
