import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_V = '/api/ventas';
const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const TIPOS_DOC = {
  presupuestos: { label: 'Presupuesto', prefijo: 'PRES', campoFecha2: 'fechaValidez', label2: 'Válido hasta' },
  pedidos: { label: 'Pedido de venta', prefijo: 'PV', campoFecha2: 'fechaEntrega', label2: 'Fecha entrega' },
  albaranes: { label: 'Albarán de venta', prefijo: 'AV', campoFecha2: null, label2: null },
  facturas: { label: 'Factura de venta', prefijo: 'F', campoFecha2: 'fechaVencimiento', label2: 'Fecha vencimiento' },
};

const TIPOS_IVA_PCT: Record<string, number> = {
  GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0, INTRACOMUNITARIO: 0, EXPORTACION: 0
};

export default function NuevoDocumentoVentaPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const docConfig = TIPOS_DOC[tipo as keyof typeof TIPOS_DOC] || TIPOS_DOC.pedidos;

  const [clientes, setClientes] = useState<any[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [form, setForm] = useState({ clienteId: '', observaciones: '', fechaExtra: '' });
  const [lineas, setLineas] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaArticulo, setBusquedaArticulo] = useState('');
  const [showClienteSearch, setShowClienteSearch] = useState(false);
  const [showArticuloSearch, setShowArticuloSearch] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/clientes?limit=5&search=${busquedaCliente}`, { headers })
      .then(r => r.json()).then(d => setClientes(Array.isArray(d.data) ? d.data : []));
  }, [busquedaCliente]);

  useEffect(() => {
    fetch(`${API}/almacen/articulos?limit=8&search=${busquedaArticulo}`, { headers })
      .then(r => r.json()).then(d => setArticulos(Array.isArray(d.data) ? d.data : []));
  }, [busquedaArticulo]);

  const seleccionarCliente = (c: any) => {
    setClienteSeleccionado(c);
    setForm(f => ({ ...f, clienteId: c.id }));
    setShowClienteSearch(false);
    setBusquedaCliente('');
  };

  const añadirLinea = (articulo?: any) => {
    const pctIva = TIPOS_IVA_PCT[clienteSeleccionado?.tipoIva || 'GENERAL'];
    setLineas(ls => [...ls, {
      id: Date.now(),
      articuloId: articulo?.id || null,
      descripcion: articulo?.nombre || '',
      cantidad: 1,
      precio: articulo?.precio || 0,
      descuento: clienteSeleccionado?.descuento || 0,
      tipoIva: clienteSeleccionado?.tipoIva || 'GENERAL',
      pctIva,
    }]);
    setShowArticuloSearch(false);
    setBusquedaArticulo('');
  };

  const updateLinea = (id: number, key: string, value: any) => {
    setLineas(ls => ls.map(l => l.id === id ? { ...l, [key]: value } : l));
  };

  const removeLinea = (id: number) => setLineas(ls => ls.filter(l => l.id !== id));

  const calcLinea = (l: any) => {
    const base = Number(l.cantidad) * Number(l.precio) * (1 - Number(l.descuento || 0) / 100);
    const iva = base * (l.pctIva || TIPOS_IVA_PCT[l.tipoIva] || 21) / 100;
    return { base, iva, total: base + iva };
  };

  const totales = lineas.reduce((acc, l) => {
    const c = calcLinea(l);
    return { base: acc.base + c.base, iva: acc.iva + c.iva, total: acc.total + c.total };
  }, { base: 0, iva: 0, total: 0 });

  const handleSave = async () => {
    if (!form.clienteId) { setError('Selecciona un cliente'); return; }
    if (lineas.length === 0) { setError('Añade al menos una línea'); return; }
    setSaving(true); setError('');
    try {
      const body: any = {
        clienteId: form.clienteId,
        observaciones: form.observaciones,
        lineas: lineas.map(l => ({
          articuloId: l.articuloId, descripcion: l.descripcion,
          cantidad: Number(l.cantidad), precio: Number(l.precio),
          descuento: Number(l.descuento || 0),
        }))
      };
      if (docConfig.campoFecha2 && form.fechaExtra) body[docConfig.campoFecha2] = form.fechaExtra;

      const res = await fetch(`${API_V}/${tipo}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      navigate('/ventas');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/ventas')} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo {docConfig.label}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cliente */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Cliente</h2>
          {clienteSeleccionado ? (
            <div className="flex items-start justify-between bg-blue-50 rounded-lg p-4">
              <div>
                <div className="font-semibold text-gray-900">{clienteSeleccionado.nombre}</div>
                <div className="text-sm text-gray-500">{clienteSeleccionado.cifNif}</div>
                <div className="text-xs text-gray-400 mt-1">
                  IVA: {clienteSeleccionado.tipoIva} · {clienteSeleccionado.formaPago?.nombre || 'Sin forma pago'}
                  {clienteSeleccionado.descuento > 0 ? ` · Dto: ${clienteSeleccionado.descuento}%` : ''}
                </div>
              </div>
              <button onClick={() => { setClienteSeleccionado(null); setForm(f => ({ ...f, clienteId: '' })); }}
                className="text-gray-400 hover:text-red-500">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input value={busquedaCliente} onChange={e => { setBusquedaCliente(e.target.value); setShowClienteSearch(true); }}
                onFocus={() => setShowClienteSearch(true)}
                placeholder="Buscar cliente por nombre o CIF..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {showClienteSearch && clientes.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientes.map(c => (
                    <div key={c.id} onClick={() => seleccionarCliente(c)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0">
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-gray-400">{c.cifNif} · {c.tipoIva}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Observaciones del documento..." />
          </div>
        </div>

        {/* Datos del documento */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Datos</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Fecha</label>
            <input type="date" defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {docConfig.campoFecha2 && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">{docConfig.label2}</label>
              <input type="date" value={form.fechaExtra} onChange={e => setForm(f => ({ ...f, fechaExtra: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {/* Totales */}
          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Base imponible</span><span className="font-medium">{fmt(totales.base)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IVA</span><span className="font-medium">{fmt(totales.iva)}</span>
            </div>
            <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-200 pt-2">
              <span>Total</span><span>{fmt(totales.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Líneas del documento</h2>
          <div className="flex gap-2">
            <div className="relative">
              <input value={busquedaArticulo} onChange={e => { setBusquedaArticulo(e.target.value); setShowArticuloSearch(true); }}
                onFocus={() => setShowArticuloSearch(true)}
                placeholder="Buscar artículo..."
                className="w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {showArticuloSearch && articulos.length > 0 && (
                <div className="absolute right-0 z-20 w-72 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {articulos.map(a => (
                    <div key={a.id} onClick={() => añadirLinea(a)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0">
                      <div className="font-medium text-sm">{a.nombre}</div>
                      <div className="text-xs text-gray-400">{a.referencia} · {fmt(a.precio || 0)} · Stock: {a.stock}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => añadirLinea()}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              + Línea libre
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Descripción</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-20">Cant.</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Precio</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-20">Dto %</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-20">IVA %</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                Busca un artículo o añade una línea libre
              </td></tr>
            ) : lineas.map(l => {
              const c = calcLinea(l);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <input value={l.descripcion} onChange={e => updateLinea(l.id, 'descripcion', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={l.cantidad} min="0.001" step="0.001"
                      onChange={e => updateLinea(l.id, 'cantidad', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={l.precio} min="0" step="0.01"
                      onChange={e => updateLinea(l.id, 'precio', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={l.descuento} min="0" max="100" step="0.01"
                      onChange={e => updateLinea(l.id, 'descuento', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">{l.pctIva}%</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(c.total)}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => removeLinea(l.id)} className="text-gray-300 hover:text-red-500">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {lineas.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-sm text-gray-600 font-medium">Base: {fmt(totales.base)} · IVA: {fmt(totales.iva)}</td>
                <td className="px-3 py-3 text-right font-bold text-base">{fmt(totales.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/ventas')}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Guardando...' : `Crear ${docConfig.label}`}
        </button>
      </div>
    </div>
  );
}
