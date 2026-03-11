import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, Eye, EyeOff, Server, Shield, Save, Loader2 } from 'lucide-react';

const API = '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const PROVIDERS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false, help: 'Usa una App Password de Google: Cuenta > Seguridad > Verificacion en 2 pasos > Contrasenas de aplicaciones' },
  { id: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, help: 'Usa tu email y contrasena de Microsoft' },
  { id: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, help: 'Usuario: apikey / Contrasena: tu API key de SendGrid' },
  { id: 'custom', label: 'SMTP personalizado', host: '', port: 587, secure: false, help: '' },
];

export default function EmailConfigPage() {
  const [form, setForm] = useState({ host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '' });
  const [provider, setProvider] = useState('custom');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(API + '/config/email', { headers: headers() })
      .then(r => r.json())
      .then(d => {
        setForm({ host: d.host || '', port: d.port || 587, secure: !!d.secure, user: d.user || '', password: d.password || '', fromName: d.fromName || '', fromEmail: d.fromEmail || '' });
        // Detect provider
        if (d.host === 'smtp.gmail.com') setProvider('gmail');
        else if (d.host === 'smtp.office365.com') setProvider('outlook');
        else if (d.host === 'smtp.sendgrid.net') setProvider('sendgrid');
        else setProvider('custom');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const selectProvider = (id: string) => {
    setProvider(id);
    const p = PROVIDERS.find(x => x.id === id);
    if (p && id !== 'custom') {
      setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }));
    }
  };

  const guardar = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(API + '/config/email', { method: 'PUT', headers: headers(), body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsg({ type: 'ok', text: 'Configuracion SMTP guardada correctamente' });
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  const enviarPrueba = async () => {
    if (!testEmail) { setMsg({ type: 'error', text: 'Escribe un email destino' }); return; }
    setTesting(true);
    setMsg(null);
    try {
      const r = await fetch(API + '/config/email/test', { method: 'POST', headers: headers(), body: JSON.stringify({ to: testEmail }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsg({ type: 'ok', text: d.message || 'Email enviado' });
      setTimeout(() => setMsg(null), 5000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setTesting(false);
  };

  if (!loaded) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const currentProvider = PROVIDERS.find(p => p.id === provider);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-indigo-500/20 rounded-xl"><Mail className="w-6 h-6 text-indigo-400" /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracion de Email</h1>
          <p className="text-slate-400 text-sm">Configura el servidor SMTP para enviar facturas y notificaciones</p>
        </div>
      </div>

      {msg && (
        <div className={"px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 " + (msg.type === 'ok' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30')}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Provider selector */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Proveedor rapido</div>
        <div className="grid grid-cols-4 gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => selectProvider(p.id)}
              className={"px-4 py-3 rounded-lg text-sm font-medium transition-all border " + (provider === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500')}>
              {p.label}
            </button>
          ))}
        </div>
        {currentProvider?.help && (
          <div className="mt-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
            {currentProvider.help}
          </div>
        )}
      </div>

      {/* SMTP Form */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Server className="w-4 h-4 text-slate-400" />Servidor SMTP
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">Host SMTP</label>
            <input type="text" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })}
              placeholder="smtp.ejemplo.com" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Puerto</label>
            <input type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 587 })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.secure} onChange={e => setForm({ ...form, secure: e.target.checked })}
              className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-indigo-500" />
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Conexion segura (TLS/SSL)</span>
          </label>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
            <Mail className="w-4 h-4 text-slate-400" />Credenciales
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Usuario / Email</label>
              <input type="text" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })}
                placeholder="usuario@ejemplo.com" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Contrasena</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nombre remitente</label>
              <input type="text" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })}
                placeholder="Mi Empresa S.L." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Email remitente</label>
              <input type="email" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="facturacion@miempresa.com" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>

        <button onClick={guardar} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </div>

      {/* Test email */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
          <Send className="w-4 h-4 text-slate-400" />Enviar email de prueba
        </div>
        <div className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="destinatario@ejemplo.com"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <button onClick={enviarPrueba} disabled={testing}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Enviando...' : 'Enviar prueba'}
          </button>
        </div>
      </div>
    </div>
  );
}
