import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

// ============================================
// GET /almacen/articulos
// ============================================
router.get('/articulos', async (req: AuthRequest, res: Response) => {
  try {
    const { search, familiaId, stockBajo, activo, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (familiaId) where.familiaId = familiaId;
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

    // Filter stock bajo in JS (Prisma can't compare two fields)
    let data = articulos;
    if (stockBajo === 'true') {
      data = articulos.filter(a => a.controlStock && a.stockActual <= a.stockMinimo);
    }

    res.json({ data, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículos' });
  }
});

// GET /almacen/stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalArticulos, activos, articulos, familias, movimientosHoy] = await Promise.all([
      prisma.articulo.count(),
      prisma.articulo.count({ where: { activo: true } }),
      prisma.articulo.findMany({
        where: { controlStock: true, activo: true },
        select: { stockActual: true, stockMinimo: true },
      }),
      prisma.familiaArticulo.count(),
      prisma.movimientoStock.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    const stockBajo = articulos.filter(a => a.stockActual > 0 && a.stockActual <= a.stockMinimo).length;
    const sinStock = articulos.filter(a => a.stockActual <= 0).length;

    res.json({ totalArticulos, activos, stockBajo, sinStock, familias, movimientosHoy });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo stats' });
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
        movimientos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ ...articulo, precioCompra: articulo.precioCoste });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículo' });
  }
});

// POST /almacen/articulos
router.post('/articulos', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, referencia, descripcion, familiaId, precioVenta, precioCompra, precioCoste,
      tipoIva, stockMinimo, stockMaximo, controlStock, unidadMedida, codigoBarras, permitirNegativo,
      seVende, seCompra, imagen, observaciones } = req.body;

    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    let ref = referencia;
    if (!ref) {
      const ultimo = await prisma.articulo.findFirst({ orderBy: { referencia: 'desc' } });
      const num = ultimo ? parseInt(ultimo.referencia.replace(/\D/g, '')) + 1 : 1;
      ref = `ART${String(num).padStart(5, '0')}`;
    }

    const existe = await prisma.articulo.findUnique({ where: { referencia: ref.trim().toUpperCase() } });
    if (existe) return res.status(400).json({ error: 'Ya existe un artículo con esa referencia' });

    const articulo = await prisma.articulo.create({
      data: {
        nombre, referencia: ref.trim().toUpperCase(),
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
        seVende: seVende !== false,
        seCompra: seCompra !== false,
        imagen: imagen || null,
        observaciones: observaciones || null,
      },
      include: { familia: true },
    });
    res.status(201).json({ ...articulo, precioCompra: articulo.precioCoste });
  } catch (error) {
    res.status(500).json({ error: 'Error creando artículo' });
  }
});

// PUT /almacen/articulos/:id
router.put('/articulos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, referencia, descripcion, familiaId, precioVenta, precioCompra, precioCoste,
      tipoIva, stockMinimo, stockMaximo, controlStock, unidadMedida, codigoBarras, permitirNegativo,
      seVende, seCompra, activo, imagen, observaciones } = req.body;

    const data: any = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (referencia !== undefined) data.referencia = referencia.trim().toUpperCase();
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (familiaId !== undefined) data.familiaId = familiaId || null;
    if (codigoBarras !== undefined) data.codigoBarras = codigoBarras || null;
    if (precioVenta !== undefined) data.precioVenta = parseFloat(precioVenta) || 0;
    if (precioCoste !== undefined || precioCompra !== undefined) data.precioCoste = parseFloat(precioCoste || precioCompra) || 0;
    if (tipoIva !== undefined) data.tipoIva = parseFloat(tipoIva) || 21;
    if (stockMinimo !== undefined) data.stockMinimo = parseFloat(stockMinimo) || 0;
    if (stockMaximo !== undefined) data.stockMaximo = stockMaximo ? parseFloat(stockMaximo) : null;
    if (controlStock !== undefined) data.controlStock = controlStock;
    if (unidadMedida !== undefined) data.unidadMedida = unidadMedida || 'UND';
    if (permitirNegativo !== undefined) data.permitirNegativo = permitirNegativo;
    if (seVende !== undefined) data.seVende = seVende;
    if (seCompra !== undefined) data.seCompra = seCompra;
    if (activo !== undefined) data.activo = activo;
    if (imagen !== undefined) data.imagen = imagen || null;
    if (observaciones !== undefined) data.observaciones = observaciones || null;

    const articulo = await prisma.articulo.update({
      where: { id: req.params.id },
      data,
      include: { familia: true },
    });
    res.json({ ...articulo, precioCompra: articulo.precioCoste });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando artículo' });
  }
});

// DELETE /almacen/articulos/:id (soft delete)
router.delete('/articulos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tieneMovimientos = await prisma.movimientoStock.count({ where: { articuloId: req.params.id } });
    if (tieneMovimientos > 0) {
      await prisma.articulo.update({ where: { id: req.params.id }, data: { activo: false } });
      return res.json({ ok: true, message: 'Artículo desactivado (tiene movimientos)' });
    }
    await prisma.articulo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando artículo' });
  }
});

// ============================================
// STOCK MOVEMENTS
// ============================================

// POST /almacen/ajuste-stock
router.post('/ajuste-stock', async (req: AuthRequest, res: Response) => {
  try {
    const { articuloId, cantidad, tipo, concepto } = req.body;

    const articulo = await prisma.articulo.findUnique({ where: { id: articuloId } });
    if (!articulo) return res.status(404).json({ error: 'Artículo no encontrado' });

    const cantidadAntes = articulo.stockActual;
    const esEntrada = ['AJUSTE_POSITIVO', 'ENTRADA_COMPRA', 'ENTRADA_DEVOLUCION', 'INVENTARIO'].includes(tipo);
    const cantidadDespues = esEntrada ? cantidadAntes + cantidad : cantidadAntes - cantidad;

    if (!articulo.permitirNegativo && cantidadDespues < 0) {
      return res.status(400).json({ error: `Stock insuficiente. Actual: ${cantidadAntes}` });
    }

    await prisma.$transaction([
      prisma.articulo.update({ where: { id: articuloId }, data: { stockActual: cantidadDespues } }),
      prisma.movimientoStock.create({
        data: {
          articuloId, tipo,
          cantidad: esEntrada ? cantidad : -cantidad,
          cantidadAntes, cantidadDespues, concepto,
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
    const { items } = req.body;
    const movimientos = [];
    for (const item of items) {
      const articulo = await prisma.articulo.findUnique({ where: { id: item.articuloId } });
      if (!articulo) continue;
      const diferencia = item.cantidadReal - articulo.stockActual;
      if (diferencia === 0) continue;

      await prisma.$transaction([
        prisma.articulo.update({ where: { id: item.articuloId }, data: { stockActual: item.cantidadReal } }),
        prisma.movimientoStock.create({
          data: {
            articuloId: item.articuloId, tipo: 'INVENTARIO',
            cantidad: diferencia, cantidadAntes: articulo.stockActual,
            cantidadDespues: item.cantidadReal, concepto: 'Regularización de inventario',
          },
        }),
      ]);
      movimientos.push({ articuloId: item.articuloId, diferencia });
    }
    res.json({ movimientosCreados: movimientos.length, movimientos });
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

// ============================================
// FAMILIAS CRUD
// ============================================

// GET /almacen/familias
router.get('/familias', async (_req: AuthRequest, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      where: { padreId: null },
      include: {
        hijos: { include: { _count: { select: { articulos: true } } } },
        _count: { select: { articulos: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json(familias);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo familias' });
  }
});

// GET /almacen/familias/todas (flat list for selects)
router.get('/familias/todas', async (_req: AuthRequest, res: Response) => {
  try {
    const familias = await prisma.familiaArticulo.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { articulos: true } } },
    });
    res.json(familias);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo familias' });
  }
});

// POST /almacen/familias
router.post('/familias', async (req: AuthRequest, res: Response) => {
  try {
    const { codigo, nombre, padreId } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    let cod = codigo;
    if (!cod) {
      const ultima = await prisma.familiaArticulo.findFirst({ orderBy: { codigo: 'desc' } });
      const num = ultima ? parseInt(ultima.codigo?.replace(/\D/g, '') || '0') + 1 : 1;
      cod = `FAM${String(num).padStart(3, '0')}`;
    }

    const familia = await prisma.familiaArticulo.create({
      data: { codigo: cod, nombre, padreId: padreId || null },
      include: { _count: { select: { articulos: true } } },
    });
    res.status(201).json(familia);
  } catch (error) {
    res.status(500).json({ error: 'Error creando familia' });
  }
});

// PUT /almacen/familias/:id
router.put('/familias/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { codigo, nombre, padreId } = req.body;
    const familia = await prisma.familiaArticulo.update({
      where: { id: req.params.id },
      data: {
        ...(codigo !== undefined ? { codigo } : {}),
        ...(nombre !== undefined ? { nombre } : {}),
        ...(padreId !== undefined ? { padreId: padreId || null } : {}),
      },
      include: { _count: { select: { articulos: true } } },
    });
    res.json(familia);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando familia' });
  }
});

// DELETE /almacen/familias/:id
router.delete('/familias/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tieneArticulos = await prisma.articulo.count({ where: { familiaId: req.params.id } });
    if (tieneArticulos > 0) {
      return res.status(400).json({ error: `No se puede eliminar: tiene ${tieneArticulos} artículos` });
    }
    const tieneHijos = await prisma.familiaArticulo.count({ where: { padreId: req.params.id } });
    if (tieneHijos > 0) {
      return res.status(400).json({ error: `No se puede eliminar: tiene ${tieneHijos} subfamilias` });
    }
    await prisma.familiaArticulo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando familia' });
  }
});

// ============================================
// EXPORT CSV
// ============================================
router.get('/export-csv', async (_req: AuthRequest, res: Response) => {
  try {
    const articulos = await prisma.articulo.findMany({
      orderBy: { referencia: 'asc' },
      include: { familia: { select: { nombre: true } } },
    });
    const headers = ['Referencia', 'Nombre', 'Familia', 'Precio Venta', 'Precio Coste', 'IVA %', 'Stock', 'Stock Min', 'Unidad', 'Activo'];
    const rows = articulos.map(a => [
      a.referencia, a.nombre, a.familia?.nombre || '', a.precioVenta.toFixed(2),
      a.precioCoste.toFixed(2), `${a.tipoIva}`, a.stockActual.toString(),
      a.stockMinimo.toString(), a.unidadMedida, a.activo ? 'Si' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="articulos.csv"');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exportando CSV' });
  }
});

// ============================================
// LOTES / TRAZABILIDAD
// ============================================

// GET /almacen/lotes
router.get('/lotes', async (req: AuthRequest, res: Response) => {
  try {
    const { search, estado, articuloId, page = '1', limit = '30' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: any = {};
    if (estado) where.estado = estado;
    if (articuloId) where.articuloId = articuloId;
    if (search) {
      where.OR = [
        { lote: { contains: search as string, mode: 'insensitive' } },
        { numeroSerie: { contains: search as string, mode: 'insensitive' } },
        { articulo: { nombre: { contains: search as string, mode: 'insensitive' } } },
        { articulo: { referencia: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [lotes, total] = await Promise.all([
      prisma.loteArticulo.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: { articulo: { select: { referencia: true, nombre: true, tipoTrazabilidad: true } } },
      }),
      prisma.loteArticulo.count({ where }),
    ]);

    res.json({ data: lotes, total, totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo lotes' });
  }
});

// POST /almacen/lotes
router.post('/lotes', async (req: AuthRequest, res: Response) => {
  try {
    const { articuloId, lote: loteNum, numeroSerie, fechaCaducidad, cantidad, ubicacion } = req.body;
    if (!articuloId || !loteNum) return res.status(400).json({ error: 'Artículo y lote son obligatorios' });

    const nuevoLote = await prisma.loteArticulo.create({
      data: {
        articuloId, lote: loteNum,
        numeroSerie: numeroSerie || null,
        fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null,
        cantidad: cantidad || 0,
        ubicacion: ubicacion || null,
      },
      include: { articulo: { select: { referencia: true, nombre: true } } },
    });
    res.status(201).json(nuevoLote);
  } catch (error) {
    res.status(500).json({ error: 'Error creando lote' });
  }
});

// DELETE /almacen/lotes/:id
router.delete('/lotes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tieneMovimientos = await prisma.movimientoStock.count({ where: { loteId: req.params.id } });
    if (tieneMovimientos > 0) {
      await prisma.loteArticulo.update({ where: { id: req.params.id }, data: { estado: 'AGOTADO', cantidad: 0 } });
      return res.json({ ok: true, message: 'Lote marcado como agotado (tiene movimientos)' });
    }
    await prisma.loteArticulo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando lote' });
  }
});

// ============================================
// REPOSICIÓN
// ============================================

// GET /almacen/reposicion
router.get('/reposicion', async (req: AuthRequest, res: Response) => {
  try {
    const { filtro = 'bajo_minimo' } = req.query;

    const articulos = await prisma.articulo.findMany({
      where: { controlStock: true, activo: true },
      include: {
        familia: { select: { nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    let filtered = articulos;
    if (filtro === 'bajo_minimo') {
      filtered = articulos.filter(a => a.stockActual <= a.stockMinimo);
    } else if (filtro === 'bajo_pedido') {
      filtered = articulos.filter(a => a.puntoPedido > 0 && a.stockActual <= a.puntoPedido);
    }

    const data = filtered.map(a => ({
      ...a,
      cantidadPedir: Math.max(0, (a.stockMaximo || a.stockMinimo * 2) - a.stockActual),
    }));

    res.json({ data, total: data.length });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo artículos para reposición' });
  }
});

// ============================================
// UNIDADES DE MEDIDA
// ============================================

// GET /almacen/unidades
router.get('/unidades', async (_req: AuthRequest, res: Response) => {
  try {
    const unidades = await prisma.unidadMedida.findMany({ orderBy: { codigo: 'asc' } });
    res.json(unidades);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo unidades' });
  }
});

// POST /almacen/unidades
router.post('/unidades', async (req: AuthRequest, res: Response) => {
  try {
    const { codigo, nombre, decimales } = req.body;
    if (!codigo || !nombre) return res.status(400).json({ error: 'Código y nombre son obligatorios' });
    const unidad = await prisma.unidadMedida.create({
      data: { codigo: codigo.toUpperCase(), nombre, decimales: decimales || 0 },
    });
    res.status(201).json(unidad);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Ya existe una unidad con ese código' });
    res.status(500).json({ error: 'Error creando unidad' });
  }
});

// PUT /almacen/unidades/:id
router.put('/unidades/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { codigo, nombre, decimales, activa } = req.body;
    const data: any = {};
    if (codigo !== undefined) data.codigo = codigo.toUpperCase();
    if (nombre !== undefined) data.nombre = nombre;
    if (decimales !== undefined) data.decimales = decimales;
    if (activa !== undefined) data.activa = activa;
    const unidad = await prisma.unidadMedida.update({ where: { id: req.params.id }, data });
    res.json(unidad);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando unidad' });
  }
});

// DELETE /almacen/unidades/:id
router.delete('/unidades/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.unidadMedida.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando unidad' });
  }
});

// GET /almacen/valoracion - Inventory valuation
router.get('/valoracion', async (req: any, res: any) => {
  try {
    const articulos = await prisma.articulo.findMany({
      where: { stockActual: { gt: 0 } },
      select: {
        id: true, nombre: true, referencia: true,
        stockActual: true, precioCoste: true
      },
      orderBy: { stockActual: 'desc' }
    });

    const data = articulos.map(a => ({
      ...a,
      valorTotal: Number(a.stockActual) * Number(a.precioCoste)
    })).sort((a, b) => b.valorTotal - a.valorTotal);

    const totalGeneral = data.reduce((s, a) => s + a.valorTotal, 0);

    res.json({ data, totalGeneral });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo valoración de inventario' });
  }
});

export default router;
