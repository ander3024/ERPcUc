import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, TrendingUp, Download, Calendar, AlertTriangle, Euro, Package, Printer, ArrowUpDown, Users, ShoppingCart, Clock, Wallet } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const fmtNum = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n || 0);

const downloadCSV = (data: string, filename: string) => {
  const blob = new Blob(['\ufeff' + data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={'text-lg font-bold ' + color}>{value}</div>
    </div>
  );
}

function TableWrapper({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-white font-semibold">{title}</h3>
        {subtitle && <span className="text-slate-400 text-sm">{subtitle}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function InformesPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'ventas';
  const setTab = (t: string) => setSp({ tab: t });
  const [year, setYear] = useState(new Date().getFullYear());
  const [trimestre, setTrimestre] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [mes, setMes] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = { Authorization: 'Bearer ' + token };

  // Vencimientos filters
  const [vDesde, setVDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); });
  const [vHasta, setVHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [vEstado, setVEstado] = useState('');
  const [vClienteId, setVClienteId] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);

  const cargar = async () => {
    setLoading(true);
    setData(null);
    try {
      let url = '';
      if (tab === 'ventas') url = API + '/informes/ventas?year=' + year + '&mes=' + mes;
      else if (tab === 'cobros') url = API + '/informes/cobros-pagos?year=' + year;
      else if (tab === 'stock') url = API + '/informes/stock';
      else if (tab === 'iva') url = API + '/informes/iva-trimestral?year=' + year + '&trimestre=' + trimestre;
      else if (tab === 'vencimientos') {
        url = API + '/informes/vencimientos?desde=' + vDesde + '&hasta=' + vHasta;
        if (vEstado) url += '&estado=' + vEstado;
        if (vClienteId) url += '&clienteId=' + vClienteId;
      }
      else if (tab === 'cartera') url = API + '/informes/cartera-cobros';
      const r = await fetch(url, { headers });
      if (r.ok) setData(await r.json());
    } catch { setData(null); } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [tab, year, trimestre, mes, vDesde, vHasta, vEstado, vClienteId]);

  // Fetch clientes for vencimientos filter
  useEffect(() => {
    fetch(API + '/clientes?limit=100', { headers })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(res => setClientes(res.data || res || []))
      .catch(() => setClientes([]));
  }, []);

  const exportarCSV = async (tipo: string) => {
    try {
      let url = API + '/informes/exportar-csv?tipo=' + tipo + '&year=' + year;
      if (tipo === 'iva') url += '&trimestre=' + trimestre;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const text = await r.text();
        const filename = tipo + '_' + year + (tipo === 'iva' ? '_T' + trimestre : '') + '.csv';
        downloadCSV(text, filename);
      }
    } catch { /* silently fail */ }
  };

  const imprimirIVA = () => {
    if (!data) return;
    const rowsEmitidas = (data.facturas || []).map((f: any) =>
      '<tr><td>' + (f.numeroCompleto || '') + '</td><td>' + fmtDate(f.fechaEmision) + '</td>' +
      '<td>' + (f.cliente || '') + '</td><td>' + (f.cifNif || '') + '</td>' +
      '<td style="text-align:right">' + fmt(f.baseImponible) + '</td>' +
      '<td style="text-align:right">' + fmt(f.totalIva) + '</td>' +
      '<td style="text-align:right">' + fmt(f.totalIrpf) + '</td>' +
      '<td style="text-align:right">' + fmt(f.total) + '</td></tr>'
    ).join('');
    const rowsRecibidas = (data.libroRecibidas || []).map((f: any) =>
      '<tr><td>' + (f.numero || '') + '</td><td>' + fmtDate(f.fechaEmision) + '</td>' +
      '<td>' + (f.proveedor || '') + '</td><td>' + (f.cifNif || '') + '</td>' +
      '<td style="text-align:right">' + fmt(f.baseImponible) + '</td>' +
      '<td style="text-align:right">' + fmt(f.totalIva) + '</td>' +
      '<td style="text-align:right">' + fmt(f.total) + '</td></tr>'
    ).join('');
    const html = '<html><head><meta charset="UTF-8"><title>IVA Trimestral</title>' +
      '<style>body{font-family:Arial;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse;margin-bottom:30px}' +
      'th{background:#f3f4f6;padding:6px;text-align:left;border-bottom:2px solid #ccc}' +
      'td{padding:5px;border-bottom:1px solid #eee}h1{font-size:18px}h2{font-size:14px;color:#666}' +
      '.resumen{background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}' +
      '.kpi{text-align:center}.kpi .valor{font-size:18px;font-weight:bold;color:#1e40af}.kpi .label{font-size:11px;color:#666}' +
      '</style></head><body>' +
      '<h1>Libro de IVA - ' + year + ' T' + trimestre + '</h1>' +
      '<h2>Periodo: ' + mesesNombres[data.mesInicio - 1] + ' - ' + mesesNombres[data.mesFin - 1] + ' ' + year + '</h2>' +
      '<div class="resumen">' +
      '<div class="kpi"><div class="valor">' + fmt(data.resumen?.totalIva) + '</div><div class="label">IVA repercutido</div></div>' +
      '<div class="kpi"><div class="valor">' + fmt(data.resumen?.totalIvaRecibidas) + '</div><div class="label">IVA soportado</div></div>' +
      '<div class="kpi"><div class="valor">' + fmt(data.resumen?.liquidacion) + '</div><div class="label">Liquidacion</div></div>' +
      '<div class="kpi"><div class="valor">' + (data.resumen?.numFacturas + data.resumen?.numFacturasRecibidas) + '</div><div class="label">Total facturas</div></div>' +
      '</div>' +
      '<h2>Facturas emitidas</h2>' +
      '<table><thead><tr><th>Numero</th><th>Fecha</th><th>Cliente</th><th>CIF/NIF</th><th>Base</th><th>IVA</th><th>IRPF</th><th>Total</th></tr></thead>' +
      '<tbody>' + rowsEmitidas + '</tbody></table>' +
      '<h2>Facturas recibidas</h2>' +
      '<table><thead><tr><th>Numero</th><th>Fecha</th><th>Proveedor</th><th>CIF/NIF</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead>' +
      '<tbody>' + rowsRecibidas + '</tbody></table>' +
      '</body></html>';
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const tabs = [
    { id: 'ventas', label: 'Ventas', icon: TrendingUp },
    { id: 'cobros', label: 'Cobros y Pagos', icon: ArrowUpDown },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'iva', label: 'IVA Trimestral', icon: Euro },
    { id: 'vencimientos', label: 'Vencimientos', icon: Clock },
    { id: 'cartera', label: 'Cartera cobros', icon: Wallet },
  ];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" />Informes
        </h1>
        <p className="text-slate-400 text-sm mt-1">Informes de gestion, fiscales y de stock</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
              (tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <label className="text-slate-400 text-sm">Ano:</label>
          <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
            value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {tab === 'iva' && (
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Trimestre:</label>
            <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
              value={trimestre} onChange={e => setTrimestre(parseInt(e.target.value))}>
              <option value={1}>T1 - Ene/Feb/Mar</option>
              <option value={2}>T2 - Abr/May/Jun</option>
              <option value={3}>T3 - Jul/Ago/Sep</option>
              <option value={4}>T4 - Oct/Nov/Dic</option>
            </select>
          </div>
        )}
        {tab === 'ventas' && (
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">Mes:</label>
            <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
              value={mes} onChange={e => setMes(parseInt(e.target.value))}>
              <option value={0}>Todo el ano</option>
              {mesesNombres.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        {tab === 'vencimientos' && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Desde:</label>
              <input type="date" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                value={vDesde} onChange={e => setVDesde(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Hasta:</label>
              <input type="date" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                value={vHasta} onChange={e => setVHasta(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Estado:</label>
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                value={vEstado} onChange={e => setVEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="VENCIDO">Vencido</option>
                <option value="PAGADO">Pagado</option>
                <option value="PAGADO_PARCIAL">Pagado parcial</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Cliente:</label>
              <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                value={vClienteId} onChange={e => setVClienteId(e.target.value)}>
                <option value="">Todos</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre || c.razonSocial}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tab === 'iva' && data && (
            <button onClick={imprimirIVA}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
              <Printer className="w-4 h-4" />Imprimir / PDF
            </button>
          )}
          {data && tab !== 'vencimientos' && (
            <button onClick={() => exportarCSV(tab === 'cobros' ? 'cobros' : tab)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
              <Download className="w-4 h-4" />Exportar CSV
            </button>
          )}
        </div>
      </div>

      {loading && <div className="p-12 text-center text-slate-400">Cargando informe...</div>}

      {/* ============================================ */}
      {/* TAB: VENTAS */}
      {/* ============================================ */}
      {!loading && tab === 'ventas' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total facturado" value={fmt(data.resumen?.totalFacturado)} color="text-green-400" />
            <StatCard label="Base imponible" value={fmt(data.resumen?.totalBase)} color="text-white" />
            <StatCard label="Num. facturas" value={data.resumen?.numFacturas || 0} color="text-blue-400" />
            <StatCard label="Media por factura" value={fmt(data.resumen?.mediaFactura)} color="text-purple-400" />
          </div>

          {/* Monthly bar chart */}
          {data.porMes?.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-white font-semibold mb-4">Ventas por mes {year}</h3>
              <div className="flex items-end gap-2" style={{ height: 200 }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const mesData = data.porMes.find((m: any) => m.mes === i + 1);
                  const total = mesData?.total || 0;
                  const maxTotal = Math.max(...data.porMes.map((x: any) => x.total), 1);
                  const pct = (total / maxTotal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-slate-400 whitespace-nowrap">{total > 0 ? fmtNum(total) : ''}</div>
                      <div className="w-full flex items-end" style={{ height: 160 }}>
                        <div className="w-full bg-indigo-600 rounded-t transition-all hover:bg-indigo-500"
                          style={{ height: pct + '%', minHeight: total > 0 ? 4 : 0 }}
                          title={mesesNombres[i] + ': ' + fmt(total)} />
                      </div>
                      <div className="text-xs text-slate-500">{mesesNombres[i].substring(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top clientes */}
          {data.topClientes?.length > 0 && (
            <TableWrapper title="Top 10 clientes" subtitle={data.topClientes.length + ' clientes'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['#', 'Cliente', 'Facturas', 'Total'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.topClientes.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 text-sm text-white">{c.nombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{c.num}</td>
                    <td className="px-3 py-2 text-sm font-bold text-green-400">{fmt(c.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableWrapper>
          )}

          {/* Por vendedor */}
          {data.porVendedor?.length > 0 && (
            <TableWrapper title="Ventas por vendedor" subtitle={data.porVendedor.length + ' vendedores'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Vendedor', 'Facturas', 'Total', '% del total'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.porVendedor.map((v: any, i: number) => {
                  const pct = data.resumen?.totalFacturado > 0
                    ? ((v.total / data.resumen.totalFacturado) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-sm text-white flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-500" />{v.nombre}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{v.num}</td>
                      <td className="px-3 py-2 text-sm font-bold text-green-400">{fmt(v.total)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-700 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: pct + '%' }} />
                          </div>
                          {pct}%
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </TableWrapper>
          )}

          {/* Por familia */}
          {data.porFamilia?.length > 0 && (
            <TableWrapper title="Ventas por familia de articulo" subtitle={data.porFamilia.length + ' familias'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Familia', 'Lineas', 'Cantidad', 'Total'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.porFamilia.slice(0, 15).map((f: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-sm text-white">{f.nombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{f.num}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{fmtNum(f.cantidad)}</td>
                    <td className="px-3 py-2 text-sm font-bold text-green-400">{fmt(f.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: COBROS Y PAGOS */}
      {/* ============================================ */}
      {!loading && tab === 'cobros' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total cobrado" value={fmt(data.cobrosRealizados?.total)} color="text-green-400" />
            <StatCard label="Total pagado" value={fmt(data.pagosRealizados?.total)} color="text-red-400" />
            <StatCard label="Saldo neto"
              value={fmt((data.cobrosRealizados?.total || 0) - (data.pagosRealizados?.total || 0))}
              color={(data.cobrosRealizados?.total || 0) - (data.pagosRealizados?.total || 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
            <StatCard label="Facturas vencidas"
              value={(data.previsionCobros?.['90+']?.count || 0) + (data.previsionCobros?.['61-90']?.count || 0) +
                (data.previsionCobros?.['31-60']?.count || 0) + (data.previsionCobros?.['0-30']?.count || 0)}
              color="text-orange-400" />
          </div>

          {/* Cobros vs Pagos por mes */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="text-white font-semibold mb-4">Cobros vs Pagos por mes {year}</h3>
            <div className="flex items-end gap-2" style={{ height: 200 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const cobro = data.cobrosRealizados?.porMes?.find((m: any) => m.mes === i + 1)?.total || 0;
                const pago = data.pagosRealizados?.porMes?.find((m: any) => m.mes === i + 1)?.total || 0;
                const allCobros = data.cobrosRealizados?.porMes?.map((m: any) => m.total) || [0];
                const allPagos = data.pagosRealizados?.porMes?.map((m: any) => m.total) || [0];
                const maxVal = Math.max(...allCobros, ...allPagos, 1);
                const pctC = (cobro / maxVal) * 100;
                const pctP = (pago / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5" style={{ height: 160 }}>
                      <div className="flex-1 bg-green-600 rounded-t transition-all hover:bg-green-500"
                        style={{ height: pctC + '%', minHeight: cobro > 0 ? 3 : 0 }}
                        title={'Cobrado: ' + fmt(cobro)} />
                      <div className="flex-1 bg-red-600 rounded-t transition-all hover:bg-red-500"
                        style={{ height: pctP + '%', minHeight: pago > 0 ? 3 : 0 }}
                        title={'Pagado: ' + fmt(pago)} />
                    </div>
                    <div className="text-xs text-slate-500">{mesesNombres[i].substring(0, 3)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-3 h-3 rounded bg-green-600" />Cobros
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-3 h-3 rounded bg-red-600" />Pagos
              </div>
            </div>
          </div>

          {/* Aging table cobros */}
          <TableWrapper title="Envejecimiento de cobros pendientes">
            <table className="w-full">
              <thead><tr className="border-b border-slate-800">
                {['Periodo', 'Num. facturas', 'Importe pendiente'].map(h =>
                  <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                )}
              </tr></thead>
              <tbody>
                {[
                  { label: '0 - 30 dias', key: '0-30', color: 'text-green-400' },
                  { label: '31 - 60 dias', key: '31-60', color: 'text-yellow-400' },
                  { label: '61 - 90 dias', key: '61-90', color: 'text-orange-400' },
                  { label: 'Mas de 90 dias', key: '90+', color: 'text-red-400' },
                ].map(row => (
                  <tr key={row.key} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 text-sm text-white">{row.label}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-400">{data.previsionCobros?.[row.key]?.count || 0}</td>
                    <td className={'px-3 py-2.5 text-sm font-bold ' + row.color}>
                      {fmt(data.previsionCobros?.[row.key]?.total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>

          {/* Aging table pagos */}
          <TableWrapper title="Envejecimiento de pagos pendientes">
            <table className="w-full">
              <thead><tr className="border-b border-slate-800">
                {['Periodo', 'Num. facturas', 'Importe pendiente'].map(h =>
                  <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                )}
              </tr></thead>
              <tbody>
                {[
                  { label: '0 - 30 dias', key: '0-30', color: 'text-green-400' },
                  { label: '31 - 60 dias', key: '31-60', color: 'text-yellow-400' },
                  { label: '61 - 90 dias', key: '61-90', color: 'text-orange-400' },
                  { label: 'Mas de 90 dias', key: '90+', color: 'text-red-400' },
                ].map(row => (
                  <tr key={row.key} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 text-sm text-white">{row.label}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-400">{data.previsionPagos?.[row.key]?.count || 0}</td>
                    <td className={'px-3 py-2.5 text-sm font-bold ' + row.color}>
                      {fmt(data.previsionPagos?.[row.key]?.total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>

          {/* Clientes morosos */}
          {data.clientesMorosos?.length > 0 && (
            <TableWrapper title="Clientes morosos" subtitle={data.clientesMorosos.length + ' clientes con facturas vencidas'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Cliente', 'CIF/NIF', 'Facturas vencidas', 'Importe vencido', 'Max. dias retraso'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.clientesMorosos.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-sm text-white flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />{c.nombre}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{c.cifNif || '-'}</td>
                    <td className="px-3 py-2 text-sm text-orange-400">{c.numFacturas}</td>
                    <td className="px-3 py-2 text-sm font-bold text-red-400">{fmt(c.importeVencido)}</td>
                    <td className="px-3 py-2 text-sm text-red-400">{c.diasMaxRetraso} dias</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: STOCK */}
      {/* ============================================ */}
      {!loading && tab === 'stock' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Valoracion total stock" value={fmt(data.valoracionTotal)} color="text-green-400" />
            <StatCard label="Total articulos activos" value={data.totalArticulos || 0} color="text-blue-400" />
            <StatCard label="Articulos bajo minimos" value={data.numBajoMinimos || 0}
              color={data.numBajoMinimos > 0 ? 'text-red-400' : 'text-green-400'} />
          </div>

          {/* Bajo minimos */}
          {data.articulosBajoMinimos?.length > 0 && (
            <TableWrapper title="Articulos bajo minimos"
              subtitle={data.articulosBajoMinimos.length + ' articulos requieren reposicion'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Referencia', 'Articulo', 'Familia', 'Stock actual', 'Stock minimo', 'Deficit'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.articulosBajoMinimos.map((a: any) => {
                  const deficit = (a.stockMinimo || 0) - (a.stockActual || 0);
                  return (
                    <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-xs font-mono text-blue-400">{a.referencia}</td>
                      <td className="px-3 py-2 text-sm text-white">{a.nombre}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{a.familia?.nombre || '-'}</td>
                      <td className="px-3 py-2 text-sm text-red-400 font-bold">{fmtNum(a.stockActual)}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">{fmtNum(a.stockMinimo)}</td>
                      <td className="px-3 py-2 text-sm text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />-{fmtNum(deficit)}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </TableWrapper>
          )}

          {/* Top vendidos */}
          {data.topArticulosVendidos?.length > 0 && (
            <TableWrapper title="Top 20 articulos mas vendidos" subtitle="Por cantidad total vendida">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['#', 'Referencia', 'Articulo', 'Familia', 'Cant. vendida', 'Total vendido'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>{data.topArticulosVendidos.map((a: any, i: number) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-mono text-blue-400">{a.referencia}</td>
                    <td className="px-3 py-2 text-sm text-white">{a.nombre}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{a.familia}</td>
                    <td className="px-3 py-2 text-sm text-white font-bold">{fmtNum(a.cantidadVendida)}</td>
                    <td className="px-3 py-2 text-sm font-bold text-green-400">{fmt(a.totalVendido)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableWrapper>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: IVA TRIMESTRAL */}
      {/* ============================================ */}
      {!loading && tab === 'iva' && data && (
        <div className="space-y-6">
          {/* Resumen cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="IVA repercutido" value={fmt(data.resumen?.totalIva)} color="text-blue-400" />
            <StatCard label="IVA soportado" value={fmt(data.resumen?.totalIvaRecibidas)} color="text-orange-400" />
            <StatCard label="Liquidacion IVA" value={fmt(data.resumen?.liquidacion)}
              color={(data.resumen?.liquidacion || 0) >= 0 ? 'text-red-400' : 'text-green-400'} />
            <StatCard label="IRPF retenido" value={fmt(data.resumen?.totalIrpf)} color="text-yellow-400" />
          </div>

          {/* Desglose por tipo IVA */}
          {(data.resumen?.desglosePorIva?.length > 0 || data.resumen?.desgloseRecibidas?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {/* Emitidas desglose */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Desglose IVA repercutido</h3>
                <div className="space-y-2">
                  {(data.resumen?.desglosePorIva || []).map((d: any) => (
                    <div key={d.tipoIva} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">IVA {d.tipoIva}%</span>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Base: {fmt(d.base)}</div>
                        <div className="text-sm font-bold text-blue-400">{fmt(d.iva)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Recibidas desglose */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Desglose IVA soportado</h3>
                <div className="space-y-2">
                  {(data.resumen?.desgloseRecibidas || []).map((d: any) => (
                    <div key={d.tipoIva} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">IVA {d.tipoIva}%</span>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Base: {fmt(d.base)}</div>
                        <div className="text-sm font-bold text-orange-400">{fmt(d.iva)}</div>
                      </div>
                    </div>
                  ))}
                  {(!data.resumen?.desgloseRecibidas || data.resumen.desgloseRecibidas.length === 0) && (
                    <div className="text-slate-500 text-sm text-center py-4">Sin facturas recibidas en este periodo</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Resumen general */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h4 className="text-slate-400 text-xs mb-2">Facturas emitidas</h4>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-sm text-slate-400">Base imponible:</span><span className="text-sm text-white font-bold">{fmt(data.resumen?.totalBase)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-400">IVA repercutido:</span><span className="text-sm text-blue-400 font-bold">{fmt(data.resumen?.totalIva)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-400">IRPF:</span><span className="text-sm text-orange-400 font-bold">{fmt(data.resumen?.totalIrpf)}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-sm text-slate-400">Total:</span><span className="text-sm text-green-400 font-bold">{fmt(data.resumen?.totalFacturado)}</span></div>
                <div className="text-xs text-slate-500 mt-1">{data.resumen?.numFacturas} facturas</div>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h4 className="text-slate-400 text-xs mb-2">Facturas recibidas</h4>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-sm text-slate-400">Base imponible:</span><span className="text-sm text-white font-bold">{fmt(data.resumen?.totalBaseRecibidas)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-400">IVA soportado:</span><span className="text-sm text-orange-400 font-bold">{fmt(data.resumen?.totalIvaRecibidas)}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-sm text-slate-400">Total:</span><span className="text-sm text-green-400 font-bold">{fmt(data.resumen?.totalRecibidas)}</span></div>
                <div className="text-xs text-slate-500 mt-1">{data.resumen?.numFacturasRecibidas} facturas</div>
              </div>
            </div>
          </div>

          {/* Facturas emitidas table */}
          <TableWrapper title={'Facturas emitidas T' + trimestre + ' ' + year}
            subtitle={data.resumen?.numFacturas + ' facturas'}>
            <table className="w-full">
              <thead><tr className="border-b border-slate-800">
                {['Numero', 'Fecha', 'Cliente', 'CIF/NIF', 'Base', 'IVA', 'IRPF', 'Total'].map(h =>
                  <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                )}
              </tr></thead>
              <tbody>
                {(data.facturas || []).map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs font-mono text-blue-400">{f.numeroCompleto}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(f.fechaEmision)}</td>
                    <td className="px-3 py-2 text-xs text-white">{f.cliente}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{f.cifNif || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-300">{fmt(f.baseImponible)}</td>
                    <td className="px-3 py-2 text-xs text-right text-blue-400">{fmt(f.totalIva)}</td>
                    <td className="px-3 py-2 text-xs text-right text-orange-400">{fmt(f.totalIrpf)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-white">{fmt(f.total)}</td>
                  </tr>
                ))}
                {(data.facturas || []).length > 0 && (
                  <tr className="border-t-2 border-slate-600 bg-slate-800/50">
                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-white">TOTALES</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-white">{fmt(data.resumen?.totalBase)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-blue-400">{fmt(data.resumen?.totalIva)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-orange-400">{fmt(data.resumen?.totalIrpf)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-green-400">{fmt(data.resumen?.totalFacturado)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrapper>

          {/* Facturas recibidas table */}
          <TableWrapper title={'Facturas recibidas T' + trimestre + ' ' + year}
            subtitle={data.resumen?.numFacturasRecibidas + ' facturas'}>
            <table className="w-full">
              <thead><tr className="border-b border-slate-800">
                {['Numero', 'Fecha', 'Proveedor', 'CIF/NIF', 'Base', 'IVA', 'Total'].map(h =>
                  <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                )}
              </tr></thead>
              <tbody>
                {(data.libroRecibidas || []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500 text-sm">
                    Sin facturas recibidas en este periodo
                  </td></tr>
                )}
                {(data.libroRecibidas || []).map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-xs font-mono text-blue-400">{f.numero}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(f.fechaEmision)}</td>
                    <td className="px-3 py-2 text-xs text-white">{f.proveedor}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{f.cifNif || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-300">{fmt(f.baseImponible)}</td>
                    <td className="px-3 py-2 text-xs text-right text-orange-400">{fmt(f.totalIva)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-white">{fmt(f.total)}</td>
                  </tr>
                ))}
                {(data.libroRecibidas || []).length > 0 && (
                  <tr className="border-t-2 border-slate-600 bg-slate-800/50">
                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-white">TOTALES</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-white">{fmt(data.resumen?.totalBaseRecibidas)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-orange-400">{fmt(data.resumen?.totalIvaRecibidas)}</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-green-400">{fmt(data.resumen?.totalRecibidas)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrapper>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: VENCIMIENTOS */}
      {/* ============================================ */}
      {!loading && tab === 'vencimientos' && data && (() => {
        const vencimientos: any[] = data.vencimientos || data || [];
        const totales = vencimientos.reduce((acc: any, v: any) => {
          const est = v.estado || '';
          if (est === 'PENDIENTE' || est === 'VENCIDO') acc.pendiente += (v.importe || 0);
          if (est === 'VENCIDO') acc.vencido += (v.importe || 0);
          if (est === 'PAGADO' || est === 'PAGADO_PARCIAL') acc.pagado += (v.importePagado || v.importe || 0);
          return acc;
        }, { pendiente: 0, vencido: 0, pagado: 0 });
        const estadoBadge = (estado: string) => {
          const colors: Record<string, string> = {
            PENDIENTE: 'bg-slate-600 text-slate-200',
            VENCIDO: 'bg-red-600 text-red-100',
            PAGADO: 'bg-green-600 text-green-100',
            PAGADO_PARCIAL: 'bg-orange-600 text-orange-100',
          };
          return colors[estado] || 'bg-slate-600 text-slate-200';
        };
        const exportarVencimientosCSV = () => {
          const rows = [['Factura', 'Cliente', 'Importe', 'Fecha vto', 'Estado', 'Días vencido'].join(';')];
          vencimientos.forEach((v: any) => {
            rows.push([
              v.factura || '', v.cliente || '', (v.importe || 0).toString().replace('.', ','),
              fmtDate(v.fechaVencimiento), v.estado || '', (v.diasVencido || 0).toString()
            ].join(';'));
          });
          downloadCSV(rows.join('\n'), 'vencimientos_' + vDesde + '_' + vHasta + '.csv');
        };
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total pendiente" value={fmt(totales.pendiente)} color="text-orange-400" />
              <StatCard label="Total vencido" value={fmt(totales.vencido)} color="text-red-400" />
              <StatCard label="Total pagado" value={fmt(totales.pagado)} color="text-green-400" />
            </div>

            <div className="flex justify-end">
              <button onClick={exportarVencimientosCSV}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
                <Download className="w-4 h-4" />Exportar CSV
              </button>
            </div>

            <TableWrapper title="Vencimientos" subtitle={vencimientos.length + ' registros'}>
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Factura', 'Cliente', 'Importe', 'Fecha vto', 'Estado', 'Días vencido'].map(h =>
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-3">{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {vencimientos.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500 text-sm">
                      Sin vencimientos en el periodo seleccionado
                    </td></tr>
                  )}
                  {vencimientos.map((v: any, i: number) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-xs font-mono text-blue-400">{v.factura}</td>
                      <td className="px-3 py-2 text-sm text-white">{v.cliente}</td>
                      <td className="px-3 py-2 text-sm text-right font-bold text-white">{fmt(v.importe)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(v.fechaVencimiento)}</td>
                      <td className="px-3 py-2">
                        <span className={'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' + estadoBadge(v.estado)}>
                          {(v.estado || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-400">{v.diasVencido > 0 ? v.diasVencido : '-'}</td>
                    </tr>
                  ))}
                  {vencimientos.length > 0 && (
                    <tr className="border-t-2 border-slate-600 bg-slate-800/50">
                      <td colSpan={2} className="px-3 py-2 text-xs font-bold text-white">TOTALES</td>
                      <td className="px-3 py-2 text-xs text-right font-bold text-white">
                        Pendiente: {fmt(totales.pendiente)}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-red-400">
                        Vencido: {fmt(totales.vencido)}
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-xs font-bold text-green-400">
                        Pagado: {fmt(totales.pagado)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableWrapper>
          </div>
        );
      })()}

      {/* ============================================ */}
      {/* TAB: CARTERA COBROS */}
      {/* ============================================ */}
      {!loading && tab === 'cartera' && data && (() => {
        const clientes: any[] = data.clientes || data || [];
        const totalGeneral = clientes.reduce((sum: number, c: any) => sum + (c.totalPendiente || 0), 0);
        const colorDias = (dias: number) => {
          if (dias < 15) return 'text-green-400';
          if (dias <= 30) return 'text-yellow-400';
          return 'text-red-400';
        };
        const bgDias = (dias: number) => {
          if (dias < 15) return 'bg-green-900/30';
          if (dias <= 30) return 'bg-yellow-900/30';
          return 'bg-red-900/30';
        };
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total pendiente de cobro" value={fmt(totalGeneral)} color="text-orange-400" />
              <StatCard label="Clientes con deuda" value={clientes.length} color="text-blue-400" />
            </div>

            {clientes.map((cliente: any, ci: number) => (
              <div key={ci} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-white font-semibold">{cliente.nombre}</h3>
                  </div>
                  <span className="text-sm font-bold text-orange-400">Pendiente: {fmt(cliente.totalPendiente)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-slate-800">
                      {['Factura', 'Fecha', 'Total', 'Pagado', 'Pendiente', 'Días vencido'].map(h =>
                        <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-2">{h}</th>
                      )}
                    </tr></thead>
                    <tbody>
                      {(cliente.facturas || []).map((f: any, fi: number) => (
                        <tr key={fi} className={'border-b border-slate-800/50 hover:bg-slate-800/30 ' + bgDias(f.diasVencido || 0)}>
                          <td className="px-3 py-2 text-xs font-mono text-blue-400 pl-6">{f.factura}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{fmtDate(f.fecha)}</td>
                          <td className="px-3 py-2 text-sm text-white">{fmt(f.total)}</td>
                          <td className="px-3 py-2 text-sm text-green-400">{fmt(f.pagado)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-orange-400">{fmt(f.pendiente)}</td>
                          <td className={'px-3 py-2 text-sm font-bold ' + colorDias(f.diasVencido || 0)}>
                            {f.diasVencido > 0 ? f.diasVencido + ' días' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {clientes.length > 0 && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center justify-between">
                <span className="text-white font-bold text-sm">TOTAL GENERAL</span>
                <span className="text-lg font-bold text-orange-400">{fmt(totalGeneral)}</span>
              </div>
            )}

            {clientes.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay datos de cartera de cobros disponibles.</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* No data state */}
      {!loading && !data && (
        <div className="p-12 text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No se han podido cargar los datos del informe.</p>
          <button onClick={cargar}
            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm underline">
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
