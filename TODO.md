# TODO List for Slothlet Project

## Current Active Action Items:

### 📚 Documentation & JSDoc Updates

**Status**: In Progress  
**Priority**: High  
**Problem**: Several documentation tasks remain incomplete, including tools folder JSDoc, formatting issues, and build pipeline verification.

- [x] Update JSDoc documentation for `api_tests/` folder (partially complete - core modules updated)
  - [x] Add comprehensive JSDoc to key API test modules (config.mjs, root-function.mjs, root-math.mjs, rootstring.mjs)
  - [x] Updated folder-specific modules (math/math.mjs, string/string.mjs, exportDefault/exportDefault.mjs)
  - [x] Updated utility modules (util/extract.mjs, nested/date/date.mjs)
  - [x] Updated JSDoc to follow slothlet standards with proper @module, @fileoverview, examples
- [x] ✅ **COMPLETED**: Update JSDoc documentation for `tools/` folder
- [x] ✅ **COMPLETED**: Fix documentation formatting for Kind, Returns, and Throws sections
  - **Problem**: Kind, Returns, and Throws information appears on the same line causing poor readability
  - **Example Issue**: `Kind: static method of @cldmv/slothlet Returns: Promise.<void> Resolves when shutdown is complete Throws: Error If recursive shutdown is detected or shutdown fails`
  - **Expected**: Each section (Kind, Returns, Throws) should be on separate lines with proper formatting
  - **Root Cause**: Template formatting in `docs/template.hbs` or `docs/helpers.cjs` needs line break adjustments
  - **Solution**: ✅ Fixed by adding proper spacing (`\n\n`) after **Kind** sections and **Returns** sections in `docs/helpers.cjs`
  - **Priority**: Medium - affects documentation readability but not functionality
  - **Status**: ✅ COMPLETED - All **Kind**, **Returns**, and **Throws** sections now have proper spacing
- [x] ✅ **COMPLETED**: Fix module hierarchy structure in documentation sections

  - **Problem**: Functions and objects were not properly nested under their parent modules in the generated documentation
  - **Root Cause**: Found in `docs/helpers.cjs` line 1176 - separator `* * *` was being inserted between namespace headers and their child modules, creating flat structure instead of proper nesting
  - **Solution**: Removed `output += '* * *\n\n';` line after namespace headers in `integratedModules` function
  - **Verification**: Documentation now shows proper hierarchical structure with namespaces immediately followed by their child modules without disruptive separators
  - **Priority**: High - affects documentation structure and navigation - ✅ RESOLVED

- [x] ✅ **COMPLETED**: Update JSDoc documentation for `src/` folder (excluding `lib/engine/` subfolder)
  - [x] Enhanced all helper files with comprehensive @fileoverview and function documentation
  - [x] Updated runtime.mjs with AsyncLocalStorage context management details
  - [x] Enhanced lazy and eager mode files with accurate API structure examples
  - [x] Updated main slothlet.mjs with comprehensive usage examples
  - [x] Fixed incorrect "not exported" comments in source files
  - [x] Added proper @internal/@public/@private annotations throughout
  - [x] Verified all examples work with current functionality
- [x] ✅ **COMPLETED**: Verify all test files in `tests/` folder work correctly after import updates
- [x] Create API documentation for each `api_tests/` subfolder in `docs/` folder based on JSDoc
- [x] Verify generated API docs match expected output
- [x] ✅ **COMPLETED**: Remove all README files inside `api_test/` folder after docs generation
- [x] Run full build script and verify `build:exports` is no longer needed
- [x] ✅ **COMPLETED**: Verify build pipeline works end-to-end

#### Template Development for JSDoc Module Conversion

**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Problem**: ✅ **SOLVED** - Completed conversion from `@namespace` to semantically correct `@module` declarations while maintaining output structure compatibility.

**Objective**: Convert JSDoc documentation from `@namespace` to semantically correct `@module` declarations while maintaining identical output structure.

**Key Achievements**:

- ✅ Implemented JSDoc naming conventions (`@name`, `@alias` tags)
- ✅ Created full path function titles (e.g., `api_test_mixed.interopCjs.testCrossCall`)
- ✅ Built custom Handlebars template with conditional logic for main vs sub-modules
- ✅ Developed helper functions for module name extraction and title formatting
- ✅ Created separated container module (`.jsdoc.mjs`) to eliminate duplication
- ✅ Fixed file discovery issues (`.jsdoc.mjs` not picked up by glob patterns)
- ✅ Resolved JSDoc parsing errors and syntax issues

**Current Architecture**:

- Main container: `api_tests/api_test_mixed/.jsdoc.mjs` with `@module api_test_mixed`
- Sub-modules: Individual files use `@namespace` + `@memberof module:api_test_mixed`
- Template: `docs/template.hbs` with `(and (eq kind "module") (not memberof))` logic
- Helpers: Custom functions in `docs/helpers.cjs` for naming and structure

#### Template Logic Enhancement for Hierarchical Module Support

**Status**: ✅ **COMPLETED**  
**Priority**: High  
**Problem**: JSDoc template treats modules with `/` notation (like `@cldmv/slothlet/runtime`) as separate modules rather than submodules, causing incorrect ordering and typedef duplication.

**RESOLVED Issues**:

- ✅ Runtime module appears before main slothlet module (wrong alphabetical ordering) - FIXED
- ✅ Removing `@memberof` fixes hierarchy but breaks children display - FIXED
- ✅ Adding `@memberof` fixes children but creates ordering issues - FIXED
- ✅ Typedefs appear duplicated across modules - FIXED
- ✅ Runtime constants not appearing in TOC - FIXED
- ✅ Constants showing wrong titles (full path instead of name) - FIXED
- ✅ Constants showing wrong kind ("static constant" instead of "export") - FIXED

**IMPLEMENTED Solutions**:

**1. ✅ Hierarchical Module Detection**

- Enhanced `normalizeMemberof()` function to handle both `/` and `.` separators
- Built module tree structure based on `/` notation depth
- Preserved correct parent-child relationships regardless of `@memberof` usage

**2. ✅ Smart Module Ordering Algorithm**

- Modules properly ordered by hierarchy depth
- Children appear in correct relationship to parents
- Slash-separated modules treated as separate modules (not nested)

**3. ✅ Template Helper Functions**

- Enhanced `integratedTOC()` and `integratedModules()` functions
- Added proper constants processing with export detection (`--` pattern)
- Implemented typedef filtering to prevent duplication
- Added cache system for performance optimization

**4. ✅ Constants and Exports Strategy**

- Constants with `--` pattern in memberof → grouped under "**Exports**" header
- Constants without `--` pattern → grouped under "**Constants**" header
- Typedefs only appear in modules where actually used
- Constants show simple names (not full module paths) and correct kind labels

**5. ✅ Enhanced Template Logic**

- Runtime constants properly appear in TOC under "**Exports**" header
- Typedefs only show in relevant modules (no duplication)
- Proper separation between slash-separated modules vs dot-separated members
- Constants documentation shows correct titles and kind labels

```hbs
  <!-- Render parent module with typedefs at first use -->
  {{else}}
  <!-- Render child module, reference parent typedefs -->
  {{/if}}
  {{/each}}
```

**Benefits**:

- ✅ Single template architecture maintained
- ✅ Automatic hierarchy detection for any `/` notation
- ✅ Correct parent → child ordering
- ✅ No typedef duplication
- ✅ Contextual typedef placement (first use)
- ✅ Supports both `.` (memberof) and `/` (separate module) patterns

**Implementation Priority**: After current JSDoc standardization completion

### ✅ Import Modernization

**Status**: Complete
**Priority**: High
**Problem**: ✅ **SOLVED** - Test files were using relative paths instead of namespace imports, TypeScript build pipeline had configuration issues.

**Solution**: Updated all imports to use namespace patterns and fixed TypeScript configuration.

- [x] Update all test files to use namespace imports instead of relative paths ✅
- [x] Fix TypeScript build pipeline with npx and rootDir configuration ✅
- [x] Resolve circular import issue in entry points ✅
- [x] Verify entry points work correctly ✅
- [x] Comprehensive testing validates all functionality ✅

### ✅ Build System Updates

**Status**: Complete
**Priority**: High
**Problem**: ✅ **SOLVED** - Index files needed to be auto-generated from slothlet.mjs exports to ensure consistency and avoid manual maintenance.

**Solution**: Created automated build process that scans source exports and generates both index.mjs and type definitions.

- [x] Audit `index.mjs` to ensure all exports from `src/slothlet.mjs` are re-exported ✅
- [x] Audit `index.cjs` to ensure all exports from slothlet core are available ✅ (uses proxy forwarding)
- [x] **COMPLETED**: Create build step to auto-generate index files from slothlet.mjs exports ✅
  - [x] Add script to scan `src/slothlet.mjs` for all exports ✅
  - [x] Auto-generate `index.mjs` with proper static export statements ✅
  - [x] Auto-generate `types/index.d.mts` type definitions to match ✅
  - [x] Add to npm scripts: `npm run build:exports` ✅
  - [x] Add to main build script ✅
  - [x] Exclude generated index files from TypeScript compilation ✅
- [x] Verify named exports are properly forwarded in both index files ✅
- [x] Test external module import to ensure all exports are accessible ✅
- [x] Update type definitions to match actual exports ✅

**Note**: ✅ **SOLVED** - Created `tools/build-exports.mjs` that automatically scans for exports and generates both `index.mjs` and `types/index.d.mts`. Now any new exports in `src/slothlet.mjs` will be automatically included when running `npm run build:exports`.

### ✅ Mixed CJS/ESM Live Bindings Implementation

**Status**: ✅ **COMPLETED**
**Priority**: High
**Problem**: ✅ **SOLVED** - Completed validation of mixed ESM/CJS interoperability and ensured proper context isolation between instances.

- [x] Implement CJS function wrapping with `_wrapCjsFunction()`
- [x] Add ~~context tracking system with `currentActiveInstance` and `withInstanceContext()`~~ ✅ **DEPRECATED** - Replaced with AsyncLocalStorage runtime
- [x] Update `_loadCategory()` to support `.cjs` and `.js` files from subdirectories
- [x] Fix CJS module export structure to avoid nested objects
- [x] Create comprehensive test infrastructure (`api_test_cjs/`, `api_test_mixed/`)
- [x] ✅ **COMPLETED**: Complete validation of mixed ESM/CJS interoperability
  - [x] Fix CJS context data not being passed correctly (shows `undefined`)
  - [x] ✅ **COMPLETED**: Validate CJS -> ESM cross-module calls via live bindings
  - [x] ✅ **COMPLETED**: Validate ESM -> CJS cross-module calls via live bindings
  - [x] ✅ **COMPLETED**: Test instance isolation between multiple mixed APIs
  - [x] ✅ **COMPLETED**: Run comprehensive test suite

### ✅ TypeScript Declaration Issue

**Status**: ✅ **SOLVED**
**Priority**: Medium
**Problem**: ✅ **RESOLVED** - TypeScript projects can now import `@cldmv/slothlet` correctly. Type definitions are properly configured and working.

**Solution**: TypeScript configuration is working correctly. The `types/index.d.mts` file is properly generated from JSDoc comments and package.json exports are correctly configured.

**Verification**:

- ✅ TypeScript compilation works: `npm run build:types`
- ✅ Full build pipeline works: `npm run build`
- ✅ Type definitions exist and are accessible in both `types/src/` and `types/dist/`
- ✅ Package.json exports correctly reference type files
- ✅ Import test successful: `import slothlet from '@cldmv/slothlet'`
- ✅ **BUILD VALIDATED**: Built TypeScript definitions tested with strict compilation (`tmp-tests/test-built-types.mts`)
- ✅ **TYPE SIGNATURES VALIDATED**: All parameter types, return types, and type extraction utilities work correctly
- ✅ **GENERATED TYPES TESTED**: JSDoc → TypeScript generation pipeline fully functional

**Action Items**:

- [x] Verify TypeScript exports configuration in package.json ✅
- [x] Update type definitions to include CJS live binding support ✅
- [x] ~~Add type definitions for new CJS functions (`getBindings()`, `withInstanceContext()`)~~ ✅ **DEPRECATED** - These functions were removed
- [x] Test TypeScript import in external projects ✅
- [x] Consider creating `.d.ts` fallback for CommonJS compatibility ✅

## Completed Features

### ✅ Core CJS Live Bindings Support

**Status**: Complete
**Priority**: High
**Problem**: ✅ **SOLVED** - Needed to implement CommonJS compatibility with live bindings and instance isolation.

**Solution**: Implemented comprehensive CJS support with context tracking, function wrapping, and proper module loading.

- [x] CJS context tracking system implemented
- [x] CJS function wrapping with instance isolation
- [x] CJS module loading from all directory levels
- [x] ~~Live bindings access via `require("../../index.cjs").getBindings()`~~ ✅ **DEPRECATED** - Replaced with AsyncLocalStorage runtime

### ✅ Private Function Documentation Filtering

**Status**: Complete
**Priority**: High

**Problem**: API.md was showing private functions such as `_loadSingleModule` and `callableApi` that should not be visible in public documentation.

**Root Cause**: The documentation generation helpers were not filtering out private/internal constants and functions in all code paths.

**Solution**:

- Enhanced `shouldIncludePrivate()` helper to properly detect both `@private` access and `@internal` custom tags
- Added private/internal filtering to constant processing in both `integratedTOC` and `integratedModules` functions
- Verified that functions were already properly filtered via `isCallableFunction()` checks

**Result**: Private functions like `_loadSingleModule` and `callableApi` are now properly excluded from generated API documentation unless `--private` flag is explicitly passed.

## Future Enhancements

### 📋 Potential Improvements

**Status**: Backlog
**Priority**: Low
**Problem**: Various enhancement opportunities identified for future development cycles.

- [x] ✅ **COMPLETED**: Performance optimization for mixed module loading
- [ ] Enhanced error handling for CJS/ESM interop failures
- [x] ✅ **COMPLETED**: Documentation updates for CJS live bindings usage
- [x] ✅ **COMPLETED**: Example projects demonstrating mixed CJS/ESM APIs
- [x] ✅ **COMPLETED**: Integration tests for complex nested module structures

## Technical Debt

### ✅ Fixed: License Prepend Script Issue

**Status**: Complete
**Priority**: High
**Problem**: ✅ **SOLVED** - License prepend script was corrupting `resolve-from-caller.mjs` by treating `"file://"` strings as line comments.

- **Root Cause**: Regex `/\/\/.*$/gm` was matching `//` inside strings and removing everything after it
- **Solution**: Improved comment removal logic to parse strings properly and only remove actual comments
- **Result**: Build process now works correctly without corrupting source files

### 🔧 Code Quality

**Status**: Backlog
**Priority**: Low
**Problem**: Various code quality improvements identified that would enhance maintainability and debugging.

- [x] ✅ **COMPLETED**: Add comprehensive JSDoc for all CJS-related functions
- [x] ✅ **COMPLETED**: Refactor file extension detection logic for maintainability
- [ ] Clean up debug logging statements

## Notes

### Mixed CJS/ESM Architecture

- **ESM Modules**: Use standard slothlet live binding imports

### Test Infrastructure

- `api_tests/api_test_cjs/`: Pure CJS test modules
- `api_tests/api_test_mixed/`: Mixed ESM/CJS test modules
