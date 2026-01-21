# nested Example

This folder contains nested folders and modules that demonstrate how to organize API endpoints in a hierarchical structure. This pattern allows:

- Grouping related operations in subfolders for better organization
- Creating deep, discoverable API surfaces that mirror your file structure

## Structure

### date/ folder

Contains date utility functions:

```js
api.nested.date.today(); // '2025-08-15'
```

## Use Case

By organizing your code this way, you can build scalable and maintainable APIs that reflect logical groupings in your project. The nested structure helps organize related functionality while maintaining clear API access paths.
