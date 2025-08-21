# exportDefault Example

This folder contains an example module that exports both a default function and named methods. This pattern allows:

- Direct calls to the default export (e.g., `api.exportDefault()`)
- Access to named methods attached to the default export (e.g., `api.exportDefault.extra()`)
- Hybrid export patterns (default + named) from a single file

By organizing your code this way, you can keep related functionality together and make your API endpoints more discoverable and maintainable. For example, you might have a main handler as the default export and helper methods as named exports, all accessible from the same module.
