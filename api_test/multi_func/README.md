# multi_func Example

This folder contains example modules that export multiple functions, including nested and flattened exports. This pattern allows:

- Direct calls to each function (e.g., `api.multi_func.alpha()`, `api.multi_func.beta()`)
- Grouping related operations in a single API endpoint

By organizing your code this way, you can keep related utilities together, making your API endpoints more discoverable and maintainable.
