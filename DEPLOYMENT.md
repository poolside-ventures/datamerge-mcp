# Deployment Guide for DataMerge MCP HTTP Server

This guide covers deploying the DataMerge MCP server with HTTP/SSE transport to various platforms.

## Prerequisites

- Node.js 18+ installed
- DataMerge API key
- Git repository (for platform deployments)

## Local Development

### 1. Build the Project

```bash
npm install
npm run build
```

### 2. Run Locally

```bash
# Default port (3000)
npm run start:http

# Custom port
PORT=8080 npm run start:http
```

### 3. Test the Server

```bash
# Using curl
curl -H "Authorization: Token YOUR_DATAMERGE_API_KEY" http://localhost:3000/health

# Using the test script
./test-http-server.sh YOUR_DATAMERGE_API_KEY
```

## Railway Deployment

Railway is the easiest option for deploying the HTTP server.

### Quick Deploy

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize and deploy:
```bash
railway init
railway up
```

4. Set environment variable (optional, if you want a default token):
```bash
railway variables set DATAMERGE_API_KEY=your_api_key_here
```

5. Get your deployment URL:
```bash
railway status
```

### Configuration

The `railway.json` file is already configured with:
- Build command: `npm run build`
- Start command: `npm run start:http`
- Automatic restarts on failure

## Fly.io Deployment

### 1. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login

```bash
fly auth login
```

### 3. Create fly.toml

```toml
app = "datamerge-mcp"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "5s"
    restart_limit = 0
```

### 4. Deploy

```bash
fly launch
fly deploy
```

### 5. Set secrets (optional)

```bash
fly secrets set DATAMERGE_API_KEY=your_api_key_here
```

## Docker Deployment

### 1. Build the Image

```bash
docker build -t datamerge-mcp .
```

### 2. Run the Container

```bash
docker run -p 3000:3000 datamerge-mcp
```

### 3. Test

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/health
```

### 4. Push to Registry

```bash
# Tag for your registry
docker tag datamerge-mcp your-registry.com/datamerge-mcp:latest

# Push
docker push your-registry.com/datamerge-mcp:latest
```

## Google Cloud Run

### 1. Build and Push to Container Registry

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/datamerge-mcp
```

### 2. Deploy

```bash
gcloud run deploy datamerge-mcp \
  --image gcr.io/YOUR_PROJECT_ID/datamerge-mcp \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

Note: The `--allow-unauthenticated` flag allows public access. The service still requires Bearer token authentication at the application level.

## AWS App Runner

### 1. Create apprunner.yaml

```yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci
      - npm run build
run:
  runtime-version: 18
  command: npm run start:http
  network:
    port: 3000
  env:
    - name: NODE_ENV
      value: production
```

### 2. Deploy via AWS Console

1. Go to AWS App Runner console
2. Create a new service
3. Choose "Source code repository" or "Container registry"
4. Configure build settings using the apprunner.yaml
5. Set PORT to 3000
6. Deploy

## VPS Deployment (Ubuntu/Debian)

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone and Build

```bash
git clone your-repo-url datamerge-mcp
cd datamerge-mcp
npm ci
npm run build
```

### 3. Create Systemd Service

Create `/etc/systemd/system/datamerge-mcp.service`:

```ini
[Unit]
Description=DataMerge MCP HTTP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/datamerge-mcp
ExecStart=/usr/bin/node dist/cli-http.js
Restart=on-failure
Environment="PORT=3000"
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

### 4. Start the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable datamerge-mcp
sudo systemctl start datamerge-mcp
sudo systemctl status datamerge-mcp
```

### 5. Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/datamerge-mcp`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/datamerge-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Environment Variables

All deployment methods support the following environment variables:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)
- `DATAMERGE_API_KEY` - Optional default token (for testing only)

## Monitoring

### Health Check Endpoint

All platforms should monitor: `GET /health`

Expected response:
```json
{
  "status": "ok",
  "service": "datamerge-mcp"
}
```

### Logs

Monitor application logs for errors:

- **Railway**: `railway logs`
- **Fly.io**: `fly logs`
- **Docker**: `docker logs container-name`
- **Systemd**: `sudo journalctl -u datamerge-mcp -f`

## Security Considerations

1. **Always use HTTPS** in production
2. **Never hardcode tokens** in your application
3. **Rotate tokens regularly**
4. **Monitor access logs** for suspicious activity
5. **Rate limit** at the reverse proxy level
6. **Use environment variables** for sensitive data

## Troubleshooting

### Port Already in Use

```bash
# Change the port
PORT=8080 npm run start:http
```

### Authentication Failures

Verify your DataMerge token:
```bash
curl -H "Authorization: Token YOUR_DATAMERGE_API_KEY" https://api.datamerge.ai/auth/info
```

### SSE Connection Issues

- Ensure your reverse proxy supports SSE
- Check timeout settings (should be high for SSE)
- Verify firewall rules allow the connection

### Container Health Check Failing

Ensure the health endpoint is accessible:
```bash
docker exec container-name curl http://localhost:3000/health
```

## Support

For issues or questions:
- GitHub Issues: (update to your new repository)
- DataMerge API schema: http://api.datamerge.ai/schema

