import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// DASHBOARD
// ============================================================

// GET /rrhh/dashboard
router.get('/dashboard', async (req: any, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalEmpleados,
      nuevosEsteMes,
      ausenciasEsteMes,
      ausenciasPendientes,
      departamentos,
      nominasAprobadas,
      nominasPagadas,
      nominasBorrador,
    ] = await Promise.all([
      prisma.empleado.count({ where: { activo: true } }),
      prisma.empleado.count({
        where: {
          activo: true,
          fechaAlta: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.ausencia.count({
        where: {
          desde: { lte: endOfMonth },
          hasta: { gte: startOfMonth },
        },
      }),
      prisma.ausencia.count({ where: { estado: 'PENDIENTE' } }),
      prisma.departamento.findMany({
        include: { _count: { select: { empleados: true } } },
        orderBy: { nombre: 'asc' },
      }),
      prisma.nomina.aggregate({
        where: { estado: 'APROBADA' },
        _sum: { salarioNeto: true },
        _count: true,
      }),
      prisma.nomina.aggregate({
        where: { estado: 'PAGADA' },
        _sum: { salarioNeto: true },
        _count: true,
      }),
      prisma.nomina.aggregate({
        where: { estado: 'BORRADOR' },
        _sum: { salarioNeto: true },
        _count: true,
      }),
    ]);

    res.json({
      totalEmpleados,
      nuevosEsteMes,
      ausenciasEsteMes,
      ausenciasPendientes,
      departamentos,
      nominas: {
        aprobadas: { total: nominasAprobadas._count, importe: nominasAprobadas._sum.salarioNeto ?? 0 },
        pagadas: { total: nominasPagadas._count, importe: nominasPagadas._sum.salarioNeto ?? 0 },
        borrador: { total: nominasBorrador._count, importe: nominasBorrador._sum.salarioNeto ?? 0 },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// EMPLEADOS
// ============================================================

// GET /rrhh/empleados
router.get('/empleados', async (req: any, res: Response) => {
  try {
    const { page = '1', limit = '20', search = '', departamentoId, activo } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellidos: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search, mode: 'insensitive' } },
        { numeroEmpleado: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (departamentoId) where.departamentoId = departamentoId;
    if (activo !== undefined) where.activo = activo === 'true';

    const [data, total] = await Promise.all([
      prisma.empleado.findMany({
        where, skip, take: parseInt(limit),
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
        include: {
          departamento: true,
          puesto: true,
          usuario: { select: { email: true, activo: true } },
        },
      }),
      prisma.empleado.count({ where }),
    ]);

    const mapped = data.map(e => ({
      ...e,
      email: e.usuario?.email,
      activo: e.usuario?.activo ?? true,
    }));

    res.json({ data: mapped, total, totalPages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /rrhh/empleados/stats
router.get('/empleados/stats', async (req: any, res: Response) => {
  try {
    const [total, activos, departamentos, tiposContrato, ausenciasPendientes, nominaStats] = await Promise.all([
      prisma.empleado.count(),
      prisma.empleado.count({ where: { activo: true } }),
      prisma.departamento.findMany({ include: { _count: { select: { empleados: true } } } }),
      prisma.empleado.groupBy({
        by: ['tipoContrato'],
        _count: true,
        where: { activo: true },
      }),
      prisma.ausencia.count({ where: { estado: 'PENDIENTE' } }),
      prisma.nomina.aggregate({
        _sum: { salarioBruto: true, salarioNeto: true, totalDeducciones: true },
        _count: true,
      }),
    ]);

    res.json({
      total,
      activos,
      inactivos: total - activos,
      departamentos,
      tiposContrato,
      ausenciasPendientes,
      nominaStats: {
        total: nominaStats._count,
        salarioBrutoTotal: nominaStats._sum.salarioBruto ?? 0,
        salarioNetoTotal: nominaStats._sum.salarioNeto ?? 0,
        totalDeducciones: nominaStats._sum.totalDeducciones ?? 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /rrhh/empleados/:id
router.get('/empleados/:id', async (req: any, res: Response) => {
  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id: req.params.id },
      include: {
        departamento: true,
        puesto: true,
        usuario: { select: { id: true, email: true, activo: true, rol: true, nombre: true, avatar: true } },
        ausencias: { orderBy: { desde: 'desc' }, take: 10 },
        nominas: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!empleado) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ...empleado, email: empleado.usuario?.email, activo: empleado.usuario?.activo });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/empleados
router.post('/empleados', async (req: any, res: Response) => {
  try {
    const {
      usuarioId, email, password, nombre, apellidos, nif,
      fechaNacimiento, sexo, estadoCivil, telefono, direccion,
      fechaAlta, puestoId, departamentoId, tipoContrato,
      jornadaHoras, salarioBruto, nSS, ccc,
    } = req.body;

    if (!nombre || !apellidos || !nif) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, apellidos, nif' });
    }

    // Check if nif already exists
    const existingNif = await prisma.empleado.findUnique({ where: { nif } });
    if (existingNif) {
      return res.status(400).json({ error: 'Ya existe un empleado con ese NIF' });
    }

    // Auto-generate numeroEmpleado
    const lastEmpleado = await prisma.empleado.findFirst({
      orderBy: { numeroEmpleado: 'desc' },
      select: { numeroEmpleado: true },
    });
    let nextNum = 1;
    if (lastEmpleado?.numeroEmpleado) {
      const match = lastEmpleado.numeroEmpleado.match(/EMP(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const numeroEmpleado = `EMP${String(nextNum).padStart(3, '0')}`;

    // Resolve or create usuario
    let resolvedUsuarioId = usuarioId;

    if (!resolvedUsuarioId) {
      if (!email) {
        return res.status(400).json({ error: 'Se requiere usuarioId o email para crear el empleado' });
      }
      // Check if a usuario with that email already exists
      const existingUsuario = await prisma.usuario.findFirst({ where: { email } });
      if (existingUsuario) {
        // Check if this usuario already has an empleado
        const existingEmpleadoLink = await prisma.empleado.findUnique({ where: { usuarioId: existingUsuario.id } });
        if (existingEmpleadoLink) {
          return res.status(400).json({ error: 'Este usuario ya tiene un empleado vinculado' });
        }
        resolvedUsuarioId = existingUsuario.id;
      } else {
        // Create new usuario
        if (!password) {
          return res.status(400).json({ error: 'Se requiere password para crear un nuevo usuario' });
        }
        const nuevoUsuario = await prisma.usuario.create({
          data: {
            nombre,
            apellidos,
            email,
            password,
            rol: 'EMPLEADO',
            activo: true,
          },
        });
        resolvedUsuarioId = nuevoUsuario.id;
      }
    } else {
      // Verify usuarioId exists and is not already linked
      const usuario = await prisma.usuario.findUnique({ where: { id: resolvedUsuarioId } });
      if (!usuario) {
        return res.status(400).json({ error: 'Usuario no encontrado' });
      }
      const existingEmpleadoLink = await prisma.empleado.findUnique({ where: { usuarioId: resolvedUsuarioId } });
      if (existingEmpleadoLink) {
        return res.status(400).json({ error: 'Este usuario ya tiene un empleado vinculado' });
      }
    }

    const empleado = await prisma.empleado.create({
      data: {
        usuarioId: resolvedUsuarioId,
        numeroEmpleado,
        nif,
        nombre,
        apellidos,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
        sexo,
        estadoCivil,
        email,
        telefono,
        direccion,
        fechaAlta: fechaAlta ? new Date(fechaAlta) : new Date(),
        puestoId: puestoId || undefined,
        departamentoId: departamentoId || undefined,
        tipoContrato,
        jornadaHoras: jornadaHoras ?? 40,
        salarioBruto: salarioBruto ?? 0,
        nSS,
        ccc,
        activo: true,
      },
      include: {
        departamento: true,
        puesto: true,
        usuario: { select: { email: true, activo: true } },
      },
    });

    res.status(201).json(empleado);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rrhh/empleados/:id
router.put('/empleados/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.empleado.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });

    const {
      nombre, apellidos, nif, fechaNacimiento, sexo, estadoCivil,
      email, telefono, direccion, fechaAlta, fechaBaja,
      puestoId, departamentoId, tipoContrato, jornadaHoras,
      salarioBruto, nSS, ccc, activo,
    } = req.body;

    const data: any = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (apellidos !== undefined) data.apellidos = apellidos;
    if (nif !== undefined) data.nif = nif;
    if (fechaNacimiento !== undefined) data.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
    if (sexo !== undefined) data.sexo = sexo;
    if (estadoCivil !== undefined) data.estadoCivil = estadoCivil;
    if (email !== undefined) data.email = email;
    if (telefono !== undefined) data.telefono = telefono;
    if (direccion !== undefined) data.direccion = direccion;
    if (fechaAlta !== undefined) data.fechaAlta = new Date(fechaAlta);
    if (fechaBaja !== undefined) data.fechaBaja = fechaBaja ? new Date(fechaBaja) : null;
    if (puestoId !== undefined) data.puestoId = puestoId || null;
    if (departamentoId !== undefined) data.departamentoId = departamentoId || null;
    if (tipoContrato !== undefined) data.tipoContrato = tipoContrato;
    if (jornadaHoras !== undefined) data.jornadaHoras = jornadaHoras;
    if (salarioBruto !== undefined) data.salarioBruto = salarioBruto;
    if (nSS !== undefined) data.nSS = nSS;
    if (ccc !== undefined) data.ccc = ccc;
    if (activo !== undefined) data.activo = activo;

    const empleado = await prisma.empleado.update({
      where: { id: req.params.id },
      data,
      include: {
        departamento: true,
        puesto: true,
        usuario: { select: { email: true, activo: true } },
      },
    });

    res.json(empleado);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rrhh/empleados/:id (soft delete)
router.delete('/empleados/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.empleado.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });

    const empleado = await prisma.empleado.update({
      where: { id: req.params.id },
      data: {
        activo: false,
        fechaBaja: new Date(),
      },
    });

    res.json({ message: 'Empleado dado de baja', empleado });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// DEPARTAMENTOS
// ============================================================

// GET /rrhh/departamentos
router.get('/departamentos', async (req: any, res: Response) => {
  try {
    const departamentos = await prisma.departamento.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(departamentos);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/departamentos
router.post('/departamentos', async (req: any, res: Response) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const departamento = await prisma.departamento.create({
      data: { nombre },
      include: { _count: { select: { empleados: true } } },
    });
    res.status(201).json(departamento);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rrhh/departamentos/:id
router.put('/departamentos/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.departamento.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });

    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const departamento = await prisma.departamento.update({
      where: { id: req.params.id },
      data: { nombre },
      include: { _count: { select: { empleados: true } } },
    });
    res.json(departamento);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rrhh/departamentos/:id
router.delete('/departamentos/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.departamento.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing._count.empleados > 0) {
      return res.status(400).json({ error: `No se puede eliminar: tiene ${existing._count.empleados} empleado(s) asignado(s)` });
    }

    await prisma.departamento.delete({ where: { id: req.params.id } });
    res.json({ message: 'Departamento eliminado' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// PUESTOS DE TRABAJO
// ============================================================

// GET /rrhh/puestos
router.get('/puestos', async (req: any, res: Response) => {
  try {
    const puestos = await prisma.puestoTrabajo.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(puestos);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/puestos
router.post('/puestos', async (req: any, res: Response) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const puesto = await prisma.puestoTrabajo.create({
      data: { nombre },
      include: { _count: { select: { empleados: true } } },
    });
    res.status(201).json(puesto);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rrhh/puestos/:id
router.put('/puestos/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.puestoTrabajo.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });

    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const puesto = await prisma.puestoTrabajo.update({
      where: { id: req.params.id },
      data: { nombre },
      include: { _count: { select: { empleados: true } } },
    });
    res.json(puesto);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rrhh/puestos/:id
router.delete('/puestos/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.puestoTrabajo.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing._count.empleados > 0) {
      return res.status(400).json({ error: `No se puede eliminar: tiene ${existing._count.empleados} empleado(s) asignado(s)` });
    }

    await prisma.puestoTrabajo.delete({ where: { id: req.params.id } });
    res.json({ message: 'Puesto eliminado' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// AUSENCIAS
// ============================================================

// GET /rrhh/ausencias
router.get('/ausencias', async (req: any, res: Response) => {
  try {
    const { page = '1', limit = '20', estado, empleadoId, tipo, desde, hasta } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (estado) where.estado = estado;
    if (empleadoId) where.empleadoId = empleadoId;
    if (tipo) where.tipo = tipo;
    if (desde || hasta) {
      if (desde) where.desde = { ...(where.desde || {}), gte: new Date(desde) };
      if (hasta) where.hasta = { ...(where.hasta || {}), lte: new Date(hasta) };
    }

    const [data, total] = await Promise.all([
      prisma.ausencia.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { desde: 'desc' },
        include: { empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } } },
      }),
      prisma.ausencia.count({ where }),
    ]);

    res.json({ data, total, totalPages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/ausencias
router.post('/ausencias', async (req: any, res: Response) => {
  try {
    const { empleadoId, tipo, desde, hasta, motivo } = req.body;
    if (!empleadoId || !tipo || !desde || !hasta) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const d = new Date(desde), h = new Date(hasta);
    if (h < d) {
      return res.status(400).json({ error: 'La fecha "hasta" debe ser posterior a "desde"' });
    }
    const dias = Math.ceil((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const ausencia = await prisma.ausencia.create({
      data: { empleadoId, tipo, desde: d, hasta: h, dias, motivo, estado: 'PENDIENTE' },
      include: { empleado: { select: { nombre: true, apellidos: true } } },
    });
    res.status(201).json(ausencia);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rrhh/ausencias/:id
router.put('/ausencias/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.ausencia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden editar ausencias en estado PENDIENTE' });
    }

    const { tipo, desde, hasta, motivo } = req.body;
    const data: any = {};
    if (tipo !== undefined) data.tipo = tipo;
    if (motivo !== undefined) data.motivo = motivo;
    if (desde !== undefined || hasta !== undefined) {
      const d = new Date(desde ?? existing.desde);
      const h = new Date(hasta ?? existing.hasta);
      if (h < d) {
        return res.status(400).json({ error: 'La fecha "hasta" debe ser posterior a "desde"' });
      }
      data.desde = d;
      data.hasta = h;
      data.dias = Math.ceil((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const ausencia = await prisma.ausencia.update({
      where: { id: req.params.id },
      data,
      include: { empleado: { select: { nombre: true, apellidos: true } } },
    });
    res.json(ausencia);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rrhh/ausencias/:id
router.delete('/ausencias/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.ausencia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden eliminar ausencias en estado PENDIENTE' });
    }

    await prisma.ausencia.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ausencia eliminada' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /rrhh/ausencias/:id/aprobar
router.patch('/ausencias/:id/aprobar', async (req: any, res: Response) => {
  try {
    const existing = await prisma.ausencia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden aprobar ausencias en estado PENDIENTE' });
    }

    const ausencia = await prisma.ausencia.update({
      where: { id: req.params.id },
      data: { estado: 'APROBADA' },
    });
    res.json(ausencia);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /rrhh/ausencias/:id/rechazar
router.patch('/ausencias/:id/rechazar', async (req: any, res: Response) => {
  try {
    const existing = await prisma.ausencia.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden rechazar ausencias en estado PENDIENTE' });
    }

    const ausencia = await prisma.ausencia.update({
      where: { id: req.params.id },
      data: { estado: 'RECHAZADA' },
    });
    res.json(ausencia);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// NOMINAS
// ============================================================

// GET /rrhh/nominas
router.get('/nominas', async (req: any, res: Response) => {
  try {
    const { page = '1', limit = '20', empleadoId, periodo, estado } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {};
    if (empleadoId) where.empleadoId = empleadoId;
    if (periodo) where.periodo = periodo;
    if (estado) where.estado = estado;

    const [data, total] = await Promise.all([
      prisma.nomina.findMany({
        where, skip, take: parseInt(limit),
        orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
        include: {
          empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true, nif: true } },
        },
      }),
      prisma.nomina.count({ where }),
    ]);

    res.json({ data, total, totalPages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /rrhh/nominas/stats
router.get('/nominas/stats', async (req: any, res: Response) => {
  try {
    const [totalPagadas, totalPendientes, porMes] = await Promise.all([
      prisma.nomina.aggregate({
        where: { estado: 'PAGADA' },
        _sum: { salarioNeto: true, salarioBruto: true, totalDeducciones: true },
        _count: true,
      }),
      prisma.nomina.aggregate({
        where: { estado: { in: ['BORRADOR', 'APROBADA'] } },
        _sum: { salarioNeto: true, salarioBruto: true },
        _count: true,
      }),
      prisma.nomina.groupBy({
        by: ['periodo'],
        _sum: { salarioBruto: true, salarioNeto: true, totalDeducciones: true },
        _count: true,
        orderBy: { periodo: 'desc' },
        take: 12,
      }),
    ]);

    res.json({
      pagadas: {
        total: totalPagadas._count,
        salarioBruto: totalPagadas._sum.salarioBruto ?? 0,
        salarioNeto: totalPagadas._sum.salarioNeto ?? 0,
        totalDeducciones: totalPagadas._sum.totalDeducciones ?? 0,
      },
      pendientes: {
        total: totalPendientes._count,
        salarioBruto: totalPendientes._sum.salarioBruto ?? 0,
        salarioNeto: totalPendientes._sum.salarioNeto ?? 0,
      },
      porMes,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /rrhh/nominas/:id
router.get('/nominas/:id', async (req: any, res: Response) => {
  try {
    const nomina = await prisma.nomina.findUnique({
      where: { id: req.params.id },
      include: {
        empleado: {
          select: {
            id: true, nombre: true, apellidos: true, numeroEmpleado: true,
            nif: true, nSS: true, ccc: true, tipoContrato: true,
            departamento: true, puesto: true,
          },
        },
      },
    });
    if (!nomina) return res.status(404).json({ error: 'No encontrado' });
    res.json(nomina);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/nominas
router.post('/nominas', async (req: any, res: Response) => {
  try {
    const { empleadoId, periodo, salarioBruto, irpf, seguridadSocial, totalDeducciones, salarioNeto } = req.body;
    if (!empleadoId || !periodo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: empleadoId, periodo' });
    }

    // Check employee exists
    const empleado = await prisma.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Use provided values or calculate from employee salary
    const bruto = salarioBruto ?? empleado.salarioBruto;
    const pctIrpf = irpf ?? bruto * 0.15;
    const pctSS = seguridadSocial ?? bruto * 0.0635;
    const deducciones = totalDeducciones ?? (pctIrpf + pctSS);
    const neto = salarioNeto ?? (bruto - deducciones);

    const nomina = await prisma.nomina.create({
      data: {
        empleadoId,
        periodo,
        salarioBruto: bruto,
        irpf: pctIrpf,
        seguridadSocial: pctSS,
        totalDeducciones: deducciones,
        salarioNeto: neto,
        estado: 'BORRADOR',
      },
      include: {
        empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } },
      },
    });
    res.status(201).json(nomina);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /rrhh/nominas/generar
router.post('/nominas/generar', async (req: any, res: Response) => {
  try {
    const { periodo } = req.body;
    if (!periodo) {
      return res.status(400).json({ error: 'El periodo es obligatorio (formato: YYYY-MM)' });
    }

    // Validate periodo format
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return res.status(400).json({ error: 'Formato de periodo inválido. Use YYYY-MM (ej: 2026-03)' });
    }

    // Get all active employees
    const empleados = await prisma.empleado.findMany({
      where: { activo: true },
      select: { id: true, salarioBruto: true, nombre: true, apellidos: true, numeroEmpleado: true },
    });

    if (empleados.length === 0) {
      return res.status(400).json({ error: 'No hay empleados activos' });
    }

    // Check which employees already have a nomina for this periodo
    const existingNominas = await prisma.nomina.findMany({
      where: { periodo },
      select: { empleadoId: true },
    });
    const existingIds = new Set(existingNominas.map(n => n.empleadoId));

    const empleadosSinNomina = empleados.filter(e => !existingIds.has(e.id));

    if (empleadosSinNomina.length === 0) {
      return res.status(400).json({ error: 'Todos los empleados activos ya tienen nómina para este periodo' });
    }

    // Generate nominas
    const nominasData = empleadosSinNomina.map(emp => {
      const bruto = emp.salarioBruto;
      const irpf = Math.round(bruto * 0.15 * 100) / 100;
      const ss = Math.round(bruto * 0.0635 * 100) / 100;
      const deducciones = Math.round((irpf + ss) * 100) / 100;
      const neto = Math.round((bruto - deducciones) * 100) / 100;

      return {
        empleadoId: emp.id,
        periodo,
        salarioBruto: bruto,
        irpf,
        seguridadSocial: ss,
        totalDeducciones: deducciones,
        salarioNeto: neto,
        estado: 'BORRADOR' as const,
      };
    });

    const result = await prisma.nomina.createMany({ data: nominasData });

    // Fetch the created nominas to return them
    const createdNominas = await prisma.nomina.findMany({
      where: {
        periodo,
        empleadoId: { in: empleadosSinNomina.map(e => e.id) },
      },
      include: {
        empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } },
      },
      orderBy: { empleado: { apellidos: 'asc' } },
    });

    res.status(201).json({
      message: `Se generaron ${result.count} nóminas para el periodo ${periodo}`,
      total: result.count,
      omitidas: existingIds.size,
      nominas: createdNominas,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /rrhh/nominas/:id
router.put('/nominas/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.nomina.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Solo se pueden editar nóminas en estado BORRADOR' });
    }

    const { salarioBruto, irpf, seguridadSocial, totalDeducciones, salarioNeto, periodo } = req.body;
    const data: any = {};
    if (periodo !== undefined) data.periodo = periodo;
    if (salarioBruto !== undefined) data.salarioBruto = salarioBruto;
    if (irpf !== undefined) data.irpf = irpf;
    if (seguridadSocial !== undefined) data.seguridadSocial = seguridadSocial;
    if (totalDeducciones !== undefined) data.totalDeducciones = totalDeducciones;
    if (salarioNeto !== undefined) data.salarioNeto = salarioNeto;

    const nomina = await prisma.nomina.update({
      where: { id: req.params.id },
      data,
      include: {
        empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } },
      },
    });
    res.json(nomina);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /rrhh/nominas/:id/aprobar
router.patch('/nominas/:id/aprobar', async (req: any, res: Response) => {
  try {
    const existing = await prisma.nomina.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Solo se pueden aprobar nóminas en estado BORRADOR' });
    }

    const nomina = await prisma.nomina.update({
      where: { id: req.params.id },
      data: { estado: 'APROBADA' },
    });
    res.json(nomina);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /rrhh/nominas/:id/pagar
router.patch('/nominas/:id/pagar', async (req: any, res: Response) => {
  try {
    const existing = await prisma.nomina.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'APROBADA') {
      return res.status(400).json({ error: 'Solo se pueden pagar nóminas en estado APROBADA' });
    }

    const nomina = await prisma.nomina.update({
      where: { id: req.params.id },
      data: { estado: 'PAGADA' },
    });
    res.json(nomina);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /rrhh/nominas/:id
router.delete('/nominas/:id', async (req: any, res: Response) => {
  try {
    const existing = await prisma.nomina.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'No encontrado' });
    if (existing.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Solo se pueden eliminar nóminas en estado BORRADOR' });
    }

    await prisma.nomina.delete({ where: { id: req.params.id } });
    res.json({ message: 'Nómina eliminada' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// FICHAJES / PRESENCIA
// ============================================================

router.get('/fichajes', async (req: any, res: Response) => {
  try {
    const { empleadoId, fecha, page = '1', limit = '30' } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (empleadoId) where.empleadoId = empleadoId;
    if (fecha) where.fecha = new Date(fecha);

    const [data, total] = await Promise.all([
      prisma.fichaje.findMany({
        where, skip, take: parseInt(limit),
        orderBy: [{ fecha: 'desc' }, { horaEntrada: 'desc' }],
        include: { empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } } },
      }),
      prisma.fichaje.count({ where }),
    ]);
    res.json({ data, total, totalPages: Math.ceil(total / parseInt(limit)), page: parseInt(page) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/fichajes/entrada', async (req: any, res: Response) => {
  try {
    const { empleadoId } = req.body;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    // Check if already has open entry today
    const existing = await prisma.fichaje.findFirst({ where: { empleadoId, fecha: hoy, horaSalida: null } });
    if (existing) return res.status(400).json({ error: 'Ya tiene un fichaje abierto hoy' });

    const fichaje = await prisma.fichaje.create({
      data: { empleadoId, fecha: hoy, horaEntrada: new Date(), tipo: 'NORMAL' },
      include: { empleado: { select: { nombre: true, apellidos: true } } },
    });
    res.json(fichaje);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/fichajes/salida', async (req: any, res: Response) => {
  try {
    const { empleadoId } = req.body;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fichaje = await prisma.fichaje.findFirst({ where: { empleadoId, fecha: hoy, horaSalida: null } });
    if (!fichaje) return res.status(400).json({ error: 'No tiene un fichaje abierto hoy' });

    const ahora = new Date();
    const totalHoras = fichaje.horaEntrada ? (ahora.getTime() - fichaje.horaEntrada.getTime()) / (1000 * 60 * 60) : 0;

    const updated = await prisma.fichaje.update({
      where: { id: fichaje.id },
      data: { horaSalida: ahora, totalHoras: Math.round(totalHoras * 100) / 100 },
    });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/fichajes/:id', async (req: any, res: Response) => {
  try {
    await prisma.fichaje.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ORGANIGRAMA
// ============================================================

router.get('/organigrama', async (req: any, res: Response) => {
  try {
    const departamentos = await prisma.departamento.findMany({
      include: {
        empleados: {
          where: { activo: true },
          select: { id: true, nombre: true, apellidos: true, numeroEmpleado: true, tipoContrato: true, puesto: { select: { nombre: true } } },
          orderBy: [{ apellidos: 'asc' }],
        },
      },
      orderBy: { nombre: 'asc' },
    });

    // Also get unassigned employees
    const sinDepartamento = await prisma.empleado.findMany({
      where: { activo: true, departamentoId: null },
      select: { id: true, nombre: true, apellidos: true, numeroEmpleado: true, tipoContrato: true, puesto: { select: { nombre: true } } },
    });

    res.json({ departamentos, sinDepartamento });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
