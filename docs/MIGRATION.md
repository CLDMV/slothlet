# Migrating from Slothlet v3 to v4

v4 renames most of the public surface so that every name says one thing and every group of options reads the same way. It also changes a handful of defaults and behaviours. Almost all of it is mechanical, and a tool does the mechanical part for you. This guide covers what the tool does, then every change you have to understand yourself, then the full tables of renames.

Coming from v2? Read [the v2 to v3 guide](./migration/v2-to-v3.md) first; v4 assumes you are on v3's names.

## Table of contents

- [Start here: the migrate tool](#start-here-the-migrate-tool)
- [Strictness: unknown names are errors](#strictness-unknown-names-are-errors)
- [Behaviour changes](#behaviour-changes)
- [Error and warning details](#error-and-warning-details)
- [Paths, kinds and caller objects in data](#paths-kinds-and-caller-objects-in-data)
- [Package entry points](#package-entry-points)
- [Upgrade notes carried from 3.25](#upgrade-notes-carried-from-325)
- [Reference tables](#reference-tables)
- [Removed items and their replacements](#removed-items-and-their-replacements)

## Start here: the migrate tool

```sh
npx @cldmv/slothlet-migrate            # dry run over the current folder: prints a diff and the findings
npx @cldmv/slothlet-migrate --write    # apply the rewrites
npx @cldmv/slothlet-migrate audit .    # list every v3 surface still in use, file:line with the v4 replacement
```

The migrate tool rewrites what it can prove from the code in front of it: `slothlet()` config objects, method calls and their options, permission rule targets, imports, error code strings compared with `err.code`, `slothlet.module.json` files and the `slothlet typegen` settings in `package.json`. Everything it cannot prove is reported with the file, line and v4 replacement instead of being guessed. See the [tool's README](../packaging/slothlet-migrate/README.md) for its options.

`slothlet-migrate audit <dir>` changes nothing. It lists each v3 name still present, including the data keys no rewrite can safely touch (event and lifecycle payload keys, hook context keys, error details, diagnostics shapes). It exits `1` when there are findings, `0` when clean, and `2` on a usage error or a file it could not parse; add `--json` for CI. Run it after `--write` until it is clean.

The tables at the end of this guide are generated from the same data files the tool reads, so the guide and the tool cannot disagree.

## Strictness: unknown names are errors

`slothlet()` checks its config against one schema. A key it does not list, at any depth, throws `INVALID_CONFIG_UNKNOWN_KEY` with `{ where, key, path }` and points to the migrate tool. The same strictness applies to method options. v3 names are not kept as aliases, so nothing stays half-migrated without notice: a config that boots on v4 is a v4 config.

Slothlet also refuses to treat a stray object as one of its own results. `api.slothlet.api.modules.add` only accepts discover results this instance produced; any other object is read as options and fails validation.

## Behaviour changes

These keep their old name or have no rename to find, so no search turns them up. Read each one.

### The init context is copied, and `context.set` exists

The object you pass as `context` to `slothlet()` is copied. Changing it afterwards no longer changes the live context. To change the instance context at runtime, call `api.slothlet.context.set(key, value)` or `context.set({ ... })`. A `run()` or `scope()`'s own keys still win over the instance context. `context.set` is host only unless a rule allows `slothlet.context.set`, and protected keys stay protected.

### Warnings are recorded per instance

Every warning an instance raises is created and recorded on that instance, whether or not it is printed. Read them with `api.slothlet.warnings.get()` and clear them with `api.slothlet.warnings.clear()`; both are always present and host only while permissions are on. `silent: true` in the config now only decides whether an instance's warnings reach the console.

`SlothletWarning.captured`, `SlothletWarning.clearCaptured()`, `SlothletWarning.suppressConsole` and `api.slothlet.diag.SlothletWarning` are gone. A warning raised outside any instance is only printed. Tests that asserted on captured warnings read `api.slothlet.warnings` instead.

### Permission control: `control.mode()` and `control.gating.read()`

The toggles fold into functions. `permissions.control.mode()` returns `"on"`, `"off"` or `"disabled"`; `mode("on" | "off")` (or `true` / `false`) switches and returns the new mode. `"strict"` is chosen in the config and cannot be entered or left later (`PERMISSION_STRICT_FIXED`); `"disabled"` can be left but not entered. `seal()` locks switching, not reading. `control.enable()`, `disable()`, the `enabled` and `mode` accessors, `readGating()` and `readGatingEnabled` are gone; `control.gating.read()` reads and `gating.read(boolean)` sets read gating. In the config, `permissions.enabled` is removed and `permissions.mode` accepts `true` / `false` as aliases of `"on"` / `"off"`.

### `api.remove` takes the path first

The scoped form is `api.slothlet.api.remove(apiPath, id)`, path first like every other form. The one-argument form is unchanged. There is no runtime check for the v3 order: a v3 call `remove("modA", "shop")` now reads as the path `modA` scoped to module `shop` and returns `false`. Search for scoped `remove` calls by hand, or let `slothlet-migrate audit` flag them.

### `hidden` globs can re-include with `!`

The built-in rule that hides `.`-prefixed and `__`-prefixed files and folders is now the bottom layer of `hidden`. Globs apply in order, the last match decides, and an entry no glob matches falls to the built-in rule. A `!` pattern re-includes (files and folders alike), a trailing `/` names folders only, and a name's leading `.` is part of the name. Reserved names are still refused. `scanHiddenFolders` and its deprecation code are removed; `hidden: ["!**/.*/", "!**/__*/"]` does what `scanHiddenFolders: true` did. The same applies to the `hidden` option of `api.add`. In the browser, `files.generate()` still leaves `.` and `__` entries out, so `!` there only reaches entries a hand-written manifest lists.

### `instance.id`

The runtime entries export a frozen `instance` whose `id` getter is the running instance's id, a real string inside a call and `undefined` outside one. `api.slothlet.instance.id` reads the instance's id. The `instanceID` runtime export (a Proxy) and `api.slothlet.instanceID` are removed. The `reload` option `keepInstanceID` is now `instance: "keep" | "new"`.

### i18n: `language.set`

`@cldmv/slothlet/i18n` has its own entry file exporting `init`, `language.{get,set}`, `t` and `translate`. `language.set(lang)` switches synchronously in Node, and for `en-us`, and returns a promise only where the load is asynchronous (the browser). `api.slothlet.i18n` has the same shape. `setLanguage`, `setLanguageAsync`, `getLanguage` and `initI18n` are gone from the public entry and from `api.slothlet.i18n`.

### `slothlet.module.json` format 2

v4 reads and validates format 2: `schema: 2`, `mount` (a string or an array of segments) and `base` replace `schemaVersion`, `mountPath` and `apiDir`. Format 1 files are still read: they are mapped to the v2 names and a translated deprecation warning is raised for each, so a published package keeps working. Migrate your own manifests with the tool; the table below lists the field renames. Discover and mount results report segments arrays and `version: { default, tag }`.

### Routines default to on

`routines` becomes a group. The array moves to `routines.entries`, and the bare-array form is no longer accepted. `routines.auto` (was `autoRoutines`) now defaults to `true`, so startup, shutdown and destroy cascades fire by themselves. `routines.stack` (was `stackRoutines`) now defaults to `true`: every module contributing the same routine name at one path runs, in mount order, and `false` keeps only the collision winner. If you relied on a routine not running, set the option to `false` explicitly.

### Lazy materialization takes a function

`loader.materialize` (was `backgroundMaterialize`) accepts `true`, `false` or a function. A function turns background materialization on and is called on `materialized:complete` with the event's payload, `{ total, at }`, at once if it has already completed. `api.slothlet.materialize.materialized` is `materialize.complete`.

`loader.materialize` is now the only switch for background loading. v3's `tracking: { materialization: true }` (and `tracking: true`) did the same thing and is removed: passing `tracking` throws `INVALID_CONFIG_UNKNOWN_KEY`. Use `loader: { materialize: true }`; `materialized:complete` fires whenever `loader.materialize` is on. The migrate tool rewrites it.

### Private members are decided by module

An `_` or `__` export is private to the module that owns it, not to its folder. Two modules that each have a `billing` folder no longer read each other's private members. `permissions.private.scope: "folder"` keeps the 3.x rule.

### `node()` replaces the `__` fields on nodes

Nodes carry no framework keys. `api.slothlet.node(target)` returns one frozen report: `path` (segments), `file`, `folder`, `module`, `mode`, load state, `callable`, `type` (`"function"`, `"data"` or `"namespace"`), `logical` on versioned nodes and `manifest` on package mounts. The v3 reads (`__type`, `__materialized`, `__metadata` and the rest) are listed under the `node-field` table below.

`api.slothlet.metadata.get` is synchronous and returns user metadata only (global, then the path chain, then the function). Its target is a path, a module id, a function or a versioned path such as `"v1.auth"`. The `getFor`, `getForVersion`, `setFor`, `setForVersion` and `removeFor` methods fold into `get`, `set` and `remove`. Dispatchers are called as `(versions, caller)`, where each version entry is `{ metadata, version: { tag, default, metadata } }`.

### Framework-private names moved off `_` and `__`

Names slothlet keeps for itself now use `____` (private) and `___` (callables). A module may export `_impl` or `_materialize` freely, and code that read slothlet's old `_impl`, `__state` or `_materialize` loses them. Only the prefix changed; the full list is under "Framework-private names".

### `hook.errors` and `reload` values

`hook.suppressErrors` is `hook.errors`, and `true` becomes `"suppress"`; `false` stays `false`. The `"type:pattern"` prefix form of `hook.on` is removed: write `"math.*:before"`. `api.collision` can still be written as `"<mode>"`, which means `{ mode }`.

### Strict mode, capabilities and the baseline

`permissions.mode` accepts `"strict"`: `"on"` plus a met baseline, fixed for the life of the instance. While permissions are on, built-in platform capabilities (`capability:code`, `capability:imports`, `capability:loader`) are refused to module code until a rule opens them. A rule that allows `**` opens none. The baseline checks and the capability list are in [PERMISSIONS.md](./PERMISSIONS.md#strict-mode-the-baseline-and-capabilities); `control.report()` shows the state. If you built functions from strings inside a module, add a `capability:code` rule for that leaf.

### Writes into another module's values follow its read and call rules

While permissions are on, a module that creates a member inside a value another module holds (a key on its data object or array, a static member on its class or function, a member on its class prototype) needs the access it would need to read or call that value; in v3 a member that did not exist yet could be created there under the default policy. Where a module needs to change another module's value, export a function on the owning module that makes the change and allow the caller to call it. See [PERMISSIONS.md](./PERMISSIONS.md#write-permissions).

### Live runtime: Node callbacks run in their own `run()`

On the live runtime, the callbacks of `fs`, `dns` and `crypto`'s callback APIs (`fs.readFile(file, cb)`, `dns.lookup(host, cb)`, `crypto.randomBytes(n, cb)`, …) now run in the `run()` / `scope()` flow and as the caller that made the call, as on the async runtime; in v3 they saw whatever context was active when they fired. A function reference taken before the first live instance keeps Node's own function and is not carried. The list is in [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md#concurrent-run-and-scope-flows-in-the-live-runtime).

Work a `run()` / `scope()` leaves running after its callback returns (a timer, an interval, a listener, a promise chain or module call nobody awaited) now keeps the run's context on the live runtime, as on the async runtime; in v3 it saw the instance's own context once the run had returned.

### Scope isolation defaults to full

`run()` and `scope()` now default to `isolation: "full"`. In v3 the default was `"partial"`: `self` inside a run was the instance's own, so a module writing `self.x = …` during a request changed the api for every later caller. Under `"full"` the run gets a `self` of its own, taken as it starts, and its `self` writes, checked as any write is, (top-level or deep, synchronous or after an `await`) stay in the run and are dropped when it ends. Everything else a run changes (permission rules, hooks, metadata, event and lifecycle subscriptions, the api tree) is the run's own in both modes.

```javascript
// api/counter.mjs
import { self } from "@cldmv/slothlet/runtime";
export function remember(value) {
	self.last = value;
}

// v3 (default "partial"): the write outlives the run
await api.slothlet.context.run({}, () => api.counter.remember(1));
api.last; // 1

// v4 (default "full"): the write stays in the run
await api.slothlet.context.run({}, () => api.counter.remember(1));
api.last; // undefined
```

To keep the v3 behaviour, opt back in for the instance or per call:

```javascript
const api = await slothlet({ base: "./api", scope: { isolation: "partial" } });

await api.slothlet.context.scope({ context: {}, isolation: "partial", fn: () => api.counter.remember(1) });
```

State a run needs to hand back belongs in its return value, not in `self`.

### Module code cannot import leaf files

An api file, or a lib file it loads, that imports, re-exports or requires another file of an api tree (a sibling, a file in another folder of the tree, a file of an `api.add()` mount) is refused with `MODULE_LEAF_IMPORT_REFUSED`, whatever the permission mode. In v3 the import loaded a second copy of the file, with its own module state. Move code two leaves share into a lib folder outside the api tree, and reach another leaf through `self`.

v3, a helper kept in the api tree and imported by its siblings:

```text
project/
└── api/
    ├── util/format.mjs    export const format = (p) => `${p.x},${p.y}`;
    ├── point/point.mjs    export const make = (x, y) => ({ x, y });
    └── report/report.mjs  import { format } from "../util/format.mjs";   // a leaf file
                           import { make } from "../point/point.mjs";     // a leaf file
                           export const report = (x, y) => format(make(x, y));
```

v4, the helper moved to `lib/` beside `api/`, and the sibling leaf reached through `self`:

```text
project/
├── lib/
│   └── format.mjs         export const format = (p) => `${p.x},${p.y}`;
└── api/
    ├── point/point.mjs    export const make = (x, y) => ({ x, y });
    └── report/report.mjs  (below)
```

```javascript
// api/report/report.mjs
import { self } from "@cldmv/slothlet/runtime";
import { format } from "../../lib/format.mjs"; // a lib file: loads

export const report = async (x, y) => format(await self.point.make(x, y));
```

If the host still needs `api.util.format`, keep a leaf that re-exports the lib file: `api/util/format.mjs` with `export { format } from "../../lib/format.mjs";`. A leaf importing a lib file is fine; other leaves still reach it through `self.util.format`, not by importing it.

- **Host code is exempt.** The host and its tests import leaf files as before, and a file no live instance composes is a lib file.
- **Apis shipped as npm packages are held to the same rule.** A package's leaf and lib files are refused a leaf file whether they name it by a relative path, the package's own name, an `#imports` entry or another package's bare specifier. Package authors move shared code into the package's lib folder the same way.
- **The refusal happens as the import resolves.** An eager build fails with the importing file's `MODULE_IMPORT_FAILED`, the refusal as its cause; in lazy mode the folder holding the file fails as it loads; an `import()` or `require()` inside a function fails when it runs.

In the browser no import is seen, so the refusal does not apply there: a module that imports a leaf file still gets a copy of the file of its own, as in v3, and that copy is never the leaf. The same code is refused under Node and under vite or vitest, so move it to `self` or a lib folder even when the browser build works. See [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md#leaf-files-are-not-imported).

### A run reads a snapshot of the instance as of its start

- v3: a `run()` / `scope()` read the instance live. A change the host or a module made after the run started (`api.x = …`, a member or a `Map` changed through the api) reached the open run, and data objects such as a `Map` or a `Date` were the instance's own objects inside it.
- v4: a run reads the api tree, every value reachable through it, the permission rules, hooks, metadata, versioning and the context as they were when it started. A run opened afterwards reads the new value. What a run writes stays in the run. Nothing is copied when a run opens; the instance saves an object just before it first changes it while a run is open.

```javascript
// api/settings.mjs
import { self, context } from "@cldmv/slothlet/runtime";
export const cfg = { n: 1 };
export function read() {
	return [context.region, self.settings.cfg.n];
}

// host
const api = await slothlet({ base: "./api", context: { region: "eu" } });
let release;
const gate = new Promise((resolve) => (release = resolve));
const pending = api.slothlet.context.run({ user: "alice" }, async () => {
	await gate;
	return api.settings.read();
});
api.slothlet.context.set({ region: "us" }); // after the run started
api.settings.cfg.n = 5; // after the run started
release();
await pending; // ["eu", 1]: the run reads the instance as of its start
api.settings.read(); // ["us", 5]
```

What to check:

- **Code that expects a run to see later changes.** A long-running run, such as a server's `listen()` called inside `run()`, keeps reading the instance as it was when the run opened, so it doesn't see later config. Open the server outside the run and open a run per request, or keep changing values in something the snapshot doesn't cover (a module's own variables, a live resource).
- **Identity checks on built-ins.** A `Map`, `Set`, `Date`, typed array and the like read in a run is the run's own copy, so `===` against the instance's object is `false`. Compare by content, or by key: a copied `Map` keeps the same key objects.
- **Emitters are shared.** An `EventEmitter` or `EventTarget` is the live object in every run: listeners, events and plain properties a run sets on it reach the instance.
- **Promises.** While a run of the instance is open, a promise a call returns is a new promise object that settles one microtask later with the same value. Code that compares a returned promise with `===`, or counts microtasks, sees the difference.
- **Outside the snapshot.** A module's own variables, `#private` methods, live resources and references kept from before the run are the objects themselves. The full list is in [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md#what-a-runs-snapshot-covers-and-what-it-doesnt).

### The host's `api` inside a run, and `run.self()`

Inside a run, `api` is the instance's api: a change the host makes through it in the run (a write, `Object.defineProperty`, `delete`, a closing, `Object.setPrototypeOf`) reaches the instance. To keep the host's changes in the run, use the run's own view, which `run.self()` and `scope({ self: true })` hand to the callback:

```javascript
await api.slothlet.context.run.self({ requestId: "req-123" }, (view) => {
	view.draft = "note"; // stays in the run
	api.saved = "note"; // reaches the instance
});
```

The view is what module code's `self` resolves to in that run. See [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md#apislothletcontextrunselfcontextdata-callback-args).

### `run()` and `scope()` are isolated in every permission mode

Every `run()` / `scope()` keeps its context and its callers to itself, on both runtimes, whatever `permissions.mode` says (no `permissions` config, `"off"`, `"disabled"`, `"on"` or `"strict"`). The permission mode decides only what code is allowed to do, not which flow it sees.

- v3: on the live runtime, two `run()` flows waiting at `await`s at the same time could see each other's context ([#889](https://github.com/CLDMV/slothlet/issues/889)), and how far a run was kept apart from code outside it depended on the permission mode.
- v4: no code sees or takes another flow's context, and each flow's calls report their own caller. The details, and the browser's one limit (the code after a bare `await` while flows interleave), are in [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md#code-that-enters-another-flow-by-itself-async-runtime).

### Process-wide hooks while an instance exists

Keeping flows apart in every mode needs a hook that Node runs for every promise and callback in the process, not only for slothlet's.

- v3: no `async_hooks` hook and no V8 promise hooks were installed.
- v4, async runtime: an `async_hooks.createHook()` hook is installed while any async-runtime instance exists, in every permission mode, and removed after the last one shuts down. Measured on Node 26, it adds about 0.9 µs per `await` of a `then()` outside every flow and about 1.3 µs inside a `run()` or a call, and about 0.9 µs / 3.2 µs per `setImmediate()` outside / inside.
- v4, live runtime in Node: V8's promise hooks (`v8.promiseHooks`, not `async_hooks`) are installed while any live instance exists, in every permission mode. They cost every promise job in the process about 0.15 µs, and a callback a flow registers through a patched boundary about 1 µs more.

A process with only live instances still makes no `async_hooks` hook and no `AsyncLocalStorage`. If another library in the process also installs hooks, both run.

### A thenable a `run()` callback returns settles inside the run

- v3: on the async runtime, a thenable that is not a native promise, returned from a `run()` / `scope()` callback, had its `then()` called after the run's store was left, so it read no run context.
- v4: the result is taken up inside the run on both runtimes. Native promises and plain values come back as before. `run()` and `scope()` always return a promise.

### A function is the same value in every run

- v3.24.0: a value a module made could come back as a Proxy with the permission system off, and nested data lost its identity ([#726](https://github.com/CLDMV/slothlet/issues/726)).
- v4: a function read through the api is the same value inside and outside a `run()` and in every run, so `emitter.off(fn)`, `Set` / `Map` keys and memoised lookups find it. Under `permissions.caller.attribution: "precise"` it is its module's one stand-in, the same in every run. A job a flow's own code hands Node (a promise reaction, a timer, an immediate, a microtask, a listener) still runs in that flow.

### There is no write without the read

With the permission system on, every module write that passes the ownership and write rules is also held to the read of the member it changes, as the read gate decides it: assignment, `defineProperty`, `delete`, `Reflect.set`, writes through a held node or view, class prototype members, data objects, and `api.add` / `api.remove` from module code.

- v3: a module could replace, redefine or delete a member it was refused a read of, and an explicit write grant passed a write without the read rules.
- v4: replacing a node is held to the read of every member beneath it; a deny on an object member of a module's data covers writes beneath it as it covers reads; giving a value a member it inherits or one the language reads by itself (`toJSON`, `toString`, `valueOf`, …) is held to the access of the value's path. A function member is held to the read too, so a `:call` deny keeps a module from calling a function, not from replacing it where a write rule grants that. A member that does not exist yet takes over nothing, and an accessor keeps the write rules alone. Permissions off or disabled are unchanged. See [PERMISSIONS.md](./PERMISSIONS.md#write-permissions).

If a module legitimately rewrites members it may not read, grant it with a `:write` rule, which grants the read as well (next section).

### Rule access levels: `:call`, `:read`, `:access`, `:write`, `:full`

A rule target's suffix now names which of a call, a read and a write the rule decides.

| Suffix    | Call | Read | Write |
| --------- | ---- | ---- | ----- |
| `:call`   | ✓    |      |       |
| `:read`   |      | ✓    |       |
| `:access` | ✓    | ✓    |       |
| `:write`  |      | ✓    | ✓     |
| `:full`   | ✓    | ✓    | ✓     |

- v3: a target without a suffix decided calls and reads, and `:write` decided writes alone.
- v4: a target with no suffix is `:access`, so call and read rules keep their meaning. A `:write` allow now grants the read as well as the write, so under `policy: "deny"` a `:write` grant alone lets its callers read and write those members; add a deny on the read where a writer must not read. A `:write` deny refuses the write alone, and a deny that takes the read away refuses the write too. `self.access()` and `global.check.access()` answer whether both the call and the read are allowed. See [PERMISSIONS.md](./PERMISSIONS.md#access-levels).

### A rule target with an unknown suffix is refused

- v3: a target whose suffix named no level and no hook type (`secret.**:wirte`) was kept as a rule on the literal target and matched no api path.
- v4: it throws `PERMISSION_RULE_INVALID` wherever a rule comes in: the config's `permissions.rules`, `rules.add`, a manifest, the `permissions` option of `api.add`, and rules module code registers. A `capability:` target takes no suffix check. Fix the spelling; an instance whose config carries such a rule does not start.
- v4 also refuses, with `PERMISSION_RULE_INVALID` in the same places, a target whose path holds a `:` of its own (`vault.secret:read:write`) or names no path before its suffix (`:write`). Both were accepted before and matched nothing.
- An `api.add` `permissions` option given as an array or a string, or with an `allow` / `deny` that is not an array, was ignored; v4 refuses it with `INVALID_ARGUMENT` before anything mounts.

### Code from before `restart()` is refused after it, with permissions on

- v3: a function, bound function, closure or method a module returned before `restart()` kept working afterwards with the rebuilt instance's rights.
- v4: while the permission system is on, everything such code does through `self` after the restart is refused with `PERMISSION_DENIED`, and so is a snapshot its call took, whether the host runs it outside any call or inside a `run()` / `scope()`. A `restart()` inside a run does the same for that run's copy. Read the member from `api` again (a held reference is re-pointed) to reach the new instance's code. `reload()` is not a restart: code from before a reload keeps working. With the permission system off, such code keeps working after a restart too.

A `run()` / `scope()` open across a `restart()` that fails is refused as after `shutdown()`: its modules' calls through `self` throw `CONTEXT_NOT_ACTIVE_SELF`. See [RELOAD.md](./RELOAD.md).

### `caller.capture: false` covers only code no module runs

`permissions.caller.capture: false` still turns off the reader identity a function read out of the api carries.

- v3: a reference invoked with no active caller was treated as the host's, wherever the call came from.
- v4: the opt-out restores host standing only for a reference invoked with no module code running, as when the host calls a reference a module handed it. A reference a module's own code invokes, a callback the module defined included, is still enforced as that module, and the async runtime treats a host call outside every flow as the live runtime does. See [PERMISSIONS.md](./PERMISSIONS.md#captured-references-remember-who-captured-them).

### `FOLDER_INVALID` text and the uncaught-error output

- The `FOLDER_INVALID` message no longer names v3's `dir`. It reads "Configuration error: the path must be a non-empty string that points to an existing folder. Received: …", in every language. Match on `err.code`, not on the text.
- The handler the package entry installs for an uncaught slothlet error prints the error's `cause` and `details` instead of v3's `originalError` and `context`. Update anything that parses that output.
- v3 registered that handler as an `uncaughtException` listener that rethrew every other error, so Node exited with code 7 even when the host had a handler of its own. v4 registers it as an `uncaughtExceptionMonitor`: a host with its own `uncaughtException` handler gets every error, a `SlothletError` included, and the readable output (with exit code 1) appears only when nothing else handles the error. Any other unhandled error ends the process as it would without slothlet.
- What to change: a supervisor, script or test that checks for exit code 7 now sees 1. An app with its own `uncaughtException` handler that used to be ended anyway now keeps running when the handler returns, as it does in plain Node; if it relied on that exit, call `process.exit()` in the handler.

### A member a module creates at runtime is owned by that module

- v3: a member module code created at runtime had no owner of its own; an object or function it created was recorded for the module owning the node it was written on.
- v4: the module that creates a member (a new key by assignment, `defineProperty`, `Reflect.set`, through a held node, or at the top of `self`) owns it, with what a created object holds. Removing that module removes the member, a scoped removal removes just that member, and a full reload keeps neither. A member placed through a write grant stays part of the subtree it was written into.

### Metadata with a cycle through an array is refused

- v3: metadata validation walked plain objects only, so a cycle through an array (or object → array → object) was accepted.
- v4: it throws `INVALID_ARGUMENT`, like a cycle through plain objects, at every entry point (config `metadata`, `api.add` metadata, `metadata.global` / `set`).

### Node 22 and the async context frame

With permissions on, an async-runtime instance checks that Node's `AsyncContextFrame` is on (the `async-context-frame` baseline check). It is on by default from Node 24.

- v3: no such check.
- v4 on Node 22: under `permissions.mode: "strict"` start Node with `--experimental-async-context-frame` (on the command line or in `NODE_OPTIONS`), or the instance does not start (`PERMISSION_BASELINE_UNMET`). Under `"on"` it starts and raises one `WARNING_PERMISSION_BASELINE_UNMET`. With permissions off or disabled, and on the live runtime, nothing is checked. On Node 24 and later the check fails only when Node runs with `--no-async-context-frame`.

### Reload instance IDs and `diag.inspect().runtime.running`

- v3: a full reload's instance ID was `<id>_reload_<time>`; `diag.inspect().runtime.running` was `false` inside `context.run()` / `scope()` on the async runtime and could read `true` in host code outside every call on the live runtime.
- v4: the ID is `<id>_reload_<time>_<random>`, claimed before the old one is let go; if it cannot be claimed the reload fails with `INSTANCE_ID_IN_USE` and the instance keeps working on its current ID. `runtime.running` is `true` exactly while code of the instance (a call, a `run()` / `scope()` callback, a load) runs. Don't parse instance IDs.

### Lazy mode under vitest needs the plugin

Under vitest, api files are loaded by vite, not by Node. Add the plugin from `@cldmv/slothlet/vite` to the vitest config so each instance gets its own copy of every api file and slothlet can tell which module loaded which file. Without it a test using lazy mode, or a module's helper outside its api folder, is refused, and `permissions.mode: "strict"` reports the `vitest-plugin` baseline check as unmet. The plugin is supported with the forks pool; the threads pool is refused. The setup is in [TESTING.md](./TESTING.md#per-instance-helpers-under-vitest-the-cldmvslothletvite-plugin).

## Error and warning details

`SlothletError` and `SlothletWarning` are constructed as `(code, details, { cause })`. The extra fields moved from `.context` to `.details` (the console label is "Details:"), `originalError` is gone in favour of the standard `cause`, and the `validationError` and `stub` flags are gone. The hint is always a translated sentence: detected from the cause when there is one, else the code's own hint, else none.

Detail keys follow the same words as the rest of the v4 data: `path` and `mount` are segments arrays, `module` is the module id, `file` and `folder` replace the path-flavoured names, and expected/received pairs describe mismatches. For example `CACHE_MODULEID_MISMATCH` reports `expected` and `received`, the `CHAIN_*` errors report `path[]` and `chain[]`, and the manifest name and version mismatches report `{ package, expected, received }`.

Many codes are renamed so that none names an option or a method that might be renamed again, and each family shares a prefix: `WARNING_*` for every warning, `PERMISSION_*` for permission errors, `TYPESCRIPT_*` for TypeScript errors and `CONTEXT_*` for context errors. The tool rewrites a code string it can prove is compared with `err.code` and reports the rest. The full list is in the code table below.

## Paths, kinds and caller objects in data

Every api path slothlet reports is a segments array: mounts, `path`, `logical`, `leaves()` entries, event payloads, error details, audit entries and `node().path`. Every path slothlet accepts takes a dotted string or an array, one element per segment. Messages join the segments for display. If you compared a reported path to a string, join it first.

- `kind` is `"function"`, `"data"` or `"namespace"` everywhere, with a `callable` boolean beside it where a namespace can also be called.
- `source` names the operation that caused an event in one word: `build`, `add`, `reload`, `materialize`, `mount`, `remove` or `create`. The error hook's object is `origin` and carries `{ at, hook, subset, stack, type }`; its time, like every `at`, is a number from `clock.now()`.
- One `caller` object appears everywhere (permission entries and audit, around hooks, the version dispatcher): `{ path, module, metadata, version }`, or `null` for a call from outside.
- Lifecycle, event and audit payloads use the v4 data words (`file`, `folder`, `module`, `path`, `instance`, `at`, `mount`, `found` and so on). `hasError` is dropped from always hooks (use `errors.length > 0`) and `errorType` is `class`.
- `diag.inspect()` and `context.diagnostics()` describe this instance only. In both, `context` means the context data and the manager's state sits under `runtime`. `diag.caches.get()` entries are `{ module, path, folder, mode, count, at }`.

The data-key table below lists each rename; the audit command reports every one it finds.

## Package entry points

Internals moved to package `#` imports and are no longer reachable by deep path. New and changed entry points: `@cldmv/slothlet/vite` (the vitest plugin), `@cldmv/slothlet/files` (the browser file list: `files.generate`, `importmap`, `assets`, `resolver`, `specifiers`, and `loader.files` in the config), `@cldmv/slothlet/sanitize`, `@cldmv/slothlet/i18n` and `@cldmv/slothlet/typegen` (`generateTypes` is `generate`). The export table lists every moved symbol.

## Upgrade notes carried from 3.25

These behaviours shipped in 3.25 and apply to anyone arriving from an older 3.x.

- A folder's only file with a default-export function is that function at the folder's path, whatever the file is called. `e/x.mjs` with `export default function run` gives `api.e()` and `api.e.helper()`, not `api.e.x()`. A class default export in such a file is `api.factory`, and `e/index.mjs` with a named default function is `api.e()`. Permission rules, hook patterns and routines for those paths move with them. A non-default export, a file with no default export, or a folder with two entries is unchanged.
- Call, write and hook rules prefer the more specific pattern of the same kind (kind, then literal segments, then layer, then order). With `allow ** → db.**` and `deny ** → db.write.**`, `db.write.x` is denied whichever was added first.
- A default-export `Error` or boxed primitive fronts the value as data: `instanceof Error` holds, `Object.keys` lists nothing extra, and a rule on `m.failure.toString` applies to nothing (a rule on `m.failure` or `m.failure.**` covers every member read).
- Module code that comes to hold one of slothlet's internal exports (a browser import by URL, a value the host passed in) is refused with `MODULE_INTERNAL_NOT_IMPORTABLE`.
- The `clock` option (`now`, `set`, `clear`) is how a test with fake timers moves slothlet's own time: `slothlet({ clock: { now: Date.now, set: setTimeout, clear: clearTimeout } })` after `vi.useFakeTimers()`.

## Reference tables

Everything below is generated from `packaging/slothlet-migrate/data`. Run `npm run docs:migration` to refresh it; `npm run docs:migration:check` fails when it is out of date. The change column uses: renamed (same parent), moved (new parent), removed, new, folded (several v3 names became one) and behaviour (same name, new behaviour or default). Where a v4 cell is empty, there is no replacement and the note says what to do.

### Config

Keys of the object passed to `slothlet()`, as dotted paths.

<!-- migration-table:config:start -->

| v3                                     | v4                               | Change    | Notes                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowMutation`                        | —                                | removed   | v2 mutation lock (warned V3\_CONFIG\_DEPRECATED). Use api.mutations.{add,remove,reload}: false.                                                                                                                                                                                                                           |
| `api.collision`                        | `api.collision.mode`             | moved     | The value (string, or the per-phase { initial, api } form) moves one level down; api.collision becomes a group.                                                                                                                                                                                                           |
| `api.mutations.allowCollisionOverride` | `api.collision.override`         | moved     | Still gates the per-call collision options of api.add / modules.add.                                                                                                                                                                                                                                                      |
| `clock.clearTimeout`                   | `clock.clear`                    | renamed   | clock was added after v3.24.0 and never shipped under the old names; no migration needed for released code.                                                                                                                                                                                                               |
| `clock.setTimeout`                     | `clock.set`                      | renamed   | clock was added after v3.24.0 and never shipped under the old names; no migration needed for released code.                                                                                                                                                                                                               |
| `collectLifecycleHooks`                | —                                | removed   | Deprecated alias of autoRoutines. Use routines.auto (default true in v4).                                                                                                                                                                                                                                                 |
| `collision`                            | —                                | removed   | Root-level alias of api.collision (warned V3\_CONFIG\_DEPRECATED). Use api.collision.mode.                                                                                                                                                                                                                                |
| `apiDepth`                             | `depth`                          | renamed   |                                                                                                                                                                                                                                                                                                                           |
| `dir`                                  | —                                | removed   | Alias of base (warned V3\_CONFIG\_DEPRECATED). Use base.                                                                                                                                                                                                                                                                  |
| `hidden`                               | `hidden`                         | behaviour | A '!pattern' now re-includes entries hidden by the built-in ./\_\_ rule too (gitignore order: built-in hiding is the bottom layer, last match wins, files and folders alike; reserved names stay refused). Replaces scanHiddenFolders: its old effect is ["!\*\*/.\*/", "!\*\*/\_\_\*/"]. Same on api.add options.hidden. |
| `hook.suppressErrors`                  | `hook.errors`                    | renamed   | Value changes too: true → "suppress"; false stays false.                                                                                                                                                                                                                                                                  |
| —                                      | `loader`                         | new       | New group: how leaf files are found and loaded (import, manifest, materialize, platform, resolve).                                                                                                                                                                                                                        |
| `import`                               | `loader.import`                  | moved     |                                                                                                                                                                                                                                                                                                                           |
| `manifest`                             | `loader.files`                   | moved     | The browser file list is called `files` in v4. Giving one still selects browser mode.                                                                                                                                                                                                                                     |
| `manifest.files[].fullName`            | `loader.files.files[].full`      | moved     | Written by files.generate() (was generateManifest()); generator, resolver and validator change together.                                                                                                                                                                                                                  |
| `backgroundMaterialize`                | `loader.materialize`             | moved     | Also accepts a function in v4: true \| false \| fn. A function turns it on and is called on materialized:complete (at once if already complete).                                                                                                                                                                          |
| `tracking`                             | `loader.materialize`             | folded    | tracking: true and tracking: { materialization: true } did what loader.materialize: true does; v4 keeps only loader.materialize (tracking throws INVALID\_CONFIG\_UNKNOWN\_KEY). materialized:complete fires when loader.materialize is on.                                                                               |
| `platform`                             | `loader.platform`                | moved     | "node" \| "browser"; auto-detected when omitted.                                                                                                                                                                                                                                                                          |
| `resolveModuleSpecifier`               | `loader.resolve`                 | moved     |                                                                                                                                                                                                                                                                                                                           |
| —                                      | `permissions.caller`             | new       | New group: how the caller of a call or read is identified (anonymous, attribution, capture, ceiling, provenance).                                                                                                                                                                                                         |
| `permissions.failOpenOnAbsentCaller`   | `permissions.caller.anonymous`   | moved     | true = a call with no resolvable caller is let through.                                                                                                                                                                                                                                                                   |
| `permissions.attribution`              | `permissions.caller.attribution` | moved     | "precise" \| "fast".                                                                                                                                                                                                                                                                                                      |
| `permissions.references.capture`       | `permissions.caller.capture`     | moved     |                                                                                                                                                                                                                                                                                                                           |
| `permissions.references`               | —                                | removed   | Group dissolved; its only member, capture, moved to permissions.caller.capture.                                                                                                                                                                                                                                           |
| `permissions.ceiling`                  | `permissions.caller.ceiling`     | moved     | "leaf" \| "chain".                                                                                                                                                                                                                                                                                                        |
| `permissions.provenance`               | `permissions.caller.provenance`  | moved     |                                                                                                                                                                                                                                                                                                                           |
| `permissions.enabled`                  | —                                | removed   | Legacy boolean twin of mode. Use permissions.mode (true/false are now aliases of "on"/"off").                                                                                                                                                                                                                             |
| `permissions.events.default`           | `permissions.events.policy`      | renamed   | Same values: "deny" \| "notify" \| "allow".                                                                                                                                                                                                                                                                               |
| —                                      | `permissions.gating`             | new       | New group: every gating option (buffers, read).                                                                                                                                                                                                                                                                           |
| `permissions.typedArrayMembers`        | `permissions.gating.buffers`     | moved     | Added after v3.24.0; never shipped under the old name.                                                                                                                                                                                                                                                                    |
| `permissions.readGating`               | `permissions.gating.read`        | moved     |                                                                                                                                                                                                                                                                                                                           |
| `permissions.mode`                     | `permissions.mode`               | behaviour | Accepts true / false as aliases of "on" / "off" (enabled removed).                                                                                                                                                                                                                                                        |
| `permissions.defaultPolicy`            | `permissions.policy`             | renamed   |                                                                                                                                                                                                                                                                                                                           |
| —                                      | `permissions.private.scope`      | new       | "module" (default) \| "folder": what a module-private \_ / \_\_ export is private to. The default is "module": privacy follows the owning module id, not the file's folder.                                                                                                                                               |
| `routines`                             | `routines.entries`               | moved     | routines becomes a group. The array moves to routines.entries; the bare-array form is no longer accepted.                                                                                                                                                                                                                 |
| `autoRoutines`                         | `routines.auto`                  | moved     | Default changes false → true: startup / shutdown / destroy cascades fire by themselves.                                                                                                                                                                                                                                   |
| `stackRoutines`                        | `routines.stack`                 | moved     | Default changes false → true: every module contributing the same routine name at one path runs, in mount order; false = only the collision winner.                                                                                                                                                                        |
| `sanitize.lowerFirst`                  | `sanitize.first`                 | renamed   | Same option object is taken by @cldmv/slothlet/sanitize#sanitize.                                                                                                                                                                                                                                                         |
| `sanitize.preserveAllLower`            | `sanitize.preserve.lower`        | moved     |                                                                                                                                                                                                                                                                                                                           |
| `sanitize.preserveAllUpper`            | `sanitize.preserve.upper`        | moved     |                                                                                                                                                                                                                                                                                                                           |
| `sanitize.rules.leaveInsensitive`      | `sanitize.rules.nocase`          | renamed   |                                                                                                                                                                                                                                                                                                                           |
| `scanHiddenFolders`                    | —                                | removed   | Deprecated escape hatch (warned CONFIG\_SCAN\_HIDDEN\_FOLDERS\_DEPRECATED). Use hidden: ["!\*\*/.\*/", "!\*\*/\_\_\*/"].                                                                                                                                                                                                  |
| `suppressFixes`                        | —                                | removed   | Temporary v3 escape hatch for bug-fix behaviours (entries like "C03\_116"). No replacement.                                                                                                                                                                                                                               |
| `typescript.compilerOptions`           | `typescript.compiler`            | renamed   | tsconfig compilerOptions passthrough.                                                                                                                                                                                                                                                                                     |
| `typescript.types.interfaceName`       | `typescript.types.name`          | renamed   |                                                                                                                                                                                                                                                                                                                           |
| —                                      | `versioning`                     | new       | New group (dispatcher).                                                                                                                                                                                                                                                                                                   |
| `versionDispatcher`                    | `versioning.dispatcher`          | moved     |                                                                                                                                                                                                                                                                                                                           |
| `context`                              | `context`                        | behaviour | The init context is copied: mutating the object passed to slothlet() no longer changes the live context. Use api.slothlet.context.set().                                                                                                                                                                                  |
| `scope.isolation`                      | `scope.isolation`                | behaviour | Defaults to "full" (was "partial"): a self write made in run() / scope() stays in the run. Set scope: { isolation: "partial" } (or isolation: "partial" per call) to let it reach the instance again.                                                                                                                     |

<!-- migration-table:config:end -->

### Method options

Options and arguments of method calls, written `<method>(<argument>).<key>`.

<!-- migration-table:option:start -->

| v3                                                                    | v4                                                            | Change    | Notes                                                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api.slothlet.api.add(options).collisionMode`                         | `api.slothlet.api.add(options).collision.mode`                | moved     | Locked unless config api.collision.override is true.                                                                                                               |
| `api.slothlet.api.add(options).forceOverwrite`                        | `api.slothlet.api.add(options).collision.force`               | moved     | Not locked; a module id is generated when none is given.                                                                                                           |
| `api.slothlet.api.add(options).mutateExisting`                        | `api.slothlet.api.add(options).collision.mutate`              | moved     | Locked like collision.mode.                                                                                                                                        |
| `api.slothlet.api.add(options).hidden`                                | `api.slothlet.api.add(options).hidden`                        | behaviour | '!pattern' re-includes built-in hidden ./\_\_ entries (see config hidden).                                                                                         |
| `api.slothlet.api.add(options).moduleID`                              | `api.slothlet.api.add(options).id`                            | renamed   | Same word as reload(id) / remove(target, id).                                                                                                                      |
| `api.slothlet.api.add(options).recordHistory`                         | `api.slothlet.api.add(options).replay`                        | renamed   | true = reload() replays this add. Locked like collision.mode.                                                                                                      |
| `api.slothlet.api.add(options).scanHiddenFolders`                     | —                                                             | removed   | Per-call form of the removed config option. Use options.hidden with '!' patterns.                                                                                  |
| `api.slothlet.api.add(versionConfig)`                                 | `api.slothlet.api.add(options).version`                       | folded    | The 4th positional argument folds into options. api.add(path, source, options, { version: "v1" }) → api.add(path, source, { ...options, version: { tag: "v1" } }). |
| `api.slothlet.api.add(versionConfig).version`                         | `api.slothlet.api.add(options).version.tag`                   | moved     | The tag ("v1", "2.3.0").                                                                                                                                           |
| `api.slothlet.api.add(versionConfig).default`                         | `api.slothlet.api.add(options).version.default`               | moved     |                                                                                                                                                                    |
| `api.slothlet.api.add(versionConfig).metadata`                        | `api.slothlet.api.add(options).version.metadata`              | moved     | Stored in the version manager only.                                                                                                                                |
| `api.slothlet.api.leaves(options).includePrivate`                     | `api.slothlet.api.leaves(options).private`                    | renamed   | Host only.                                                                                                                                                         |
| `api.slothlet.api.modules.addDiscovered(options).collisionMode`       | `api.slothlet.api.modules.add(options).collision.mode`        | moved     | Method folds into modules.add() (no target).                                                                                                                       |
| `api.slothlet.api.modules.addDiscovered(options).filter`              | `api.slothlet.api.modules.add(options).discover.filter`       | moved     | Discover options nest under discover, the same object addModule took.                                                                                              |
| `api.slothlet.api.modules.addDiscovered(options).manifest`            | `api.slothlet.api.modules.add(options).discover.manifest`     | moved     |                                                                                                                                                                    |
| `api.slothlet.api.modules.addDiscovered(options).prefix`              | `api.slothlet.api.modules.add(options).discover.prefix`       | moved     |                                                                                                                                                                    |
| `api.slothlet.api.modules.addDiscovered(options).scanRoot`            | `api.slothlet.api.modules.add(options).discover.root`         | moved     |                                                                                                                                                                    |
| `api.slothlet.api.modules.addDiscovered(options).schema`              | `api.slothlet.api.modules.add(options).discover.schema`       | moved     |                                                                                                                                                                    |
| `api.slothlet.api.modules.addDiscovered(options).onFailure`           | `api.slothlet.api.modules.add(options).failure`               | renamed   | "throw" \| "rollback" \| "best-effort".                                                                                                                            |
| `api.slothlet.api.modules.addModule(options).collisionMode`           | `api.slothlet.api.modules.add(options).collision.mode`        | moved     | Method folds into modules.add(name \| result).                                                                                                                     |
| `api.slothlet.api.modules.addModules(options).collisionMode`          | `api.slothlet.api.modules.add(options).collision.mode`        | moved     | Method folds into modules.add([...]).                                                                                                                              |
| `api.slothlet.api.modules.addModules(options).onFailure`              | `api.slothlet.api.modules.add(options).failure`               | renamed   |                                                                                                                                                                    |
| `api.slothlet.api.modules.discover(options).scanRoot`                 | `api.slothlet.api.modules.discover(options).root`             | renamed   |                                                                                                                                                                    |
| `api.slothlet.api.remove(pathOrModuleId, apiPath)`                    | `api.slothlet.api.remove(target, id)`                         | behaviour | The scoped form swaps its arguments: v3 remove(moduleID, apiPath) → v4 remove(apiPath, moduleID). The one-argument form is unchanged (path or module id).          |
| `api.slothlet.hook.on(pattern)`                                       | `api.slothlet.hook.on(pattern)`                               | removed   | The "type:pattern" prefix form ("before:math.\*", warned HOOK\_TYPEPATTERN\_PREFIX\_DEPRECATED) is removed. Write "math.\*:before".                                |
| `api.slothlet.hook.on(options).lockCaller`                            | `api.slothlet.hook.on(options).pin`                           | renamed   | Same word as config hook.pin.                                                                                                                                      |
| `api.slothlet.hook.on(options).versionDispatcher`                     | `api.slothlet.hook.on(options).versioning.dispatcher`         | moved     |                                                                                                                                                                    |
| `api.slothlet.hook.on(options).versioned`                             | `api.slothlet.hook.on(options).versioning.enabled`            | moved     |                                                                                                                                                                    |
| `api.slothlet.permissions.addRule(rule)`                              | `api.slothlet.permissions.rules.add(rule)`                    | moved     | Rule fields unchanged; the method moved (see method rows).                                                                                                         |
| `api.slothlet.permissions.principal.register(definition).maxAge`      | `api.slothlet.permissions.principal.register(definition).ttl` | renamed   | Milliseconds until the value is resolved again.                                                                                                                    |
| `api.slothlet.reload(options).keepInstanceID`                         | `api.slothlet.reload(options).instance`                       | renamed   | Value changes: true → "keep", false → "new" (default "new").                                                                                                       |
| `@cldmv/slothlet/typegen#generateTypes(options).augmentRuntime`       | `@cldmv/slothlet/typegen#generate(options).augment`           | renamed   | CLI --no-augment-runtime → --no-augment.                                                                                                                           |
| `@cldmv/slothlet/typegen#generateTypes(options).dir`                  | `@cldmv/slothlet/typegen#generate(options).base`              | renamed   | Matches config base. CLI --dir → --base.                                                                                                                           |
| `@cldmv/slothlet/typegen#generateTypes(options).includeDocumentation` | `@cldmv/slothlet/typegen#generate(options).docs`              | renamed   |                                                                                                                                                                    |
| `@cldmv/slothlet/typegen#generateTypes(options).interfaceName`        | `@cldmv/slothlet/typegen#generate(options).name`              | renamed   | Matches config typescript.types.name. CLI --interface-name → --name.                                                                                               |

<!-- migration-table:option:end -->

### Methods

Every method path below hangs off `api.slothlet`, and the permission rule target for each is the same path without the leading `api.`.

<!-- migration-table:method:start -->

| v3                                                     | v4                                             | Change    | Notes                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.slothlet.api.modules.addModule`                   | `api.slothlet.api.modules.add`                 | folded    | add(name \| discoverResult) mounts one.                                                                                                                                                                                           |
| `api.slothlet.api.modules.addModules`                  | `api.slothlet.api.modules.add`                 | folded    | add([...]) mounts a batch.                                                                                                                                                                                                        |
| `api.slothlet.api.modules.addDiscovered`               | `api.slothlet.api.modules.add`                 | folded    | add() with no target (or only options) runs discover, sort and mount.                                                                                                                                                             |
| —                                                      | `api.slothlet.api.modules.cache`               | new       | Group for the discovery cache.                                                                                                                                                                                                    |
| `api.slothlet.api.modules.clearDiscoveryCache`         | `api.slothlet.api.modules.cache.clear`         | moved     | Empties the cache; unmounts nothing.                                                                                                                                                                                              |
| `api.slothlet.api.modules.getDiscoveryCache`           | `api.slothlet.api.modules.cache.get`           | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.api.modules.removeModule`                | `api.slothlet.api.modules.remove`              | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.api.modules.getStaleMounts`              | `api.slothlet.api.modules.stale`               | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.api.remove`                              | `api.slothlet.api.remove`                      | behaviour | Signature (target, id?): the scoped form swaps its arguments (see the option row).                                                                                                                                                |
| `api.slothlet.context.inspect`                         | —                                              | removed   | Typedef-only since 3.0.0, never built. context.get() returns the whole context.                                                                                                                                                   |
| —                                                      | `api.slothlet.context.set`                     | new       | (key, value) \| (object): changes the instance-level context every leaf reads; a run()/scope()'s own keys still win; host only unless a rule allows slothlet.context.set; protected keys enforced.                                |
| `api.slothlet.diag.getAPI`                             | `api.slothlet.diag.api`                        | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.diag.caches.getAllModuleIDs`             | `api.slothlet.diag.caches.ids`                 | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.diag.hook.compilePattern`                | `api.slothlet.diag.hook.compile`               | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.diag.owner`                              | `api.slothlet.diag.owner.get`                  | moved     | diag.owner becomes a group; the path lookup is owner.get(path).                                                                                                                                                                   |
| `api.slothlet.diag.getOwnership`                       | `api.slothlet.diag.owner.list`                 | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.diag.SlothletWarning`                    | —                                              | removed   | The class is exported from @cldmv/slothlet/errors. Captured warnings: api.slothlet.warnings.get().                                                                                                                                |
| —                                                      | `api.slothlet.warnings`                        | new       | This instance's captured warnings (capture is per instance).                                                                                                                                                                      |
| `@cldmv/slothlet/errors#SlothletWarning.captured`      | `api.slothlet.warnings.get`                    | moved     | The static is removed; capture is per instance and always present.                                                                                                                                                                |
| `@cldmv/slothlet/errors#SlothletWarning.clearCaptured` | `api.slothlet.warnings.clear`                  | moved     | Per instance.                                                                                                                                                                                                                     |
| `api.slothlet.event.resolveLevel`                      | `api.slothlet.event.level`                     | renamed   | Host only (built-in deny on slothlet.event.\*\*).                                                                                                                                                                                 |
| —                                                      | `api.slothlet.hook.pattern`                    | new       | Group for the runtime path filter.                                                                                                                                                                                                |
| `api.slothlet.hook.disablePattern`                     | `api.slothlet.hook.pattern.disable`            | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.hook.enablePattern`                      | `api.slothlet.hook.pattern.enable`             | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.hook.resetPatternFilter`                 | `api.slothlet.hook.pattern.reset`              | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.i18n.initI18n`                           | `api.slothlet.i18n.init`                       | renamed   |                                                                                                                                                                                                                                   |
| `api.slothlet.i18n.getLanguage`                        | `api.slothlet.i18n.language.get`               | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.i18n.setLanguage`                        | `api.slothlet.i18n.language.set`               | folded    | Returns a promise where the load is async.                                                                                                                                                                                        |
| `api.slothlet.i18n.setLanguageAsync`                   | `api.slothlet.i18n.language.set`               | folded    |                                                                                                                                                                                                                                   |
| `api.slothlet.instanceID`                              | `api.slothlet.instance.id`                     | moved     | Same namespace shape as the runtime export.                                                                                                                                                                                       |
| `api.slothlet.materialize.materialized`                | `api.slothlet.materialize.complete`            | renamed   | Accessor, true once every lazy folder is loaded.                                                                                                                                                                                  |
| `api.slothlet.metadata.get`                            | `api.slothlet.metadata.get`                    | behaviour | Sync (v3 was async), user metadata only (global &lt; path chain &lt; function); target = path \| module id \| function \| versioned path ("v1.auth"). System facts (file, folder, path, module, …) move to slothlet.node(target). |
| `api.slothlet.metadata.getFor`                         | `api.slothlet.metadata.get`                    | folded    |                                                                                                                                                                                                                                   |
| `api.slothlet.metadata.getForVersion`                  | `api.slothlet.metadata.get`                    | folded    | getForVersion("auth", "v1") → get("v1.auth").                                                                                                                                                                                     |
| `api.slothlet.metadata.setGlobal`                      | `api.slothlet.metadata.global`                 | renamed   | Rule target slothlet.metadata.setGlobal (built-in deny) → slothlet.metadata.global.                                                                                                                                               |
| `api.slothlet.metadata.removeFor`                      | `api.slothlet.metadata.remove`                 | folded    | remove(target, key?): target = function \| path \| module id.                                                                                                                                                                     |
| `api.slothlet.metadata.remove`                         | `api.slothlet.metadata.remove`                 | behaviour | Now also takes a path or module id as its target (fold of removeFor).                                                                                                                                                             |
| `api.slothlet.metadata.setFor`                         | `api.slothlet.metadata.set`                    | folded    | set(target, key \| object, value?).                                                                                                                                                                                               |
| `api.slothlet.metadata.setForVersion`                  | `api.slothlet.metadata.set`                    | folded    | setForVersion("auth", "v1", k, v) → set("v1.auth", k, v).                                                                                                                                                                         |
| `api.slothlet.metadata.set`                            | `api.slothlet.metadata.set`                    | behaviour | Now also takes a path, module id or versioned path as its target (fold of setFor / setForVersion).                                                                                                                                |
| —                                                      | `api.slothlet.node`                            | new       | (target) → one frozen self-report of a node (see node-field rows). Gated only by whether the caller may reach the target.                                                                                                         |
| `api.slothlet.ownership`                               | —                                              | removed   | Typedef-only (slothlet.ownership.get / unregister), never built. Use slothlet.owner.get(path).                                                                                                                                    |
| —                                                      | `api.slothlet.permissions.control.report`      | new       | () → { mode, baseline }: the level the instance runs at.                                                                                                                                                                          |
| —                                                      | `api.slothlet.permissions.control.gating`      | new       | Group matching config permissions.gating.                                                                                                                                                                                         |
| `api.slothlet.permissions.control.readGating`          | `api.slothlet.permissions.control.gating.read` | folded    | read(value?): with a boolean sets read gating; without an argument returns the current state (was the readGatingEnabled accessor).                                                                                                |
| `api.slothlet.permissions.control.readGatingEnabled`   | `api.slothlet.permissions.control.gating.read` | folded    | Accessor becomes the no-argument call.                                                                                                                                                                                            |
| `api.slothlet.permissions.control.enable`              | `api.slothlet.permissions.control.mode`        | folded    | enable() → mode("on").                                                                                                                                                                                                            |
| `api.slothlet.permissions.control.disable`             | `api.slothlet.permissions.control.mode`        | folded    | disable() → mode("off").                                                                                                                                                                                                          |
| `api.slothlet.permissions.control.enabled`             | `api.slothlet.permissions.control.mode`        | folded    | enabled → mode() === "on".                                                                                                                                                                                                        |
| `api.slothlet.permissions.control.mode`                | `api.slothlet.permissions.control.mode`        | behaviour | Accessor becomes mode(value?): no argument returns "on" \| "off" \| "disabled"; "on"\|true / "off"\|false switches; "disabled" can be left but not entered at runtime; locked by seal().                                          |
| —                                                      | `api.slothlet.permissions.global.check`        | new       | Group of the two queries.                                                                                                                                                                                                         |
| `api.slothlet.permissions.global.checkAccess`          | `api.slothlet.permissions.global.check.access` | moved     | Silent query, no audit.                                                                                                                                                                                                           |
| `api.slothlet.permissions.global.checkCall`            | `api.slothlet.permissions.global.check.call`   | moved     | Rule target slothlet.permissions.global.checkCall (built-in deny) → slothlet.permissions.global.check.call.                                                                                                                       |
| —                                                      | `api.slothlet.permissions.global.rules`        | new       | Group: the same list, two ways to name the target.                                                                                                                                                                                |
| `api.slothlet.permissions.global.rulesByModule`        | `api.slothlet.permissions.global.rules.module` | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.permissions.global.rulesForPath`         | `api.slothlet.permissions.global.rules.path`   | moved     |                                                                                                                                                                                                                                   |
| —                                                      | `api.slothlet.permissions.rules`               | new       | Group, same word as config permissions.rules and event.rules. self.rules() stays under permissions.self.                                                                                                                          |
| `api.slothlet.permissions.addRule`                     | `api.slothlet.permissions.rules.add`           | moved     | Rule target slothlet.permissions.addRule (built-in reach deny, #625) → slothlet.permissions.rules.add.                                                                                                                            |
| `api.slothlet.permissions.removeRule`                  | `api.slothlet.permissions.rules.remove`        | moved     |                                                                                                                                                                                                                                   |
| `api.slothlet.lockCaller`                              | `api.slothlet.pin`                             | renamed   | Rule target slothlet.lockCaller (built-in allow) → slothlet.pin.                                                                                                                                                                  |
| `api.slothlet.lockCaller.caller`                       | `api.slothlet.pin.caller`                      | renamed   | Follows lockCaller → pin. Rule target slothlet.lockCaller.caller → slothlet.pin.caller.                                                                                                                                           |
| `api.slothlet.run`                                     | `api.slothlet.context.run`                     | removed   | Alias removed; use context.run.                                                                                                                                                                                                   |
| `api.slothlet.scope`                                   | `api.slothlet.context.scope`                   | removed   | Alias removed; use context.scope.                                                                                                                                                                                                 |
| `api.slothlet.versioning.setDefault`                   | `api.slothlet.versioning.default`              | renamed   | (path, tag).                                                                                                                                                                                                                      |
| —                                                      | `api.slothlet.versioning.metadata`             | new       | Group: version-manager-only metadata (not the store metadata.set("v1.auth", …) writes).                                                                                                                                           |
| `api.slothlet.versioning.getVersionMetadata`           | `api.slothlet.versioning.metadata.get`         | moved     | (path, tag).                                                                                                                                                                                                                      |
| `api.slothlet.versioning.setVersionMetadata`           | `api.slothlet.versioning.metadata.set`         | moved     | (path, tag, patch); merges.                                                                                                                                                                                                       |
| `api.slothlet.versioning.unregister`                   | `api.slothlet.versioning.remove`               | renamed   | (path, tag).                                                                                                                                                                                                                      |

<!-- migration-table:method:end -->

### Permission rule targets

A rule target is a method path, so each renamed, moved or folded method renames its target. This table is derived from the method rows above.

<!-- migration-table:rule-targets:start -->

| v3 rule target                                   | v4 rule target                             |
| ------------------------------------------------ | ------------------------------------------ |
| `slothlet.api.modules.addModule`                 | `slothlet.api.modules.add`                 |
| `slothlet.api.modules.addModules`                | `slothlet.api.modules.add`                 |
| `slothlet.api.modules.addDiscovered`             | `slothlet.api.modules.add`                 |
| `slothlet.api.modules.clearDiscoveryCache`       | `slothlet.api.modules.cache.clear`         |
| `slothlet.api.modules.getDiscoveryCache`         | `slothlet.api.modules.cache.get`           |
| `slothlet.api.modules.removeModule`              | `slothlet.api.modules.remove`              |
| `slothlet.api.modules.getStaleMounts`            | `slothlet.api.modules.stale`               |
| `slothlet.diag.getAPI`                           | `slothlet.diag.api`                        |
| `slothlet.diag.caches.getAllModuleIDs`           | `slothlet.diag.caches.ids`                 |
| `slothlet.diag.hook.compilePattern`              | `slothlet.diag.hook.compile`               |
| `slothlet.diag.owner`                            | `slothlet.diag.owner.get`                  |
| `slothlet.diag.getOwnership`                     | `slothlet.diag.owner.list`                 |
| `slothlet.event.resolveLevel`                    | `slothlet.event.level`                     |
| `slothlet.hook.disablePattern`                   | `slothlet.hook.pattern.disable`            |
| `slothlet.hook.enablePattern`                    | `slothlet.hook.pattern.enable`             |
| `slothlet.hook.resetPatternFilter`               | `slothlet.hook.pattern.reset`              |
| `slothlet.i18n.initI18n`                         | `slothlet.i18n.init`                       |
| `slothlet.i18n.getLanguage`                      | `slothlet.i18n.language.get`               |
| `slothlet.i18n.setLanguage`                      | `slothlet.i18n.language.set`               |
| `slothlet.i18n.setLanguageAsync`                 | `slothlet.i18n.language.set`               |
| `slothlet.instanceID`                            | `slothlet.instance.id`                     |
| `slothlet.materialize.materialized`              | `slothlet.materialize.complete`            |
| `slothlet.metadata.getFor`                       | `slothlet.metadata.get`                    |
| `slothlet.metadata.getForVersion`                | `slothlet.metadata.get`                    |
| `slothlet.metadata.setGlobal`                    | `slothlet.metadata.global`                 |
| `slothlet.metadata.removeFor`                    | `slothlet.metadata.remove`                 |
| `slothlet.metadata.setFor`                       | `slothlet.metadata.set`                    |
| `slothlet.metadata.setForVersion`                | `slothlet.metadata.set`                    |
| `slothlet.permissions.control.readGating`        | `slothlet.permissions.control.gating.read` |
| `slothlet.permissions.control.readGatingEnabled` | `slothlet.permissions.control.gating.read` |
| `slothlet.permissions.control.enable`            | `slothlet.permissions.control.mode`        |
| `slothlet.permissions.control.disable`           | `slothlet.permissions.control.mode`        |
| `slothlet.permissions.control.enabled`           | `slothlet.permissions.control.mode`        |
| `slothlet.permissions.global.checkAccess`        | `slothlet.permissions.global.check.access` |
| `slothlet.permissions.global.checkCall`          | `slothlet.permissions.global.check.call`   |
| `slothlet.permissions.global.rulesByModule`      | `slothlet.permissions.global.rules.module` |
| `slothlet.permissions.global.rulesForPath`       | `slothlet.permissions.global.rules.path`   |
| `slothlet.permissions.addRule`                   | `slothlet.permissions.rules.add`           |
| `slothlet.permissions.removeRule`                | `slothlet.permissions.rules.remove`        |
| `slothlet.lockCaller`                            | `slothlet.pin`                             |
| `slothlet.lockCaller.caller`                     | `slothlet.pin.caller`                      |
| `slothlet.versioning.setDefault`                 | `slothlet.versioning.default`              |
| `slothlet.versioning.getVersionMetadata`         | `slothlet.versioning.metadata.get`         |
| `slothlet.versioning.setVersionMetadata`         | `slothlet.versioning.metadata.set`         |
| `slothlet.versioning.unregister`                 | `slothlet.versioning.remove`               |

<!-- migration-table:rule-targets:end -->

### Exports

Written `<specifier>#<export>`. A bare specifier is the whole entry point.

<!-- migration-table:export:start -->

| v3                                                                                      | v4                                                 | Change  | Notes                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@cldmv/slothlet/builders/api-assignment`                                               | `#builders/api-assignment`                         | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/builders/api_builder`                                                  | `#builders/api_builder`                            | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/builders/builder`                                                      | `#builders/builder`                                | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/builders/modes-processor`                                              | `#builders/modes-processor`                        | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/async-resource-context`                                        | `#helpers/async-resource-context`                  | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/boundary-patch-layers`                                         | `#helpers/boundary-patch-layers`                   | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/caller-pinning`                                                | `#helpers/caller-pinning`                          | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/cjs-export-names`                                              | `#helpers/cjs-export-names`                        | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/class-instance-wrapper`                                        | `#helpers/class-instance-wrapper`                  | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/clock`                                                         | `#helpers/clock`                                   | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/clone-context`                                                 | `#helpers/clone-context`                           | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/composition`                                                   | `#helpers/composition`                             | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/config`                                                        | `#helpers/config`                                  | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/defaults`                                                      | `#helpers/defaults`                                | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/eventemitter-context`                                          | `#helpers/eventemitter-context`                    | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/eventtarget-context`                                           | `#helpers/eventtarget-context`                     | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/eventtarget-property-context`                                  | `#helpers/eventtarget-property-context`            | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/function-source-context`                                       | `#helpers/function-source-context`                 | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/hint-detector`                                                 | `#helpers/hint-detector`                           | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/intrinsics`                                                    | `#helpers/intrinsics`                              | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/modes-utils`                                                   | `#helpers/modes-utils`                             | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/module-discovery`                                              | `#helpers/module-discovery`                        | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/module-manifest-validator`                                     | `#helpers/module-manifest-validator`               | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/module-sort`                                                   | `#helpers/module-sort`                             | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/observer-context`                                              | `#helpers/observer-context`                        | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/pattern-matcher`                                               | `#helpers/pattern-matcher`                         | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/platform`                                                      | `#helpers/platform`                                | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/promise-context`                                               | `#helpers/promise-context`                         | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/reserved-keys`                                                 | `#helpers/reserved-keys`                           | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/resolve-from-caller`                                           | `#helpers/resolve-from-caller`                     | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/scheduler-context`                                             | `#helpers/scheduler-context`                       | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/stack-read`                                                    | `#helpers/stack-read`                              | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/utilities`                                                     | `#helpers/utilities`                               | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/modes/eager`                                                           | `#modes/eager`                                     | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/modes/lazy`                                                            | `#modes/lazy`                                      | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/processors/flatten`                                                    | `#processors/flatten`                              | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/processors/loader`                                                     | `#processors/loader`                               | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/processors/type-generation-worker`                                     | `#processors/type-generation-worker`               | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/processors/type-generator`                                             | `#processors/type-generator`                       | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/processors/typescript`                                                 | `#processors/typescript`                           | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/slothlet`                                                              | `#slothlet`                                        | moved   | Leaves package.json exports; a package-private import (#…) usable only by slothlet's own files. No public replacement.                                                            |
| `@cldmv/slothlet/helpers/instance-imports`                                              | `#helpers/instance-imports`                        | moved   | Package-private. Its public piece, the vite/vitest plugin, moves to @cldmv/slothlet/vite.                                                                                         |
| `@cldmv/slothlet/helpers/instance-imports#slothletInstanceImports`                      | `@cldmv/slothlet/vite#plugin`                      | moved   | import { plugin } from "@cldmv/slothlet/vite"; plugins: [plugin()].                                                                                                               |
| —                                                                                       | `@cldmv/slothlet/vite`                             | new     | New entry point: the vite / vitest plugin.                                                                                                                                        |
| `@cldmv/slothlet/helpers/generate-manifest`                                             | `@cldmv/slothlet/files`                            | moved   | One module usable in Node and the page; Node-only functions refuse in a browser with a named error. File becomes #helpers/generate-manifest behind it.                            |
| `@cldmv/slothlet/helpers/manifest-resolver`                                             | `@cldmv/slothlet/files`                            | moved   | Folded into the files entry point.                                                                                                                                                |
| —                                                                                       | `@cldmv/slothlet/files#files`                      | new     | One namespace object: import { files } from "@cldmv/slothlet/files".                                                                                                              |
| `@cldmv/slothlet/helpers/generate-manifest#generateBrowserAssets`                       | `@cldmv/slothlet/files#files.assets`               | moved   | Node. Returns the manifest and the importmap together.                                                                                                                            |
| `@cldmv/slothlet/helpers/generate-manifest#generateBrowserAssets(options).slothletBase` | `@cldmv/slothlet/files#files.assets(options).base` | renamed | URL / path prefix where slothlet is served.                                                                                                                                       |
| `@cldmv/slothlet/helpers/generate-manifest#generateManifest`                            | `@cldmv/slothlet/files#files.generate`             | moved   | Node.                                                                                                                                                                             |
| `@cldmv/slothlet/helpers/generate-manifest#generateImportMap`                           | `@cldmv/slothlet/files#files.importmap`            | moved   | Node.                                                                                                                                                                             |
| `@cldmv/slothlet/helpers/manifest-resolver#createManifestResolver`                      | `@cldmv/slothlet/files#files.resolver`             | moved   | Page and Node.                                                                                                                                                                    |
| `@cldmv/slothlet/helpers/generate-manifest#collectPackageSpecifiers`                    | `@cldmv/slothlet/files#files.specifiers.packages`  | moved   |                                                                                                                                                                                   |
| `@cldmv/slothlet/helpers/generate-manifest#collectSlothletSpecifiers`                   | `@cldmv/slothlet/files#files.specifiers.slothlet`  | moved   |                                                                                                                                                                                   |
| `@cldmv/slothlet/helpers/sanitize`                                                      | `@cldmv/slothlet/sanitize`                         | moved   | File becomes #helpers/sanitize behind it.                                                                                                                                         |
| `@cldmv/slothlet/helpers/sanitize#sanitizePropertyName`                                 | `@cldmv/slothlet/sanitize#sanitize`                | moved   | Same options as config sanitize (renamed together).                                                                                                                               |
| `@cldmv/slothlet/helpers/sanitize#Sanitize`                                             | —                                                  | removed | Internal component class; not exported in v4.                                                                                                                                     |
| `@cldmv/slothlet/errors#SlothletDebug`                                                  | —                                                  | removed | Internal debug logger; moves to a private path.                                                                                                                                   |
| `@cldmv/slothlet/i18n#initI18n`                                                         | `@cldmv/slothlet/i18n#init`                        | renamed |                                                                                                                                                                                   |
| `@cldmv/slothlet/i18n#internals`                                                        | —                                                  | removed | Internal guard accessor; not exported in v4.                                                                                                                                      |
| —                                                                                       | `@cldmv/slothlet/i18n#language`                    | new     | Namespace object: import { language } from "@cldmv/slothlet/i18n".                                                                                                                |
| `@cldmv/slothlet/i18n#getLanguage`                                                      | `@cldmv/slothlet/i18n#language.get`                | moved   |                                                                                                                                                                                   |
| `@cldmv/slothlet/i18n#setLanguage`                                                      | `@cldmv/slothlet/i18n#language.set`                | folded  | One function with setLanguageAsync: switches synchronously where it can (Node) and returns a promise where the load is async (browser); `await language.set(x)` works everywhere. |
| `@cldmv/slothlet/i18n#setLanguageAsync`                                                 | `@cldmv/slothlet/i18n#language.set`                | folded  | See setLanguage.                                                                                                                                                                  |
| `@cldmv/slothlet/runtime#instanceID`                                                    | `@cldmv/slothlet/runtime#instance.id`              | moved   | instance is a namespace of read-only facts; instance.id is a real string read at access (v3 exported a Proxy that converted to the id), so `instance.id === "abc"` holds.         |
| `@cldmv/slothlet/runtime/async#instanceID`                                              | `@cldmv/slothlet/runtime/async#instance.id`        | moved   | instance is a namespace of read-only facts; instance.id is a real string read at access (v3 exported a Proxy that converted to the id), so `instance.id === "abc"` holds.         |
| `@cldmv/slothlet/runtime/live#instanceID`                                               | `@cldmv/slothlet/runtime/live#instance.id`         | moved   | instance is a namespace of read-only facts; instance.id is a real string read at access (v3 exported a Proxy that converted to the id), so `instance.id === "abc"` holds.         |
| `@cldmv/slothlet/typegen#generateTypes`                                                 | `@cldmv/slothlet/typegen#generate`                 | renamed |                                                                                                                                                                                   |

<!-- migration-table:export:end -->

### Node fields

Fields that used to sit on a node, now read with `api.slothlet.node(<node>).<field>`.

<!-- migration-table:node-field:start -->

| v3                                   | v4                                       | Change  | Notes                                                                                                                             |
| ------------------------------------ | ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `<node>.__isCallable`                | `api.slothlet.node(<node>).callable`     | moved   | Nodes carry no framework keys in v4.                                                                                              |
| `<node>.__filePath`                  | `api.slothlet.node(<node>).file`         | moved   | Nodes carry no framework keys in v4.                                                                                              |
| `<node>.__sourceFolder`              | `api.slothlet.node(<node>).folder`       | moved   | Nodes carry no framework keys in v4.                                                                                              |
| `<node>.__inFlight`                  | `api.slothlet.node(<node>).loading`      | moved   | Nodes carry no framework keys in v4. Lazy materialization in progress.                                                            |
| `<node>.__materialized`              | `api.slothlet.node(<node>).materialized` | moved   | Nodes carry no framework keys in v4.                                                                                              |
| `<node>.__mode`                      | `api.slothlet.node(<node>).mode`         | moved   | Nodes carry no framework keys in v4. "eager" \| "lazy".                                                                           |
| `<node>.__moduleID`                  | `api.slothlet.node(<node>).module`       | moved   | Nodes carry no framework keys in v4. Reports the module id used with api.add / remove (e.g. "base"), not v3's internal composite. |
| `<node>.__apiPath`                   | `api.slothlet.node(<node>).path`         | moved   | Nodes carry no framework keys in v4. The real path, e.g. "v1.auth".                                                               |
| `<node>.__type`                      | `api.slothlet.node(<node>).type`         | moved   | Nodes carry no framework keys in v4. Compare against slothlet.types.\*.                                                           |
| `<node>.__slothletPath`              | `api.slothlet.node(<node>).path`         | moved   | On a version dispatcher the logical path ("auth") is node().logical; everywhere else path.                                        |
| `<versionDispatcher>.__slothletPath` | `api.slothlet.node(<node>).logical`      | moved   | Only present on versioned nodes.                                                                                                  |
| `<node>.__metadata`                  | `api.slothlet.metadata.get(<node>)`      | removed | User metadata via metadata.get(target); system facts via node(target).                                                            |
| `metadata._module.manifest`          | `api.slothlet.node(<node>).manifest`     | moved   | Parsed slothlet.module.json of a package mount; user metadata no longer carries \_module.                                         |
| `metadata.filePath`                  | `api.slothlet.node(<node>).file`         | moved   | System field of v3 metadata.get() output.                                                                                         |
| `metadata.sourceFolder`              | `api.slothlet.node(<node>).folder`       | moved   | System field of v3 metadata.get() output.                                                                                         |
| `metadata.apiPath`                   | `api.slothlet.node(<node>).path`         | moved   | System field of v3 metadata.get() output.                                                                                         |
| `metadata.baseModuleID`              | `api.slothlet.node(<node>).module`       | moved   | The raw owning-module id (v3 metadata.moduleID was the internal composite).                                                       |
| `metadata.moduleID`                  | —                                        | removed | Internal composite id; stays private. Use node(target).module for the public id.                                                  |
| `metadata.taggedAt`                  | —                                        | removed | Removed; node() does not report it.                                                                                               |

<!-- migration-table:node-field:end -->

### Manifest fields

<!-- migration-table:manifest:start -->

| v3                                   | v4                            | Change  | Notes                                                                                                                                                 |
| ------------------------------------ | ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slothlet.module.json:apiDir`        | `slothlet.module.json:base`   | renamed | Format 1 files are still read (mapped, with a deprecation warning).                                                                                   |
| `slothlet.module.json:mountPath`     | `slothlet.module.json:mount`  | renamed | string \| string[]. Format 1 still read with a warning.                                                                                               |
| `slothlet.module.json:schemaVersion` | `slothlet.module.json:schema` | renamed | Value 1 → 2. v4 writes and validates format 2; format 1 (schemaVersion / mountPath / apiDir) is read, mapped to the v2 names, and warns (translated). |

<!-- migration-table:manifest:end -->

### Typegen settings

Command-line flags and `package.json` `slothlet.typegen` keys.

<!-- migration-table:cli:start -->

| v3                                            | v4                                   | Change  | Notes                                                              |
| --------------------------------------------- | ------------------------------------ | ------- | ------------------------------------------------------------------ |
| `slothlet typegen --dir`                      | `slothlet typegen --base`            | renamed | Matches config base.                                               |
| `slothlet typegen -d`                         | `slothlet typegen -b`                | renamed | Short flag follows the long one.                                   |
| `slothlet typegen --interface-name`           | `slothlet typegen --name`            | renamed | Short flag -n unchanged.                                           |
| `slothlet typegen --no-augment-runtime`       | `slothlet typegen --no-augment`      | renamed |                                                                    |
| `package.json:slothlet.typegen.dir`           | `package.json:slothlet.typegen.base` | renamed | The CLI's package.json fallback takes the generate() option names. |
| `package.json:slothlet.typegen.interfaceName` | `package.json:slothlet.typegen.name` | renamed | The CLI's package.json fallback takes the generate() option names. |

<!-- migration-table:cli:end -->

### Error and warning codes

<!-- migration-table:codes:start -->

| v3 code                                             | v4 code                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `INVALID_CONFIG_DIR_MISSING`                        | `INVALID_CONFIG_BASE_MISSING`                    |
| `INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST`          | `INVALID_CONFIG_FILES_REQUIRED`                  |
| `INVALID_CONFIG_BROWSER_MANIFEST_INVALID`           | `INVALID_CONFIG_FILES_INVALID`                   |
| `INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID`  | `INVALID_CONFIG_RESOLVER_INVALID`                |
| `INVALID_CONFIG_IMPORT`                             | `INVALID_CONFIG_IMPORTER_INVALID`                |
| `INVALID_CONFIG_VERSION_DISPATCHER`                 | `VERSION_DISPATCHER_INVALID`                     |
| `INVALID_CONFIG_NOT_LOADED`                         | `INSTANCE_NOT_LOADED`                            |
| `INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE`            | `INLINE_EXPORTS_INVALID`                         |
| `INVALID_CONFIG_SYNTHETIC_INPUT`                    | `INLINE_CONTENT_INVALID`                         |
| `INVALID_CONFIG_SYNTHETIC_NAME`                     | `INLINE_NAME_INVALID`                            |
| `WARN_SYNTHETIC_ROOT_EMPTY`                         | `WARNING_INLINE_ROOT_EMPTY`                      |
| `WARN_SYNTHETIC_ROOT_UNNAMED`                       | `WARNING_INLINE_ROOT_UNNAMED`                    |
| `WARN_SYNTHETIC_ROOT_COLLISION`                     | `WARNING_INLINE_ROOT_COLLISION`                  |
| `INVALID_CONFIG_PRELOADED_STRUCTURE`                | `FILES_STRUCTURE_INVALID`                        |
| `INVALID_CONFIG_DIR_INVALID`                        | `FOLDER_INVALID`                                 |
| `INVALID_DIRECTORY`                                 | `FOLDER_UNREADABLE`                              |
| `WARN_DIRECTORY_EMPTY`                              | `WARNING_FOLDER_EMPTY`                           |
| `INVALID_CONFIG_PATH_TYPE`                          | `PATH_TYPE_UNSUPPORTED`                          |
| `INVALID_CONFIG_FILE_TYPE`                          | `FILE_TYPE_UNSUPPORTED`                          |
| `MODULE_RESERVED_FILENAME`                          | `MODULE_RESERVED_FILE`                           |
| `MODULE_RESERVED_DIRNAME`                           | `MODULE_RESERVED_FOLDER`                         |
| `INVALID_CONFIG_API_PATH_INVALID`                   | `API_PATH_INVALID`                               |
| `INVALID_API_PATH`                                  | `API_PATH_NOT_FOUND`                             |
| `INVALID_CONFIG_NOT_A_FUNCTION`                     | `API_PATH_NOT_CALLABLE`                          |
| `INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED`        | `LAZY_MATERIALIZATION_FAILED`                    |
| `INVALID_CONFIG_MUTATIONS_DISABLED`                 | `API_MUTATION_DISABLED`                          |
| `INVALID_CONFIG_FORCE_OVERWRITE_REQUIRES_MODULE_ID` | `MODULE_ID_REQUIRED`                             |
| `API_LEAVES_UNKNOWN_MODULE`                         | `MODULE_UNKNOWN`                                 |
| `INVALID_METADATA_TARGET`                           | `METADATA_TARGET_INVALID`                        |
| `INVALID_METADATA_KEY`                              | `METADATA_KEY_INVALID`                           |
| `METADATA_NO_MODULE_ID`                             | `METADATA_NO_MODULE`                             |
| `WARNING_HOT_RELOAD_PATH_COLLISION`                 | `WARNING_COLLISION_PATH_KEPT`                    |
| `WARNING_HOT_RELOAD_MERGE_PRIMITIVES`               | `WARNING_COLLISION_MERGE_PRIMITIVES`             |
| `WARNING_API_ADD_OPTION_LOCKED`                     | `WARNING_COLLISION_OPTION_LOCKED`                |
| `CACHE_MODULEID_MISMATCH`                           | `CACHE_MODULE_ID_MISMATCH`                       |
| `OWNERSHIP_INVALID_MODULE_ID`                       | `OWNERSHIP_MODULE_ID_INVALID`                    |
| `OWNERSHIP_INVALID_API_PATH`                        | `OWNERSHIP_API_PATH_INVALID`                     |
| `RUNTIME_NO_ACTIVE_CONTEXT`                         | `CONTEXT_NOT_ACTIVE`                             |
| `NO_ACTIVE_CONTEXT_LIVE`                            | `CONTEXT_NOT_ACTIVE_LIVE`                        |
| `NO_ACTIVE_CONTEXT_ASYNC`                           | `CONTEXT_NOT_ACTIVE_ASYNC`                       |
| `RUNTIME_NO_ACTIVE_CONTEXT_SELF`                    | `CONTEXT_NOT_ACTIVE_SELF`                        |
| `RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT`                 | `CONTEXT_NOT_ACTIVE_WRITE`                       |
| `NO_CONTEXT_MANAGER`                                | `CONTEXT_RUNTIME_NOT_AVAILABLE`                  |
| `UNSUPPORTED_CONTEXT_MANAGER`                       | `CONTEXT_RUNTIME_UNSUPPORTED`                    |
| `SCOPE_INVALID_CONTEXT`                             | `SCOPE_CONTEXT_INVALID`                          |
| `SCOPE_INVALID_CALLBACK`                            | `SCOPE_CALLBACK_INVALID`                         |
| `SCOPE_INVALID_OPTIONS`                             | `SCOPE_OPTIONS_INVALID`                          |
| `SCOPE_INVALID_FN`                                  | `SCOPE_FUNCTION_INVALID`                         |
| `SCOPE_INVALID_CONTEXT_OBJECT`                      | `SCOPE_CONTEXT_OBJECT_INVALID`                   |
| `SCOPE_INVALID_MERGE_STRATEGY`                      | `SCOPE_MERGE_STRATEGY_INVALID`                   |
| `SCOPE_INVALID_ISOLATION_MODE`                      | `SCOPE_ISOLATION_MODE_INVALID`                   |
| `SCOPE_INVALID_PROTECT`                             | `SCOPE_PROTECTED_KEYS_INVALID`                   |
| `SCOPE_INVALID_OWNERS`                              | `SCOPE_KEY_OWNERS_INVALID`                       |
| `INVALID_HOOK_HANDLER`                              | `HOOK_HANDLER_INVALID`                           |
| `DUPLICATE_HOOK_ID`                                 | `HOOK_ID_IN_USE`                                 |
| `INVALID_HOOK_SUBSET`                               | `HOOK_SUBSET_INVALID`                            |
| `INVALID_TYPE_PATTERN`                              | `HOOK_PATTERN_INVALID`                           |
| `HOOKS_NOT_INITIALIZED`                             | `HOOK_MANAGER_NOT_AVAILABLE`                     |
| `HOOK_UNPINNED_IGNORED`                             | `WARNING_HOOK_UNPINNED_IGNORED`                  |
| `INVALID_CONFIG_VERSION_TAG`                        | `VERSION_TAG_INVALID`                            |
| `INVALID_PERMISSION_RULE`                           | `PERMISSION_RULE_INVALID`                        |
| `PRINCIPAL_NAME_OWNED`                              | `PERMISSION_PRINCIPAL_NAME_OWNED`                |
| `PRINCIPAL_NOT_OWNER`                               | `PERMISSION_PRINCIPAL_NOT_OWNER`                 |
| `PRINCIPAL_READ_ONLY`                               | `PERMISSION_PRINCIPAL_READ_ONLY`                 |
| `PERM_RULE_NOT_OBJECT`                              | `PERMISSION_RULE_REASON_NOT_OBJECT`              |
| `PERM_RULE_CALLER_REQUIRED`                         | `PERMISSION_RULE_REASON_CALLER_REQUIRED`         |
| `PERM_RULE_TARGET_REQUIRED`                         | `PERMISSION_RULE_REASON_TARGET_REQUIRED`         |
| `PERM_RULE_TARGET_NOT_OWNED`                        | `PERMISSION_RULE_REASON_TARGET_NOT_OWNED`        |
| `PERM_RULE_REMOVAL_NOT_OWNED`                       | `PERMISSION_RULE_REASON_REMOVAL_NOT_OWNED`       |
| `PERM_RULE_FIELD_ACCESSOR`                          | `PERMISSION_RULE_REASON_FIELD_ACCESSOR`          |
| `PERM_RULE_EFFECT_INVALID`                          | `PERMISSION_RULE_REASON_EFFECT_INVALID`          |
| `PERM_EVENT_RULE_EVENT_REQUIRED`                    | `PERMISSION_EVENT_RULE_REASON_EVENT_REQUIRED`    |
| `PERM_EVENT_RULE_EFFECT_INVALID`                    | `PERMISSION_EVENT_RULE_REASON_EFFECT_INVALID`    |
| `PERM_RULE_CONDITION_INVALID`                       | `PERMISSION_RULE_REASON_CONDITION_INVALID`       |
| `PERM_RULE_CONDITION_PROXY`                         | `PERMISSION_RULE_REASON_CONDITION_PROXY`         |
| `PERM_RULE_REQUIRES_INVALID`                        | `PERMISSION_RULE_REASON_PRINCIPALS_INVALID`      |
| `TS_STRICT_REQUIRES_OUTPUT`                         | `TYPESCRIPT_TYPES_OUTPUT_MISSING`                |
| `TS_STRICT_REQUIRES_INTERFACE_NAME`                 | `TYPESCRIPT_TYPES_NAME_MISSING`                  |
| `TS_TYPE_GENERATION_FAILED`                         | `TYPESCRIPT_TYPE_GENERATION_FAILED`              |
| `TS_TYPE_GENERATION_FORK_FAILED`                    | `TYPESCRIPT_TYPE_GENERATION_FORK_FAILED`         |
| `TS_TYPE_GENERATION_WORKER_NO_CONFIG`               | `TYPESCRIPT_TYPE_GENERATION_WORKER_NO_CONFIG`    |
| `TS_TYPE_GENERATION_PROCESS_EXITED`                 | `TYPESCRIPT_TYPE_GENERATION_PROCESS_EXITED`      |
| `TS_TYPE_CHECK_ERRORS`                              | `TYPESCRIPT_TYPE_CHECK_ERRORS`                   |
| `WARNING_COVERAGE_TS_SOURCEMAP_OFF`                 | `WARNING_COVERAGE_TYPESCRIPT_SOURCEMAP_OFF`      |
| `MODULE_MANIFEST_REASON_MOUNTPATH_SHAPE`            | `MODULE_MANIFEST_REASON_MOUNT_SHAPE`             |
| `MODULE_MANIFEST_REASON_MOUNTPATH_ENTRIES`          | `MODULE_MANIFEST_REASON_MOUNT_ENTRIES`           |
| `EXPECTED_NON_EMPTY_STRING`                         | `MODULE_MANIFEST_EXPECTED_NON_EMPTY_STRING`      |
| `EXPECTED_STRING`                                   | `MODULE_MANIFEST_EXPECTED_STRING`                |
| `EXPECTED_FINITE_NUMBER`                            | `MODULE_MANIFEST_EXPECTED_FINITE_NUMBER`         |
| `EXPECTED_PLAIN_OBJECT`                             | `MODULE_MANIFEST_EXPECTED_PLAIN_OBJECT`          |
| `EXPECTED_ARRAY_OF_RULE_OBJECTS`                    | `MODULE_MANIFEST_EXPECTED_ARRAY_OF_RULE_OBJECTS` |
| `MODULE_VERSION_UNSUPPORTED`                        | `MODULE_MANIFEST_FORMAT_UNSUPPORTED`             |
| `MODULE_RESERVED_MOUNTPATH`                         | `MODULE_RESERVED_MOUNT`                          |
| `GENERATE_MANIFEST_DIR_INVALID`                     | `FILES_FOLDER_INVALID`                           |
| `GENERATE_MANIFEST_DIR_UNREADABLE`                  | `FILES_FOLDER_UNREADABLE`                        |
| `GENERATE_MANIFEST_NOT_DIRECTORY`                   | `FILES_NOT_A_FOLDER`                             |
| `GENERATE_BROWSER_ASSETS_SLOTHLET_BASE_INVALID`     | `FILES_BASE_INVALID`                             |
| `FLATTEN_REASON_ADDAPI_METADATA_DEFAULT`            | `FLATTEN_REASON_MOUNT_METADATA_DEFAULT`          |
| `FLATTEN_REASON_ADDAPI_SPECIAL_FILE`                | `FLATTEN_REASON_MOUNT_SPECIAL_FILE`              |
| `FLATTEN_REASON_ADDAPI_SPECIAL_FILE_PARENT`         | `FLATTEN_REASON_MOUNT_SPECIAL_FILE_PARENT`       |

Codes that no longer exist:

| Removed code                            |
| --------------------------------------- |
| `MODULE_NOT_FOUND`                      |
| `WARNING_METADATA_MISMATCH`             |
| `HOOK_TYPEPATTERN_PREFIX_DEPRECATED`    |
| `VERSION_DISCRIMINATOR_INVALID_RETURN`  |
| `V3_CONFIG_DEPRECATED`                  |
| `CONFIG_SCAN_HIDDEN_FOLDERS_DEPRECATED` |
| `WARN_SUPPRESS_FIX_ACTIVE`              |
| `MODULE_MANIFEST_NOT_FOUND`             |

<!-- migration-table:codes:end -->

### Data keys

Names a program reads off slothlet objects. These cannot be rewritten safely, so the tool reports them; see [Paths, kinds and caller objects in data](#paths-kinds-and-caller-objects-in-data).

<!-- migration-table:data:start -->

| Where                            | v3 key                                                   | v4 key                                        | Notes                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lifecycle event payload          | `filePath`                                               | `file`                                        |                                                                                                                                                                                                       |
| lifecycle event payload          | `sourceFolder`                                           | `folder`                                      |                                                                                                                                                                                                       |
| lifecycle event payload          | `moduleID`                                               | `module`                                      |                                                                                                                                                                                                       |
| lifecycle event payload          | `apiPath`                                                | `path`                                        | A segments array in v4; join it where you need a dotted string.                                                                                                                                       |
| lifecycle event payload          | `collisionMode`                                          | `collision`                                   |                                                                                                                                                                                                       |
| lifecycle event payload          | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| lifecycle event payload          | `previousInstanceID`                                     | `previous`                                    |                                                                                                                                                                                                       |
| lifecycle event payload          | `timestamp`                                              | `at`                                          |                                                                                                                                                                                                       |
| lifecycle event payload          | `scanRoot`                                               | `root`                                        |                                                                                                                                                                                                       |
| lifecycle event payload          | `mountPath`                                              | `mount`                                       | A segments array in v4.                                                                                                                                                                               |
| lifecycle event payload          | `discoverResult`                                         | `found`                                       |                                                                                                                                                                                                       |
| lifecycle event payload          | `packageRoot`                                            | `folder`                                      |                                                                                                                                                                                                       |
| lifecycle event payload          | `conditionMatched`                                       | —                                             | Dropped; read `e.rule.condition != null`.                                                                                                                                                             |
| event listener meta              | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| event strategy envelope          | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| event strategy envelope          | `emitter.moduleID`                                       | `emitter.module`                              |                                                                                                                                                                                                       |
| event strategy envelope          | `emitter.apiPath`                                        | `emitter.path`                                | A segments array in v4.                                                                                                                                                                               |
| hook handler context             | `hasError`                                               | —                                             | Dropped; use `ctx.errors.length &gt; 0` in an always hook.                                                                                                                                            |
| hook handler context             | `errorType`                                              | `class`                                       |                                                                                                                                                                                                       |
| hook handler context             | `timestamp`                                              | `at`                                          | A number (clock.now()), not a Date.                                                                                                                                                                   |
| hook handler context             | `source`                                                 | `origin`                                      |                                                                                                                                                                                                       |
| hook handler context             | `source.hookId`                                          | `origin.hook`                                 |                                                                                                                                                                                                       |
| hook handler context             | `source.hookTag`                                         | `origin.hook`                                 |                                                                                                                                                                                                       |
| hook handler context             | `source.timestamp`                                       | `origin.at`                                   |                                                                                                                                                                                                       |
| error / warning details          | `moduleID`                                               | `module`                                      |                                                                                                                                                                                                       |
| error / warning details          | `apiPath`                                                | `path`                                        | A segments array in v4.                                                                                                                                                                               |
| error / warning details          | `filePath`                                               | `file`                                        |                                                                                                                                                                                                       |
| error / warning details          | `modulePath`                                             | `file`                                        |                                                                                                                                                                                                       |
| error / warning details          | `dir`                                                    | `folder`                                      |                                                                                                                                                                                                       |
| error / warning details          | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| error / warning details          | `mountPath`                                              | `mount`                                       | A segments array in v4.                                                                                                                                                                               |
| error / warning details          | `packageName`                                            | `package`                                     |                                                                                                                                                                                                       |
| error / warning details          | `packageVersion`                                         | `version`                                     |                                                                                                                                                                                                       |
| error / warning details          | `manifestPath`                                           | `manifest`                                    |                                                                                                                                                                                                       |
| error / warning details          | `apiDir`                                                 | `base`                                        |                                                                                                                                                                                                       |
| error / warning details          | `collisionMode`                                          | `collision`                                   |                                                                                                                                                                                                       |
| error / warning details          | `collisionContext`                                       | `phase`                                       |                                                                                                                                                                                                       |
| error / warning details          | `isolationMode`                                          | `isolation`                                   |                                                                                                                                                                                                       |
| error / warning details          | `schemaVersion`                                          | `schema`                                      |                                                                                                                                                                                                       |
| error / warning details          | `existingModuleId`                                       | `owner`                                       |                                                                                                                                                                                                       |
| error / warning details          | `existingModuleID`                                       | `owner`                                       |                                                                                                                                                                                                       |
| error / warning details          | `newModuleId`                                            | `incoming`                                    |                                                                                                                                                                                                       |
| error / warning details          | `availableInstances`                                     | `instances`                                   |                                                                                                                                                                                                       |
| error / warning details          | `callerApiPath`                                          | `caller`                                      |                                                                                                                                                                                                       |
| error / warning details          | `hookId`                                                 | `id`                                          |                                                                                                                                                                                                       |
| error / warning details          | `ruleId`                                                 | `id`                                          |                                                                                                                                                                                                       |
| error / warning details          | `receivedType`                                           | `received`                                    |                                                                                                                                                                                                       |
| error / warning details          | `actualType`                                             | `received`                                    |                                                                                                                                                                                                       |
| error / warning details          | `typePattern`                                            | `received`                                    |                                                                                                                                                                                                       |
| error / warning details          | `validSubsets`                                           | `expected`                                    |                                                                                                                                                                                                       |
| error / warning details          | `rootContributors`                                       | `contributors`                                | An array of module ids.                                                                                                                                                                               |
| error / warning details          | `firstContributor`                                       | —                                             | Dropped; read `contributors[0]`.                                                                                                                                                                      |
| error / warning details          | `cacheKey`                                               | `expected`                                    |                                                                                                                                                                                                       |
| error / warning details          | `entryModuleID`                                          | `received`                                    |                                                                                                                                                                                                       |
| error / warning details          | `manifestName`                                           | `expected / received`                         | MODULE\_MANIFEST\_NAME\_MISMATCH carries { package, expected (package.json), received (manifest) }.                                                                                                   |
| error / warning details          | `manifestVersion`                                        | `expected / received`                         | MODULE\_MANIFEST\_VERSION\_MISMATCH carries { package, expected (package.json), received (manifest) }.                                                                                                |
| error / warning details          | `handlersKeys`                                           | —                                             | Dropped; it listed internal handler names.                                                                                                                                                            |
| error / warning details          | `mountPathRoot`                                          | —                                             | Dropped; read `mount[0]`.                                                                                                                                                                             |
| error / warning details          | `resolvedPath`                                           | `resolved`                                    |                                                                                                                                                                                                       |
| error / warning details          | `packageRoot`                                            | `folder`                                      |                                                                                                                                                                                                       |
| error / warning details          | `chainLabel`                                             | `chain`                                       | An array in v4 (the message joins it).                                                                                                                                                                |
| error / warning details          | `maxDepth`                                               | `depth`                                       |                                                                                                                                                                                                       |
| error / warning details          | `validationError`                                        | —                                             | Internal flag, no longer stored on the details.                                                                                                                                                       |
| error / warning details          | `stub`                                                   | —                                             | Internal flag, no longer stored on the details.                                                                                                                                                       |
| versioning.list() entry          | `versionTag`                                             | `tag`                                         |                                                                                                                                                                                                       |
| versioning.list() entry          | `moduleID`                                               | `module`                                      |                                                                                                                                                                                                       |
| versioning.list() entry          | `versionedPath`                                          | `path`                                        | The mounted path as a segments array in v4 (`["v1", "auth"]`).                                                                                                                                        |
| versioning.list() entry          | `versionedParts`                                         | `path`                                        | Same array; `versionedPath` and `versionedParts` are one key in v4.                                                                                                                                   |
| versioning.list() entry          | `isDefault`                                              | `default`                                     |                                                                                                                                                                                                       |
| versioning.list() entry          | `versionMeta`                                            | `metadata`                                    |                                                                                                                                                                                                       |
| versioning.metadata.get() result | `logicalPath`                                            | `path`                                        | A segments array in v4 (`["auth"]`). `version` and `path` are reserved in version metadata: a key of either name you supply is replaced by the injected value (v3 reserved only `logicalPath`).       |
| diag.inspect() result            | `isLoaded`                                               | `loaded`                                      |                                                                                                                                                                                                       |
| diag.inspect() result            | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| diag.inspect() result            | `context.instances`                                      | —                                             | Other instances are not exposed; this instance's data is `instance`, `at`, `context` and `self`.                                                                                                      |
| diag.inspect() result            | `context`                                                | `runtime`                                     | The context manager group is `runtime` ({ type, running }); `context` now holds your context data.                                                                                                    |
| context.diagnostics() result     | `storeFromInstancesMap.createdAt`                        | `at`                                          |                                                                                                                                                                                                       |
| context.diagnostics() result     | `storeFromInstancesMap.context`                          | `context`                                     |                                                                                                                                                                                                       |
| context.diagnostics() result     | `storeFromInstancesMap`                                  | `context`                                     |                                                                                                                                                                                                       |
| context.diagnostics() result     | `baseContext`                                            | `base`                                        |                                                                                                                                                                                                       |
| context.diagnostics() result     | `currentALSContext`                                      | `current`                                     |                                                                                                                                                                                                       |
| context.diagnostics() result     | `currentInstanceID`                                      | `current`                                     |                                                                                                                                                                                                       |
| context.diagnostics() result     | `instanceID`                                             | `instance`                                    |                                                                                                                                                                                                       |
| context.diagnostics() result     | `managerType`                                            | `runtime`                                     | "async" or "live" (the config `runtime` words).                                                                                                                                                       |
| context.diagnostics() result     | `instancesMapKeys`                                       | —                                             | Dropped; other instances are not exposed.                                                                                                                                                             |
| context.diagnostics() result     | `instancesMapSize`                                       | —                                             | Dropped; other instances are not exposed.                                                                                                                                                             |
| diag.caches.get() result         | `totalCaches`                                            | —                                             | Dropped; read `caches.length`.                                                                                                                                                                        |
| diag.caches.get() result         | `timestamp`                                              | `at`                                          |                                                                                                                                                                                                       |
| diag.caches.get() result         | `folderPath`                                             | `folder`                                      |                                                                                                                                                                                                       |
| diag.caches.get() result         | `moduleID`                                               | `module`                                      |                                                                                                                                                                                                       |
| diag.caches.get() result         | `endpoint`                                               | `path`                                        |                                                                                                                                                                                                       |
| diag.caches.get() result         | `pathCount`                                              | `count`                                       |                                                                                                                                                                                                       |
| diag.owner.list() result         | `conflictedPaths`                                        | `conflicts`                                   |                                                                                                                                                                                                       |
| diag.owner.list() result         | `totalPaths`                                             | `paths`                                       |                                                                                                                                                                                                       |
| diag.owner.list() result         | `totalModules`                                           | —                                             | Dropped; read `modules.length`.                                                                                                                                                                       |
| diagnostics shape                | `storeFromInstancesMap`                                  | `context`                                     |                                                                                                                                                                                                       |
| diagnostics shape                | `baseContext`                                            | `base`                                        |                                                                                                                                                                                                       |
| diagnostics shape                | `currentALSContext`                                      | `current`                                     |                                                                                                                                                                                                       |
| diagnostics shape                | `currentInstanceID`                                      | `current`                                     |                                                                                                                                                                                                       |
| diagnostics shape                | `instancesMapKeys`                                       | —                                             | Dropped; other instances are not exposed.                                                                                                                                                             |
| diagnostics shape                | `instancesMapSize`                                       | —                                             | Dropped; other instances are not exposed.                                                                                                                                                             |
| diagnostics shape                | `contextKeys`                                            | —                                             | Dropped; read your context data from diag.inspect().context.                                                                                                                                          |
| diagnostics shape                | `selfKeys`                                               | `self`                                        | diag.inspect().self is the list of top-level api names.                                                                                                                                               |
| diagnostics shape                | `managerType`                                            | `runtime`                                     |                                                                                                                                                                                                       |
| diagnostics shape                | `totalCaches`                                            | —                                             | Dropped; read `caches.length`.                                                                                                                                                                        |
| diagnostics shape                | `conflictedPaths`                                        | `conflicts`                                   |                                                                                                                                                                                                       |
| diagnostics shape                | `pathCount`                                              | `count`                                       |                                                                                                                                                                                                       |
| error / warning                  | `error.context`                                          | `error.details`                               | SlothletError and SlothletWarning carry their extra fields on `.details` in v4 (the console label is "Details:"). Rewritten where the value is provably a slothlet error; reported everywhere else.   |
| error / warning                  | `error.originalError`                                    | `error.cause`                                 | Removed; the original throw is the standard `cause`.                                                                                                                                                  |
| error / warning                  | `@cldmv/slothlet/errors#SlothletWarning.suppressConsole` | —                                             | The process-wide switch is gone. Set `silent: true` in the slothlet() config to keep that instance's warnings off the console; warnings are still created and recorded (api.slothlet.warnings.get()). |
| error / warning                  | `new SlothletError(code, context, originalError, flags)` | `new SlothletError(code, details, { cause })` | The constructor takes (code, details, { cause }). The third positional originalError argument and the validationError / stub flags are gone.                                                          |

<!-- migration-table:data:end -->

### Framework-private names

Not public API. Listed only so test and documentation sweeps can find them.

<!-- migration-table:internal:start -->

| v3                               | v4                                 | Change  | Notes                                                                                                                                                                    |
| -------------------------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__displayName`                  | `____displayName`                  | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Debug-only; not reported by node().                                            |
| `__materializeOnCreate`          | `____materializeOnCreate`          | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Not reported by node().                                                        |
| `__state`                        | `____state`                        | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers).                                                                                |
| `__invalid`                      | `____invalid`                      | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers).                                                                                |
| `__impl`                         | `____impl`                         | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Raw impl alias; one name for \_impl and \_\_impl.                              |
| `_impl`                          | `____impl`                         | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Raw impl alias; folds with \_\_impl.                                           |
| `_materialize`                   | `___materialize`                   | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). A callable, so three underscores.                                              |
| `__childFilePaths`               | `____childFilePaths`               | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Impl-riding marker.                                                            |
| `__filePath (impl marker)`       | `____filePath`                     | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Impl-riding marker; distinct from the node self-report field of the same name. |
| `__childFilePathsPreMaterialize` | `____childFilePathsPreMaterialize` | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Impl-riding marker.                                                            |
| `__isVersionDispatcher`          | `____isVersionDispatcher`          | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers).                                                                                |
| `__logicalPath`                  | `____logicalPath`                  | renamed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers).                                                                                |
| `_module (metadata key)`         | —                                  | removed | Framework-private (\_\_\_\_ private / \_\_\_ callables; \_ and \_\_ belong to consumers). Removed from user metadata; served by node(target).manifest.                   |

<!-- migration-table:internal:end -->

## Removed items and their replacements

<!-- migration-table:removed:start -->

| Kind       | Removed                                                  | Use instead                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| config     | `allowMutation`                                          | v2 mutation lock (warned V3\_CONFIG\_DEPRECATED). Use api.mutations.{add,remove,reload}: false.                                                                                                       |
| config     | `collectLifecycleHooks`                                  | Deprecated alias of autoRoutines. Use routines.auto (default true in v4).                                                                                                                             |
| config     | `collision`                                              | Root-level alias of api.collision (warned V3\_CONFIG\_DEPRECATED). Use api.collision.mode.                                                                                                            |
| config     | `dir`                                                    | Alias of base (warned V3\_CONFIG\_DEPRECATED). Use base.                                                                                                                                              |
| config     | `permissions.references`                                 | Group dissolved; its only member, capture, moved to permissions.caller.capture.                                                                                                                       |
| config     | `permissions.enabled`                                    | Legacy boolean twin of mode. Use permissions.mode (true/false are now aliases of "on"/"off").                                                                                                         |
| config     | `scanHiddenFolders`                                      | Deprecated escape hatch (warned CONFIG\_SCAN\_HIDDEN\_FOLDERS\_DEPRECATED). Use hidden: ["!\*\*/.\*/", "!\*\*/\_\_\*/"].                                                                              |
| config     | `suppressFixes`                                          | Temporary v3 escape hatch for bug-fix behaviours (entries like "C03\_116"). No replacement.                                                                                                           |
| option     | `api.slothlet.api.add(options).scanHiddenFolders`        | Per-call form of the removed config option. Use options.hidden with '!' patterns.                                                                                                                     |
| option     | `api.slothlet.hook.on(pattern)`                          | The "type:pattern" prefix form ("before:math.\*", warned HOOK\_TYPEPATTERN\_PREFIX\_DEPRECATED) is removed. Write "math.\*:before".                                                                   |
| export     | `@cldmv/slothlet/helpers/sanitize#Sanitize`              | Internal component class; not exported in v4.                                                                                                                                                         |
| export     | `@cldmv/slothlet/errors#SlothletDebug`                   | Internal debug logger; moves to a private path.                                                                                                                                                       |
| export     | `@cldmv/slothlet/i18n#internals`                         | Internal guard accessor; not exported in v4.                                                                                                                                                          |
| method     | `api.slothlet.context.inspect`                           | Typedef-only since 3.0.0, never built. context.get() returns the whole context.                                                                                                                       |
| method     | `api.slothlet.diag.SlothletWarning`                      | The class is exported from @cldmv/slothlet/errors. Captured warnings: api.slothlet.warnings.get().                                                                                                    |
| method     | `api.slothlet.ownership`                                 | Typedef-only (slothlet.ownership.get / unregister), never built. Use slothlet.owner.get(path).                                                                                                        |
| method     | `api.slothlet.run`                                       | Alias removed; use context.run.                                                                                                                                                                       |
| method     | `api.slothlet.scope`                                     | Alias removed; use context.scope.                                                                                                                                                                     |
| node-field | `<node>.__metadata`                                      | User metadata via metadata.get(target); system facts via node(target).                                                                                                                                |
| node-field | `metadata.moduleID`                                      | Internal composite id; stays private. Use node(target).module for the public id.                                                                                                                      |
| node-field | `metadata.taggedAt`                                      | Removed; node() does not report it.                                                                                                                                                                   |
| data       | `@cldmv/slothlet/errors#SlothletWarning.suppressConsole` | The process-wide switch is gone. Set `silent: true` in the slothlet() config to keep that instance's warnings off the console; warnings are still created and recorded (api.slothlet.warnings.get()). |

<!-- migration-table:removed:end -->
