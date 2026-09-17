#!/bin/bash
# ==============================================================================
# Script de Reparación Inmediata de Certificados SSL y Nginx
# Corrige el error ERR_CERT_COMMON_NAME_INVALID en:
# - crm.multibancaexpress.com (puerto 8530)
# - taq.multibancaexpress.com (puerto 8520)
# ==============================================================================

set -e

echo "🔧 Reparando configuración SSL para crm.multibancaexpress.com y taq.multibancaexpress.com..."

# 1. Configuración de CRM Operadora
cat << 'EOF' > /etc/nginx/sites-available/crm
server {
    listen 80;
    listen [::]:80;
    server_name crm.multibancaexpress.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name crm.multibancaexpress.com;

    ssl_certificate /etc/letsencrypt/live/crm.multibancaexpress.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.multibancaexpress.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8530;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:8530;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

# 2. Configuración de Taquilla POS
cat << 'EOF' > /etc/nginx/sites-available/taq
server {
    listen 80;
    listen [::]:80;
    server_name taq.multibancaexpress.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name taq.multibancaexpress.com;

    ssl_certificate /etc/letsencrypt/live/taq.multibancaexpress.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taq.multibancaexpress.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8520;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:8520;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

# 3. Enlazar configuraciones
ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
ln -sf /etc/nginx/sites-available/taq /etc/nginx/sites-enabled/taq

# 4. Validar sintaxis y recargar Nginx
echo "🔍 Validando sintaxis de Nginx..."
if nginx -t; then
    systemctl reload nginx
    echo "✅ ¡Nginx recargado con éxito! Ambos sitios ya tienen SSL configurado."
else
    echo "⚠️ Certificados en /etc/letsencrypt/live/ podrían requerir renovación/instalación con Certbot..."
    certbot --nginx -d crm.multibancaexpress.com --reinstall --redirect --non-interactive --agree-tos --register-unsafely-without-email || true
    certbot --nginx -d taq.multibancaexpress.com --reinstall --redirect --non-interactive --agree-tos --register-unsafely-without-email || true
    nginx -t && systemctl reload nginx
fi

echo "=========================================================================="
echo "🎉 ¡Reparación SSL completada!"
echo "Accede a:"
echo "👉 https://crm.multibancaexpress.com"
echo "👉 https://taq.multibancaexpress.com"
echo "=========================================================================="
