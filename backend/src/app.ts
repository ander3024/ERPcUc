import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { rateLimit } from 'express-rate-limit';

import { logger } from './utils/logger';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { initSocket } from './config/socket';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

import informesRouter from './modules/informes/informes.router';
import authRouter from './modules/auth/auth.router';
import clientesRouter from './modules/clientes/clientes.router';
import articulosRouter from './modules/articulos/articulos.router';
import almacenRouter from './modules/almacen/almacen.router';
import ventasRouter from './modules/ventas/ventas.router';
import facturasRouter from './modules/facturas/facturas.router';
import comprasRouter from './modules/compras/compras.router';
import contabilidadRouter from './modules/contabilidad/contabilidad.router';
import tpvRouter from './modules/tpv/tpv.router';
import rrhhRouter from './modules/rrhh/rrhh.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import configRouter from './modules/config/config.router';
import usuariosRouter from './modules/usuarios/usuarios.router';
import notificacionesRouter from './modules/notificaciones/notificaciones.router';
import verifactuRouter from './modules/verifactu/verifactu.router';
import crmRouter from './modules/crm/crm.router';
import integracionesRouter from './modules/integraciones/integraciones.router';
import ejerciciosRouter from './modules/ejercicios/ejercicios.router';

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
app.use(limiter);
app.use('/uploads', express.static('uploads'));

// RUTAS PUBLICAS
app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.0.0' }));
app.use('/auth', authRouter);

// RUTAS PROTEGIDAS
app.use('/dashboard', authMiddleware, dashboardRouter);
app.use('/clientes', authMiddleware, clientesRouter);
app.use('/articulos', authMiddleware, articulosRouter);
app.use('/almacen', authMiddleware, almacenRouter);
app.use('/ventas', authMiddleware, ventasRouter);
app.use('/facturas', authMiddleware, facturasRouter);
app.use('/informes', authMiddleware, informesRouter);
app.use('/notificaciones', authMiddleware, notificacionesRouter);
app.use('/compras', authMiddleware, comprasRouter);
app.use('/contabilidad', authMiddleware, contabilidadRouter);
app.use('/tpv', authMiddleware, tpvRouter);
app.use('/rrhh', authMiddleware, rrhhRouter);
app.use('/config', authMiddleware, configRouter);
app.use('/usuarios', authMiddleware, usuariosRouter);
app.use('/verifactu', authMiddleware, verifactuRouter);
app.use('/crm', authMiddleware, crmRouter);
app.use('/integraciones', authMiddleware, integracionesRouter);
app.use('/ejercicios', authMiddleware, ejerciciosRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL conectado');
    await redis.ping();
    logger.info('✅ Redis conectado');
    httpServer.listen(PORT, () => logger.info(`🚀 ERP Web API corriendo en puerto ${PORT}`));
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

bootstrap();
