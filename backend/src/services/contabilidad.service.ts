import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getOrCreateCuenta(codigo: string, nombre: string, tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO') {
  let cuenta = await prisma.cuentaContable.findUnique({ where: { codigo } });
  if (!cuenta) {
    cuenta = await prisma.cuentaContable.create({
      data: { codigo, nombre, tipo, nivel: codigo.length <= 3 ? 1 : codigo.length <= 5 ? 2 : 3 }
    });
  }
  return cuenta;
}

async function nextNumero(ejercicio: number) {
  const last = await prisma.asientoContable.findFirst({
    where: { ejercicio }, orderBy: { numero: 'desc' }
  });
  return (last?.numero || 0) + 1;
}

async function crearAsiento(params: {
  fecha: Date;
  concepto: string;
  diario?: string;
  creadorId: string;
  lineas: { cuentaDebeId?: string; cuentaHaberId?: string; debe: number; haber: number; concepto?: string }[];
}) {
  const ejercicio = params.fecha.getFullYear();
  const numero = await nextNumero(ejercicio);

  return prisma.asientoContable.create({
    data: {
      numero,
      ejercicio,
      fecha: params.fecha,
      concepto: params.concepto,
      diario: params.diario || 'DIARIO',
      creadorId: params.creadorId,
      lineas: {
        create: params.lineas.map((l, i) => ({
          orden: i + 1,
          concepto: l.concepto || params.concepto,
          cuentaDebeId: l.cuentaDebeId || null,
          cuentaHaberId: l.cuentaHaberId || null,
          debe: l.debe || 0,
          haber: l.haber || 0,
        }))
      }
    }
  });
}

// ── FACTURA VENTA EMITIDA ──
// DEBE 430 (Cliente) / HABER 700 (Ventas) + 477 (IVA repercutido)
export async function asientoFacturaVenta(factura: {
  id: string; numeroCompleto: string; clienteId: string;
  baseImponible: number; totalIva: number; total: number;
  fecha: Date;
}, creadorId: string) {
  try {
    const c430 = await getOrCreateCuenta('4300000', 'Clientes', 'ACTIVO');
    const c700 = await getOrCreateCuenta('7000000', 'Ventas de mercaderías', 'INGRESO');
    const c477 = await getOrCreateCuenta('4770000', 'H.P. IVA repercutido', 'PASIVO');

    const lineas: any[] = [
      { cuentaDebeId: c430.id, debe: Number(factura.total), haber: 0, concepto: `Factura ${factura.numeroCompleto}` },
    ];
    if (Number(factura.baseImponible) > 0) {
      lineas.push({ cuentaHaberId: c700.id, debe: 0, haber: Number(factura.baseImponible), concepto: `Ventas Factura ${factura.numeroCompleto}` });
    }
    if (Number(factura.totalIva) > 0) {
      lineas.push({ cuentaHaberId: c477.id, debe: 0, haber: Number(factura.totalIva), concepto: `IVA Factura ${factura.numeroCompleto}` });
    }

    await crearAsiento({
      fecha: new Date(factura.fecha),
      concepto: `Factura venta ${factura.numeroCompleto}`,
      diario: 'VENTAS',
      creadorId,
      lineas,
    });
  } catch (e) {
    console.error('Error asiento factura venta:', e);
  }
}

// ── COBRO FACTURA VENTA ──
// DEBE 572 (Banco) / HABER 430 (Cliente)
export async function asientoCobro(cobro: {
  importe: number; formaPago: string; facturaId: string;
}, facturaNumero: string, creadorId: string) {
  try {
    const c572 = await getOrCreateCuenta('5720000', 'Bancos c/c', 'ACTIVO');
    const c430 = await getOrCreateCuenta('4300000', 'Clientes', 'ACTIVO');

    await crearAsiento({
      fecha: new Date(),
      concepto: `Cobro factura ${facturaNumero} (${cobro.formaPago})`,
      diario: 'COBROS',
      creadorId,
      lineas: [
        { cuentaDebeId: c572.id, debe: Number(cobro.importe), haber: 0 },
        { cuentaHaberId: c430.id, debe: 0, haber: Number(cobro.importe) },
      ],
    });
  } catch (e) {
    console.error('Error asiento cobro:', e);
  }
}

// ── FACTURA COMPRA RECIBIDA ──
// DEBE 600 (Compras) + 472 (IVA soportado) / HABER 400 (Proveedor)
export async function asientoFacturaCompra(factura: {
  id: string; numeroProveedor: string;
  baseImponible: number; totalIva: number; total: number;
  fecha: Date;
}, creadorId: string) {
  try {
    const c600 = await getOrCreateCuenta('6000000', 'Compras de mercaderías', 'GASTO');
    const c472 = await getOrCreateCuenta('4720000', 'H.P. IVA soportado', 'ACTIVO');
    const c400 = await getOrCreateCuenta('4000000', 'Proveedores', 'PASIVO');

    const lineas: any[] = [];
    if (Number(factura.baseImponible) > 0) {
      lineas.push({ cuentaDebeId: c600.id, debe: Number(factura.baseImponible), haber: 0, concepto: `Compras Fra. ${factura.numeroProveedor}` });
    }
    if (Number(factura.totalIva) > 0) {
      lineas.push({ cuentaDebeId: c472.id, debe: Number(factura.totalIva), haber: 0, concepto: `IVA Fra. ${factura.numeroProveedor}` });
    }
    lineas.push({ cuentaHaberId: c400.id, debe: 0, haber: Number(factura.total), concepto: `Fra. proveedor ${factura.numeroProveedor}` });

    await crearAsiento({
      fecha: new Date(factura.fecha),
      concepto: `Factura compra ${factura.numeroProveedor}`,
      diario: 'COMPRAS',
      creadorId,
      lineas,
    });
  } catch (e) {
    console.error('Error asiento factura compra:', e);
  }
}

// ── PAGO FACTURA COMPRA ──
// DEBE 400 (Proveedor) / HABER 572 (Banco)
export async function asientoPago(pago: {
  importe: number; formaPago: string;
}, facturaNumero: string, creadorId: string) {
  try {
    const c400 = await getOrCreateCuenta('4000000', 'Proveedores', 'PASIVO');
    const c572 = await getOrCreateCuenta('5720000', 'Bancos c/c', 'ACTIVO');

    await crearAsiento({
      fecha: new Date(),
      concepto: `Pago factura ${facturaNumero} (${pago.formaPago})`,
      diario: 'PAGOS',
      creadorId,
      lineas: [
        { cuentaDebeId: c400.id, debe: Number(pago.importe), haber: 0 },
        { cuentaHaberId: c572.id, debe: 0, haber: Number(pago.importe) },
      ],
    });
  } catch (e) {
    console.error('Error asiento pago:', e);
  }
}
