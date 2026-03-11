import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Webhook, Upload, FileSpreadsheet, Plus, Trash2,
  Play, CheckCircle, XCircle, Clock, Download, AlertTriangle,
  Eye, ChevronDown, ChevronRight, FileText, X, RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type Tab = 'api' | 'webhooks' | 'importar';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'api', label: 'API REST', icon: Globe },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'importar', label: 'Importación', icon: Upload },
];

export default function IntegracionesPage() {
  const [tab, setTab] = useState<Tab>('api');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integraciones</h1>
        <p className="text-slate-400 text-sm mt-1">API REST, webhooks e importación masiva</p>
      </div>

      <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'api' && <TabAPI />}
      {tab === 'webhooks' && <TabWebhooks />}
      {tab === 'importar' && <TabImportar />}
    </div>
  );
}

// ============================================
// TAB: API REST Documentation
// ============================================
function TabAPI() {
  const { data: docs } = useQuery({
    queryKey: ['api-docs'],
    queryFn: () => api.get('/integraciones/api-docs').then(r => r.data),
  });

  const [expanded, setExpanded] = useState<string[]>([]);
  const toggleTag = (tag: string) => setExpanded(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);

  if (!docs) return <div className="text-slate-500 text-center py-12">Cargando documentación...</div>;

  // Group endpoints by tag
  const groups: Record<string, { method: string; path: string; summary: string }[]> = {};
  Object.entries(docs.paths || {}).forEach(([path, methods]: any) => {
    Object.entries(methods).forEach(([method, spec]: any) => {
      const tag = spec.tags?.[0] || 'General';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push({ method, path, summary: spec.summary });
    });
  });

  const methodColors: Record<string, string> = {
    get: 'bg-green-500/20 text-green-400',
    post: 'bg-blue-500/20 text-blue-400',
    put: 'bg-yellow-500/20 text-yellow-400',
    delete: 'bg-red-500/20 text-red-400',
    patch: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Globe size={20} className="text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">{docs.info?.title}</h2>
            <p className="text-xs text-slate-500">v{docs.info?.version}</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-3">{docs.info?.description}</p>
        <div className="flex items-center gap-3">
          <code className="text-xs bg-slate-800 text-blue-400 px-3 py-1.5 rounded-lg">Authorization: Bearer &lt;token&gt;</code>
          <a href="/integraciones/api-docs" target="_blank" className="text-xs text-blue-400 hover:text-blue-300">
            JSON spec &rarr;
          </a>
        </div>
      </div>

      {/* Endpoints grouped by tag */}
      {Object.entries(groups).map(([tag, endpoints]) => (
        <div key={tag} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <button onClick={() => toggleTag(tag)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-colors">
            <span className="text-sm font-semibold text-white">{tag}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{endpoints.length} endpoints</span>
              {expanded.includes(tag) ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
            </div>
          </button>
          {expanded.includes(tag) && (
            <div className="border-t border-slate-800">
              {endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-800/50 last:border-0">
                  <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded', methodColors[ep.method] || 'bg-slate-500/20 text-slate-400')}>
                    {ep.method}
                  </span>
                  <code className="text-sm text-slate-300 font-mono">{ep.path}</code>
                  <span className="text-xs text-slate-500 ml-auto">{ep.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// TAB: Webhooks
// ============================================
function TabWebhooks() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', url: '', eventos: [] as string[] });
  const [logsId, setLogsId] = useState<string | null>(null);

  const { data: webhooks = [] } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/integraciones/webhooks').then(r => r.data),
  });

  const { data: eventList = [] } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => api.get('/integraciones/webhooks/eventos').then(r => r.data),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['webhook-logs', logsId],
    queryFn: () => logsId ? api.get(`/integraciones/webhooks/${logsId}/logs`).then(r => r.data) : [],
    enabled: !!logsId,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/integraciones/webhooks', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); setShowForm(false); setForm({ nombre: '', url: '', eventos: [] }); toast.success('Webhook creado'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/integraciones/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook eliminado'); },
  });

  const testMut = useMutation({
    mutationFn: (id: string) => api.post(`/integraciones/webhooks/${id}/test`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      if (res.data.ok) toast.success(`Test OK (${res.data.duracionMs}ms)`);
      else toast.error(`Test falló: ${res.data.error || 'Error'}`);
    },
  });

  const toggleEvento = (evento: string) => {
    setForm(prev => ({
      ...prev,
      eventos: prev.eventos.includes(evento) ? prev.eventos.filter(e => e !== evento) : [...prev.eventos, evento],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Recibe notificaciones HTTP cuando ocurren eventos en el ERP</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">
          <Plus size={15} /> Nuevo webhook
        </button>
      </div>

      {/* Webhook list */}
      {webhooks.map((wh: any) => (
        <div key={wh.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={clsx('w-2 h-2 rounded-full', wh.activo ? 'bg-green-400' : 'bg-slate-600')} />
              <span className="text-sm font-semibold text-white">{wh.nombre}</span>
              {wh.fallosConsecutivos > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{wh.fallosConsecutivos} fallos</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => testMut.mutate(wh.id)} className="p-1.5 text-slate-500 hover:text-green-400 rounded transition-colors" title="Test">
                <Play size={14} />
              </button>
              <button onClick={() => setLogsId(logsId === wh.id ? null : wh.id)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded transition-colors" title="Ver logs">
                <Eye size={14} />
              </button>
              <button onClick={() => { if (confirm('¿Eliminar webhook?')) deleteMut.mutate(wh.id); }}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors" title="Eliminar">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <code className="text-xs text-slate-400 block mb-2">{wh.url}</code>
          <div className="flex flex-wrap gap-1">
            {(wh.eventos || []).map((ev: string) => (
              <span key={ev} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{ev}</span>
            ))}
          </div>
          {wh.ultimoEnvio && (
            <p className="text-xs text-slate-600 mt-2">
              Último envío: {new Date(wh.ultimoEnvio).toLocaleString('es-ES')} — Status: {wh.ultimoEstado || '-'}
            </p>
          )}

          {/* Logs */}
          {logsId === wh.id && (
            <div className="mt-3 border-t border-slate-800 pt-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Últimos logs</p>
              {logs.length === 0 && <p className="text-xs text-slate-600">Sin logs</p>}
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 text-xs">
                    {log.statusCode && log.statusCode < 400 ? <CheckCircle size={12} className="text-green-400" /> : <XCircle size={12} className="text-red-400" />}
                    <span className="text-slate-400">{log.evento}</span>
                    <span className="text-slate-600">{log.statusCode || 'ERR'}</span>
                    <span className="text-slate-600">{log.duracionMs}ms</span>
                    <span className="text-slate-600 ml-auto">{new Date(log.createdAt).toLocaleString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {webhooks.length === 0 && !showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Webhook size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No hay webhooks configurados</p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Nuevo Webhook</h3>
            <button onClick={() => setShowForm(false)} className="p-1 text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
              placeholder="https://tu-servidor.com/webhook" className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
          </div>
          <p className="text-xs text-slate-500 mb-2">Eventos:</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {eventList.map((ev: string) => (
              <button key={ev} onClick={() => toggleEvento(ev)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  form.eventos.includes(ev) ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300')}>
                {ev}
              </button>
            ))}
          </div>
          <button onClick={() => createMut.mutate(form)} disabled={!form.nombre || !form.url}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">
            Crear webhook
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// TAB: Importación masiva
// ============================================
function TabImportar() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState('clientes');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: historial = [] } = useQuery({
    queryKey: ['importaciones'],
    queryFn: () => api.get('/integraciones/importaciones').then(r => r.data),
  });

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Selecciona un archivo');

    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('tipo', tipo);
      const { data } = await api.post('/integraciones/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: ['importaciones'] });
      if (data.filasError === 0) toast.success(`${data.filasExito} registros importados`);
      else toast.success(`${data.filasExito} importados, ${data.filasError} errores`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error importando');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async (t: string) => {
    try {
      const res = await api.get(`/integraciones/importaciones/plantillas/${t}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${t}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error descargando plantilla');
    }
  };

  const estadoColor: Record<string, string> = {
    COMPLETADO: 'bg-green-500/10 text-green-400',
    PARCIAL: 'bg-yellow-500/10 text-yellow-400',
    ERROR: 'bg-red-500/10 text-red-400',
    PROCESANDO: 'bg-blue-500/10 text-blue-400',
    PENDIENTE: 'bg-slate-500/10 text-slate-400',
  };

  return (
    <div className="space-y-4">
      {/* Import card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Importar datos desde Excel/CSV</h3>

        {/* Templates */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Descarga una plantilla para ver el formato requerido:</p>
          <div className="flex gap-2">
            {['clientes', 'articulos', 'proveedores'].map(t => (
              <button key={t} onClick={() => downloadTemplate(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors">
                <Download size={12} /> Plantilla {t}
              </button>
            ))}
          </div>
        </div>

        {/* Import form */}
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="clientes">Clientes</option>
              <option value="articulos">Artículos</option>
              <option value="proveedores">Proveedores</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 block mb-1">Archivo (.xlsx, .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white file:bg-slate-700 file:border-0 file:rounded file:text-slate-300 file:text-xs file:mr-3 file:px-3 file:py-1" />
          </div>
          <button onClick={handleImport} disabled={importing}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 shrink-0">
            {importing ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4 p-4 bg-slate-800 rounded-lg">
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm text-white font-medium">Resultado:</span>
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', estadoColor[result.estado])}>{result.estado}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-slate-400">Total: <span className="text-white font-medium">{result.totalFilas}</span></span>
              <span className="text-green-400">Éxito: <span className="font-medium">{result.filasExito}</span></span>
              <span className="text-red-400">Errores: <span className="font-medium">{result.filasError}</span></span>
            </div>
            {result.errores?.length > 0 && (
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errores.map((err: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <span className="text-slate-500">Fila {err.fila}:</span>
                    <span className="text-red-300">{err.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import history */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Historial de importaciones</h3>
        {historial.length === 0 && <p className="text-sm text-slate-600 text-center py-6">Sin importaciones</p>}
        <div className="space-y-0 divide-y divide-slate-800">
          {historial.map((imp: any) => (
            <div key={imp.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <FileSpreadsheet size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-300">{imp.nombreArchivo}</span>
                  <span className={clsx('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', estadoColor[imp.estado])}>{imp.estado}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {imp.tipo} &middot; {imp.filasExito}/{imp.totalFilas} filas &middot; {imp.usuario?.nombre} &middot; {new Date(imp.createdAt).toLocaleString('es-ES')}
                </p>
              </div>
              {imp.filasError > 0 && (
                <span className="text-xs text-red-400">{imp.filasError} errores</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
