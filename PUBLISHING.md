# Publishing to npm

## Prerequisites

1. npm account with publishing permissions
2. Logged in via `npm login`
3. All tests passing
4. Version bumped in package.json

## Pre-publish Checklist

- [ ] Version updated to 1.2.3
- [ ] Changelog updated
- [ ] README updated with production URL
- [ ] Code built successfully
- [ ] Tests passing
- [ ] Production deployment validated
- [ ] .npmignore/config files reviewed

## Verify Package Contents

```bash
# Dry run to see what will be published
npm pack --dry-run

# Or create actual tarball
npm pack
ls -la *.tgz
```

## Publish Steps

### 1. Login to npm

```bash
npm login
```

### 2. Run Tests

```bash
npm test
```

### 3. Build

```bash
npm run build
```

### 4. Publish

```bash
# For first-time public package
npm publish --access public

# For subsequent releases
npm publish
```

### 5. Verify

```bash
# Check it's published
npm view @datamerge/mcp

# Install and test
npm install -g @datamerge/mcp
datamerge-mcp-http
```

## Post-publish

1. Tag the release in git:
```bash
git tag v1.2.3
git push origin v1.2.3
```

2. Create GitHub/GitLab release with changelog

3. Announce on social media / docs site

## Unpublish (Emergency Only)

⚠️ Only use within 72 hours of publish

```bash
npm unpublish @datamerge/mcp@1.0.0
```

## Version Strategy

- **Patch (1.2.x)**: Bug fixes, documentation updates
- **Minor (1.x.0)**: New features, non-breaking changes
- **Major (x.0.0)**: Breaking changes

## Current Version

**1.0.0** - Initial DataMerge MCP port (stdio + HTTP/streamable)

## Next Steps

Consider for future versions:
- Rate limiting middleware
- Prometheus metrics
- Request logging
- CORS configuration
- WebSocket transport alternative
- OAuth support

