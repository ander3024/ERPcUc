import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asientoFacturaCompra, asientoPago } from '../../services/contabilidad.service';

const prisma = new PrismaClient();
const router = Router();
// authMiddleware ya aplicado en app.ts

const nextNum = async (prefijo: string, modelo: any) => {
  const year = new Date().getFullYear();
  const ultimo = await modelo.findFirst({ orderBy: { numero: 'desc' }, where: { numero: { startsWith: `${prefijo}${year}` } } });
  const n = ultimo ? parseInt(ultimo.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
  return `${prefijo}${year}-${String(n).padStart(5, '0')}`;
};


// ─── PROVEEDORES ──────────────────────────────────────────────────────────────

router.get('/proveedores/stats', async (_req, res) => {
  try {
    const [total, activos] = await Promise.all([
      prisma.proveedor.count(),
      prisma.proveedor.count({ where: { activo: true } }),
    ]);
    res.json({ total, activos });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/proveedores', async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { cifNif: { contains: search, mode: 'insensitive' } },
    ];
    const [data, total] = await Promise.all([
      prisma.proveedor.findMany({ where, skip, take: parseInt(limit), orderBy: { nombre: 'asc' } }),
      prisma.proveedor.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/proveedores/:id', async (req, res) => {
  try {
    const p = await prisma.proveedor.findUnique({
      where: { id: req.params.id },
      include: { pedidos: { take: 5, orderBy: { fecha: 'desc' } } }
    });
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/proveedores', async (req, res) => {
  try {
    const { nombre, cifNif, email, telefono, direccion, observaciones } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const codigo = 'PRV' + String(await prisma.proveedor.count() + 1).padStart(5, '0');
    const proveedor = await prisma.proveedor.create({
      data: { codigo, nombre, cifNif, email, telefono, direccion, observaciones, activo: true }
    });
    res.status(201).json(proveedor);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/proveedores/:id', async (req, res) => {
  try {
    const { nombre, cifNif, email, telefono, direccion, observaciones, activo } = req.body;
    const updated = await prisma.proveedor.update({
      where: { id: req.params.id },
      data: { nombre, cifNif, email, telefono, direccion, observaciones, activo }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/proveedores/:id', async (req, res) => {
  try {
    await prisma.proveedor.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── PEDIDOS COMPRA ───────────────────────────────────────────────────────────

router.get('/pedidos/stats', async (_req, res) => {
  try {
    const [total, pendientes, parciales, recibidos] = await Promise.all([
      prisma.pedidoCompra.count(),
      prisma.pedidoCompra.count({ where: { estado: 'BORRADOR' } }),
      prisma.pedidoCompra.count({ where: { estado: 'PARCIALMENTE_RECIBIDO' } }),
      prisma.pedidoCompra.count({ where: { estado: 'RECIBIDO' } }),
    ]);
    const importe = await prisma.pedidoCompra.aggregate({
      _sum: { total: true },
      where: { estado: { in: ['BORRADOR', 'ENVIADO', 'PARCIALMENTE_RECIBIDO'] } }
    });
    res.json({ total, pendientes, parciales, recibidos, importePendiente: importe._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/pedidos', async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', ejercicio = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numero: { contains: search, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (ejercicio) { const y = parseInt(ejercicio); where.fecha = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }; }

    const [data, total] = await Promise.all([
      prisma.pedidoCompra.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: { proveedor: { select: { nombre: true, cifNif: true } }, _count: { select: { lineas: true } } }
      }),
      prisma.pedidoCompra.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/pedidos/:id', async (req, res) => {
  try {
    const p = await prisma.pedidoCompra.findUnique({
      where: { id: req.params.id },
      include: {
        proveedor: true,
        lineas: { include: { articulo: { select: { nombre: true, referencia: true, stockActual: true } } }, orderBy: { orden: 'asc' } },
        albaranes: true,
      }
    });
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/pedidos', async (req, res) => {
  try {
    const { proveedorId, lineas = [], observaciones, fechaEntrega } = req.body;
    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario' });

    const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
    if (!proveedor) return res.status(400).json({ error: 'Proveedor no encontrado' });

    let baseImponible = 0, totalIva = 0;
    const lineasCalc = lineas.map((l: any, i: number) => {
      const pctIva = Number(l.tipoIva || proveedor.tipoIva || 21);
      const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
      const iva = base * pctIva / 100;
      baseImponible += base; totalIva += iva;
      return {
        orden: i + 1, articuloId: l.articuloId || null,
        referencia: l.referencia || null, descripcion: l.descripcion || '',
        cantidad: Number(l.cantidad), cantidadRecibida: 0,
        precioUnitario: Number(l.precioUnitario), descuento: Number(l.descuento || 0),
        tipoIva: pctIva, baseLinea: base, ivaLinea: iva, totalLinea: base + iva,
      };
    });

    const numero = await nextNum('PC', prisma.pedidoCompra);
    const pedido = await prisma.pedidoCompra.create({
      data: {
        numero, proveedorId, creadorId,
        fecha: new Date(), fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
        estado: 'BORRADOR', observaciones,
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasCalc }
      },
      include: { proveedor: true, lineas: true }
    });
    res.status(201).json(pedido);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/pedidos/:id', async (req, res) => {
  try {
    const updated = await prisma.pedidoCompra.update({
      where: { id: req.params.id },
      data: { estado: req.body.estado, observaciones: req.body.observaciones }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/pedidos/:id/convertir-albaran', async (req, res) => {
  try {
    const pedido = await prisma.pedidoCompra.findUnique({
      where: { id: req.params.id }, include: { lineas: true, proveedor: true }
    });
    if (!pedido) return res.status(404).json({ error: 'No encontrado' });

    const numero = await nextNum('AC', prisma.albaranCompra);
    let baseImponible = 0, totalIva = 0;

    const lineasAlb = pedido.lineas
      .filter(l => Number(l.cantidad) - Number(l.cantidadRecibida) > 0)
      .map(l => {
        const qty = Number(l.cantidad) - Number(l.cantidadRecibida);
        const base = qty * Number(l.precioUnitario) * (1 - Number(l.descuento) / 100);
        const iva = base * Number(l.tipoIva) / 100;
        baseImponible += base; totalIva += iva;
        return {
          orden: l.orden, articuloId: l.articuloId,
          referencia: l.referencia, descripcion: l.descripcion,
          cantidad: qty, precioUnitario: Number(l.precioUnitario),
          descuento: Number(l.descuento), tipoIva: Number(l.tipoIva),
          baseLinea: base, ivaLinea: iva, totalLinea: base + iva,
        };
      });

    if (lineasAlb.length === 0) return res.status(400).json({ error: 'No hay cantidades pendientes' });

    const albaran = await prisma.albaranCompra.create({
      data: {
        numero, proveedorId: pedido.proveedorId, pedidoId: pedido.id,
        fecha: new Date(), estado: 'PENDIENTE',
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasAlb }
      },
      include: { proveedor: true, lineas: true }
    });

    // Actualizar cantidades recibidas y aumentar stock
    for (const l of pedido.lineas) {
      const qty = Number(l.cantidad) - Number(l.cantidadRecibida);
      if (qty > 0) {
        await prisma.lineaPedidoCompra.update({
          where: { id: l.id }, data: { cantidadRecibida: { increment: qty } }
        });
        if (l.articuloId) {
          const art = await prisma.articulo.findUnique({ where: { id: l.articuloId } });
          await prisma.articulo.update({ where: { id: l.articuloId }, data: { stockActual: { increment: qty } } });
          await prisma.movimientoStock.create({
            data: {
              articuloId: l.articuloId, tipo: 'ENTRADA_COMPRA',
              cantidad: qty, cantidadAntes: art?.stockActual || 0,
              cantidadDespues: (art?.stockActual || 0) + qty,
              concepto: `Albarán compra ${numero}`, referencia: numero,
            }
          });
        }
      }
    }

    const pedidoAct = await prisma.pedidoCompra.findUnique({ where: { id: req.params.id }, include: { lineas: true } });
    const todoRecibido = pedidoAct!.lineas.every(l => Number(l.cantidadRecibida) >= Number(l.cantidad));
    const algunoRecibido = pedidoAct!.lineas.some(l => Number(l.cantidadRecibida) > 0);
    await prisma.pedidoCompra.update({
      where: { id: req.params.id },
      data: { estado: todoRecibido ? 'RECIBIDO' : algunoRecibido ? 'PARCIALMENTE_RECIBIDO' : 'BORRADOR' }
    });

    res.json({ albaran, message: `Albarán compra ${numero} creado` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── ALBARANES COMPRA ─────────────────────────────────────────────────────────

router.get('/albaranes/stats', async (_req, res) => {
  try {
    const [total, pendientes, facturados] = await Promise.all([
      prisma.albaranCompra.count(),
      prisma.albaranCompra.count({ where: { estado: 'PENDIENTE' } }),
      prisma.albaranCompra.count({ where: { estado: 'FACTURADO' } }),
    ]);
    const importe = await prisma.albaranCompra.aggregate({ _sum: { total: true }, where: { estado: 'PENDIENTE' } });
    res.json({ total, pendientes, facturados, importePendiente: importe._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/albaranes', async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', ejercicio = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numero: { contains: search, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (ejercicio) { const y = parseInt(ejercicio); where.fecha = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }; }

    const [data, total] = await Promise.all([
      prisma.albaranCompra.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: { proveedor: { select: { nombre: true } }, pedido: { select: { numero: true } } }
      }),
      prisma.albaranCompra.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/albaranes/:id', async (req, res) => {
  try {
    const a = await prisma.albaranCompra.findUnique({
      where: { id: req.params.id },
      include: { proveedor: true, pedido: true, lineas: { include: { articulo: { select: { nombre: true } } }, orderBy: { orden: 'asc' } } }
    });
    if (!a) return res.status(404).json({ error: 'No encontrado' });
    res.json(a);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/albaranes', async (req, res) => {
  try {
    const { proveedorId, lineas = [], observaciones, pedidoId } = req.body;
    if (!proveedorId) return res.status(400).json({ error: 'proveedorId requerido' });

    let baseImponible = 0, totalIva = 0;
    const lineasCalc = lineas.map((l: any, i: number) => {
      const pctIva = Number(l.tipoIva || 21);
      const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
      const iva = base * pctIva / 100;
      baseImponible += base; totalIva += iva;
      return {
        orden: i + 1,
        articuloId: l.articuloId || null,
        referencia: l.referencia || null,
        descripcion: l.descripcion || '',
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        descuento: Number(l.descuento || 0),
        tipoIva: pctIva,
        baseLinea: base,
        ivaLinea: iva,
        totalLinea: base + iva,
      };
    });

    const numero = await nextNum('AC', prisma.albaranCompra);
    const albaran = await prisma.albaranCompra.create({
      data: {
        numero,
        proveedorId,
        pedidoId: pedidoId || null,
        fecha: new Date(),
        estado: 'PENDIENTE',
        observaciones,
        baseImponible,
        totalIva,
        total: baseImponible + totalIva,
        lineas: { create: lineasCalc },
      },
      include: { proveedor: true, lineas: true },
    });

    // Update stock for lines with articuloId
    for (const l of lineas) {
      if (l.articuloId) {
        const qty = Number(l.cantidad);
        const art = await prisma.articulo.findUnique({ where: { id: l.articuloId } });
        await prisma.articulo.update({ where: { id: l.articuloId }, data: { stockActual: { increment: qty } } });
        await prisma.movimientoStock.create({
          data: {
            articuloId: l.articuloId,
            tipo: 'ENTRADA_COMPRA',
            cantidad: qty,
            cantidadAntes: art?.stockActual || 0,
            cantidadDespues: (art?.stockActual || 0) + qty,
            concepto: `Albarán compra ${numero}`,
            referencia: numero,
          },
        });
      }
    }

    res.status(201).json(albaran);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/albaranes/:id', async (req, res) => {
  try {
    const { observaciones, estado } = req.body;
    const updated = await prisma.albaranCompra.update({
      where: { id: req.params.id },
      data: { observaciones, estado },
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/albaranes/:id', async (req, res) => {
  try {
    const albaran = await prisma.albaranCompra.findUnique({ where: { id: req.params.id } });
    if (!albaran) return res.status(404).json({ error: 'No encontrado' });
    if (albaran.estado === 'FACTURADO') return res.status(400).json({ error: 'No se puede eliminar un albarán facturado' });
    await prisma.lineaAlbaranCompra.deleteMany({ where: { albaranId: req.params.id } });
    await prisma.albaranCompra.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/albaranes/:id/convertir-factura', async (req, res) => {
  try {
    const albaran = await prisma.albaranCompra.findUnique({
      where: { id: req.params.id }, include: { lineas: true, proveedor: true }
    });
    if (!albaran) return res.status(404).json({ error: 'No encontrado' });
    if (albaran.estado === 'FACTURADO') return res.status(400).json({ error: 'Ya está facturado' });

    const numeroProveedor = req.body.numeroFacturaProveedor || `EXT-${Date.now()}`;
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 30);

    const factura = await prisma.facturaCompra.create({
      data: {
        numeroProveedor,
        proveedorId: albaran.proveedorId,
        fecha: new Date(), fechaVencimiento: vencimiento,
        estado: 'EMITIDA',
        baseImponible: albaran.baseImponible,
        totalIva: albaran.totalIva, total: albaran.total,
        lineas: {
          create: albaran.lineas.map((l, i) => ({
            orden: i + 1, articuloId: l.articuloId,
            referencia: l.referencia, descripcion: l.descripcion,
            cantidad: l.cantidad, precioUnitario: Number(l.precioUnitario),
            descuento: Number(l.descuento), tipoIva: Number(l.tipoIva),
            baseLinea: Number(l.baseLinea), ivaLinea: Number(l.ivaLinea), totalLinea: Number(l.totalLinea),
          }))
        }
      },
      include: { proveedor: true, lineas: true }
    });

    await prisma.facturaCompraAlbaran.create({ data: { facturaId: factura.id, albaranId: albaran.id } });
    await prisma.albaranCompra.update({ where: { id: req.params.id }, data: { estado: 'FACTURADO', facturado: true } });

    // Asiento contable automático
    const creadorId = (req as any).user?.id || 'system';
    asientoFacturaCompra(factura, creadorId).catch(() => {});

    res.json({ factura, message: `Factura compra ${numeroProveedor} creada` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── FACTURAS COMPRA ──────────────────────────────────────────────────────────

router.get('/facturas/stats', async (_req, res) => {
  try {
    const [total, pendientes, pagadas] = await Promise.all([
      prisma.facturaCompra.count(),
      prisma.facturaCompra.count({ where: { estado: 'EMITIDA' } }),
      prisma.facturaCompra.count({ where: { estado: 'COBRADA' } }),
    ]);
    const pendienteTotal = await prisma.facturaCompra.aggregate({ _sum: { total: true }, where: { estado: 'EMITIDA' } });
    res.json({ total, pendientes, pagadas, pendienteTotal: pendienteTotal._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/facturas', async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', ejercicio = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numeroProveedor: { contains: search, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (ejercicio) { const y = parseInt(ejercicio); where.fecha = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }; }

    const [data, total] = await Promise.all([
      prisma.facturaCompra.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: { proveedor: { select: { nombre: true } }, pagos: { select: { importe: true } } }
      }),
      prisma.facturaCompra.count({ where })
    ]);

    const dataConPagado = data.map(f => ({
      ...f,
      numero: f.numeroProveedor,
      pagado: f.pagos.reduce((s, p) => s + Number(p.importe), 0),
      pendiente: Number(f.total) - f.pagos.reduce((s, p) => s + Number(p.importe), 0),
    }));
    res.json({ data: dataConPagado, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/facturas/:id', async (req, res) => {
  try {
    const f = await prisma.facturaCompra.findUnique({
      where: { id: req.params.id },
      include: { proveedor: true, lineas: true, pagos: true }
    });
    if (!f) return res.status(404).json({ error: 'No encontrado' });
    const pagado = f.pagos.reduce((s, p) => s + Number(p.importe), 0);
    res.json({ ...f, numero: f.numeroProveedor, pagado, pendiente: Number(f.total) - pagado });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/facturas', async (req, res) => {
  try {
    const { proveedorId, numeroProveedor, lineas = [], observaciones, fechaVencimiento } = req.body;
    if (!proveedorId) return res.status(400).json({ error: 'proveedorId requerido' });
    if (!numeroProveedor) return res.status(400).json({ error: 'numeroProveedor requerido' });

    let baseImponible = 0, totalIva = 0;
    const lineasCalc = lineas.map((l: any, i: number) => {
      const pctIva = Number(l.tipoIva || 21);
      const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
      const iva = base * pctIva / 100;
      baseImponible += base; totalIva += iva;
      return {
        orden: i + 1,
        articuloId: l.articuloId || null,
        referencia: l.referencia || null,
        descripcion: l.descripcion || '',
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        descuento: Number(l.descuento || 0),
        tipoIva: pctIva,
        baseLinea: base,
        ivaLinea: iva,
        totalLinea: base + iva,
      };
    });

    const vencimiento = fechaVencimiento
      ? new Date(fechaVencimiento)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

    const factura = await prisma.facturaCompra.create({
      data: {
        numeroProveedor,
        proveedorId,
        fecha: new Date(),
        fechaVencimiento: vencimiento,
        estado: 'EMITIDA',
        observaciones,
        baseImponible,
        totalIva,
        total: baseImponible + totalIva,
        lineas: { create: lineasCalc },
      },
      include: { proveedor: true, lineas: true },
    });

    // Asiento contable automático
    const creadorId = (req as any).user?.id || 'system';
    asientoFacturaCompra(factura, creadorId).catch(() => {});

    res.status(201).json(factura);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/facturas/:id', async (req, res) => {
  try {
    const { observaciones, estado, numeroProveedor } = req.body;
    const updated = await prisma.facturaCompra.update({
      where: { id: req.params.id },
      data: { observaciones, estado, numeroProveedor },
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/facturas/:id', async (req, res) => {
  try {
    const factura = await prisma.facturaCompra.findUnique({
      where: { id: req.params.id },
      include: { pagos: true },
    });
    if (!factura) return res.status(404).json({ error: 'No encontrado' });
    if (factura.pagos.length > 0) return res.status(400).json({ error: 'No se puede eliminar una factura con pagos' });
    await prisma.lineaFacturaCompra.deleteMany({ where: { facturaId: req.params.id } });
    await prisma.facturaCompraAlbaran.deleteMany({ where: { facturaId: req.params.id } });
    await prisma.facturaCompra.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── PAGOS ────────────────────────────────────────────────────────────────────

router.get('/pagos/pendientes', async (_req, res) => {
  try {
    const facturas = await prisma.facturaCompra.findMany({
      where: { estado: 'EMITIDA' },
      include: { proveedor: { select: { nombre: true } }, pagos: { select: { importe: true } } },
      orderBy: { fechaVencimiento: 'asc' }
    });
    const pendientes = facturas.map(f => {
      const pagado = f.pagos.reduce((s, p) => s + Number(p.importe), 0);
      return { ...f, numero: f.numeroProveedor, pagado, pendiente: Number(f.total) - pagado };
    }).filter(f => f.pendiente > 0.01);
    res.json(pendientes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/pagos', async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', ejercicio = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (ejercicio) { const y = parseInt(ejercicio); where.fecha = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }; }
    if (search) where.OR = [
      { proveedor: { nombre: { contains: search, mode: 'insensitive' } } },
      { factura: { numeroProveedor: { contains: search, mode: 'insensitive' } } },
    ];

    const [data, total] = await Promise.all([
      prisma.pago.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { fecha: 'desc' },
        include: {
          proveedor: { select: { nombre: true } },
          factura: { select: { numeroProveedor: true, total: true } },
        },
      }),
      prisma.pago.count({ where }),
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/pagos', async (req, res) => {
  try {
    const { facturaId, importe, fecha, formaPago } = req.body;
    const factura = await prisma.facturaCompra.findUnique({
      where: { id: facturaId }, include: { pagos: true }
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const pagado = factura.pagos.reduce((s, p) => s + Number(p.importe), 0);
    if (pagado + Number(importe) > Number(factura.total) + 0.01) {
      return res.status(400).json({ error: 'Importe supera el pendiente' });
    }

    const pago = await prisma.pago.create({
      data: {
        facturaId,
        proveedorId: factura.proveedorId, // requerido por schema
        importe: Number(importe),
        fecha: fecha ? new Date(fecha) : new Date(),
        formaPago: formaPago || 'Transferencia',
      }
    });

    const nuevoPagado = pagado + Number(importe);
    if (nuevoPagado >= Number(factura.total) - 0.01) {
      await prisma.facturaCompra.update({ where: { id: facturaId }, data: { estado: 'COBRADA', totalPagado: nuevoPagado } });
    } else {
      await prisma.facturaCompra.update({ where: { id: facturaId }, data: { totalPagado: nuevoPagado } });
    }

    // Asiento contable automático
    const creadorId = (req as any).user?.id || 'system';
    asientoPago({ importe: Number(importe), formaPago: formaPago || 'Transferencia' }, factura.numeroProveedor, creadorId).catch(() => {});

    res.status(201).json(pago);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/pagos/:id', async (req, res) => {
  try {
    const pago = await prisma.pago.findUnique({ where: { id: req.params.id } });
    if (!pago) return res.status(404).json({ error: 'No encontrado' });
    await prisma.pago.delete({ where: { id: req.params.id } });

    const pagos = await prisma.pago.findMany({ where: { facturaId: pago.facturaId } });
    const totalPagado = pagos.reduce((s, p) => s + Number(p.importe), 0);
    await prisma.facturaCompra.update({ where: { id: pago.facturaId }, data: { estado: 'EMITIDA', totalPagado } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
