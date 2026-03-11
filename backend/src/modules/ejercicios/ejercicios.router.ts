import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

// ── Helper: date range for a fiscal year ──
export function ejercicioDateFilter(anio: number) {
  return { gte: new Date(anio, 0, 1), lt: new Date(anio + 1, 0, 1) };
}

// ── Helper: add ejercicio filter to a where clause ──
export function addEjercicioFilter(where: any, ejercicio: string | undefined) {
  if (!ejercicio) return;
  const year = parseInt(ejercicio);
  if (isNaN(year)) return;
  where.fecha = { ...(where.fecha || {}), ...ejercicioDateFilter(year) };
}

// GET /api/ejercicios — List all
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const ejercicios = await prisma.ejercicioFiscal.findMany({ orderBy: { anio: 'desc' } });
    res.json(ejercicios);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/ejercicios — Create new
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { anio, notas } = req.body;
    const year = anio || new Date().getFullYear() + 1;
    const existing = await prisma.ejercicioFiscal.findUnique({ where: { anio: year } });
    if (existing) return res.status(400).json({ error: `El ejercicio ${year} ya existe` });
    const ejercicio = await prisma.ejercicioFiscal.create({
      data: { anio: year, fechaInicio: new Date(year, 0, 1), fechaFin: new Date(year, 11, 31, 23, 59, 59), estado: 'ABIERTO', notas },
    });
    res.status(201).json(ejercicio);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/ejercicios/activo — Get current active
router.get('/activo', async (_req: AuthRequest, res: Response) => {
  try {
    let ejercicio = await prisma.ejercicioFiscal.findFirst({ where: { estado: 'ABIERTO' }, orderBy: { anio: 'desc' } });
    if (!ejercicio) {
      const y = new Date().getFullYear();
      ejercicio = await prisma.ejercicioFiscal.upsert({
        where: { anio: y },
        create: { anio: y, fechaInicio: new Date(y, 0, 1), fechaFin: new Date(y, 11, 31, 23, 59, 59), estado: 'ABIERTO' },
        update: {},
      });
    }
    res.json(ejercicio);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/ejercicios/:id/activar — Set as active (just returns it; frontend stores in localStorage)
router.put('/:id/activar', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const ejercicio = await prisma.ejercicioFiscal.findUnique({ where: { id } });
    if (!ejercicio) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    res.json(ejercicio);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/ejercicios/:id/cerrar — Close fiscal year
router.put('/:id/cerrar', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const ejercicio = await prisma.ejercicioFiscal.findUnique({ where: { id } });
    if (!ejercicio) return res.status(404).json({ error: 'Ejercicio no encontrado' });
    if (ejercicio.estado === 'CERRADO') return res.status(400).json({ error: 'El ejercicio ya está cerrado' });

    const dateRange = ejercicioDateFilter(ejercicio.anio);

    // Check for draft invoices
    const borradores = await prisma.factura.count({ where: { fecha: dateRange, estado: 'BORRADOR' } });
    if (borradores > 0 && !req.body.forzar) {
      return res.status(400).json({ error: `Hay ${borradores} facturas en borrador sin emitir`, borradores, requiereForzar: true });
    }

    const userId = (req as any).user?.id;

    // Mark as EN_CIERRE
    await prisma.ejercicioFiscal.update({ where: { id }, data: { estado: 'EN_CIERRE' } });

    // Generate closing summary
    const [ventasAgg, comprasAgg, cobrosAgg, pagosAgg] = await Promise.all([
      prisma.factura.aggregate({ where: { fecha: dateRange, estado: { not: 'ANULADA' } }, _sum: { total: true } }),
      prisma.facturaCompra.aggregate({ where: { fecha: dateRange }, _sum: { total: true } }),
      prisma.cobro.aggregate({ where: { fecha: dateRange }, _sum: { importe: true } }),
      prisma.pago.aggregate({ where: { fecha: dateRange }, _sum: { importe: true } }),
    ]);

    const totalIngresos = ventasAgg._sum.total || 0;
    const totalGastos = comprasAgg._sum.total || 0;
    const resultado = totalIngresos - totalGastos;

    // Try to create contable closing entry
    try {
      const lastAsiento = await prisma.asientoContable.findFirst({
        where: { ejercicio: ejercicio.anio },
        orderBy: { numero: 'desc' },
      });
      const nextNum = (lastAsiento?.numero || 0) + 1;

      // Create cierre entry in CierreEjercicio
      await prisma.cierreEjercicio.upsert({
        where: { ejercicio: ejercicio.anio },
        create: {
          ejercicio: ejercicio.anio,
          totalIngresos, totalGastos, resultado,
          usuarioId: userId,
          observaciones: `Cierre automático del ejercicio ${ejercicio.anio}`,
        },
        update: { totalIngresos, totalGastos, resultado, usuarioId: userId },
      });

      // Create accounting entry for closure
      await prisma.asientoContable.create({
        data: {
          numero: nextNum,
          ejercicio: ejercicio.anio,
          fecha: new Date(ejercicio.anio, 11, 31),
          concepto: `Asiento de cierre ejercicio ${ejercicio.anio}`,
          diario: 'CIERRE',
          creadorId: userId,
          lineas: { create: [] },
        },
      });
    } catch { /* contabilidad entry optional */ }

    // Mark as CERRADO
    const updated = await prisma.ejercicioFiscal.update({
      where: { id },
      data: { estado: 'CERRADO', fechaCierre: new Date(), usuarioCierreId: userId },
    });

    // Auto-create next year if doesn't exist
    const nextYear = ejercicio.anio + 1;
    await prisma.ejercicioFiscal.upsert({
      where: { anio: nextYear },
      create: { anio: nextYear, fechaInicio: new Date(nextYear, 0, 1), fechaFin: new Date(nextYear, 11, 31, 23, 59, 59), estado: 'ABIERTO' },
      update: {},
    });

    res.json({ ...updated, resumen: { totalIngresos, totalGastos, resultado } });
  } catch (e: any) {
    // Rollback to ABIERTO on error
    try { await prisma.ejercicioFiscal.update({ where: { id: parseInt(req.params.id) }, data: { estado: 'ABIERTO' } }); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ejercicios/:anio/resumen — KPIs for a year
router.get('/:anio/resumen', async (req: AuthRequest, res: Response) => {
  try {
    const anio = parseInt(req.params.anio);
    if (isNaN(anio)) return res.status(400).json({ error: 'Año inválido' });
    const dateRange = ejercicioDateFilter(anio);

    const [ventasAgg, comprasAgg, facturasCount, facturasCompraCount, cobrosAgg, pagosAgg, presupuestosCount, pedidosCount, borradores] = await Promise.all([
      prisma.factura.aggregate({ where: { fecha: dateRange, estado: { not: 'ANULADA' } }, _sum: { total: true } }),
      prisma.facturaCompra.aggregate({ where: { fecha: dateRange }, _sum: { total: true } }),
      prisma.factura.count({ where: { fecha: dateRange, estado: { not: 'ANULADA' } } }),
      prisma.facturaCompra.count({ where: { fecha: dateRange } }),
      prisma.cobro.aggregate({ where: { fecha: dateRange }, _sum: { importe: true } }),
      prisma.pago.aggregate({ where: { fecha: dateRange }, _sum: { importe: true } }),
      prisma.presupuesto.count({ where: { fecha: dateRange } }),
      prisma.pedidoVenta.count({ where: { fecha: dateRange } }),
      prisma.factura.count({ where: { fecha: dateRange, estado: 'BORRADOR' } }),
    ]);

    const totalVentas = ventasAgg._sum.total || 0;
    const totalCompras = comprasAgg._sum.total || 0;
    const totalCobros = cobrosAgg._sum.importe || 0;
    const totalPagos = pagosAgg._sum.importe || 0;

    // Previous year comparison
    const prevRange = ejercicioDateFilter(anio - 1);
    const [ventasPrev, comprasPrev] = await Promise.all([
      prisma.factura.aggregate({ where: { fecha: prevRange, estado: { not: 'ANULADA' } }, _sum: { total: true } }),
      prisma.facturaCompra.aggregate({ where: { fecha: prevRange }, _sum: { total: true } }),
    ]);

    res.json({
      anio,
      ventas: totalVentas,
      compras: totalCompras,
      resultado: totalVentas - totalCompras,
      cobros: totalCobros,
      pagos: totalPagos,
      numFacturasVenta: facturasCount,
      numFacturasCompra: facturasCompraCount,
      numPresupuestos: presupuestosCount,
      numPedidos: pedidosCount,
      cobrosPendientes: totalVentas - totalCobros,
      pagosPendientes: totalCompras - totalPagos,
      borradores,
      comparativa: {
        ventasAnterior: ventasPrev._sum.total || 0,
        comprasAnterior: comprasPrev._sum.total || 0,
        resultadoAnterior: (ventasPrev._sum.total || 0) - (comprasPrev._sum.total || 0),
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
