import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// @ts-ignore - Redis import
import { redis } from '../../config/redis';

const SMTP_KEY = 'erp:smtp:config';
const PLANTILLA_KEY_PREFIX = 'erp:plantilla:';
const PLANTILLA_LEGACY_KEY = 'erp:plantilla:config';
const TIPOS_VALIDOS = ['factura', 'albaran', 'pedido', 'presupuesto'];

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

const PLANTILLA_DEFAULTS: Record<string, any> = {
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

// ── GET SMTP CONFIG ──
export const getEmailConfig = async (_req: Request, res: Response) => {
  try {
    const raw = await redis.get(SMTP_KEY);
    if (!raw) return res.json({ host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '' });
    const config = JSON.parse(raw);
    res.json({ ...config, password: config.password ? '••••••••' : '' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ── PUT SMTP CONFIG ──
export const saveEmailConfig = async (req: Request, res: Response) => {
  try {
    const { host, port, secure, user, password, fromName, fromEmail } = req.body;
    let finalPassword = password;
    if (password === '••••••••') {
      const raw = await redis.get(SMTP_KEY);
      if (raw) finalPassword = JSON.parse(raw).password;
    }
    const config: SmtpConfig = {
      host: host || '', port: parseInt(port) || 587, secure: !!secure,
      user: user || '', password: finalPassword || '',
      fromName: fromName || '', fromEmail: fromEmail || '',
    };
    await redis.set(SMTP_KEY, JSON.stringify(config));
    res.json({ ok: true, message: 'Configuracion SMTP guardada' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// ── TEST EMAIL ──
export const testEmail = async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Email destino requerido' });
    const raw = await redis.get(SMTP_KEY);
    if (!raw) return res.status(400).json({ error: 'Configura SMTP primero' });
    const cfg: SmtpConfig = JSON.parse(raw);
    if (!cfg.host || !cfg.user) return res.status(400).json({ error: 'Configuracion SMTP incompleta' });

    const transporter = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName || 'ERP'}" <${cfg.fromEmail || cfg.user}>`,
      to,
      subject: 'Email de prueba - ERP Web',
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#1e3a5f;margin:0 0 16px">Conexion exitosa</h2>
        <p style="color:#64748b;line-height:1.6">Este email confirma que la configuracion SMTP de tu ERP funciona correctamente.</p>
        <div style="margin-top:24px;padding:16px;background:#ecfdf5;border-radius:8px;border-left:4px solid #10b981">
          <p style="margin:0;color:#065f46;font-weight:600">Servidor: ${cfg.host}:${cfg.port}</p>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Enviado desde ERP Web · ${new Date().toLocaleString('es-ES')}</p>
      </div>`,
    });

    res.json({ ok: true, message: `Email de prueba enviado a ${to}` });
  } catch (e: any) {
    res.status(500).json({ error: 'Error enviando email: ' + e.message });
  }
};

// ── SEND INVOICE EMAIL ──
export const enviarFactura = async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    const facturaId = req.params.id;

    const raw = await redis.get(SMTP_KEY);
    if (!raw) return res.status(400).json({ error: 'Configura SMTP primero' });
    const cfg: SmtpConfig = JSON.parse(raw);
    if (!cfg.host || !cfg.user) return res.status(400).json({ error: 'Configuracion SMTP incompleta' });

    const factura = await prisma.factura.findUnique({
      where: { id: facturaId },
      include: {
        cliente: true,
        lineas: { include: { articulo: true }, orderBy: { orden: 'asc' } },
        formaPago: true,
      },
    });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const empresa = await prisma.configEmpresa.findFirst();
    const emailTo = to || factura.cliente?.email;
    if (!emailTo) return res.status(400).json({ error: 'No hay email destino' });

    // Get plantilla config for colors - try typed first, fallback to legacy
    const plantillaRaw = await redis.get(PLANTILLA_KEY_PREFIX + 'factura') || await redis.get(PLANTILLA_LEGACY_KEY);
    const plantilla = plantillaRaw ? JSON.parse(plantillaRaw) : {};
    const colorPrimario = plantilla.colorPrimario || '#1e3a5f';

    const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
    const fmtD = (d: Date | string | null) => d ? new Date(d as string).toLocaleDateString('es-ES') : '-';

    const lineasHtml = factura.lineas.map(l => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px">${l.descripcion || '-'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px">${l.cantidad}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px">${fmt(l.precioUnitario)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px">${l.tipoIva}%</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:600">${fmt(l.totalLinea)}</td>
      </tr>
    `).join('');

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#fff">
      <div style="background:${colorPrimario};padding:30px 40px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">${empresa?.nombre || 'Mi Empresa'}</h1>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">${empresa?.cif || ''} · ${empresa?.direccion || ''} ${empresa?.ciudad || ''}</p>
      </div>
      <div style="padding:30px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:30px">
          <div>
            <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Factura</p>
            <p style="font-size:24px;font-weight:800;color:${colorPrimario};margin:0;font-family:monospace">${factura.numeroCompleto}</p>
            <p style="color:#64748b;font-size:13px;margin:4px 0 0">Fecha: ${fmtD(factura.fecha)}</p>
            ${factura.fechaVencimiento ? `<p style="color:#64748b;font-size:13px;margin:2px 0 0">Vencimiento: ${fmtD(factura.fechaVencimiento)}</p>` : ''}
          </div>
          <div style="text-align:right">
            <p style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">Cliente</p>
            <p style="font-size:16px;font-weight:700;color:#1e293b;margin:0">${factura.cliente?.nombre || '-'}</p>
            <p style="color:#64748b;font-size:13px;margin:2px 0 0">${factura.cliente?.cifNif || ''}</p>
            <p style="color:#64748b;font-size:13px;margin:2px 0 0">${factura.cliente?.direccion || ''}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr style="background:${colorPrimario}">
              <th style="padding:11px 14px;text-align:left;color:#fff;font-size:11px;font-weight:600">Descripcion</th>
              <th style="padding:11px 14px;text-align:right;color:#fff;font-size:11px;font-weight:600">Cant.</th>
              <th style="padding:11px 14px;text-align:right;color:#fff;font-size:11px;font-weight:600">Precio</th>
              <th style="padding:11px 14px;text-align:right;color:#fff;font-size:11px;font-weight:600">IVA</th>
              <th style="padding:11px 14px;text-align:right;color:#fff;font-size:11px;font-weight:600">Total</th>
            </tr>
          </thead>
          <tbody>${lineasHtml}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end">
          <table style="width:280px;border-collapse:collapse">
            <tr><td style="padding:6px 14px;color:#64748b;font-size:13px">Base imponible</td><td style="padding:6px 14px;text-align:right;font-weight:600;font-size:13px">${fmt(factura.baseImponible)}</td></tr>
            <tr><td style="padding:6px 14px;color:#64748b;font-size:13px">IVA</td><td style="padding:6px 14px;text-align:right;font-weight:600;font-size:13px">${fmt(factura.totalIva)}</td></tr>
            <tr><td style="padding:12px 14px;font-size:18px;font-weight:800;color:${colorPrimario};border-top:2px solid ${colorPrimario}">TOTAL</td><td style="padding:12px 14px;text-align:right;font-size:18px;font-weight:800;color:${colorPrimario};border-top:2px solid ${colorPrimario}">${fmt(factura.total)}</td></tr>
          </table>
        </div>
        ${factura.formaPago ? `<p style="margin-top:20px;padding:12px 16px;background:#f8fafc;border-radius:8px;color:#64748b;font-size:13px">Forma de pago: <strong>${factura.formaPago.nombre}</strong></p>` : ''}
        ${plantilla.iban ? `<p style="margin-top:8px;padding:12px 16px;background:#f8fafc;border-radius:8px;color:#64748b;font-size:13px">IBAN: <strong>${plantilla.iban}</strong></p>` : ''}
        ${plantilla.textoPie ? `<p style="margin-top:20px;color:#94a3b8;font-size:11px;text-align:center">${plantilla.textoPie}</p>` : ''}
      </div>
    </div>`;

    const transporter = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName || empresa?.nombre || 'ERP'}" <${cfg.fromEmail || cfg.user}>`,
      to: emailTo,
      subject: `Factura ${factura.numeroCompleto} de ${empresa?.nombre || 'Mi Empresa'}`,
      html,
    });

    res.json({ ok: true, message: `Factura enviada a ${emailTo}` });
  } catch (e: any) {
    res.status(500).json({ error: 'Error enviando factura: ' + e.message });
  }
};

// ── PLANTILLAS (multi-tipo) ──

// GET /plantillas → all types
export const getPlantillas = async (_req: Request, res: Response) => {
  try {
    const result: Record<string, any> = {};
    for (const tipo of TIPOS_VALIDOS) {
      const raw = await redis.get(PLANTILLA_KEY_PREFIX + tipo);
      result[tipo] = raw ? { ...PLANTILLA_DEFAULTS[tipo], ...JSON.parse(raw) } : { ...PLANTILLA_DEFAULTS[tipo] };
    }
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// GET /plantillas/:tipo → single type
export const getPlantillaTipo = async (req: Request, res: Response) => {
  try {
    const tipo = req.params.tipo;
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo invalido. Validos: ' + TIPOS_VALIDOS.join(', ') });
    }
    const raw = await redis.get(PLANTILLA_KEY_PREFIX + tipo);
    if (raw) {
      res.json({ ...PLANTILLA_DEFAULTS[tipo], ...JSON.parse(raw) });
    } else {
      // Fallback: migrate legacy key for factura
      if (tipo === 'factura') {
        const legacy = await redis.get(PLANTILLA_LEGACY_KEY);
        if (legacy) {
          res.json({ ...PLANTILLA_DEFAULTS[tipo], ...JSON.parse(legacy) });
          return;
        }
      }
      res.json({ ...PLANTILLA_DEFAULTS[tipo] });
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// PUT /plantillas/:tipo → save single type
export const savePlantillaTipo = async (req: Request, res: Response) => {
  try {
    const tipo = req.params.tipo;
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo invalido. Validos: ' + TIPOS_VALIDOS.join(', ') });
    }
    await redis.set(PLANTILLA_KEY_PREFIX + tipo, JSON.stringify(req.body));
    res.json({ ok: true, message: `Plantilla ${tipo} guardada` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// Legacy compatibility: GET/PUT /plantillas (without tipo) → factura
export const getPlantilla = async (_req: Request, res: Response) => {
  try {
    // Try typed key first, then legacy
    let raw = await redis.get(PLANTILLA_KEY_PREFIX + 'factura');
    if (!raw) raw = await redis.get(PLANTILLA_LEGACY_KEY);
    if (!raw) return res.json({ ...PLANTILLA_DEFAULTS.factura });
    res.json({ ...PLANTILLA_DEFAULTS.factura, ...JSON.parse(raw) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const savePlantilla = async (req: Request, res: Response) => {
  try {
    await redis.set(PLANTILLA_KEY_PREFIX + 'factura', JSON.stringify(req.body));
    res.json({ ok: true, message: 'Plantilla guardada' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
