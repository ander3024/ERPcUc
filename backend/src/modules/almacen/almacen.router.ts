import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /almacen/articulos
router.get('/articulos', async (req: AuthRequest, res: Response) => {
  try {
    const { search, familiaId, stockBajo, activo, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (familiaId) where.familiaId = familiaId;
    if (stockBajo === 'true') {
      where.controlStock = true;
      where.stockActual = { lte: prisma.articulo.fields.stockMinimo };
    }
    if (search) {
      where.OR = [
        { nombre: { contains: search as string, mode: 'insensitive' } },
        { referencia: { contains: search as string, mode: 'insensitive' } },
        { codigoBarras: { contains: search as string } },
      ];
    }

    const [articulos, total] = await Promise.all([
      prisma.articulo.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { nombre: 'asc' },
        include: { familia: { select: { nombre: true } } },
      }),
      prisma.articulo.count({ where }),
    ]);

    res.json({ data: articulos, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículos' });
  }
});

// GET /almacen/articulos/:id
router.get('/articulos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const articulo = await prisma.articulo.findUnique({
      where: { id: req.params.id },
      include: {
        familia: true,
        lotes: { where: { cantidad: { gt: 0 } } },
        tarifa: true,
        movimientos: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(articulo);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículo' });
  }
});

// POST /almacen/articulos
router.post('/articulos', async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    if (!data.referencia) {
      const ultimo = await prisma.articulo.findFirst({ orderBy: { referencia: 'desc' } });
      const num = ultimo ? parseInt(ultimo.referencia.replace(/\D/g, '')) + 1 : 1;
      data.referencia = `ART${String(num).padStart(5, '0')}`;
    }

    const articulo = await prisma.articulo.create({ data });
    res.status(201).json(articulo);
  } catch (error) {
    res.status(500).json({ error: 'Error creando artículo' });
  }
});

// PUT /almacen/articulos/:id
router.put('/articulos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const articulo = await prisma.articulo.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(articulo);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando artículo' });
  }
});

// POST /almacen/ajuste-stock
router.post('/ajuste-stock', async (req: AuthRequest, res: Response) => {
  try {
    const { articuloId, cantidad, tipo, concepto } = req.body;

    const articulo = await prisma.articulo.findUnique({ where: { id: articuloId } });
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });

    const cantidadAntes = articulo.stockActual;
    const cantidadDespues = tipo === 'AJUSTE_POSITIVO'
      ? cantidadAntes + cantidad
      : cantidadAntes - cantidad;

    await prisma.$transaction([
      prisma.articulo.update({
        where: { id: articuloId },
        data: { stockActual: cantidadDespues },
      }),
      prisma.movimientoStock.create({
        data: {
          articuloId,
          tipo,
          cantidad: tipo === 'AJUSTE_POSITIVO' ? cantidad : -cantidad,
          cantidadAntes,
          cantidadDespues,
          concepto,
        },
      }),
    ]);

    res.json({ cantidadAntes, cantidadDespues });
  } catch (error) {
    res.status(500).json({ error: 'Error ajustando stock' });
  }
});

// POST /almacen/inventario
router.post('/inventario', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // [{ articuloId, cantidadReal }]

    const movimientos = [];
    for (const item of items) {
      const articulo = await prisma.articulo.findUnique({ where: { id: item.articuloId } });
      if (!articulo) continue;

      const diferencia = item.cantidadReal - articulo.stockActual;
      if (diferencia === 0) continue;

      await prisma.articulo.update({
        where: { id: item.articuloId },
        data: { stockActual: item.cantidadReal },
      });

      const mov = await prisma.movimientoStock.create({
        data: {
          articuloId: item.articuloId,
          tipo: 'INVENTARIO',
          cantidad: diferencia,
          cantidadAntes: articulo.stockActual,
          cantidadDespues: item.cantidadReal,
          concepto: 'Regularización de inventario',
        },
      });
      movimientos.push(mov);
    }

    res.json({ movimientosCreados: movimientos.length });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando inventario' });
  }
});

// GET /almacen/movimientos
router.get('/movimientos', async (req: AuthRequest, res: Response) => {
  try {
    const { articuloId, tipo, desde, hasta, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (articuloId) where.articuloId = articuloId;
    if (tipo) where.tipo = tipo;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde as string);
      if (hasta) where.createdAt.lte = new Date(hasta as string);
    }

    const [movimientos, total] = await Promise.all([
      prisma.movimientoStock.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { articulo: { select: { referencia: true, nombre: true } } },
      }),
      prisma.movimientoStock.count({ where }),
    ]);

    res.json({ data: movimientos, total, totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo movimientos' });
  }
});

// GET /almacen/familias
router.get('/familias', async (req: AuthRequest, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      where: { padreId: null },
      include: {
        hijos: true,
        _count: { select: { articulos: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(familias);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo familias' });
  }
});

export default router;
