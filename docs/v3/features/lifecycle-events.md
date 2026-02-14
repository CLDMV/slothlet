# Lifecycle Events API

## Overview

Slothlet provides a public lifecycle event system that allows external code to subscribe to API events such as materialization completion and implementation changes. The lifecycle manager is accessible via `api.slothlet.lifecycle` and follows standard EventEmitter patterns.

## Public API

### Accessing the Lifecycle Manager

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy"
});

// Access lifecycle manager
api.slothlet.lifecycle
```

## Available Methods

### Subscribe to Events

**Standard EventEmitter Pattern:**

```javascript
// Using on() method
const handler = (data) => {
	console.log('Event received:', data);
};

api.slothlet.lifecycle.on('materialized:complete', handler);
```

**Alternative Subscription Pattern:**

```javascript
// subscribe() returns an unsubscribe function
const unsubscribe = api.slothlet.lifecycle.subscribe('materialized:complete', (data) => {
	console.log(`All ${data.total} modules materialized!`);
});

// Later, unsubscribe
unsubscribe();
```

### Unsubscribe from Events

**Standard EventEmitter Pattern:**

```javascript
const handler = (data) => console.log(data);

api.slothlet.lifecycle.on('impl:changed', handler);

// Later, unsubscribe using off()
api.slothlet.lifecycle.off('impl:changed', handler);
```

**Alternative Pattern:**

```javascript
const handler = (data) => console.log(data);

api.slothlet.lifecycle.subscribe('impl:changed', handler);

// Unsubscribe using unsubscribe() method
api.slothlet.lifecycle.unsubscribe('impl:changed', handler);
```

## Event Types

### materialized:complete

Emitted when all lazy modules have been materialized (requires `tracking.materialization: true`).

**Event Data:**
```javascript
{
	total: 15,           // Total number of lazy modules
	timestamp: 1708012345  // Unix timestamp
}
```

**Example:**
```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

api.slothlet.lifecycle.on('materialized:complete', (data) => {
	console.log(`✅ All ${data.total} modules loaded at ${new Date(data.timestamp).toISOString()}`);
});

// Wait for background materialization
await api.slothlet.materialize.wait();
```

### impl:changed

Emitted when a module implementation is changed (e.g., during hot reload or api.add() operations).

**Event Data:**
```javascript
{
	apiPath: "math.add",
	impl: [Function: add],
	source: "hot-reload",
	moduleID: "base_abc123",
	filePath: "/path/to/math.mjs"
}
```

**Example:**
```javascript
api.slothlet.lifecycle.on('impl:changed', (data) => {
	console.log(`🔄 Module reloaded: ${data.apiPath} from ${data.source}`);
});
```

### impl:created

Emitted when a new module implementation is created during initial load or api.add().

**Event Data:**
```javascript
{
	apiPath: "plugins.auth",
	impl: { login: [Function], logout: [Function] },
	source: "initial",
	moduleID: "plugins_xyz789",
	filePath: "/path/to/plugins/auth.mjs",
	sourceFolder: "/path/to/plugins"
}
```

**Example:**
```javascript
api.slothlet.lifecycle.on('impl:created', (data) => {
	console.log(`✨ New module loaded: ${data.apiPath}`);
});
```

### impl:removed

Emitted when a module implementation is removed.

**Event Data:**
```javascript
{
	apiPath: "plugins.oldModule",
	moduleID: "plugins_old123"
}
```

## Complete Example

```javascript
import slothlet from "@cldmv/slothlet";

// Create API with background materialization enabled
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

// Subscribe to materialization complete
api.slothlet.lifecycle.on('materialized:complete', (data) => {
	console.log(`✅ Materialization complete!`);
	console.log(`   Total modules: ${data.total}`);
	console.log(`   Timestamp: ${new Date(data.timestamp).toISOString()}`);
});

// Subscribe to module changes (for hot reload)
const changeHandler = (data) => {
	console.log(`🔄 Module changed: ${data.apiPath}`);
	console.log(`   Source: ${data.source}`);
};

api.slothlet.lifecycle.on('impl:changed', changeHandler);

// Track new modules being added
api.slothlet.lifecycle.on('impl:created', (data) => {
	console.log(`✨ New module: ${data.apiPath} (${data.moduleID})`);
});

// Wait for background materialization
await api.slothlet.materialize.wait();
console.log('All modules ready!');

// Later, clean up event listeners
api.slothlet.lifecycle.off('impl:changed', changeHandler);
```

## Integration with Background Materialization

The lifecycle event system integrates seamlessly with the background materialization feature:

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { 
		materialization: true  // Enable background materialization
	}
});

// Track progress
let loadedCount = 0;
api.slothlet.lifecycle.on('impl:created', () => {
	loadedCount++;
	console.log(`Loading... ${loadedCount} modules`);
});

// Know when everything is ready
api.slothlet.lifecycle.on('materialized:complete', (data) => {
	console.log(`✅ All ${data.total} modules loaded and ready!`);
});

// Optional: Wait programmatically
await api.slothlet.materialize.wait();
```

## Use Cases

### 1. Loading Indicators

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

showLoadingSpinner();

api.slothlet.lifecycle.on('materialized:complete', () => {
	hideLoadingSpinner();
});
```

### 2. Hot Reload Notifications

```javascript
api.slothlet.lifecycle.on('impl:changed', (data) => {
	notifyUser(`Module ${data.apiPath} was reloaded`);
});
```

### 3. Module Registry

```javascript
const moduleRegistry = new Map();

api.slothlet.lifecycle.on('impl:created', (data) => {
	moduleRegistry.set(data.apiPath, {
		moduleID: data.moduleID,
		filePath: data.filePath,
		loadedAt: Date.now()
	});
});

api.slothlet.lifecycle.on('impl:removed', (data) => {
	moduleRegistry.delete(data.apiPath);
});
```

### 4. Performance Monitoring

```javascript
const startTime = Date.now();
let moduleCount = 0;

api.slothlet.lifecycle.on('impl:created', () => {
	moduleCount++;
});

api.slothlet.lifecycle.on('materialized:complete', (data) => {
	const duration = Date.now() - startTime;
	console.log(`Loaded ${data.total} modules in ${duration}ms`);
	console.log(`Average: ${(duration / data.total).toFixed(2)}ms per module`);
});
```

## Configuration

### Enabling Background Materialization

To receive `materialized:complete` events, enable background materialization:

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { 
		materialization: true  // Enables background materialization and events
	}
});
```

**Shorthand:**
```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: true  // Same as { materialization: true }
});
```

### Without Background Materialization

Without background materialization, you'll still receive `impl:created` and `impl:changed` events as modules are accessed:

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy"
	// No tracking config - manual materialization only
});

// This will fire when the module is first accessed
api.slothlet.lifecycle.on('impl:created', (data) => {
	console.log(`Module accessed: ${data.apiPath}`);
});

// Access a module - triggers impl:created event
api.math.add(2, 3);
```

## Best Practices

1. **Always Clean Up Event Listeners:**
   ```javascript
   const handler = (data) => console.log(data);
   api.slothlet.lifecycle.on('impl:changed', handler);
   
   // Before shutdown
   api.slothlet.lifecycle.off('impl:changed', handler);
   await api.shutdown();
   ```

2. **Use Returned Unsubscribe Functions:**
   ```javascript
   const unsubscribe = api.slothlet.lifecycle.subscribe('materialized:complete', handler);
   
   // Automatic cleanup
   unsubscribe();
   ```

3. **Avoid Heavy Processing in Handlers:**
   ```javascript
   // ❌ Bad - blocks other handlers
   api.slothlet.lifecycle.on('impl:created', (data) => {
   	doExpensiveSync();
   });
   
   // ✅ Good - async processing
   api.slothlet.lifecycle.on('impl:created', async (data) => {
   	await processAsync(data);
   });
   ```

4. **Error Handling in Handlers:**
   ```javascript
   api.slothlet.lifecycle.on('impl:changed', async (data) => {
   	try {
   		await handleModuleChange(data);
   	} catch (error) {
   		console.error('Handler error:', error);
   		// Don't let errors crash the app
   	}
   });
   ```

## API Reference

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `on(event, handler)` | Subscribe to event (standard EventEmitter) | `Function` (unsubscribe function) |
| `off(event, handler)` | Unsubscribe from event | `void` |
| `subscribe(event, handler)` | Subscribe to event (alias) | `Function` (unsubscribe function) |
| `unsubscribe(event, handler)` | Unsubscribe from event (alias) | `void` |
| `emit(event, data)` | Emit event (internal use only) | `Promise<void>` |

### Event Data Schemas

#### materialized:complete
```typescript
{
	total: number;       // Total lazy modules materialized
	timestamp: number;   // Unix timestamp (milliseconds)
}
```

#### impl:created / impl:changed
```typescript
{
	apiPath: string;        // API path (e.g., "math.add")
	impl: any;              // The implementation (function or object)
	source: string;         // Source of change ("initial", "hot-reload", "lazy-materialization")
	moduleID: string;       // Unique module identifier
	filePath: string;       // Absolute path to source file
	sourceFolder?: string;  // Source folder path
}
```

#### impl:removed
```typescript
{
	apiPath: string;    // API path that was removed
	moduleID: string;   // Module identifier
}
```

## See Also

- [Background Materialization](./background-materialization.md)
- [Lazy Materialization Tracking](./lazy-materialization-tracking.md)
- [API Management](./api-management.md)
