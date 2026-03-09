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
      _sum: { total: true },
      where: { estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } }
    });
    res.json({ total, activos, inactivos: total - activos, nuevosHoy, pendienteTotal: pendiente._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────
export const getClientes = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', activo = '', grupoId = '', tipoIva = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { nombreComercial: { contains: search, mode: 'insensitive' } },
      { cifNif: { contains: search, mode: 'insensitive' } },
      { codigo: { contains: search, mode: 'insensitive' } },
    ];
    if (activo !== '') where.activo = activo === 'true';
    if (grupoId) where.grupoClienteId = grupoId;
    if (tipoIva) where.tipoIva = parseFloat(tipoIva);

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
      email, telefono, movil, web,
      direccion, codigoPostal, ciudad, provincia, pais = 'ES',
      dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
      formaPagoId, tipoIva = 21, descuento = 0, limiteCredito,
      cuentaContable, grupoClienteId, agente, observaciones
    } = req.body;

    // Generar código automático
    const ultimo = await prisma.cliente.findFirst({ orderBy: { codigo: 'desc' }, where: { codigo: { startsWith: 'C' } } });
    const n = ultimo ? parseInt(ultimo.codigo.replace(/\D/g, '')) + 1 : 1;
    const codigo = `C${String(n).padStart(5, '0')}`;

    const cliente = await prisma.cliente.create({
      data: {
        codigo, nombre, nombreComercial, cifNif, tipoCliente,
        email, telefono, movil, web,
        direccion, codigoPostal, ciudad, provincia, pais,
        dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
        formaPagoId: formaPagoId || null,
        tipoIva: parseFloat(tipoIva), descuento: parseFloat(descuento),
        limiteCredito: limiteCredito ? parseFloat(limiteCredito) : null,
        cuentaContable, grupoClienteId: grupoClienteId || null,
        agente, observaciones
      }
    });
    res.status(201).json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
export const updateCliente = async (req: Request, res: Response) => {
  try {
    const {
      nombre, nombreComercial, cifNif, tipoCliente,
      email, telefono, movil, web,
      direccion, codigoPostal, ciudad, provincia, pais,
      dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
      formaPagoId, tipoIva, descuento, limiteCredito,
      cuentaContable, grupoClienteId, agente, observaciones, activo
    } = req.body;

    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: {
        nombre, nombreComercial, cifNif, tipoCliente,
        email, telefono, movil, web,
        direccion, codigoPostal, ciudad, provincia, pais,
        dirEnvio, cpEnvio, ciudadEnvio, provinciaEnvio, paisEnvio,
        formaPagoId: formaPagoId || null,
        tipoIva: tipoIva !== undefined ? parseFloat(tipoIva) : undefined,
        descuento: descuento !== undefined ? parseFloat(descuento) : undefined,
        limiteCredito: limiteCredito !== undefined ? parseFloat(limiteCredito) : undefined,
        cuentaContable, grupoClienteId: grupoClienteId || null,
        agente, observaciones, activo
      }
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
    const contactos = await prisma.contactoCliente.findMany({ where: { clienteId: req.params.id }, orderBy: { principal: 'desc' } });
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
      numero: f.numeroCompleto,
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
        movimientos.push({ fecha: c.fecha, concepto: `Cobro ${f.numeroCompleto} (${c.formaPago})`, cargo: 0, abono: c.importe, saldo });
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
      _sum: { total: true },
      where: { clienteId: req.params.id, estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } }
    });
    const riesgoActual = pendiente._sum.total || 0;
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
