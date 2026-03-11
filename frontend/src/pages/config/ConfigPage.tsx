import { useState, useEffect, useRef } from 'react';
import { Building2, Save, Upload, X, Settings, Users, FileText, Calendar, Shield, Loader2, ChevronRight, Lock, CheckCircle, AlertTriangle, BarChart3, ArrowRight } from 'lucide-react';

const API = '/api';
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';

export default function ConfigPage() {
  const [tab, setTab] = useState('empresa');
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [logoPreview, setLogoPreview] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    fetch(API + '/config', { headers }).then(r => r.json()).then(d => {
      setForm(d);
      if (d.logo) setLogoPreview(d.logo);
      setLoading(false);
    });
  }, []);

  const guardar = async () => {
    setSaving(true);
    const r = await fetch(API + '/config', { method: 'PUT', headers, body: JSON.stringify(form) });
    if (r.ok) showToast('Configuracion guardada correctamente');
    else showToast('Error al guardar');
    setSaving(false);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('El logo no puede superar 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setLogoPreview(b64);
      setForm((f: any) => ({ ...f, logo: b64 }));
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'facturacion', label: 'Facturacion', icon: FileText },
    { id: 'ejercicio', label: 'Ejercicio Fiscal', icon: Calendar },
    { id: 'verifactu', label: 'VeriFactu', icon: Shield },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Cargando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-lg">{toast}</div>}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-blue-400"/>Configuracion</h1>
        <p className="text-slate-400 text-sm mt-1">Ajustes del sistema y empresa</p>
      </div>
      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors " + (tab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700")}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-white font-semibold mb-4">Logo de empresa</h2>
            <div className="flex items-center gap-6">
              <div className="w-36 h-36 bg-slate-700 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition-colors" onClick={() => fileRef.current?.click()}>
                {logoPreview
                  ? <img src={logoPreview} className="w-full h-full object-contain p-2" alt="Logo"/>
                  : <div className="text-center"><Building2 className="w-10 h-10 text-slate-500 mx-auto mb-1"/><span className="text-slate-500 text-xs">Click para subir</span></div>
                }
              </div>
              <div className="space-y-3">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  <Upload className="w-4 h-4"/>Subir logo
                </button>
                {logoPreview && (
                  <button onClick={() => { setLogoPreview(null); setForm((f:any) => ({...f, logo: null})); }}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 px-4 py-2 text-sm border border-red-500/30 rounded-lg hover:bg-red-500/10">
                    <X className="w-4 h-4"/>Eliminar logo
                  </button>
                )}
                <p className="text-slate-500 text-xs">PNG, JPG o SVG. Max 2MB.<br/>Aparecera en facturas y documentos impresos.</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo}/>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-white font-semibold mb-4">Datos de empresa</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">Nombre empresa</label>
                <input className={inp} value={form.nombre||''} onChange={e => setForm((f:any)=>({...f,nombre:e.target.value}))} placeholder="Mi Empresa S.L."/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">CIF/NIF</label>
                <input className={inp} value={form.cif||''} onChange={e => setForm((f:any)=>({...f,cif:e.target.value}))} placeholder="B12345678"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Telefono</label>
                <input className={inp} value={form.telefono||''} onChange={e => setForm((f:any)=>({...f,telefono:e.target.value}))} placeholder="912345678"/>
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">Direccion fiscal</label>
                <input className={inp} value={form.direccion||''} onChange={e => setForm((f:any)=>({...f,direccion:e.target.value}))} placeholder="Calle Mayor 1"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Codigo Postal</label>
                <input className={inp} value={form.codigoPostal||''} onChange={e => setForm((f:any)=>({...f,codigoPostal:e.target.value}))} placeholder="28001"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Ciudad</label>
                <input className={inp} value={form.ciudad||''} onChange={e => setForm((f:any)=>({...f,ciudad:e.target.value}))} placeholder="Madrid"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Provincia</label>
                <input className={inp} value={form.provincia||''} onChange={e => setForm((f:any)=>({...f,provincia:e.target.value}))} placeholder="Madrid"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Email</label>
                <input className={inp} value={form.email||''} onChange={e => setForm((f:any)=>({...f,email:e.target.value}))} placeholder="info@miempresa.com"/>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Web</label>
                <input className={inp} value={form.web||''} onChange={e => setForm((f:any)=>({...f,web:e.target.value}))} placeholder="www.miempresa.com"/>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'facturacion' && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
          <h2 className="text-white font-semibold mb-2">Series y contadores</h2>
          <p className="text-slate-400 text-xs mb-4">Define el formato de numeracion de tus documentos. El numero se incrementa automaticamente.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Serie factura</label>
              <input className={inp} value={form.serieFactura||'F'} onChange={e => setForm((f:any)=>({...f,serieFactura:e.target.value}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Proximo numero</label>
              <input className={inp} type="number" value={form.contadorFactura||1} onChange={e => setForm((f:any)=>({...f,contadorFactura:parseInt(e.target.value)||1}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Ejemplo</label>
              <div className="bg-slate-700 rounded-lg px-3 py-2 text-sm text-blue-400 font-mono">{form.serieFactura||'F'}/{form.ejercicioActual||2026}/{String(form.contadorFactura||1).padStart(5,'0')}</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Serie presupuesto</label>
              <input className={inp} value={form.seriePresup||'P'} onChange={e => setForm((f:any)=>({...f,seriePresup:e.target.value}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Proximo numero</label>
              <input className={inp} type="number" value={form.contadorPresup||1} onChange={e => setForm((f:any)=>({...f,contadorPresup:parseInt(e.target.value)||1}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Ejemplo</label>
              <div className="bg-slate-700 rounded-lg px-3 py-2 text-sm text-blue-400 font-mono">{form.seriePresup||'P'}/{form.ejercicioActual||2026}/{String(form.contadorPresup||1).padStart(5,'0')}</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Serie pedido</label>
              <input className={inp} value={form.seriePedido||'PV'} onChange={e => setForm((f:any)=>({...f,seriePedido:e.target.value}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Proximo numero</label>
              <input className={inp} type="number" value={form.contadorPedido||1} onChange={e => setForm((f:any)=>({...f,contadorPedido:parseInt(e.target.value)||1}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Serie albaran</label>
              <input className={inp} value={form.serieAlbaran||'A'} onChange={e => setForm((f:any)=>({...f,serieAlbaran:e.target.value}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Proximo numero albaran</label>
              <input className={inp} type="number" value={form.contadorAlbaran||1} onChange={e => setForm((f:any)=>({...f,contadorAlbaran:parseInt(e.target.value)||1}))}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">IVA por defecto (%)</label>
              <select className={inp} value={form.tipoIvaDefecto||21} onChange={e => setForm((f:any)=>({...f,tipoIvaDefecto:parseInt(e.target.value)}))}>
                <option value={21}>21%</option>
                <option value={10}>10%</option>
                <option value={4}>4%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Moneda</label>
              <select className={inp} value={form.moneda||'EUR'} onChange={e => setForm((f:any)=>({...f,moneda:e.target.value}))}>
                <option value="EUR">EUR - Euro</option>
                <option value="USD">USD - Dolar</option>
                <option value="GBP">GBP - Libra</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'ejercicio' && <TabEjercicioFiscal token={token} showToast={showToast} />}

      {tab === 'verifactu' && <TabVeriFactu token={token} showToast={showToast} />}

      {tab === 'usuarios' && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center py-12">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-3"/>
          <p className="text-white font-medium mb-1">Gestion de usuarios</p>
          <p className="text-slate-400 text-sm mb-4">Crea, edita y gestiona los usuarios del sistema con sus roles y permisos.</p>
          <a href="/config/usuarios" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium">Ir a Usuarios</a>
        </div>
      )}

      {tab !== 'usuarios' && tab !== 'verifactu' && tab !== 'ejercicio' && (
        <div className="mt-6 flex justify-end">
          <button onClick={guardar} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            <Save className="w-4 h-4"/>{saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

function TabVeriFactu({ token, showToast }: { token: string | null; showToast: (m: string) => void }) {
  const [config, setConfig] = useState<any>({});
  const [estado, setEstado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(false);
  const hdrs = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  useEffect(() => {
    Promise.all([
      fetch(API + '/verifactu/config', { headers: hdrs }).then(r => r.json()).catch(() => ({})),
      fetch(API + '/verifactu/estado', { headers: hdrs }).then(r => r.json()).catch(() => ({})),
    ]).then(([c, e]) => { setConfig(c); setEstado(e); setLoading(false); });
  }, []);

  const guardar = async () => {
    setSaving(true);
    const r = await fetch(API + '/verifactu/config', { method: 'PUT', headers: hdrs, body: JSON.stringify(config) });
    if (r.ok) showToast('Configuracion VeriFactu guardada');
    else showToast('Error al guardar');
    setSaving(false);
  };

  const generarLote = async () => {
    setGenerando(true);
    try {
      const r = await fetch(API + '/verifactu/generar-lote', { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (r.ok) showToast(`VeriFactu: ${d.procesadas} facturas procesadas`);
      else showToast('Error: ' + (d.error || 'desconocido'));
      // Refresh estado
      const e = await fetch(API + '/verifactu/estado', { headers: hdrs }).then(r => r.json()).catch(() => ({}));
      setEstado(e);
    } catch { showToast('Error generando hashes'); }
    setGenerando(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Estado */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400" />VeriFactu - Estado</h2>
          <span className={"text-xs px-3 py-1 rounded-full font-medium " + (config.verifactuActivo ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-600/20 text-slate-400 border border-slate-600/30')}>
            {config.verifactuActivo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Sistema de facturacion electronica conforme al Reglamento VeriFactu (RD 1007/2023).
          Genera hashes SHA-256 encadenados, codigos QR y XML para cada factura.
        </p>
        {estado?.stats && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-700 rounded-lg p-3 text-center">
              <p className="text-white text-lg font-bold">{estado.stats.totalFacturas}</p>
              <p className="text-slate-400 text-[10px]">Total facturas</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3 text-center">
              <p className="text-amber-400 text-lg font-bold">{estado.stats.pendientes}</p>
              <p className="text-slate-400 text-[10px]">Sin hash</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3 text-center">
              <p className="text-green-400 text-lg font-bold">{estado.stats.enviadas}</p>
              <p className="text-slate-400 text-[10px]">Con hash</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3 text-center">
              <p className="text-red-400 text-lg font-bold">{estado.stats.errores}</p>
              <p className="text-slate-400 text-[10px]">Errores</p>
            </div>
          </div>
        )}
        {estado?.stats?.pendientes > 0 && (
          <button onClick={generarLote} disabled={generando}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
            {generando ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</> : <>Generar hashes para {estado.stats.pendientes} facturas pendientes</>}
          </button>
        )}
      </div>

      {/* Configuracion */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Configuracion VeriFactu</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-700 rounded-lg p-4">
            <div>
              <p className="text-white text-sm font-medium">Activar VeriFactu</p>
              <p className="text-slate-400 text-xs mt-0.5">Genera automaticamente hashes para nuevas facturas</p>
            </div>
            <button onClick={() => setConfig((c: any) => ({ ...c, verifactuActivo: !c.verifactuActivo }))}
              className={"w-12 h-6 rounded-full transition-colors relative " + (config.verifactuActivo ? 'bg-blue-600' : 'bg-slate-600')}>
              <div className={"w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform " + (config.verifactuActivo ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-700 rounded-lg p-4">
            <div>
              <p className="text-white text-sm font-medium">Entorno de pruebas</p>
              <p className="text-slate-400 text-xs mt-0.5">Usa el endpoint de pruebas de la AEAT</p>
            </div>
            <button onClick={() => setConfig((c: any) => ({ ...c, verifactuEntornoPruebas: !c.verifactuEntornoPruebas }))}
              className={"w-12 h-6 rounded-full transition-colors relative " + (config.verifactuEntornoPruebas ? 'bg-amber-600' : 'bg-slate-600')}>
              <div className={"w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform " + (config.verifactuEntornoPruebas ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">NIF del obligado tributario</label>
              <input className={inp} value={config.verifactuNIF || ''} onChange={e => setConfig((c: any) => ({ ...c, verifactuNIF: e.target.value }))} placeholder="B12345678" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Razon social</label>
              <input className={inp} value={config.verifactuNombreRazon || ''} onChange={e => setConfig((c: any) => ({ ...c, verifactuNombreRazon: e.target.value }))} placeholder="Mi Empresa S.L." />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Nombre sistema informatico</label>
              <input className={inp} value={config.verifactuNombreSistema || ''} onChange={e => setConfig((c: any) => ({ ...c, verifactuNombreSistema: e.target.value }))} placeholder="ERP-Web" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Version sistema</label>
              <input className={inp} value={config.verifactuVersionSistema || ''} onChange={e => setConfig((c: any) => ({ ...c, verifactuVersionSistema: e.target.value }))} placeholder="1.0" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={guardar} disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium">
          <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar configuracion VeriFactu'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Tab Ejercicio Fiscal (PRO)
// ============================================
function TabEjercicioFiscal({ token, showToast }: { token: string | null; showToast: (m: string) => void }) {
  const hdrs: any = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const [ejercicios, setEjercicios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumenes, setResumenes] = useState<Record<number, any>>({});
  const [selectedEj, setSelectedEj] = useState<any>(null);
  const [cierreStep, setCierreStep] = useState(0); // 0=none, 1-4=steps
  const [cierreData, setCierreData] = useState<any>(null);
  const [cerrando, setCerrando] = useState(false);
  const [creando, setCreando] = useState(false);

  const fetchEjercicios = async () => {
    try {
      const r = await fetch('/api/ejercicios', { headers: hdrs });
      const data = await r.json();
      setEjercicios(Array.isArray(data) ? data : []);
      // Fetch resumenes for each
      for (const ej of (Array.isArray(data) ? data : [])) {
        fetch(`/api/ejercicios/${ej.anio}/resumen`, { headers: hdrs })
          .then(r2 => r2.json())
          .then(res => setResumenes(prev => ({ ...prev, [ej.anio]: res })))
          .catch(() => {});
      }
    } catch { setEjercicios([]); }
    setLoading(false);
  };

  useEffect(() => { fetchEjercicios(); }, []);

  const crearEjercicio = async () => {
    setCreando(true);
    try {
      const maxAnio = ejercicios.length > 0 ? Math.max(...ejercicios.map(e => e.anio)) : new Date().getFullYear();
      const r = await fetch('/api/ejercicios', { method: 'POST', headers: hdrs, body: JSON.stringify({ anio: maxAnio + 1 }) });
      if (r.ok) { showToast(`Ejercicio ${maxAnio + 1} creado`); fetchEjercicios(); }
      else { const d = await r.json(); showToast(d.error || 'Error'); }
    } catch { showToast('Error creando ejercicio'); }
    setCreando(false);
  };

  const iniciarCierre = async (ej: any) => {
    setSelectedEj(ej);
    setCierreStep(1);
    // Load resumen
    try {
      const r = await fetch(`/api/ejercicios/${ej.anio}/resumen`, { headers: hdrs });
      setCierreData(await r.json());
    } catch { setCierreData(null); }
  };

  const ejecutarCierre = async (forzar = false) => {
    if (!selectedEj) return;
    setCerrando(true);
    try {
      const r = await fetch(`/api/ejercicios/${selectedEj.id}/cerrar`, {
        method: 'PUT', headers: hdrs, body: JSON.stringify({ forzar }),
      });
      const d = await r.json();
      if (r.ok) {
        showToast(`Ejercicio ${selectedEj.anio} cerrado correctamente`);
        setCierreStep(0); setSelectedEj(null); setCierreData(null);
        fetchEjercicios();
      } else {
        if (d.requiereForzar) {
          showToast(`${d.error}. Puedes forzar el cierre.`);
        } else {
          showToast(d.error || 'Error al cerrar');
        }
      }
    } catch { showToast('Error al cerrar ejercicio'); }
    setCerrando(false);
  };

  const fmt = (n: number) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;

  // ── Cierre wizard ──
  if (cierreStep > 0 && selectedEj) {
    return (
      <div className="space-y-4">
        {/* Progress steps */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" />Cierre de ejercicio {selectedEj.anio}</h2>
            <button onClick={() => { setCierreStep(0); setSelectedEj(null); }} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
          </div>
          <div className="flex gap-2 mt-3">
            {[1,2,3,4].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= cierreStep ? 'bg-amber-500' : 'bg-slate-700'}`} />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
            <span>Resumen</span><span>Verificar</span><span>Cierre contable</span><span>Confirmar</span>
          </div>
        </div>

        {/* Step 1: Summary */}
        {cierreStep === 1 && cierreData && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Resumen del ejercicio {selectedEj.anio}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-700 rounded-lg p-3 text-center">
                <p className="text-green-400 text-lg font-bold">{fmt(cierreData.ventas)} EUR</p>
                <p className="text-slate-400 text-xs">Ventas ({cierreData.numFacturasVenta} facturas)</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3 text-center">
                <p className="text-red-400 text-lg font-bold">{fmt(cierreData.compras)} EUR</p>
                <p className="text-slate-400 text-xs">Compras ({cierreData.numFacturasCompra} facturas)</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-3 text-center">
                <p className={`text-lg font-bold ${cierreData.resultado >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(cierreData.resultado)} EUR</p>
                <p className="text-slate-400 text-xs">Resultado</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Presupuestos</p>
                <p className="text-white font-medium">{cierreData.numPresupuestos}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Pedidos</p>
                <p className="text-white font-medium">{cierreData.numPedidos}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Cobros pendientes</p>
                <p className="text-amber-400 font-medium">{fmt(cierreData.cobrosPendientes)} EUR</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Pagos pendientes</p>
                <p className="text-amber-400 font-medium">{fmt(cierreData.pagosPendientes)} EUR</p>
              </div>
            </div>
            <button onClick={() => setCierreStep(2)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Verify */}
        {cierreStep === 2 && cierreData && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Verificaciones</h3>
            <div className="space-y-2">
              <div className={`flex items-center gap-3 p-3 rounded-lg ${cierreData.borradores > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                {cierreData.borradores > 0 ? <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> : <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                <div>
                  <p className={`text-sm font-medium ${cierreData.borradores > 0 ? 'text-amber-300' : 'text-green-300'}`}>
                    Facturas en borrador: {cierreData.borradores}
                  </p>
                  {cierreData.borradores > 0 && <p className="text-xs text-amber-400/70 mt-0.5">Hay facturas sin emitir. Puedes forzar el cierre igualmente.</p>}
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${cierreData.cobrosPendientes > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                {cierreData.cobrosPendientes > 0 ? <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> : <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                <p className={`text-sm font-medium ${cierreData.cobrosPendientes > 0 ? 'text-amber-300' : 'text-green-300'}`}>
                  Cobros pendientes: {fmt(cierreData.cobrosPendientes)} EUR
                </p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <BarChart3 className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm font-medium text-blue-300">Resultado del ejercicio: {fmt(cierreData.resultado)} EUR</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCierreStep(1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-medium">Atras</button>
              <button onClick={() => setCierreStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Contable closure */}
        {cierreStep === 3 && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Cierre contable</h3>
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
              <p className="text-slate-300 text-sm">Se generara automaticamente:</p>
              <ul className="text-slate-400 text-sm space-y-1 ml-4 list-disc">
                <li>Asiento de cierre del ejercicio {selectedEj.anio}</li>
                <li>Registro en cierres de ejercicio con totales</li>
                <li>Apertura automatica del ejercicio {selectedEj.anio + 1}</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCierreStep(2)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-medium">Atras</button>
              <button onClick={() => setCierreStep(4)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {cierreStep === 4 && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <h3 className="text-white font-medium">Confirmar cierre</h3>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 text-sm font-medium mb-1">Esta accion no se puede deshacer</p>
              <p className="text-red-400/70 text-xs">El ejercicio {selectedEj.anio} pasara a estado CERRADO. Los documentos del ejercicio quedaran en modo solo lectura.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCierreStep(3)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-medium">Atras</button>
              <button onClick={() => ejecutarCierre(cierreData?.borradores > 0)} disabled={cerrando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                {cerrando ? <><Loader2 className="w-4 h-4 animate-spin" />Cerrando...</> : <><Lock className="w-4 h-4" />Cerrar ejercicio {selectedEj.anio}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main list ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400" />Ejercicios fiscales</h2>
          <p className="text-slate-400 text-sm mt-0.5">Gestiona los ejercicios fiscales de tu empresa</p>
        </div>
        <button onClick={crearEjercicio} disabled={creando}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          Nuevo ejercicio
        </button>
      </div>

      {/* List */}
      {ejercicios.map(ej => {
        const res = resumenes[ej.anio];
        const isOpen = ej.estado === 'ABIERTO';
        const isClosed = ej.estado === 'CERRADO';
        return (
          <div key={ej.id} className={`bg-slate-800 rounded-xl border ${isOpen ? 'border-blue-500/30' : 'border-slate-700'} overflow-hidden`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{ej.anio}</span>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                    isOpen ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    ej.estado === 'EN_CIERRE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-slate-600/30 text-slate-400 border border-slate-600/30'
                  }`}>{isOpen ? 'Abierto' : ej.estado === 'EN_CIERRE' ? 'En cierre' : 'Cerrado'}</span>
                  {isClosed && ej.fechaCierre && (
                    <span className="text-xs text-slate-500">Cerrado el {new Date(ej.fechaCierre).toLocaleDateString('es-ES')}</span>
                  )}
                </div>
                {isOpen && (
                  <button onClick={() => iniciarCierre(ej)}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Lock className="w-3.5 h-3.5" />Cerrar ejercicio
                  </button>
                )}
              </div>

              {/* KPIs */}
              {res && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">Ventas</p>
                    <p className="text-green-400 font-bold mt-0.5">{fmt(res.ventas)} EUR</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{res.numFacturasVenta} facturas</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">Compras</p>
                    <p className="text-red-400 font-bold mt-0.5">{fmt(res.compras)} EUR</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{res.numFacturasCompra} facturas</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">Resultado</p>
                    <p className={`font-bold mt-0.5 ${res.resultado >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(res.resultado)} EUR</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">Presupuestos</p>
                    <p className="text-white font-bold mt-0.5">{res.numPresupuestos}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{res.numPedidos} pedidos</p>
                  </div>
                </div>
              )}

              {/* Comparativa */}
              {res?.comparativa && res.comparativa.ventasAnterior > 0 && (
                <div className="mt-3 bg-slate-700/30 rounded-lg p-3 flex items-center gap-4 text-xs">
                  <span className="text-slate-500">vs {ej.anio - 1}:</span>
                  <span className={res.ventas >= res.comparativa.ventasAnterior ? 'text-green-400' : 'text-red-400'}>
                    Ventas {res.ventas >= res.comparativa.ventasAnterior ? '+' : ''}{((res.ventas - res.comparativa.ventasAnterior) / res.comparativa.ventasAnterior * 100).toFixed(1)}%
                  </span>
                  <span className={res.resultado >= res.comparativa.resultadoAnterior ? 'text-green-400' : 'text-red-400'}>
                    Resultado {res.resultado >= res.comparativa.resultadoAnterior ? '+' : ''}{fmt(res.resultado - res.comparativa.resultadoAnterior)} EUR
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {ejercicios.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">No hay ejercicios fiscales</p>
          <p className="text-slate-400 text-sm mb-4">Crea el primer ejercicio para empezar a gestionar los datos por ano fiscal.</p>
          <button onClick={crearEjercicio} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
            Crear ejercicio {new Date().getFullYear()}
          </button>
        </div>
      )}
    </div>
  );
}