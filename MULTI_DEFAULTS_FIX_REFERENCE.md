# Multi-Default Exports Fix - Reference Documentation

## Current Behavior (BEFORE FIX)

The `api_tests/api_test/multi_defaults/` folder contains:

- `key.mjs` with default export `sendKey()` + named exports `press()`, `getKeyCode()`
- `power.mjs` with default export `toggle()` + named exports `on()`, `off()`, `getState()`
- `volume.mjs` with default export `setVolume()` + named exports `up()`, `down()`, `mute()`

### Current API Structure:

```javascript
api.multi_defaults = {
  sendKey: [Function: sendKey] {
    getKeyCode: [Function: getKeyCode],
    press: [Function: press]
  },
  toggle: [Function: toggle] {
    getState: [Function: getState],
    off: [Function: off],
    on: [Function: on]
  },
  setVolume: [Function: setVolume] {
    down: [Function: down],
    mute: [Function: mute],
    up: [Function: up]
  }
}
```

### Problem:

Function names (`sendKey`, `toggle`, `setVolume`) don't clearly indicate which file they come from.

## Expected Behavior (AFTER FIX)

### Target API Structure:

```javascript
api.multi_defaults = {
  key: [Function: sendKey] {
    press: [Function: press],
    getKeyCode: [Function: getKeyCode]
  },
  power: [Function: toggle] {
    on: [Function: on],
    off: [Function: off],
    getState: [Function: getState]
  },
  volume: [Function: setVolume] {
    up: [Function: up],
    down: [Function: down],
    mute: [Function: mute]
  }
}
```

### Expected Usage:

```javascript
// Default exports become file-named functions
api.multi_defaults.key("ENTER"); // calls sendKey from key.mjs
api.multi_defaults.power(); // calls toggle from power.mjs
api.multi_defaults.volume(50); // calls setVolume from volume.mjs

// Named exports remain as properties
api.multi_defaults.key.press("ESC");
api.multi_defaults.power.on();
api.multi_defaults.volume.up();
```

## Success Criteria

1. ✅ **Multi-default exports work as expected** (file names become function names)
2. ✅ **All other API paths remain unchanged** (no regression in existing functionality)
3. ✅ **Both eager and lazy modes work correctly** (no value differences in debug output)
4. ✅ **Named exports still accessible** as properties on the file-named functions

## Test Commands

```bash
# Set development environment
$env:NODE_ENV='development'; $env:NODE_OPTIONS='--conditions=development'

# Run full debug to check for regressions
npm run debug

# Test specific multi_defaults behavior
node test-multi-defaults-before-fix.mjs

# Inspect complete API structure
node tools/inspect-api-structure.mjs api_test
```

## Reference Files

- `debug-output-before-fix.txt` - Complete debug output before implementing fix
- `api-structure-before-fix.txt` - Complete API structure before implementing fix
- `multi-defaults-current-behavior.txt` - Current multi_defaults behavior documentation
- `test-multi-defaults-before-fix.mjs` - Test script to verify current behavior
