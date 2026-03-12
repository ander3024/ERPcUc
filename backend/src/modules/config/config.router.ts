import { Router, Response } from 'express';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getEmailConfig, saveEmailConfig, testEmail, enviarFactura, enviarDocumento, getPlantillas, getPlantillaTipo, savePlantillaTipo, getPlantilla, savePlantilla } from './email.controller';
import { redis } from '../../config/redis';

const router = Router();
const prisma = new PrismaClient();

// ── CONFIG EMPRESA ──────────────────────────────────────────

// GET /config
router.get('/', async (req: any, res: Response) => {
  try {
    let config = await prisma.configEmpresa.findFirst();
    if (!config) {
      config = await prisma.configEmpresa.create({
        data: { nombre: 'Mi Empresa', cif: 'B00000000', ejercicioActual: new Date().getFullYear() },
      });
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config
router.put('/', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    let config = await prisma.configEmpresa.findFirst();
    const data = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt;
    if (data.contadorFactura) data.contadorFactura = parseInt(data.contadorFactura);
    if (data.contadorPresup) data.contadorPresup = parseInt(data.contadorPresup);
    if (data.contadorPedido) data.contadorPedido = parseInt(data.contadorPedido);
    if (data.ejercicioActual) data.ejercicioActual = parseInt(data.ejercicioActual);

    if (config) {
      config = await prisma.configEmpresa.update({ where: { id: config.id }, data });
    } else {
      config = await prisma.configEmpresa.create({ data });
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── USUARIOS ────────────────────────────────────────────────

// GET /config/usuarios
router.get('/usuarios', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true, email: true, nombre: true, apellidos: true,
        telefono: true, rol: true, activo: true, createdAt: true,
        ultimoAcceso: true,
      },
    });
    res.json(usuarios);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/usuarios
router.post('/usuarios', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const { email, password, nombre, apellidos, rol, telefono } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
    }
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 12);
    const usuario = await prisma.usuario.create({
      data: { email, password: hash, nombre, apellidos: apellidos || '', rol: rol || 'EMPLEADO', telefono },
      select: { id: true, email: true, nombre: true, apellidos: true, rol: true, activo: true },
    });
    res.status(201).json(usuario);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/usuarios/:id
router.put('/usuarios/:id', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const { password, ...rest } = req.body;
    const data: any = { ...rest };
    delete data.id; delete data.createdAt; delete data.email;

    if (password && password.length >= 6) {
      data.password = await bcrypt.hash(password, 12);
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, nombre: true, apellidos: true, rol: true, activo: true },
    });
    res.json(usuario);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /config/usuarios/:id/toggle
router.patch('/usuarios/:id/toggle', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const u = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!u) return res.status(404).json({ error: 'No encontrado' });
    if (u.id === req.user?.id) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });

    const updated = await prisma.usuario.update({
      where: { id: req.params.id },
      data: { activo: !u.activo },
      select: { id: true, activo: true, nombre: true },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── EMAIL / SMTP ──────────────────────────────────────────
router.get('/email', getEmailConfig);
router.put('/email', saveEmailConfig);
router.post('/email/test', testEmail);
router.post('/facturas/:id/enviar', enviarFactura);
router.post('/documentos/:tipo/:id/enviar', enviarDocumento);

// ── PLANTILLAS (multi-tipo) ──────────────────────────────
router.get('/plantillas', getPlantillas);       // GET all types
router.get('/plantillas/:tipo', getPlantillaTipo);  // GET specific type
router.put('/plantillas/:tipo', savePlantillaTipo); // PUT specific type

// ── PREVIEW DOCUMENTO (HTML para impresión) ─────────────────

const fmtEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtFecha = (d: any) => d ? new Date(d).toLocaleDateString('es-ES') : '—';
const TIPO_LABELS: Record<string, string> = { factura: 'FACTURA', presupuesto: 'PRESUPUESTO', pedido: 'PEDIDO DE VENTA', albaran: 'ALBARÁN DE ENTREGA' };
const PLANTILLA_KEY_PREFIX = 'erp:plantilla:';

function generarHTMLDocumento(cfg: any, tipo: string, doc: any): string {
  const tipoLabel = TIPO_LABELS[tipo] || tipo.toUpperCase();
  const num = doc.numeroCompleto || doc.numero || '—';
  const lineas = doc.lineas || [];

  // Empresa
  const en = cfg.nombre || 'Mi Empresa';
  const ec = cfg.cif || '';
  const ed = cfg.direccion || '';
  const ecp = cfg.codigoPostal || '';
  const eci = cfg.ciudad || '';
  const et = cfg.telefono || '';
  const ee = cfg.email || '';

  // Plantilla
  const logo = cfg.logo || '';
  const cp = cfg.colorPrimario || '#1e3a5f';
  const cs = cfg.colorSecundario || '#10b981';
  const ct = cfg.colorTexto || '#1a1a2e';
  const fuente = cfg.fuente || 'Arial';
  const textoPie = cfg.textoPie || '';
  const textoCabecera = cfg.textoCabecera || '';
  const textoLegal = cfg.textoLegal || '';
  const iban = cfg.iban || '';
  const mostrarIban = cfg.mostrarIban !== false;
  const mostrarNotas = cfg.mostrarNotas !== false;
  const mostrarCondicionesPago = cfg.mostrarCondicionesPago !== false;

  // Totals
  const base = doc.baseImponible || lineas.reduce((s: number, l: any) => s + Number(l.baseLinea || 0), 0);
  const irpf = Number(doc.totalIrpf || 0);
  const retencion = Number(doc.retencion || 0);
  const importeRetencion = Number(doc.importeRetencion || 0);
  const total = Number(doc.total || 0);

  const ivaMap: Record<number, { base: number; cuota: number }> = {};
  lineas.forEach((l: any) => {
    const rate = Number(l.tipoIva || 21);
    if (!ivaMap[rate]) ivaMap[rate] = { base: 0, cuota: 0 };
    ivaMap[rate].base += Number(l.baseLinea || 0);
    ivaMap[rate].cuota += Number(l.ivaLinea || 0);
  });
  const ivaRates = Object.entries(ivaMap).sort((a, b) => Number(a[0]) - Number(b[0]));

  const fechaPrincipal = doc.fecha || doc.fechaEmision || doc.createdAt;

  const logoHtml = logo
    ? `<img src="${logo}" style="max-height:70px;max-width:220px;object-fit:contain;display:block;margin-bottom:6px" alt="Logo" />`
    : `<div style="font-size:20px;font-weight:800;color:${cp};margin-bottom:6px">${en}</div>`;

  const lineasHtml = lineas.map((l: any) => {
    const desc = l.descripcion || l.articulo?.nombre || '—';
    const ref = l.articulo?.referencia || l.referencia || '';
    const qty = Number(l.cantidad || 0);
    const precio = Number(l.precioUnitario || 0);
    const dto = Number(l.descuento || 0);
    const iva = l.tipoIva || 21;
    const totalL = Number(l.totalLinea || 0);
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:${ct}"><span style="font-weight:600">${desc}</span>${ref ? '<br><span style="font-family:monospace;font-size:10px;color:#94a3b8">' + ref + '</span>' : ''}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px">${qty.toLocaleString('es-ES')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px">${fmtEur(precio)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px">${dto > 0 ? dto + '%' : '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px">${iva}%</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:12px;font-weight:600">${fmtEur(totalL)}</td>
    </tr>`;
  }).join('');

  const ivaHtml = ivaRates.map(([rate, g]) =>
    `<tr class="sub"><td style="padding:4px 14px;color:#94a3b8;font-size:12px">IVA ${rate}% s/ ${fmtEur(g.base)}</td><td style="padding:4px 14px;text-align:right;font-size:12px;color:#64748b">${fmtEur(g.cuota)}</td></tr>`
  ).join('');

  let extraDates = '';
  if (tipo === 'factura' && doc.fechaVencimiento) extraDates += `<br><strong>Vencimiento:</strong> ${fmtFecha(doc.fechaVencimiento)}`;
  if (tipo === 'presupuesto' && doc.fechaValidez) extraDates += `<br><strong>Válido hasta:</strong> ${fmtFecha(doc.fechaValidez)}`;
  if (tipo === 'pedido' && doc.fechaEntrega) extraDates += `<br><strong>Entrega:</strong> ${fmtFecha(doc.fechaEntrega)}`;

  let extraFooter = '';
  if (mostrarCondicionesPago && doc.formaPago?.nombre) {
    extraFooter += `<div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#334155"><strong>Forma de pago:</strong> ${doc.formaPago.nombre}</div>`;
  }
  if (mostrarIban && iban) {
    extraFooter += `<div style="margin-top:8px;padding:12px 16px;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#15803d">Datos bancarios</strong><br><span style="font-size:14px;font-weight:700;letter-spacing:1px;color:#065f46">${iban}</span></div>`;
  }
  if (tipo === 'albaran') {
    extraFooter += `<div style="margin-top:50px;display:flex;gap:40px"><div style="flex:1;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:10px;color:#999">Entregado por</div><div style="flex:1;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:10px;color:#999">Recibido por (firma y sello)</div></div>`;
  }

  const obsHtml = (mostrarNotas && doc.observaciones)
    ? `<div style="margin-bottom:14px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;font-size:12px;color:#78350f"><strong style="display:block;margin-bottom:4px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#92400e">Observaciones</strong>${doc.observaciones}</div>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipoLabel} ${num}</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${fuente}', system-ui, -apple-system, sans-serif; font-size: 13px; color: ${ct}; background: #fff; line-height: 1.5; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 0; max-width: 100%; }
  }
</style>
</head><body><div class="page">

<!-- HEADER -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${cp}">
  <div style="flex:1">
    ${logoHtml}
    ${logo ? `<div style="font-size:16px;font-weight:800;color:${cp};margin-top:2px">${en}</div>` : ''}
    <div style="color:#64748b;font-size:11.5px;margin-top:6px;line-height:1.6">
      ${ec ? 'CIF: ' + ec + '<br>' : ''}${ed ? ed + '<br>' : ''}${ecp || eci ? (ecp + ' ' + eci).trim() + '<br>' : ''}${et ? 'Tel: ' + et + '<br>' : ''}${ee}
    </div>
  </div>
  <div style="text-align:right;min-width:220px">
    <div style="font-size:24px;font-weight:800;color:${cp};letter-spacing:1px">${tipoLabel}</div>
    <div style="font-size:15px;font-weight:700;color:#475569;margin-top:2px;font-family:'Courier New',monospace">${num}</div>
    ${textoCabecera ? `<div style="margin-top:6px;font-size:10px;color:#94a3b8;line-height:1.4;max-width:220px">${textoCabecera}</div>` : ''}
    <div style="margin-top:10px;font-size:12px;color:#64748b;line-height:1.8">
      <strong style="color:#334155">Fecha:</strong> ${fmtFecha(fechaPrincipal)}
      ${extraDates}
    </div>
  </div>
</div>

<!-- CLIENTE -->
<div style="display:flex;gap:20px;margin-bottom:28px">
  <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;margin-bottom:8px">Cliente</div>
    <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:5px">${doc.cliente?.nombre || doc.nombreCliente || '—'}</div>
    <div style="font-size:12px;color:#64748b;line-height:1.8">
      ${doc.cliente?.cifNif || doc.cifNif ? 'NIF/CIF: ' + (doc.cliente?.cifNif || doc.cifNif) + '<br>' : ''}
      ${doc.cliente?.direccion ? doc.cliente.direccion + '<br>' : ''}
      ${doc.cliente?.codigoPostal || doc.cliente?.ciudad ? ((doc.cliente?.codigoPostal || '') + ' ' + (doc.cliente?.ciudad || '')).trim() + '<br>' : ''}
      ${doc.cliente?.email ? doc.cliente.email + '<br>' : ''}
      ${doc.cliente?.telefono ? 'Tel: ' + doc.cliente.telefono : ''}
    </div>
  </div>
  <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;margin-bottom:8px">Datos del documento</div>
    <div style="font-size:12px;color:#64748b;line-height:1.8">
      <strong>Nº:</strong> ${num}<br>
      <strong>Fecha:</strong> ${fmtFecha(fechaPrincipal)}<br>
      ${doc.formaPago?.nombre ? '<strong>Forma de pago:</strong> ' + doc.formaPago.nombre + '<br>' : ''}
      ${doc.agente?.nombre ? '<strong>Agente:</strong> ' + doc.agente.nombre + '<br>' : ''}
    </div>
  </div>
</div>

${obsHtml}

<!-- ITEMS TABLE -->
<table style="width:100%;border-collapse:collapse;margin-bottom:4px">
  <thead><tr style="background:${cp};-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <th style="padding:10px 10px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.4px;color:#fff;white-space:nowrap">Descripción</th>
    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff">Cant.</th>
    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff">Precio</th>
    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff">Dto.</th>
    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff">IVA</th>
    <th style="padding:10px 10px;text-align:right;font-size:11px;font-weight:600;color:#fff">Total</th>
  </tr></thead>
  <tbody>${lineasHtml}</tbody>
</table>

<!-- TOTALS -->
<div style="display:flex;justify-content:flex-end;margin-bottom:24px">
  <table style="width:320px;border-collapse:collapse">
    <tr><td style="padding:7px 14px;color:#64748b;font-size:13px">Base imponible</td><td style="padding:7px 14px;text-align:right;font-size:13px;font-weight:600;color:#1e293b">${fmtEur(base)}</td></tr>
    ${ivaHtml}
    ${irpf > 0 ? `<tr><td style="padding:7px 14px;color:#64748b;font-size:13px">IRPF</td><td style="padding:7px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626">-${fmtEur(irpf)}</td></tr>` : ''}
    ${retencion > 0 ? `<tr><td style="padding:7px 14px;color:#dc2626;font-size:13px">Retención IRPF (${retencion}%)</td><td style="padding:7px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626">-${fmtEur(importeRetencion)}</td></tr>` : ''}
    <tr><td style="padding:12px 14px;font-size:20px;font-weight:800;color:${cp};border-top:3px solid ${cp}">${retencion > 0 ? 'TOTAL A PAGAR' : 'TOTAL'}</td><td style="padding:12px 14px;text-align:right;font-size:20px;font-weight:800;color:${cp};border-top:3px solid ${cp}">${fmtEur(total)}</td></tr>
  </table>
</div>

${extraFooter}
${textoPie ? `<div style="text-align:center;margin-top:16px;font-size:11px;color:#94a3b8;line-height:1.6">${textoPie}</div>` : ''}

<!-- FOOTER -->
<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#94a3b8">
  <span>${textoLegal || (en + (ec ? ' · CIF: ' + ec : ''))}</span>
  <span>${tipoLabel} nº ${num}</span>
</div>

</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
</body></html>`;
}

const LINEAS_INCLUDE = { articulo: { select: { id: true, referencia: true, nombre: true } } };

router.get('/documentos/preview/:tipo/:id', async (req: any, res: Response) => {
  const { tipo, id } = req.params;
  try {
    // Cargar config empresa
    const configEmpresa = await prisma.configEmpresa.findFirst();

    // Cargar plantilla del tipo desde Redis
    const plantillaRaw = await redis.get(PLANTILLA_KEY_PREFIX + tipo);
    const plantilla = plantillaRaw ? JSON.parse(plantillaRaw) : {};

    // Combinar: plantilla tiene prioridad, empresa como fallback
    const config = {
      nombre: configEmpresa?.nombre || '',
      cif: configEmpresa?.cif || '',
      direccion: configEmpresa?.direccion || '',
      codigoPostal: configEmpresa?.codigoPostal || '',
      ciudad: configEmpresa?.ciudad || '',
      telefono: configEmpresa?.telefono || '',
      email: configEmpresa?.email || '',
      logo: plantilla.logo || configEmpresa?.logo || '',
      colorPrimario: plantilla.colorPrimario || '#1e3a5f',
      colorSecundario: plantilla.colorSecundario || '#10b981',
      colorTexto: plantilla.colorTexto || '#1a1a2e',
      fuente: plantilla.fuente || 'Arial',
      textoPie: plantilla.textoPie || '',
      textoCabecera: plantilla.textoCabecera || '',
      notasDefecto: plantilla.notasDefecto || '',
      mostrarNotas: plantilla.mostrarNotas !== false,
      mostrarIban: plantilla.mostrarIban !== false,
      iban: plantilla.iban || '',
      textoLegal: plantilla.textoLegal || '',
      mostrarCondicionesPago: plantilla.mostrarCondicionesPago !== false,
    };

    // Cargar documento según tipo
    let doc: any = null;
    if (tipo === 'presupuesto') {
      doc = await prisma.presupuesto.findUnique({ where: { id }, include: { cliente: true, lineas: { include: LINEAS_INCLUDE, orderBy: { orden: 'asc' } }, formaPago: true } });
    } else if (tipo === 'pedido') {
      doc = await prisma.pedidoVenta.findUnique({ where: { id }, include: { cliente: true, lineas: { include: LINEAS_INCLUDE, orderBy: { orden: 'asc' } }, formaPago: true } });
    } else if (tipo === 'albaran') {
      doc = await prisma.albaranVenta.findUnique({ where: { id }, include: { cliente: true, lineas: { include: LINEAS_INCLUDE, orderBy: { orden: 'asc' } } } });
    } else if (tipo === 'factura') {
      doc = await prisma.factura.findUnique({ where: { id }, include: { cliente: true, lineas: { include: LINEAS_INCLUDE, orderBy: { orden: 'asc' } }, formaPago: true } });
    } else {
      return res.status(400).send('Tipo no válido');
    }

    if (!doc) return res.status(404).send('Documento no encontrado');

    const html = generarHTMLDocumento(config, tipo, doc);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e: any) {
    res.status(500).send('Error: ' + e.message);
  }
});

// ── AGENTES COMERCIALES ─────────────────────────────────────

// GET /config/agentes
router.get('/agentes', async (req: any, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const agentes = await prisma.agente.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { clientes: true, facturas: true } } },
    });
    res.json(agentes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/agentes
router.post('/agentes', async (req: any, res: Response) => {
  try {
    const { nombre, email, telefono, comision, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const agente = await prisma.agente.create({
      data: { nombre, email: email || null, telefono: telefono || null, comision: comision || 0, activo: activo !== false },
    });
    res.status(201).json(agente);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/agentes/:id
router.put('/agentes/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt; delete data._count;
    const agente = await prisma.agente.update({ where: { id: req.params.id }, data });
    res.json(agente);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/agentes/:id
router.delete('/agentes/:id', async (req: any, res: Response) => {
  try {
    await prisma.agente.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── TARIFAS DE PRECIOS ──────────────────────────────────────

// GET /config/tarifas
router.get('/tarifas', async (req: any, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }
    const tarifas = await prisma.tarifa.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { lineas: true, clientes: true } } },
    });
    res.json(tarifas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/tarifas
router.post('/tarifas', async (req: any, res: Response) => {
  try {
    const { nombre, descripcion, tipo, activa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const tarifa = await prisma.tarifa.create({
      data: { nombre, descripcion: descripcion || null, tipo: tipo || 'PORCENTAJE_DESCUENTO', activa: activa !== false },
    });
    res.status(201).json(tarifa);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/tarifas/:id
router.put('/tarifas/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt; delete data._count;
    const tarifa = await prisma.tarifa.update({ where: { id: req.params.id }, data });
    res.json(tarifa);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/tarifas/:id
router.delete('/tarifas/:id', async (req: any, res: Response) => {
  try {
    await prisma.tarifa.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /config/tarifas/:id/lineas
router.get('/tarifas/:id/lineas', async (req: any, res: Response) => {
  try {
    const lineas = await prisma.tarifaLinea.findMany({
      where: { tarifaId: req.params.id },
      include: { articulo: { select: { id: true, referencia: true, nombre: true, precioVenta: true } } },
      orderBy: { articulo: { nombre: 'asc' } },
    });
    res.json(lineas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/tarifas/:id/lineas
router.post('/tarifas/:id/lineas', async (req: any, res: Response) => {
  try {
    const { articuloId, precio, descuento } = req.body;
    if (!articuloId) return res.status(400).json({ error: 'articuloId es obligatorio' });
    const linea = await prisma.tarifaLinea.create({
      data: { tarifaId: req.params.id, articuloId, precio: precio || null, descuento: descuento || 0 },
      include: { articulo: { select: { id: true, referencia: true, nombre: true, precioVenta: true } } },
    });
    res.status(201).json(linea);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Artículo ya existe en esta tarifa' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/tarifas/:id/lineas/:lineaId
router.delete('/tarifas/:id/lineas/:lineaId', async (req: any, res: Response) => {
  try {
    await prisma.tarifaLinea.delete({ where: { id: req.params.lineaId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── FORMAS DE PAGO ──────────────────────────────────────────

// GET /config/formas-pago
router.get('/formas-pago', async (_req: any, res: Response) => {
  try {
    const formas = await prisma.formaPago.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { clientes: true, facturas: true } } },
    });
    res.json(formas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/formas-pago
router.post('/formas-pago', async (req: any, res: Response) => {
  try {
    const { nombre, diasVto, numVtos, tipo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const fp = await prisma.formaPago.create({
      data: { nombre, diasVto: diasVto || 0, numVtos: numVtos || 1, tipo: tipo || 'CONTADO' },
    });
    res.status(201).json(fp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/formas-pago/:id
router.put('/formas-pago/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data._count; delete data.codigoEneboo;
    const fp = await prisma.formaPago.update({ where: { id: req.params.id }, data });
    res.json(fp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/formas-pago/:id
router.delete('/formas-pago/:id', async (req: any, res: Response) => {
  try {
    await prisma.formaPago.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
