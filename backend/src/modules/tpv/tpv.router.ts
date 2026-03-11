import { getIO } from '../../config/socket';
import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';


const router = Router();

// POST /tpv/caja/abrir
router.post('/caja/abrir', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, fondoInicial } = req.body;

    const cajaExistente = await prisma.cajaTPV.findFirst({
      where: { cajeroId: req.user!.id, estado: 'ABIERTA' },
    });
    if (cajaExistente) return res.status(400).json({ error: 'Ya tienes una caja abierta' });

    const caja = await prisma.cajaTPV.create({
      data: {
        nombre: nombre || `Caja ${req.user!.nombre}`,
        cajeroId: req.user!.id,
        estado: 'ABIERTA',
        apertura: new Date(),
        fondoInicial: fondoInicial || 0,
      },
    });

    getIO().to('empresa').emit('tpv:caja-abierta', { cajaId: caja.id, cajero: req.user!.nombre });
    res.status(201).json(caja);
  } catch (error) {
    res.status(500).json({ error: 'Error abriendo caja' });
  }
});

// POST /tpv/caja/:id/cerrar
router.post('/caja/:id/cerrar', async (req: AuthRequest, res: Response) => {
  try {
    const { cierreReal } = req.body;

    const caja = await prisma.cajaTPV.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { tickets: true } },
      },
    });

    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
    if (caja.estado !== 'ABIERTA') return res.status(400).json({ error: 'La caja no está abierta' });

    const diferencia = cierreReal ? cierreReal - caja.totalEfectivo : null;

    const cajaCerrada = await prisma.cajaTPV.update({
      where: { id: req.params.id },
      data: {
        estado: 'CERRADA',
        cierre: new Date(),
        cierreReal,
        diferencia,
      },
    });

    res.json(cajaCerrada);
  } catch (error) {
    res.status(500).json({ error: 'Error cerrando caja' });
  }
});

// GET /tpv/caja/activa
router.get('/caja/activa', async (req: AuthRequest, res: Response) => {
  try {
    const caja = await prisma.cajaTPV.findFirst({
      where: { cajeroId: req.user!.id, estado: 'ABIERTA' },
      include: { _count: { select: { tickets: true } } },
    });
    res.json(caja);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo caja' });
  }
});

// POST /tpv/ticket
router.post('/ticket', async (req: AuthRequest, res: Response) => {
  try {
    const { cajaId, clienteId, lineas, formaPago, efectivo } = req.body;

    const caja = await prisma.cajaTPV.findUnique({ where: { id: cajaId } });
    if (!caja || caja.estado !== 'ABIERTA') {
      return res.status(400).json({ error: 'Caja no disponible' });
    }

    // Calcular totales
    let baseImponible = 0, totalIva = 0;
    const lineasCalc = lineas.map((l: any) => {
      const base = l.cantidad * l.precioUnitario * (1 - (l.descuento || 0) / 100);
      const iva = base * (l.tipoIva / 100);
      baseImponible += base;
      totalIva += iva;
      return { ...l, baseLinea: base, ivaLinea: iva, totalLinea: base + iva };
    });
    const total = baseImponible + totalIva;
    const cambio = formaPago === 'EFECTIVO' && efectivo ? efectivo - total : 0;

    // Número de ticket
    const numTickets = await prisma.ticketTPV.count();
    const numero = `T${String(numTickets + 1).padStart(8, '0')}`;

    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.ticketTPV.create({
        data: {
          numero,
          cajaId,
          cajeroId: req.user!.id,
          clienteId,
          baseImponible,
          totalIva,
          total,
          formaPago,
          efectivo,
          cambio: cambio > 0 ? cambio : null,
          lineas: { create: lineasCalc },
        },
        include: { lineas: true },
      });

      // Actualizar totales de caja
      const updateCaja: any = { totalVentas: { increment: total } };
      if (formaPago === 'EFECTIVO') updateCaja.totalEfectivo = { increment: total };
      else if (formaPago === 'TARJETA') updateCaja.totalTarjeta = { increment: total };
      else if (formaPago === 'TRANSFERENCIA') updateCaja.totalTransf = { increment: total };
      await tx.cajaTPV.update({ where: { id: cajaId }, data: updateCaja });

      // Actualizar stock
      for (const linea of lineasCalc) {
        if (linea.articuloId) {
          const art = await tx.articulo.findUnique({ where: { id: linea.articuloId } });
          if (art) {
            await tx.articulo.update({
              where: { id: linea.articuloId },
              data: { stockActual: { decrement: linea.cantidad } },
            });
            await tx.movimientoStock.create({
              data: {
                articuloId: linea.articuloId,
                tipo: 'SALIDA_VENTA',
                cantidad: -linea.cantidad,
                cantidadAntes: art.stockActual,
                cantidadDespues: art.stockActual - linea.cantidad,
                referencia: numero,
                concepto: `Venta TPV ${numero}`,
              },
            });
          }
        }
      }

      return t;
    });

    getIO().to(`tpv:${cajaId}`).emit('tpv:ticket', { id: ticket.id, numero, total });
    res.status(201).json({ ...ticket, cambio });
  } catch (error) {
    res.status(500).json({ error: 'Error creando ticket' });
  }
});

// GET /tpv/tickets
router.get('/tickets', async (req: AuthRequest, res: Response) => {
  try {
    const { cajaId, desde, hasta, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (cajaId) where.cajaId = cajaId;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde as string);
      if (hasta) where.fecha.lte = new Date(hasta as string);
    }

    const [tickets, total] = await Promise.all([
      prisma.ticketTPV.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { fecha: 'desc' },
        include: {
          cajero: { select: { nombre: true } },
          _count: { select: { lineas: true } },
        },
      }),
      prisma.ticketTPV.count({ where }),
    ]);

    res.json({ data: tickets, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo tickets' });
  }
});

// GET /tpv/articulos-rapidos
router.get('/articulos-rapidos', async (req: AuthRequest, res: Response) => {
  try {
    const { search, familiaId } = req.query;
    const where: any = { activo: true };
    if (familiaId) where.familiaId = familiaId;
    if (search) {
      where.OR = [
        { nombre: { contains: search as string, mode: 'insensitive' } },
        { referencia: { contains: search as string, mode: 'insensitive' } },
        { codigoBarras: { contains: search as string } },
      ];
    }

    const articulos = await prisma.articulo.findMany({
      where,
      take: 20,
      select: {
        id: true, referencia: true, nombre: true,
        precioVenta: true, tipoIva: true, stockActual: true,
        imagen: true, codigoBarras: true,
        familia: { select: { nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json(articulos);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículos' });
  }
});

// GET /tpv/ventas-hoy
router.get('/ventas-hoy', async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const tickets = await prisma.ticketTPV.findMany({
      where: { fecha: { gte: hoy }, estado: 'COBRADO' },
      select: { total: true, formaPago: true },
    });

    const totalVentas = tickets.reduce((s, t) => s + Number(t.total), 0);
    const numTickets = tickets.length;
    const porMetodo: Record<string, { count: number; total: number }> = {};
    for (const t of tickets) {
      if (!porMetodo[t.formaPago]) porMetodo[t.formaPago] = { count: 0, total: 0 };
      porMetodo[t.formaPago].count++;
      porMetodo[t.formaPago].total += Number(t.total);
    }

    res.json({ totalVentas, numTickets, porMetodo });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo resumen del día' });
  }
});

// GET /tpv/familias
router.get('/familias', async (_req: AuthRequest, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, _count: { select: { articulos: true } } },
    });
    res.json(familias);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo familias' });
  }
});

export default router;
