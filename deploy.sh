#!/bin/bash
# Script de despliegue automatizado para taq.multibancaexpress.com en DigitalOcean Droplet
# Uso: bash deploy.sh

set -e

PORT=8520
DOMAIN="taq.multibancaexpress.com"

echo "🚀 Iniciando despliegue de Taquilla Web ($DOMAIN)..."
systemctl enable --now docker || true
systemctl enable --now nginx || true

echo "📦 Construyendo la imagen de Docker para taquilla-web..."
docker build -t taquilla-web-app .

echo "🛑 Deteniendo contenedor anterior si existe..."
docker stop taquilla-web-container 2>/dev/null || true
docker rm taquilla-web-container 2>/dev/null || true

echo "▶️ Iniciando nuevo contenedor en puerto dedicado $PORT..."
docker run -d \
  --name taquilla-web-container \
  -p 127.0.0.1:$PORT:80 \
  --restart always \
  taquilla-web-app

echo "⚙️ Configurando Nginx para $DOMAIN..."
rm -f /etc/nginx/sites-enabled/taq
rm -f /etc/nginx/sites-available/taq

cat << EOF > /etc/nginx/sites-available/taq
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/taq /etc/nginx/sites-enabled/taq
nginx -t
systemctl reload nginx

echo "🔒 Verificando/Aplicando Certificado SSL para $DOMAIN..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || echo "⚠️ Certbot finalizado."

nginx -t
systemctl reload nginx

echo "✅ Despliegue de Taquilla Web completado con éxito en https://$DOMAIN"
