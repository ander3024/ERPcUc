#!/bin/bash
# ============================================
# SCRIPT DE INSTALACIÓN - ERP WEB
# Ubuntu 24.04 LTS
# ============================================
# USO: sudo bash install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# Verificar root
if [ "$EUID" -ne 0 ]; then
  error "Ejecuta como root: sudo bash install.sh"
fi

section "1. ACTUALIZANDO SISTEMA"
apt-get update -q && apt-get upgrade -y -q
apt-get install -y -q curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
log "Sistema actualizado"

section "2. INSTALANDO DOCKER"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $SUDO_USER
  log "Docker instalado"
else
  log "Docker ya está instalado: $(docker --version)"
fi

section "3. INSTALANDO NODE.JS 20"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  log "Node.js instalado: $(node --version)"
else
  log "Node.js ya instalado: $(node --version)"
fi

section "4. INSTALANDO HERRAMIENTAS"
npm install -g pm2 2>/dev/null
apt-get install -y nginx certbot python3-certbot-nginx
log "PM2 y Nginx instalados"

section "5. CONFIGURANDO FIREWALL"
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall configurado"

section "6. CLONANDO/COPIANDO ERP WEB"
ERP_DIR="/opt/erp-web"
if [ ! -d "$ERP_DIR" ]; then
  mkdir -p "$ERP_DIR"
  # Si tienes git repo:
  # git clone https://tu-repo/erp-web.git "$ERP_DIR"
  # Si subiste por SCP/SFTP:
  warn "Copia los archivos del ERP a: $ERP_DIR"
  warn "Puedes usar: scp -r ./erp-web/* usuario@servidor:$ERP_DIR/"
fi

section "7. CONFIGURANDO VARIABLES DE ENTORNO"
if [ ! -f "$ERP_DIR/.env" ]; then
  if [ -f "$ERP_DIR/.env.example" ]; then
    cp "$ERP_DIR/.env.example" "$ERP_DIR/.env"
    
    # Generar secrets automáticamente
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH=$(openssl rand -base64 64 | tr -d '\n')
    DB_PASS=$(openssl rand -base64 24 | tr -d '\n/+=' | head -c 32)
    REDIS_PASS=$(openssl rand -base64 24 | tr -d '\n/+=' | head -c 32)
    
    sed -i "s/CAMBIA_ESTA_PASSWORD_SEGURA_123!/$DB_PASS/g" "$ERP_DIR/.env"
    sed -i "s/CAMBIA_ESTA_REDIS_PASSWORD!/$REDIS_PASS/g" "$ERP_DIR/.env"
    sed -i "s/GENERA_UN_SECRET_SEGURO_AQUI/$JWT_SECRET/g" "$ERP_DIR/.env"
    sed -i "s/GENERA_OTRO_SECRET_SEGURO_AQUI/$JWT_REFRESH/g" "$ERP_DIR/.env"
    
    # Detectar IP del servidor
    SERVER_IP=$(hostname -I | awk '{print $1}')
    sed -i "s/TU_DOMINIO_O_IP/$SERVER_IP/g" "$ERP_DIR/.env"
    
    warn "¡IMPORTANTE! Edita $ERP_DIR/.env con tus datos de empresa:"
    warn "  - COMPANY_NAME, COMPANY_CIF, COMPANY_EMAIL"
    warn "  - SMTP_* para el correo"
    echo ""
    echo "Contraseña BD generada: $DB_PASS"
    echo "Guárdalas en lugar seguro"
  fi
fi

section "8. INICIANDO SERVICIOS DOCKER"
cd "$ERP_DIR"
if [ -f "docker-compose.yml" ] && [ -f ".env" ]; then
  docker compose up -d --build
  log "Servicios Docker iniciados"
  
  # Esperar a que la BD esté lista
  echo "Esperando a que PostgreSQL esté listo..."
  sleep 15
  
  # Ejecutar migraciones
  docker compose exec backend npx prisma migrate deploy 2>/dev/null || warn "Ejecuta las migraciones manualmente"
  
  log "Migraciones ejecutadas"
else
  warn "Copia primero los archivos del ERP a $ERP_DIR"
fi

section "9. CONFIGURANDO SSL (opcional)"
SERVER_IP=$(hostname -I | awk '{print $1}')
warn "Para configurar SSL con tu dominio, ejecuta:"
warn "  certbot --nginx -d tu-dominio.com"
warn ""
warn "Sin SSL, el ERP estará disponible en: http://$SERVER_IP"

section "✅ INSTALACIÓN COMPLETADA"
echo ""
echo "═══════════════════════════════════════════"
echo " ERP Web está listo en: http://$SERVER_IP"
echo "═══════════════════════════════════════════"
echo " Usuario inicial: admin@miempresa.com"
echo " Contraseña:      Admin1234!"
echo " ⚠️  CAMBIA LA CONTRASEÑA INMEDIATAMENTE"
echo "═══════════════════════════════════════════"
echo ""
echo "Comandos útiles:"
echo "  docker compose logs -f backend   # Ver logs"
echo "  docker compose restart           # Reiniciar"
echo "  docker compose down              # Parar"
echo "  docker compose up -d             # Iniciar"
echo ""
