import { useCallback } from 'react';

/** Reusable export hook for CSV (opens in Excel) and PDF (print) */
export function useExport() {
  const exportCSV = useCallback((filename: string, headers: string[], rows: (string | number)[][]) => {
    const bom = '\ufeff';
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportPDF = useCallback((title: string, html: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 5px; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:hover td { background: #f8fafc; }
        .text-right { text-align: right; }
        .total-row td { font-weight: 700; border-top: 2px solid #334155; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>
      <h1>${title}</h1>
      <div class="meta">Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}</div>
      ${html}
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }, []);

  /** Build an HTML table from headers and rows for PDF export */
  const buildTable = useCallback((headers: string[], rows: (string | number)[][], alignRight: number[] = []) => {
    const ths = headers.map((h, i) => `<th${alignRight.includes(i) ? ' class="text-right"' : ''}>${h}</th>`).join('');
    const trs = rows.map(r => '<tr>' + r.map((c, i) => `<td${alignRight.includes(i) ? ' class="text-right"' : ''}>${c}</td>`).join('') + '</tr>').join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }, []);

  return { exportCSV, exportPDF, buildTable };
}
