# @cldmv/slothlet

<div align="center">
	<img src="https://github.com/CLDMV/slothlet/raw/HEAD/images/slothlet-banner.jpg" alt="Slothlet Logo">
</div>

**@cldmv/slothlet** is a sophisticated module loading framework that revolutionizes how you work with massive APIs in Node.js. Built for developers who demand smart, efficient module loading without compromising performance or developer experience.

Choose your loading strategy based on your needs: **lazy mode** loads modules on-demand for faster startup and lower memory usage, while **eager mode** loads everything upfront for maximum runtime performance and predictable behavior.

With our **copy-left materialization** in lazy mode, you get the best of both worlds: the memory efficiency of on-demand loading with near-eager performance on repeated calls. Once a module is materialized, it stays materialized-no re-processing overhead.

The name might suggest we're taking it easy, but don't be fooled. **Slothlet delivers speed where it counts**, with smart optimizations that make your APIs fly.

**🎉 Welcome to the future of module loading with Slothlet v3!**

> _Where sophisticated architecture meets blazing performance - slothlet is anything but slow._

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url] [![coverage]][coverage_url]

> [!NOTE]
> **🚀 Production Ready Modes:**
>
> - **Eager Mode**: Fully stable and production-ready for immediate module loading
> - **Lazy Mode**: Production-ready with advanced copy-left materialization and 2.2x faster startup (function calls within 6% of eager - essentially equal)

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 🎉 Introducing Slothlet v3.0

> [!IMPORTANT]
> **Slothlet v3.0 is a major release - the biggest since v2.0.**

v3 rebuilds Slothlet from the inside out with a **Unified Wrapper architecture** that delivers consistent, inspectable, hook-intercepted API proxies across every loading mode. On top of this foundation comes a redesigned hook system with three-phase subset ordering, per-request context isolation improvements, a full internationalization layer, background materialization with progress tracking, granular API mutation controls, collision modes for runtime API management, and lifecycle events for every stage of the module lifecycle.

Every feature has been hardened with a comprehensive test suite - over **5,300 tests** across eager, lazy, CJS, ESM, TypeScript, and mixed module scenarios.

📋 **[See the full v3.0 changelog](./docs/changelog/v3.0.md)** for the architecture rewrite, hook system redesign, i18n layer, background materialization, lifecycle events, collision modes, mutation controls, sanitization improvements, and context isolation upgrades.

---

## ✨ What's New

### Latest: v3.12.1 (July 2026)

- **Nested context protection (#207)** — `scope({ protect, owners })` now guards **nested** values, not just the top layer. A write to a nested field of a protected/owned key (`context.auth.userId = …`) previously slipped through the lock; it now throws `CONTEXT_KEY_PROTECTED` with the full path (e.g. `auth.userId`), across assignment, `delete`, `defineProperty`, and array mutators such as `push`. Guarding stays scoped to protected/owned keys — plain objects and arrays are wrapped, non-plain values (`Date` / `Map` / `Set`) returned raw — and a named owner can still write nested fields it owns.
- **`./devcheck` export now actually ships (#209)** — the export pointed at a file the npm `files` whitelist never included, so it threw `ERR_MODULE_NOT_FOUND` in installed copies and `generateBrowserAssets` mirrored a dead entry into every importmap. The file now ships (inert outside the source repo by its own guards), and the importmap generator skips any entry whose resolved target doesn't exist on disk.
- [View full v3.12.1 Changelog](./docs/changelog/v3/v3.12.1.md)

### Recent Releases

- **v3.12.0** (July 2026) — Security-and-observability: permission enforcement fails closed on an absent/forged caller (opt-out `permissions.failOpenOnAbsentCaller`), inter-module construction + class-instance methods are permission-checked, the engine-internal `handlers/`/`factories/` subpaths leave `exports`, an opt-in control-surface `seal()`, owner-locked/write-protected context keys via `scope({ protect, owners })`, `impl:warning`/`impl:error` diagnostic lifecycle events, and nested `shutdown`/`destroy` leaves no longer dropped ([Changelog](./docs/changelog/v3/v3.12.0.md))
- **v3.11.1** (June 2026) — OpenSSF Scorecard publishing fixed: the workflow calls the org reusable `reusable-scorecard.yml@v4` instead of an inline job whose composite checkout step failed Scorecard's publish-verification allowlist (CI-only, #173) ([Changelog](./docs/changelog/v3/v3.11.1.md))
- **v3.11.0** (June 2026) — Satellite split: non-base locales and TypeScript declarations move to the optional `@cldmv/slothlet-i18n` and `@cldmv/slothlet-types` packages (en-us-only lean core); loader `hidden` option (`.`/`__` hidden by default); browser-mode v8 coverage with an unbalanced-`v8 ignore` analyze gate ([Changelog](./docs/changelog/v3/v3.11.0.md))
- **v3.10.0** (June 2026) — Synthetic / in-memory leaves for `api.slothlet.api.add()` (inline function or export map, no temp file); hooks integrated with the permission system (gated registration/firing, owner-pinned, `pattern:type` selectors); browser importmap built from the full public export surface ([Changelog](./docs/changelog/v3/v3.10.0.md))

📚 **For complete version history and detailed release notes, see [docs/changelog/](./docs/changelog/) folder.**

---

## 🚀 Key Features

### 🎯 **Dual Loading Strategies**

- **Eager Loading**: Immediate loading for maximum performance in production environments
- **Lazy Loading**: Copy-left materialization with look-ahead proxies (2.2x faster startup, function calls equal to eager after materialization)

> [!IMPORTANT]
> **Function Call Patterns:**
>
> - **Lazy Mode**: ALL function calls must be awaited (`await api.math.add(2, 3)`) due to materialization process
> - **Eager Mode**: Functions behave as originally defined - sync functions are sync (`api.math.add(2, 3)`), async functions are async (`await api.async.process()`)

### ⚡ Performance Excellence

- **Startup Performance**: 2.2x faster startup in lazy mode (15.41ms vs 34.28ms)
- **Runtime Performance**: Function calls essentially equal between modes (9.99μs lazy vs 9.46μs eager - within 6% measurement noise)
- **Copy-left materialization**: Once loaded, modules stay materialized - no re-processing overhead
- **Zero dependencies**: Pure Node.js implementation
- **Memory efficiency**: Lazy mode loads modules on-demand, eager mode optimizes for predictable behavior

📊 **For comprehensive performance benchmarks and analysis, see [docs/PERFORMANCE.md](./docs/PERFORMANCE.md)**

### 🎣 **Hook System** _(redesigned in v3)_

Powerful function interceptor system with 4 hook types and three-phase subset ordering:

- **`before`** - Modify arguments or cancel execution (**must be synchronous**)
- **`after`** - Transform return values
- **`always`** - Observe final results (read-only; fires even on short-circuit)
- **`error`** - Monitor and handle errors with detailed source tracking

Each hook type supports three ordered execution **subsets**: `"before"` → `"primary"` (default) → `"after"`. Pattern matching, priority control, runtime enable/disable, and short-circuit support included.

🎣 **For complete hook system documentation, see [docs/HOOKS.md](./docs/HOOKS.md)**

### 🔐 **Permission System** _(new in v3.3, read-gated in v3.7)_

Path-based access control for inter-module API calls **and** data-value reads (v3.7+):

- **Glob pattern rules** — same `*`, `**`, `?`, `{a,b}` syntax as hooks
- **Most-specific-wins** — exact patterns override broad globs; tiebreak by registration order
- **Self-call bypass** — calls within the same source file always succeed
- **Read-level gating** _(v3.7)_ — terminal data-value reads (`Buffer`, `TypedArray`, `Date`, `Map`, primitives, …) checked against the rule set; on by default, `readGating: false` to opt out
- **Audit events** — `permission:denied`, `permission:allowed`, `permission:default`, `permission:self-bypass`
- **Runtime management** — `api.slothlet.permissions.addRule()`, `.removeRule()`, `.self.*`, `.global.*`, `.control.*`
- **Context conditions** _(v3.4)_ — optional `condition` field; accepts a plain object (deep leaf matching), function, or array (OR); evaluated against per-request ALS context

🔐 **For complete permission system documentation, see [docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** · 📐 **For condition syntax, see [docs/PERMISSIONS-CONDITIONS.md](./docs/PERMISSIONS-CONDITIONS.md)**

### 🌍 **Full Internationalization** _(new in v3)_

All error messages and debug output are translated. Supported languages: English (US/UK) · Spanish (Spain/Mexico) · French · German · Portuguese · Hindi · Japanese · Korean · Russian · Chinese (Simplified)

Only US English (`en-us`) ships built in; every other locale — including UK English (`en-gb`) — comes from the optional **`@cldmv/slothlet-i18n`** package installed alongside slothlet (auto-detected, nothing to import or configure). Configure the language via `i18n: { language: "es-mx" }` in your slothlet config. See **[docs/I18N.md](./docs/I18N.md)**.

### 🔄 **Context Propagation**

Automatic context preservation across all asynchronous boundaries:

- **Per-request isolation**: `api.slothlet.context.run(ctx, fn)` and `api.slothlet.context.scope(ctx)`
- **EventEmitter propagation**: Context maintained across all event callbacks
- **Class instance propagation**: Context preserved in class method calls
- **Zero configuration**: Works automatically with TCP servers, HTTP servers, and custom EventEmitters

🔄 **For context propagation details, see [docs/CONTEXT-PROPAGATION.md](./docs/CONTEXT-PROPAGATION.md)**

### 🔧 **Smart API Management**

- **Intelligent Flattening**: Clean APIs with automatic structure optimization (`math/math.mjs` → `api.math`)
- **Smart Naming**: Preserves original capitalization (`auto-ip.mjs` with `autoIP` → `api.autoIP`)
- **Advanced Sanitization**: Custom naming rules with glob and boundary patterns; `api.slothlet.sanitize()` at runtime
- **Hybrid Exports**: Support for callable APIs with methods, default + named exports

🏗️ **[Module structure](./docs/MODULE-STRUCTURE.md)** · 📐 **[API flattening](./docs/API-RULES/API-FLATTENING.md)** · 🔡 **[Sanitization](./docs/SANITIZATION.md)**

### 🔗 **Runtime & Context System**

- **Context Isolation**: Automatic per-request isolation using AsyncLocalStorage (default); switchable to live-bindings mode via `runtime: "live"` config option
- **Cross-Module Access**: `self`, `context`, and `instanceID` always available inside API modules via `@cldmv/slothlet/runtime` — works identically from `.mjs`, `.cjs`, `.ts`, and `.mts`
- **Mixed Module Support**: Seamlessly blend ESM and CommonJS modules
- **Copy-Left Preservation**: Materialized functions stay materialized

### 🌐 **Browser / Worker Mode** _(new in v3.9)_

Run slothlet in the browser, web workers, and Electron renderers — anywhere there is no filesystem:

- **Manifest-driven loading**: a build-time manifest replaces `readdir`; API leaves load via your `resolveModuleSpecifier`
- **One-call setup**: `generateBrowserAssets(apiDir)` returns both the API `manifest` **and** the `importmap` for slothlet's own modules, so consumers never hand-roll module resolution
- **Bundler-friendly**: bundled apps need only the manifest; raw-ESM pages and Electron renderers get the importmap too
- **Full parity**: `self`, hooks, permissions, metadata, i18n, lifecycle events, and api mutation all work in-browser (live-binding context manager)

🌐 **For complete browser-mode documentation, see [docs/BROWSER.md](./docs/BROWSER.md)**

### 🛠 **Developer Experience**

- **TypeScript-Friendly**: Comprehensive JSDoc annotations with auto-generated declarations — see **[docs/TYPESCRIPT.md](./docs/TYPESCRIPT.md)**
- **Configurable Debug**: Detailed logging via CLI flags or environment variables
- **Multiple Instances**: Parameter-based isolation for complex applications
- **Inspectable APIs**: `console.log(api.math)` and logical versioned paths like `console.log(api.auth)` show real module contents instead of proxy internals (v3+)
- **Development Checks**: Built-in environment detection with silent production behavior

---

## 📦 Installation

### Requirements

- **Node.js v22.0.0 or higher**

### Install

```bash
npm install @cldmv/slothlet
```

---

## 🚀 Quick Start

```javascript
import slothlet from "@cldmv/slothlet";

// Eager mode (default) — functions behave as originally defined
const api = await slothlet({
	dir: "./api",
	context: { user: "alice" }
});

const result = api.math.add(2, 3); // Sync stays sync
const asyncResult = await api.async.process(); // Async stays async
```

CommonJS works the same way: `const slothlet = require("@cldmv/slothlet")`.

**Lazy mode** with copy-left materialization — all calls awaited, ~2.2× faster startup:

```javascript
const api = await slothlet({ mode: "lazy", dir: "./api" });
const result = await api.math.add(2, 3); // ALL calls awaited in lazy mode
```

**Hooks**, **dynamic API extension** (`api.slothlet.api.add/remove/reload`), **per-request context** (`api.slothlet.context.run/scope`), and **lifecycle events** are all covered in the linked technical guides below.

---

## 📚 Configuration

The most-used options are summarized below. The complete reference — every option, every diagnostic, every deprecated alias — lives in **[docs/CONFIGURATION.md](./docs/CONFIGURATION.md)**.

| Option        | Type     | Default     | Description                                                                        |
| ------------- | -------- | ----------- | ---------------------------------------------------------------------------------- |
| `dir`         | `string` | `"api"`     | Directory to load API modules from                                                 |
| `mode`        | `string` | `"eager"`   | `"eager"` (load upfront) or `"lazy"` (on-demand with copy-left materialization)    |
| `runtime`     | `string` | `"async"`   | `"async"` (AsyncLocalStorage) or `"live"` (live-bindings)                          |
| `context`     | `object` | `{}`        | Per-request context — read via `import { context } from "@cldmv/slothlet/runtime"` |
| `hook`        | `mixed`  | `false`     | Enable hooks; see **[HOOKS.md](./docs/HOOKS.md)**                                  |
| `permissions` | `object` | `undefined` | Path-based access control; see **[PERMISSIONS.md](./docs/PERMISSIONS.md)**         |
| `i18n`        | `object` | `{}`        | Language for translated error/debug messages — see **[I18N.md](./docs/I18N.md)**   |

Also configurable: `apiDepth`, `hidden` (globs hiding files/folders from the API), `debug`, `reference`, `sanitize`, `backgroundMaterialize`, `api.collision`, `api.mutations`, `versionDispatcher`, `typescript`, plus diagnostics and lifecycle internals. All documented in **[CONFIGURATION.md](./docs/CONFIGURATION.md)**.

---

## 🔀 Loading Modes

| Mode                               | Startup       | Function calls                               | Best for                                   |
| ---------------------------------- | ------------- | -------------------------------------------- | ------------------------------------------ |
| **Eager** (default)                | Loads upfront | Sync stays sync, async stays async           | Production, predictable performance        |
| **Lazy**                           | 2.2× faster   | All calls awaited; materialized on first use | Large APIs, startup-sensitive apps         |
| **Lazy + `backgroundMaterialize`** | 2.2× faster   | Pre-warmed by background loader              | Best of both — lazy startup, eager runtime |

```javascript
// Lazy + background materialization
const api = await slothlet({ mode: "lazy", dir: "./api", backgroundMaterialize: true });
api.slothlet.lifecycle.on("materialized:complete", ({ total }) => console.log(`${total} modules ready`));
await api.slothlet.materialize.wait(); // optional: gate traffic on ready
```

📊 **Benchmarks & analysis: [docs/PERFORMANCE.md](./docs/PERFORMANCE.md)** · 🔀 **Visual pipeline diagram: [docs/MODULE-STRUCTURE.md#loading-pipeline-overview](./docs/MODULE-STRUCTURE.md#loading-pipeline-overview)** · ⚡ **Lifecycle events: [docs/LIFECYCLE.md](./docs/LIFECYCLE.md)**

---

## 🎣 Hooks

Four hook types (`before`, `after`, `always`, `error`) with three-phase subset ordering (`"before"` → `"primary"` → `"after"`), pattern matching, priority, and runtime enable/disable.

```javascript
const api = await slothlet({ dir: "./api", hook: true });

api.slothlet.hook.on("math.add:before", ({ args }) => [args[0] * 2, args[1] * 2], { id: "double" });
api.slothlet.hook.on("math.*:after", ({ result }) => result * 10, { id: "scale" });
api.slothlet.hook.on("**:always", ({ path, hasError }) => console.log(path, hasError));
api.slothlet.hook.on("**:error", ({ path, error, source }) => console.error(path, source.type, error));

const out = await api.math.add(2, 3); // hooks fire automatically
```

🎣 **Configuration, all four types, subsets, pattern syntax, management API: [docs/HOOKS.md](./docs/HOOKS.md)**

---

## 🔄 Per-Request Context

```javascript
// Scoped context for a single call
await api.slothlet.context.run({ userId: "alice", role: "admin" }, async () => {
	await api.database.query();
	await api.audit.log();
});

// Derived API with merged context
const scoped = api.slothlet.context.scope({ userId: "bob" });
await scoped.database.query();
```

Context propagates automatically through `EventEmitter` callbacks (TCP/HTTP servers, custom emitters), class methods, and every async boundary. Inside modules: `import { context, instanceID } from "@cldmv/slothlet/runtime"`.

🔄 **Full reference, isolation guarantees, merge strategies, TCP/HTTP examples: [docs/CONTEXT-PROPAGATION.md](./docs/CONTEXT-PROPAGATION.md)**

---

## 🔁 Hot Reload & Dynamic API

```javascript
await api.slothlet.api.add("plugins", "./plugins-folder"); // add at runtime
await api.slothlet.api.add("plugins.trusted", "./trusted", { metadata: { trusted: true } });
await api.slothlet.api.remove("oldModule"); // remove
await api.slothlet.api.reload("database.*"); // hot-reload
```

Collision modes (`merge` / `merge-replace` / `replace` / `skip` / `warn` / `error`) — independently configurable for initial load vs runtime `add()`. Mutation controls let you disable `add` / `remove` / `reload` in production. Eager vs lazy reload semantics differ (eager merges into the live wrapper; lazy resets to an unmaterialized proxy).

🔁 **Full reference: [docs/RELOAD.md](./docs/RELOAD.md)** · 🏷️ **Metadata system: [docs/METADATA.md](./docs/METADATA.md)**

---

## ⚡ Lifecycle Events

```javascript
api.slothlet.lifecycle.on("materialized:complete", ({ total }) => console.log(`${total} modules ready`));
api.slothlet.lifecycle.on("impl:created", ({ apiPath }) => {
	/* … */
});
api.slothlet.lifecycle.on("impl:changed", ({ apiPath }) => {
	/* reload notify */
});
api.slothlet.lifecycle.on("impl:removed", ({ apiPath }) => {
	/* cleanup */
});
```

Events: `materialized:complete`, `impl:created`, `impl:changed`, `impl:removed`. Public surface is `on` / `off` only.

⚡ **Full reference: [docs/LIFECYCLE.md](./docs/LIFECYCLE.md)**

---

## 📁 Module Structure

```text
api/
├── config.mjs              → api.config.*
├── math/
│   └── math.mjs            → api.math.*       (flattened — filename matches folder)
├── util/
│   ├── util.mjs            → api.util.*       (flattened methods)
│   ├── extract.mjs         → api.util.extract.*
│   └── controller.mjs      → api.util.controller.*
└── nested/date/date.mjs    → api.nested.date.*
```

API modules **must never import each other directly** — use the live-binding runtime:

```javascript
// ❌ WRONG — breaks lazy loading and context isolation
import { math } from "./math/math.mjs";

// ✅ CORRECT — always reflects current runtime state
import { self, context, instanceID } from "@cldmv/slothlet/runtime";

export const myModule = {
	async processData(input) {
		const r = self.math.add(2, 3);
		console.log(`[${instanceID}] caller=${context.userId}`);
		return `Processed: ${input}, Math: ${r}`;
	}
};
```

The same import works from `.mjs`, `.cjs` (via `require`), `.ts`, and `.mts` (TypeScript path fixed in v3.5.0).

🏗️ **[Module structure patterns](./docs/MODULE-STRUCTURE.md)** · 📐 **[All 13 API transformation rules](./docs/API-RULES.md)**

---

## 🛡 Error Handling

Slothlet v3 uses a rich `SlothletError` class with translated messages and contextual hints:

```javascript
try {
	await api.slothlet.api.add("plugins", "./dir");
} catch (error) {
	console.error(error.message); // Translated error message
	console.error(error.hint); // Contextual hint for resolution
	console.error(error.code); // Machine-readable error code
}
```

---

## 🏗️ Production & Development

- **Eager Mode**: Stable, battle-tested, maximum runtime performance
- **Lazy Mode**: Production-ready with copy-left optimization
- **Background Materialization**: Lazy startup + eager runtime performance
- **Mixed Module Loading**: ESM/CJS interoperability fully supported
- **Debug Mode**: i18n-translated logging via `--slothletdebug` flag or `SLOTHLET_DEBUG=true`
- **Source Detection**: Automatic `src/` vs `dist/` mode detection
- **API Inspection**: `console.log(api.math)` and versioned dispatcher paths show real module contents (v3+)

---

## 📚 Documentation

### Reference

- **[Configuration Reference](./docs/CONFIGURATION.md)** — every option with defaults, validation rules, and the `api.slothlet.diag.*` namespace
- **[Generated API Reference](./docs/generated/API.md)** — auto-generated from JSDoc; the complete public surface
- **[Changelog](./docs/changelog/)** — all release notes (v2 + v3)
- **[Migration Guide](./docs/MIGRATION.md)** — upgrading from v2.x

### Technical Guides

- **[Performance Analysis](./docs/PERFORMANCE.md)** — startup vs runtime benchmarks, memory analysis, materialization cost breakdown
- **[Hook System](./docs/HOOKS.md)** — 4 types, three-phase subsets, pattern matching, management API
- **[Permission System](./docs/PERMISSIONS.md)** — rules, glob patterns, self-call bypass, read gating, runtime management
- **[Permission Conditions](./docs/PERMISSIONS-CONDITIONS.md)** — `condition` field syntax: deep object matching, functions, OR arrays
- **[Context Propagation](./docs/CONTEXT-PROPAGATION.md)** — per-request isolation, EventEmitter / class propagation, merge strategies
- **[Lifecycle Events](./docs/LIFECYCLE.md)** — `materialized:complete`, `impl:*` events, subscription API
- **[Hot Reload & Dynamic API](./docs/RELOAD.md)** — `add`, `remove`, `reload`, collision modes, mutation controls, eager vs lazy semantics
- **[Versioning](./docs/VERSIONING.md)** — multi-version module dispatch, `versionDispatcher`, version metadata
- **[Metadata System](./docs/METADATA.md)** — function metadata tagging for security, authorization, auditing
- **[Module Structure](./docs/MODULE-STRUCTURE.md)** — organization patterns, examples, and the loading-pipeline diagram
- **[Sanitization](./docs/SANITIZATION.md)** — filename → property-name transformation rules
- **[TypeScript Support](./docs/TYPESCRIPT.md)** — fast mode (esbuild), strict mode (tsc), `.d.ts` generation
- **[Internationalization](./docs/I18N.md)** — supported languages and configuration
- **[Testing & Coverage](./docs/TESTING.md)** — measuring coverage of composition-loaded leaves in a consumer project (the `server.deps.inline` requirement)

### API Rules & Transformation

- **[API Rules](./docs/API-RULES.md)** — all 13 transformation rules with verified test examples
- **[API Rules Conditions](./docs/API-RULES/API-RULES-CONDITIONS.md)** — every conditional that controls API generation
- **[API Flattening](./docs/API-RULES/API-FLATTENING.md)** — flattening rules with decision tree

### Repo

- **[Agent Usage Guide](./AGENT-USAGE.md)** — for AI agents building Slothlet API folders
- **[Contributing](./CONTRIBUTING.md)** — contribution guidelines
- **[Security Policy](./SECURITY.md)** — security guidelines and reporting
- **[Test Documentation](./api_tests/)** — comprehensive test module examples

[![CodeFactor]][codefactor_url] [![npms.io score]][npms_url] [![npm unpacked size]][npm_size_url] [![Repo size]][repo_size_url]

---

## 🤝 Contributing

We welcome contributions! See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for guidelines.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 🔗 Links

- **npm**: [@cldmv/slothlet](https://www.npmjs.com/package/@cldmv/slothlet)
- **GitHub**: [CLDMV/slothlet](https://github.com/CLDMV/slothlet)
- **Issues**: [GitHub Issues](https://github.com/CLDMV/slothlet/issues)
- **Releases**: [GitHub Releases](https://github.com/CLDMV/slothlet/releases)

---

## 📄 License

[![GitHub license]][github_license_url] [![npm license]][npm_license_url]

Apache-2.0 © Shinrai / CLDMV

---

## 🙏 Acknowledgments

To my wife and children - thank you for your patience, your encouragement, and the countless hours you gave me to build this. None of it would exist without your support.

<!-- [github release]: https://img.shields.io/github/v/release/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717 -->
<!-- [github_release_url]: https://github.com/CLDMV/slothlet/releases -->

[npm version]: https://img.shields.io/npm/v/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_version_url]: https://www.npmjs.com/package/@cldmv/slothlet
[last commit]: https://img.shields.io/github/last-commit/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[last_commit_url]: https://github.com/CLDMV/slothlet/commits
[npm last update]: https://img.shields.io/npm/last-update/%40cldmv%2Fslothlet?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_last_update_url]: https://www.npmjs.com/package/@cldmv/slothlet
[codefactor]: https://img.shields.io/codefactor/grade/github/CLDMV/slothlet?style=for-the-badge&logo=codefactor&logoColor=white&labelColor=F44A6A
[codefactor_url]: https://www.codefactor.io/repository/github/cldmv/slothlet
[npms.io score]: https://img.shields.io/npms-io/final-score/%40cldmv%2Fslothlet?style=for-the-badge&logo=npms&logoColor=white&labelColor=0B5D57
[npms_url]: https://npms.io/search?q=%40cldmv%2Fslothlet
[npm downloads]: https://img.shields.io/npm/dm/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_downloads_url]: https://www.npmjs.com/package/@cldmv/slothlet
[github downloads]: https://img.shields.io/github/downloads/CLDMV/slothlet/total?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_downloads_url]: https://github.com/CLDMV/slothlet/releases
[npm unpacked size]: https://img.shields.io/npm/unpacked-size/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_size_url]: https://www.npmjs.com/package/@cldmv/slothlet
[repo size]: https://img.shields.io/github/repo-size/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[repo_size_url]: https://github.com/CLDMV/slothlet
[github license]: https://img.shields.io/github/license/CLDMV/slothlet.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_license_url]: https://github.com/CLDMV/slothlet/blob/HEAD/LICENSE
[npm license]: https://img.shields.io/npm/l/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_license_url]: https://www.npmjs.com/package/@cldmv/slothlet
[coverage]: https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FCLDMV%2Fslothlet%2Fbadges%2Fcoverage.json&style=for-the-badge&logo=vitest&logoColor=white
[coverage_url]: https://github.com/CLDMV/slothlet/blob/badges/coverage.json
[contributors]: https://img.shields.io/github/contributors/CLDMV/slothlet.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[contributors_url]: https://github.com/CLDMV/slothlet/graphs/contributors
[sponsor shinrai]: https://img.shields.io/github/sponsors/shinrai?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=EA4AAA&label=Sponsor
[sponsor_url]: https://github.com/sponsors/shinrai
