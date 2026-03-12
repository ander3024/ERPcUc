import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function generarVencimientos(facturaId: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { formaPago: true }
  });
  if (!factura || !factura.formaPago) return;

  // Borrar vencimientos existentes sin pagos
  await prisma.vencimiento.deleteMany({
    where: { facturaId, importePagado: 0 }
  });

  const { diasVto, numVtos } = factura.formaPago;
  const numVencimientos = numVtos || 1;
  const dias = diasVto || 30;
  const importeTotal = Number(factura.total);
  const importePorVto = Math.round((importeTotal / numVencimientos) * 100) / 100;
  const fechaBase = new Date(factura.fecha);

  for (let i = 1; i <= numVencimientos; i++) {
    const fechaVenc = new Date(fechaBase);
    fechaVenc.setDate(fechaVenc.getDate() + (dias * i));

    // Ultimo vencimiento absorbe la diferencia de redondeo
    const importe = i === numVencimientos
      ? Math.round((importeTotal - importePorVto * (numVencimientos - 1)) * 100) / 100
      : importePorVto;

    await prisma.vencimiento.create({
      data: {
        facturaId,
        numero: i,
        importe,
        fechaVencimiento: fechaVenc,
        estado: 'PENDIENTE'
      }
    });
  }
}

export function calcularEstadoVencimiento(v: { importePagado: number; importe: number; fechaVencimiento: Date }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (Number(v.importePagado) >= Number(v.importe)) return 'PAGADO';
  if (Number(v.importePagado) > 0) return 'PAGADO_PARCIAL';
  if (new Date(v.fechaVencimiento) < hoy) return 'VENCIDO';
  return 'PENDIENTE';
}

export async function sincronizarVencimientosConCobros(facturaId: string) {
  const vencimientos = await prisma.vencimiento.findMany({
    where: { facturaId },
    orderBy: { numero: 'asc' }
  });

  const cobros = await prisma.cobro.findMany({
    where: { facturaId },
    orderBy: { fecha: 'asc' }
  });

  const totalCobrado = cobros.reduce((s, c) => s + Number(c.importe), 0);

  // Aplicar cobros a vencimientos en orden FIFO
  let restante = totalCobrado;
  for (const v of vencimientos) {
    const importeVto = Number(v.importe);
    const pagado = Math.min(restante, importeVto);
    restante = Math.round((restante - pagado) * 100) / 100;

    const estado = calcularEstadoVencimiento({
      importePagado: pagado,
      importe: importeVto,
      fechaVencimiento: v.fechaVencimiento
    });

    await prisma.vencimiento.update({
      where: { id: v.id },
      data: {
        importePagado: Math.round(pagado * 100) / 100,
        estado,
        fechaPago: pagado >= importeVto ? new Date() : null
      }
    });
  }
}
