# 🏢 ERP Web — Sistema de Gestión Empresarial

ERP completo en web desarrollado para migrar desde Eneboo, con módulos de **CRM, Almacén, Ventas, Facturación, Compras, Contabilidad, TPV y RRHH**.

## ⚡ Inicio Rápido (Ubuntu 24)

```bash
# 1. Sube el proyecto al servidor
scp -r ./erp-web usuario@tu-servidor:/opt/

# 2. Ejecuta el instalador
ssh usuario@tu-servidor
cd /opt/erp-web
sudo bash scripts/install.sh

# 3. Accede al ERP
http://tu-ip-servidor
```

## 🏗️ Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Nginx      │────▶│  React (SPA) │     │   Node.js    │
│  (proxy)    │     │  + Vite      │     │  + Express   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                    ┌────────────┼─────────────┐
                                    │            │             │
                              ┌─────┴──┐  ┌─────┴──┐  ┌──────┴──┐
                              │Postgres│  │ Redis  │  │Socket.io│
                              │  DB    │  │ Cache  │  │  WS     │
                              └────────┘  └────────┘  └─────────┘
```

## 📦 Módulos

| Módulo | Funcionalidades |
|--------|----------------|
| **CRM** | Clientes, contactos, grupos, estadísticas |
| **Almacén** | Artículos, familias, stock, movimientos, inventario, lotes |
| **Ventas** | Presupuestos → Pedidos → Albaranes |
| **Facturación** | Facturas, cobros, generación PDF, rectificativas |
| **Compras** | Proveedores, pedidos, albaranes, facturas |
| **Contabilidad** | Plan contable, asientos, diarios |
| **TPV** | Caja, tickets, búsqueda por código de barras |
| **RRHH** | Empleados, contratos, ausencias, nóminas |
| **Dashboard** | KPIs, gráficas, alertas en tiempo real |

## 🔄 Migración desde Eneboo

```bash
# 1. Exporta la BD de Eneboo (archivo .sqlite)
#    Eneboo: Herramientas → Base de datos → Exportar

# 2. Sube el archivo al servidor
scp eneboo.sqlite usuario@servidor:/opt/erp-web/migration/

# 3. Ejecuta la migración
cd /opt/erp-web
docker compose exec backend node /app/migration/migrate-eneboo.js --db /app/migration/eneboo.sqlite

# 4. Verifica los datos migrados
docker compose exec backend npx prisma studio
```

**Datos que se migran:**
- ✅ Clientes y contactos
- ✅ Proveedores
- ✅ Artículos y familias
- ✅ Formas de pago
- ✅ Facturas de clientes (con líneas)
- ✅ Stock actual

## 🔧 Comandos de Gestión

```bash
# Ver estado de servicios
docker compose ps

# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar un servicio
docker compose restart backend

# Backup de la base de datos
docker compose exec postgres pg_dump -U erp_user erp_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U erp_user erp_db < backup.sql

# Actualizar el ERP
git pull
docker compose up -d --build

# Acceder a Prisma Studio (gestión BD)
docker compose exec backend npx prisma studio --port 5555
```

## 🔐 Usuarios y Roles

| Rol | Permisos |
|-----|---------|
| `SUPERADMIN` | Todo el sistema |
| `ADMIN` | Todo excepto configuración avanzada |
| `CONTABLE` | Facturación, cobros, contabilidad |
| `COMERCIAL` | CRM, ventas, presupuestos |
| `ALMACENERO` | Artículos, stock, almacén |
| `CAJERO` | TPV únicamente |
| `EMPLEADO` | Solo su perfil |

## 📧 Configuración Email

En el archivo `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@empresa.com
SMTP_PASS=tu_app_password_google
```

## 🔒 SSL/HTTPS

```bash
# Con dominio propio
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática (ya configurada por certbot)
systemctl status certbot.timer
```

## 📊 Estructura del Proyecto

```
erp-web/
├── backend/                # API REST Node.js + TypeScript
│   ├── src/
│   │   ├── modules/        # Módulos del ERP (auth, clientes, facturas...)
│   │   ├── middleware/     # Auth, errores, rate limiting
│   │   ├── config/         # DB, Redis
│   │   └── utils/          # Logger, helpers
│   └── prisma/
│       └── schema.prisma   # Esquema completo de BD
├── frontend/               # React + TypeScript + Tailwind
│   └── src/
│       ├── pages/          # Páginas por módulo
│       ├── components/     # Componentes UI reutilizables
│       ├── hooks/          # React hooks (auth, data)
│       └── services/       # API client
├── migration/              # Scripts de migración Eneboo
├── nginx/                  # Configuración Nginx
├── scripts/                # Scripts de instalación
├── docker-compose.yml      # Orquestación de servicios
└── .env.example            # Variables de entorno
```

## 🆘 Soporte y Problemas Comunes

**La app no carga:**
```bash
docker compose logs nginx
docker compose logs frontend
```

**Error de base de datos:**
```bash
docker compose logs postgres
docker compose exec backend npx prisma migrate status
```

**Resetear contraseña admin:**
```bash
docker compose exec backend node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
bcrypt.hash('NuevaPass123!', 12).then(h =>
  p.usuario.updateMany({where:{rol:'SUPERADMIN'}, data:{password:h}})
).then(console.log);
"
```
