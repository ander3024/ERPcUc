import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/imports/', limits: { fileSize: 20 * 1024 * 1024 } });

// ============================================
// API Documentation (Swagger-like JSON)
// ============================================
const API_DOCS = {
  openapi: '3.0.3',
  info: {
    title: 'ERP Web API',
    version: '2.0.0',
    description: 'API REST completa del sistema ERP Web. Autenticación vía JWT Bearer token.',
  },
  servers: [{ url: '/api', description: 'Servidor principal' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Iniciar sesión',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { '200': { description: 'Token JWT + datos usuario' }, '401': { description: 'Credenciales inválidas' } },
      },
    },
    '/clientes': {
      get: { tags: ['Clientes'], summary: 'Listar clientes', parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ], responses: { '200': { description: 'Lista paginada de clientes' } } },
      post: { tags: ['Clientes'], summary: 'Crear cliente', responses: { '201': { description: 'Cliente creado' } } },
    },
    '/clientes/{id}': {
      get: { tags: ['Clientes'], summary: 'Obtener cliente por ID', responses: { '200': { description: 'Detalle del cliente' } } },
      put: { tags: ['Clientes'], summary: 'Actualizar cliente', responses: { '200': { description: 'Cliente actualizado' } } },
      delete: { tags: ['Clientes'], summary: 'Eliminar cliente', responses: { '200': { description: 'Cliente eliminado' } } },
    },
    '/articulos': {
      get: { tags: ['Artículos'], summary: 'Listar artículos', responses: { '200': { description: 'Lista paginada' } } },
      post: { tags: ['Artículos'], summary: 'Crear artículo', responses: { '201': { description: 'Artículo creado' } } },
    },
    '/ventas/presupuestos': {
      get: { tags: ['Ventas'], summary: 'Listar presupuestos', responses: { '200': { description: 'Lista' } } },
      post: { tags: ['Ventas'], summary: 'Crear presupuesto', responses: { '201': { description: 'Creado' } } },
    },
    '/ventas/pedidos': {
      get: { tags: ['Ventas'], summary: 'Listar pedidos de venta', responses: { '200': { description: 'Lista' } } },
    },
    '/ventas/albaranes': {
      get: { tags: ['Ventas'], summary: 'Listar albaranes de venta', responses: { '200': { description: 'Lista' } } },
    },
    '/ventas/facturas': {
      get: { tags: ['Ventas'], summary: 'Listar facturas de venta', responses: { '200': { description: 'Lista' } } },
    },
    '/ventas/cobros': {
      get: { tags: ['Ventas'], summary: 'Listar cobros', responses: { '200': { description: 'Lista' } } },
    },
    '/compras/proveedores': {
      get: { tags: ['Compras'], summary: 'Listar proveedores', responses: { '200': { description: 'Lista' } } },
      post: { tags: ['Compras'], summary: 'Crear proveedor', responses: { '201': { description: 'Creado' } } },
    },
    '/compras/pedidos': {
      get: { tags: ['Compras'], summary: 'Listar pedidos de compra', responses: { '200': { description: 'Lista' } } },
    },
    '/compras/facturas': {
      get: { tags: ['Compras'], summary: 'Listar facturas de compra', responses: { '200': { description: 'Lista' } } },
    },
    '/facturas': {
      get: { tags: ['Facturación'], summary: 'Listar todas las facturas', responses: { '200': { description: 'Lista' } } },
    },
    '/contabilidad/asientos': {
      get: { tags: ['Contabilidad'], summary: 'Listar asientos contables', responses: { '200': { description: 'Lista' } } },
    },
    '/tpv/cajas': {
      get: { tags: ['TPV'], summary: 'Listar cajas TPV', responses: { '200': { description: 'Lista' } } },
    },
    '/crm/oportunidades': {
      get: { tags: ['CRM'], summary: 'Listar oportunidades', responses: { '200': { description: 'Lista' } } },
    },
    '/rrhh/empleados': {
      get: { tags: ['RRHH'], summary: 'Listar empleados', responses: { '200': { description: 'Lista' } } },
    },
    '/integraciones/webhooks': {
      get: { tags: ['Integraciones'], summary: 'Listar webhooks', responses: { '200': { description: 'Lista' } } },
      post: { tags: ['Integraciones'], summary: 'Crear webhook', responses: { '201': { description: 'Webhook creado' } } },
    },
    '/integraciones/importar': {
      post: { tags: ['Integraciones'], summary: 'Importar archivo Excel/CSV', responses: { '200': { description: 'Resultado importación' } } },
    },
  },
};

// GET /api-docs - OpenAPI spec
router.get('/api-docs', (_req: Request, res: Response) => {
  res.json(API_DOCS);
});

// GET /api-docs/html - Swagger UI-like HTML viewer
router.get('/api-docs/html', (_req: Request, res: Response) => {
  // Group endpoints by tag
  const groups: Record<string, { method: string; path: string; summary: string }[]> = {};
  Object.entries(API_DOCS.paths).forEach(([path, methods]: any) => {
    Object.entries(methods).forEach(([method, spec]: any) => {
      const tag = spec.tags?.[0] || 'General';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push({ path, method, summary: spec.summary });
    });
  });

  let endpointsHtml = '';
  for (const [tag, endpoints] of Object.entries(groups)) {
    let items = '';
    for (const e of endpoints) {
      items += '<div class="endpoint"><span class="method method-' + e.method + '">' + e.method.toUpperCase() + '</span>'
        + '<span class="path">' + e.path + '</span>'
        + '<span class="summary">' + e.summary + '</span></div>';
    }
    endpointsHtml += '<div class="tag-group"><div class="tag-title">' + tag + '</div>' + items + '</div>';
  }

  const html = '<!DOCTYPE html><html><head><title>ERP Web API Docs</title>'
    + '<style>'
    + '* { box-sizing: border-box; margin: 0; padding: 0; }'
    + 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; }'
    + '.container { max-width: 1000px; margin: 0 auto; padding: 30px 20px; }'
    + 'h1 { font-size: 28px; margin-bottom: 5px; }'
    + '.version { color: #64748b; font-size: 14px; margin-bottom: 30px; }'
    + '.tag-group { margin-bottom: 30px; }'
    + '.tag-title { font-size: 18px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }'
    + '.endpoint { display: flex; align-items: center; gap: 12px; padding: 10px 14px; margin-bottom: 4px; border-radius: 8px; background: #1e293b; }'
    + '.method { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; min-width: 50px; text-align: center; }'
    + '.method-get { background: #166534; color: #86efac; }'
    + '.method-post { background: #1e40af; color: #93c5fd; }'
    + '.method-put { background: #92400e; color: #fcd34d; }'
    + '.method-delete { background: #991b1b; color: #fca5a5; }'
    + '.path { font-family: monospace; font-size: 14px; color: #f8fafc; }'
    + '.summary { font-size: 13px; color: #94a3b8; margin-left: auto; }'
    + '.auth-note { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #94a3b8; }'
    + '.auth-note code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #3b82f6; }'
    + '</style></head><body><div class="container">'
    + '<h1>ERP Web API</h1>'
    + '<p class="version">v2.0.0</p>'
    + '<div class="auth-note">Auth: <code>Authorization: Bearer &lt;token&gt;</code></div>'
    + endpointsHtml
    + '</div></body></html>';

  res.type('html').send(html);
});

// ============================================
// WEBHOOKS CRUD
// ============================================
const WEBHOOK_EVENTS = [
  'cliente.creado', 'cliente.actualizado', 'cliente.eliminado',
  'factura.creada', 'factura.cobrada', 'factura.vencida',
  'pedido.creado', 'pedido.confirmado',
  'articulo.creado', 'articulo.stock_bajo',
  'cobro.registrado', 'pago.registrado',
];

// GET /webhooks
router.get('/webhooks', async (_req: Request, res: Response) => {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { logs: true } } } });
  res.json(webhooks);
});

// GET /webhooks/eventos - list available events
router.get('/webhooks/eventos', (_req: Request, res: Response) => {
  res.json(WEBHOOK_EVENTS);
});

// POST /webhooks
router.post('/webhooks', async (req: Request, res: Response) => {
  const { nombre, url, eventos, activo } = req.body;
  const secreto = crypto.randomBytes(32).toString('hex');
  const webhook = await prisma.webhook.create({
    data: { nombre, url, eventos: eventos || [], secreto, activo: activo !== false },
  });
  res.status(201).json(webhook);
});

// PUT /webhooks/:id
router.put('/webhooks/:id', async (req: Request, res: Response) => {
  const { nombre, url, eventos, activo } = req.body;
  const webhook = await prisma.webhook.update({
    where: { id: req.params.id },
    data: { nombre, url, eventos, activo },
  });
  res.json(webhook);
});

// DELETE /webhooks/:id
router.delete('/webhooks/:id', async (req: Request, res: Response) => {
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// POST /webhooks/:id/test - test a webhook
router.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });

  const payload = { evento: 'test', timestamp: new Date().toISOString(), data: { mensaje: 'Test webhook desde ERP Web' } };
  const start = Date.now();

  try {
    const hmac = crypto.createHmac('sha256', webhook.secreto || '').update(JSON.stringify(payload)).digest('hex');
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ERP-Signature': hmac },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const duracionMs = Date.now() - start;
    const respuesta = await response.text().catch(() => '');

    await prisma.webhookLog.create({
      data: { webhookId: webhook.id, evento: 'test', payload, statusCode: response.status, respuesta: respuesta.slice(0, 500), duracionMs },
    });
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { ultimoEnvio: new Date(), ultimoEstado: response.status, fallosConsecutivos: response.ok ? 0 : webhook.fallosConsecutivos + 1 },
    });

    res.json({ ok: response.ok, status: response.status, duracionMs });
  } catch (err: any) {
    const duracionMs = Date.now() - start;
    await prisma.webhookLog.create({
      data: { webhookId: webhook.id, evento: 'test', payload, error: err.message, duracionMs },
    });
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { ultimoEnvio: new Date(), ultimoEstado: 0, fallosConsecutivos: webhook.fallosConsecutivos + 1 },
    });
    res.json({ ok: false, error: err.message, duracionMs });
  }
});

// GET /webhooks/:id/logs
router.get('/webhooks/:id/logs', async (req: Request, res: Response) => {
  const logs = await prisma.webhookLog.findMany({
    where: { webhookId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(logs);
});

// ============================================
// Webhook dispatcher (utility for other modules)
// ============================================
export async function dispatchWebhook(evento: string, data: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { activo: true, eventos: { has: evento } },
    });

    for (const wh of webhooks) {
      const payload = { evento, timestamp: new Date().toISOString(), data };
      const start = Date.now();

      try {
        const hmac = crypto.createHmac('sha256', wh.secreto || '').update(JSON.stringify(payload)).digest('hex');
        const response = await fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-ERP-Signature': hmac },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        const duracionMs = Date.now() - start;

        await prisma.webhookLog.create({
          data: { webhookId: wh.id, evento, payload, statusCode: response.status, duracionMs },
        });
        await prisma.webhook.update({
          where: { id: wh.id },
          data: { ultimoEnvio: new Date(), ultimoEstado: response.status, fallosConsecutivos: response.ok ? 0 : wh.fallosConsecutivos + 1 },
        });
      } catch (err: any) {
        await prisma.webhookLog.create({
          data: { webhookId: wh.id, evento, payload, error: err.message, duracionMs: Date.now() - start },
        });
        await prisma.webhook.update({
          where: { id: wh.id },
          data: { fallosConsecutivos: wh.fallosConsecutivos + 1 },
        });
      }
    }
  } catch {}
}

// ============================================
// IMPORTACIÓN MASIVA
// ============================================

// GET /importaciones - historial
router.get('/importaciones', async (_req: Request, res: Response) => {
  const imports = await prisma.importacionMasiva.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { usuario: { select: { nombre: true, email: true } } },
  });
  res.json(imports);
});

// GET /importaciones/plantillas/:tipo - download template
router.get('/importaciones/plantillas/:tipo', (req: Request, res: Response) => {
  const templates: Record<string, { headers: string[]; ejemplo: any[] }> = {
    clientes: {
      headers: ['codigo', 'nombre', 'cifNif', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'codigoPostal', 'pais', 'observaciones'],
      ejemplo: [{ codigo: 'CLI001', nombre: 'Empresa Demo SL', cifNif: 'B12345678', email: 'demo@demo.com', telefono: '912345678', direccion: 'Calle Mayor 1', ciudad: 'Madrid', provincia: 'Madrid', codigoPostal: '28001', pais: 'España', observaciones: '' }],
    },
    articulos: {
      headers: ['referencia', 'nombre', 'descripcion', 'precioCoste', 'precioVenta', 'tipoIva', 'stockActual', 'stockMinimo', 'unidadMedida'],
      ejemplo: [{ referencia: 'ART001', nombre: 'Artículo demo', descripcion: 'Descripción', precioCoste: 10, precioVenta: 20, tipoIva: 21, stockActual: 100, stockMinimo: 10, unidadMedida: 'UND' }],
    },
    proveedores: {
      headers: ['codigo', 'nombre', 'cifNif', 'email', 'telefono', 'direccion', 'ciudad', 'provincia', 'codigoPostal', 'pais', 'contacto'],
      ejemplo: [{ codigo: 'PROV001', nombre: 'Proveedor Demo SL', cifNif: 'A87654321', email: 'prov@demo.com', telefono: '913456789', direccion: 'Avda. Industria 5', ciudad: 'Barcelona', provincia: 'Barcelona', codigoPostal: '08001', pais: 'España', contacto: 'Juan García' }],
    },
  };

  const t = templates[req.params.tipo];
  if (!t) return res.status(400).json({ error: 'Tipo no soportado. Tipos: clientes, articulos, proveedores' });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(t.ejemplo, { header: t.headers });
  XLSX.utils.book_append_sheet(wb, ws, req.params.tipo);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=plantilla_${req.params.tipo}.xlsx`);
  res.send(buf);
});

// POST /importar - import file
router.post('/importar', upload.single('archivo'), async (req: Request, res: Response) => {
  const file = req.file;
  const tipo = req.body.tipo;
  const userId = (req as any).user?.id;

  if (!file) return res.status(400).json({ error: 'No se ha enviado archivo' });
  if (!tipo) return res.status(400).json({ error: 'Tipo de importación requerido' });
  if (!['clientes', 'articulos', 'proveedores'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo no soportado' });
  }

  try {
    const wb = XLSX.readFile(file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) return res.status(400).json({ error: 'El archivo está vacío' });

    const importacion = await prisma.importacionMasiva.create({
      data: { tipo, nombreArchivo: file.originalname, totalFilas: rows.length, estado: 'PROCESANDO', usuarioId: userId },
    });

    let exito = 0;
    let errores: { fila: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (tipo === 'clientes') {
          const codigo = row.codigo ? String(row.codigo).trim() : 'IMP-' + Date.now() + '-' + i;
          await prisma.cliente.create({
            data: {
              codigo,
              nombre: String(row.nombre || '').trim(),
              cifNif: row.cifNif ? String(row.cifNif).trim() : null,
              email: row.email ? String(row.email).trim() : null,
              telefono: row.telefono ? String(row.telefono).trim() : null,
              direccion: row.direccion ? String(row.direccion).trim() : null,
              ciudad: row.ciudad ? String(row.ciudad).trim() : null,
              provincia: row.provincia ? String(row.provincia).trim() : null,
              codigoPostal: row.codigoPostal ? String(row.codigoPostal).trim() : null,
              pais: row.pais ? String(row.pais).trim() : 'España',
              observaciones: row.observaciones ? String(row.observaciones).trim() : null,
            },
          });
        } else if (tipo === 'articulos') {
          await prisma.articulo.create({
            data: {
              referencia: String(row.referencia || 'IMP-' + Date.now() + '-' + i).trim(),
              nombre: String(row.nombre || '').trim(),
              descripcion: row.descripcion ? String(row.descripcion).trim() : null,
              precioCoste: Number(row.precioCoste) || 0,
              precioVenta: Number(row.precioVenta) || 0,
              tipoIva: Number(row.tipoIva) || 21,
              stockActual: Number(row.stockActual) || 0,
              stockMinimo: Number(row.stockMinimo) || 0,
            },
          });
        } else if (tipo === 'proveedores') {
          const codigo = row.codigo ? String(row.codigo).trim() : 'IMP-' + Date.now() + '-' + i;
          await prisma.proveedor.create({
            data: {
              codigo,
              nombre: String(row.nombre || '').trim(),
              cifNif: row.cifNif ? String(row.cifNif).trim() : null,
              email: row.email ? String(row.email).trim() : null,
              telefono: row.telefono ? String(row.telefono).trim() : null,
              direccion: row.direccion ? String(row.direccion).trim() : null,
              ciudad: row.ciudad ? String(row.ciudad).trim() : null,
              provincia: row.provincia ? String(row.provincia).trim() : null,
              codigoPostal: row.codigoPostal ? String(row.codigoPostal).trim() : null,
              pais: row.pais ? String(row.pais).trim() : 'España',
              contacto: row.contacto ? String(row.contacto).trim() : null,
            },
          });
        }
        exito++;
      } catch (err: any) {
        errores.push({ fila: i + 2, error: err.message?.slice(0, 200) || 'Error desconocido' });
      }
    }

    await prisma.importacionMasiva.update({
      where: { id: importacion.id },
      data: {
        filasExito: exito,
        filasError: errores.length,
        estado: errores.length === 0 ? 'COMPLETADO' : exito > 0 ? 'PARCIAL' : 'ERROR',
        errores: errores.length > 0 ? errores : undefined,
      },
    });

    // Dispatch webhook
    dispatchWebhook('importacion.completada', {
      id: importacion.id, tipo, totalFilas: rows.length, exito, errores: errores.length,
    });

    res.json({
      id: importacion.id,
      totalFilas: rows.length,
      filasExito: exito,
      filasError: errores.length,
      estado: errores.length === 0 ? 'COMPLETADO' : exito > 0 ? 'PARCIAL' : 'ERROR',
      errores: errores.slice(0, 20),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error procesando archivo: ' + err.message });
  }
});

export default router;
