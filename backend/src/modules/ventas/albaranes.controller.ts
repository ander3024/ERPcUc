import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAlbaranes = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', clienteId = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numero: { contains: search, mode: 'insensitive' } },
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;

    const [data, total] = await Promise.all([
      prisma.albaranVenta.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { nombre: true, cifNif: true } },
          pedido: { select: { numero: true } },
          _count: { select: { lineas: true } }
        }
      }),
      prisma.albaranVenta.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getStats = async (_req: Request, res: Response) => {
  try {
    const [total, pendientes, facturados] = await Promise.all([
      prisma.albaranVenta.count(),
      prisma.albaranVenta.count({ where: { estado: 'PENDIENTE' } }),
      prisma.albaranVenta.count({ where: { estado: 'FACTURADO' } }),
    ]);
    const importe = await prisma.albaranVenta.aggregate({ _sum: { total: true }, where: { estado: 'PENDIENTE' } });
    res.json({ total, pendientes, facturados, importePendiente: importe._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getAlbaran = async (req: Request, res: Response) => {
  try {
    const a = await prisma.albaranVenta.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true, pedido: true,
        lineas: { include: { articulo: { select: { nombre: true, referencia: true } } }, orderBy: { orden: 'asc' } }
      }
    });
    if (!a) return res.status(404).json({ error: 'No encontrado' });
    res.json(a);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createAlbaran = async (req: Request, res: Response) => {
  try {
    const { clienteId, lineas = [], observaciones, pedidoId } = req.body;
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

    const year = new Date().getFullYear();
    const ultimo = await prisma.albaranVenta.findFirst({ orderBy: { numero: 'desc' }, where: { numero: { startsWith: `AV${year}` } } });
    const n = ultimo ? parseInt(ultimo.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
    const numero = `AV${year}-${String(n).padStart(5, '0')}`;

    const albaran = await prisma.albaranVenta.create({
      data: {
        numero, clienteId, pedidoId: pedidoId || null,
        fecha: new Date(), estado: 'PENDIENTE', observaciones,
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasCalc }
      },
      include: { cliente: true, lineas: true }
    });

    // Descontar stock
    for (const l of lineasCalc) {
      if (l.articuloId) {
        const art = await prisma.articulo.findUnique({ where: { id: l.articuloId } });
        await prisma.articulo.update({ where: { id: l.articuloId }, data: { stockActual: { decrement: l.cantidad } } });
        await prisma.movimientoStock.create({
          data: {
            articuloId: l.articuloId, tipo: 'SALIDA_VENTA',
            cantidad: l.cantidad, cantidadAntes: art?.stockActual || 0,
            cantidadDespues: (art?.stockActual || 0) - l.cantidad,
            concepto: `Albarán venta ${numero}`, referencia: numero,
          }
        });
      }
    }

    res.status(201).json(albaran);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updateAlbaran = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.albaranVenta.update({
      where: { id: req.params.id },
      data: { observaciones: req.body.observaciones }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deleteAlbaran = async (req: Request, res: Response) => {
  try {
    const alb = await prisma.albaranVenta.findUnique({ where: { id: req.params.id }, include: { lineas: true } });
    if (!alb) return res.status(404).json({ error: 'No encontrado' });
    if (alb.estado === 'FACTURADO') return res.status(400).json({ error: 'No se puede eliminar un albarán facturado' });

    for (const l of alb.lineas) {
      if (l.articuloId) {
        await prisma.articulo.update({ where: { id: l.articuloId }, data: { stockActual: { increment: l.cantidad } } });
      }
    }
    await prisma.lineaAlbaranVenta.deleteMany({ where: { albaranId: req.params.id } });
    await prisma.albaranVenta.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const convertirAFactura = async (req: Request, res: Response) => {
  try {
    const albaran = await prisma.albaranVenta.findUnique({
      where: { id: req.params.id }, include: { lineas: true, cliente: true }
    });
    if (!albaran) return res.status(404).json({ error: 'No encontrado' });
    if (albaran.estado === 'FACTURADO') return res.status(400).json({ error: 'Ya está facturado' });

    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario autenticado' });

    const config = await prisma.configEmpresa.findFirst();
    const serie = config?.serieFactura || 'F';
    const year = new Date().getFullYear();
    const ultimaFact = await prisma.factura.findFirst({ orderBy: { numero: 'desc' }, where: { serie } });
    const n = ultimaFact ? ultimaFact.numero + 1 : 1;
    const numeroCompleto = `${serie}/${year}/${String(n).padStart(5, '0')}`;

    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 30);

    const factura = await prisma.factura.create({
      data: {
        serie, numero: n, numeroCompleto,
        clienteId: albaran.clienteId, creadorId,
        fecha: new Date(), fechaVencimiento: vencimiento,
        estado: 'EMITIDA',
        baseImponible: albaran.baseImponible,
        totalIva: albaran.totalIva, total: albaran.total,
        lineas: {
          create: albaran.lineas.map((l, i) => ({
            orden: i + 1, articuloId: l.articuloId,
            referencia: l.referencia, descripcion: l.descripcion,
            cantidad: l.cantidad, precioUnitario: Number(l.precioUnitario),
            descuento: Number(l.descuento), tipoIva: Number(l.tipoIva),
            baseLinea: Number(l.baseLinea), ivaLinea: Number(l.ivaLinea), totalLinea: Number(l.totalLinea),
          }))
        }
      },
      include: { cliente: true, lineas: true }
    });

    await prisma.facturaAlbaran.create({ data: { facturaId: factura.id, albaranId: albaran.id } });
    await prisma.albaranVenta.update({ where: { id: req.params.id }, data: { estado: 'FACTURADO', facturado: true } });

    res.json({ factura, message: `Factura ${numeroCompleto} creada correctamente` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
