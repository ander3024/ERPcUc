import { useState, useEffect } from 'react';
import { Palette, Type, Image, Eye, Save, Loader2, CheckCircle, AlertCircle, RotateCcw, FileText, Truck, ShoppingCart, ClipboardList } from 'lucide-react';

const API = '/api';
const token = () => localStorage.getItem('accessToken') || '';
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const FUENTES = ['Arial', 'Helvetica', 'Segoe UI', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana'];

const TIPOS = [
  { id: 'factura', label: 'Factura', icon: FileText, color: 'indigo' },
  { id: 'albaran', label: 'Albarán', icon: Truck, color: 'teal' },
  { id: 'pedido', label: 'Pedido', icon: ShoppingCart, color: 'blue' },
  { id: 'presupuesto', label: 'Presupuesto', icon: ClipboardList, color: 'violet' },
];

const DEFAULTS: Record<string, any> = {
  factura: {
    colorPrimario: '#1e3a5f', colorSecundario: '#10b981', colorTexto: '#1a1a2e',
    fuente: 'Arial', logo: '', textoPie: '', textoCabecera: '', notasDefecto: '',
    copias: 1, mostrarNotas: true,
    mostrarIban: false, iban: '', textoLegal: '', mostrarNumeroPedido: false, mostrarCondicionesPago: true,
  },
  albaran: {
    colorPrimario: '#0f766e', colorSecundario: '#f59e0b', colorTexto: '#1a1a2e',
    fuente: 'Arial', logo: '', textoPie: '', textoCabecera: '', notasDefecto: '',
    copias: 1, mostrarNotas: true,
    mostrarPedidoOrigen: true, mostrarNotasEntrega: true, mostrarFirmaReceptor: false,
  },
  pedido: {
    colorPrimario: '#1d4ed8', colorSecundario: '#10b981', colorTexto: '#1a1a2e',
    fuente: 'Arial', logo: '', textoPie: '', textoCabecera: '', notasDefecto: '',
    copias: 1, mostrarNotas: true,
    mostrarFechaEntrega: true, mostrarCondiciones: true, mostrarPresupuestoOrigen: true,
  },
  presupuesto: {
    colorPrimario: '#7c3aed', colorSecundario: '#10b981', colorTexto: '#1a1a2e',
    fuente: 'Arial', logo: '', textoPie: '', textoCabecera: '', notasDefecto: '',
    copias: 1, mostrarNotas: true,
    mostrarFechaValidez: true, mostrarCondiciones: true, mostrarDescuentoGlobal: false,
  },
};

const PREVIEW_DATA: Record<string, any> = {
  factura: { tipo: 'Factura', num: 'F2026-0042', fecha: '10/03/2026', extra: 'Vencimiento: 10/04/2026', estado: 'Emitida' },
  albaran: { tipo: 'Albarán', num: 'ALB-2026-0018', fecha: '10/03/2026', extra: 'Pedido: PED-2026-0012', estado: 'Pendiente' },
  pedido: { tipo: 'Pedido', num: 'PED-2026-0012', fecha: '10/03/2026', extra: 'Entrega: 25/03/2026', estado: 'En proceso' },
  presupuesto: { tipo: 'Presupuesto', num: 'PRE-2026-0007', fecha: '10/03/2026', extra: 'Válido hasta: 10/04/2026', estado: 'Enviado' },
};

export default function PlantillasPage() {
  const [tipo, setTipo] = useState('factura');
  const [forms, setForms] = useState<Record<string, any>>({ ...DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetch(API + '/config/plantillas', { headers: hdrs() })
      .then(r => r.json())
      .then(d => {
        const merged: Record<string, any> = {};
        for (const t of TIPOS) {
          merged[t.id] = { ...DEFAULTS[t.id], ...(d[t.id] || {}) };
        }
        setForms(merged);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const form = forms[tipo] || DEFAULTS[tipo];
  const setForm = (updater: (prev: any) => any) => {
    setForms(prev => ({ ...prev, [tipo]: updater(prev[tipo] || DEFAULTS[tipo]) }));
  };
  const updateField = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(API + '/config/plantillas/' + tipo, { method: 'PUT', headers: hdrs(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsg({ type: 'ok', text: `Plantilla de ${TIPOS.find(t => t.id === tipo)?.label} guardada` });
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) { setMsg({ type: 'error', text: 'Logo max 500KB' }); return; }
    const reader = new FileReader();
    reader.onload = () => updateField('logo', reader.result as string);
    reader.readAsDataURL(file);
  };

  const abrirVistaPrevia = () => {
    const f = form;
    const pv = PREVIEW_DATA[tipo];
    const html = buildPreviewHtml(f, pv, tipo);
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  if (!loaded) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const tipoInfo = TIPOS.find(t => t.id === tipo)!;
  const pv = PREVIEW_DATA[tipo];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-violet-500/20 rounded-xl"><Palette className="w-6 h-6 text-violet-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">Plantillas de documentos</h1>
          <p className="text-slate-400 text-sm">Personaliza el aspecto de cada tipo de documento</p>
        </div>
      </div>

      {msg && (
        <div className={"mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 " + (msg.type === 'ok' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30')}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Type selector */}
      <div className="flex gap-2 mb-6">
        {TIPOS.map(t => (
          <button key={t.id} onClick={() => setTipo(t.id)}
            className={"flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border " +
              (tipo === t.id
                ? `bg-${t.color}-600 border-${t.color}-500 text-white shadow-lg shadow-${t.color}-500/20`
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white')}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left panel - Config */}
        <div className="col-span-5 space-y-4">
          {/* Logo */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Image className="w-4 h-4 text-slate-400" />Logo del documento
            </div>
            {form.logo ? (
              <div className="mb-3 p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                <img src={form.logo} alt="Logo" className="max-h-10 max-w-[140px]" />
                <button onClick={() => updateField('logo', '')} className="text-xs text-red-400 hover:text-red-300">Quitar</button>
              </div>
            ) : (
              <div className="mb-3 p-3 bg-slate-700/30 rounded-lg text-xs text-slate-500">
                Sin logo personalizado. Se usara el logo de empresa configurado en Ajustes generales.
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleLogo}
              className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-700 file:cursor-pointer" />
            <p className="text-xs text-slate-500 mt-2">Opcional. Si no subes un logo aqui, se usara el de la configuracion general de la empresa.</p>
          </div>

          {/* Colores */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
              <Palette className="w-4 h-4 text-slate-400" />Colores
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'colorPrimario', label: 'Primario' },
                { key: 'colorSecundario', label: 'Secundario' },
                { key: 'colorTexto', label: 'Texto' },
              ].map(c => (
                <div key={c.key}>
                  <label className="text-xs text-slate-500 mb-1 block">{c.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={form[c.key]} onChange={e => updateField(c.key, e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                    <input type="text" value={form[c.key]} onChange={e => updateField(c.key, e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none min-w-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fuente */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Type className="w-4 h-4 text-slate-400" />Tipografia
            </div>
            <select value={form.fuente} onChange={e => updateField('fuente', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Opciones comunes */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2.5">
            <div className="text-sm font-medium text-slate-300 mb-1">Opciones comunes</div>
            <Chk label="Mostrar notas/observaciones" checked={form.mostrarNotas} onChange={v => updateField('mostrarNotas', v)} />
          </div>

          {/* Type-specific options */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2.5">
            <div className="text-sm font-medium text-slate-300 mb-1">Opciones de {tipoInfo.label}</div>

            {tipo === 'factura' && <>
              <Chk label="Mostrar IBAN" checked={form.mostrarIban} onChange={v => updateField('mostrarIban', v)} />
              {form.mostrarIban && (
                <input type="text" value={form.iban || ''} onChange={e => updateField('iban', e.target.value)}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none" />
              )}
              <Chk label="Mostrar condiciones de pago" checked={form.mostrarCondicionesPago} onChange={v => updateField('mostrarCondicionesPago', v)} />
              <Chk label="Mostrar nº pedido cliente" checked={form.mostrarNumeroPedido} onChange={v => updateField('mostrarNumeroPedido', v)} />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Texto legal pie</label>
                <textarea value={form.textoLegal || ''} onChange={e => updateField('textoLegal', e.target.value)}
                  rows={2} placeholder="Ej: Inscrita en el Registro Mercantil..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
              </div>
            </>}

            {tipo === 'albaran' && <>
              <Chk label="Mostrar pedido origen" checked={form.mostrarPedidoOrigen} onChange={v => updateField('mostrarPedidoOrigen', v)} />
              <Chk label="Mostrar notas de entrega" checked={form.mostrarNotasEntrega} onChange={v => updateField('mostrarNotasEntrega', v)} />
              <Chk label="Mostrar firma receptor" checked={form.mostrarFirmaReceptor} onChange={v => updateField('mostrarFirmaReceptor', v)} />
            </>}

            {tipo === 'pedido' && <>
              <Chk label="Mostrar fecha entrega estimada" checked={form.mostrarFechaEntrega} onChange={v => updateField('mostrarFechaEntrega', v)} />
              <Chk label="Mostrar condiciones" checked={form.mostrarCondiciones} onChange={v => updateField('mostrarCondiciones', v)} />
              <Chk label="Mostrar presupuesto origen" checked={form.mostrarPresupuestoOrigen} onChange={v => updateField('mostrarPresupuestoOrigen', v)} />
            </>}

            {tipo === 'presupuesto' && <>
              <Chk label="Mostrar fecha validez" checked={form.mostrarFechaValidez} onChange={v => updateField('mostrarFechaValidez', v)} />
              <Chk label="Mostrar condiciones" checked={form.mostrarCondiciones} onChange={v => updateField('mostrarCondiciones', v)} />
              <Chk label="Mostrar descuento global" checked={form.mostrarDescuentoGlobal} onChange={v => updateField('mostrarDescuentoGlobal', v)} />
            </>}
          </div>

          {/* Textos */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <div className="text-sm font-medium text-slate-300 mb-1">Textos</div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Texto cabecera</label>
              <input type="text" value={form.textoCabecera || ''} onChange={e => updateField('textoCabecera', e.target.value)}
                placeholder="Texto opcional encima del documento"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Texto pie de pagina</label>
              <textarea value={form.textoPie || ''} onChange={e => updateField('textoPie', e.target.value)}
                rows={2} placeholder="Ej: Gracias por confiar en nosotros."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Notas/condiciones por defecto</label>
              <textarea value={form.notasDefecto || ''} onChange={e => updateField('notasDefecto', e.target.value)}
                rows={2} placeholder="Ej: Condiciones generales..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Copias al imprimir</label>
              <input type="number" min={1} max={5} value={form.copias} onChange={e => updateField('copias', parseInt(e.target.value) || 1)}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button onClick={guardar} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar plantilla'}
            </button>
            <button onClick={() => setForms(prev => ({ ...prev, [tipo]: { ...DEFAULTS[tipo] } }))}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              title="Restablecer valores por defecto">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="col-span-7">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Eye className="w-4 h-4 text-slate-400" />Vista previa: {tipoInfo.label}
              </div>
              <button onClick={abrirVistaPrevia}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors">
                <Eye className="w-3.5 h-3.5" />Abrir en ventana
              </button>
            </div>
            <div className="bg-white rounded-lg overflow-hidden shadow-xl" style={{ transform: 'scale(0.68)', transformOrigin: 'top left', width: '147%', height: '920px' }}>
              <div style={{ fontFamily: form.fuente + ',Arial,sans-serif', fontSize: '13px', color: form.colorTexto, padding: '40px' }}>
                {/* Cabecera texto */}
                {form.textoCabecera && <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '11px', color: '#64748b' }}>{form.textoCabecera}</div>}
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', paddingBottom: '24px', borderBottom: '3px solid ' + form.colorPrimario }}>
                  <div>
                    {form.logo && <img src={form.logo} alt="Logo" style={{ maxHeight: '60px', maxWidth: '200px', marginBottom: '8px', display: 'block' }} />}
                    <h1 style={{ fontSize: '22px', fontWeight: 800, color: form.colorPrimario, margin: 0 }}>Mi Empresa, S.L.</h1>
                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>CIF: B12345678 · C/ Ejemplo, 1 · 28001 Madrid</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>{pv.tipo}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: form.colorPrimario, fontFamily: 'monospace', marginTop: '4px' }}>{pv.num}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>Fecha: {pv.fecha}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{pv.extra}</div>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: form.colorSecundario + '20', color: form.colorSecundario, marginTop: '8px' }}>{pv.estado}</span>
                  </div>
                </div>

                {/* Two cols */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 600, marginBottom: '10px' }}>Cliente</h3>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Empresa Ejemplo, S.A.</div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>NIF: A12345678<br/>Av. de la Constitucion, 15<br/>28001 Madrid</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <h3 style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 600, marginBottom: '10px' }}>Documento</h3>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>
                      N: <strong>{pv.num}</strong><br/>Fecha: {pv.fecha}<br/>Forma de pago: Transferencia
                      {tipo === 'albaran' && form.mostrarPedidoOrigen ? <><br/>Pedido origen: PED-2026-0012</> : null}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ background: form.colorPrimario, color: '#fff' }}>
                      <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600 }}>Descripcion</th>
                      <th style={{ padding: '11px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600 }}>Cant.</th>
                      <th style={{ padding: '11px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600 }}>Precio</th>
                      <th style={{ padding: '11px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600 }}>IVA</th>
                      <th style={{ padding: '11px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Servicio de consultoria', '10', '85,00 €', '21%', '850,00 €'],
                      ['Desarrollo web personalizado', '1', '2.500,00 €', '21%', '2.250,00 €'],
                      ['Hosting anual', '1', '180,00 €', '21%', '180,00 €'],
                    ].map(([desc, cant, precio, iva, total], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}><strong>{desc}</strong></td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{cant}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{precio}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{iva}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}><strong>{total}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                  <table style={{ width: '300px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr><td style={{ padding: '6px 14px', color: '#64748b', fontSize: '13px' }}>Base imponible</td><td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>3.280,00 €</td></tr>
                      <tr><td style={{ padding: '6px 14px', color: '#64748b', fontSize: '13px' }}>IVA (21%)</td><td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>688,80 €</td></tr>
                      <tr><td style={{ padding: '12px 14px', fontSize: '18px', fontWeight: 800, color: form.colorPrimario, borderTop: '2px solid ' + form.colorPrimario }}>TOTAL</td><td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '18px', fontWeight: 800, color: form.colorPrimario, borderTop: '2px solid ' + form.colorPrimario }}>3.968,80 €</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Type-specific extras */}
                {tipo === 'factura' && form.mostrarIban && form.iban && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#166534' }}>
                    <strong>IBAN:</strong> {form.iban}
                  </div>
                )}
                {tipo === 'factura' && form.textoLegal && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '11px', color: '#64748b' }}>
                    {form.textoLegal}
                  </div>
                )}
                {tipo === 'albaran' && form.mostrarFirmaReceptor && (
                  <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>Entregado por</div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>Recibido por</div>
                  </div>
                )}
                {(tipo === 'pedido' || tipo === 'presupuesto') && form.mostrarCondiciones && form.notasDefecto && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '11px', color: '#64748b' }}>
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condiciones</strong>
                    {form.notasDefecto}
                  </div>
                )}

                {form.textoPie && (
                  <div style={{ paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                    {form.textoPie}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-violet-500 focus:ring-violet-500" />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function buildPreviewHtml(f: any, pv: any, tipo: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Vista previa - ${pv.tipo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'${f.fuente}',Arial,sans-serif;font-size:13px;color:${f.colorTexto};background:#fff}
    .page{max-width:800px;margin:0 auto;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid ${f.colorPrimario}}
    .logo h1{font-size:22px;font-weight:800;color:${f.colorPrimario}}
    .logo p{color:#64748b;font-size:12px;margin-top:2px}
    .logo img{max-height:60px;max-width:200px;margin-bottom:8px}
    .doc-right{text-align:right}
    .doc-tipo{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;font-weight:600}
    .doc-num{font-size:26px;font-weight:800;color:${f.colorPrimario};font-family:monospace;margin-top:4px}
    .doc-fecha{font-size:12px;color:#94a3b8;margin-top:3px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${f.colorSecundario}20;color:${f.colorSecundario};margin-top:8px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    thead tr{background:${f.colorPrimario};color:#fff}
    thead th{padding:11px 14px;text-align:left;font-size:11px;font-weight:600}
    thead th:not(:first-child){text-align:right}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody td{padding:10px 14px;font-size:12.5px}
    tbody td:not(:first-child){text-align:right}
    .totals{display:flex;justify-content:flex-end;margin-bottom:24px}
    .totals table{width:300px}
    .totals td{padding:6px 14px;font-size:13px}
    .totals td:first-child{color:#64748b}
    .totals td:last-child{text-align:right;font-weight:600}
    .totals tr.tr-total td{font-size:18px;font-weight:800;color:${f.colorPrimario};border-top:2px solid ${f.colorPrimario};padding-top:10px}
    .footer{padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:20px}}
  </style></head><body><div class="page">
  ${f.textoCabecera ? `<div style="text-align:center;margin-bottom:16px;font-size:11px;color:#64748b">${f.textoCabecera}</div>` : ''}
  <div class="header">
    <div class="logo">
      ${f.logo ? `<img src="${f.logo}" alt="Logo"/>` : ''}
      <h1>Mi Empresa, S.L.</h1>
      <p>CIF: B12345678 · C/ Ejemplo, 1 · 28001 Madrid</p>
    </div>
    <div class="doc-right">
      <div class="doc-tipo">${pv.tipo}</div>
      <div class="doc-num">${pv.num}</div>
      <div class="doc-fecha">Fecha: ${pv.fecha}</div>
      <div class="doc-fecha">${pv.extra}</div>
      <span class="badge">${pv.estado}</span>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:38%">Descripcion</th><th>Cant.</th><th>Precio</th><th>IVA</th><th>Total</th></tr></thead>
    <tbody>
      <tr><td><strong>Servicio de consultoria</strong></td><td>10</td><td>85,00 €</td><td>21%</td><td><strong>850,00 €</strong></td></tr>
      <tr><td><strong>Desarrollo web</strong></td><td>1</td><td>2.500,00 €</td><td>21%</td><td><strong>2.250,00 €</strong></td></tr>
      <tr><td><strong>Hosting anual</strong></td><td>1</td><td>180,00 €</td><td>21%</td><td><strong>180,00 €</strong></td></tr>
    </tbody>
  </table>
  <div class="totals"><table>
    <tr><td>Base imponible</td><td>3.280,00 €</td></tr>
    <tr><td>IVA (21%)</td><td>688,80 €</td></tr>
    <tr class="tr-total"><td>TOTAL</td><td>3.968,80 €</td></tr>
  </table></div>
  ${tipo === 'factura' && f.mostrarIban && f.iban ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#166534"><strong>IBAN:</strong> ${f.iban}</div>` : ''}
  ${tipo === 'factura' && f.textoLegal ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:11px;color:#64748b">${f.textoLegal}</div>` : ''}
  ${tipo === 'albaran' && f.mostrarFirmaReceptor ? `<div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px"><div style="border-top:1px solid #94a3b8;padding-top:8px;text-align:center;font-size:11px;color:#94a3b8">Entregado por</div><div style="border-top:1px solid #94a3b8;padding-top:8px;text-align:center;font-size:11px;color:#94a3b8">Recibido por</div></div>` : ''}
  ${(tipo === 'pedido' || tipo === 'presupuesto') && f.mostrarCondiciones && f.notasDefecto ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:11px;color:#64748b"><strong style="display:block;margin-bottom:4px;font-size:10px;text-transform:uppercase">Condiciones</strong>${f.notasDefecto}</div>` : ''}
  ${f.textoPie ? `<div class="footer">${f.textoPie}</div>` : ''}
  </div></body></html>`;
}
