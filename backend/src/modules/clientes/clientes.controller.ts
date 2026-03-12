import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── STATS ────────────────────────────────────────────────────────────────────
export const getStats = async (_req: Request, res: Response) => {
  try {
    const [total, activos, nuevosHoy] = await Promise.all([
      prisma.cliente.count(),
      prisma.cliente.count({ where: { activo: true } }),
      prisma.cliente.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    const pendiente = await prisma.factura.aggregate({
      _sum: { total: true, totalPagado: true },
      where: { estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } }
    });
    res.json({
      total, activos, inactivos: total - activos, nuevosHoy,
      pendienteTotal: (Number(pendiente._sum.total) || 0) - (Number(pendiente._sum.totalPagado) || 0)
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────
export const getClientes = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', activo = '', grupoId = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { nombreComercial: { contains: search, mode: 'insensitive' } },
      { cifNif: { contains: search, mode: 'insensitive' } },
      { codigo: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    if (activo !== '') where.activo = activo === 'true';
    if (grupoId) where.grupoClienteId = grupoId;

    const [data, total] = await Promise.all([
      prisma.cliente.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { nombre: 'asc' },
        include: {
          grupo: { select: { nombre: true } },
          formaPago: { select: { nombre: true } },
          _count: { select: { facturas: true, pedidos: true } }
        }
      }),
      prisma.cliente.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── OBTENER UNO ──────────────────────────────────────────────────────────────
export const getCliente = async (req: Request, res: Response) => {
  try {
    const c = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: {
        grupo: true,
        formaPago: true,
        contactos: { orderBy: { principal: 'desc' } },
        _count: { select: { facturas: true, pedidos: true, albaranes: true } }
      }
    });
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(c);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── CREAR ────────────────────────────────────────────────────────────────────
export const createCliente = async (req: Request, res: Response) => {
  try {
    const {
      nombre, nombreComercial, cifNif, tipoCliente = 'EMPRESA',
      email, telefono, movil, fax, web,
      direccion, codigoPostal, ciudad, provincia, pais = 'España',
      dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
      formaPagoId, tipoIva, regimenIva, descuento, limiteCredito,
      cuentaContable, iban, diasVencimiento,
      grupoClienteId, agente, observaciones
    } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    // Generar código automático
    const ultimo = await prisma.cliente.findFirst({
      orderBy: { codigo: 'desc' },
      where: { codigo: { startsWith: 'C' } }
    });
    const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, '')) + 1 : 1;
    const codigo = `C${String(n).padStart(5, '0')}`;

    // Construir data sin campos undefined o NaN
    const data: any = {
      codigo, nombre: nombre.trim(),
      nombreComercial: nombreComercial || null,
      cifNif: cifNif || null,
      tipoCliente,
      email: email || null,
      telefono: telefono || null,
      movil: movil || null,
      fax: fax || null,
      web: web || null,
      direccion: direccion || null,
      codigoPostal: codigoPostal || null,
      ciudad: ciudad || null,
      provincia: provincia || null,
      pais: pais || 'España',
      dirEnvio: dirEnvio || null,
      cpEnvio: cpEnvio || null,
      ciudadEnvio: ciudadEnvio || null,
      provinciaEnvio: provinciaEnvio || null,
      paisEnvio: paisEnvio || null,
      tipoIva: tipoIva !== undefined && tipoIva !== '' && !isNaN(parseFloat(tipoIva)) ? parseFloat(tipoIva) : 21,
      regimenIva: regimenIva || 'General',
      descuento: descuento !== undefined && descuento !== '' && !isNaN(parseFloat(descuento)) ? parseFloat(descuento) : 0,
      limiteCredito: limiteCredito !== undefined && limiteCredito !== '' && !isNaN(parseFloat(limiteCredito)) ? parseFloat(limiteCredito) : null,
      cuentaContable: cuentaContable || null,
      iban: iban || null,
      diasVencimiento: diasVencimiento !== undefined && diasVencimiento !== '' ? parseInt(diasVencimiento) || 30 : 30,
      agente: agente || null,
      observaciones: observaciones || null,
    };

    // Relaciones opcionales via connect
    if (formaPagoId) data.formaPago = { connect: { id: formaPagoId } };
    if (grupoClienteId) data.grupo = { connect: { id: grupoClienteId } };

    const cliente = await prisma.cliente.create({ data, include: { formaPago: true, grupo: true } });
    res.status(201).json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
export const updateCliente = async (req: Request, res: Response) => {
  try {
    const {
      nombre, nombreComercial, cifNif, tipoCliente,
      email, telefono, movil, fax, web,
      direccion, codigoPostal, ciudad, provincia, pais,
      dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
      formaPagoId, tipoIva, regimenIva, descuento, limiteCredito,
      cuentaContable, iban, diasVencimiento,
      grupoClienteId, agente, observaciones, activo
    } = req.body;

    const data: any = {
      nombre: nombre?.trim(),
      nombreComercial: nombreComercial || null,
      cifNif: cifNif || null,
      tipoCliente,
      email: email || null,
      telefono: telefono || null,
      movil: movil || null,
      fax: fax || null,
      web: web || null,
      direccion: direccion || null,
      codigoPostal: codigoPostal || null,
      ciudad: ciudad || null,
      provincia: provincia || null,
      pais: pais || null,
      dirEnvio: dirEnvio || null,
      cpEnvio: cpEnvio || null,
      ciudadEnvio: ciudadEnvio || null,
      provinciaEnvio: provinciaEnvio || null,
      paisEnvio: paisEnvio || null,
      cuentaContable: cuentaContable || null,
      iban: iban || null,
      agente: agente || null,
      observaciones: observaciones || null,
      activo,
    };

    if (tipoIva !== undefined) data.tipoIva = parseFloat(tipoIva) || 21;
    if (regimenIva !== undefined) data.regimenIva = regimenIva || 'General';
    if (descuento !== undefined) data.descuento = parseFloat(descuento) || 0;
    if (limiteCredito !== undefined) data.limiteCredito = limiteCredito ? parseFloat(limiteCredito) : null;
    if (diasVencimiento !== undefined) data.diasVencimiento = parseInt(diasVencimiento) || 30;

    // Relaciones
    if (formaPagoId) data.formaPago = { connect: { id: formaPagoId } };
    else data.formaPago = { disconnect: true };
    if (grupoClienteId) data.grupo = { connect: { id: grupoClienteId } };
    else data.grupo = { disconnect: true };

    const cliente = await prisma.cliente.update({
      where: { id: req.params.id }, data,
      include: { formaPago: true, grupo: true }
    });
    res.json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
export const deleteCliente = async (req: Request, res: Response) => {
  try {
    const tieneDocumentos = await prisma.factura.count({ where: { clienteId: req.params.id } });
    if (tieneDocumentos > 0) return res.status(400).json({ error: 'No se puede eliminar: el cliente tiene facturas' });
    await prisma.contactoCliente.deleteMany({ where: { clienteId: req.params.id } });
    await prisma.cliente.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── CONTACTOS ────────────────────────────────────────────────────────────────
export const getContactos = async (req: Request, res: Response) => {
  try {
    const contactos = await prisma.contactoCliente.findMany({
      where: { clienteId: req.params.id }, orderBy: { principal: 'desc' }
    });
    res.json(contactos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createContacto = async (req: Request, res: Response) => {
  try {
    const { nombre, cargo, email, telefono, movil, principal = false } = req.body;
    if (principal) {
      await prisma.contactoCliente.updateMany({ where: { clienteId: req.params.id }, data: { principal: false } });
    }
    const contacto = await prisma.contactoCliente.create({
      data: { clienteId: req.params.id, nombre, cargo, email, telefono, movil, principal }
    });
    res.status(201).json(contacto);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deleteContacto = async (req: Request, res: Response) => {
  try {
    await prisma.contactoCliente.delete({ where: { id: req.params.contactoId } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── FACTURAS DEL CLIENTE ────────────────────────────────────────────────────
export const getFacturasCliente = async (req: Request, res: Response) => {
  try {
    const facturas = await prisma.factura.findMany({
      where: { clienteId: req.params.id },
      orderBy: { fecha: 'desc' },
      include: { cobros: { select: { importe: true } } }
    });
    const data = facturas.map(f => ({
      ...f,
      cobrado: f.cobros.reduce((s, c) => s + Number(c.importe), 0),
      pendiente: Number(f.total) - f.cobros.reduce((s, c) => s + Number(c.importe), 0),
    }));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── PEDIDOS DEL CLIENTE ──────────────────────────────────────────────────────
export const getPedidosCliente = async (req: Request, res: Response) => {
  try {
    const pedidos = await prisma.pedidoVenta.findMany({
      where: { clienteId: req.params.id },
      orderBy: { fecha: 'desc' },
      include: { _count: { select: { lineas: true } } }
    });
    res.json(pedidos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── CUENTA CORRIENTE ─────────────────────────────────────────────────────────
export const getCuentaCorriente = async (req: Request, res: Response) => {
  try {
    const facturas = await prisma.factura.findMany({
      where: { clienteId: req.params.id },
      include: { cobros: { select: { importe: true, fecha: true, formaPago: true } } },
      orderBy: { fecha: 'asc' }
    });
    let saldo = 0;
    const movimientos: any[] = [];
    for (const f of facturas) {
      saldo += Number(f.total);
      movimientos.push({ fecha: f.fecha, concepto: `Factura ${f.numeroCompleto}`, cargo: f.total, abono: 0, saldo });
      for (const c of f.cobros) {
        saldo -= Number(c.importe);
        movimientos.push({ fecha: c.fecha, concepto: `Cobro (${c.formaPago})`, cargo: 0, abono: c.importe, saldo });
      }
    }
    res.json({ movimientos, saldoActual: saldo });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── RIESGO / CRÉDITO ─────────────────────────────────────────────────────────
export const getRiesgo = async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) return res.status(404).json({ error: 'No encontrado' });
    const pendiente = await prisma.factura.aggregate({
      _sum: { total: true, totalPagado: true },
      where: { clienteId: req.params.id, estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } }
    });
    const riesgoActual = (Number(pendiente._sum.total) || 0) - (Number(pendiente._sum.totalPagado) || 0);
    await prisma.cliente.update({ where: { id: req.params.id }, data: { riesgoActual } });
    res.json({
      riesgoActual,
      limiteCredito: cliente.limiteCredito,
      disponible: cliente.limiteCredito ? Number(cliente.limiteCredito) - riesgoActual : null,
      porcentaje: cliente.limiteCredito ? (riesgoActual / Number(cliente.limiteCredito)) * 100 : null,
      alerta: cliente.limiteCredito ? riesgoActual > Number(cliente.limiteCredito) * 0.9 : false,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── GRUPOS ───────────────────────────────────────────────────────────────────
export const getGrupos = async (_req: Request, res: Response) => {
  try {
    const grupos = await prisma.grupoCliente.findMany({ include: { _count: { select: { clientes: true } } } });
    res.json(grupos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── FORMAS DE PAGO ───────────────────────────────────────────────────────────
export const getFormasPago = async (_req: Request, res: Response) => {
  try {
    const formas = await prisma.formaPago.findMany({ orderBy: { nombre: 'asc' } });
    res.json(formas);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── PRESUPUESTOS DEL CLIENTE ─────────────────────────────────────────────────
export const getPresupuestosCliente = async (req: Request, res: Response) => {
  try {
    const presupuestos = await prisma.presupuesto.findMany({
      where: { clienteId: req.params.id },
      orderBy: { fecha: 'desc' },
      include: { _count: { select: { lineas: true } } }
    });
    res.json(presupuestos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ALBARANES DEL CLIENTE ───────────────────────────────────────────────────
export const getAlbaranesCliente = async (req: Request, res: Response) => {
  try {
    const albaranes = await prisma.albaranVenta.findMany({
      where: { clienteId: req.params.id },
      orderBy: { fecha: 'desc' },
      include: { _count: { select: { lineas: true } } }
    });
    res.json(albaranes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ACTIVIDAD COMERCIAL ─────────────────────────────────────────────────────
export const getActividadCliente = async (req: Request, res: Response) => {
  try {
    const clienteId = req.params.id;

    const [
      totalFacturado, totalCobrado, numFacturas, numPedidos, numAlbaranes, numPresupuestos,
      ultimaFactura, ultimas5Facturas, ultimos5Pedidos, facturasAnuales
    ] = await Promise.all([
      prisma.factura.aggregate({ _sum: { total: true }, where: { clienteId } }),
      prisma.cobro.aggregate({ _sum: { importe: true }, where: { clienteId } }),
      prisma.factura.count({ where: { clienteId } }),
      prisma.pedidoVenta.count({ where: { clienteId } }),
      prisma.albaranVenta.count({ where: { clienteId } }),
      prisma.presupuesto.count({ where: { clienteId } }),
      prisma.factura.findFirst({ where: { clienteId }, orderBy: { fecha: 'desc' }, select: { fecha: true, numeroCompleto: true, total: true } }),
      prisma.factura.findMany({ where: { clienteId }, orderBy: { fecha: 'desc' }, take: 5, select: { id: true, numeroCompleto: true, fecha: true, total: true, estado: true } }),
      prisma.pedidoVenta.findMany({ where: { clienteId }, orderBy: { fecha: 'desc' }, take: 5, select: { id: true, numero: true, fecha: true, total: true, estado: true } }),
      prisma.factura.findMany({
        where: {
          clienteId,
          fecha: { gte: new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1) },
          estado: { not: 'ANULADA' },
        },
        select: { fecha: true, total: true },
      }),
    ]);

    // Agrupar facturas por mes para gráfico (últimos 12 meses)
    const facturacionMensual: Record<string, number> = {};
    const ahora = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      facturacionMensual[key] = 0;
    }
    for (const f of facturasAnuales) {
      const d = new Date(f.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in facturacionMensual) {
        facturacionMensual[key] = (facturacionMensual[key] || 0) + Number(f.total);
      }
    }

    res.json({
      totalFacturado: totalFacturado._sum.total || 0,
      totalCobrado: totalCobrado._sum.importe || 0,
      pendienteCobro: (Number(totalFacturado._sum.total) || 0) - (Number(totalCobrado._sum.importe) || 0),
      numFacturas,
      numPedidos,
      numAlbaranes,
      numPresupuestos,
      ultimaFactura,
      ultimas5Facturas,
      ultimos5Pedidos,
      facturacionMensual,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── RESUMEN DEL CLIENTE ─────────────────────────────────────────────────────
export const getResumenCliente = async (req: any, res: any) => {
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const facturas = await prisma.factura.findMany({
      where: { clienteId: req.params.id, estado: { not: 'ANULADA' } },
      select: { total: true, totalPagado: true, fecha: true, estado: true }
    });
    const totalFacturado = facturas.reduce((s, f) => s + f.total, 0);
    const pendienteCobro = facturas.reduce((s, f) => s + (f.total - f.totalPagado), 0);
    const numFacturas = facturas.length;
    const ultimaFactura = facturas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

    // Evolución mensual últimos 12 meses
    const hace12meses = new Date(); hace12meses.setMonth(hace12meses.getMonth() - 12);
    const facturasEvol = await prisma.factura.findMany({
      where: { clienteId: req.params.id, fecha: { gte: hace12meses }, estado: { not: 'ANULADA' } },
      select: { fecha: true, total: true }
    });
    const evolucionMensual = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const mes = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
      const mesNum = d.getMonth(); const anio = d.getFullYear();
      const importe = facturasEvol.filter(f => f.fecha.getMonth() === mesNum && f.fecha.getFullYear() === anio).reduce((s, f) => s + f.total, 0);
      evolucionMensual.push({ mes, importe });
    }
    res.json({ totalFacturado, pendienteCobro, numFacturas, ultimaFactura, evolucionMensual });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── VENCIMIENTOS DEL CLIENTE ───────────────────────────────────────────────
export const getVencimientosCliente = async (req: any, res: any) => {
  try {
    const vencimientos = await prisma.vencimiento.findMany({
      where: { factura: { clienteId: req.params.id } },
      include: { factura: { select: { numeroCompleto: true } } },
      orderBy: { fechaVencimiento: 'asc' }
    });
    res.json(vencimientos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ACTIVIDAD (EVENTOS) DEL CLIENTE ────────────────────────────────────────
export const getEventosCliente = async (req: any, res: any) => {
  try {
    const [facturas, cobros, notas] = await Promise.all([
      prisma.factura.findMany({
        where: { clienteId: req.params.id },
        select: { id: true, numeroCompleto: true, fecha: true, total: true, estado: true },
        orderBy: { fecha: 'desc' }, take: 20
      }),
      prisma.cobro.findMany({
        where: { clienteId: req.params.id },
        select: { id: true, fecha: true, importe: true, formaPago: true, factura: { select: { numeroCompleto: true } } },
        orderBy: { fecha: 'desc' }, take: 20
      }),
      prisma.notaCliente.findMany({
        where: { clienteId: req.params.id },
        orderBy: { createdAt: 'desc' }, take: 10
      })
    ]);

    const eventos = [
      ...facturas.map(f => ({ tipo: 'factura', fecha: f.fecha, datos: f })),
      ...cobros.map(c => ({ tipo: 'cobro', fecha: c.fecha, datos: c })),
      ...notas.map(n => ({ tipo: 'nota', fecha: n.createdAt, datos: n })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 50);
    res.json(eventos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── CREAR CONTACTO (con body completo) ─────────────────────────────────────
export const createContactoCompleto = async (req: any, res: any) => {
  try {
    const contacto = await prisma.contactoCliente.create({
      data: { clienteId: req.params.id, ...req.body }
    });
    res.status(201).json(contacto);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ACTUALIZAR CONTACTO ────────────────────────────────────────────────────
export const updateContacto = async (req: any, res: any) => {
  try {
    const contacto = await prisma.contactoCliente.update({
      where: { id: req.params.cid },
      data: req.body
    });
    res.json(contacto);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ELIMINAR CONTACTO POR CID ─────────────────────────────────────────────
export const deleteContactoByCid = async (req: any, res: any) => {
  try {
    await prisma.contactoCliente.delete({ where: { id: req.params.cid } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── CREAR NOTA ─────────────────────────────────────────────────────────────
export const createNota = async (req: any, res: any) => {
  try {
    const nota = await prisma.notaCliente.create({
      data: { clienteId: req.params.id, texto: req.body.texto, tipo: 'MANUAL' }
    });
    res.status(201).json(nota);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── EXPORT CSV ───────────────────────────────────────────────────────────────
export const exportCSV = async (_req: Request, res: Response) => {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { nombre: 'asc' } });
    const headers = ['Código', 'Nombre', 'NIF/CIF', 'Email', 'Teléfono', 'Ciudad', 'Activo', 'Tipo IVA'];
    const rows = clientes.map(c => [
      c.codigo, c.nombre, c.cifNif || '', c.email || '', c.telefono || '',
      c.ciudad || '', c.activo ? 'Sí' : 'No', `${c.tipoIva}%`
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');
    res.send('\uFEFF' + csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
