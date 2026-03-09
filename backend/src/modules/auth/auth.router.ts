import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordValid = await bcrypt.compare(password, usuario.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: usuario.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );

    // Guardar sesión
    await prisma.sesionUsuario.create({
      data: {
        usuarioId: usuario.id,
        refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Actualizar último acceso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    logger.info(`Login exitoso: ${usuario.email}`);

    res.json({
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        rol: usuario.rol,
        avatar: usuario.avatar,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
    }
    logger.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token no proporcionado' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    const sesion = await prisma.sesionUsuario.findUnique({
      where: { refreshToken },
      include: { usuario: true },
    });

    if (!sesion || !sesion.usuario.activo || sesion.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    const newAccessToken = jwt.sign(
      { id: sesion.usuario.id, email: sesion.usuario.email, rol: sesion.usuario.rol },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});

// POST /auth/logout
router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.sesionUsuario.deleteMany({ where: { refreshToken } });
    }
    res.json({ message: 'Sesión cerrada' });
  } catch (error) {
    res.status(500).json({ error: 'Error cerrando sesión' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, nombre: true, apellidos: true,
        telefono: true, avatar: true, rol: true, ultimoAcceso: true,
      },
    });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuario' });
  }
});

// PUT /auth/change-password
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(passwordActual, usuario.password);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(passwordNueva, 12);
    await prisma.usuario.update({ where: { id: req.user!.id }, data: { password: hash } });

    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando contraseña' });
  }
});

export default router;
