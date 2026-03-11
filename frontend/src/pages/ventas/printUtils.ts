const fmt2 = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtD = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const LABELS: Record<string, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', ACEPTADO: 'Aceptado',
  RECHAZADO: 'Rechazado', CADUCADO: 'Caducado',
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso',
  PARCIALMENTE_SERVIDO: 'Parcial', SERVIDO: 'Servido', FACTURADO: 'Facturado',
  CANCELADO: 'Cancelado',
  EMITIDA: 'Emitida', PARCIALMENTE_COBRADA: 'Parcial', COBRADA: 'Cobrada',
  VENCIDA: 'Vencida', ANULADA: 'Anulada',
};

const BADGE_COLORS: Record<string, string> = {
  BORRADOR: '#94a3b8', ENVIADO: '#3b82f6', ACEPTADO: '#10b981',
  RECHAZADO: '#ef4444', CADUCADO: '#f59e0b',
  PENDIENTE: '#f59e0b', EN_PROCESO: '#3b82f6',
  PARCIALMENTE_SERVIDO: '#8b5cf6', SERVIDO: '#10b981', FACTURADO: '#10b981',
  CANCELADO: '#ef4444',
  EMITIDA: '#3b82f6', PARCIALMENTE_COBRADA: '#8b5cf6', COBRADA: '#10b981',
  VENCIDA: '#ef4444', ANULADA: '#ef4444',
};

const API = '/api';
const token = () => localStorage.getItem('accessToken') || '';
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

interface PlantillaConfig {
  colorPrimario: string;
  colorSecundario: string;
  colorTexto: string;
  fuente: string;
  mostrarIban: boolean;
  mostrarNotas: boolean;
  mostrarNumeroPedido: boolean;
  textoPie: string;
  notasDefecto: string;
  copias: number;
  logo: string;
  iban: string;
}

const DEFAULTS: PlantillaConfig = {
  colorPrimario: '#1e3a5f',
  colorSecundario: '#10b981',
  colorTexto: '#1a1a2e',
  fuente: 'Segoe UI',
  mostrarIban: false,
  mostrarNotas: true,
  mostrarNumeroPedido: false,
  textoPie: '',
  notasDefecto: '',
  copias: 1,
  logo: '',
  iban: '',
};

// Map display tipo to API tipo
function tipoToApi(tipo: string): string {
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('factura')) return 'factura';
  if (t.includes('albaran')) return 'albaran';
  if (t.includes('pedido')) return 'pedido';
  if (t.includes('presupuesto')) return 'presupuesto';
  return 'factura';
}

// Normalize display tipo for document title
function tipoDisplay(tipo: string): string {
  const map: Record<string, string> = { factura: 'FACTURA', albaran: 'ALBARÁN', pedido: 'PEDIDO', presupuesto: 'PRESUPUESTO' };
  return map[tipoToApi(tipo)] || tipo.toUpperCase();
}

const plantillaCache: Record<string, { data: PlantillaConfig; time: number }> = {};

async function getPlantilla(tipo: string): Promise<PlantillaConfig> {
  const apiTipo = tipoToApi(tipo);
  const cached = plantillaCache[apiTipo];
  if (cached && Date.now() - cached.time < 60000) return cached.data;
  try {
    const r = await fetch(API + '/config/plantillas/' + apiTipo, { headers: hdrs() });
    const d = await r.json();
    const config = { ...DEFAULTS, ...d };
    plantillaCache[apiTipo] = { data: config, time: Date.now() };
    return config;
  } catch {
    return DEFAULTS;
  }
}

async function getEmpresa(): Promise<any> {
  try {
    const r = await fetch(API + '/config', { headers: hdrs() });
    return await r.json();
  } catch {
    return { nombre: 'Mi Empresa, S.L.', cif: 'B00000000' };
  }
}

export async function imprimirDocumento(doc: any, tipo: string) {
  const [p, empresa] = await Promise.all([getPlantilla(tipo), getEmpresa()]);
  const lineas = doc.lineas || [];
  const base = doc.baseImponible || lineas.reduce((s: number, l: any) => s + Number(l.baseLinea || 0), 0);
  const iva  = doc.totalIva || lineas.reduce((s: number, l: any) => s + Number(l.ivaLinea  || 0), 0);
  const irpf = Number(doc.totalIrpf || 0);
  const total = Number(doc.total || 0);
  const num = doc.numeroCompleto || doc.numero || '—';
  const tipoLabel = tipoDisplay(tipo);

  // Logo: prefer template logo, fall back to company logo
  const logoSrc = p.logo || empresa?.logo || '';

  const empresaNombre = empresa?.nombre || 'Mi Empresa, S.L.';
  const empresaCif = empresa?.cif || '';
  const empresaDireccion = empresa?.direccion || '';
  const empresaCiudad = empresa?.ciudad || '';
  const empresaCp = empresa?.codigoPostal || '';
  const empresaTelefono = empresa?.telefono || '';
  const empresaEmail = empresa?.email || '';

  const badgeColor = BADGE_COLORS[doc.estado] || p.colorSecundario;

  // Group lines by IVA rate for tax breakdown
  const ivaGroups: Record<number, { base: number; cuota: number }> = {};
  lineas.forEach((l: any) => {
    const rate = Number(l.tipoIva || 21);
    const lb = Number(l.baseLinea || 0);
    const li = Number(l.ivaLinea || 0);
    if (!ivaGroups[rate]) ivaGroups[rate] = { base: 0, cuota: 0 };
    ivaGroups[rate].base += lb;
    ivaGroups[rate].cuota += li;
  });
  const ivaSorted = Object.entries(ivaGroups).sort((a, b) => Number(a[0]) - Number(b[0]));

  const STYLE = `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{margin:12mm 10mm}
  body{font-family:'${p.fuente}',system-ui,-apple-system,sans-serif;font-size:13px;color:${p.colorTexto};background:#fff;line-height:1.5}
  .page{max-width:800px;margin:0 auto;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ${p.colorPrimario}}
  .empresa{flex:1}
  .empresa-logo{margin-bottom:10px}
  .empresa-logo img{max-height:70px;max-width:220px;object-fit:contain;display:block}
  .empresa-name{font-size:20px;font-weight:800;color:${p.colorPrimario};letter-spacing:-0.3px}
  .empresa-data{color:#64748b;font-size:11.5px;margin-top:6px;line-height:1.6}
  .doc-info{text-align:right;min-width:220px}
  .doc-tipo{font-size:24px;font-weight:800;color:${p.colorPrimario};letter-spacing:1px}
  .doc-num{font-size:15px;font-weight:700;color:#475569;margin-top:2px;font-family:'Courier New',monospace}
  .doc-dates{margin-top:10px;font-size:12px;color:#64748b;line-height:1.8}
  .doc-dates strong{color:#334155}
  .badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;margin-top:10px;letter-spacing:0.3px}
  .section{margin-bottom:28px}
  .two-col{display:flex;gap:20px;margin-bottom:28px}
  .two-col > div{flex:1}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px}
  .box-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;margin-bottom:8px}
  .box .name{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:5px}
  .box .detail{font-size:12px;color:#64748b;line-height:1.8}
  table.items{width:100%;border-collapse:collapse;margin-bottom:4px}
  table.items thead tr{background:${p.colorPrimario}}
  table.items thead th{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.4px;color:#fff;white-space:nowrap}
  table.items thead th:not(:first-child){text-align:right}
  table.items tbody tr{border-bottom:1px solid #f1f5f9}
  table.items tbody tr:nth-child(even){background:#fafbfc}
  table.items tbody td{padding:9px 12px;font-size:12.5px;color:${p.colorTexto};vertical-align:top}
  table.items tbody td:not(:first-child){text-align:right;white-space:nowrap}
  table.items tbody td:first-child{max-width:260px}
  .item-desc{font-weight:600;color:#1e293b}
  .item-ref{font-family:'Courier New',monospace;font-size:10.5px;color:#94a3b8;margin-top:1px}
  .summary{display:flex;justify-content:flex-end;margin-bottom:24px}
  .summary-table{width:320px;border-collapse:collapse}
  .summary-table td{padding:7px 14px;font-size:13px}
  .summary-table td:first-child{color:#64748b}
  .summary-table td:last-child{text-align:right;font-weight:600;color:#1e293b}
  .summary-table .sub{font-size:12px}
  .summary-table .sub td{padding:4px 14px;color:#94a3b8}
  .summary-table .sub td:last-child{color:#64748b;font-weight:500}
  .summary-table tr.tr-total td{font-size:20px;font-weight:800;color:${p.colorPrimario};border-top:3px solid ${p.colorPrimario};padding-top:12px}
  .obs{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#78350f}
  .obs strong{display:block;margin-bottom:4px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#92400e}
  .iban-box{background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:12px;color:#166534}
  .iban-box strong{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#15803d}
  .footer-text{text-align:center;margin-bottom:16px;font-size:11px;color:#94a3b8;line-height:1.6}
  .footer{padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#94a3b8}
  .footer-center{text-align:center;flex:1}
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .page{padding:0;max-width:100%}
    .badge{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    table.items thead tr{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
`;

  const logoHtml = logoSrc
    ? `<div class="empresa-logo"><img src="${logoSrc}" alt="Logo"/></div>`
    : `<div class="empresa-name">${empresaNombre}</div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>${tipoLabel} ${num}</title>
  <style>${STYLE}</style>
  </head><body><div class="page">
  <div class="header">
    <div class="empresa">
      ${logoHtml}
      ${logoSrc ? `<div class="empresa-name" style="font-size:16px;margin-top:2px">${empresaNombre}</div>` : ''}
      <div class="empresa-data">
        ${empresaCif ? 'CIF: ' + empresaCif + '<br>' : ''}
        ${empresaDireccion ? empresaDireccion + '<br>' : ''}
        ${empresaCp || empresaCiudad ? (empresaCp + ' ' + empresaCiudad).trim() + '<br>' : ''}
        ${empresaTelefono ? 'Tel: ' + empresaTelefono + '<br>' : ''}
        ${empresaEmail || ''}
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-tipo">${tipoLabel}</div>
      <div class="doc-num">${num}</div>
      <div class="doc-dates">
        <strong>Fecha:</strong> ${fmtD(doc.fecha || doc.fechaEmision || doc.createdAt)}
        ${doc.fechaValidez  ? `<br><strong>Válido hasta:</strong> ${fmtD(doc.fechaValidez)}` : ''}
        ${doc.fechaEntrega  ? `<br><strong>Entrega:</strong> ${fmtD(doc.fechaEntrega)}` : ''}
        ${doc.fechaVencimiento ? `<br><strong>Vencimiento:</strong> ${fmtD(doc.fechaVencimiento)}` : ''}
      </div>
      ${doc.estado ? `<span class="badge" style="background:${badgeColor}18;color:${badgeColor};border:1px solid ${badgeColor}40">${LABELS[doc.estado] || doc.estado}</span>` : ''}
    </div>
  </div>

  <div class="two-col">
    <div class="box">
      <div class="box-label">Cliente</div>
      <div class="name">${doc.cliente?.nombre || doc.nombreCliente || '—'}</div>
      <div class="detail">
        ${doc.cliente?.cifNif || doc.cifNif ? 'NIF/CIF: ' + (doc.cliente?.cifNif || doc.cifNif) + '<br>' : ''}
        ${doc.cliente?.direccion  ? doc.cliente.direccion + '<br>' : ''}
        ${doc.cliente?.codigoPostal || doc.cliente?.ciudad ? ((doc.cliente?.codigoPostal || '') + ' ' + (doc.cliente?.ciudad || '')).trim() + '<br>' : ''}
        ${doc.cliente?.email      ? doc.cliente.email + '<br>' : ''}
        ${doc.cliente?.telefono   ? 'Tel: ' + doc.cliente.telefono : ''}
      </div>
    </div>
    <div class="box">
      <div class="box-label">Datos del documento</div>
      <div class="detail">
        <strong>Nº:</strong> ${num}<br>
        <strong>Fecha:</strong> ${fmtD(doc.fecha || doc.fechaEmision || doc.createdAt)}<br>
        ${doc.formaPago?.nombre ? '<strong>Forma de pago:</strong> ' + doc.formaPago.nombre + '<br>' : ''}
        ${doc.agente?.nombre ? '<strong>Agente:</strong> ' + doc.agente.nombre + '<br>' : ''}
        ${doc.referencia ? '<strong>Referencia:</strong> ' + doc.referencia + '<br>' : ''}
      </div>
    </div>
  </div>

  ${p.mostrarNotas && doc.observaciones ? `<div class="obs"><strong>Observaciones</strong>${doc.observaciones}</div>` : ''}

  <table class="items">
    <thead><tr>
      <th style="width:38%">Descripción</th><th>Ref.</th><th>Cant.</th>
      <th>Precio</th><th>Dto.</th><th>IVA</th><th>Total</th>
    </tr></thead>
    <tbody>
      ${lineas.map((l: any) => {
        const desc = l.descripcion || l.articulo?.nombre || '—';
        const ref = l.articulo?.referencia || '';
        return `<tr>
        <td><div class="item-desc">${desc}</div>${ref ? '<div class="item-ref">' + ref + '</div>' : ''}</td>
        <td>${ref || '—'}</td>
        <td>${Number(l.cantidad).toLocaleString('es-ES')}</td>
        <td>${fmt2(l.precioUnitario)}</td>
        <td>${l.descuento > 0 ? l.descuento + '%' : '—'}</td>
        <td>${l.tipoIva}%</td>
        <td style="font-weight:600">${fmt2(l.totalLinea)}</td>
      </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="summary"><table class="summary-table">
    <tr><td>Base imponible</td><td>${fmt2(base)}</td></tr>
    ${ivaSorted.length > 1
      ? ivaSorted.map(([rate, g]) => `<tr class="sub"><td>IVA ${rate}% s/ ${fmt2(g.base)}</td><td>${fmt2(g.cuota)}</td></tr>`).join('')
      : `<tr><td>IVA${ivaSorted.length === 1 ? ' (' + ivaSorted[0][0] + '%)' : ''}</td><td>${fmt2(iva)}</td></tr>`
    }
    ${irpf > 0 ? `<tr><td>IRPF</td><td style="color:#ef4444">-${fmt2(irpf)}</td></tr>` : ''}
    <tr class="tr-total"><td>TOTAL</td><td>${fmt2(total)}</td></tr>
  </table></div>

  ${p.mostrarIban && p.iban ? `<div class="iban-box"><strong>Datos bancarios</strong><br><span style="font-size:14px;font-weight:700;letter-spacing:1px;color:#065f46">${p.iban}</span></div>` : ''}
  ${p.textoPie ? `<div class="footer-text">${p.textoPie}</div>` : ''}
  <div class="footer">
    <span>${empresaNombre}${empresaCif ? ' · CIF: ' + empresaCif : ''}</span>
    <div class="footer-center">${empresaEmail || ''}</div>
    <span>${tipoLabel} nº ${num}</span>
  </div>
  </div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}
