import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

router.get('/kpis', async (req: AuthRequest, res: Response) => {
  try {
    const ejercicio = req.query.ejercicio ? parseInt(req.query.ejercicio as string) : undefined;
    const hoy = new Date();
    const baseYear = ejercicio || hoy.getFullYear();
    const inicioMes = ejercicio ? new Date(baseYear, 0, 1) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = ejercicio ? new Date(baseYear - 1, 0, 1) : new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = ejercicio ? new Date(baseYear, 0, 0) : new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    const ejercicioFilter = ejercicio ? { fecha: { gte: new Date(baseYear, 0, 1), lt: new Date(baseYear + 1, 0, 1) } } : {};

    const [
      ventasMes,
      ventasMesAnterior,
      facturasPendientes,
      nuevosClientes,
      totalClientes,
      pagosProveedoresAgg,
      facturasVencidasAgg,
    ] = await Promise.all([
      prisma.factura.aggregate({
        where: { fecha: { gte: inicioMes }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
      }),
      prisma.factura.aggregate({
        where: { fecha: { gte: inicioMesAnterior, lte: finMesAnterior }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
      }),
      prisma.factura.aggregate({
        where: { estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] } },
        _sum: { total: true, totalPagado: true },
        _count: true,
      }),
      prisma.cliente.count({ where: { createdAt: { gte: inicioMes } } }),
      prisma.cliente.count({ where: { activo: true } }),
      // Pagos a proveedores pendientes: facturas de compra no pagadas
      prisma.facturaCompra.aggregate({
        where: { estado: { notIn: ['COBRADA', 'ANULADA'] } },
        _sum: { total: true, totalPagado: true },
        _count: true,
      }),
      // Facturas de venta vencidas sin cobrar
      prisma.factura.aggregate({
        where: {
          estado: 'VENCIDA',
        },
        _sum: { total: true, totalPagado: true },
        _count: true,
      }),
    ]);

    const ventasMesVal = ventasMes._sum.total || 0;
    const ventasMesAntVal = ventasMesAnterior._sum.total || 0;
    const varVentas = ventasMesAntVal > 0 ? ((ventasMesVal - ventasMesAntVal) / ventasMesAntVal) * 100 : 0;

    res.json({
      ventasMes: { valor: ventasMesVal, variacion: varVentas, anterior: ventasMesAntVal },
      cobros: {
        pendiente: (facturasPendientes._sum.total || 0) - (facturasPendientes._sum.totalPagado || 0),
        numFacturas: facturasPendientes._count,
      },
      clientes: { total: totalClientes, nuevos: nuevosClientes },
      pagosProveedores: {
        pendiente: (pagosProveedoresAgg._sum.total || 0) - (pagosProveedoresAgg._sum.totalPagado || 0),
        numFacturas: pagosProveedoresAgg._count,
      },
      facturasVencidas: {
        count: facturasVencidasAgg._count,
        importe: (facturasVencidasAgg._sum.total || 0) - (facturasVencidasAgg._sum.totalPagado || 0),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo KPIs' });
  }
});

router.get('/ventas-mensual', async (req: AuthRequest, res: Response) => {
  try {
    const año = parseInt(req.query.ejercicio as string) || parseInt(req.query.año as string) || new Date().getFullYear();
    const facturas = await prisma.factura.findMany({
      where: {
        fecha: { gte: new Date(año, 0, 1), lte: new Date(año, 11, 31) },
        estado: { not: 'ANULADA' },
      },
      select: { fecha: true, total: true },
    });

    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      nombre: new Date(año, i, 1).toLocaleString('es-ES', { month: 'short' }),
      ventas: 0,
    }));

    facturas.forEach(f => { meses[f.fecha.getMonth()].ventas += f.total; });
    res.json(meses);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo ventas mensuales' });
  }
});

router.get('/top-clientes', async (req: AuthRequest, res: Response) => {
  try {
    const ejercicio = req.query.ejercicio ? parseInt(req.query.ejercicio as string) : new Date().getFullYear();
    const inicioAño = new Date(ejercicio, 0, 1);
    const finAño = new Date(ejercicio + 1, 0, 1);
    const resultado = await prisma.factura.groupBy({
      by: ['clienteId'],
      where: { fecha: { gte: inicioAño, lt: finAño }, estado: { not: 'ANULADA' } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    const clienteIds = resultado.map(r => r.clienteId);
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombre: true },
    });

    res.json(resultado.map(r => ({
      clienteId: r.clienteId,
      nombre: clientes.find(c => c.id === r.clienteId)?.nombre || 'Desconocido',
      total: r._sum.total || 0,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo top clientes' });
  }
});

router.get('/alertas', async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    const [stockBajo, facturasVencidas, pedidosPendientesEntrega] = await Promise.all([
      prisma.articulo.findMany({
        where: { controlStock: true, stockActual: { lte: 5 } },
        select: { id: true, referencia: true, nombre: true, stockActual: true, stockMinimo: true },
        take: 10,
      }),
      prisma.factura.findMany({
        where: { estado: 'VENCIDA' },
        include: { cliente: { select: { nombre: true } } },
        orderBy: { fechaVencimiento: 'asc' },
        take: 10,
      }),
      prisma.pedidoVenta.findMany({
        where: { fechaEntrega: { lt: hoy }, estado: { notIn: ['SERVIDO', 'FACTURADO', 'CANCELADO'] } },
        include: { cliente: { select: { nombre: true } } },
        take: 10,
      }),
    ]);
    res.json({ stockBajo, facturasVencidas, pedidosPendientesEntrega });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo alertas' });
  }
});

router.get('/actividad', async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditoriaLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo actividad' });
  }
});

// ── NEW: Últimas facturas ──────────────────────────────────────────────
router.get('/ultimas-facturas', async (req: AuthRequest, res: Response) => {
  try {
    const facturas = await prisma.factura.findMany({
      where: { estado: { not: 'ANULADA' } },
      orderBy: { fecha: 'desc' },
      take: 10,
      select: {
        id: true,
        numeroCompleto: true,
        fecha: true,
        total: true,
        totalPagado: true,
        estado: true,
        fechaVencimiento: true,
        cliente: { select: { nombre: true } },
      },
    });
    res.json(facturas);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo últimas facturas' });
  }
});

// ── NEW: Resumen de tesorería del mes ──────────────────────────────────
router.get('/resumen-tesoreria', async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [cobrosDelMes, pagosDelMes] = await Promise.all([
      // Cobros recibidos este mes
      prisma.cobro.aggregate({
        where: {
          fecha: { gte: inicioMes },
          estado: 'PAGADO',
        },
        _sum: { importe: true },
      }),
      // Pagos a proveedores este mes: diferencia en totalPagado de facturas de compra
      // Usamos las facturas de compra que tienen pagos registrados este mes
      prisma.pago.aggregate({
        where: {
          fecha: { gte: inicioMes },
        },
        _sum: { importe: true },
      }),
    ]);

    const cobros = cobrosDelMes._sum.importe || 0;
    const pagos = pagosDelMes._sum.importe || 0;

    res.json({
      cobrosDelMes: cobros,
      pagosDelMes: pagos,
      saldoMes: cobros - pagos,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo resumen de tesorería' });
  }
});

export default router;
