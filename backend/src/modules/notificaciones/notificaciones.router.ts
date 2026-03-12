import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

// ============================================
// GET /notificaciones - Notificaciones dinámicas
// ============================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finHoy = new Date(hoy);
    finHoy.setHours(23, 59, 59, 999);

    const en5dias = new Date(hoy);
    en5dias.setDate(en5dias.getDate() + 5);

    const [facturasVencidas, facturasCompraPorVencer, stockBajo, recurrentesPendientes, cobrosDelDia] =
      await Promise.all([
        // 1. Facturas vencidas
        prisma.factura.findMany({
          where: {
            OR: [
              { estado: 'VENCIDA' },
              {
                estado: 'EMITIDA',
                fechaVencimiento: { lt: hoy },
              },
            ],
          },
          include: { cliente: { select: { nombre: true } } },
          orderBy: { fechaVencimiento: 'asc' },
          take: 50,
        }),

        // 2. Facturas compra próximas a vencer (5 días)
        prisma.facturaCompra.findMany({
          where: {
            estado: { not: 'COBRADA' },
            fechaVencimiento: { gte: hoy, lte: en5dias },
          },
          include: { proveedor: { select: { nombre: true } } },
          orderBy: { fechaVencimiento: 'asc' },
          take: 50,
        }),

        // 3. Stock bajo mínimos
        prisma.articulo.findMany({
          where: {
            controlStock: true,
            activo: true,
            stockActual: { lt: prisma.articulo.fields.stockMinimo } as any,
          },
          select: {
            id: true,
            referencia: true,
            nombre: true,
            stockActual: true,
            stockMinimo: true,
          },
          take: 50,
        }).catch(async () => {
          // Fallback: fetch all and filter in JS if raw field comparison not supported
          const articulos = await prisma.articulo.findMany({
            where: { controlStock: true, activo: true },
            select: {
              id: true,
              referencia: true,
              nombre: true,
              stockActual: true,
              stockMinimo: true,
            },
          });
          return articulos.filter(a => a.stockActual < a.stockMinimo).slice(0, 50);
        }),

        // 4. Recurrentes pendientes
        prisma.facturaRecurrente.findMany({
          where: { activa: true, proximaEmision: { lte: hoy } },
          include: { cliente: { select: { nombre: true } } },
          take: 50,
        }).catch(() => []),

        // 5. Cobros del día
        prisma.cobro.findMany({
          where: {
            fecha: { gte: hoy, lte: finHoy },
          },
          include: {
            factura: { select: { numeroCompleto: true } },
            cliente: { select: { nombre: true } },
          },
          take: 50,
        }),
      ]);

    type Notificacion = {
      id: string;
      tipo: string;
      severity: 'alta' | 'media' | 'info';
      mensaje: string;
      link: string;
    };

    const notificaciones: Notificacion[] = [];

    // Facturas vencidas -> severity alta
    for (const f of facturasVencidas) {
      const pendiente = f.total - f.totalPagado;
      notificaciones.push({
        id: f.id,
        tipo: 'factura_vencida',
        severity: 'alta',
        mensaje: `Factura ${f.numeroCompleto} vencida - ${f.cliente.nombre} - ${pendiente.toFixed(2)}\u20AC`,
        link: '/ventas/facturas',
      });
    }

    // Facturas compra próximas a vencer -> severity media
    for (const fc of facturasCompraPorVencer) {
      const dias = Math.ceil(
        (new Date(fc.fechaVencimiento!).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      );
      notificaciones.push({
        id: fc.id,
        tipo: 'pago_proximo',
        severity: 'media',
        mensaje: `Pago a ${fc.proveedor.nombre} vence en ${dias} días - ${fc.total.toFixed(2)}\u20AC`,
        link: '/compras/facturas',
      });
    }

    // Stock bajo mínimos -> severity media
    for (const a of stockBajo) {
      notificaciones.push({
        id: a.id,
        tipo: 'stock_bajo',
        severity: 'media',
        mensaje: `Stock bajo: ${a.nombre} (${a.referencia}) - ${a.stockActual}/${a.stockMinimo} uds`,
        link: '/almacen/articulos',
      });
    }

    // Recurrentes pendientes -> severity media
    for (const r of (recurrentesPendientes as any[])) {
      notificaciones.push({
        id: r.id,
        tipo: 'recurrente_pendiente',
        severity: 'media',
        mensaje: `Factura recurrente pendiente: ${r.nombre} - ${r.cliente?.nombre}`,
        link: '/ventas/recurrentes',
      });
    }

    // Cobros del día -> severity info
    for (const c of cobrosDelDia) {
      notificaciones.push({
        id: c.id,
        tipo: 'cobro_dia',
        severity: 'info',
        mensaje: `Cobro ${c.importe.toFixed(2)}\u20AC - Factura ${c.factura.numeroCompleto} - ${c.cliente.nombre}`,
        link: '/ventas/cobros',
      });
    }

    // Ordenar por severidad: alta > media > info
    const severityOrder = { alta: 0, media: 1, info: 2 };
    notificaciones.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const resumen = {
      total: notificaciones.length,
      alta: notificaciones.filter(n => n.severity === 'alta').length,
      media: notificaciones.filter(n => n.severity === 'media').length,
      info: notificaciones.filter(n => n.severity === 'info').length,
    };

    res.json({ notificaciones, resumen });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

// ============================================
// GET /notificaciones/busqueda - Búsqueda global
// ============================================
router.get('/busqueda', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (q.length < 2) {
      return res.json({ clientes: [], articulos: [], facturas: [], proveedores: [], total: 0 });
    }

    const [clientes, articulos, facturas, proveedores] = await Promise.all([
      // Clientes
      prisma.cliente.findMany({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { cifNif: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, cifNif: true },
        take: 5,
      }),

      // Artículos
      prisma.articulo.findMany({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { referencia: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombre: true, referencia: true },
        take: 5,
      }),

      // Facturas
      prisma.factura.findMany({
        where: {
          numeroCompleto: { contains: q, mode: 'insensitive' },
        },
        include: { cliente: { select: { nombre: true } } },
        take: 5,
      }).catch(() => []),

      // Proveedores
      prisma.proveedor.findMany({
        where: {
          activo: true,
          nombre: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, nombre: true },
        take: 5,
      }),
    ]);

    const clientesResult = clientes.map(c => ({
      id: c.id,
      nombre: c.nombre,
      cifNif: c.cifNif,
      tipo: 'cliente' as const,
      link: `/clientes/${c.id}`,
    }));

    const articulosResult = articulos.map(a => ({
      id: a.id,
      nombre: a.nombre,
      referencia: a.referencia,
      tipo: 'articulo' as const,
      link: `/almacen/articulos/${a.id}`,
    }));

    const facturasResult = (facturas as any[]).map(f => ({
      id: f.id,
      numero: f.numeroCompleto,
      clienteNombre: f.cliente?.nombre,
      total: f.total,
      tipo: 'factura' as const,
      link: `/facturas/${f.id}`,
    }));

    const proveedoresResult = proveedores.map(p => ({
      id: p.id,
      nombre: p.nombre,
      tipo: 'proveedor' as const,
      link: '/compras/proveedores',
    }));

    const total =
      clientesResult.length +
      articulosResult.length +
      facturasResult.length +
      proveedoresResult.length;

    res.json({
      clientes: clientesResult,
      articulos: articulosResult,
      facturas: facturasResult,
      proveedores: proveedoresResult,
      total,
    });
  } catch (error) {
    console.error('Error en búsqueda global:', error);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

export default router;
