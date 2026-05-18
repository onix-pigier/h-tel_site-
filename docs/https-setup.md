# Configuration HTTPS — Certbot / Let's Encrypt

Guide pour configurer un certificat SSL/TLS gratuit avec Let's Encrypt pour le domaine `Hôtel.ci`.

## Prérequis

- Un serveur Linux (Ubuntu 22.04+) avec accès root
- Un nom de domaine pointant vers l'IP du serveur (DNS A record)
- Nginx installé comme reverse proxy
- L'application Next.js tournant sur le port 3000

## 1. Installer Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

## 2. Configuration Nginx (reverse proxy)

Créer `/etc/nginx/sites-available/Hôtel.ci` :.

```nginx
server {
    listen 80;
    server_name Hôtel.ci www.Hôtel.ci;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/Hôtel.ci /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 3. Obtenir le certificat SSL

```bash
sudo certbot --nginx -d Hôtel.ci -d www.Hôtel.ci
```

Certbot modifiera automatiquement la config Nginx pour ajouter les directives SSL.

## 4. Renouvellement automatique

Certbot installe un timer systemd pour le renouvellement. Vérifier :

```bash
sudo systemctl status certbot.timer
```

Test de renouvellement :

```bash
sudo certbot renew --dry-run
```

## 5. Vérification

```bash
curl -I https://Hôtel.ci
```

Vérifier que :
- Le header `Strict-Transport-Security` est présent (déjà configuré dans `next.config.ts`)
- Le certificat est valide (cadenas vert dans le navigateur)

## 6. Variables d'environnement (production)

Mettre à jour `.env` en production :

```env
NEXTAUTH_URL="https://Hôtel.ci"
```
