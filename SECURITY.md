# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | ✅ Yes             |
| 2.x.x   | ❌ No (deprecated) |
| 1.x.x   | ❌ No (deprecated) |

## Reporting a Vulnerability

If you discover a security vulnerability in Slothlet, please report it responsibly:

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: [git+security@cldmv.net](mailto:git+security@cldmv.net)
3. Include detailed information about the vulnerability
4. Allow reasonable time for investigation and fixes

## Security Considerations

Slothlet dynamically loads and executes JavaScript modules. When using Slothlet:

- Only load modules from trusted sources
- Validate input when using `context` or `reference` objects
- Be cautious with any dynamic module loading paths passed to `api.slothlet.api.add()`
- Consider using [`api.slothlet.metadata`](docs/METADATA.md) to tag and authorize modules at runtime
- Validate context values before passing them to `api.slothlet.context.run()` or `api.slothlet.context.scope()`

## Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Resolution timeline: Varies based on complexity

Thank you for helping keep Slothlet secure!
