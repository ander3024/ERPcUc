// Hook para generar PDFs de documentos ERP con logo de empresa
import { useCallback } from 'react';

const API = '/api';

export function useDocumentoPDF() {
  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: 'Bearer ' + token };

  const getConfig = async () => {
    const r = await fetch(API + '/config', { headers });
    return r.json();
  };

  const getPlantilla = async () => {
    try {
      const r = await fetch(API + '/config/plantillas/factura', { headers });
      return r.json();
    } catch {
      return {};
    }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '';
  const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

  const generarFacturaPDF = useCallback(async (factura: any) => {
    const [cfg, plantilla] = await Promise.all([getConfig(), getPlantilla()]);

    const cp = plantilla.colorPrimario || '#1e3a5f';
    const ct = plantilla.colorTexto || '#1a1a2e';
    const fuente = plantilla.fuente || 'Segoe UI';

    // Logo: prefer template logo, fall back to company logo
    const logoSrc = plantilla.logo || cfg.logo || '';

    const logoHtml = logoSrc
      ? '<img src="' + logoSrc + '" style="max-height:70px;max-width:220px;object-fit:contain;display:block;margin-bottom:8px"/>'
      : '';

    const empresaNombre = cfg.nombre || 'Mi Empresa';

    const lineas = (factura.lineas || []).map((l: any) => {
      const desc = l.descripcion || l.articulo?.nombre || '';
      const ref = l.articulo?.referencia || '';
      const qty = l.cantidad || 0;
      const precio = l.precioUnitario || 0;
      const dto = l.descuento || 0;
      const base = l.baseLinea || (qty * precio * (1 - dto/100));
      const iva = l.ivaLinea || 0;
      const total = l.totalLinea || (base + iva);
      return '<tr style="border-bottom:1px solid #f1f5f9">' +
        '<td style="padding:9px 12px"><div style="font-weight:600;color:#1e293b">' + desc + '</div>' +
          (ref ? '<div style="font-family:Courier New,monospace;font-size:10.5px;color:#94a3b8;margin-top:1px">' + ref + '</div>' : '') + '</td>' +
        '<td style="padding:9px 12px;text-align:right">' + qty + '</td>' +
        '<td style="padding:9px 12px;text-align:right">' + fmt(precio) + '</td>' +
        '<td style="padding:9px 12px;text-align:right">' + (dto > 0 ? dto + '%' : '') + '</td>' +
        '<td style="padding:9px 12px;text-align:right">' + fmt(base) + '</td>' +
        '<td style="padding:9px 12px;text-align:right">' + (l.tipoIva || 21) + '%</td>' +
        '<td style="padding:9px 12px;text-align:right;font-weight:600">' + fmt(total) + '</td>' +
        '</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Factura ' + (factura.numeroCompleto || '') + '</title>' +
      '<style>' +
      '@page{margin:12mm 10mm}' +
      'body{font-family:"' + fuente + '",system-ui,sans-serif;color:' + ct + ';margin:0;padding:40px;font-size:13px;line-height:1.5;background:#fff}' +
      'table{width:100%;border-collapse:collapse}' +
      '.items thead tr{background:' + cp + '}' +
      '.items thead th{padding:10px 12px;text-align:right;font-size:11px;color:#fff;font-weight:600;letter-spacing:0.4px}' +
      '.items thead th:first-child{text-align:left}' +
      '.items tbody tr:nth-child(even){background:#fafbfc}' +
      '@media print{body{padding:0}thead tr{background:' + cp + '!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}' +
      '</style></head><body>' +
      '<div style="max-width:800px;margin:0 auto">' +

      // Header
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid ' + cp + '">' +
      '<div style="flex:1">' +
        logoHtml +
        '<div style="font-size:' + (logoSrc ? '16' : '20') + 'px;font-weight:800;color:' + cp + '">' + empresaNombre + '</div>' +
        '<div style="color:#64748b;font-size:11.5px;margin-top:6px;line-height:1.6">' +
        (cfg.cif ? 'CIF: ' + cfg.cif + '<br>' : '') +
        (cfg.direccion ? cfg.direccion + '<br>' : '') +
        ((cfg.codigoPostal || '') + ' ' + (cfg.ciudad || '')).trim() +
        (cfg.telefono ? '<br>Tel: ' + cfg.telefono : '') +
        (cfg.email ? '<br>' + cfg.email : '') +
        '</div></div>' +
      '<div style="text-align:right;min-width:220px">' +
        '<div style="font-size:24px;font-weight:800;color:' + cp + ';letter-spacing:1px">FACTURA</div>' +
        '<div style="font-size:15px;font-weight:700;color:#475569;margin-top:2px;font-family:Courier New,monospace">' + (factura.numeroCompleto || '') + '</div>' +
        '<div style="margin-top:10px;font-size:12px;color:#64748b;line-height:1.8">' +
        '<strong style="color:#334155">Fecha:</strong> ' + fmtDate(factura.fechaEmision || factura.fecha || factura.createdAt) +
        (factura.fechaVencimiento ? '<br><strong style="color:#334155">Vencimiento:</strong> ' + fmtDate(factura.fechaVencimiento) : '') +
        '</div></div></div>' +

      // Client box
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:28px">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;margin-bottom:8px">Facturar a</div>' +
        '<div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:5px">' + (factura.cliente?.nombre || factura.nombreCliente || '') + '</div>' +
        '<div style="font-size:12px;color:#64748b;line-height:1.8">' +
        (factura.cifNif || factura.cliente?.cifNif ? 'NIF/CIF: ' + (factura.cifNif || factura.cliente?.cifNif) + '<br>' : '') +
        (factura.cliente?.direccion ? factura.cliente.direccion + '<br>' : '') +
        (factura.cliente?.email ? factura.cliente.email : '') +
        '</div>' +
      '</div>' +

      // Items table
      '<table class="items" style="margin-bottom:4px">' +
        '<thead><tr>' +
        '<th style="text-align:left;width:34%">Descripción</th>' +
        '<th>Cant.</th><th>Precio</th><th>Dto.</th><th>Base</th><th>IVA</th><th>Total</th>' +
        '</tr></thead>' +
        '<tbody>' + lineas + '</tbody></table>' +

      // Totals
      '<div style="display:flex;justify-content:flex-end;margin-bottom:24px">' +
        '<table style="width:320px">' +
        '<tr><td style="padding:7px 14px;color:#64748b;font-size:13px">Base imponible</td>' +
          '<td style="padding:7px 14px;text-align:right;font-weight:600;font-size:13px">' + fmt(factura.baseImponible) + '</td></tr>' +
        '<tr><td style="padding:7px 14px;color:#64748b;font-size:13px">IVA</td>' +
          '<td style="padding:7px 14px;text-align:right;font-weight:600;font-size:13px">' + fmt(factura.totalIva) + '</td></tr>' +
        (factura.totalIrpf > 0 ? '<tr><td style="padding:7px 14px;color:#64748b;font-size:13px">IRPF</td>' +
          '<td style="padding:7px 14px;text-align:right;font-weight:600;font-size:13px;color:#ef4444">-' + fmt(factura.totalIrpf) + '</td></tr>' : '') +
        '<tr style="border-top:3px solid ' + cp + '">' +
          '<td style="padding:12px 14px;font-size:20px;font-weight:800;color:' + cp + '">TOTAL</td>' +
          '<td style="padding:12px 14px;text-align:right;font-size:20px;font-weight:800;color:' + cp + '">' + fmt(factura.total) + '</td></tr>' +
        '</table></div>' +

      // IBAN
      (plantilla.mostrarIban && plantilla.iban ? '<div style="background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:12px;color:#166534">' +
        '<strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#15803d">Datos bancarios</strong><br>' +
        '<span style="font-size:14px;font-weight:700;letter-spacing:1px;color:#065f46">' + plantilla.iban + '</span></div>' : '') +

      // Observaciones
      (factura.observaciones ? '<div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#78350f">' +
        '<strong style="display:block;margin-bottom:4px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#92400e">Observaciones</strong>' + factura.observaciones + '</div>' : '') +

      // Footer text
      (plantilla.textoPie ? '<div style="text-align:center;margin-bottom:16px;font-size:11px;color:#94a3b8">' + plantilla.textoPie + '</div>' : '') +

      // Footer
      '<div style="padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10.5px;color:#94a3b8">' +
        '<span>' + empresaNombre + (cfg.cif ? ' · CIF: ' + cfg.cif : '') + '</span>' +
        '<span>' + (cfg.email || '') + '</span>' +
      '</div>' +
      '</div></body></html>';

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => { w.focus(); w.print(); };
    }
  }, []);

  return { generarFacturaPDF };
}
