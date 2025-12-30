# Contributing to Slothlet

Thank you for your interest in contributing to Slothlet!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test` and `npm run debug`
4. Run build: `npm run build`

## Making Changes

1. Create a feature branch from `master`
2. Make your changes
3. Add or update tests as needed
4. Ensure all tests pass: `npm test` and `npm run debug`
5. Ensure linting passes: `npm run lint`
6. Submit a pull request

## API Transformation Rules

When modifying API generation logic, refer to these technical documents:

- **[API-RULES.md](docs/API-RULES.md)** - Verified API transformation rules with examples and test cases
- **[API-RULES-CONDITIONS.md](docs/API-RULES-CONDITIONS.md)** - Complete reference of all 26 conditional statements in the source code

These documents ensure that any changes to API generation logic maintain consistency with existing behavior and don't introduce regressions.

## Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for new functions
- Ensure TypeScript types are accurate

## Testing

- Add tests for new functionality
- Ensure all existing tests continue to pass
- Run performance tests if making performance-related changes: `npm run test:performance`

## Questions?

Feel free to open an issue for questions or discussion before starting work on significant changes.
