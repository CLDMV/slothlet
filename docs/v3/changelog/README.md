# V3 Changelog

This directory contains documentation for new features and changes introduced in Slothlet v3.x.

## Features

### New Configuration Options

- **[backgroundMaterialize](./background-materialize.md)** - Pre-load lazy modules during initialization for faster first access
  - Enables immediate type accuracy via `__type` property
  - Trade-off: slower initialization for faster first calls
  - Default: `false` (maintains lazy loading behavior)

### New Properties

- **[__type Property & TYPE_STATES](./type-property.md)** - Check actual implementation type of lazy modules
  - Returns `TYPE_STATES.UNMATERIALIZED` or `TYPE_STATES.IN_FLIGHT` for non-materialized modules
  - Returns `"object"`, `"function"`, etc. for materialized modules
  - Solves typeof limitation where lazy proxies always return `"function"`
  - Essential for testing and debugging lazy mode behavior

## Usage Summary

```javascript
import slothlet, { TYPE_STATES } from "@cldmv/slothlet";

// Pre-load modules for accurate types immediately
const api = await slothlet({ 
  dir: './api',
  mode: 'lazy',
  backgroundMaterialize: true
});

// Check actual type (not proxy target type)
console.log(typeof api.math);      // "function" (proxy target)
console.log(api.math.__type);      // "object" (actual impl)

// Check materialization state
if (api.logger.__type === TYPE_STATES.IN_FLIGHT) {
  console.log("Logger still loading...");
}
```

## Documentation Structure

Each feature has its own detailed documentation file:

- **Overview** - What the feature does
- **Problem** - What problem it solves (if applicable)
- **Solution** - How it works
- **Usage** - Code examples for ESM and CJS
- **Behavior** - Detailed behavior descriptions
- **Testing** - How to test the feature
- **Implementation** - Technical details and locations
- **Related** - Links to related features and docs

## Version History

- **v3.0.0** - Initial v3 release
  - Added `backgroundMaterialize` config option
  - Added `__type` property and `TYPE_STATES` symbols
  - Unified wrapper architecture improvements
