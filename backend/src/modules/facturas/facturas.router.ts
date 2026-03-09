import { getIO } from '../../config/socket';
import { Router, Response } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';


const router = Router();

const lineaSchema = z.object({
  articuloId: z.string().optional(),
  orden: z.number(),
  referencia: z.string().optional(),
  descripcion: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  descuento: z.number().default(0),
  tipoIva: z.number(),
});

const facturaSchema = z.object({
  clienteId: z.string(),
  fecha: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  formaPagoId: z.string().optional(),
  observaciones: z.string().optional(),
  lineas: z.array(lineaSchema),
});

function calcularTotales(lineas: any[]) {
  let baseImponible = 0, totalIva = 0;
  const lineasCalc = lineas.map(l => {
    const base = l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
    const iva = base * (l.tipoIva / 100);
    baseImponible += base;
    totalIva += iva;
    return { ...l, baseLinea: base, ivaLinea: iva, totalLinea: base + iva };
  });
  return { lineas: lineasCalc, baseImponible, totalIva, total: baseImponible + totalIva };
}

// GET /facturas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, estado, clienteId, desde, hasta, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde as string);
      if (hasta) where.fecha.lte = new Date(hasta as string);
    }
    if (search) {
      where.OR = [
        { numeroCompleto: { contains: search as string, mode: 'insensitive' } },
        { cliente: { nombre: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [facturas, total] = await Promise.all([
      prisma.factura.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { fecha: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true, cifNif: true } },
          formaPago: { select: { nombre: true } },
        },
      }),
      prisma.factura.count({ where }),
    ]);

    res.json({ data: facturas, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
});

// GET /facturas/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        creador: { select: { nombre: true, email: true } },
        lineas: { orderBy: { orden: 'asc' }, include: { articulo: { select: { referencia: true } } } },
        cobros: true,
        formaPago: true,
      },
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(factura);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo factura' });
  }
});

// POST /facturas
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = facturaSchema.parse(req.body);

    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.status(500).json({ error: 'Configuración de empresa no encontrada' });

    const serie = config.serieFactura;
    const numero = config.contadorFactura;
    const año = new Date().getFullYear();
    const numeroCompleto = `${serie}/${año}/${String(numero).padStart(4, '0')}`;

    const { lineas, baseImponible, totalIva, total } = calcularTotales(body.lineas);

    const factura = await prisma.$transaction(async (tx) => {
      // Incrementar contador
      await tx.configEmpresa.update({
        where: { id: config.id },
        data: { contadorFactura: { increment: 1 } },
      });

      const f = await tx.factura.create({
        data: {
          serie,
          numero,
          numeroCompleto,
          clienteId: body.clienteId,
          creadorId: req.user!.id,
          fecha: body.fecha ? new Date(body.fecha) : new Date(),
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
          formaPagoId: body.formaPagoId,
          observaciones: body.observaciones,
          baseImponible,
          totalIva,
          total,
          lineas: { create: lineas },
        },
        include: { cliente: true, lineas: true },
      });

      // Registrar en auditoría
      await tx.auditoriaLog.create({
        data: {
          usuarioId: req.user!.id,
          accion: 'CREAR_FACTURA',
          entidad: 'Factura',
          entidadId: f.id,
          datosDespues: f as any,
        },
      });

      return f;
    });

    // Notificar en tiempo real
    getIO().to('empresa').emit('factura:nueva', { id: factura.id, numero: numeroCompleto, total });

    res.status(201).json(factura);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
    res.status(500).json({ error: 'Error creando factura' });
  }
});

// POST /facturas/:id/cobro
router.post('/:id/cobro', async (req: AuthRequest, res: Response) => {
  try {
    const { importe, formaPago, fecha, referencia } = req.body;
    const factura = await prisma.factura.findUnique({ where: { id: req.params.id } });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const cobro = await prisma.$transaction(async (tx) => {
      const c = await tx.cobro.create({
        data: {
          facturaId: req.params.id,
          clienteId: factura.clienteId,
          importe,
          formaPago,
          fecha: fecha ? new Date(fecha) : new Date(),
          referencia,
        },
      });

      const totalPagado = factura.totalPagado + importe;
      const nuevoEstado = totalPagado >= factura.total ? 'COBRADA' : 'PARCIALMENTE_COBRADA';

      await tx.factura.update({
        where: { id: req.params.id },
        data: { totalPagado, estado: nuevoEstado as any },
      });

      return c;
    });

    res.status(201).json(cobro);
  } catch (error) {
    res.status(500).json({ error: 'Error registrando cobro' });
  }
});

// GET /facturas/:id/pdf
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        lineas: { orderBy: { orden: 'asc' } },
        formaPago: true,
      },
    });

    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const empresa = await prisma.configEmpresa.findFirst();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${factura.numeroCompleto}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Header empresa
    doc.fontSize(20).font('Helvetica-Bold').text(empresa?.nombre || 'Mi Empresa', 50, 50);
    doc.fontSize(9).font('Helvetica')
      .text(empresa?.direccion || '', 50, 80)
      .text(`CIF: ${empresa?.cif || ''}`, 50, 95)
      .text(empresa?.telefono || '', 50, 110);

    // Título factura
    doc.fontSize(24).font('Helvetica-Bold')
      .fillColor('#1e40af')
      .text('FACTURA', 400, 50, { align: 'right' });

    doc.fontSize(11).fillColor('#000')
      .text(`Nº: ${factura.numeroCompleto}`, 400, 85, { align: 'right' })
      .text(`Fecha: ${factura.fecha.toLocaleDateString('es-ES')}`, 400, 100, { align: 'right' });

    // Datos cliente
    doc.roundedRect(50, 140, 240, 80, 5).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).text('FACTURAR A', 60, 150);
    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold')
      .text(factura.cliente.nombre, 60, 162);
    doc.font('Helvetica').fontSize(9)
      .text(factura.cliente.cifNif ? `CIF: ${factura.cliente.cifNif}` : '', 60, 176)
      .text(factura.cliente.direccion || '', 60, 190)
      .text([factura.cliente.codigoPostal, factura.cliente.ciudad].filter(Boolean).join(' '), 60, 204);

    // Tabla de líneas
    const tableTop = 250;
    doc.fillColor('#1e40af').rect(50, tableTop, 500, 20).fill();
    doc.fillColor('#fff').fontSize(9)
      .text('DESCRIPCIÓN', 55, tableTop + 6)
      .text('CANT.', 320, tableTop + 6, { width: 50, align: 'right' })
      .text('PRECIO', 370, tableTop + 6, { width: 60, align: 'right' })
      .text('DTO.', 430, tableTop + 6, { width: 30, align: 'right' })
      .text('TOTAL', 460, tableTop + 6, { width: 90, align: 'right' });

    let y = tableTop + 25;
    factura.lineas.forEach((linea, i) => {
      if (i % 2 === 0) {
        doc.fillColor('#f8fafc').rect(50, y - 3, 500, 18).fill();
      }
      doc.fillColor('#000').fontSize(9)
        .text(linea.descripcion, 55, y, { width: 260 })
        .text(linea.cantidad.toString(), 320, y, { width: 50, align: 'right' })
        .text(`${linea.precioUnitario.toFixed(2)}€`, 370, y, { width: 60, align: 'right' })
        .text(`${linea.descuento}%`, 430, y, { width: 30, align: 'right' })
        .text(`${linea.totalLinea.toFixed(2)}€`, 460, y, { width: 90, align: 'right' });
      y += 20;
    });

    // Totales
    y += 10;
    doc.moveTo(50, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
    y += 15;

    const totalesX = 380;
    doc.fillColor('#64748b').fontSize(9)
      .text('Base Imponible:', totalesX, y)
      .text(`${factura.baseImponible.toFixed(2)}€`, totalesX + 110, y, { align: 'right', width: 60 });
    y += 15;
    doc.text('IVA:', totalesX, y)
      .text(`${factura.totalIva.toFixed(2)}€`, totalesX + 110, y, { align: 'right', width: 60 });
    y += 5;
    doc.moveTo(totalesX, y + 10).lineTo(550, y + 10).stroke();
    y += 15;
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold')
      .text('TOTAL:', totalesX, y)
      .text(`${factura.total.toFixed(2)}€`, totalesX + 110, y, { align: 'right', width: 60 });

    // Forma de pago
    if (factura.formaPago) {
      y += 30;
      doc.fontSize(9).font('Helvetica').fillColor('#64748b')
        .text(`Forma de pago: ${factura.formaPago.nombre}`, 50, y);
    }

    // Observaciones
    if (factura.observaciones) {
      y += 20;
      doc.fontSize(8).fillColor('#64748b').text(`Observaciones: ${factura.observaciones}`, 50, y);
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ error: 'Error generando PDF' });
  }
});

// Resumen para dashboard
router.get('/resumen/stats', async (req: AuthRequest, res: Response) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [emitidas, cobradas, vencidas, totalMes] = await Promise.all([
      prisma.factura.count({ where: { estado: 'EMITIDA' } }),
      prisma.factura.count({ where: { estado: 'COBRADA' } }),
      prisma.factura.count({ where: { estado: 'VENCIDA' } }),
      prisma.factura.aggregate({
        where: { fecha: { gte: inicioMes }, estado: { not: 'ANULADA' } },
        _sum: { total: true },
      }),
    ]);

    res.json({ emitidas, cobradas, vencidas, totalMes: totalMes._sum.total || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo stats' });
  }
});

export default router;
