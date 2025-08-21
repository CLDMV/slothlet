# string Example

This folder contains an example module that exports multiple related string functions as an object. This pattern allows:

- Direct calls to each string method (e.g., `api.string.upper(str)`, `api.string.reverse(str)`)
- Grouping related operations in a single API endpoint

By organizing your code this way, you can keep string manipulation utilities together, making your API endpoints more discoverable and maintainable.
