const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtD = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const TIPO_LABELS: Record<string, string> = {
  factura: 'FACTURA',
  presupuesto: 'PRESUPUESTO',
  pedido: 'PEDIDO DE VENTA',
  albaran: 'ALBARÁN DE ENTREGA',
};

function normalizeTipo(tipo: string): string {
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('factura')) return 'factura';
  if (t.includes('albaran')) return 'albaran';
  if (t.includes('pedido')) return 'pedido';
  if (t.includes('presupuesto')) return 'presupuesto';
  return 'factura';
}

// ── Fetch helpers (run in main React context, NOT in print window) ──

async function fetchConfig(): Promise<any> {
  try {
    const token = localStorage.getItem('accessToken') || '';
    const r = await fetch(API + '/config', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    });
    return await r.json();
  } catch {
    return { nombre: 'Mi Empresa', cif: '' };
  }
}

async function fetchPlantilla(tipo: string): Promise<any> {
  try {
    const token = localStorage.getItem('accessToken') || '';
    const r = await fetch(API + '/config/plantillas/' + normalizeTipo(tipo), {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    });
    return await r.json();
  } catch {
    return {};
  }
}

// ── SYNCHRONOUS HTML generator — receives pre-fetched data ──

export function generateDocumentHTML(config: any, tipo: string, doc: any): string {
  const t = normalizeTipo(tipo);
  const tipoLabel = TIPO_LABELS[t] || tipo.toUpperCase();
  const num = doc.numeroCompleto || doc.numero || '—';
  const lineas = doc.lineas || [];

  // Empresa
  const en = config?.nombre || 'Mi Empresa';
  const ec = config?.cif || '';
  const ed = config?.direccion || '';
  const ecp = config?.codigoPostal || '';
  const eci = config?.ciudad || '';
  const et = config?.telefono || '';
  const ee = config?.email || '';
  const logoSrc = config?.logo || '';

  // Plantilla colors (from config._plantilla if attached)
  const p = config?._plantilla || {};
  const iban = p.iban || '';

  // Totals
  const base = doc.baseImponible || lineas.reduce((s: number, l: any) => s + Number(l.baseLinea || 0), 0);
  const totalIva = doc.totalIva || lineas.reduce((s: number, l: any) => s + Number(l.ivaLinea || 0), 0);
  const irpf = Number(doc.totalIrpf || 0);
  const total = Number(doc.total || 0);

  // IVA breakdown
  const ivaMap: Record<number, { base: number; cuota: number }> = {};
  lineas.forEach((l: any) => {
    const rate = Number(l.tipoIva || 21);
    if (!ivaMap[rate]) ivaMap[rate] = { base: 0, cuota: 0 };
    ivaMap[rate].base += Number(l.baseLinea || 0);
    ivaMap[rate].cuota += Number(l.ivaLinea || 0);
  });
  const ivaRates = Object.entries(ivaMap).sort((a, b) => Number(a[0]) - Number(b[0]));

  // Fecha
  const fechaPrincipal = doc.fecha || doc.fechaEmision || doc.createdAt;

  // Logo HTML
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="max-height:70px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px" />`
    : `<div style="font-size:22px;font-weight:bold;color:#1e3a5f;margin-bottom:6px">${en}</div>`;

  // Lineas HTML
  const lineasHtml = lineas.map((l: any) => {
    const desc = l.descripcion || l.articulo?.nombre || '—';
    const ref = l.articulo?.referencia || '';
    const qty = Number(l.cantidad || 0);
    const precio = Number(l.precioUnitario || 0);
    const dto = Number(l.descuento || 0);
    const iva = l.tipoIva || 21;
    const baseL = Number(l.baseLinea || (qty * precio * (1 - dto / 100)));
    const totalL = Number(l.totalLinea || 0);
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px">${desc}${ref ? '<br><span style="font-family:monospace;font-size:9px;color:#999">' + ref + '</span>' : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px">${qty.toLocaleString('es-ES')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px">${fmt(precio)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px">${dto > 0 ? dto + '%' : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px">${iva}%</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;font-weight:600">${fmt(totalL)}</td>
    </tr>`;
  }).join('');

  // IVA rows
  const ivaHtml = ivaRates.map(([rate, g]) =>
    `<tr><td style="padding:4px 10px;color:#666;font-size:11px">IVA ${rate}% s/ ${fmt(g.base)}</td><td style="padding:4px 10px;text-align:right;font-size:11px">${fmt(g.cuota)}</td></tr>`
  ).join('');

  // Type-specific dates
  let extraDates = '';
  if (t === 'factura' && doc.fechaVencimiento) extraDates += `<div style="font-size:11px;color:#555">Vencimiento: ${fmtD(doc.fechaVencimiento)}</div>`;
  if (t === 'presupuesto' && doc.fechaValidez) extraDates += `<div style="font-size:11px;color:#555">Válido hasta: ${fmtD(doc.fechaValidez)}</div>`;
  if (t === 'pedido' && doc.fechaEntrega) extraDates += `<div style="font-size:11px;color:#555">Entrega estimada: ${fmtD(doc.fechaEntrega)}</div>`;

  // Footer extras
  let extraFooter = '';
  if (doc.formaPago?.nombre) {
    extraFooter += `<div style="margin-top:12px;padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:11px;color:#333"><strong>Forma de pago:</strong> ${doc.formaPago.nombre}</div>`;
  }
  if (t === 'factura' && iban) {
    extraFooter += `<div style="margin-top:6px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:11px;color:#166534"><strong>IBAN:</strong> <span style="font-family:monospace;letter-spacing:1px">${iban}</span></div>`;
  }
  if (t === 'albaran') {
    if (doc.bultos || doc.pesoTotal) {
      extraFooter += `<div style="margin-top:12px;display:flex;gap:16px;font-size:11px">`;
      if (doc.bultos) extraFooter += `<div style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;flex:1"><strong>Bultos:</strong> ${doc.bultos}</div>`;
      if (doc.pesoTotal) extraFooter += `<div style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;flex:1"><strong>Peso total:</strong> ${doc.pesoTotal} kg</div>`;
      extraFooter += `</div>`;
    }
    extraFooter += `<div style="margin-top:50px;display:flex;gap:40px"><div style="flex:1;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:10px;color:#999">Entregado por</div><div style="flex:1;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:10px;color:#999">Recibido por (firma y sello)</div></div>`;
  }
  if (t === 'pedido' && doc.direccionEntrega) {
    extraFooter += `<div style="margin-top:6px;padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-size:11px;color:#333"><strong>Dirección de entrega:</strong> ${doc.direccionEntrega}</div>`;
  }

  // Observaciones
  const obsHtml = doc.observaciones
    ? `<div style="margin-bottom:10px;padding:8px 12px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11px;color:#78350f"><strong>Observaciones:</strong> ${doc.observaciones}</div>`
    : '';

  // Texto pie from plantilla
  const textoPie = p.textoPie || '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipoLabel} ${num}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; background: #fff; line-height: 1.4; }
  .page { max-width: 780px; margin: 0 auto; padding: 30px; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 0; max-width: 100%; }
  }
</style>
</head><body><div class="page">

<!-- HEADER -->
<table style="width:100%;margin-bottom:16px;border-bottom:2px solid #1e3a5f;padding-bottom:14px" cellpadding="0" cellspacing="0">
<tr>
  <td style="vertical-align:top;width:55%">
    ${logoHtml}
    ${logoSrc ? `<div style="font-size:14px;font-weight:bold;color:#1e3a5f">${en}</div>` : ''}
    <div style="font-size:10px;color:#666;line-height:1.6;margin-top:4px">
      ${ec ? 'CIF: ' + ec + '<br>' : ''}
      ${ed ? ed + '<br>' : ''}
      ${ecp || eci ? (ecp + ' ' + eci).trim() + '<br>' : ''}
      ${et ? 'Tel: ' + et + '<br>' : ''}
      ${ee}
    </div>
  </td>
  <td style="vertical-align:top;text-align:right">
    <div style="font-size:20px;font-weight:bold;color:#1e3a5f;letter-spacing:1px">${tipoLabel}</div>
    <div style="font-size:13px;font-weight:bold;color:#444;margin-top:2px;font-family:monospace">${num}</div>
    <div style="margin-top:8px;font-size:11px;color:#555;line-height:1.7">
      <div>Fecha: ${fmtD(fechaPrincipal)}</div>
      ${extraDates}
    </div>
  </td>
</tr>
</table>

<!-- CLIENTE -->
<div style="margin-bottom:14px;padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb">
  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:bold;margin-bottom:4px">Cliente</div>
  <div style="font-size:13px;font-weight:bold;color:#222;margin-bottom:3px">${doc.cliente?.nombre || doc.nombreCliente || '—'}</div>
  <div style="font-size:10px;color:#666;line-height:1.6">
    ${doc.cliente?.cifNif || doc.cifNif ? 'NIF/CIF: ' + (doc.cliente?.cifNif || doc.cifNif) + '<br>' : ''}
    ${doc.cliente?.direccion ? doc.cliente.direccion + '<br>' : ''}
    ${doc.cliente?.codigoPostal || doc.cliente?.ciudad ? ((doc.cliente?.codigoPostal || '') + ' ' + (doc.cliente?.ciudad || '')).trim() + '<br>' : ''}
    ${doc.cliente?.email ? doc.cliente.email : ''}${doc.cliente?.telefono ? ' · Tel: ' + doc.cliente.telefono : ''}
  </div>
</div>

${obsHtml}

<!-- ITEMS TABLE -->
<table style="width:100%;border-collapse:collapse;margin-bottom:6px">
  <thead><tr style="background:#e5e7eb;-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <th style="padding:7px 8px;text-align:left;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">Descripción</th>
    <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">Cant.</th>
    <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">Precio</th>
    <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">Dto.</th>
    <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">IVA</th>
    <th style="padding:7px 8px;text-align:right;font-size:10px;font-weight:bold;color:#333;border-bottom:2px solid #ccc">Total</th>
  </tr></thead>
  <tbody>${lineasHtml}</tbody>
</table>

<!-- TOTALS -->
<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <table style="width:280px;border-collapse:collapse">
    <tr><td style="padding:5px 10px;color:#666;font-size:11px">Base imponible</td><td style="padding:5px 10px;text-align:right;font-size:11px;font-weight:600">${fmt(base)}</td></tr>
    ${ivaHtml}
    ${irpf > 0 ? `<tr><td style="padding:5px 10px;color:#666;font-size:11px">IRPF</td><td style="padding:5px 10px;text-align:right;font-size:11px;font-weight:600;color:#dc2626">-${fmt(irpf)}</td></tr>` : ''}
    <tr><td style="padding:8px 10px;font-size:16px;font-weight:bold;color:#1e3a5f;border-top:2px solid #1e3a5f">TOTAL</td><td style="padding:8px 10px;text-align:right;font-size:16px;font-weight:bold;color:#1e3a5f;border-top:2px solid #1e3a5f">${fmt(total)}</td></tr>
  </table>
</div>

${extraFooter}
${textoPie ? `<div style="text-align:center;margin-top:16px;font-size:10px;color:#999;line-height:1.5">${textoPie}</div>` : ''}

<!-- FOOTER -->
<div style="margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#999">
  <span>${en}${ec ? ' · CIF: ' + ec : ''}</span>
  <span>${ee}</span>
  <span>${tipoLabel} nº ${num}</span>
</div>

</div></body></html>`;
}

// ── MAIN PRINT FUNCTION ──
// Fetches config in the CURRENT React context (before window.open), then opens print window

export async function printDoc(tipo: string, doc: any): Promise<void> {
  // 1. Fetch config and plantilla in the current context (where auth token is available)
  const [config, plantilla] = await Promise.all([fetchConfig(), fetchPlantilla(tipo)]);

  // Attach plantilla to config so generateDocumentHTML can use it
  config._plantilla = plantilla;

  // 2. Generate HTML synchronously with pre-fetched data
  const html = generateDocumentHTML(config, tipo, doc);

  // 3. Open print window with pre-generated HTML
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) return;
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 500);
}

// Backward compatibility aliases
export const imprimirDocumento = printDoc;
export const generarHtmlDocumento = async (tipo: string, doc: any): Promise<string> => {
  const [config, plantilla] = await Promise.all([fetchConfig(), fetchPlantilla(tipo)]);
  config._plantilla = plantilla;
  return generateDocumentHTML(config, tipo, doc);
};

// ── Helper to generate default email subject/body for a document ──

export function getEmailDefaults(tipo: string, doc: any, empresaNombre?: string): { subject: string; body: string } {
  const t = normalizeTipo(tipo);
  const labels: Record<string, string> = { factura: 'Factura', presupuesto: 'Presupuesto', pedido: 'Pedido', albaran: 'Albarán' };
  const label = labels[t] || tipo;
  const num = doc.numeroCompleto || doc.numero || '';
  const emp = empresaNombre || '';

  const subject = `${label} ${num}${emp ? ' - ' + emp : ''}`;
  const body = `Estimado/a cliente,\n\nLe adjuntamos ${label.toLowerCase()} ${num}.\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\n${emp}`;

  return { subject, body };
}
