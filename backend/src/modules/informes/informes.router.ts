import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const router = Router();
const prisma = new PrismaClient();

// ============================================
// GET /informes/iva-trimestral?year=2026&trimestre=1
// ============================================
router.get('/iva-trimestral', async (req: any, res: any) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const trimestre = parseInt(req.query.trimestre as string) || Math.ceil((new Date().getMonth() + 1) / 3);
    const mesInicio = (trimestre - 1) * 3 + 1;
    const mesFin = trimestre * 3;
    const fechaInicio = new Date(year, mesInicio - 1, 1);
    const fechaFin = new Date(year, mesFin, 0, 23, 59, 59);

    // Libro de facturas emitidas
    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
      include: { cliente: true, lineas: true },
      orderBy: { fecha: 'asc' }
    });

    const totalBase = facturas.reduce((s, f) => s + (f.baseImponible || 0), 0);
    const totalIva = facturas.reduce((s, f) => s + (f.totalIva || 0), 0);
    const totalIrpf = facturas.reduce((s, f) => s + (f.totalIrpf || 0), 0);
    const totalFacturado = facturas.reduce((s, f) => s + (f.total || 0), 0);

    // Desglose por tipo de IVA de facturas emitidas
    const desglosePorIva: Record<number, { base: number; iva: number; count: number }> = {};
    facturas.forEach(f => {
      (f.lineas || []).forEach((l: any) => {
        const tipo = l.tipoIva || 0;
        if (!desglosePorIva[tipo]) desglosePorIva[tipo] = { base: 0, iva: 0, count: 0 };
        desglosePorIva[tipo].base += l.baseLinea || 0;
        desglosePorIva[tipo].iva += l.ivaLinea || 0;
        desglosePorIva[tipo].count++;
      });
    });

    // Libro de facturas recibidas (compras)
    const facturasCompra = await prisma.facturaCompra.findMany({
      where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
      include: { proveedor: true, lineas: true },
      orderBy: { fecha: 'asc' }
    });

    const totalBaseRecibidas = facturasCompra.reduce((s, f) => s + (f.baseImponible || 0), 0);
    const totalIvaRecibidas = facturasCompra.reduce((s, f) => s + (f.totalIva || 0), 0);
    const totalRecibidas = facturasCompra.reduce((s, f) => s + (f.total || 0), 0);

    const desgloseRecibidas: Record<number, { base: number; iva: number; count: number }> = {};
    facturasCompra.forEach(f => {
      (f.lineas || []).forEach((l: any) => {
        const tipo = l.tipoIva || 0;
        if (!desgloseRecibidas[tipo]) desgloseRecibidas[tipo] = { base: 0, iva: 0, count: 0 };
        desgloseRecibidas[tipo].base += l.baseLinea || 0;
        desgloseRecibidas[tipo].iva += l.ivaLinea || 0;
        desgloseRecibidas[tipo].count++;
      });
    });

    res.json({
      year, trimestre, mesInicio, mesFin,
      resumen: {
        totalBase, totalIva, totalIrpf, totalFacturado, numFacturas: facturas.length,
        totalBaseRecibidas, totalIvaRecibidas, totalRecibidas, numFacturasRecibidas: facturasCompra.length,
        liquidacion: totalIva - totalIvaRecibidas,
        desglosePorIva: Object.entries(desglosePorIva)
          .map(([tipo, v]) => ({ tipoIva: parseFloat(tipo), ...v }))
          .sort((a, b) => a.tipoIva - b.tipoIva),
        desgloseRecibidas: Object.entries(desgloseRecibidas)
          .map(([tipo, v]) => ({ tipoIva: parseFloat(tipo), ...v }))
          .sort((a, b) => a.tipoIva - b.tipoIva),
      },
      facturas: facturas.map(f => ({
        id: f.id, numeroCompleto: f.numeroCompleto, fechaEmision: f.fecha,
        cliente: (f.cliente as any)?.nombre || f.nombreCliente,
        cifNif: f.cifNif || (f.cliente as any)?.cifNif,
        baseImponible: f.baseImponible, totalIva: f.totalIva, totalIrpf: f.totalIrpf, total: f.total
      })),
      libroRecibidas: facturasCompra.map(f => ({
        id: f.id, numero: f.numeroProveedor, fechaEmision: f.fecha,
        proveedor: (f.proveedor as any)?.nombre,
        cifNif: (f.proveedor as any)?.cifNif,
        baseImponible: f.baseImponible, totalIva: f.totalIva, total: f.total
      }))
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GET /informes/ventas?year=2026&mes=3
// ============================================
router.get('/ventas', async (req: any, res: any) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const mes = req.query.mes ? parseInt(req.query.mes as string) : 0;
    const fechaInicio = mes > 0 ? new Date(year, mes - 1, 1) : new Date(year, 0, 1);
    const fechaFin = mes > 0 ? new Date(year, mes, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);

    const facturas = await prisma.factura.findMany({
      where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
      include: { cliente: true, creador: true, lineas: { include: { articulo: { include: { familia: true } } } } },
      orderBy: { fecha: 'desc' }
    });

    // Por mes
    const porMes: Record<number, any> = {};
    facturas.forEach(f => {
      const m = new Date(f.fecha).getMonth() + 1;
      if (!porMes[m]) porMes[m] = { mes: m, total: 0, base: 0, num: 0 };
      porMes[m].total += f.total || 0;
      porMes[m].base += f.baseImponible || 0;
      porMes[m].num++;
    });

    // Por cliente
    const porCliente: Record<string, any> = {};
    facturas.forEach(f => {
      const k = f.clienteId || 'desconocido';
      const nombre = (f.cliente as any)?.nombre || f.nombreCliente || 'Desconocido';
      if (!porCliente[k]) porCliente[k] = { nombre, total: 0, num: 0 };
      porCliente[k].total += f.total || 0;
      porCliente[k].num++;
    });

    // Por vendedor
    const porVendedor: Record<string, any> = {};
    facturas.forEach(f => {
      const k = f.creadorId || 'desconocido';
      const nombre = (f.creador as any)?.nombre || 'Desconocido';
      if (!porVendedor[k]) porVendedor[k] = { vendedorId: k, nombre, total: 0, num: 0 };
      porVendedor[k].total += f.total || 0;
      porVendedor[k].num++;
    });

    // Por familia de articulo
    const porFamilia: Record<string, any> = {};
    facturas.forEach(f => {
      (f.lineas || []).forEach((l: any) => {
        const familiaId = l.articulo?.familiaId || 'sin-familia';
        const familiaNombre = l.articulo?.familia?.nombre || 'Sin familia';
        if (!porFamilia[familiaId]) porFamilia[familiaId] = { familiaId, nombre: familiaNombre, total: 0, cantidad: 0, num: 0 };
        porFamilia[familiaId].total += l.totalLinea || 0;
        porFamilia[familiaId].cantidad += l.cantidad || 0;
        porFamilia[familiaId].num++;
      });
    });

    const total = facturas.reduce((s, f) => s + (f.total || 0), 0);

    res.json({
      year, mes,
      resumen: {
        totalFacturado: total,
        totalBase: facturas.reduce((s, f) => s + (f.baseImponible || 0), 0),
        numFacturas: facturas.length,
        mediaFactura: facturas.length > 0 ? total / facturas.length : 0
      },
      porMes: Object.values(porMes).sort((a: any, b: any) => a.mes - b.mes),
      topClientes: Object.values(porCliente).sort((a: any, b: any) => b.total - a.total).slice(0, 10),
      porVendedor: Object.values(porVendedor).sort((a: any, b: any) => b.total - a.total),
      porFamilia: Object.values(porFamilia).sort((a: any, b: any) => b.total - a.total),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GET /informes/cobros-pagos?year=2026
// ============================================
router.get('/cobros-pagos', async (req: any, res: any) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const fechaInicio = new Date(year, 0, 1);
    const fechaFin = new Date(year, 11, 31, 23, 59, 59);
    const hoy = new Date();

    // --- Cobros realizados ---
    const cobros = await prisma.cobro.findMany({
      where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: 'PAGADO' }
    });
    const cobrosPorMes: Record<number, number> = {};
    cobros.forEach(c => {
      const m = new Date(c.fecha).getMonth() + 1;
      cobrosPorMes[m] = (cobrosPorMes[m] || 0) + (c.importe || 0);
    });
    const totalCobros = cobros.reduce((s, c) => s + (c.importe || 0), 0);

    // --- Pagos realizados ---
    const pagos = await prisma.pago.findMany({
      where: { fecha: { gte: fechaInicio, lte: fechaFin } }
    });
    const pagosPorMes: Record<number, number> = {};
    pagos.forEach(p => {
      const m = new Date(p.fecha).getMonth() + 1;
      pagosPorMes[m] = (pagosPorMes[m] || 0) + (p.importe || 0);
    });
    const totalPagos = pagos.reduce((s, p) => s + (p.importe || 0), 0);

    // --- Prevision cobros (facturas pendientes agrupadas por envejecimiento) ---
    const facturasPendientes = await prisma.factura.findMany({
      where: { estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] } },
      include: { cliente: true }
    });

    const aging = { '0-30': { total: 0, count: 0 }, '31-60': { total: 0, count: 0 }, '61-90': { total: 0, count: 0 }, '90+': { total: 0, count: 0 } };
    facturasPendientes.forEach(f => {
      const pendiente = (f.total || 0) - (f.totalPagado || 0);
      if (pendiente <= 0) return;
      const dias = f.fechaVencimiento
        ? Math.max(0, Math.floor((hoy.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000))
        : Math.floor((hoy.getTime() - new Date(f.fecha).getTime()) / 86400000);
      if (dias <= 30) { aging['0-30'].total += pendiente; aging['0-30'].count++; }
      else if (dias <= 60) { aging['31-60'].total += pendiente; aging['31-60'].count++; }
      else if (dias <= 90) { aging['61-90'].total += pendiente; aging['61-90'].count++; }
      else { aging['90+'].total += pendiente; aging['90+'].count++; }
    });

    // --- Prevision pagos (facturas compra pendientes) ---
    const facturasCompraPend = await prisma.facturaCompra.findMany({
      where: { estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] } },
      include: { proveedor: true }
    });

    const agingPagos = { '0-30': { total: 0, count: 0 }, '31-60': { total: 0, count: 0 }, '61-90': { total: 0, count: 0 }, '90+': { total: 0, count: 0 } };
    facturasCompraPend.forEach(f => {
      const pendiente = (f.total || 0) - (f.totalPagado || 0);
      if (pendiente <= 0) return;
      const dias = f.fechaVencimiento
        ? Math.max(0, Math.floor((hoy.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000))
        : Math.floor((hoy.getTime() - new Date(f.fecha).getTime()) / 86400000);
      if (dias <= 30) { agingPagos['0-30'].total += pendiente; agingPagos['0-30'].count++; }
      else if (dias <= 60) { agingPagos['31-60'].total += pendiente; agingPagos['31-60'].count++; }
      else if (dias <= 90) { agingPagos['61-90'].total += pendiente; agingPagos['61-90'].count++; }
      else { agingPagos['90+'].total += pendiente; agingPagos['90+'].count++; }
    });

    // --- Clientes morosos ---
    const morososMap: Record<string, { nombre: string; cifNif: string; numFacturas: number; importeVencido: number; diasMaxRetraso: number }> = {};
    facturasPendientes.forEach(f => {
      if (!f.fechaVencimiento || new Date(f.fechaVencimiento) >= hoy) return;
      const pendiente = (f.total || 0) - (f.totalPagado || 0);
      if (pendiente <= 0) return;
      const diasRetraso = Math.floor((hoy.getTime() - new Date(f.fechaVencimiento).getTime()) / 86400000);
      const k = f.clienteId;
      if (!morososMap[k]) {
        morososMap[k] = {
          nombre: (f.cliente as any)?.nombre || 'Desconocido',
          cifNif: (f.cliente as any)?.cifNif || '',
          numFacturas: 0, importeVencido: 0, diasMaxRetraso: 0
        };
      }
      morososMap[k].numFacturas++;
      morososMap[k].importeVencido += pendiente;
      morososMap[k].diasMaxRetraso = Math.max(morososMap[k].diasMaxRetraso, diasRetraso);
    });

    res.json({
      year,
      cobrosRealizados: {
        total: totalCobros,
        count: cobros.length,
        porMes: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: cobrosPorMes[i + 1] || 0 }))
      },
      pagosRealizados: {
        total: totalPagos,
        count: pagos.length,
        porMes: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: pagosPorMes[i + 1] || 0 }))
      },
      previsionCobros: aging,
      previsionPagos: agingPagos,
      clientesMorosos: Object.values(morososMap).sort((a, b) => b.importeVencido - a.importeVencido)
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GET /informes/cobros-pendientes (backward compat)
// ============================================
router.get('/cobros-pendientes', async (req: any, res: any) => {
  try {
    const facturas = await prisma.factura.findMany({
      where: { estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] } },
      include: { cliente: true },
      orderBy: { fechaVencimiento: 'asc' }
    });
    const hoy = new Date();
    const vencidas = facturas.filter(f => f.fechaVencimiento && new Date(f.fechaVencimiento) < hoy);
    res.json({
      totalPendiente: facturas.reduce((s, f) => s + ((f.total || 0) - (f.totalPagado || 0)), 0),
      numFacturas: facturas.length,
      vencidas: vencidas.length,
      importeVencido: vencidas.reduce((s, f) => s + ((f.total || 0) - (f.totalPagado || 0)), 0),
      facturas: facturas.map(f => ({
        id: f.id, numeroCompleto: f.numeroCompleto,
        cliente: (f.cliente as any)?.nombre || f.nombreCliente,
        fechaEmision: f.fecha, fechaVencimiento: f.fechaVencimiento,
        total: f.total, totalCobrado: f.totalPagado || 0,
        pendiente: (f.total || 0) - (f.totalPagado || 0),
        vencida: !!(f.fechaVencimiento && new Date(f.fechaVencimiento) < hoy)
      }))
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GET /informes/stock
// ============================================
router.get('/stock', async (req: any, res: any) => {
  try {
    // Valoracion total del stock
    const articulos = await prisma.articulo.findMany({
      where: { activo: true },
      include: { familia: true }
    });

    const valoracionTotal = articulos.reduce((s, a) => s + ((a.stockActual || 0) * (a.precioCoste || 0)), 0);
    const totalArticulos = articulos.length;

    // Articulos bajo minimos
    const articulosBajoMinimos = articulos
      .filter(a => a.controlStock && a.stockMinimo > 0 && a.stockActual < a.stockMinimo)
      .map(a => ({
        id: a.id,
        nombre: a.nombre,
        referencia: a.referencia,
        stockActual: a.stockActual,
        stockMinimo: a.stockMinimo,
        familia: { nombre: (a.familia as any)?.nombre || 'Sin familia' }
      }))
      .sort((a, b) => (a.stockActual - a.stockMinimo) - (b.stockActual - b.stockMinimo));

    // Top 20 articulos mas vendidos (por cantidad en lineas de factura)
    const lineasAgrupadas = await prisma.lineaFactura.groupBy({
      by: ['articuloId'],
      _sum: { cantidad: true, totalLinea: true },
      _count: { id: true },
      where: { articuloId: { not: null } },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 20
    });

    const articuloIds = lineasAgrupadas.map(l => l.articuloId).filter(Boolean) as string[];
    const articulosMap: Record<string, any> = {};
    if (articuloIds.length > 0) {
      const arts = await prisma.articulo.findMany({
        where: { id: { in: articuloIds } },
        include: { familia: true }
      });
      arts.forEach(a => { articulosMap[a.id] = a; });
    }

    const topArticulosVendidos = lineasAgrupadas.map(l => {
      const art = articulosMap[l.articuloId || ''];
      return {
        articuloId: l.articuloId,
        nombre: art?.nombre || 'Desconocido',
        referencia: art?.referencia || '',
        familia: art?.familia?.nombre || 'Sin familia',
        cantidadVendida: l._sum.cantidad || 0,
        totalVendido: l._sum.totalLinea || 0,
        numLineas: l._count.id || 0
      };
    });

    res.json({
      valoracionTotal,
      totalArticulos,
      articulosBajoMinimos,
      numBajoMinimos: articulosBajoMinimos.length,
      topArticulosVendidos
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GET /informes/exportar-csv?tipo=ventas&year=2026&trimestre=1
// ============================================
router.get('/exportar-csv', async (req: any, res: any) => {
  try {
    const tipo = req.query.tipo as string;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const trimestre = parseInt(req.query.trimestre as string) || 1;
    const sep = ';';
    let csv = '';
    let filename = '';

    if (tipo === 'ventas') {
      const fechaInicio = new Date(year, 0, 1);
      const fechaFin = new Date(year, 11, 31, 23, 59, 59);
      const facturas = await prisma.factura.findMany({
        where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
        include: { cliente: true },
        orderBy: { fecha: 'asc' }
      });
      csv = 'Numero' + sep + 'Fecha' + sep + 'Cliente' + sep + 'CIF/NIF' + sep + 'Base Imponible' + sep + 'IVA' + sep + 'IRPF' + sep + 'Total\n';
      facturas.forEach(f => {
        csv += (f.numeroCompleto || '') + sep +
          new Date(f.fecha).toLocaleDateString('es-ES') + sep +
          ((f.cliente as any)?.nombre || f.nombreCliente || '').replace(/;/g, ',') + sep +
          (f.cifNif || (f.cliente as any)?.cifNif || '') + sep +
          (f.baseImponible || 0).toFixed(2).replace('.', ',') + sep +
          (f.totalIva || 0).toFixed(2).replace('.', ',') + sep +
          (f.totalIrpf || 0).toFixed(2).replace('.', ',') + sep +
          (f.total || 0).toFixed(2).replace('.', ',') + '\n';
      });
      filename = 'ventas_' + year + '.csv';

    } else if (tipo === 'cobros') {
      const fechaInicio = new Date(year, 0, 1);
      const fechaFin = new Date(year, 11, 31, 23, 59, 59);
      const cobros = await prisma.cobro.findMany({
        where: { fecha: { gte: fechaInicio, lte: fechaFin } },
        include: { factura: true, cliente: true }
      });
      csv = 'Fecha' + sep + 'Factura' + sep + 'Cliente' + sep + 'Importe' + sep + 'Forma Pago' + sep + 'Estado\n';
      cobros.forEach(c => {
        csv += new Date(c.fecha).toLocaleDateString('es-ES') + sep +
          ((c.factura as any)?.numeroCompleto || '') + sep +
          ((c.cliente as any)?.nombre || '').replace(/;/g, ',') + sep +
          (c.importe || 0).toFixed(2).replace('.', ',') + sep +
          (c.formaPago || '') + sep +
          (c.estado || '') + '\n';
      });
      filename = 'cobros_' + year + '.csv';

    } else if (tipo === 'stock') {
      const articulos = await prisma.articulo.findMany({
        where: { activo: true },
        include: { familia: true },
        orderBy: { nombre: 'asc' }
      });
      csv = 'Referencia' + sep + 'Nombre' + sep + 'Familia' + sep + 'Stock Actual' + sep + 'Stock Minimo' + sep + 'Precio Coste' + sep + 'Precio Venta' + sep + 'Valoracion\n';
      articulos.forEach(a => {
        csv += (a.referencia || '') + sep +
          (a.nombre || '').replace(/;/g, ',') + sep +
          ((a.familia as any)?.nombre || 'Sin familia').replace(/;/g, ',') + sep +
          (a.stockActual || 0).toString().replace('.', ',') + sep +
          (a.stockMinimo || 0).toString().replace('.', ',') + sep +
          (a.precioCoste || 0).toFixed(2).replace('.', ',') + sep +
          (a.precioVenta || 0).toFixed(2).replace('.', ',') + sep +
          ((a.stockActual || 0) * (a.precioCoste || 0)).toFixed(2).replace('.', ',') + '\n';
      });
      filename = 'stock_' + year + '.csv';

    } else if (tipo === 'iva') {
      const mesInicio = (trimestre - 1) * 3 + 1;
      const mesFin = trimestre * 3;
      const fechaInicio = new Date(year, mesInicio - 1, 1);
      const fechaFin = new Date(year, mesFin, 0, 23, 59, 59);

      // Emitidas
      const facturas = await prisma.factura.findMany({
        where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
        include: { cliente: true },
        orderBy: { fecha: 'asc' }
      });

      csv = 'LIBRO DE FACTURAS EMITIDAS - ' + year + ' T' + trimestre + '\n';
      csv += 'Numero' + sep + 'Fecha' + sep + 'Cliente' + sep + 'CIF/NIF' + sep + 'Base Imponible' + sep + 'IVA' + sep + 'IRPF' + sep + 'Total\n';
      facturas.forEach(f => {
        csv += (f.numeroCompleto || '') + sep +
          new Date(f.fecha).toLocaleDateString('es-ES') + sep +
          ((f.cliente as any)?.nombre || f.nombreCliente || '').replace(/;/g, ',') + sep +
          (f.cifNif || (f.cliente as any)?.cifNif || '') + sep +
          (f.baseImponible || 0).toFixed(2).replace('.', ',') + sep +
          (f.totalIva || 0).toFixed(2).replace('.', ',') + sep +
          (f.totalIrpf || 0).toFixed(2).replace('.', ',') + sep +
          (f.total || 0).toFixed(2).replace('.', ',') + '\n';
      });

      // Recibidas
      const facturasCompra = await prisma.facturaCompra.findMany({
        where: { fecha: { gte: fechaInicio, lte: fechaFin }, estado: { not: 'ANULADA' } },
        include: { proveedor: true },
        orderBy: { fecha: 'asc' }
      });

      csv += '\nLIBRO DE FACTURAS RECIBIDAS - ' + year + ' T' + trimestre + '\n';
      csv += 'Numero' + sep + 'Fecha' + sep + 'Proveedor' + sep + 'CIF/NIF' + sep + 'Base Imponible' + sep + 'IVA' + sep + 'Total\n';
      facturasCompra.forEach(f => {
        csv += (f.numeroProveedor || '') + sep +
          new Date(f.fecha).toLocaleDateString('es-ES') + sep +
          ((f.proveedor as any)?.nombre || '').replace(/;/g, ',') + sep +
          ((f.proveedor as any)?.cifNif || '') + sep +
          (f.baseImponible || 0).toFixed(2).replace('.', ',') + sep +
          (f.totalIva || 0).toFixed(2).replace('.', ',') + sep +
          (f.total || 0).toFixed(2).replace('.', ',') + '\n';
      });

      filename = 'iva_' + year + '_T' + trimestre + '.csv';

    } else {
      return res.status(400).json({ error: 'Tipo no valido. Usar: ventas, cobros, stock, iva' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send('\ufeff' + csv);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
