import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFacturas = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', clienteId = '', desde = '', hasta = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numeroCompleto: { contains: search, mode: 'insensitive' } },
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    const [data, total] = await Promise.all([
      prisma.factura.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { nombre: true, cifNif: true } },
          cobros: { select: { importe: true } }
        }
      }),
      prisma.factura.count({ where })
    ]);

    const dataConCobrado = data.map(f => ({
      ...f,
      numero: f.numeroCompleto, // alias para frontend
      cobrado: f.cobros.reduce((s, c) => s + Number(c.importe), 0),
      pendiente: Number(f.total) - f.cobros.reduce((s, c) => s + Number(c.importe), 0),
    }));

    res.json({ data: dataConCobrado, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getStats = async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    // Marcar vencidas automáticamente
    await prisma.factura.updateMany({
      where: { estado: 'EMITIDA', fechaVencimiento: { lt: hoy } },
      data: { estado: 'VENCIDA' }
    });

    const [total, emitidas, cobradas, vencidas, parciales] = await Promise.all([
      prisma.factura.count(),
      prisma.factura.count({ where: { estado: 'EMITIDA' } }),
      prisma.factura.count({ where: { estado: 'COBRADA' } }),
      prisma.factura.count({ where: { estado: 'VENCIDA' } }),
      prisma.factura.count({ where: { estado: 'PARCIALMENTE_COBRADA' } }),
    ]);

    const pendiente = await prisma.factura.aggregate({
      _sum: { total: true },
      where: { estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } }
    });

    const cobradoMes = await prisma.cobro.aggregate({
      _sum: { importe: true },
      where: { fecha: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1) } }
    });

    res.json({ total, emitidas, cobradas, vencidas, parciales, pendienteTotal: pendiente._sum.total || 0, cobradoMes: cobradoMes._sum.importe || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getFactura = async (req: Request, res: Response) => {
  try {
    const f = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        lineas: { include: { articulo: { select: { nombre: true, referencia: true } } }, orderBy: { orden: 'asc' } },
        cobros: true,
        albaranes: { include: { albaran: { select: { numero: true } } } },
        formaPago: true,
      }
    });
    if (!f) return res.status(404).json({ error: 'No encontrado' });
    const cobrado = f.cobros.reduce((s, c) => s + Number(c.importe), 0);
    res.json({ ...f, numero: f.numeroCompleto, cobrado, pendiente: Number(f.total) - cobrado });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createFactura = async (req: Request, res: Response) => {
  try {
    const { clienteId, lineas = [], observaciones, formaPagoId, albaranIds = [] } = req.body;
    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario autenticado' });

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return res.status(400).json({ error: 'Cliente no encontrado' });

    const pctIva = Number(cliente.tipoIva) || 21;
    let baseImponible = 0, totalIva = 0;
    const lineasCalc = lineas.map((l: any, i: number) => {
      const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
      const iva = base * pctIva / 100;
      baseImponible += base; totalIva += iva;
      return {
        orden: i + 1, articuloId: l.articuloId || null,
        referencia: l.referencia || null, descripcion: l.descripcion || '',
        cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario),
        descuento: Number(l.descuento || 0), tipoIva: pctIva,
        baseLinea: base, ivaLinea: iva, totalLinea: base + iva,
      };
    });

    const config = await prisma.configEmpresa.findFirst();
    const serie = config?.serieFactura || 'F';
    const year = new Date().getFullYear();
    const ultimaFact = await prisma.factura.findFirst({ orderBy: { numero: 'desc' }, where: { serie } });
    const n = ultimaFact ? ultimaFact.numero + 1 : 1;
    const numeroCompleto = `${serie}/${year}/${String(n).padStart(5, '0')}`;

    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + (cliente.formaPagoId ? 30 : 0));

    const factura = await prisma.factura.create({
      data: {
        serie, numero: n, numeroCompleto,
        clienteId, creadorId,
        fecha: new Date(), fechaVencimiento: vencimiento,
        estado: 'EMITIDA',
        observaciones, formaPagoId: formaPagoId || cliente.formaPagoId || null,
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasCalc }
      },
      include: { cliente: true, lineas: true }
    });

    for (const albaranId of albaranIds) {
      await prisma.facturaAlbaran.create({ data: { facturaId: factura.id, albaranId } });
      await prisma.albaranVenta.update({ where: { id: albaranId }, data: { estado: 'FACTURADO', facturado: true } });
    }

    res.status(201).json({ ...factura, numero: numeroCompleto });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updateFactura = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: { estado: req.body.estado, observaciones: req.body.observaciones }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deleteFactura = async (req: Request, res: Response) => {
  try {
    const f = await prisma.factura.findUnique({ where: { id: req.params.id }, include: { cobros: true } });
    if (!f) return res.status(404).json({ error: 'No encontrado' });
    if (f.cobros.length > 0) return res.status(400).json({ error: 'No se puede eliminar: tiene cobros registrados' });
    await prisma.facturaAlbaran.deleteMany({ where: { facturaId: req.params.id } });
    await prisma.lineaFactura.deleteMany({ where: { facturaId: req.params.id } });
    await prisma.factura.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
