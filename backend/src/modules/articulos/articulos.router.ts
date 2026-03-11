import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /almacen/articulos/stats
router.get('/stats', async (req: any, res: Response) => {
  try {
    const [total, stockBajo, sinStock, familias] = await Promise.all([
      prisma.articulo.count(),
      prisma.articulo.count({ where: { controlStock: true, stockActual: { lte: prisma.articulo.fields.stockMinimo } } }),
      prisma.articulo.count({ where: { controlStock: true, stockActual: { lte: 0 } } }),
      prisma.familiaArticulo.findMany({ include: { _count: { select: { articulos: true } } }, orderBy: { nombre: 'asc' } }),
    ]);
    res.json({ total, stockBajo, sinStock, familias });
  } catch (e: any) {
    // Si falla el lte con campo, hacemos manual
    try {
      const todos = await prisma.articulo.findMany({ where: { controlStock: true } });
      const stockBajoManual = todos.filter(a => a.stockActual <= a.stockMinimo).length;
      const sinStockManual = todos.filter(a => a.stockActual <= 0).length;
      const total = await prisma.articulo.count();
      const familias = await prisma.familiaArticulo.findMany({ include: { _count: { select: { articulos: true } } } }).catch(() => []);
      res.json({ total, stockBajo: stockBajoManual, sinStock: sinStockManual, familias });
    } catch (e2: any) {
      res.status(500).json({ error: e2.message });
    }
  }
});

// GET /almacen/articulos
router.get('/', async (req: any, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', familiaId, stockBajo } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { referencia: { contains: search, mode: 'insensitive' } },
        { codigoBarras: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (familiaId) where.familiaId = familiaId;

    const [rawData, total] = await Promise.all([
      prisma.articulo.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { nombre: 'asc' },
        include: { familia: { select: { nombre: true } } },
      }),
      prisma.articulo.count({ where }),
    ]);

    let data = rawData;
    if (stockBajo === 'true') {
      data = rawData.filter(a => a.controlStock && a.stockActual <= a.stockMinimo);
    }

    res.json({ data, total, totalPages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /articulos/familias (alias para TPV y otros)
router.get('/familias', async (_req: any, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { articulos: true } } },
    });
    res.json(familias);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /almacen/articulos/:id
router.get('/:id', async (req: any, res: Response) => {
  try {
    const articulo = await prisma.articulo.findUnique({
      where: { id: req.params.id },
      include: { familia: true },
    });
    if (!articulo) return res.status(404).json({ error: 'No encontrado' });
    // Alias para compatibilidad con frontend
    res.json({ ...articulo, precioCompra: (articulo as any).precioCoste });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /almacen/articulos
router.post('/', async (req: any, res: Response) => {
  try {
    const { nombre, referencia, descripcion, familiaId, precioVenta, precioCompra, precioCoste,
      tipoIva, stockMinimo, stockMaximo, controlStock, unidadMedida, codigoBarras, permitirNegativo } = req.body;

    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!referencia) return res.status(400).json({ error: 'La referencia es obligatoria' });

    const existe = await prisma.articulo.findUnique({ where: { referencia } });
    if (existe) return res.status(400).json({ error: 'Ya existe un artículo con esa referencia' });

    const articulo = await prisma.articulo.create({
      data: {
        nombre, referencia: referencia.trim().toUpperCase(),
        descripcion: descripcion || null,
        familiaId: familiaId || null,
        codigoBarras: codigoBarras || null,
        precioVenta: parseFloat(precioVenta) || 0,
        precioCoste: parseFloat(precioCoste || precioCompra) || 0,
        tipoIva: parseFloat(tipoIva) || 21,
        stockMinimo: parseFloat(stockMinimo) || 0,
        stockMaximo: stockMaximo ? parseFloat(stockMaximo) : null,
        controlStock: controlStock !== false,
        unidadMedida: unidadMedida || 'UND',
        permitirNegativo: permitirNegativo === true,
      },
      include: { familia: true },
    });
    res.status(201).json({ ...articulo, precioCompra: (articulo as any).precioCoste });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /almacen/articulos/:id
router.put('/:id', async (req: any, res: Response) => {
  try {
    const { nombre, referencia, descripcion, familiaId, precioVenta, precioCompra, precioCoste,
      tipoIva, stockMinimo, stockMaximo, controlStock, unidadMedida, codigoBarras, permitirNegativo } = req.body;

    const articulo = await prisma.articulo.update({
      where: { id: req.params.id },
      data: {
        nombre, referencia: referencia?.trim().toUpperCase(),
        descripcion: descripcion || null,
        familiaId: familiaId || null,
        codigoBarras: codigoBarras || null,
        precioVenta: parseFloat(precioVenta) || 0,
        precioCoste: parseFloat(precioCoste || precioCompra) || 0,
        tipoIva: parseFloat(tipoIva) || 21,
        stockMinimo: parseFloat(stockMinimo) || 0,
        stockMaximo: stockMaximo ? parseFloat(stockMaximo) : null,
        controlStock: controlStock !== false,
        unidadMedida: unidadMedida || 'UND',
        permitirNegativo: permitirNegativo === true,
      },
      include: { familia: true },
    });
    res.json({ ...articulo, precioCompra: (articulo as any).precioCoste });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /almacen/articulos/:id/movimientos
router.get('/:id/movimientos', async (req: any, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      prisma.movimientoStock.findMany({
        where: { articuloId: req.params.id },
        orderBy: { createdAt: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.movimientoStock.count({ where: { articuloId: req.params.id } }),
    ]);
    res.json({ data, total, totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /almacen/articulos/:id/movimientos
router.post('/:id/movimientos', async (req: any, res: Response) => {
  try {
    const { tipo, cantidad, motivo } = req.body;
    if (!tipo || !cantidad) return res.status(400).json({ error: 'Tipo y cantidad son obligatorios' });

    const articulo = await prisma.articulo.findUnique({ where: { id: req.params.id } });
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });

    const qty = parseFloat(cantidad);
    const esEntrada = ['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'ENTRADA_DEVOLUCION', 'INVENTARIO', 'TRASPASO'].includes(tipo);
    const nuevoStock = esEntrada ? articulo.stockActual + qty : articulo.stockActual - qty;

    if (!articulo.permitirNegativo && nuevoStock < 0) {
      return res.status(400).json({ error: `Stock insuficiente. Stock actual: ${articulo.stockActual}` });
    }

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoStock.create({
        data: {
          articuloId: req.params.id,
          tipo,
          cantidad: esEntrada ? qty : -qty,
          motivo: motivo || null,
          usuarioId: req.user?.id || null,
        } as any,
      }),
      prisma.articulo.update({
        where: { id: req.params.id },
        data: { stockActual: nuevoStock },
      }),
    ]);

    res.status(201).json(movimiento);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /almacen/articulos (para TPV - alias)
// GET /almacen/familias
router.get('/familias/lista', async (req: any, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { articulos: true } } },
    });
    res.json(familias);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
