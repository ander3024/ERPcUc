import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Plus, ChevronRight, X, Edit2, Trash2, AlertTriangle, Play, Pause, Zap, FileText, CalendarClock, CheckCircle, Clock, Loader2 } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const PERIODICIDAD: Record<string, string> = {
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

const ESTADO_REC: Record<string, { label: string; color: string }> = {
  ACTIVA:   { label: 'Activa',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  PAUSADA:  { label: 'Pausada',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  FINALIZADA: { label: 'Finalizada', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

function PanelDetalle({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/ventas/recurrentes/' + id, { headers: headers() });
      if (!r.ok) throw new Error('Error ' + r.status);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setDoc(d);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error al cargar recurrente' });
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  const emitirAhora = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/recurrentes/' + id + '/emitir', { method: 'POST', headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      setMsg({ type: 'ok', text: 'Factura emitida correctamente' });
      cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({ type: 'error', text: String(e.message) }); }
    setSaving(false);
  };

  const toggleEstado = async () => {
    setSaving(true);
    const nuevoEstado = doc.estado === 'ACTIVA' ? 'PAUSADA' : 'ACTIVA';
    try {
      const r = await fetch(API + '/ventas/recurrentes/' + id, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg({ type: 'ok', text: 'Estado: ' + ESTADO_REC[nuevoEstado]?.label });
      cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({ type: 'error', text: String(e.message) }); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/recurrentes/' + id, { method: 'DELETE', headers: headers() });
      onRefresh(); onClose();
    } catch (e: any) { setMsg({ type: 'error', text: String(e.message) }); setSaving(false); }
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const esPendienteHoy = doc && doc.estado === 'ACTIVA' && doc.proximaEmision && doc.proximaEmision.slice(0, 10) <= hoy;

  if (loading) return (
    <div className="w-[480px] border-l border-slate-700 bg-slate-900 flex items-center justify-center">
      <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
    </div>
  );

  if (!doc) return (
    <div className="w-[480px] border-l border-slate-700 bg-slate-900 p-6">
      <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      <p className="text-red-400 mt-4">No se pudo cargar la recurrente</p>
    </div>
  );

  const est = ESTADO_REC[doc.estado] || { label: doc.estado, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };

  return (
    <div className="w-[480px] border-l border-slate-700 bg-slate-900 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white truncate">{doc.nombre || 'Sin nombre'}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>

      {/* Messages */}
      {msg && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded text-sm ${msg.type === 'ok' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded border ${est.color}`}>{est.label}</span>
          {esPendienteHoy && <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">HOY</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Cliente</p>
            <p className="text-white">{doc.cliente?.nombre || doc.clienteNombre || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">Periodicidad</p>
            <p className="text-white">{PERIODICIDAD[doc.periodicidad] || doc.periodicidad}</p>
          </div>
          <div>
            <p className="text-slate-500">Próxima emisión</p>
            <p className="text-white">{fmtDate(doc.proximaEmision)}</p>
          </div>
          <div>
            <p className="text-slate-500">Creada</p>
            <p className="text-white">{fmtDate(doc.createdAt)}</p>
          </div>
        </div>

        {/* Lines */}
        {doc.lineas && doc.lineas.length > 0 && (
          <div>
            <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">Líneas</p>
            <div className="border border-slate-700 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-slate-400 text-xs">
                    <th className="text-left px-3 py-2">Descripción</th>
                    <th className="text-right px-3 py-2">Cant.</th>
                    <th className="text-right px-3 py-2">Precio</th>
                    <th className="text-right px-3 py-2">IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lineas.map((l: any, i: number) => (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td className="px-3 py-2 text-slate-300">{l.descripcion}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{l.cantidad}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{fmt(l.precio)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{l.iva}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Last 5 generated invoices */}
        {doc.facturasGeneradas && doc.facturasGeneradas.length > 0 && (
          <div>
            <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">Últimas facturas generadas</p>
            <div className="space-y-1">
              {doc.facturasGeneradas.slice(0, 5).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded text-sm cursor-pointer hover:bg-slate-800" onClick={() => navigate('/ventas/facturas?id=' + f.id)}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300">{f.numero || f.serie + '/' + f.numero}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{fmtDate(f.fecha)}</span>
                    <span className="text-white">{fmt(f.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto p-4 border-t border-slate-700 space-y-2">
        <div className="flex gap-2">
          <button onClick={emitirAhora} disabled={saving || doc.estado !== 'ACTIVA'} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Emitir ahora
          </button>
          <button onClick={toggleEstado} disabled={saving || doc.estado === 'FINALIZADA'} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors">
            {doc.estado === 'ACTIVA' ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Activar</>}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/ventas/recurrentes/' + id)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors">
            <Edit2 className="w-4 h-4" /> Editar
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/80 text-slate-300 hover:text-white rounded text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={eliminar} disabled={saving} className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium">
                <AlertTriangle className="w-4 h-4" /> Eliminar
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecurrentesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, activas: 0, pausadas: 0, pendientesHoy: 0 });
  const limit = 25;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const r = await fetch(API + '/ventas/recurrentes?' + params.toString(), { headers: headers() });
      if (!r.ok) throw new Error('Error ' + r.status);
      const d = await r.json();
      setItems(d.data || d.items || d);
      setTotal(d.total || d.count || (d.data || d.items || d).length);
      if (d.stats) setStats(d.stats);
    } catch (e) {
      console.error('Error cargando recurrentes:', e);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalPages = Math.ceil(total / limit) || 1;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold text-white">Facturas Recurrentes</h1>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-56"
            />
          </div>
          <button onClick={cargar} className="p-1.5 text-slate-400 hover:text-white transition-colors" title="Refrescar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => navigate('/ventas/recurrentes/nuevo')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nueva recurrente
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <FileText className="w-3.5 h-3.5" />
            <span>Total: <span className="text-white font-medium">{stats.total || total}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Activas: <span className="text-white font-medium">{stats.activas}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-yellow-400">
            <Pause className="w-3.5 h-3.5" />
            <span>Pausadas: <span className="text-white font-medium">{stats.pausadas}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes hoy: <span className="text-white font-medium">{stats.pendientesHoy}</span></span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Periodicidad</th>
                <th className="text-left px-4 py-3 font-medium">Próxima emisión</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">No hay facturas recurrentes</td></tr>
              ) : items.map(item => {
                const est = ESTADO_REC[item.estado] || { label: item.estado, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
                const pendienteHoy = item.estado === 'ACTIVA' && item.proximaEmision && item.proximaEmision.slice(0, 10) <= hoy;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`border-t border-slate-800 cursor-pointer transition-colors ${selectedId === item.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                  >
                    <td className="px-4 py-3 text-white font-medium">{item.nombre || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{item.cliente?.nombre || item.clienteNombre || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{PERIODICIDAD[item.periodicidad] || item.periodicidad}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">{fmtDate(item.proximaEmision)}</span>
                        {pendienteHoy && <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">HOY</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded border ${est.color}`}>{est.label}</span>
                    </td>
                    <td className="px-2 py-3 text-slate-500">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between text-sm">
            <span className="text-slate-400">{total} resultado{total !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="px-3 py-1 text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <PanelDetalle
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={cargar}
        />
      )}
    </div>
  );
}
