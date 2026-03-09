import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const nextNumero = async (prefijo: string, modelo: any) => {
  const year = new Date().getFullYear();
  const ultimo = await modelo.findFirst({ orderBy: { numero: 'desc' }, where: { numero: { startsWith: `${prefijo}${year}` } } });
  const n = ultimo ? parseInt(ultimo.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
  return `${prefijo}${year}-${String(n).padStart(5, '0')}`;
};

export const getPedidos = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', estado = '', clienteId = '' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [
      { numero: { contains: search, mode: 'insensitive' } },
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;

    const [data, total] = await Promise.all([
      prisma.pedidoVenta.findMany({
        where, skip, take: parseInt(limit), orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { nombre: true, cifNif: true } },
          _count: { select: { lineas: true, albaranes: true } }
        }
      }),
      prisma.pedidoVenta.count({ where })
    ]);
    res.json({ data, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getStats = async (_req: Request, res: Response) => {
  try {
    const [total, pendientes, parciales, servidos] = await Promise.all([
      prisma.pedidoVenta.count(),
      prisma.pedidoVenta.count({ where: { estado: 'PENDIENTE' } }),
      prisma.pedidoVenta.count({ where: { estado: 'PARCIALMENTE_SERVIDO' } }),
      prisma.pedidoVenta.count({ where: { estado: 'SERVIDO' } }),
    ]);
    const importe = await prisma.pedidoVenta.aggregate({
      _sum: { total: true },
      where: { estado: { in: ['PENDIENTE', 'EN_PROCESO', 'PARCIALMENTE_SERVIDO'] } }
    });
    res.json({ total, pendientes, parciales, servidos, importePendiente: importe._sum.total || 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getPedido = async (req: Request, res: Response) => {
  try {
    const p = await prisma.pedidoVenta.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        lineas: {
          include: { articulo: { select: { nombre: true, referencia: true, stockActual: true } } },
          orderBy: { orden: 'asc' }
        },
        albaranes: true,
        formaPago: true,
      }
    });
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createPedido = async (req: Request, res: Response) => {
  try {
    const { clienteId, lineas = [], observaciones, fechaEntrega, formaPagoId } = req.body;
    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario autenticado' });

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return res.status(400).json({ error: 'Cliente no encontrado' });

    const pctIva = Number(cliente.tipoIva) || 21;
    let baseImponible = 0, totalIva = 0;

    const lineasCalc = lineas.map((l: any, i: number) => {
      const base = Number(l.cantidad) * Number(l.precioUnitario) * (1 - Number(l.descuento || 0) / 100);
      const iva = base * pctIva / 100;
      baseImponible += base; totalIva += iva;
      return {
        orden: i + 1, articuloId: l.articuloId || null,
        referencia: l.referencia || null, descripcion: l.descripcion || '',
        cantidad: Number(l.cantidad), cantidadServida: 0,
        precioUnitario: Number(l.precioUnitario), descuento: Number(l.descuento || 0),
        tipoIva: pctIva, baseLinea: base, ivaLinea: iva, totalLinea: base + iva,
      };
    });

    const numero = await nextNumero('PV', prisma.pedidoVenta);
    const pedido = await prisma.pedidoVenta.create({
      data: {
        numero, clienteId, creadorId,
        fecha: new Date(),
        fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
        estado: 'PENDIENTE',
        observaciones, formaPagoId: formaPagoId || cliente.formaPagoId || null,
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasCalc }
      },
      include: { cliente: true, lineas: true }
    });
    res.status(201).json(pedido);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const updatePedido = async (req: Request, res: Response) => {
  try {
    const updated = await prisma.pedidoVenta.update({
      where: { id: req.params.id },
      data: {
        estado: req.body.estado,
        observaciones: req.body.observaciones,
        fechaEntrega: req.body.fechaEntrega ? new Date(req.body.fechaEntrega) : undefined
      }
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const deletePedido = async (req: Request, res: Response) => {
  try {
    const tiene = await prisma.albaranVenta.count({ where: { pedidoId: req.params.id } });
    if (tiene > 0) return res.status(400).json({ error: 'El pedido tiene albaranes asociados' });
    await prisma.lineaPedidoVenta.deleteMany({ where: { pedidoId: req.params.id } });
    await prisma.pedidoVenta.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const convertirAAlbaran = async (req: Request, res: Response) => {
  try {
    const pedido = await prisma.pedidoVenta.findUnique({
      where: { id: req.params.id },
      include: { lineas: true, cliente: true }
    });
    if (!pedido) return res.status(404).json({ error: 'No encontrado' });

    const year = new Date().getFullYear();
    const ultimoAlb = await prisma.albaranVenta.findFirst({ orderBy: { numero: 'desc' }, where: { numero: { startsWith: `AV${year}` } } });
    const nAlb = ultimoAlb ? parseInt(ultimoAlb.numero.replace(/\D/g, '').slice(-5)) + 1 : 1;
    const numeroAlb = `AV${year}-${String(nAlb).padStart(5, '0')}`;

    let baseImponible = 0, totalIva = 0;
    const lineasAlb = pedido.lineas
      .filter(l => Number(l.cantidad) - Number(l.cantidadServida) > 0)
      .map(l => {
        const qty = Number(l.cantidad) - Number(l.cantidadServida);
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

    if (lineasAlb.length === 0) return res.status(400).json({ error: 'No hay cantidades pendientes de servir' });

    const albaran = await prisma.albaranVenta.create({
      data: {
        numero: numeroAlb, clienteId: pedido.clienteId, pedidoId: pedido.id,
        fecha: new Date(), estado: 'PENDIENTE',
        baseImponible, totalIva, total: baseImponible + totalIva,
        lineas: { create: lineasAlb }
      },
      include: { cliente: true, lineas: true }
    });

    // Actualizar cantidades servidas
    for (const l of pedido.lineas) {
      const qty = Number(l.cantidad) - Number(l.cantidadServida);
      if (qty > 0) {
        await prisma.lineaPedidoVenta.update({
          where: { id: l.id },
          data: { cantidadServida: { increment: qty } }
        });
        // Descontar stock
        if (l.articuloId) {
          const art = await prisma.articulo.findUnique({ where: { id: l.articuloId } });
          await prisma.articulo.update({
            where: { id: l.articuloId },
            data: { stockActual: { decrement: qty } }
          });
          await prisma.movimientoStock.create({
            data: {
              articuloId: l.articuloId, tipo: 'SALIDA_VENTA',
              cantidad: qty,
              cantidadAntes: art?.stockActual || 0,
              cantidadDespues: (art?.stockActual || 0) - qty,
              concepto: `Albarán venta ${numeroAlb}`, referencia: numeroAlb,
            }
          });
        }
      }
    }

    // Estado pedido
    const pedidoAct = await prisma.pedidoVenta.findUnique({ where: { id: req.params.id }, include: { lineas: true } });
    const todoServido = pedidoAct!.lineas.every(l => Number(l.cantidadServida) >= Number(l.cantidad));
    const algunoServido = pedidoAct!.lineas.some(l => Number(l.cantidadServida) > 0);
    await prisma.pedidoVenta.update({
      where: { id: req.params.id },
      data: { estado: todoServido ? 'SERVIDO' : algunoServido ? 'PARCIALMENTE_SERVIDO' : 'PENDIENTE' }
    });

    res.json({ albaran, message: `Albarán ${numeroAlb} creado correctamente` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const convertirAFactura = async (req: Request, res: Response) => {
  try {
    const pedido = await prisma.pedidoVenta.findUnique({
      where: { id: req.params.id }, include: { lineas: true, cliente: true }
    });
    if (!pedido) return res.status(404).json({ error: 'No encontrado' });
    const creadorId = (req as any).user?.id;
    if (!creadorId) return res.status(401).json({ error: 'Sin usuario autenticado' });

    const config = await prisma.configEmpresa.findFirst();
    const serie = config?.serieFactura || 'F';
    const year = new Date().getFullYear();
    const ultimaFact = await prisma.factura.findFirst({ orderBy: { numero: 'desc' }, where: { serie, numeroCompleto: { startsWith: `${serie}/${year}` } } });
    const n = ultimaFact ? ultimaFact.numero + 1 : 1;
    const numeroCompleto = `${serie}/${year}/${String(n).padStart(5, '0')}`;

    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + (pedido.cliente.formaPagoId ? 30 : 0));

    const factura = await prisma.factura.create({
      data: {
        serie, numero: n, numeroCompleto,
        clienteId: pedido.clienteId, creadorId,
        fecha: new Date(), fechaVencimiento: vencimiento,
        estado: 'EMITIDA',
        formaPagoId: pedido.formaPagoId,
        baseImponible: pedido.baseImponible,
        totalIva: pedido.totalIva, total: pedido.total,
        lineas: {
          create: pedido.lineas.map((l, i) => ({
            orden: i + 1, articuloId: l.articuloId,
            referencia: l.referencia, descripcion: l.descripcion,
            cantidad: l.cantidad, precioUnitario: Number(l.precioUnitario),
            descuento: Number(l.descuento), tipoIva: Number(l.tipoIva),
            baseLinea: Number(l.baseLinea), ivaLinea: Number(l.ivaLinea), totalLinea: Number(l.totalLinea),
          }))
        }
      },
      include: { cliente: true, lineas: true }
    });

    await prisma.pedidoVenta.update({ where: { id: req.params.id }, data: { estado: 'FACTURADO' } });
    res.json({ factura, message: `Factura ${numeroCompleto} creada correctamente` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
