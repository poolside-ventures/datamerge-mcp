# Production Status

## 🚀 Deployment

**Production URL**: _To be determined for DataMerge MCP deployment_

**Status**: Not yet deployed

**Last Verified**: October 17, 2025

## Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/health` | GET | ✅ Yes | Health check endpoint |
| `/sse` | GET | ✅ Yes | SSE connection for MCP communication |
| `/messages?sessionId=<id>` | POST | ✅ Yes | Receive client messages |

## Testing Production

### Health Check (example for a future deployment)
```bash
curl -H "Authorization: Token YOUR_DATAMERGE_API_KEY" \
     https://your-datamerge-mcp-url/health
```

**Expected Response (once deployed):**
```json
{"status":"ok","service":"datamerge-mcp"}
```

### Connect to streamable endpoint
```bash
curl -N -H "Authorization: Token YOUR_DATAMERGE_API_KEY" \
     https://your-datamerge-mcp-url/
```

## Authentication

All endpoints require a DataMerge API key:
```
Authorization: Token <your-datamerge-api-key>
```

The same key is used for:
1. Authenticating to the MCP server
2. Making calls to the DataMerge API

## Configuration

- **Platform**: Railway
- **Runtime**: Node.js 20+
- **Module System**: ES Modules
- **Port**: Dynamically assigned by Railway
- **Auto-restart**: Enabled
- **Health Checks**: Enabled

## Version History

### v1.1.1 (Current)
- ✅ ES Module compatibility fixed
- ✅ Production deployment validated
- ✅ Live at Railway

### v1.1.0
- ✅ HTTP/SSE transport added
- ✅ Bearer token authentication
- ✅ Dual mode support (stdio + HTTP)

### v1.0.4
- ✅ Health check using real API endpoint
- ✅ Initial stdio version

## Monitoring

### Check Server Status
```bash
# Example once deployed (should return 401 without auth if server is up)
curl -I https://your-datamerge-mcp-url/health
```

### Railway Dashboard
```bash
railway open
railway logs
railway status
```

## Package Status

**npm Package**: `@datamerge/mcp`
**Latest Version**: 1.0.0
**Status**: In development

## Usage Example

### For AI Assistants (MCP Clients)

Configure your MCP client to connect to your deployment URL:

```json
{
  "mcpServers": {
    "datamerge": {
      "url": "https://your-datamerge-mcp-url/",
      "headers": {
        "Authorization": "Token YOUR_DATAMERGE_API_KEY"
      }
    }
  }
}
```

## Support

- **Issues**: (update to your new repository)
- **DataMerge Schema**: http://api.datamerge.ai/schema

## Security Notes

- ✅ All requests require authentication
- ✅ HTTPS enforced by Railway
- ✅ Bearer tokens not logged
- ✅ Session isolation per connection
- ⚠️ Consider adding rate limiting for high-traffic scenarios

## Next Steps

1. **Publish to npm**: `npm publish --access public`
2. **Tag release**: `git tag v1.1.1 && git push --tags`
3. **Monitor metrics**: Set up alerts in Railway dashboard
4. **Update docs**: Add to your main DataMerge documentation

## Deployment Commands

```bash
# View logs
railway logs --tail

# Check status
railway status

# Restart if needed
railway restart

# Update deployment
git push  # Auto-deploys via Railway
# OR
railway up  # Manual deploy from CLI
```

