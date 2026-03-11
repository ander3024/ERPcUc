import { Router, Response } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

const router = Router();

// ============================================
// VeriFactu - Sistema de facturacion electronica
// Reglamento VeriFactu (RD 1007/2023 - Espana)
// ============================================

// Helper: Generar hash SHA-256 encadenado
function generarHash(datos: {
  nifEmisor: string;
  numFactura: string;
  fecha: string;
  tipoFactura: string;
  cuotaTotal: number;
  importeTotal: number;
  hashAnterior: string | null;
  sistemaInformatico: string;
}): string {
  const cadena = [
    `IDEmisorFactura=${datos.nifEmisor}`,
    `NumSerieFactura=${datos.numFactura}`,
    `FechaExpedicionFactura=${datos.fecha}`,
    `TipoFactura=${datos.tipoFactura}`,
    `CuotaTotal=${datos.cuotaTotal.toFixed(2)}`,
    `ImporteTotal=${datos.importeTotal.toFixed(2)}`,
    `Huella=${datos.hashAnterior || ''}`,
    `SistemaInformatico=${datos.sistemaInformatico}`,
  ].join('&');

  return createHash('sha256').update(cadena).digest('hex');
}

// Helper: Generar URL QR VeriFactu
function generarQR(datos: {
  nif: string;
  numFactura: string;
  importe: number;
  fecha: string;
}): string {
  const base = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';
  const params = new URLSearchParams({
    nif: datos.nif,
    numserie: datos.numFactura,
    fecha: datos.fecha,
    importe: datos.importe.toFixed(2),
  });
  return `${base}?${params.toString()}`;
}

// Helper: Generar XML VeriFactu (estructura simplificada)
function generarXML(factura: any, config: any, hashAnterior: string | null): string {
  const fecha = new Date(factura.fecha);
  const fechaStr = `${fecha.getDate().toString().padStart(2, '0')}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getFullYear()}`;

  // Agrupar lineas por tipo IVA
  const tiposIva: Record<number, { base: number; cuota: number }> = {};
  for (const linea of (factura.lineas || [])) {
    const tipo = linea.tipoIva || 21;
    if (!tiposIva[tipo]) tiposIva[tipo] = { base: 0, cuota: 0 };
    tiposIva[tipo].base += linea.baseLinea || 0;
    tiposIva[tipo].cuota += linea.ivaLinea || 0;
  }

  const desglose = Object.entries(tiposIva).map(([tipo, vals]) => `
        <DetalleIVA>
          <TipoImpositivo>${parseFloat(tipo).toFixed(2)}</TipoImpositivo>
          <BaseImponible>${vals.base.toFixed(2)}</BaseImponible>
          <CuotaRepercutida>${vals.cuota.toFixed(2)}</CuotaRepercutida>
        </DetalleIVA>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:sifei="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SusFactuSistemaFacturacion.xsd">
  <soapenv:Body>
    <sifei:RegFactuSistemaFacturacion>
      <sifei:Cabecera>
        <sifei:ObligadoEmision>
          <sifei:NombreRazon>${config.verifactuNombreRazon || config.nombre}</sifei:NombreRazon>
          <sifei:NIF>${config.verifactuNIF || config.cif}</sifei:NIF>
        </sifei:ObligadoEmision>
      </sifei:Cabecera>
      <sifei:RegistroFactura>
        <sifei:RegistroAlta>
          <sifei:IDFactura>
            <sifei:IDEmisorFactura>${config.verifactuNIF || config.cif}</sifei:IDEmisorFactura>
            <sifei:NumSerieFactura>${factura.numeroCompleto}</sifei:NumSerieFactura>
            <sifei:FechaExpedicionFactura>${fechaStr}</sifei:FechaExpedicionFactura>
          </sifei:IDFactura>
          <sifei:NombreRazonDestinatario>${factura.nombreCliente || factura.cliente?.nombre || ''}</sifei:NombreRazonDestinatario>
          <sifei:NIFDestinatario>${factura.cifNif || factura.cliente?.cifNif || ''}</sifei:NIFDestinatario>
          <sifei:TipoFactura>${factura.esRectificativa ? 'R1' : 'F1'}</sifei:TipoFactura>
          <sifei:DescripcionOperacion>Prestacion de servicios / Entrega de bienes</sifei:DescripcionOperacion>
          <sifei:Desglose>${desglose}
          </sifei:Desglose>
          <sifei:CuotaTotal>${factura.totalIva.toFixed(2)}</sifei:CuotaTotal>
          <sifei:ImporteTotal>${factura.total.toFixed(2)}</sifei:ImporteTotal>
          <sifei:Huella>${factura.verifactuHash || ''}</sifei:Huella>
          <sifei:SistemaInformatico>
            <sifei:NombreSistemaInformatico>${config.verifactuNombreSistema || 'ERP-Web'}</sifei:NombreSistemaInformatico>
            <sifei:Version>${config.verifactuVersionSistema || '1.0'}</sifei:Version>
          </sifei:SistemaInformatico>
          <sifei:FechaHoraHusoGenRegistro>${new Date().toISOString()}</sifei:FechaHoraHusoGenRegistro>
          ${hashAnterior ? `<sifei:EncadenamientoFacturaAnterior>
            <sifei:Huella>${hashAnterior}</sifei:Huella>
          </sifei:EncadenamientoFacturaAnterior>` : ''}
        </sifei:RegistroAlta>
      </sifei:RegistroFactura>
    </sifei:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ============================================
// GET /verifactu/estado - Estado general VeriFactu
// ============================================
router.get('/estado', async (_req: AuthRequest, res: Response) => {
  try {
    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.json({ activo: false, configurado: false });

    const [totalFacturas, pendientes, enviadas, errores] = await Promise.all([
      prisma.factura.count({ where: { estado: { not: 'ANULADA' } } }),
      prisma.factura.count({ where: { verifactuEnviado: false, estado: { not: 'ANULADA' } } }),
      prisma.factura.count({ where: { verifactuEnviado: true } }),
      prisma.factura.count({ where: { verifactuEstado: 'ERROR' } }),
    ]);

    res.json({
      activo: config.verifactuActivo,
      configurado: !!(config.verifactuNIF || config.cif),
      entornoPruebas: config.verifactuEntornoPruebas,
      sistema: config.verifactuNombreSistema,
      version: config.verifactuVersionSistema,
      stats: { totalFacturas, pendientes, enviadas, errores },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estado VeriFactu' });
  }
});

// ============================================
// POST /verifactu/generar-hash/:id - Generar hash para factura
// ============================================
router.post('/generar-hash/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.status(400).json({ error: 'Configuracion de empresa no encontrada' });

    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: { lineas: true, cliente: true },
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    // Obtener hash de la factura anterior (encadenamiento)
    const facturaAnterior = await prisma.factura.findFirst({
      where: {
        id: { not: factura.id },
        fecha: { lte: factura.fecha },
        verifactuHash: { not: null },
        estado: { not: 'ANULADA' },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      select: { verifactuHash: true },
    });

    const nif = config.verifactuNIF || config.cif;
    const fecha = new Date(factura.fecha);
    const fechaStr = `${fecha.getDate().toString().padStart(2, '0')}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getFullYear()}`;

    const hash = generarHash({
      nifEmisor: nif,
      numFactura: factura.numeroCompleto,
      fecha: fechaStr,
      tipoFactura: factura.esRectificativa ? 'R1' : 'F1',
      cuotaTotal: factura.totalIva,
      importeTotal: factura.total,
      hashAnterior: facturaAnterior?.verifactuHash || null,
      sistemaInformatico: config.verifactuNombreSistema || 'ERP-Web',
    });

    const qrUrl = generarQR({
      nif,
      numFactura: factura.numeroCompleto,
      importe: factura.total,
      fecha: fechaStr,
    });

    const xml = generarXML(factura, config, facturaAnterior?.verifactuHash || null);

    // Guardar en la factura
    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: {
        verifactuHash: hash,
        verifactuHashPrev: facturaAnterior?.verifactuHash || null,
        verifactuQR: qrUrl,
        verifactuXML: xml,
        verifactuEstado: 'GENERADO',
      },
    });

    res.json({
      hash,
      qrUrl,
      hashAnterior: facturaAnterior?.verifactuHash || null,
      estado: 'GENERADO',
    });
  } catch (error) {
    console.error('Error generando hash VeriFactu:', error);
    res.status(500).json({ error: 'Error generando hash VeriFactu' });
  }
});

// ============================================
// POST /verifactu/generar-lote - Generar hashes para todas las facturas pendientes
// ============================================
router.post('/generar-lote', async (req: AuthRequest, res: Response) => {
  try {
    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.status(400).json({ error: 'Configuracion no encontrada' });

    const facturas = await prisma.factura.findMany({
      where: {
        verifactuHash: null,
        estado: { notIn: ['ANULADA', 'BORRADOR'] },
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
      include: { lineas: true, cliente: true },
    });

    const nif = config.verifactuNIF || config.cif;
    let hashAnterior: string | null = null;

    // Obtener ultimo hash existente
    const ultimaConHash = await prisma.factura.findFirst({
      where: { verifactuHash: { not: null } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      select: { verifactuHash: true },
    });
    hashAnterior = ultimaConHash?.verifactuHash || null;

    let procesadas = 0;
    for (const factura of facturas) {
      const fecha = new Date(factura.fecha);
      const fechaStr = `${fecha.getDate().toString().padStart(2, '0')}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getFullYear()}`;

      const hash = generarHash({
        nifEmisor: nif,
        numFactura: factura.numeroCompleto,
        fecha: fechaStr,
        tipoFactura: factura.esRectificativa ? 'R1' : 'F1',
        cuotaTotal: factura.totalIva,
        importeTotal: factura.total,
        hashAnterior,
        sistemaInformatico: config.verifactuNombreSistema || 'ERP-Web',
      });

      const qrUrl = generarQR({ nif, numFactura: factura.numeroCompleto, importe: factura.total, fecha: fechaStr });
      const xml = generarXML(factura, config, hashAnterior);

      await prisma.factura.update({
        where: { id: factura.id },
        data: {
          verifactuHash: hash,
          verifactuHashPrev: hashAnterior,
          verifactuQR: qrUrl,
          verifactuXML: xml,
          verifactuEstado: 'GENERADO',
        },
      });

      hashAnterior = hash;
      procesadas++;
    }

    res.json({ procesadas, total: facturas.length });
  } catch (error) {
    console.error('Error generando lote VeriFactu:', error);
    res.status(500).json({ error: 'Error generando lote' });
  }
});

// ============================================
// GET /verifactu/factura/:id - Datos VeriFactu de una factura
// ============================================
router.get('/factura/:id', async (req: AuthRequest, res: Response) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, numeroCompleto: true,
        verifactuHash: true, verifactuHashPrev: true,
        verifactuQR: true, verifactuEnviado: true,
        verifactuFechaEnvio: true, verifactuEstado: true,
        verifactuIdPeticion: true,
      },
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(factura);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo datos VeriFactu' });
  }
});

// ============================================
// GET /verifactu/factura/:id/xml - Descargar XML
// ============================================
router.get('/factura/:id/xml', async (req: AuthRequest, res: Response) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      select: { verifactuXML: true, numeroCompleto: true },
    });
    if (!factura?.verifactuXML) return res.status(404).json({ error: 'XML no generado' });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="verifactu_${factura.numeroCompleto}.xml"`);
    res.send(factura.verifactuXML);
  } catch (error) {
    res.status(500).json({ error: 'Error descargando XML' });
  }
});

// ============================================
// GET /verifactu/config - Configuracion VeriFactu
// ============================================
router.get('/config', async (_req: AuthRequest, res: Response) => {
  try {
    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.json({});
    res.json({
      verifactuActivo: config.verifactuActivo,
      verifactuNombreSistema: config.verifactuNombreSistema,
      verifactuVersionSistema: config.verifactuVersionSistema,
      verifactuNIF: config.verifactuNIF || config.cif,
      verifactuNombreRazon: config.verifactuNombreRazon || config.nombre,
      verifactuEntornoPruebas: config.verifactuEntornoPruebas,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo config' });
  }
});

// ============================================
// PUT /verifactu/config - Actualizar configuracion
// ============================================
router.put('/config', async (req: AuthRequest, res: Response) => {
  try {
    const { verifactuActivo, verifactuNombreSistema, verifactuVersionSistema,
      verifactuNIF, verifactuNombreRazon, verifactuEntornoPruebas } = req.body;

    const config = await prisma.configEmpresa.findFirst();
    if (!config) return res.status(400).json({ error: 'Configuracion no encontrada' });

    const updated = await prisma.configEmpresa.update({
      where: { id: config.id },
      data: {
        ...(verifactuActivo !== undefined ? { verifactuActivo } : {}),
        ...(verifactuNombreSistema ? { verifactuNombreSistema } : {}),
        ...(verifactuVersionSistema ? { verifactuVersionSistema } : {}),
        ...(verifactuNIF ? { verifactuNIF } : {}),
        ...(verifactuNombreRazon ? { verifactuNombreRazon } : {}),
        ...(verifactuEntornoPruebas !== undefined ? { verifactuEntornoPruebas } : {}),
      },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando config' });
  }
});

export default router;
