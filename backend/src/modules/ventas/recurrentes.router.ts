import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { generarVencimientos } from '../../services/vencimientos.service';

const prisma = new PrismaClient();
const router = Router();

function calcularSiguienteEmision(actual: Date, periodicidad: string, diaEmision: number): Date {
  const fecha = new Date(actual);

  switch (periodicidad) {
    case 'SEMANAL':
      fecha.setDate(fecha.getDate() + 7);
      return fecha;
    case 'QUINCENAL':
      fecha.setDate(fecha.getDate() + 15);
      return fecha;
    case 'MENSUAL':
      fecha.setMonth(fecha.getMonth() + 1);
      fecha.setDate(diaEmision);
      return fecha;
    case 'BIMESTRAL':
      fecha.setMonth(fecha.getMonth() + 2);
      fecha.setDate(diaEmision);
      return fecha;
    case 'TRIMESTRAL':
      fecha.setMonth(fecha.getMonth() + 3);
      fecha.setDate(diaEmision);
      return fecha;
    case 'SEMESTRAL':
      fecha.setMonth(fecha.getMonth() + 6);
      fecha.setDate(diaEmision);
      return fecha;
    case 'ANUAL':
      fecha.setMonth(fecha.getMonth() + 12);
      fecha.setDate(diaEmision);
      return fecha;
    default:
      fecha.setMonth(fecha.getMonth() + 1);
      fecha.setDate(diaEmision);
      return fecha;
  }
}

// GET / — list all recurring invoices
router.get('/', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.facturaRecurrente.findMany({
        where,
        include: { cliente: true },
        orderBy: { proximaEmision: 'asc' },
        skip,
        take: limit,
      }),
      prisma.facturaRecurrente.count({ where }),
    ]);

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error listando facturas recurrentes' });
  }
});

// GET /pendientes — active ones with proximaEmision <= today
router.get('/pendientes', async (req: any, res: any) => {
  try {
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);

    const pendientes = await prisma.facturaRecurrente.findMany({
      where: {
        activa: true,
        proximaEmision: { lte: hoy },
      },
      include: { cliente: true },
      orderBy: { proximaEmision: 'asc' },
    });

    res.json(pendientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo pendientes' });
  }
});

// POST /procesar — emit all pending recurring invoices
router.post('/procesar', async (req: any, res: any) => {
  try {
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);

    const pendientes = await prisma.facturaRecurrente.findMany({
      where: {
        activa: true,
        proximaEmision: { lte: hoy },
      },
    });

    const resultados: any[] = [];
    const errores: any[] = [];

    for (const recurrente of pendientes) {
      try {
        const resultado = await emitirFacturaRecurrente(recurrente.id, req.user?.id);
        resultados.push(resultado);
      } catch (err: any) {
        errores.push({ id: recurrente.id, error: err.message });
      }
    }

    res.json({ procesadas: resultados.length, errores, resultados });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando facturas recurrentes' });
  }
});

// POST / — create recurring invoice
router.post('/', async (req: any, res: any) => {
  try {
    const { lineas, ...data } = req.body;

    const recurrente = await prisma.facturaRecurrente.create({
      data: {
        ...data,
        lineas: {
          create: lineas || [],
        },
      },
      include: { lineas: true, cliente: true },
    });

    res.status(201).json(recurrente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando factura recurrente' });
  }
});

// GET /:id — detail
router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const recurrente = await prisma.facturaRecurrente.findUnique({
      where: { id },
      include: {
        lineas: true,
        cliente: true,
        formaPago: true,
        facturas: {
          orderBy: { fecha: 'desc' },
          take: 10,
        },
      },
    });

    if (!recurrente) {
      return res.status(404).json({ error: 'Factura recurrente no encontrada' });
    }

    res.json(recurrente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo factura recurrente' });
  }
});

// PUT /:id — update
router.put('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { nombre, periodicidad, diaEmision, fechaFin, activa, notas, retencion, formaPagoId, serieId } = req.body;

    const recurrente = await prisma.facturaRecurrente.update({
      where: { id },
      data: { nombre, periodicidad, diaEmision, fechaFin, activa, notas, retencion, formaPagoId, serieId },
      include: { lineas: true, cliente: true },
    });

    res.json(recurrente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando factura recurrente' });
  }
});

// DELETE /:id — delete with cascade lineas
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;

    await prisma.lineaRecurrente.deleteMany({ where: { facturaRecurrenteId: id } });
    await prisma.facturaRecurrente.delete({ where: { id } });

    res.json({ message: 'Factura recurrente eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error eliminando factura recurrente' });
  }
});

// POST /:id/emitir — emit a single recurring invoice
async function emitirFacturaRecurrente(id: string, creadorId?: string) {
  const recurrente = await prisma.facturaRecurrente.findUnique({
    where: { id },
    include: { lineas: true, cliente: true },
  });

  if (!recurrente) {
    throw new Error('Factura recurrente no encontrada');
  }

  // Calculate line totals
  let baseImponible = 0;
  let totalIva = 0;

  const lineasCalculadas = recurrente.lineas.map((linea: any) => {
    const base = linea.cantidad * linea.precioUnitario * (1 - linea.descuento / 100);
    const ivaLinea = base * linea.iva / 100;
    baseImponible += base;
    totalIva += ivaLinea;
    return { ...linea, base, ivaLinea };
  });

  let importeRetencion = 0;
  if (recurrente.retencion > 0) {
    importeRetencion = baseImponible * recurrente.retencion / 100;
  }
  const total = baseImponible + totalIva - importeRetencion;

  // Get serie and next number
  const config = await prisma.configEmpresa.findFirst();
  const serieObj = recurrente.serieId
    ? await prisma.serieFactura.findUnique({ where: { id: recurrente.serieId } })
    : null;

  const seriePrefix = serieObj?.prefijo || config?.serieFactura || 'F';
  const year = new Date().getFullYear();

  const ultimaFactura = await prisma.factura.findFirst({
    where: { serie: seriePrefix },
    orderBy: { numero: 'desc' },
  });

  const siguienteNumero = ultimaFactura ? ultimaFactura.numero + 1 : 1;

  const numeroCompleto = `${seriePrefix}/${year}/${String(siguienteNumero).padStart(5, '0')}`;

  // Create Factura
  const factura = await prisma.factura.create({
    data: {
      numeroCompleto,
      numero: siguienteNumero,
      fecha: new Date(),
      fechaVencimiento: new Date(),
      clienteId: recurrente.clienteId,
      baseImponible,
      totalIva,
      retencion: recurrente.retencion,
      importeRetencion,
      total,
      serie: seriePrefix,
      estado: 'EMITIDA',
      creadorId: creadorId || '',
      formaPagoId: recurrente.formaPagoId,
      facturaRecurrenteId: recurrente.id,
      lineas: {
        create: lineasCalculadas.map((linea: any, i: number) => ({
          orden: i + 1,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          precioUnitario: linea.precioUnitario,
          descuento: linea.descuento,
          tipoIva: linea.iva,
          baseLinea: linea.base,
          ivaLinea: linea.ivaLinea,
          totalLinea: linea.base + linea.ivaLinea,
          articuloId: linea.articuloId || null,
        })),
      },
    },
    include: { lineas: true },
  });

  // Generate vencimientos
  await generarVencimientos(factura.id);

  // Calculate next emission date
  const proximaEmision = calcularSiguienteEmision(
    recurrente.proximaEmision,
    recurrente.periodicidad,
    recurrente.diaEmision
  );

  // Update recurring invoice
  const updateData: any = { proximaEmision };
  if (recurrente.fechaFin && proximaEmision > recurrente.fechaFin) {
    updateData.activa = false;
  }

  await prisma.facturaRecurrente.update({
    where: { id },
    data: updateData,
  });

  return { factura, proximaEmision };
}

router.post('/:id/emitir', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const resultado = await emitirFacturaRecurrente(id, req.user?.id);
    res.json(resultado);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Error emitiendo factura recurrente' });
  }
});

export default router;
