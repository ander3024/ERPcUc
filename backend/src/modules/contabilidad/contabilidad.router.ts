import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Resumen contable
router.get('/resumen', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const inicio = new Date(ejercicio, 0, 1);
    const fin = new Date(ejercicio, 11, 31, 23, 59, 59);

    const [asientos, cuentas, ventas, compras] = await Promise.all([
      prisma.asientoContable.count({ where: { ejercicio } }),
      prisma.cuentaContable.count({ where: { activa: true } }),
      prisma.factura.aggregate({ _sum: { total: true }, where: { fecha: { gte: inicio, lte: fin }, estado: { not: 'ANULADA' } } }),
      prisma.facturaCompra.aggregate({ _sum: { total: true }, where: { fecha: { gte: inicio, lte: fin } } }).catch(() => ({ _sum: { total: 0 } })),
    ]);

    const totalVentas = ventas._sum.total || 0;
    const totalCompras = compras._sum.total || 0;

    res.json({
      ejercicio,
      numAsientos: asientos,
      numCuentas: cuentas,
      totalVentas,
      totalCompras,
      resultado: totalVentas - totalCompras,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Balance de sumas y saldos
router.get('/balance-sumas-saldos', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const inicio = new Date(ejercicio, 0, 1);
    const fin = new Date(ejercicio, 11, 31, 23, 59, 59);

    const cuentas = await prisma.cuentaContable.findMany({
      where: { activa: true, nivel: { lte: 3 } },
      orderBy: { codigo: 'asc' },
    });

    const lineas = await prisma.asientoLinea.findMany({
      where: { asiento: { ejercicio, fecha: { gte: inicio, lte: fin } } },
      include: { cuentaDebe: true, cuentaHaber: true },
    });

    const movimientos: Record<string, { debe: number; haber: number }> = {};
    lineas.forEach(l => {
      if (l.cuentaDebeId) {
        if (!movimientos[l.cuentaDebeId]) movimientos[l.cuentaDebeId] = { debe: 0, haber: 0 };
        movimientos[l.cuentaDebeId].debe += Number(l.debe || 0);
      }
      if (l.cuentaHaberId) {
        if (!movimientos[l.cuentaHaberId]) movimientos[l.cuentaHaberId] = { debe: 0, haber: 0 };
        movimientos[l.cuentaHaberId].haber += Number(l.haber || 0);
      }
    });

    const resultado = cuentas.map(c => {
      const mov = movimientos[c.id] || { debe: 0, haber: 0 };
      const saldo = mov.debe - mov.haber;
      return { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, nivel: c.nivel, debe: mov.debe, haber: mov.haber, saldoDebe: saldo > 0 ? saldo : 0, saldoHaber: saldo < 0 ? -saldo : 0 };
    }).filter(c => c.debe > 0 || c.haber > 0);

    res.json({ ejercicio, cuentas: resultado });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cuenta de resultados
router.get('/cuenta-resultados', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const inicio = new Date(ejercicio, 0, 1);
    const fin = new Date(ejercicio, 11, 31, 23, 59, 59);

    // Ingresos por mes (facturas de venta)
    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: { not: 'ANULADA' } },
      select: { fecha: true, baseImponible: true, total: true },
    });

    const compras = await prisma.facturaCompra.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
      select: { fecha: true, baseImponible: true, total: true },
    }).catch(() => [] as any[]);

    const porMes: Record<number, { ingresos: number; gastos: number }> = {};
    for (let i = 0; i < 12; i++) porMes[i] = { ingresos: 0, gastos: 0 };

    facturas.forEach(f => { const m = new Date(f.fecha).getMonth(); porMes[m].ingresos += Number(f.baseImponible || 0); });
    compras.forEach(c => { const m = new Date(c.fecha).getMonth(); porMes[m].gastos += Number(c.baseImponible || 0); });

    const meses = Object.entries(porMes).map(([mes, v]) => ({ mes: parseInt(mes), ...v, resultado: v.ingresos - v.gastos }));
    const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0);
    const totalGastos = meses.reduce((s, m) => s + m.gastos, 0);

    res.json({ ejercicio, meses, totalIngresos, totalGastos, resultado: totalIngresos - totalGastos });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Asientos - listado
router.get('/asientos', async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const search = (req.query.search as string) || '';

    const where: any = { ejercicio };
    if (search) where.concepto = { contains: search, mode: 'insensitive' };

    const [total, data] = await Promise.all([
      prisma.asientoContable.count({ where }),
      prisma.asientoContable.findMany({
        where, orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
        skip: (page - 1) * limit, take: limit,
        include: { lineas: { include: { cuentaDebe: true, cuentaHaber: true } }, creador: { select: { nombre: true } } },
      }),
    ]);

    res.json({ data, pagination: { page, total, pages: Math.ceil(total / limit), limit } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Asiento - detalle
router.get('/asientos/:id', async (req: any, res: Response) => {
  try {
    const asiento = await prisma.asientoContable.findUnique({
      where: { id: req.params.id },
      include: { lineas: { include: { cuentaDebe: true, cuentaHaber: true }, orderBy: { orden: 'asc' } }, creador: { select: { nombre: true } } },
    });
    if (!asiento) return res.status(404).json({ error: 'No encontrado' });
    res.json(asiento);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cuentas contables
router.get('/cuentas', async (req: any, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const tipo = (req.query.tipo as string) || '';
    const where: any = { activa: true };
    if (search) where.OR = [{ codigo: { contains: search } }, { nombre: { contains: search, mode: 'insensitive' } }];
    if (tipo) where.tipo = tipo;
    const cuentas = await prisma.cuentaContable.findMany({ where, orderBy: { codigo: 'asc' }, take: 200 });
    res.json(cuentas);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Crear cuenta contable
router.post('/cuentas', async (req: any, res: Response) => {
  try {
    const { codigo, nombre, tipo, nivel, padre } = req.body;
    const cuenta = await prisma.cuentaContable.create({ data: { codigo, nombre, tipo, nivel: nivel || 1, padre } });
    res.json(cuenta);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Editar cuenta
router.put('/cuentas/:id', async (req: any, res: Response) => {
  try {
    const cuenta = await prisma.cuentaContable.update({ where: { id: req.params.id }, data: req.body });
    res.json(cuenta);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Crear asiento
router.post('/asientos', async (req: any, res: Response) => {
  try {
    const { fecha, concepto, diario, ejercicio, lineas } = req.body;
    const ej = ejercicio || new Date(fecha).getFullYear();
    const lastAsiento = await prisma.asientoContable.findFirst({ where: { ejercicio: ej }, orderBy: { numero: 'desc' } });
    const numero = (lastAsiento?.numero || 0) + 1;

    const asiento = await prisma.asientoContable.create({
      data: {
        numero, ejercicio: ej, fecha: new Date(fecha), concepto, diario: diario || 'DIARIO', creadorId: req.user?.id || req.userId,
        lineas: { create: lineas.map((l: any, i: number) => ({ orden: i + 1, concepto: l.concepto || concepto, cuentaDebeId: l.cuentaDebeId || null, cuentaHaberId: l.cuentaHaberId || null, debe: l.debe || 0, haber: l.haber || 0 })) },
      },
      include: { lineas: { include: { cuentaDebe: true, cuentaHaber: true } } },
    });
    res.json(asiento);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Editar asiento
router.put('/asientos/:id', async (req: any, res: Response) => {
  try {
    const { concepto, fecha, diario, lineas } = req.body;
    const data: any = {};
    if (concepto) data.concepto = concepto;
    if (fecha) data.fecha = new Date(fecha);
    if (diario) data.diario = diario;
    if (lineas) {
      await prisma.asientoLinea.deleteMany({ where: { asientoId: req.params.id } });
      data.lineas = { create: lineas.map((l: any, i: number) => ({ orden: i + 1, concepto: l.concepto || concepto, cuentaDebeId: l.cuentaDebeId || null, cuentaHaberId: l.cuentaHaberId || null, debe: l.debe || 0, haber: l.haber || 0 })) };
    }
    const asiento = await prisma.asientoContable.update({ where: { id: req.params.id }, data, include: { lineas: { include: { cuentaDebe: true, cuentaHaber: true } } } });
    res.json(asiento);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Eliminar asiento
router.delete('/asientos/:id', async (req: any, res: Response) => {
  try {
    await prisma.asientoContable.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Extracto de cuenta
router.get('/cuentas/:id/extracto', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const lineas = await prisma.asientoLinea.findMany({
      where: { OR: [{ cuentaDebeId: req.params.id }, { cuentaHaberId: req.params.id }], asiento: { ejercicio } },
      include: { asiento: true },
      orderBy: { asiento: { fecha: 'asc' } },
    });
    const cuenta = await prisma.cuentaContable.findUnique({ where: { id: req.params.id } });
    let saldo = 0;
    const movimientos = lineas.map(l => {
      const debe = l.cuentaDebeId === req.params.id ? Number(l.debe || 0) : 0;
      const haber = l.cuentaHaberId === req.params.id ? Number(l.haber || 0) : 0;
      saldo += debe - haber;
      return { fecha: l.asiento.fecha, numero: l.asiento.numero, concepto: l.concepto || l.asiento.concepto, debe, haber, saldo };
    });
    res.json({ cuenta, movimientos, totalDebe: movimientos.reduce((s, m) => s + m.debe, 0), totalHaber: movimientos.reduce((s, m) => s + m.haber, 0), saldoFinal: saldo });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// 11. CONCILIACIÓN BANCARIA
// ============================================

// Cuentas bancarias - CRUD
router.get('/banco/cuentas', async (req: any, res: Response) => {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { movimientos: true } } },
    });
    res.json(cuentas);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/banco/cuentas', async (req: any, res: Response) => {
  try {
    const cuenta = await prisma.cuentaBancaria.create({ data: req.body });
    res.json(cuenta);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/banco/cuentas/:id', async (req: any, res: Response) => {
  try {
    const cuenta = await prisma.cuentaBancaria.update({ where: { id: req.params.id }, data: req.body });
    res.json(cuenta);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/banco/cuentas/:id', async (req: any, res: Response) => {
  try {
    await prisma.cuentaBancaria.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Movimientos bancarios
router.get('/banco/movimientos', async (req: any, res: Response) => {
  try {
    const cuentaId = req.query.cuentaId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const conciliado = req.query.conciliado as string;

    const where: any = {};
    if (cuentaId) where.cuentaBancariaId = cuentaId;
    if (conciliado === 'true') where.conciliado = true;
    if (conciliado === 'false') where.conciliado = false;

    const [total, data] = await Promise.all([
      prisma.movimientoBancario.count({ where }),
      prisma.movimientoBancario.findMany({
        where, orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: { cuentaBancaria: { select: { nombre: true } } },
      }),
    ]);
    res.json({ data, total, totalPages: Math.ceil(total / limit), page });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/banco/movimientos', async (req: any, res: Response) => {
  try {
    const mov = await prisma.movimientoBancario.create({ data: { ...req.body, fecha: new Date(req.body.fecha) } });
    // Actualizar saldo cuenta
    await prisma.cuentaBancaria.update({
      where: { id: mov.cuentaBancariaId },
      data: { saldoActual: { increment: mov.importe } },
    });
    res.json(mov);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/banco/movimientos/:id/conciliar', async (req: any, res: Response) => {
  try {
    const mov = await prisma.movimientoBancario.update({
      where: { id: req.params.id },
      data: { conciliado: true, facturaId: req.body.facturaId || null, facturaCompraId: req.body.facturaCompraId || null, cobroId: req.body.cobroId || null, pagoId: req.body.pagoId || null },
    });
    res.json(mov);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/banco/movimientos/:id/desconciliar', async (req: any, res: Response) => {
  try {
    const mov = await prisma.movimientoBancario.update({
      where: { id: req.params.id },
      data: { conciliado: false, facturaId: null, facturaCompraId: null, cobroId: null, pagoId: null },
    });
    res.json(mov);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/banco/movimientos/:id', async (req: any, res: Response) => {
  try {
    const mov = await prisma.movimientoBancario.findUnique({ where: { id: req.params.id } });
    if (mov) {
      await prisma.cuentaBancaria.update({
        where: { id: mov.cuentaBancariaId },
        data: { saldoActual: { decrement: mov.importe } },
      });
      await prisma.movimientoBancario.delete({ where: { id: req.params.id } });
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Resumen conciliación
router.get('/banco/resumen', async (req: any, res: Response) => {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({ where: { activa: true }, include: { _count: { select: { movimientos: true } } } });
    const pendientes = await prisma.movimientoBancario.count({ where: { conciliado: false } });
    const totalSaldo = cuentas.reduce((s, c) => s + c.saldoActual, 0);
    res.json({ cuentas, pendientes, totalSaldo });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// 12. PRESUPUESTO CONTABLE
// ============================================

router.get('/presupuestos-contables', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const presupuestos = await prisma.presupuestoContable.findMany({
      where: { ejercicio },
      include: { partidas: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(presupuestos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/presupuestos-contables', async (req: any, res: Response) => {
  try {
    const { nombre, ejercicio, observaciones, partidas } = req.body;
    const pres = await prisma.presupuestoContable.create({
      data: {
        nombre, ejercicio, observaciones,
        partidas: partidas ? { create: partidas } : undefined,
      },
      include: { partidas: true },
    });
    res.json(pres);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/presupuestos-contables/:id', async (req: any, res: Response) => {
  try {
    const { partidas, ...data } = req.body;
    if (partidas) {
      await prisma.partidaPresupuesto.deleteMany({ where: { presupuestoId: req.params.id } });
      data.partidas = { create: partidas };
    }
    const pres = await prisma.presupuestoContable.update({
      where: { id: req.params.id }, data,
      include: { partidas: true },
    });
    res.json(pres);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/presupuestos-contables/:id', async (req: any, res: Response) => {
  try {
    await prisma.presupuestoContable.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Ejecución presupuestaria - compara previsto vs real
router.get('/presupuestos-contables/:id/ejecucion', async (req: any, res: Response) => {
  try {
    const pres = await prisma.presupuestoContable.findUnique({
      where: { id: req.params.id },
      include: { partidas: true },
    });
    if (!pres) return res.status(404).json({ error: 'No encontrado' });

    const inicio = new Date(pres.ejercicio, 0, 1);
    const fin = new Date(pres.ejercicio, 11, 31, 23, 59, 59);

    // Get real amounts from asientos
    const lineas = await prisma.asientoLinea.findMany({
      where: { asiento: { ejercicio: pres.ejercicio, fecha: { gte: inicio, lte: fin } } },
    });

    const realesPorCuenta: Record<string, number> = {};
    lineas.forEach(l => {
      if (l.cuentaDebeId) realesPorCuenta[l.cuentaDebeId] = (realesPorCuenta[l.cuentaDebeId] || 0) + Number(l.debe || 0);
      if (l.cuentaHaberId) realesPorCuenta[l.cuentaHaberId] = (realesPorCuenta[l.cuentaHaberId] || 0) + Number(l.haber || 0);
    });

    const partidasConReal = pres.partidas.map(p => ({
      ...p,
      importeReal: realesPorCuenta[p.cuentaContableId] || 0,
      desviacion: (realesPorCuenta[p.cuentaContableId] || 0) - p.importePrevisto,
    }));

    res.json({ ...pres, partidas: partidasConReal });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// 13. MODELOS FISCALES (303/390)
// ============================================

router.get('/modelos-fiscales', async (req: any, res: Response) => {
  try {
    const ejercicio = parseInt(req.query.ejercicio as string) || new Date().getFullYear();
    const modelos = await prisma.modeloFiscal.findMany({
      where: { ejercicio },
      orderBy: [{ tipo: 'asc' }, { periodo: 'asc' }],
    });
    res.json(modelos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Calcular modelo 303 (IVA trimestral)
router.post('/modelos-fiscales/calcular-303', async (req: any, res: Response) => {
  try {
    const { ejercicio, trimestre } = req.body;
    const mesInicio = (trimestre - 1) * 3;
    const inicio = new Date(ejercicio, mesInicio, 1);
    const fin = new Date(ejercicio, mesInicio + 3, 0, 23, 59, 59);

    // IVA repercutido (ventas)
    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: { not: 'ANULADA' } },
      select: { baseImponible: true, totalIva: true },
    });

    // IVA soportado (compras)
    let comprasData: any[] = [];
    try { comprasData = await prisma.facturaCompra.findMany({ where: { fecha: { gte: inicio, lte: fin } }, select: { baseImponible: true, totalIva: true } }); } catch {}

    const baseRepercutido = facturas.reduce((s, f) => s + Number(f.baseImponible || 0), 0);
    const cuotaRepercutida = facturas.reduce((s, f) => s + Number(f.totalIva || 0), 0);
    const baseSoportado = comprasData.reduce((s: number, f: any) => s + Number(f.baseImponible || 0), 0);
    const cuotaSoportada = comprasData.reduce((s: number, f: any) => s + Number(f.totalIva || 0), 0);
    const resultado = cuotaRepercutida - cuotaSoportada;

    const periodo = `${trimestre}T`;
    // Upsert
    const existing = await prisma.modeloFiscal.findFirst({ where: { tipo: '303', ejercicio, periodo } });
    const data = {
      tipo: '303', ejercicio, periodo,
      baseImponibleRepercutido: baseRepercutido, cuotaRepercutida,
      baseImponibleSoportado: baseSoportado, cuotaSoportada, resultado,
      datosJson: { numFacturasVenta: facturas.length, numFacturasCompra: comprasData.length, trimestre },
    };

    const modelo = existing
      ? await prisma.modeloFiscal.update({ where: { id: existing.id }, data })
      : await prisma.modeloFiscal.create({ data });

    res.json(modelo);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Calcular modelo 390 (resumen anual IVA)
router.post('/modelos-fiscales/calcular-390', async (req: any, res: Response) => {
  try {
    const { ejercicio } = req.body;
    const inicio = new Date(ejercicio, 0, 1);
    const fin = new Date(ejercicio, 11, 31, 23, 59, 59);

    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: { not: 'ANULADA' } },
      select: { baseImponible: true, totalIva: true },
    });

    let compras390: any[] = [];
    try { compras390 = await prisma.facturaCompra.findMany({ where: { fecha: { gte: inicio, lte: fin } }, select: { baseImponible: true, totalIva: true } }); } catch {}

    const baseRepercutido = facturas.reduce((s, f) => s + Number(f.baseImponible || 0), 0);
    const cuotaRepercutida = facturas.reduce((s, f) => s + Number(f.totalIva || 0), 0);
    const baseSoportado = compras390.reduce((s: number, f: any) => s + Number(f.baseImponible || 0), 0);
    const cuotaSoportada = compras390.reduce((s: number, f: any) => s + Number(f.totalIva || 0), 0);
    const resultado = cuotaRepercutida - cuotaSoportada;

    const existing = await prisma.modeloFiscal.findFirst({ where: { tipo: '390', ejercicio, periodo: 'ANUAL' } });
    const data = {
      tipo: '390', ejercicio, periodo: 'ANUAL',
      baseImponibleRepercutido: baseRepercutido, cuotaRepercutida,
      baseImponibleSoportado: baseSoportado, cuotaSoportada, resultado,
      datosJson: { numFacturasVenta: facturas.length, numFacturasCompra: compras390.length },
    };

    const modelo = existing
      ? await prisma.modeloFiscal.update({ where: { id: existing.id }, data })
      : await prisma.modeloFiscal.create({ data });

    res.json(modelo);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/modelos-fiscales/:id', async (req: any, res: Response) => {
  try {
    const modelo = await prisma.modeloFiscal.update({ where: { id: req.params.id }, data: req.body });
    res.json(modelo);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/modelos-fiscales/:id', async (req: any, res: Response) => {
  try {
    await prisma.modeloFiscal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// 14. CIERRE DE EJERCICIO
// ============================================

router.get('/cierres', async (req: any, res: Response) => {
  try {
    const cierres = await prisma.cierreEjercicio.findMany({ orderBy: { ejercicio: 'desc' } });
    res.json(cierres);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/cierres', async (req: any, res: Response) => {
  try {
    const { ejercicio } = req.body;
    const userId = req.user?.id || req.userId;

    // Check not already closed
    const existing = await prisma.cierreEjercicio.findUnique({ where: { ejercicio } });
    if (existing) return res.status(400).json({ error: `Ejercicio ${ejercicio} ya está cerrado` });

    const inicio = new Date(ejercicio, 0, 1);
    const fin = new Date(ejercicio, 11, 31, 23, 59, 59);

    // Calculate P&L
    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: { not: 'ANULADA' } },
      select: { baseImponible: true },
    });
    let comprasCierre: any[] = [];
    try { comprasCierre = await prisma.facturaCompra.findMany({ where: { fecha: { gte: inicio, lte: fin } }, select: { baseImponible: true } }); } catch {}

    const totalIngresos = facturas.reduce((s, f) => s + Number(f.baseImponible || 0), 0);
    const totalGastos = comprasCierre.reduce((s: number, f: any) => s + Number(f.baseImponible || 0), 0);
    const resultado = totalIngresos - totalGastos;

    // Create closing entry
    const lastAsiento = await prisma.asientoContable.findFirst({ where: { ejercicio }, orderBy: { numero: 'desc' } });
    const numeroCierre = (lastAsiento?.numero || 0) + 1;

    const asientoCierre = await prisma.asientoContable.create({
      data: {
        numero: numeroCierre, ejercicio, fecha: new Date(ejercicio, 11, 31),
        concepto: `Asiento de cierre ejercicio ${ejercicio}`, diario: 'CIERRE',
        creadorId: userId,
        lineas: { create: [] },
      },
    });

    // Create opening entry for next year
    const asientoApertura = await prisma.asientoContable.create({
      data: {
        numero: 1, ejercicio: ejercicio + 1, fecha: new Date(ejercicio + 1, 0, 1),
        concepto: `Asiento de apertura ejercicio ${ejercicio + 1}`, diario: 'APERTURA',
        creadorId: userId,
        lineas: { create: [] },
      },
    });

    const cierre = await prisma.cierreEjercicio.create({
      data: {
        ejercicio, totalIngresos, totalGastos, resultado,
        asientoCierreId: asientoCierre.id, asientoAperturaId: asientoApertura.id,
        usuarioId: userId,
      },
    });

    res.json(cierre);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/cierres/:id', async (req: any, res: Response) => {
  try {
    const cierre = await prisma.cierreEjercicio.findUnique({ where: { id: req.params.id } });
    if (cierre) {
      // Remove associated entries
      if (cierre.asientoCierreId) await prisma.asientoContable.delete({ where: { id: cierre.asientoCierreId } }).catch(() => {});
      if (cierre.asientoAperturaId) await prisma.asientoContable.delete({ where: { id: cierre.asientoAperturaId } }).catch(() => {});
      await prisma.cierreEjercicio.delete({ where: { id: req.params.id } });
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;