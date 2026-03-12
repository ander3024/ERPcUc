import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function getTemplate(nivel: number, numeroFactura: string) {
  switch (nivel) {
    case 1:
      return {
        asunto: `Recordatorio de pago - Factura ${numeroFactura}`,
        cuerpo: 'Estimado cliente, le recordamos que tiene una factura pendiente de pago...',
      };
    case 2:
      return {
        asunto: `Aviso formal - Factura ${numeroFactura} vencida`,
        cuerpo: 'Le comunicamos que su factura lleva más de 15 días vencida...',
      };
    case 3:
      return {
        asunto: `Aviso urgente - Factura ${numeroFactura}`,
        cuerpo: 'Aviso urgente: si no recibimos el pago en las próximas 48 horas, iniciaremos gestión de cobro...',
      };
    default:
      return {
        asunto: `Recordatorio de pago - Factura ${numeroFactura}`,
        cuerpo: 'Estimado cliente, le recordamos que tiene una factura pendiente de pago...',
      };
  }
}

// POST /procesar — process all overdue vencimientos and create reminders
router.post('/procesar', async (req: any, res: any) => {
  try {
    const hoy = new Date();
    let procesados = 0;
    let creados = 0;

    const vencimientosVencidos = await prisma.vencimiento.findMany({
      where: { estado: 'VENCIDO' },
      include: {
        factura: {
          include: { cliente: true },
        },
      },
    });

    for (const vencimiento of vencimientosVencidos) {
      procesados++;

      const diasRetraso = Math.floor(
        (hoy.getTime() - vencimiento.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)
      );

      const recordatoriosExistentes = await prisma.recordatorioCobro.findMany({
        where: { vencimientoId: vencimiento.id },
        select: { nivel: true },
      });

      const nivelesExistentes = recordatoriosExistentes.map((r: any) => r.nivel);
      const numeroFactura = vencimiento.factura?.numeroCompleto || '';
      const emailDestinatario = vencimiento.factura?.cliente?.email || '';

      if (diasRetraso >= 3 && !nivelesExistentes.includes(1)) {
        const template = getTemplate(1, numeroFactura);
        await prisma.recordatorioCobro.create({
          data: {
            vencimientoId: vencimiento.id,
            nivel: 1,
            asunto: template.asunto,
            cuerpo: template.cuerpo,
            emailDestinatario,
          },
        });
        creados++;
      }

      if (diasRetraso >= 15 && !nivelesExistentes.includes(2)) {
        const template = getTemplate(2, numeroFactura);
        await prisma.recordatorioCobro.create({
          data: {
            vencimientoId: vencimiento.id,
            nivel: 2,
            asunto: template.asunto,
            cuerpo: template.cuerpo,
            emailDestinatario,
          },
        });
        creados++;
      }

      if (diasRetraso >= 30 && !nivelesExistentes.includes(3)) {
        const template = getTemplate(3, numeroFactura);
        await prisma.recordatorioCobro.create({
          data: {
            vencimientoId: vencimiento.id,
            nivel: 3,
            asunto: template.asunto,
            cuerpo: template.cuerpo,
            emailDestinatario,
          },
        });
        creados++;
      }
    }

    res.json({ procesados, creados });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando recordatorios' });
  }
});

// GET / — list recordatorios
router.get('/', async (req: any, res: any) => {
  try {
    const { facturaId } = req.query;

    const where: any = {};
    if (facturaId) {
      where.vencimiento = { facturaId };
    }

    const recordatorios = await prisma.recordatorioCobro.findMany({
      where,
      include: {
        vencimiento: {
          include: { factura: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(recordatorios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error listando recordatorios' });
  }
});

// POST /enviar/:vencimientoId — manually send reminder
router.post('/enviar/:vencimientoId', async (req: any, res: any) => {
  try {
    const { vencimientoId } = req.params;

    const vencimiento = await prisma.vencimiento.findUnique({
      where: { id: vencimientoId },
      include: {
        factura: {
          include: { cliente: true },
        },
      },
    });

    if (!vencimiento) {
      return res.status(404).json({ error: 'Vencimiento no encontrado' });
    }

    const countExistentes = await prisma.recordatorioCobro.count({
      where: { vencimientoId },
    });

    const nivel = Math.min(countExistentes + 1, 3);
    const numeroFactura = vencimiento.factura?.numeroCompleto || '';
    const emailDestinatario = vencimiento.factura?.cliente?.email || '';
    const template = getTemplate(nivel, numeroFactura);

    const recordatorio = await prisma.recordatorioCobro.create({
      data: {
        vencimientoId,
        nivel,
        asunto: template.asunto,
        cuerpo: template.cuerpo,
        emailDestinatario,
      },
      include: {
        vencimiento: {
          include: { factura: true },
        },
      },
    });

    res.status(201).json(recordatorio);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando recordatorio' });
  }
});

export default router;
