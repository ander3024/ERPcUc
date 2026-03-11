import { useState, useEffect, useCallback } from 'react';
import { BookOpen, TrendingUp, BarChart2, List, Search, Plus, RefreshCw, X, Save, Trash2, AlertTriangle, ChevronRight, ArrowUpDown, Landmark, PiggyBank, FileText, Lock, CheckCircle, XCircle, Building2 } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const H = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const TIPOS_CUENTA = ['ACTIVO','PASIVO','PATRIMONIO','INGRESO','GASTO'];
const COLOR_TIPO: Record<string, string> = {
  ACTIVO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  PASIVO: 'bg-red-500/20 text-red-300 border-red-500/30',
  PATRIMONIO: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  INGRESO: 'bg-green-500/20 text-green-300 border-green-500/30',
  GASTO: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

// ---- RESUMEN ----
function TabResumen({ ejercicio }: { ejercicio: number }) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(API + '/contabilidad/resumen?ejercicio=' + ejercicio, { headers: H() })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [ejercicio]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/></div>;

  const kpis = [
    { label: 'Ingresos ejercicio', value: fmt(data.totalVentas || 0), color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Gastos ejercicio', value: fmt(data.totalCompras || 0), color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Resultado', value: fmt(data.resultado || 0), color: data.resultado >= 0 ? 'text-emerald-400' : 'text-red-400', bg: data.resultado >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20' },
    { label: 'Asientos', value: data.numAsientos || 0, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Cuentas activas', value: data.numCuentas || 0, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={"rounded-xl p-4 border " + k.bg}>
            <div className="text-xs text-slate-500 mb-2">{k.label}</div>
            <div className={"font-bold text-xl " + k.color}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-white font-semibold mb-4">Resumen ejercicio {ejercicio}</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">Ingresos vs Gastos</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Ingresos</span><span className="text-green-400 font-medium">{fmt(data.totalVentas)}</span></div>
                <div className="h-2 bg-slate-700 rounded-full"><div className="h-2 bg-green-500 rounded-full" style={{width: '100%'}}/></div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Gastos</span><span className="text-red-400 font-medium">{fmt(data.totalCompras)}</span></div>
                <div className="h-2 bg-slate-700 rounded-full"><div className="h-2 bg-red-500 rounded-full" style={{width: data.totalVentas > 0 ? Math.min((data.totalCompras / data.totalVentas) * 100, 100) + '%' : '0%'}}/></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-slate-700/30 rounded-xl p-4">
            <div className="text-xs text-slate-500 mb-2">Resultado del ejercicio</div>
            <div className={"text-3xl font-bold " + (data.resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(data.resultado)}</div>
            <div className={"text-xs mt-1 " + (data.resultado >= 0 ? 'text-emerald-500' : 'text-red-500')}>{data.resultado >= 0 ? 'Beneficio' : 'Perdida'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- CUENTA DE RESULTADOS ----
function TabResultados({ ejercicio }: { ejercicio: number }) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(API + '/contabilidad/cuenta-resultados?ejercicio=' + ejercicio, { headers: H() })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [ejercicio]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>;

  const maxVal = Math.max(...(data.meses || []).map((m: any) => Math.max(m.ingresos, m.gastos)), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-2">Total ingresos</div>
          <div className="text-2xl font-bold text-green-400">{fmt(data.totalIngresos || 0)}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-2">Total gastos</div>
          <div className="text-2xl font-bold text-red-400">{fmt(data.totalGastos || 0)}</div>
        </div>
        <div className={"border rounded-xl p-4 " + (data.resultado >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
          <div className="text-xs text-slate-500 mb-2">Resultado neto</div>
          <div className={"text-2xl font-bold " + (data.resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(data.resultado || 0)}</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-white font-semibold mb-4">Ingresos vs Gastos por mes</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-700">
              {['Mes','Ingresos','Gastos','Resultado','Margen'].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-medium px-3 py-2 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(data.meses || []).map((m: any) => {
                const margen = m.ingresos > 0 ? ((m.resultado / m.ingresos) * 100) : 0;
                return (
                  <tr key={m.mes} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-3 py-2.5 text-sm text-white font-medium">{MESES[m.mes]}</td>
                    <td className="px-3 py-2.5 text-sm text-green-400 font-medium">{fmt(m.ingresos)}</td>
                    <td className="px-3 py-2.5 text-sm text-red-400">{fmt(m.gastos)}</td>
                    <td className={"px-3 py-2.5 text-sm font-semibold " + (m.resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(m.resultado)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full">
                          <div className={"h-1.5 rounded-full " + (m.resultado >= 0 ? 'bg-emerald-500' : 'bg-red-500')}
                            style={{width: Math.min(Math.abs(margen), 100) + '%'}}/>
                        </div>
                        <span className={"text-xs font-medium w-12 text-right " + (margen >= 0 ? 'text-emerald-400' : 'text-red-400')}>{margen.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-600">
              <tr>
                <td className="px-3 py-3 text-sm font-bold text-white">TOTAL</td>
                <td className="px-3 py-3 text-sm font-bold text-green-400">{fmt(data.totalIngresos)}</td>
                <td className="px-3 py-3 text-sm font-bold text-red-400">{fmt(data.totalGastos)}</td>
                <td className={"px-3 py-3 text-sm font-bold " + (data.resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(data.resultado)}</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- BALANCE ----
function TabBalance({ ejercicio }: { ejercicio: number }) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(API + '/contabilidad/balance-sumas-saldos?ejercicio=' + ejercicio, { headers: H() })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [ejercicio]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/></div>;

  const cuentas: any[] = data.cuentas || [];
  const totalDebe = cuentas.reduce((s: number, c: any) => s + c.debe, 0);
  const totalHaber = cuentas.reduce((s: number, c: any) => s + c.haber, 0);

  if (cuentas.length === 0) return (
    <div className="p-12 text-center text-slate-400">
      <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30"/>
      <p className="font-medium">Sin movimientos contables en {ejercicio}</p>
      <p className="text-sm mt-1">Crea asientos para ver el balance de sumas y saldos</p>
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-white font-semibold">Balance de sumas y saldos · Ejercicio {ejercicio}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-700 bg-slate-700/30">
            {['Cuenta','Nombre','Tipo','Debe','Haber','Saldo D','Saldo H'].map(h => (
              <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {cuentas.map((c: any) => (
              <tr key={c.codigo} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-2.5 text-sm font-mono text-slate-300 font-medium">{c.codigo}</td>
                <td className="px-4 py-2.5 text-sm text-white">{c.nombre}</td>
                <td className="px-4 py-2.5">
                  <span className={"text-xs px-2 py-0.5 rounded-full border font-medium " + (COLOR_TIPO[c.tipo] || 'bg-slate-600 text-slate-300')}>{c.tipo}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-300">{fmt(c.debe)}</td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-300">{fmt(c.haber)}</td>
                <td className="px-4 py-2.5 text-sm text-right text-blue-300 font-medium">{c.saldoDebe > 0 ? fmt(c.saldoDebe) : '-'}</td>
                <td className="px-4 py-2.5 text-sm text-right text-orange-300 font-medium">{c.saldoHaber > 0 ? fmt(c.saldoHaber) : '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-500 bg-slate-700/50">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-bold text-white">TOTALES</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-white">{fmt(totalDebe)}</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-white">{fmt(totalHaber)}</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-blue-300">{fmt(cuentas.reduce((s: number, c: any) => s + c.saldoDebe, 0))}</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-orange-300">{fmt(cuentas.reduce((s: number, c: any) => s + c.saldoHaber, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---- ASIENTOS ----
function ModalAsiento({ onClose, onSaved, cuentas }: { onClose: () => void; onSaved: () => void; cuentas: any[] }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0,10), concepto: '', diario: 'DIARIO' });
  const [lineas, setLineas] = useState([{ cuentaDebeId: '', cuentaHaberId: '', importeDebe: '', importeHaber: '', concepto: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDebe = lineas.reduce((s, l) => s + parseFloat(l.importeDebe || '0'), 0);
  const totalHaber = lineas.reduce((s, l) => s + parseFloat(l.importeHaber || '0'), 0);
  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01;

  const guardar = async () => {
    if (!form.concepto || !form.fecha) { setError('Concepto y fecha son obligatorios'); return; }
    if (!cuadrado) { setError('El asiento no cuadra (Debe = Haber)'); return; }
    setSaving(true);
    try {
      const body = { ...form, lineas: lineas.filter(l => l.importeDebe || l.importeHaber).map(l => ({ ...l, importeDebe: parseFloat(l.importeDebe) || 0, importeHaber: parseFloat(l.importeHaber) || 0 })) };
      const r = await fetch(API + '/contabilidad/asientos', { method: 'POST', headers: H(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      onSaved(); onClose();
    } catch (e: any) { setError(String(e.message)); }
    setSaving(false);
  };

  const addLinea = () => setLineas([...lineas, { cuentaDebeId: '', cuentaHaberId: '', importeDebe: '', importeHaber: '', concepto: '' }]);
  const removeLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, val: string) => setLineas(lineas.map((l, idx) => idx === i ? {...l, [field]: val} : l));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Nuevo asiento contable</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Concepto *</label>
              <input value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Descripcion del asiento..."/>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Lineas del asiento</div>
              <div className={"text-xs font-medium px-2 py-1 rounded " + (cuadrado ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>
                D: {fmt(totalDebe)} / H: {fmt(totalHaber)} {cuadrado ? '✓ Cuadra' : '✗ No cuadra'}
              </div>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <select value={l.cuentaDebeId} onChange={e => updateLinea(i, 'cuentaDebeId', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                      <option value="">Cuenta DEBE...</option>
                      {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <select value={l.cuentaHaberId} onChange={e => updateLinea(i, 'cuentaHaberId', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                      <option value="">Cuenta HABER...</option>
                      {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Debe" value={l.importeDebe} onChange={e => updateLinea(i, 'importeDebe', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none text-right"/>
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Haber" value={l.importeHaber} onChange={e => updateLinea(i, 'importeHaber', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none text-right"/>
                  </div>
                  <div className="col-span-12">
                    <input placeholder="Concepto linea (opcional)" value={l.concepto} onChange={e => updateLinea(i, 'concepto', e.target.value)}
                      className="w-full bg-slate-600 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none mb-1"/>
                  </div>
                  {lineas.length > 1 && i === lineas.length - 1 && (
                    <div className="col-span-12 flex justify-end">
                      <button onClick={() => removeLinea(i)} className="text-xs text-red-400 hover:text-red-300">Eliminar linea</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLinea} className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Plus className="w-3.5 h-3.5"/>Anadir linea
            </button>
          </div>
        </div>
        <div className="p-5 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={guardar} disabled={saving || !cuadrado}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            <Save className="w-4 h-4"/>{saving ? 'Guardando...' : 'Crear asiento'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabAsientos({ ejercicio, cuentas }: { ejercicio: number; cuentas: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ejercicio: String(ejercicio), search });
      const dr = await fetch(API + '/contabilidad/asientos?' + params, { headers: H() }).then(r => r.json());
      setData(Array.isArray(dr.data) ? dr.data : []);
      setPagination(dr.pagination || { page: 1, total: 0, pages: 0 });
    } catch { setData([]); } finally { setLoading(false); }
  }, [ejercicio, search]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const selected = data.find(a => a.id === selectedId);

  const eliminar = async (id: string) => {
    setDeleting(true);
    try {
      await fetch(API + '/contabilidad/asientos/' + id, { method: 'DELETE', headers: H() });
      setSelectedId(null); cargar(1);
      setMsg('Asiento eliminado');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setDeleting(false);
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Buscar asiento..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
          </div>
          <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4"/>Nuevo asiento
          </button>
        </div>
        {msg && <div className="mb-3 px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-sm">{msg}</div>}
        <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="font-medium">No hay asientos en {ejercicio}</p>
              <p className="text-sm mt-1">Crea el primer asiento contable</p>
            </div>
          ) : (
            <div className="overflow-y-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700 sticky top-0 bg-slate-800">
                  {['N. Asiento','Fecha','Concepto','Diario','Lineas',''].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>{data.map(a => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (a.id === selectedId ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : '')}>
                    <td className="px-4 py-3 text-sm font-mono text-blue-400 font-medium">{a.ejercicio}/{String(a.numero).padStart(4,'0')}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(a.fecha)}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium max-w-xs truncate">{a.concepto}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">{a.diario}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-400">{a.lineas?.length || 0}</td>
                    <td className="px-4 py-3"><ChevronRight className={"w-4 h-4 transition-transform " + (a.id===selectedId ? 'rotate-90 text-blue-400' : 'text-slate-500 group-hover:text-slate-300')}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-700 shrink-0">
              <span className="text-slate-400 text-sm">Pagina {pagination.page} de {pagination.pages} · {pagination.total}</span>
              <div className="flex gap-2">
                <button onClick={() => cargar(pagination.page-1)} disabled={pagination.page<=1} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Anterior</button>
                <button onClick={() => cargar(pagination.page+1)} disabled={pagination.page>=pagination.pages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="w-80 bg-slate-800 border border-slate-700 rounded-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <span className="font-mono text-white font-bold">{selected.ejercicio}/{String(selected.numero).padStart(4,'0')}</span>
            <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-sm text-white font-medium">{selected.concepto}</div>
            <div className="text-xs text-slate-400">{fmtDate(selected.fecha)} · {selected.diario} · {selected.creador?.nombre || ''}</div>
            <div className="space-y-2 mt-3">
              {(selected.lineas || []).map((l: any, i: number) => (
                <div key={l.id} className="bg-slate-700/50 rounded p-3 text-xs space-y-1">
                  {l.concepto && <div className="text-slate-400 mb-1">{l.concepto}</div>}
                  {l.cuentaDebe && <div className="flex justify-between"><span className="text-blue-300">D: {l.cuentaDebe.codigo} {l.cuentaDebe.nombre}</span><span className="text-white font-semibold">{fmt(l.importeDebe)}</span></div>}
                  {l.cuentaHaber && <div className="flex justify-between"><span className="text-orange-300">H: {l.cuentaHaber.codigo} {l.cuentaHaber.nombre}</span><span className="text-white font-semibold">{fmt(l.importeHaber)}</span></div>}
                </div>
              ))}
            </div>
            <div className="bg-slate-700/30 rounded p-3 flex justify-between text-xs">
              <span className="text-slate-400">Total debe/haber</span>
              <span className="text-white font-semibold">{fmt((selected.lineas||[]).reduce((s: number, l: any) => s + Number(l.importeDebe||0), 0))}</span>
            </div>
          </div>
          <div className="p-4 border-t border-slate-700">
            <button onClick={() => eliminar(selected.id)} disabled={deleting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors">
              <Trash2 className="w-4 h-4"/>{deleting ? 'Eliminando...' : 'Eliminar asiento'}
            </button>
          </div>
        </div>
      )}

      {showModal && <ModalAsiento onClose={() => setShowModal(false)} onSaved={() => cargar(1)} cuentas={cuentas}/>}
    </div>
  );
}

// ---- PLAN DE CUENTAS ----
function TabPlanCuentas({ cuentas, onReload }: { cuentas: any[]; onReload: () => void }) {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', tipo: 'ACTIVO', nivel: '1' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const filtradas = cuentas.filter(c =>
    (!tipoFilter || c.tipo === tipoFilter) &&
    (!search || c.codigo.includes(search) || c.nombre.toLowerCase().includes(search.toLowerCase()))
  );

  const crear = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/contabilidad/cuentas', { method: 'POST', headers: H(), body: JSON.stringify({...form, nivel: parseInt(form.nivel)}) });
      if (!r.ok) throw new Error(await r.text());
      setMsg('Cuenta creada'); onReload(); setShowNew(false); setForm({ codigo: '', nombre: '', tipo: 'ACTIVO', nivel: '1' });
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {msg && <div className={"px-3 py-2 rounded-lg text-sm " + (msg.startsWith('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300')}>{msg}</div>}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
          <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4"/>Nueva cuenta
        </button>
      </div>

      {showNew && (
        <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4 grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Codigo *</label>
            <input value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none" placeholder="e.g. 430"/>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none" placeholder="Nombre de la cuenta"/>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none">
              {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={crear} disabled={saving || !form.codigo || !form.nombre}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            <Save className="w-4 h-4"/>Crear
          </button>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-3 border-b border-slate-700 text-xs text-slate-500">{filtradas.length} cuentas</div>
        <div className="overflow-y-auto max-h-96">
          <table className="w-full">
            <thead><tr className="border-b border-slate-700">
              {['Codigo','Nombre','Tipo','Nivel'].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtradas.map(c => (
              <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-2.5 text-sm font-mono text-slate-300 font-medium">{c.codigo}</td>
                <td className="px-4 py-2.5 text-sm text-white">{c.nombre}</td>
                <td className="px-4 py-2.5">
                  <span className={"text-xs px-2 py-0.5 rounded-full border font-medium " + (COLOR_TIPO[c.tipo] || '')}>{c.tipo}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-400">{c.nivel}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- CONCILIACIÓN BANCARIA ----
function TabConciliacion({ ejercicio }: { ejercicio: number }) {
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [selCuenta, setSelCuenta] = useState<string>('');
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroConciliado, setFiltroConciliado] = useState('');
  const [showNewCuenta, setShowNewCuenta] = useState(false);
  const [showNewMov, setShowNewMov] = useState(false);
  const [formCuenta, setFormCuenta] = useState({ nombre: '', iban: '', entidad: '', saldoInicial: 0 });
  const [formMov, setFormMov] = useState({ fecha: new Date().toISOString().slice(0,10), concepto: '', importe: 0, tipo: 'OTROS', referencia: '' });
  const [pendientes, setPendientes] = useState(0);

  const cargarCuentas = async () => {
    try {
      const r = await fetch(API + '/contabilidad/banco/cuentas', { headers: H() }).then(r => r.json());
      setCuentas(Array.isArray(r) ? r : []);
    } catch {}
  };

  const cargarMovimientos = async () => {
    if (!selCuenta) { setMovimientos([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ cuentaId: selCuenta, limit: '50' });
      if (filtroConciliado) params.set('conciliado', filtroConciliado);
      const r = await fetch(API + '/contabilidad/banco/movimientos?' + params, { headers: H() }).then(r => r.json());
      setMovimientos(r.data || []);
    } catch {}
    setLoading(false);
  };

  const cargarResumen = async () => {
    try {
      const r = await fetch(API + '/contabilidad/banco/resumen', { headers: H() }).then(r => r.json());
      setPendientes(r.pendientes || 0);
    } catch {}
  };

  useEffect(() => { cargarCuentas(); cargarResumen(); }, []);
  useEffect(() => { cargarMovimientos(); }, [selCuenta, filtroConciliado]);

  const guardarCuenta = async () => {
    await fetch(API + '/contabilidad/banco/cuentas', { method: 'POST', headers: H(), body: JSON.stringify({ ...formCuenta, saldoActual: formCuenta.saldoInicial }) });
    setShowNewCuenta(false); cargarCuentas(); setFormCuenta({ nombre: '', iban: '', entidad: '', saldoInicial: 0 });
  };

  const guardarMov = async () => {
    if (!selCuenta) return;
    await fetch(API + '/contabilidad/banco/movimientos', { method: 'POST', headers: H(), body: JSON.stringify({ ...formMov, cuentaBancariaId: selCuenta }) });
    setShowNewMov(false); cargarMovimientos(); cargarCuentas(); setFormMov({ fecha: new Date().toISOString().slice(0,10), concepto: '', importe: 0, tipo: 'OTROS', referencia: '' });
  };

  const conciliar = async (id: string) => {
    await fetch(API + '/contabilidad/banco/movimientos/' + id + '/conciliar', { method: 'PUT', headers: H(), body: JSON.stringify({}) });
    cargarMovimientos(); cargarResumen();
  };

  const desconciliar = async (id: string) => {
    await fetch(API + '/contabilidad/banco/movimientos/' + id + '/desconciliar', { method: 'PUT', headers: H() });
    cargarMovimientos(); cargarResumen();
  };

  const cuentaSel = cuentas.find(c => c.id === selCuenta);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={selCuenta} onChange={e => setSelCuenta(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white flex-1">
          <option value="">Selecciona cuenta bancaria...</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.iban ? `(${c.iban})` : ''} · {fmt(c.saldoActual)}</option>)}
        </select>
        <select value={filtroConciliado} onChange={e => setFiltroConciliado(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todos</option>
          <option value="false">Pendientes</option>
          <option value="true">Conciliados</option>
        </select>
        <button onClick={() => setShowNewCuenta(!showNewCuenta)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"><Building2 className="w-4 h-4"/></button>
        {selCuenta && <button onClick={() => setShowNewMov(!showNewMov)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"><Plus className="w-4 h-4"/>Movimiento</button>}
      </div>

      {showNewCuenta && (
        <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4 grid grid-cols-5 gap-3 items-end">
          <div><label className="text-xs text-slate-500 mb-1 block">Nombre *</label><input value={formCuenta.nombre} onChange={e => setFormCuenta({...formCuenta, nombre: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">IBAN</label><input value={formCuenta.iban} onChange={e => setFormCuenta({...formCuenta, iban: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Entidad</label><input value={formCuenta.entidad} onChange={e => setFormCuenta({...formCuenta, entidad: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Saldo inicial</label><input type="number" value={formCuenta.saldoInicial} onChange={e => setFormCuenta({...formCuenta, saldoInicial: parseFloat(e.target.value)||0})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none text-right"/></div>
          <button onClick={guardarCuenta} disabled={!formCuenta.nombre} className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"><Save className="w-4 h-4"/>Crear</button>
        </div>
      )}

      {showNewMov && (
        <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4 grid grid-cols-6 gap-3 items-end">
          <div><label className="text-xs text-slate-500 mb-1 block">Fecha</label><input type="date" value={formMov.fecha} onChange={e => setFormMov({...formMov, fecha: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]"/></div>
          <div className="col-span-2"><label className="text-xs text-slate-500 mb-1 block">Concepto *</label><input value={formMov.concepto} onChange={e => setFormMov({...formMov, concepto: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Importe</label><input type="number" step="0.01" value={formMov.importe} onChange={e => setFormMov({...formMov, importe: parseFloat(e.target.value)||0})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none text-right"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Tipo</label>
            <select value={formMov.tipo} onChange={e => setFormMov({...formMov, tipo: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none">
              {['COBRO','PAGO','TRANSFERENCIA','COMISION','OTROS'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={guardarMov} disabled={!formMov.concepto} className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"><Save className="w-4 h-4"/>Crear</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Cuentas bancarias</div>
          <div className="text-2xl font-bold text-white">{cuentas.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Saldo cuenta seleccionada</div>
          <div className={"text-2xl font-bold " + ((cuentaSel?.saldoActual||0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(cuentaSel?.saldoActual || 0)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Movimientos pendientes</div>
          <div className="text-2xl font-bold text-orange-400">{pendientes}</div>
        </div>
      </div>

      {!selCuenta ? (
        <div className="text-center py-12 text-slate-500"><Landmark className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Selecciona una cuenta bancaria</p></div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : movimientos.length === 0 ? (
        <div className="text-center py-12 text-slate-500"><Landmark className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay movimientos</p></div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Fecha</th>
              <th className="text-left px-4 py-3">Concepto</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Importe</th>
              <th className="text-center px-4 py-3">Estado</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr></thead>
            <tbody>{movimientos.map(m => (
              <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-2.5 text-slate-400 text-xs">{fmtDate(m.fecha)}</td>
                <td className="px-4 py-2.5 text-white">{m.concepto}</td>
                <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{m.tipo}</span></td>
                <td className={"px-4 py-2.5 text-right font-semibold " + (m.importe >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt(m.importe)}</td>
                <td className="px-4 py-2.5 text-center">
                  {m.conciliado
                    ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3"/>Conciliado</span>
                    : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400"><XCircle className="w-3 h-3"/>Pendiente</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-right">
                  {m.conciliado
                    ? <button onClick={() => desconciliar(m.id)} className="text-xs text-orange-400 hover:text-orange-300">Desconciliar</button>
                    : <button onClick={() => conciliar(m.id)} className="text-xs text-emerald-400 hover:text-emerald-300">Conciliar</button>
                  }
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- PRESUPUESTO CONTABLE ----
function TabPresupuestoContable({ ejercicio }: { ejercicio: number }) {
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ nombre: '', observaciones: '' });
  const [selId, setSelId] = useState<string|null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/contabilidad/presupuestos-contables?ejercicio=' + ejercicio, { headers: H() }).then(r => r.json());
      setPresupuestos(Array.isArray(r) ? r : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [ejercicio]);

  const crear = async () => {
    await fetch(API + '/contabilidad/presupuestos-contables', { method: 'POST', headers: H(), body: JSON.stringify({ ...form, ejercicio }) });
    setShowNew(false); setForm({ nombre: '', observaciones: '' }); cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('Eliminar presupuesto?')) return;
    await fetch(API + '/contabilidad/presupuestos-contables/' + id, { method: 'DELETE', headers: H() });
    if (selId === id) setSelId(null);
    cargar();
  };

  const sel = presupuestos.find(p => p.id === selId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Presupuestos contables {ejercicio}</h3>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"><Plus className="w-4 h-4"/>Nuevo</button>
      </div>

      {showNew && (
        <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4 grid grid-cols-3 gap-3 items-end">
          <div><label className="text-xs text-slate-500 mb-1 block">Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Observaciones</label><input value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none"/></div>
          <button onClick={crear} disabled={!form.nombre} className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm"><Save className="w-4 h-4"/>Crear</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : presupuestos.length === 0 ? (
        <div className="text-center py-12 text-slate-500"><PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay presupuestos contables para {ejercicio}</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {presupuestos.map(p => (
            <div key={p.id} onClick={() => setSelId(selId === p.id ? null : p.id)}
              className={"bg-slate-800 border rounded-xl p-4 cursor-pointer transition-colors " + (selId === p.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600')}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">{p.nombre}</div>
                  <div className="text-xs text-slate-500 mt-1">{p.partidas?.length || 0} partidas · {p.estado} · {fmtDate(p.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={"text-xs px-2 py-1 rounded " + (p.estado === 'APROBADO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300')}>{p.estado}</span>
                  <button onClick={e => { e.stopPropagation(); eliminar(p.id); }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              {p.observaciones && <div className="text-xs text-slate-400 mt-2">{p.observaciones}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- MODELOS FISCALES ----
function TabModelosFiscales({ ejercicio }: { ejercicio: number }) {
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/contabilidad/modelos-fiscales?ejercicio=' + ejercicio, { headers: H() }).then(r => r.json());
      setModelos(Array.isArray(r) ? r : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [ejercicio]);

  const calcular303 = async (trimestre: number) => {
    setCalculating('303-' + trimestre);
    try {
      await fetch(API + '/contabilidad/modelos-fiscales/calcular-303', { method: 'POST', headers: H(), body: JSON.stringify({ ejercicio, trimestre }) });
      cargar();
    } catch {}
    setCalculating('');
  };

  const calcular390 = async () => {
    setCalculating('390');
    try {
      await fetch(API + '/contabilidad/modelos-fiscales/calcular-390', { method: 'POST', headers: H(), body: JSON.stringify({ ejercicio }) });
      cargar();
    } catch {}
    setCalculating('');
  };

  const trimestres = [1,2,3,4];
  const modelo303 = (t: number) => modelos.find(m => m.tipo === '303' && m.periodo === `${t}T`);
  const modelo390 = modelos.find(m => m.tipo === '390');

  return (
    <div className="space-y-6">
      <h3 className="text-white font-semibold">Modelo 303 - IVA Trimestral ({ejercicio})</h3>
      <div className="grid grid-cols-4 gap-4">
        {trimestres.map(t => {
          const m = modelo303(t);
          return (
            <div key={t} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold">{t}T {ejercicio}</span>
                <button onClick={() => calcular303(t)} disabled={calculating === '303-' + t}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded">
                  {calculating === '303-' + t ? 'Calculando...' : m ? 'Recalcular' : 'Calcular'}
                </button>
              </div>
              {m ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Base repercutido</span><span className="text-white">{fmt(m.baseImponibleRepercutido)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Cuota repercutida</span><span className="text-green-400">{fmt(m.cuotaRepercutida)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Base soportado</span><span className="text-white">{fmt(m.baseImponibleSoportado)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Cuota soportada</span><span className="text-red-400">{fmt(m.cuotaSoportada)}</span></div>
                  <div className="border-t border-slate-700 pt-2 flex justify-between font-semibold">
                    <span className="text-slate-300">Resultado</span>
                    <span className={m.resultado >= 0 ? 'text-red-400' : 'text-emerald-400'}>{fmt(m.resultado)}</span>
                  </div>
                  <div className="text-slate-500 text-center">{m.resultado >= 0 ? 'A ingresar' : 'A compensar'}</div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs">Sin calcular</div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="text-white font-semibold mt-6">Modelo 390 - Resumen Anual IVA ({ejercicio})</h3>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-medium">Declaracion resumen anual</span>
          <button onClick={calcular390} disabled={calculating === '390'}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
            <RefreshCw className={"w-4 h-4 " + (calculating === '390' ? 'animate-spin' : '')}/>
            {modelo390 ? 'Recalcular' : 'Calcular'}
          </button>
        </div>
        {modelo390 ? (
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Base repercutido</div><div className="text-white font-semibold">{fmt(modelo390.baseImponibleRepercutido)}</div></div>
            <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Cuota repercutida</div><div className="text-green-400 font-semibold">{fmt(modelo390.cuotaRepercutida)}</div></div>
            <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Base soportado</div><div className="text-white font-semibold">{fmt(modelo390.baseImponibleSoportado)}</div></div>
            <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Cuota soportada</div><div className="text-red-400 font-semibold">{fmt(modelo390.cuotaSoportada)}</div></div>
            <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Resultado anual</div><div className={(modelo390.resultado >= 0 ? 'text-red-400' : 'text-emerald-400') + ' font-bold text-lg'}>{fmt(modelo390.resultado)}</div></div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm">Pulsa "Calcular" para generar el modelo 390</div>
        )}
      </div>
    </div>
  );
}

// ---- CIERRE DE EJERCICIO ----
function TabCierre({ ejercicio }: { ejercicio: number }) {
  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/contabilidad/cierres', { headers: H() }).then(r => r.json());
      setCierres(Array.isArray(r) ? r : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const cerrar = async () => {
    if (!confirm(`Cerrar ejercicio ${ejercicio}? Se crearan asientos de cierre y apertura.`)) return;
    setClosing(true);
    try {
      await fetch(API + '/contabilidad/cierres', { method: 'POST', headers: H(), body: JSON.stringify({ ejercicio }) });
      cargar();
    } catch {}
    setClosing(false);
  };

  const reabrir = async (id: string) => {
    if (!confirm('Reabrir ejercicio? Se eliminaran los asientos de cierre y apertura.')) return;
    await fetch(API + '/contabilidad/cierres/' + id, { method: 'DELETE', headers: H() });
    cargar();
  };

  const estaCerrado = cierres.some(c => c.ejercicio === ejercicio);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">Ejercicio {ejercicio}</h3>
            <p className="text-slate-400 text-sm mt-1">
              {estaCerrado ? 'Este ejercicio esta cerrado' : 'Este ejercicio esta abierto'}
            </p>
          </div>
          {estaCerrado ? (
            <span className="flex items-center gap-2 text-emerald-400 font-medium"><Lock className="w-5 h-5"/>CERRADO</span>
          ) : (
            <button onClick={cerrar} disabled={closing}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium">
              <Lock className="w-4 h-4"/>{closing ? 'Cerrando...' : 'Cerrar ejercicio'}
            </button>
          )}
        </div>
      </div>

      <h3 className="text-white font-semibold">Historial de cierres</h3>
      {loading ? (
        <div className="text-center py-8 text-slate-500">Cargando...</div>
      ) : cierres.length === 0 ? (
        <div className="text-center py-12 text-slate-500"><Lock className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay ejercicios cerrados</p></div>
      ) : (
        <div className="space-y-3">
          {cierres.map(c => (
            <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-lg">{c.ejercicio}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">{c.estado}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Cerrado el {fmtDate(c.fechaCierre)}</div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right">
                  <div><div className="text-xs text-slate-500">Ingresos</div><div className="text-green-400 font-semibold">{fmt(c.totalIngresos)}</div></div>
                  <div><div className="text-xs text-slate-500">Gastos</div><div className="text-red-400 font-semibold">{fmt(c.totalGastos)}</div></div>
                  <div><div className="text-xs text-slate-500">Resultado</div><div className={(c.resultado >= 0 ? 'text-emerald-400' : 'text-red-400') + ' font-bold'}>{fmt(c.resultado)}</div></div>
                </div>
                <button onClick={() => reabrir(c.id)} className="text-xs text-orange-400 hover:text-orange-300 ml-4">Reabrir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- PAGINA PRINCIPAL ----
const TABS = [
  { id: 'resumen', label: 'Resumen', icon: BarChart2 },
  { id: 'resultados', label: 'Resultados', icon: TrendingUp },
  { id: 'balance', label: 'Balance', icon: ArrowUpDown },
  { id: 'asientos', label: 'Asientos', icon: BookOpen },
  { id: 'cuentas', label: 'Plan cuentas', icon: List },
  { id: 'conciliacion', label: 'Banco', icon: Landmark },
  { id: 'presupuesto', label: 'Presupuesto', icon: PiggyBank },
  { id: 'modelos', label: 'Modelos fiscales', icon: FileText },
  { id: 'cierre', label: 'Cierre', icon: Lock },
];

export default function ContabilidadPage() {
  const [tab, setTab] = useState('resumen');
  const [ejercicio, setEjercicio] = useState(new Date().getFullYear());
  const [cuentas, setCuentas] = useState<any[]>([]);

  const cargarCuentas = useCallback(async () => {
    try {
      const r = await fetch(API + '/contabilidad/cuentas', { headers: H() }).then(r => r.json());
      setCuentas(Array.isArray(r) ? r : []);
    } catch {}
  }, []);

  useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-400"/>Contabilidad
          </h1>
          <p className="text-slate-400 text-sm mt-1">Libro diario, balance y cuenta de resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Ejercicio:</span>
          <select value={ejercicio} onChange={e => setEjercicio(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all " + (tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'resumen' && <TabResumen ejercicio={ejercicio}/>}
        {tab === 'resultados' && <TabResultados ejercicio={ejercicio}/>}
        {tab === 'balance' && <TabBalance ejercicio={ejercicio}/>}
        {tab === 'asientos' && <div className="h-full"><TabAsientos ejercicio={ejercicio} cuentas={cuentas}/></div>}
        {tab === 'cuentas' && <TabPlanCuentas cuentas={cuentas} onReload={cargarCuentas}/>}
        {tab === 'conciliacion' && <TabConciliacion ejercicio={ejercicio}/>}
        {tab === 'presupuesto' && <TabPresupuestoContable ejercicio={ejercicio}/>}
        {tab === 'modelos' && <TabModelosFiscales ejercicio={ejercicio}/>}
        {tab === 'cierre' && <TabCierre ejercicio={ejercicio}/>}
      </div>
    </div>
  );
}