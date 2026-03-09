import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: siguiente número de documento
const nextNumero = async (serie: string) => {
  const config = await prisma.configEmpresa.findFirst();
  const year = new Date().getFullYear();
  const ultimo = await prisma.presupuesto.findFirst({
    orderBy: { numero: 'desc' },
    where: { numero: { startsWith: `${serie}${year}` } }
  });
  const n = ultimo ? parseInt(ultimo.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
  return `${serie}${year}-${String(n).padStart(5, '0')}`;
};

const calcLineas = (lineas: any[], pctIva: number) => lineas.map((l, i) => {
  const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
  const iva = base * pctIva / 100;
  return {
    orden: i + 1,
    articuloId: l.articuloId || null,
    referencia: l.referencia || null,
    descripcion: l.descripcion || '',
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento || 0),
    tipoIva: pctIva,
    baseLinea: base,
    ivaLinea: iva,
    totalLinea: base + iva,
  };
});

export const getPresupuestos = async (req: Request, res: Response) => {
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
      prisma.presupuesto.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { fecha: 'desc' },
        include: { cliente: { select: { nombre: true, cifNif: true } }, _count: { select: { lineas: true } } }
      }),
      prisma.presupuesto.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getStats = async (_req: Request, res: Response) => {
  try {
    const [total, borrador, enviado, aceptado, rechazado] = await Promise.all([
      prisma.presupuesto.count(),
      prisma.presupuesto.count({ where: { estado: 'BORRADOR' } }),
      prisma.presupuesto.count({ where: { estado: 'ENVIADO' } }),
      prisma.presupuesto.count({ where: { estado: 'ACEPTADO' } }),
      prisma.presupuesto.count({ where: { estado: 'RECHAZADO' } }),
    ]);
    const importe = await prisma.presupuesto.aggregate({
      _sum: { total: true },
      where: { estado: { in: ['BORRADOR', 'ENVIADO'] } }
    });
    res.json({ total, borrador, enviado, aceptado, rechazado, importePendiente: importe._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getPresupuesto = async (req: Request, res: Response) => {
  try {
    const p = await prisma.presupuesto.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        lineas: { include: { articulo: { select: { nombre: true, referencia: true } } }, orderBy: { orden: 'asc' } },
        formaPago: true,
      }
    });
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createPresupuesto = async (req: Request, res: Response) => {
  try {
    const { clienteId, lineas = [], observaciones, validezDias = 30, formaPagoId } = req.body;
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return res.status(400).json({ error: 'Cliente no encontrado' });

    const pctIva = Number(cliente.tipoIva) || 21;
    const lineasCalc = calcLineas(lineas, pctIva);
    const baseImponible = lineasCalc.reduce((s, l) => s + l.baseLinea, 0);
    const totalIva = lineasCalc.reduce((s, l) => s + l.ivaLinea, 0);

    const numero = await nextNumero('PRES');
    const fechaValidez = new Date();
    fechaValidez.setDate(fechaValidez.getDate() + validezDias);

    const presupuesto = await prisma.presupuesto.create({
      data: {
        numero, clienteId,
        fecha: new Date(), fechaValidez,
        estado: 'BORRADOR',
        observaciones, formaPagoId: formaPagoId || cliente.formaPagoId || null,
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasCalc }
      },
      include: { cliente: true, lineas: true }
    });
    res.status(201).json(presupuesto);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updatePresupuesto = async (req: Request, res: Response) => {
  try {
    const { estado, observaciones, fechaValidez } = req.body;
    const updated = await prisma.presupuesto.update({
      where: { id: req.params.id },
      data: { estado, observaciones, fechaValidez: fechaValidez ? new Date(fechaValidez) : undefined }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deletePresupuesto = async (req: Request, res: Response) => {
  try {
    await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoId: req.params.id } });
    await prisma.presupuesto.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const convertirAPedido = async (req: Request, res: Response) => {
  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id: req.params.id },
      include: { lineas: true, cliente: true }
    });
    if (!presupuesto) return res.status(404).json({ error: 'No encontrado' });

    // Obtener creadorId del token
    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario autenticado' });

    const year = new Date().getFullYear();
    const ultimoPedido = await prisma.pedidoVenta.findFirst({ orderBy: { numero: 'desc' }, where: { numero: { startsWith: `PV${year}` } } });
    const n = ultimoPedido ? parseInt(ultimoPedido.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
    const numero = `PV${year}-${String(n).padStart(5, '0')}`;

    const pedido = await prisma.pedidoVenta.create({
      data: {
        numero, clienteId: presupuesto.clienteId,
        presupuestoId: presupuesto.id, creadorId,
        fecha: new Date(), estado: 'PENDIENTE',
        observaciones: presupuesto.observaciones,
        formaPagoId: presupuesto.formaPagoId,
        baseImponible: presupuesto.baseImponible,
        totalIva: presupuesto.totalIva,
        total: presupuesto.total,
        lineas: {
          create: presupuesto.lineas.map((l, i) => ({
            orden: i + 1, articuloId: l.articuloId,
            referencia: l.referencia, descripcion: l.descripcion,
            cantidad: l.cantidad, cantidadServida: 0,
            precioUnitario: l.precioUnitario, descuento: l.descuento,
            tipoIva: l.tipoIva, baseLinea: l.baseLinea,
            ivaLinea: l.ivaLinea, totalLinea: l.totalLinea,
          }))
        }
      },
      include: { cliente: true, lineas: true }
    });

    await prisma.presupuesto.update({ where: { id: req.params.id }, data: { estado: 'ACEPTADO' } });
    res.json({ pedido, message: `Pedido ${numero} creado correctamente` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
