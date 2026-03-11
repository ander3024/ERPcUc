import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// OPORTUNIDADES (Kanban)
// ============================================

const ETAPAS = ['NUEVA', 'CONTACTO', 'PROPUESTA', 'NEGOCIACION', 'GANADA', 'PERDIDA'];

router.get('/oportunidades', async (req: any, res: Response) => {
  try {
    const etapa = req.query.etapa as string;
    const search = req.query.search as string;
    const where: any = {};
    if (etapa) where.etapa = etapa;
    if (search) where.OR = [
      { titulo: { contains: search, mode: 'insensitive' } },
      { contactoNombre: { contains: search, mode: 'insensitive' } },
    ];

    const data = await prisma.oportunidad.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { nombre: true, codigo: true } },
        agente: { select: { nombre: true } },
        campana: { select: { nombre: true } },
        _count: { select: { actividades: true } },
      },
    });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/oportunidades/resumen', async (req: any, res: Response) => {
  try {
    const all = await prisma.oportunidad.findMany();
    const porEtapa: Record<string, { count: number; importe: number }> = {};
    ETAPAS.forEach(e => { porEtapa[e] = { count: 0, importe: 0 }; });
    all.forEach(o => {
      if (!porEtapa[o.etapa]) porEtapa[o.etapa] = { count: 0, importe: 0 };
      porEtapa[o.etapa].count++;
      porEtapa[o.etapa].importe += o.importe;
    });
    const totalAbiertas = all.filter(o => !['GANADA','PERDIDA'].includes(o.etapa)).length;
    const totalImporte = all.filter(o => !['GANADA','PERDIDA'].includes(o.etapa)).reduce((s, o) => s + o.importe, 0);
    const ganadas = all.filter(o => o.etapa === 'GANADA');
    const totalGanado = ganadas.reduce((s, o) => s + o.importe, 0);
    res.json({ porEtapa, totalAbiertas, totalImporte, totalGanado, numGanadas: ganadas.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/oportunidades', async (req: any, res: Response) => {
  try {
    const op = await prisma.oportunidad.create({
      data: { ...req.body, fechaCierre: req.body.fechaCierre ? new Date(req.body.fechaCierre) : null },
    });
    res.json(op);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/oportunidades/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (data.fechaCierre) data.fechaCierre = new Date(data.fechaCierre);
    const op = await prisma.oportunidad.update({ where: { id: req.params.id }, data });
    res.json(op);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Move oportunidad to another etapa (kanban drag)
router.put('/oportunidades/:id/etapa', async (req: any, res: Response) => {
  try {
    const { etapa, motivo } = req.body;
    const data: any = { etapa };
    if (motivo) data.motivo = motivo;
    if (etapa === 'GANADA' || etapa === 'PERDIDA') data.fechaCierre = new Date();
    const op = await prisma.oportunidad.update({ where: { id: req.params.id }, data });
    res.json(op);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/oportunidades/:id', async (req: any, res: Response) => {
  try {
    await prisma.oportunidad.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// ACTIVIDADES / SEGUIMIENTO
// ============================================

router.get('/actividades', async (req: any, res: Response) => {
  try {
    const clienteId = req.query.clienteId as string;
    const oportunidadId = req.query.oportunidadId as string;
    const completada = req.query.completada as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;

    const where: any = {};
    if (clienteId) where.clienteId = clienteId;
    if (oportunidadId) where.oportunidadId = oportunidadId;
    if (completada === 'true') where.completada = true;
    if (completada === 'false') where.completada = false;

    const [total, data] = await Promise.all([
      prisma.actividadCRM.count({ where }),
      prisma.actividadCRM.findMany({
        where, orderBy: { fecha: 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: {
          cliente: { select: { nombre: true, codigo: true } },
          oportunidad: { select: { titulo: true } },
        },
      }),
    ]);
    res.json({ data, total, totalPages: Math.ceil(total / limit), page });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/actividades', async (req: any, res: Response) => {
  try {
    const act = await prisma.actividadCRM.create({
      data: { ...req.body, fecha: req.body.fecha ? new Date(req.body.fecha) : new Date() },
    });
    res.json(act);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/actividades/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (data.fecha) data.fecha = new Date(data.fecha);
    const act = await prisma.actividadCRM.update({ where: { id: req.params.id }, data });
    res.json(act);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/actividades/:id/toggle', async (req: any, res: Response) => {
  try {
    const act = await prisma.actividadCRM.findUnique({ where: { id: req.params.id } });
    if (!act) return res.status(404).json({ error: 'No encontrada' });
    const updated = await prisma.actividadCRM.update({ where: { id: req.params.id }, data: { completada: !act.completada } });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/actividades/:id', async (req: any, res: Response) => {
  try {
    await prisma.actividadCRM.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CAMPANAS
// ============================================

router.get('/campanas', async (req: any, res: Response) => {
  try {
    const data = await prisma.campanaCRM.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { oportunidades: true } } },
    });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/campanas', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
    if (data.fechaFin) data.fechaFin = new Date(data.fechaFin);
    const camp = await prisma.campanaCRM.create({ data });
    res.json(camp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/campanas/:id', async (req: any, res: Response) => {
  try {
    const data: any = { ...req.body };
    if (data.fechaInicio) data.fechaInicio = new Date(data.fechaInicio);
    if (data.fechaFin) data.fechaFin = new Date(data.fechaFin);
    const camp = await prisma.campanaCRM.update({ where: { id: req.params.id }, data });
    res.json(camp);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/campanas/:id', async (req: any, res: Response) => {
  try {
    await prisma.campanaCRM.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
