import { Router, Response } from 'express';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getEmailConfig, saveEmailConfig, testEmail, enviarFactura, enviarDocumento, getPlantillas, getPlantillaTipo, savePlantillaTipo, getPlantilla, savePlantilla } from './email.controller';

const router = Router();
const prisma = new PrismaClient();

// ── CONFIG EMPRESA ──────────────────────────────────────────

// GET /config
router.get('/', async (req: any, res: Response) => {
  try {
    let config = await prisma.configEmpresa.findFirst();
    if (!config) {
      config = await prisma.configEmpresa.create({
        data: { nombre: 'Mi Empresa', cif: 'B00000000', ejercicioActual: new Date().getFullYear() },
      });
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config
router.put('/', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    let config = await prisma.configEmpresa.findFirst();
    const data = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt;
    if (data.contadorFactura) data.contadorFactura = parseInt(data.contadorFactura);
    if (data.contadorPresup) data.contadorPresup = parseInt(data.contadorPresup);
    if (data.contadorPedido) data.contadorPedido = parseInt(data.contadorPedido);
    if (data.ejercicioActual) data.ejercicioActual = parseInt(data.ejercicioActual);

    if (config) {
      config = await prisma.configEmpresa.update({ where: { id: config.id }, data });
    } else {
      config = await prisma.configEmpresa.create({ data });
    }
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── USUARIOS ────────────────────────────────────────────────

// GET /config/usuarios
router.get('/usuarios', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true, email: true, nombre: true, apellidos: true,
        telefono: true, rol: true, activo: true, createdAt: true,
        ultimoAcceso: true,
      },
    });
    res.json(usuarios);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/usuarios
router.post('/usuarios', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const { email, password, nombre, apellidos, rol, telefono } = req.body;
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
    }
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 12);
    const usuario = await prisma.usuario.create({
      data: { email, password: hash, nombre, apellidos: apellidos || '', rol: rol || 'EMPLEADO', telefono },
      select: { id: true, email: true, nombre: true, apellidos: true, rol: true, activo: true },
    });
    res.status(201).json(usuario);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/usuarios/:id
router.put('/usuarios/:id', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const { password, ...rest } = req.body;
    const data: any = { ...rest };
    delete data.id; delete data.createdAt; delete data.email;

    if (password && password.length >= 6) {
      data.password = await bcrypt.hash(password, 12);
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, nombre: true, apellidos: true, rol: true, activo: true },
    });
    res.json(usuario);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /config/usuarios/:id/toggle
router.patch('/usuarios/:id/toggle', async (req: any, res: Response) => {
  try {
    if (!['SUPERADMIN', 'ADMIN'].includes(req.user?.rol)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
    const u = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!u) return res.status(404).json({ error: 'No encontrado' });
    if (u.id === req.user?.id) return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });

    const updated = await prisma.usuario.update({
      where: { id: req.params.id },
      data: { activo: !u.activo },
      select: { id: true, activo: true, nombre: true },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── EMAIL / SMTP ──────────────────────────────────────────
router.get('/email', getEmailConfig);
router.put('/email', saveEmailConfig);
router.post('/email/test', testEmail);
router.post('/facturas/:id/enviar', enviarFactura);
router.post('/documentos/:tipo/:id/enviar', enviarDocumento);

// ── PLANTILLAS (multi-tipo) ──────────────────────────────
router.get('/plantillas', getPlantillas);       // GET all types
router.get('/plantillas/:tipo', getPlantillaTipo);  // GET specific type
router.put('/plantillas/:tipo', savePlantillaTipo); // PUT specific type

// ── AGENTES COMERCIALES ─────────────────────────────────────

// GET /config/agentes
router.get('/agentes', async (req: any, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const agentes = await prisma.agente.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { clientes: true, facturas: true } } },
    });
    res.json(agentes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/agentes
router.post('/agentes', async (req: any, res: Response) => {
  try {
    const { nombre, email, telefono, comision, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const agente = await prisma.agente.create({
      data: { nombre, email: email || null, telefono: telefono || null, comision: comision || 0, activo: activo !== false },
    });
    res.status(201).json(agente);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/agentes/:id
router.put('/agentes/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt; delete data._count;
    const agente = await prisma.agente.update({ where: { id: req.params.id }, data });
    res.json(agente);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/agentes/:id
router.delete('/agentes/:id', async (req: any, res: Response) => {
  try {
    await prisma.agente.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── TARIFAS DE PRECIOS ──────────────────────────────────────

// GET /config/tarifas
router.get('/tarifas', async (req: any, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search) {
      where.nombre = { contains: search, mode: 'insensitive' };
    }
    const tarifas = await prisma.tarifa.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { lineas: true, clientes: true } } },
    });
    res.json(tarifas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/tarifas
router.post('/tarifas', async (req: any, res: Response) => {
  try {
    const { nombre, descripcion, tipo, activa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const tarifa = await prisma.tarifa.create({
      data: { nombre, descripcion: descripcion || null, tipo: tipo || 'PORCENTAJE_DESCUENTO', activa: activa !== false },
    });
    res.status(201).json(tarifa);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/tarifas/:id
router.put('/tarifas/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data.createdAt; delete data.updatedAt; delete data._count;
    const tarifa = await prisma.tarifa.update({ where: { id: req.params.id }, data });
    res.json(tarifa);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/tarifas/:id
router.delete('/tarifas/:id', async (req: any, res: Response) => {
  try {
    await prisma.tarifa.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /config/tarifas/:id/lineas
router.get('/tarifas/:id/lineas', async (req: any, res: Response) => {
  try {
    const lineas = await prisma.tarifaLinea.findMany({
      where: { tarifaId: req.params.id },
      include: { articulo: { select: { id: true, referencia: true, nombre: true, precioVenta: true } } },
      orderBy: { articulo: { nombre: 'asc' } },
    });
    res.json(lineas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/tarifas/:id/lineas
router.post('/tarifas/:id/lineas', async (req: any, res: Response) => {
  try {
    const { articuloId, precio, descuento } = req.body;
    if (!articuloId) return res.status(400).json({ error: 'articuloId es obligatorio' });
    const linea = await prisma.tarifaLinea.create({
      data: { tarifaId: req.params.id, articuloId, precio: precio || null, descuento: descuento || 0 },
      include: { articulo: { select: { id: true, referencia: true, nombre: true, precioVenta: true } } },
    });
    res.status(201).json(linea);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Artículo ya existe en esta tarifa' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/tarifas/:id/lineas/:lineaId
router.delete('/tarifas/:id/lineas/:lineaId', async (req: any, res: Response) => {
  try {
    await prisma.tarifaLinea.delete({ where: { id: req.params.lineaId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── FORMAS DE PAGO ──────────────────────────────────────────

// GET /config/formas-pago
router.get('/formas-pago', async (_req: any, res: Response) => {
  try {
    const formas = await prisma.formaPago.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { clientes: true, facturas: true } } },
    });
    res.json(formas);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /config/formas-pago
router.post('/formas-pago', async (req: any, res: Response) => {
  try {
    const { nombre, diasVto, numVtos, tipo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });
    const fp = await prisma.formaPago.create({
      data: { nombre, diasVto: diasVto || 0, numVtos: numVtos || 1, tipo: tipo || 'CONTADO' },
    });
    res.status(201).json(fp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config/formas-pago/:id
router.put('/formas-pago/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    delete data.id; delete data._count; delete data.codigoEneboo;
    const fp = await prisma.formaPago.update({ where: { id: req.params.id }, data });
    res.json(fp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /config/formas-pago/:id
router.delete('/formas-pago/:id', async (req: any, res: Response) => {
  try {
    await prisma.formaPago.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
