import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asientoCobro } from '../../services/contabilidad.service';
import { sincronizarVencimientosConCobros } from '../../services/vencimientos.service';

const prisma = new PrismaClient();

export const getCobros = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', facturaId = '', search = '', ejercicio = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (facturaId) where.facturaId = facturaId;
    if (ejercicio) { const y = parseInt(ejercicio); where.fecha = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }; }
    if (search) {
      where.factura = {
        OR: [
          { numeroCompleto: { contains: search, mode: 'insensitive' } },
          { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      prisma.cobro.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: { factura: { select: { numeroCompleto: true, cliente: { select: { nombre: true } } } } }
      }),
      prisma.cobro.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getCobro = async (req: Request, res: Response) => {
  try {
    const cobro = await prisma.cobro.findUnique({
      where: { id: req.params.id },
      include: {
        factura: {
          select: {
            numeroCompleto: true, total: true, totalPagado: true,
            cliente: { select: { nombre: true, cifNif: true } }
          }
        },
        cliente: { select: { nombre: true } }
      }
    });
    if (!cobro) return res.status(404).json({ error: 'No encontrado' });
    res.json(cobro);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getCobrosPendientes = async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    // Actualizar vencidas
    await prisma.factura.updateMany({
      where: { estado: 'EMITIDA', fechaVencimiento: { lt: hoy } },
      data: { estado: 'VENCIDA' }
    });

    const facturas = await prisma.factura.findMany({
      where: { estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] } },
      include: {
        cliente: { select: { nombre: true } },
        cobros: { select: { importe: true } }
      },
      orderBy: { fechaVencimiento: 'asc' }
    });

    const pendientes = facturas.map(f => {
      const cobrado = f.cobros.reduce((s, c) => s + Number(c.importe), 0);
      const pendiente = Number(f.total) - cobrado;
      return { ...f, numero: f.numeroCompleto, cobrado, pendiente };
    }).filter(f => f.pendiente > 0.01);

    res.json(pendientes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getCobrosStats = async (_req: Request, res: Response) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const [total, totalImporte, mesImporte, facturasCobradas] = await Promise.all([
      prisma.cobro.count(),
      prisma.cobro.aggregate({ _sum: { importe: true } }),
      prisma.cobro.aggregate({ _sum: { importe: true }, where: { fecha: { gte: inicioMes } } }),
      prisma.factura.count({ where: { estado: 'COBRADA' } }),
    ]);
    res.json({
      total,
      totalCobrado: totalImporte._sum.importe || 0,
      totalMes: mesImporte._sum.importe || 0,
      facturasCobradas,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createCobro = async (req: Request, res: Response) => {
  try {
    const { facturaId, importe, fecha, formaPago, observaciones } = req.body;
    const factura = await prisma.factura.findUnique({
      where: { id: facturaId },
      include: { cobros: true }
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const cobrado = factura.cobros.reduce((s, c) => s + Number(c.importe), 0);
    const nuevoCobrado = cobrado + Number(importe);
    const total = Number(factura.total);

    if (nuevoCobrado > total + 0.01) {
      return res.status(400).json({ error: `El importe supera el pendiente (${(total - cobrado).toFixed(2)} €)` });
    }

    const cobro = await prisma.cobro.create({
      data: {
        facturaId,
        clienteId: factura.clienteId, // requerido por schema
        importe: Number(importe),
        fecha: fecha ? new Date(fecha) : new Date(),
        formaPago: formaPago || 'Transferencia',
        observaciones
      }
    });

    // Actualizar estado factura
    if (nuevoCobrado >= total - 0.01) {
      await prisma.factura.update({ where: { id: facturaId }, data: { estado: 'COBRADA', totalPagado: total } });
    } else {
      await prisma.factura.update({ where: { id: facturaId }, data: { estado: 'PARCIALMENTE_COBRADA', totalPagado: nuevoCobrado } });
    }

    // Sincronizar vencimientos con cobros
    await sincronizarVencimientosConCobros(facturaId);

    // Asiento contable automático
    const userId = (req as any).user?.id || 'system';
    asientoCobro({ importe: Number(importe), formaPago: formaPago || 'Transferencia', facturaId }, factura.numeroCompleto, userId).catch(() => {});

    res.status(201).json(cobro);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updateCobro = async (req: Request, res: Response) => {
  try {
    const cobro = await prisma.cobro.findUnique({ where: { id: req.params.id } });
    if (!cobro) return res.status(404).json({ error: 'No encontrado' });

    const data: any = {};
    if (req.body.importe !== undefined) data.importe = Number(req.body.importe);
    if (req.body.fecha !== undefined) data.fecha = new Date(req.body.fecha);
    if (req.body.formaPago !== undefined) data.formaPago = req.body.formaPago;
    if (req.body.estado !== undefined) data.estado = req.body.estado;
    if (req.body.referencia !== undefined) data.referencia = req.body.referencia;
    if (req.body.observaciones !== undefined) data.observaciones = req.body.observaciones;

    const updated = await prisma.cobro.update({ where: { id: req.params.id }, data });

    // Recalculate factura totals
    const cobros = await prisma.cobro.findMany({ where: { facturaId: cobro.facturaId } });
    const totalPagado = cobros.reduce((s, c) => s + Number(c.importe), 0);
    const factura = await prisma.factura.findUnique({ where: { id: cobro.facturaId } });
    const estado = totalPagado <= 0 ? 'EMITIDA' : totalPagado < Number(factura?.total) ? 'PARCIALMENTE_COBRADA' : 'COBRADA';
    await prisma.factura.update({ where: { id: cobro.facturaId }, data: { estado, totalPagado } });

    // Sincronizar vencimientos
    await sincronizarVencimientosConCobros(cobro.facturaId);

    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deleteCobro = async (req: Request, res: Response) => {
  try {
    const cobro = await prisma.cobro.findUnique({ where: { id: req.params.id } });
    if (!cobro) return res.status(404).json({ error: 'No encontrado' });
    await prisma.cobro.delete({ where: { id: req.params.id } });

    // Recalcular totalPagado y estado
    const cobros = await prisma.cobro.findMany({ where: { facturaId: cobro.facturaId } });
    const totalPagado = cobros.reduce((s, c) => s + Number(c.importe), 0);
    const factura = await prisma.factura.findUnique({ where: { id: cobro.facturaId } });
    const estado = totalPagado <= 0 ? 'EMITIDA' : totalPagado < Number(factura?.total) ? 'PARCIALMENTE_COBRADA' : 'COBRADA';
    await prisma.factura.update({ where: { id: cobro.facturaId }, data: { estado, totalPagado } });

    // Sincronizar vencimientos
    await sincronizarVencimientosConCobros(cobro.facturaId);

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
