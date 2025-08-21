# objectDefaultMethod Example

This folder contains an example module that exports an object with a callable default method and additional named methods. This pattern allows:

- Direct calls to the default method (e.g., `api.objectDefaultMethod('msg')`)
- Access to named methods for specific behaviors (e.g., `api.objectDefaultMethod.info('msg')`, `api.objectDefaultMethod.warn('msg')`)
- Grouping related operations in a single API endpoint

By organizing your code this way, you can provide flexible API endpoints that support both general and specialized operations from one module.
