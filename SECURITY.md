# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | ✅ Yes             |
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
- Be cautious with `mode: "vm"` - it provides isolation but is not a security boundary
- Consider the security implications of your specific use case

## Response Timeline

- Initial response: Within 48 hours
- Status update: Within 7 days
- Resolution timeline: Varies based on complexity

Thank you for helping keep Slothlet secure!
