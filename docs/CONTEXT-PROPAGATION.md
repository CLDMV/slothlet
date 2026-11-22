# Context Propagation

Slothlet provides automatic context preservation across all asynchronous boundaries in your API modules. Context is maintained through EventEmitters, class instances, and all other async patterns without any configuration or code changes.

## Overview

Context propagation ensures that the `context` object and full `self` API access are available in every callback, event handler, and method call in your API modules, regardless of how deeply nested or asynchronous the code becomes.

**Key capabilities:**

- Automatic EventEmitter context propagation
- Transparent class instance context wrapping
- Per-request context isolation (`api.slothlet.context.run` / `api.slothlet.context.scope`)
- Configurable isolation modes (partial and full)
- Zero configuration required for automatic propagation
- Works with all async patterns (TCP, HTTP, custom EventEmitters)
- Clean shutdown support

## Table of Contents

- [Live Bindings](#live-bindings)
- [Per-Request Context Isolation](#per-request-context-isolation)
- [EventEmitter Context Propagation](#eventemitter-context-propagation)
- [Class Instance Context Propagation](#class-instance-context-propagation)

---

## Live Bindings

Access live-bound references in your API modules via the runtime module.

The runtime exports `self`, `context`, and `instance` (`instance.id` is the running instance's id: a string inside a call, undefined outside one). Note that `reference` is **not** a runtime export - reference data is merged directly into the API at initialization and is accessible via `self` alongside your API modules.

```javascript
// Reference data is merged directly into the API - accessible via self
const api = await slothlet({
	base: "./api",
	reference: {
		md5: (str) => crypto.createHash("md5").update(str).digest("hex"),
		version: "3.0.0",
		utils: { format: (msg) => `[LOG] ${msg}` }
	}
});
// api.md5, api.version, api.utils are all available
// Inside API modules: self.md5, self.version, self.utils
```

### ESM Module Example

```javascript
// In your API modules (ESM)
import { self, context } from "@cldmv/slothlet/runtime";

export function myFunction() {
	console.log(context.user); // Access live context
	return self.otherModule.helper(); // Access other API modules

	// Reference data is merged directly into the API and accessed via self
	const hash = self.md5("hello world");
	console.log(self.version); // Access reference data
}

export function processData(data) {
	// Call another module from anywhere in the API tree
	const processed = self.cjsModule.process(data);

	// Use reference utilities directly via self
	const logged = self.utils.format(`Processed: ${processed}`);
	return self.md5(logged);
}
```

### CJS Module Example

```javascript
// In your CJS modules
const { self, context } = require("@cldmv/slothlet/runtime");

function cjsFunction(data) {
	console.log(context.env); // Access live context

	const hash = self.md5(data); // Reference data accessed via self

	return self.esmModule.transform(hash); // Access ESM modules from CJS
}

module.exports = { cjsFunction };
```

### TypeScript Module Example

`.ts` and `.mts` modules use the same import — `self`, `context`, and `instance` are all reachable from TypeScript exactly as they are from `.mjs`. (Slothlet writes the transpiled output to a project-local cache file so Node's resolver can anchor the bare specifier; details in [TYPESCRIPT.md](TYPESCRIPT.md). This was fixed in v3.5.0 — earlier versions could not import bare specifiers from `.ts` files.)

```typescript
// In your TypeScript modules
import { self, context, instance } from "@cldmv/slothlet/runtime";

interface RequestContext {
	requestId?: string;
	user?: { id: string };
}

export function tsFunction(data: string): string {
	const ctx = context as RequestContext;
	const tag = `${instance.id}/${ctx.requestId ?? "anon"}`;
	const hash = self.md5(data);
	return `[${tag}] ${self.esmModule.transform(hash)}`;
}
```

### Timers and queues a file starts while it loads

A file's top level runs under the file's own module: the async runtime loads each file inside a store that names it, and the live runtime pins what the file registers while it loads. So a timer, a job queue or a listener started at the top of a file has `self` and `context` when it runs later, and the permission system sees the file's module as the caller of whatever it runs (see [PERMISSIONS.md](PERMISSIONS.md#file-level-code-has-its-own-permission-path)). `self` is not usable at the top level itself while the file is still loading: the api is not built yet. A file that builds another slothlet instance while it loads can use that instance as usual: the inner instance's code, run from something the loading file started, reads its own `self` and `context`.

One case is held to the wrong file: when two api files import a module with its own top-level `await` and the other file started loading it, a timer this file starts at its top level while it waits is held to the other file's module (async runtime). It only refuses more, never allows more; see [PERMISSIONS.md](PERMISSIONS.md#file-level-code-has-its-own-permission-path) and [#762](https://github.com/CLDMV/slothlet/issues/762).

### `AsyncLocalStorage.snapshot()`, `bind()` and `AsyncResource` in the live runtime

These three capture Node's async context when they are made and restore it when they run code. In the async runtime slothlet's store is part of that context, so code they run later is the module that made them. The live runtime keeps identity outside Node's async context, so it patches them: `AsyncLocalStorage.snapshot()`, `AsyncLocalStorage.bind()`, and `AsyncResource` (its constructor, `runInAsyncScope()`, which a resource's `bind()` runs through, and the static `AsyncResource.bind()`). What a snapshot, a bound function or a resource runs is pinned to the load or call of the module that made it (or to the host's `run()` / `scope()` it was made in), so the code of the module that made it carries that module and that call's context, with the call that runs it as a caller too, as in the async runtime.

Whoever holds a resource chooses the code it runs, so the pin is kept only for the code it was made for. The rule is the async runtime's for code that enters another flow by itself (see [below](#code-that-enters-another-flow-by-itself-async-runtime)), told from the stack:

- **The maker's own code keeps the pin**: a function of the module (or the file's load, or the host) that made the resource, run through it by anyone (as a pool runs a requester's callback), and code that function calls. So does any code the maker's own code, or the host's, runs through the resource.
- **Anyone else's code runs as the code that used the resource**: a module running its own function through another request's resource, snapshot or bound function, or through one another module's file made while it loaded, runs as its own call, with its own request's context, as if nothing had been pinned. This holds whatever `permissions.caller.provenance` says, and with the permission system off: such code never reads the other request's context, never acts as the module that made the resource, and never writes as it.
- **Told when the code first reads anything** (`context`, `self`, a call into the api, a callback it registers), and again on each read until the code is found to be someone else's; from then on the rest of that stretch of synchronous code runs as the code that used the resource. In Node the code is also told when it makes its first promise (its first `await`, say), so an async function of the maker's that awaits before reading anything keeps the maker's context and caller after its `await`s, as on the async runtime, while anyone else's async function run through the resource picks up after its `await` as the code that used the resource. In a browser (no promise hooks) an async function that reads nothing before its first `await` is not told in time, so the pin is not held for what runs after that `await`: that code is told from the stack like any code no pin holds, and a function of the maker's that awaits first then sees the context of whichever flow runs it, not the maker's.
- **The runner slothlet hands Node is not a way in.** The patched `runInAsyncScope()` calls Node's own method through a reference taken when slothlet loads, and the runner it passes runs only the function slothlet's code put there: code that replaces `runInAsyncScope` on the class's prototype and calls the runner it receives with a function of its own runs that function unpinned.

- **No store of slothlet's own.** The live runtime creates and runs no `AsyncLocalStorage`; slothlet makes its store when the first instance on the async runtime is created. On Node 22 a store that has run switches async hooks on for the whole process, so a process whose instances all use the live runtime leaves them off (`AsyncResource` and the patches here do not switch them on).
- **Live runtime only.** An instance on the async runtime patches nothing. The patches are installed when the first live instance in the process is created and removed when the last live instance shuts down; while any live instance is running they stay in place.
- **Code outside slothlet is unchanged.** A snapshot, binding or resource made while no module's load or call is running pins nothing, and Node's own functions run as they are. Arguments, receivers and results pass through.
- **`AsyncResource` is a different class object while patched.** `require("node:async_hooks").AsyncResource` (and the ES module export, which Node refreshes) is a subclass of Node's class while the patches are installed. `instanceof` answers as before against either class, but comparing the class with `===` against a reference saved before the first live instance (or after the last one shut down) is `false`.
- **A subclass made earlier keeps Node's class.** A library that subclassed `AsyncResource` before the first live instance was created extends Node's class, not the patched one, so its resources are not pinned. The same holds for the class kept in a variable before then (`const { AsyncResource } = require("node:async_hooks")` at the top of a file loaded earlier); an ES module's named import follows the refreshed export.
- **Node's `AsyncContextFrame`.** Where it is off (Node 22's default, or Node 24 and later run with `--no-async-context-frame`), Node keeps what every `AsyncLocalStorage` holds on async resources module code can reach. With permissions on, the permission baseline's `async-context-frame` check reports it ([PERMISSIONS.md](./PERMISSIONS.md#the-baseline)), and strict does not start.
- **Not tested against third-party users of these APIs.** The patches are covered by slothlet's own tests; libraries that build on `AsyncResource` or `AsyncLocalStorage.snapshot()` / `bind()` have not been tested against them.

### Code that enters another flow by itself (async runtime)

Node gives a flow's async context to any code that holds an async resource of that flow: an `AsyncResource` made there (its `runInAsyncScope()` and `bind()`), a function `AsyncLocalStorage.snapshot()` or `AsyncLocalStorage.bind()` made there, or the context Node keeps on a timer or a resource, copied onto a timer of the code's own. The same holds for what a module's file makes while it loads, which carries that module's load. A module's code that runs itself in another request's flow, in a `run()` / `scope()` the host opened, or in another module's load this way does not get that flow. It acts outside it, as the leaf it is written in, with the instance's own context: `context` holds the instance's keys and none of the flow's, `metadata.self()` names the module's own leaf, `metadata.caller()` returns `null`, permission rules (and their `condition`s) are checked for the module against the instance's context, and it has none of the host's standing. Code no single leaf stands for (evaluated code, a file several instances hold untold apart) is refused.

The flow is told by the code running, read from the stack: the frames from the access out to where slothlet entered a call, or where the job began. These keep the flow:

- **The flow's own code**: the host's code, and the code of the calls of the flow (the call and the calls above it), including after an `await` and in a timer or listener of their own.
- **Code the flow's own code calls**: a module's function the host or a call of the flow calls, synchronously, keeps the flow it is called in, after an `await` too.
- **A call's own function run through its resource**: a module holding a call's `AsyncResource` that runs the call's own callback with it (as a pool runs a requester's callback) gives that callback the call's flow.
- **A resource's scope put in place by the flow's own code**: the host or a call of the flow running another module's function with a resource of the flow.

Once a module's code that entered a flow by itself is told apart, the rest of that stretch of synchronous code runs outside the flow, and so does everything it hands Node from there: a promise's `then()`, a timer, the code after its own `await`. A function or an api node it hands Node (`Promise.resolve(x).then(self.other.read)`) runs outside the flow when Node calls it, with the instance's own context, as a call the module made itself would. The flow's own code running there keeps the flow: the host's code the module's code calls, and the owner of the resource running it again. With `AsyncContextFrame` off (Node 22, or a later Node run with `--no-async-context-frame`) Node keeps the store on the async resource itself; slothlet takes it back off once that stretch of synchronous code ends, so a job the resource's owner hands Node through the same resource within that same stretch also runs outside the flow.

A module's function the flow's own code hands Node to call later keeps the flow too: passed straight to `promise.then()`, `setTimeout()`, `setInterval()`, `setImmediate()`, `queueMicrotask()` or `process.nextTick()`, or added as a listener of an event Node emits. Nothing of the flow's is on the stack when Node calls it, which is the shape of code that entered the flow by itself, so such a job is told by where it was made instead of by its frames (below). The function itself is what a call hands back, inside a `run()` or `scope()` or outside every run, so `===` holds between the two and `emitter.off(fn)`, a `Set` or a `Map` key, or a memoised lookup find it again; with the permission system on and `permissions.caller.attribution` at its default (`"precise"`), it comes back as its module's stand-in instead, the same one every time. What a module's async function runs after an `await` is part of the job that ran it, and keeps the flow the same way.

A `run()` / `scope()` is isolated in every permission mode (no `permissions` config, `"off"`, `"disabled"`, `"on"`, `"strict"`): code that entered another run by itself never gets that run's context or the identity `metadata.self()` / `metadata.caller()` report there, whether the permission system is on or not. The permission mode decides only what such code is allowed to do. A job such code hands Node is told apart too, even when the code never touches slothlet inside the flow (it reads `self.other.read` outside, then only passes it to `promise.then()`, `setTimeout()`, `setImmediate()`, `queueMicrotask()` or a nested `AsyncResource` inside): slothlet installs an `async_hooks.createHook()` hook (two, see below) while any instance on the async runtime exists, whatever its permission mode, and removes it after the last one shuts down. The live runtime and the browser install no hook. The hook returns at once for a resource made outside every flow, but Node runs it for every promise and callback in the process: measured on Node 26 per `await` of a `then()` (three promises), it adds about 0.9 µs outside every flow and about 1.3 µs inside a `run()` or a call, and per `await` of a `setImmediate()` about 0.9 µs outside and 3.2 µs inside (Node 22, and Node 26 with `--no-async-context-frame`: about 0.9 µs and 1.2 µs per promise `await`, 0.9 µs and 3.5 to 4 µs per immediate). A timer's callback costs the same as an immediate's, which next to a timer's own millisecond is lost in the noise.

The same hook records the jobs the flow's own code hands Node, and these are told by where they were made instead of by their frames. A promise's job the flow's code made runs in the flow when Node runs it: the code after an `await` in a module's function the flow called (a closure a call was handed, say), and a function passed to `then()`. So does a timer, an interval, an immediate, a microtask or a `process.nextTick()` callback the flow's code made, as long as it still runs the function it was made with: a timer whose callback was replaced after it was made, or a microtask's resource entered again by code that got hold of it, does not count. A promise and a tick object carry the async id `AsyncResource.prototype.runInAsyncScope()` reads, so code holding one (a promise the host handed it inside a `run()`, the object `executionAsyncResource()` returns inside a tick callback) can run its own function in that job's scope later, with `AsyncContextFrame` on after copying the context frame of a resource of the flow onto it. Only a job Node itself began counts: Node begins a promise's or a tick's job with no other callback running below it, a tick's only once, and a promise's without running async hooks that leave promises out, so slothlet installs a second hook created with `trackPromises: false` alongside the first. A scope put in place by code is told by its frames instead: a module's own code acts outside the flow, as above, and the host's code keeps it. The second hook runs for every callback that is not a promise's (timers, immediates, ticks, I/O) and is lost in the noise of the costs above. Node 22 and 24 releases whose async hooks cannot leave promises out (22.15, 24.0) read the stack instead, once per stretch of synchronous code that reads the context or calls the api inside a promise's job of the flow: about 75 µs on Node 22.15. A function bound to an async resource of the flow (`resource.bind(fn)`, `AsyncResource.bind(fn)`) that the flow's code hands Node through a promise's `then()`, a timer, an immediate or a microtask runs in the flow when Node calls it, as the bind means; a timer whose callback was replaced after it was made does not count. A bound function a module hands Node from its own flow, or from inside a flow it entered by itself, still runs outside. A listener the flow's own code adds to an `EventEmitter` (`server.on("connection", fn)`, `once()`, `prependListener()`, the host's code or a call of the flow adding it) runs in the flow whenever Node emits the event, whoever wrote the listener; one a module adds from inside a flow it entered by itself runs outside that flow, whoever emits.

Telling the code apart reads the stack once per stretch of synchronous code that runs in a flow without slothlet having entered it there (the code after an `await`, a timer's callback, a resource's scope), and again for each access inside an async resource's scope. Code slothlet runs inside a call it entered, and everything that code calls, is not read. The live runtime keeps identity outside Node's async context: for its resources, snapshots and bound functions see [above](#asynclocalstoragesnapshot-bind-and-asyncresource-in-the-live-runtime); for how it keeps concurrent `run()` / `scope()` flows apart see the [runtime note](#concurrent-run-and-scope-flows-in-the-live-runtime) under per-request context.

### `self` takes the api root's form

`self` answers what the host's `api` answers for the same instance. When the base folder's root file exports a function as its default, the api root is that function, and so is `self`: `typeof self` is `"function"`, `self(…)`, `Reflect.apply(self, …)` and `new self(…)` call the root under the root's call rule (see [PERMISSIONS.md](PERMISSIONS.md#read-level-gating)), and `Object.prototype.toString`, `instanceof Function` and `Object.getPrototypeOf(self)` report the root function. For an object root `self` is an object, as `api` is. The form is the one `api` took when the instance was first built: a reload that changes the root's kind changes neither.

```javascript
// api/root.mjs
export default function root(n) {
	return n * 2;
}

// api/tools/twice.mjs
import { self } from "@cldmv/slothlet/runtime";
export const twice = (n) => self(n); // same as api(n) from the host
```

Each instance's files get the form of their own instance, even with instances of both kinds running at once. The binding is live: `self` read when the code runs has the right form. Three cases see the other form:

- **A copy taken while the instance is first built, before the root's kind is known.** The kind is known once the root file has loaded. When the source of exactly one file at the base folder's top level plainly makes its default export a function (`export default function …`, `export default async (…) => …`, `export default class …`, `export default name` with `name` declared as one of those, or `module.exports = function …`), slothlet evaluates that file first, so every other file, its siblings beside it included, gets the callable form from its first import. Three kinds of file evaluate before the kind is known and keep the object form in a copy they take while they load (`const s = self` at their top level, or `self` taken from an `import()` that settles during the load): a file the root file imports itself (it is evaluated before the root file), every top-level file when the root's default export is computed (`export default make()`, a re-export) and so cannot be told from the source, and every top-level file when more than one of them looks like a root. Their live binding takes the callable form once the root is known, so `self` read when the code runs is right. `self.call(…)` calls the root in either form. A full reload knows the form from the start.
- **A browser page with instances of both kinds.** A browser resolves a leaf's import of the runtime through the page's import map, which slothlet cannot steer per instance: every leaf of the page shares one `self`, callable while every running instance has a function root and an object otherwise. Use `self.call(…)` to call the root from a page that mixes both kinds.
- **A file loaded by neither of slothlet's import hooks.** Under Node the resolve hook gives each instance's files their own `self`; under vitest, the `@cldmv/slothlet/vite` plugin does. A file that neither reaches (host code importing the runtime, a leaf of a module graph slothlet's plugin is not in) gets the shared `self` the browser case describes.

### Writable `self.X = …`

`self` is writable. Assigning to `self` from inside a Slothlet module persists the value for the instance's lifetime, makes it visible to other modules through `self.X` and to the outside through `api.X`.

A reload rebuilds the instance from disk and replays its add/remove operation history — a runtime `self.X = …` write is **not** part of that history, so it does **not** survive a reload. (A write a module performs in its module-init body does reappear — because the module body re-executes during the rebuild, not via any replay.)

```javascript
import { self } from "@cldmv/slothlet/runtime";

// From inside a module mounted at api.lib.config, with permissions on:
export function init() {
	self.lib.config.computed = derive(); // ✓ allowed (under own mount point)
	self.somethingElse = "x"; // ✗ throws LOOSE_SET_NOT_OWNED
	self.lib.ssh.connect = () => {}; // ✗ throws LOOSE_SET_NOT_OWNED (another module's subtree)
}
```

Four rules govern a module's writes into the api. What they refuse is refused only while the permission system is on; with it off (no permissions configured) nothing below refuses a write, and a module writes anywhere, as host code does, apart from the framework's own namespace, root functions, and keys on api nodes, which stay the framework's unless the system is disabled (see [Modes](PERMISSIONS.md#modes)). The views and wrap-on-set described below work the same either way, and ownership is recorded either way.

- **Owner-scoped writes.** A module's writes are restricted to its own mount-point subtree. A module mounted at `api.lib.config` can write `self.lib.config.*` but not `self.lib.ssh.*` or any other top-level namespace. The rule holds at every depth, not only at the top level of `self`: assigning, `Object.defineProperty`, and `delete` on a member of another module's subtree (`self.lib.ssh.connect = …`, `delete self.lib.ssh.connect`) are refused the same way, and so are `Object.setPrototypeOf`, `Object.preventExtensions`, `Object.seal`, and `Object.freeze` on a node of another module's subtree. A refused seal or freeze leaves the node as it was. The same holds for what a module reaches through another module's node that is no node of its own, such as a class's `prototype` or a method of it (`self.lib.ssh.Client.prototype.connect = …` is refused), and for symbol-keyed members. Changing `self` itself follows the top-level rule: `Object.defineProperty(self, "x", …)` and `delete self.x` are `self.x = …`'s writes, a definition that would fix a member on `self` (`configurable: false`) is refused, and `self` keeps its prototype and stays extensible, since one `self` serves every module of every instance. Modules mounted at the same point (`api.slothlet.api.add()` twice at one `apiPath`) share it, so each may write under it. There is no write without the read, though: while the permission system is on, a module replaces, redefines, or deletes a member (its own or another module's) only where it would be allowed to read that member, so a module refused the read of its neighbour's function (by a deny with no suffix, `:read`, `:access` or `:full`, or the default policy) is refused replacing it too (`PERMISSION_DENIED`); a member that does not exist yet is refused only by a rule that refuses the writer that path. External code (no module-bound caller) and base-module code own the whole tree and can write anywhere. A `:write` or `:full` permission rule changes that for the callers it names: an allow grants a write outside what a module owns, a deny refuses one inside it (see [Write Permissions](PERMISSIONS.md#write-permissions)). A module that calls `api.slothlet.api.add()` / `remove()` / `reload()` is subject to that call's own permission rules, not to this one: the writes the framework makes to mount, remove, or rebuild are the framework's, not the module's. That covers those writes only. The module's own code that runs while the call is in flight, before or after an `await`, and any other call of the same module, are still held to the rule. The error code on violation is `LOOSE_SET_NOT_OWNED`.
- **A write through a node read from `self` belongs to the module that read it.** A node read through `self` is a view of the node, not the object `api` holds: it reads, calls, and enumerates as the node does, and `self.lib.ssh === self.lib.ssh`, but `self.lib.ssh !== api.lib.ssh`. What it hands back of the node is a view too: a member read off it, the `value` of `Object.getOwnPropertyDescriptor()` / `Object.getOwnPropertyDescriptors()`, and what a method called through it returns, also when the method returns a node it read itself, so `return self.lib.ssh` from another module's method hands the caller its own view, not the other module's. A method called through the view runs as its own module: called on the node it was read from (`self.lib.ssh.method()`), it gets its own module's view of that node as `this`, the one it reads through `self`, so inside it `this === self.lib.ssh` and a callback that keeps `this` can write the module's own node later. Anything else reaches it exactly as the caller passed it: every argument, and a receiver the caller steers onto some other node with `.call()` / `.apply()` (`self.lib.ssh.method.call(self.other.node)`, or `.call(self.lib.other)` onto another node of the same module). So a method that keeps or returns an argument hands back what it was given (`keep(x); all().includes(x)` and `box(x).x === x` hold for the caller), and a view the caller passed never gains the method's module's standing, however the method or a hook on it hands it on. The other side of this: inside the method, an argument is not `===` to the module's own read of the same node (`arg !== self.lib.ssh` when a caller passes its own view of it); compare with `this`, or by api path, instead. A class instance or `EventEmitter` exported as a node, or an object the host grafted into the tree, which its own methods get as `this` itself, comes back from `self` as a view of that node, never as the instance; a module that steers some method onto such a node (`self.my.mutate.call(self.svc.store)`) hands that method its own view, so the method's writes through `this` are held to the caller like any other write through it. A function another module handed over (a callback it returned) that a module stores in its own subtree is that module's node: called through it, it runs as the storing module, with the storing module's view as `this`. Storing it is the storing module's choice. A node a module returns inside a plain object or array (`return { ssh: self.lib.ssh }`) is handed over as it is: the module chose to share it, and its writes through it are the module's. While a module is executing, a write through the view is held to the executing module like any other write. Inside an `api.slothlet.context.run()` / `scope()` callback the host opened, it is the host's, as a write through `self` there is. A callback a module handed out runs as that module whoever calls it ([PERMISSIONS.md → Code a module hands out runs as that module](PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer)), so its writes are held to that module like any write it makes: refused with `LOOSE_SET_NOT_OWNED` outside what the module owns. Anywhere else (code no call into a module is running and no module made, such as host code writing through a view a module returned) it is held to the module that read the node: it goes through when that module owns the node's path, and throws `CONTEXT_NOT_ACTIVE_SELF` when it does not. So `const state = self.lib.config.state; return () => state.n++` keeps working when the host calls it later, and the host can write through a node a module returned from its own subtree, but a module that keeps `const ops = self.lib.ssh` cannot write `ops.x = …` later from a callback it handed out. A module that is no longer mounted (removed, or gone with the instance a restart replaced) owns nothing: neither a call of it still in flight nor a function it handed out can write into the api any more. A full `reload()` rebuilds ownership from scratch: while it runs, between clearing the old records and registering the rebuilt tree, no module owns anything, so a write a still-mounted module's in-flight call (or a callback it handed out) makes in that window is refused, and goes through again once the reload has settled. This fails closed on purpose; retry the write after `await api.slothlet.reload()` resolves. Storing the view (`self.lib.config.ssh = self.lib.ssh`) stores the node. The framework's own `self.slothlet`, `self.shutdown`, and `self.destroy` are returned as the framework's own views of them, which run what the module later does with them as that module, inside an isolated `scope()` as outside one. The same holds for what the framework hands a module outside a call: a hook handler a module registers gets that module's view of every node in its payload (the `args`, the `result`, what `next()` returns) and, as `api`, a view of the whole tree whose top-level writes follow the `self.X = …` rule, while what it hands back reaches the call as the call's own values; and a `lifecycle` subscriber a module subscribes through `self.slothlet.lifecycle.on()` gets that module's view of the node an `impl:*` event is about as `impl`, or `null` when the node is not in the tree yet (`impl:created` fires while the node is being built). Hooks and lifecycle subscribers the host registers get the values themselves, as before.
- **Unattributable writes are refused.** Under the live runtime, code that resumes in a file several in-flight calls share can match more than one of them. A write such code makes into the api (through a node it read earlier, say) cannot be checked against one owner, so it throws `LOOSE_SET_UNATTRIBUTED` instead of being treated as the host's. This fails closed: it applies even when the write is into the module's own subtree, because which module is writing is exactly what cannot be told. Keeping code that writes after an `await` out of a file that several overlapping calls resume in avoids it.
- **Wrap-on-set for callables and objects.** When the assigned value is a function or object, it gets a `UnifiedWrapper` (the same wrapper construction `api.slothlet.api.add()` uses). Primitives stay as-is. **Limitation:** hook / permission / lifecycle integration on synthetic wrappers from `self.X = …` is incomplete — for fully lifecycle-integrated mounts, use `api.slothlet.api.add()`.

The wrapper is a **live, two-way view** onto the assigned object, not a copy. This holds wherever the assignment lands, including on a leaf mounted with `api.slothlet.api.add()`, and in both eager and lazy mode:

- A raw write to the original object is visible through the view.
- A write through the view lands on the original object. This covers every value type: primitives, objects, arrays and functions, at any depth. The value is stored on the underlying object and served back wrapped from it on read. The view never keeps its own copy, so a later raw update of the same key is visible through the view too.

```javascript
// Inside a module mounted at api.devices.d1:
const connection = { deviceFeatures: [], onUnhandledPacket: null };
self.devices.d1.connection = connection;

// Anywhere else:
api.devices.d1.connection.deviceFeatures = ["cmd"];
connection.deviceFeatures; // ["cmd"] (the same array)

api.devices.d1.connection.onUnhandledPacket = (packet) => handle(packet);
typeof connection.onUnhandledPacket; // "function"

connection.deviceFeatures = ["later"];
[...api.devices.d1.connection.deviceFeatures]; // ["later"]
```

The view is not identical to the object (`api.devices.d1.connection !== connection`), because it is a wrapper. `instanceof`, method calls (which run with the real object as `this`) and native objects such as `EventEmitter` and `net.Socket` all behave as they do on the original. Values read through the view are still read-gated by [permissions](PERMISSIONS.md), including values that were written through the view. A write that the underlying object refuses, for example because it is frozen, throws a `TypeError` just like a direct assignment in strict mode.

This applies only to the assigned object and everything beneath it. Assigning a new key directly on an ordinary module namespace (`api.store.extra = {…}`) still stores a wrapped override on that namespace, as described above.

This was fixed in v3.5.0. Before that, `self.X = …` was silently dropped (proxy default-set onto an empty literal target).

---

## Per-Request Context Isolation

Slothlet provides dedicated methods for executing functions with isolated context data, enabling per-request context isolation in HTTP servers, multi-tenant applications, and other scenarios requiring request-specific state.

### Overview

`api.slothlet.context.run()` and `api.slothlet.context.scope()` execute a callback with temporary context data that:

- Does **not** affect the global instance context after the callback returns
- **Inherits** from and merges with the current context
- Supports **shallow** and **deep** merge strategies
- Supports **full** (default) and **partial** isolation modes
- **Automatically propagates** through all async boundaries inside the callback

### API Reference

#### api.slothlet.context.run(contextData, callback, ...args)

Executes a callback function with isolated context data. `.run()` is shorthand for `.scope()` with the instance's `scope` defaults: shallow merge and full isolation unless the config says otherwise.

**Parameters:**

- `contextData` (Object) - Context data to merge with current context
- `callback` (Function) - Function to execute with isolated context
- `...args` (any) - Arguments forwarded to the callback

**Returns:** Result of the callback function

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	base: "./api",
	context: { app: "myApp", version: "1.0" }
});

const result = await api.slothlet.context.run(
	{ userId: "alice", requestId: "req-123" },
	async (data) => {
		// context = { app: "myApp", version: "1.0", userId: "alice", requestId: "req-123" }
		return api.processRequest(data);
	},
	{ payload: "test data" }
);

// After callback: context reverts to { app: "myApp", version: "1.0" }
```

#### api.slothlet.context.set(key, value) / set(object)

Changes the instance-level context every leaf reads. Pass one key and its value, or an object of keys and values.

```javascript
const api = await slothlet({ base: "./api", context: { tenant: "acme" } });

api.slothlet.context.set("region", "eu");
api.slothlet.context.set({ tenant: "globex", region: "us" });

api.slothlet.context.get(); // { tenant: "globex", region: "us" }
```

- **The context passed to `slothlet()` is copied.** Its top-level keys are copied when the instance loads, so changing that object later changes nothing, and `set()` never writes to it. The values themselves are the ones given (an object in it is shared, not cloned).
- **A `run()` / `scope()` keeps its own keys.** A run in progress sees the new value of every key it did not supply itself; the keys it supplied (and those it `protect`s or `owners`) still win inside it. A run started after `set()` starts from the new values.
- **Protected and owned keys are enforced.** Inside a `scope()` that protects a key, or where another owner owns it, `set()` on that key throws `CONTEXT_KEY_PROTECTED`, as a write through the runtime `context` does.
- **Reload keeps it.** `api.slothlet.reload()` carries what `set()` made into the rebuilt instance; [`restart()`](RELOAD.md#apislothletrestart) starts again from the config's context.
- **Host only by default.** A built-in rule denies `slothlet.context.set` to module code while the permission system is on; grant it with a rule on that exact target (see [PERMISSIONS.md](PERMISSIONS.md#contextset--host-only-by-default)).
- A key named `__proto__`, `constructor` or `prototype`, or anything but a key with a value or one plain object, throws `INVALID_ARGUMENT`.

#### api.slothlet.context.scope({ context, fn, args, merge, isolation, protect, owners })

Executes a function with isolated context using structured options.

**Parameters:**

- `context` (Object) - Context data to merge
- `fn` (Function) - Function to execute
- `args` (Array, optional) - Arguments array for the function
- `merge` (String, optional) - Merge strategy: `"shallow"` (default) or `"deep"`
- `isolation` (String, optional) - Isolation mode: `"full"` (default) or `"partial"` - overrides instance default
- `protect` (String[], optional) - Context keys locked write-once/unowned for this scope — see [Owner-Locked & Write-Protected Keys](#owner-locked--write-protected-keys)
- `owners` (Object, optional) - Map of `{ key: ownerApiPath }` binding a context key to the module allowed to write it — see [Owner-Locked & Write-Protected Keys](#owner-locked--write-protected-keys)

> **Note:** `protect` / `owners` are only accepted as `scope()` / `run()` **options**. `run()`'s positional arguments after the callback are forwarded to the callback, not read as options.

**Returns:** Result of the function

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	base: "./api",
	context: { config: { timeout: 5000 } }
});

// Shallow merge (default) - replaces entire config object
const result1 = await api.slothlet.context.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { retries: 3 } (config.timeout lost)
		return api.fetchData();
	}
});

// Deep merge - merges nested properties
const result2 = await api.slothlet.context.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3 } (merged)
		return api.fetchData();
	},
	merge: "deep"
});
```

### Owner-Locked & Write-Protected Keys

By default, any module that receives the runtime `context` proxy can write any context key. For requests that carry sensitive per-request state — an authenticated `userId`, a signed token, a spend budget — a scope can lock specific keys so a later module cannot overwrite them (added in v3.12.0).

- **`protect: string[]`** — the listed keys become write-once/unowned. Their value is seeded from `context`, and any later write via the runtime `context` proxy throws `CONTEXT_KEY_PROTECTED` — including writes to **nested** fields (see [Nested values](#nested-values) below).
- **`owners: { key: ownerApiPath }`** — binds a key to a named owner module. Only a writer whose executing-module API path equals the owner (or is a leaf under it) may write the key — again, at any depth; any other writer throws `CONTEXT_KEY_PROTECTED`.

```javascript
// Lock userId for the duration of the request — no downstream module can change it
await api.slothlet.context.scope({
	context: { userId: "alice", scratch: {} },
	protect: ["userId"],
	fn: async () => api.handleRequest()
});

// Bind `budget` to the billing module — only billing.* may write it
await api.slothlet.context.scope({
	context: { budget: 1000 },
	owners: { budget: "billing" },
	fn: async () => api.runPipeline()
});
```

Ownership inherits down nested scopes: a child scope sees the parent's owned keys and **cannot re-claim** a key another owner already holds (throws `CONTEXT_KEY_OWNED`). Naming the same key in both `protect` and `owners` in one call, or claiming a key the parent already owns, is likewise rejected with `CONTEXT_KEY_OWNED`. Invalid option shapes throw `SCOPE_PROTECTED_KEYS_INVALID` (a non-string-array `protect`) or `SCOPE_KEY_OWNERS_INVALID` (a non-plain-object `owners`, or an owner value that is not a non-empty string), each reporting the offending shape. The owner map is built with a null prototype and checked via `hasOwnProperty`, so a caller-supplied `__proto__` / `constructor` key is treated as ordinary data rather than reaching `Object.prototype`.

#### Nested values

The lock is not limited to the top layer. When a protected/owned key holds a **plain object or array**, that value is handed back through a recursive protected view, so a write to any nested field is enforced exactly like a top-level write:

```javascript
await api.slothlet.context.scope({
	context: { auth: { userId: "alice", roles: ["reader"] } },
	protect: ["auth"],
	fn: async () => {
		context.auth = { userId: "mallory" }; // throws CONTEXT_KEY_PROTECTED — key: auth
		context.auth.userId = "mallory"; // throws CONTEXT_KEY_PROTECTED — key: auth.userId
		context.auth.roles.push("admin"); // throws CONTEXT_KEY_PROTECTED — key: auth.roles.1
		const id = context.auth.userId; // reads work normally
	}
});
```

The error's `key` reports the full path (`auth.userId`), and a named owner may still write nested fields of a key it owns — a different module cannot. Guarding applies **only** to keys named in `protect` / `owners`; every other context key is returned raw and stays fully runtime-mutable, nested writes included.

The reported path is a best-effort diagnostic label: when one nested object is reachable through several paths under the same protected key (`context.auth.a === context.auth.b`), the view keeps the first path it was read through, so an error for a write via the other alias names the sibling path. The enforcement decision is identical either way — both aliases are governed by the same key's owner — and aliased reads keep exact `===` identity, which is why the label is not path-split.

Depth caveat: only **plain objects and arrays** are wrapped (null-prototype objects count as plain). A protected key whose value is a `Date`, `Map`, `Set`, or class instance is returned as the raw object — wrapping it would break its methods without actually guarding it, since such values mutate through method calls rather than property writes. Reassigning the key itself is still blocked; internal mutation of a non-plain value is not. Keep protected per-request identity as plain data (e.g. `{ userId, sessionId }`) to get full-depth protection.

#### Authorization facts belong in a principal, not a context key

Owner-locked keys protect **who the caller is** (an authenticated `userId`, a verified token). Facts **derived** from that identity for authorization — a user's roles, an org's plan — are better resolved by a [principal](./PERMISSIONS.md#principals) than stored in context. A context key holding them depends on every establishment site remembering `protect`/`owners`; nothing ties the value to a trusted resolver; and nothing invalidates it, so a long-lived extent (a background job, a timer, a persistent link) keeps a stale snapshot after a role is revoked. A principal keys off the context (`key: (ctx) => ctx.userId`), is resolved by the module that owns it, is cached per identity with explicit invalidation, and reaches rule conditions only as a read-only view.

### Isolation Modes

`isolation` governs **`self`** only — context is isolated in both modes (the per-request context store is discarded on scope exit regardless).

In both modes everything else a run changes is the run's own: permission rules, hooks, metadata, event and lifecycle subscriptions, and the api tree. Changes to the tree made inside `.run()` / `.scope()` through `api.slothlet.api.add()`, `remove()` and `reload()` (and `reload()`, `restart()` and `shutdown()` themselves) give the run a copy of the tree on its first such change, and every later write into the tree from the run lands in that copy, never in the instance (see [RELOAD.md](RELOAD.md#calls-during-a-full-reload-and-after-one-fails)).

#### Full Isolation (Default)

Child `self` is the run's own api, taken when the run starts. A write through it (top-level or deep, an assignment, `Object.defineProperty` or `delete`) goes through the same checks a write outside a run meets: reserved keys and invalid paths are refused, a module writes only where it owns or a `:write` rule lets it, and the writer is the one the runtime attributes the write to (module code reached through a global included). A write that passes is kept by the run instead of being made on the instance, and is read back in the run: a synchronous write made before the run has a tree of its own included. A read goes through the ordinary read path every time, so each caller is answered as the read gate answers it, a value the run wrote included: a caller refused a member is refused it after another module wrote it. Nodes come back as the run's views of them, a lazy node's included, so a write made under one stays in the run; data and built-in objects (a `Map`, a `Buffer`, a `Date`) come back as outside a run. Once the run has a tree of its own (its first `api.slothlet.api.add()` and the like), what it kept is written into that tree and `self` reads and writes the run's tree, so `api` and `self` agree in the run. Mutations made through `self` do **not** persist outside `.run()`. A change to a node itself, its prototype (`Object.setPrototypeOf`) or its extensibility (`Object.preventExtensions`, `Object.seal`, `Object.freeze`), is a write at the node's path, checked as an assignment is, and kept by the run: the run reads the prototype it set and inherits through it, and closing a node closes the run's view of it while the node stays open. A class's `prototype` read through a node comes back as the run's view of it: a write to it, or to an object or array below it, is checked as a write at its path and kept by the run, and an instance the run constructs through the class (a subclass's included) inherits through that view, so it sees what the run wrote and `instanceof` holds. Limits: a data object with internal state (a `Map`, a `Date`) and an array or object a module returns are shared with the instance as module state is, so a change made inside one is not the run's own; and a prototype set or a closing made before the run has a tree of its own is not carried into that tree.

```javascript
const api = await slothlet({ base: "./api" }); // default: full isolation
```

#### Partial Isolation

Opt-in. Child `self` is the base `self`, so a write through `self` from the run reaches the instance and persists after the run ends, by design. Only `self` is shared: the rest of what the run changes stays in the run as described above. A synchronous write through `self` from a run that has not changed its tree yet lands in the instance's tree; once the run has a tree of its own, its writes land there.

```javascript
const api = await slothlet({
	base: "./api",
	scope: { isolation: "partial" }
});
```

#### Per-Call Override

The isolation mode can be overridden on a per-call basis regardless of the instance default:

```javascript
// Instance default: full
const api = await slothlet({ base: "./api" });

// Override to partial isolation for this specific call
await api.slothlet.context.scope({
	context: { requestId: "123" },
	isolation: "partial",
	fn: async () => {
		// Self is the instance's own; writes through it persist after this scope
	}
});
```

#### Disable Per-Request Context

Set `scope: false` to disable `.run()` and `.scope()` entirely. Any attempt to call them will throw at runtime.

```javascript
const api = await slothlet({ base: "./api", scope: false });
```

### Context Isolation Guarantees

Per-request context is deep-cloned (via the function-tolerant `deepClone`) before merging. This means:

- Mutations to `context` properties inside `.run()` do **not** propagate back to the parent context
- Nested objects in context are independent copies - mutations are not shared
- **Callables are shared by reference; every other value is deep-copied.** A function — or a callable Proxy, since `typeof` reports it as `"function"` — placed on `context` is kept **by reference**: it can't be reconstructed from a property copy, and a live callable (a factory, a callback, a callable rpc handle) is meant to be shared, not cloned (#408). Every **non-function** value — plain objects, arrays, dates, and **non-callable** service handles such as a typical class-instance `db` or `logger` — is deep-copied for isolation; a class instance is copied as plain data and **loses its prototype methods** in the process. So if a scope needs a live non-callable handle, reach it through `self.*` or expose it as a function, rather than placing the instance directly on `context`.

```javascript
const api = await slothlet({
	base: "./api",
	context: { config: { count: 0 } }
});

await api.slothlet.context.run({ extra: true }, async () => {
	// Mutating a nested object does NOT affect the parent
	const ctx = await api.slothlet.context.get();
	ctx.config.count = 999; // ← does not persist
});

const base = await api.slothlet.context.get();
console.log(base.config.count); // 0 - parent context unchanged
```

### Cross-Instance Behavior

When calling `api.slothlet.context.get()` from inside another instance's `.run()` block, the called instance returns its own **base context** - not the calling instance's child context. This provides clear instance isolation.

```javascript
const api1 = await slothlet({ base: "./api1", context: { app: "one" } });
const api2 = await slothlet({ base: "./api2", context: { app: "two" } });

await api1.slothlet.context.run({ userId: 100 }, async () => {
	// api1.slothlet.context.get() → { app: "one", userId: 100 } ✅

	// Calling api2 from inside api1's run block:
	const ctx2 = await api2.slothlet.context.get();
	// ctx2 = { app: "two" } - api2's BASE context, not api1's child context

	// If you need api1's context inside api2 code, capture it first:
	const api1Ctx = await api1.slothlet.context.get();
	await api2.slothlet.context.run({ requestId: "abc" }, async () => {
		console.log(api1Ctx.userId); // 100 - explicit capture works
	});
});
```

### Context Inheritance

Nested `.run()` calls within the same instance inherit from their parent scope:

```javascript
const api = await slothlet({
	base: "./api",
	context: { app: "MyApp", level: 0 }
});

await api.slothlet.context.run({ level: 1, user: "alice" }, async () => {
	// context = { app: "MyApp", level: 1, user: "alice" }

	await api.slothlet.context.run({ level: 2, requestId: "req-123" }, async () => {
		// context = { app: "MyApp", level: 2, user: "alice", requestId: "req-123" }
		// "user" is inherited from the outer scope
		await api.processData();
	});

	// Back to: { app: "MyApp", level: 1, user: "alice" }
});

// Back to: { app: "MyApp", level: 0 }
```

### Merge Strategies

#### Shallow Merge (Default)

Top-level properties are merged; nested objects are replaced wholesale:

```javascript
const api = await slothlet({
	base: "./api",
	context: { config: { timeout: 5000, retries: 3 }, user: "alice" }
});

await api.slothlet.context.run({ config: { maxSize: 1000 } }, async () => {
	// context.config = { maxSize: 1000 } - timeout and retries are gone
	// context.user = "alice"             - top-level key preserved
});
```

#### Deep Merge

Nested objects are recursively merged:

```javascript
await api.slothlet.context.scope({
	context: { config: { maxSize: 1000 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3, maxSize: 1000 }
		// context.user = "alice"
	},
	merge: "deep"
});
```

### HTTP Server Example

```javascript
// server.mjs
import slothlet from "@cldmv/slothlet";
import http from "node:http";
import { randomUUID } from "node:crypto";

const api = await slothlet({
	base: "./api",
	context: { app: "MyApp", version: "1.0.0", environment: "production" }
});

const server = http.createServer(async (req, res) => {
	const result = await api.slothlet.context.run(
		{
			requestId: randomUUID(),
			userId: req.headers["x-user-id"],
			ip: req.socket.remoteAddress,
			path: req.url,
			method: req.method
		},
		async () => {
			// All API calls in this scope see the merged context
			const data = await api.handleRequest(req);
			api.logger.info("Request processed successfully");
			return data;
		}
	);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(result));
});

server.listen(3000);
```

```javascript
// api/logger.mjs
import { context } from "@cldmv/slothlet/runtime";

export function info(message) {
	const { requestId, userId, path } = context;
	console.log(`[INFO] [${requestId}] [${userId}] ${path} - ${message}`);
}

export function error(message) {
	const { requestId, userId, path } = context;
	console.error(`[ERROR] [${requestId}] [${userId}] ${path} - ${message}`);
}
```

### Multi-Tenant Example

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	base: "./api",
	context: { app: "SaaS Platform", sharedConfig: { apiVersion: "v1" } }
});

async function handleTenantRequest(tenantId, requestData) {
	return await api.slothlet.context.scope({
		context: {
			tenant: {
				id: tenantId,
				database: `db_${tenantId}`,
				features: await getTenantFeatures(tenantId)
			}
		},
		fn: async () => {
			// context = { app, sharedConfig, tenant }
			await api.validateTenantAccess();
			const result = await api.processData(requestData);
			api.logger.info(`Processed request for tenant ${tenantId}`);
			return result;
		},
		merge: "deep" // Deep merge to preserve sharedConfig properties
	});
}

// Process multiple tenants concurrently - each has its own isolated context
const results = await Promise.all([
	handleTenantRequest("tenant-001", { action: "create" }),
	handleTenantRequest("tenant-002", { action: "read" }),
	handleTenantRequest("tenant-003", { action: "update" })
]);
```

> **Performance**: Per-request context uses `AsyncLocalStorage.run()` internally, which is highly optimized in Node.js. Context data is deep-cloned for isolation (via a function-tolerant `deepClone` that shares only callables — functions and callable proxies — by reference) - performance overhead is minimal.

#### Concurrent `run()` and `scope()` flows in the live runtime

`run()` and `scope()` flows are isolated from each other on both runtimes and in every permission mode: no code sees or takes another flow's context, and each flow's calls report their own caller. The async runtime keeps each flow in an `AsyncLocalStorage` store. The live runtime (`runtime: "live"`, and every instance in a browser) uses no `node:async_hooks`; it keeps the active flow in one field and carries it as follows:

- **Callbacks a flow registers** through a boundary slothlet patches run in that flow whenever they fire, whichever flow is open then and also after the `run()` / `scope()` has returned: timers, `setImmediate()`, `process.nextTick()`, `queueMicrotask()`, `requestAnimationFrame()` and `requestIdleCallback()`, EventEmitter and DOM event listeners, observers, and reactions passed to `then()` / `catch()` / `finally()`. A callback the host registers outside every flow runs in the instance's own context. This holds in Node and in a browser.
- **A scheduler written back over the patch.** Code that read one of these functions before slothlet patched it, swapped in its own for a while and then wrote back what it had read takes the patch out. vitest does this with `process.nextTick` around the messages its worker sends to the main process, writing the old value back a tick later, so a wrapper installed in between is lost and two overlapping messages leave Node's own function in place. Where the function written back is exactly the one under slothlet's wrapper, the live runtime puts the wrapper back when the next `run()` / `scope()` or module call starts. A different function (fake timers, another library's wrapper) owns the slot and is left alone; a callback it schedules is carried only if it calls the wrapper it found.
- **Callbacks of Node's callback-style APIs**, in Node: Node calls these from the event loop, past every boundary above, so slothlet replaces each function below while a live instance exists with one that pins its callback (its last argument, when that is a function) to the flow and caller that called it, as a timer's is. Covered: every callback form in `node:fs` (`access`, `appendFile`, `chmod`, `chown`, `close`, `copyFile`, `exists`, `fchmod`, `fchown`, `fdatasync`, `fstat`, `fsync`, `ftruncate`, `futimes`, `lchmod`, `lchown`, `link`, `lstat`, `lutimes`, `mkdir`, `mkdtemp`, `open`, `opendir`, `read`, `readdir`, `readFile`, `readlink`, `readv`, `realpath` and `realpath.native`, `rename`, `rm`, `rmdir`, `stat`, `statfs`, `symlink`, `truncate`, `unlink`, `utimes`, `write`, `writeFile`, `writev`, and `Dir`'s `read()` / `close()`); `node:dns` (`lookup`, `lookupService`, `reverse`, `resolve` and every `resolve*`, on the module and on `dns.Resolver` instances); and `node:crypto` (`argon2`, `checkPrime`, `decapsulate`, `diffieHellman`, `encapsulate`, `generateKey`, `generateKeyPair`, `generatePrime`, `hkdf`, `pbkdf2`, `randomBytes`, `randomFill`, `randomInt`, `scrypt`, `sign`, `verify`). Already carried without a patch, because Node delivers them through an emitter, `process.nextTick()` or a promise: zlib's callback forms (`gzip`, `deflate`, `brotliCompress`, …), `child_process.exec()` / `execFile()` and child-process events, `fs.cp()`, `fs.glob()`, `fs.watch()` / `fs.watchFile()`, streams and `stream.pipeline()` / `finished()`, `http` / `https` / `net` / `dgram` callbacks, and every promise API (`fs.promises`, `dns.promises`, `util.promisify()` of any of these). The replacement keeps the function's `name`, `length` and promisify support, and outside every flow and module call it hands the callback on untouched after one check. It costs about 1 µs per call inside a `run()` or a module call and about 0.4 µs per call outside (measured on Node 26 and 22: issuing `fs.stat(path, cb)` went from about 4 to 5 µs inside a `run()`), next to the call's own file-system round trip. `require("node:fs")`, a default import and `import { readFile } from "node:fs"` all see it (Node refreshes the ES module bindings when the patch goes in and when it comes out). **Not covered:** a reference taken before the first live instance was created, such as `const { readFile } = require("node:fs")` at the top of a file loaded earlier, or `fs.readFile.bind(fs)`, keeps Node's own function, so its callback is not carried (a function `util.promisify()` made earlier is fine: its promise carries the flow). Callback APIs of other builtins and of native addons that call back from the event loop are not covered either; read what such a callback needs before making the call, or use the API's promise form. `crypto.randomInt(…, cb)` needs one more step on the async runtime: Node serves overlapping calls from one shared fetch and calls every waiting callback from the async context of the call that started it, so a bare `AsyncLocalStorage` hands the second flow the first one's store. While an async-runtime instance exists, slothlet's `randomInt` takes the value from the synchronous form (which refills the cache in place when it is empty) and hands it to the callback through `process.nextTick()`, as Node does for every value the cache already holds, so each flow sees its own there too. No other function listed above mixes flows this way.
- **The code after an `await`**, in Node: while a live instance exists, slothlet installs V8's promise hooks (`v8.promiseHooks`, not `async_hooks`), records on each promise the flow it was made in, and runs each of its jobs in that flow. Interleaved flows waiting at `await`s each pick up in their own store, code after the `run()` call goes on in the flow it was in, and a `run()` nested in another one's callback, synchronously, in a timer or after an `await`, inherits from it. The hooks are removed after the last live instance shuts down. They cost every promise job in the process about 0.15 µs (measured on Node 26: an `await` loop went from about 0.05 to about 0.2 µs per step), and a callback a flow registers through a patched boundary about 1 µs more (an immediate loop went from about 1.7 to 2.9 µs per step inside a `run()`).
- **Work a flow leaves behind** keeps the flow after its `run()` / `scope()` has returned, as on the async runtime: a timer or an interval set in the callback, a listener it added, a promise chain or a module call it started without waiting for it, and what those start in turn all run in the run's context. This is what the middleware shape `run(ctx, next)` relies on when `next` returns before the request has finished. A `reload()` of the instance in between changes nothing: work a finished run left behind still runs in that run's context afterwards, on both runtimes. The run's store stays alive only through the work that holds it: each such callback and each promise made in the flow keeps it, and it is put back among the instance's stores only while that work runs synchronously, so no other flow and no host code outside every flow sees it. Once the timers have fired, the intervals are cleared, the listeners are removed and the promises are gone, nothing holds the store and it is collected; an interval or a long-lived listener keeps it for as long as it is registered. The run's copy of the instance (its api tree, rules, hooks and metadata, see `docs/RELOAD.md`) is not left to collection: slothlet counts that same work explicitly, on both runtimes, and tears the copy down once the run has returned and the count reaches zero. A promise collected before it settles, and a listener whose emitter or target is collected, leave the count then: nothing can run their code any more. A value the run hands out through the runtime `context` export is not counted and does not keep the copy.
- **What a flow asks of the instance**: `api.slothlet.api.add()` / `remove()`, `reload()`, `restart()` and `shutdown()` asked for in a `run()` / `scope()` act on the run's own copy, and the build of a reload's or a restart's new copy is told apart from every other caller, through these same flows: the live runtime needs no `AsyncLocalStorage` for either, and reaches exactly as far as it carries a run's context (in a browser, the limit after a bare `await` below applies to them too).
- **A native promise with a `then` of its own** (an own property set on the promise object) returned from a `run()` callback is settled differently on the two runtimes: the async runtime calls that `then` inside the run, as it adopts the result, while the live runtime and a plain `await` of the result do not call it inside the run. Neither carries the run's context out of the run.
- **In a browser** there are no promise hooks, so the code after a bare `await` is not guaranteed its own flow while flows interleave: the field names the last `run()` / `scope()` entered until it returns, so a flow's code that picks up after a bare `await` can see the context of a flow opened after it (or the instance's own, once that flow has returned). This is a platform limit. Sequential `run()` calls are unaffected, a new `run()` opened beside a waiting one takes the instance's own context, and callbacks registered through the patched boundaries above are carried. For concurrent requests in a browser, read what a flow needs before its first `await`, register follow-up work through a callback, or give each concurrent flow its own instance.

> **Overlapping calls in the live runtime**: while several module calls are waiting at an `await`, the live runtime tells which of them picked up again from the call stack. Where the stack names a set of calls rather than one (several waiting calls of one file with the job picking up in an unnamed function, or another module's async function picking up inside a waiting call whose file does not import it), permission checks are held to every call of the set (see [PERMISSIONS.md](PERMISSIONS.md#runtime-choice--the-permission-boundary), Overlapping calls), and `context` is not told per call: the code sees the context of the store those calls are waiting on. Calls made on the same store (outside any `run()`, or inside one `run()`) share that context, so it is the right one; calls of different `run()` flows are on different stores (see above). Once every `run()` has returned, the host's next call runs with the instance's own context, as on the async runtime. `metadata.caller()` reports the caller of the call of the set that started waiting first. The async runtime knows the call and has neither limit. Telling the call in the live runtime is tracked in [#756](https://github.com/CLDMV/slothlet/issues/756).

---

## EventEmitter Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all EventEmitter callbacks using Node.js AsyncResource patterns. This ensures your API modules maintain full context access in event handlers without any configuration.

**Implementation**: `src/lib/helpers/eventemitter-context.mjs` patches `EventEmitter.prototype` once when the first slothlet instance is created. Each listener is wrapped with `AsyncResource` to capture and restore ALS context at registration time. A WeakMap tracks listeners for proper cleanup. When the last instance shuts down, no listener is removed: an emitter a module created can outlive slothlet (a `fetch` socket in undici's keep-alive pool, for example), so a listener registered with `on` is swapped back for the function the code registered, and one registered with `once` for a plain one-shot wrapper that holds nothing of slothlet's and reports that function through `.listener` (as Node's own `once` wrapper does). A listener that fires afterwards runs as plain code with no instance context.

### TCP Server Example

```javascript
// api/tcp-server.mjs
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function createTcpServer() {
	const server = net.createServer();

	server.on("connection", (socket) => {
		console.log(`User: ${context.user}`); // ✅ Context preserved
		console.log(`API keys: ${Object.keys(self).length}`); // ✅ Full API access

		socket.on("data", (data) => {
			console.log(`Session: ${context.session}`); // ✅ Context preserved in nested handlers
			const processed = self.dataProcessor.handle(data.toString());
			socket.write(processed);
		});

		socket.on("error", (err) => {
			self.logger.error(`Error for user ${context.user}: ${err.message}`);
		});
	});

	return server;
}

export function startServer(port = 3000) {
	const server = createTcpServer();
	server.listen(port);
	return server;
}
```

```javascript
// Usage
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	base: "./api",
	context: { user: "alice", session: "tcp-session" }
});

const server = api.startServer(8080);
```

### Key Characteristics

- **Automatic**: No configuration or code changes needed - works transparently in all API modules
- **Complete context**: Full `context` object and `self` access in all event handlers
- **Nested events**: Works at any depth (server → socket → custom emitters)
- **All EventEmitter methods**: `on`, `once`, `addListener` are all automatically context-aware
- **Clean shutdown**: AsyncResource instances are cleaned up during shutdown to prevent hanging processes
- **No global state**: Listeners capture context at registration time; multiple slothlet instances are supported

> EventEmitter context propagation works automatically in both lazy and eager modes. TCP servers, HTTP servers, custom EventEmitters, and any other event-driven patterns in your API modules maintain full slothlet context without any code changes.

---

## Class Instance Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all class instance method calls. When your API functions return class instances, slothlet wraps them transparently so all method calls maintain full context access.

**Implementation**: `src/lib/helpers/class-instance-wrapper.mjs` wraps class instances returned from `runInContext()` using a Proxy. Methods are cached per instance. Wrapping is applied recursively - nested class instances are also wrapped. Only an instance of a class a module wrote is wrapped: the language's and Node's own classes (`Array`, `Date`, `Map`, `EventEmitter`, `URL`, `Response`, `AbortController`, `Intl.NumberFormat`, …) keep their context on their own and are returned as they are.

The wrapper stands for the instance. Members are read and written on the instance itself, so a getter or setter over a `#private` field works. The same instance comes back as the same wrapper every time (`(await api.make()) === (await api.make())` for a leaf returning one instance, and a method returning `this` returns the wrapper). Handed back to the module that created it, the wrapper is the instance again, so the module's own `===` and `#field in value` checks hold. On the wrapper itself `#field in value` is false, as for any Proxy.

Code a module hands out that is not a class instance (a closure, a function inside returned data, a thenable, a generator) is not wrapped. Run by the host outside any call, it reads `self` and `context` as the instance it was made in gives them, told by the file its code is in; see [Code a module hands out runs as its definer](PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer). Code of a helper file (a file a leaf imports that is no api file itself) reads them the same way, as the instance whose api files import the helper.

### Data Processor Example

```javascript
// api/data-processor.mjs
import { self, context } from "@cldmv/slothlet/runtime";

class DataProcessor {
	constructor(config) {
		this.config = config;
	}

	process(data) {
		console.log(`Processing for user: ${context.user}`); // ✅ Context preserved
		console.log(`Request ID: ${context.requestId}`); // ✅ Context preserved

		const validated = self.validator.check(data);
		return this.transform(validated);
	}

	transform(data) {
		console.log(`Transforming for: ${context.user}`); // ✅ Context preserved in chained calls
		return self.utils.format(data);
	}
}

export function createProcessor(config) {
	// Return class instance - slothlet automatically wraps it
	return new DataProcessor(config);
}
```

```javascript
// Usage
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	base: "./api",
	context: { user: "alice", requestId: "req-123" }
});

const processor = api.createProcessor({ format: "json" });
const result = processor.process({ data: "test" }); // ✅ All methods have full context
```

### Key Characteristics

- **Automatic**: Class instances returned from API functions are automatically context-aware
- **Transparent**: No code changes needed - works with existing class patterns
- **Complete context**: Full `context` object and `self` access in all class methods, including nested calls
- **Recursive**: If a class method returns another class instance, that instance is also wrapped
- **Cached**: Method wrapping is cached per instance to avoid repeated overhead
- **Built-ins excluded**: `Array`, `Date`, `Map`, `Set`, `EventEmitter`, `ArrayBuffer`, `DataView`, `Buffer`, and all typed-array views are not wrapped (they handle their own context or have no need for it — and wrapping a binary buffer would break intrinsic accessors such as `.length` / `.byteLength`)

> Any class instance returned from your API functions automatically maintains slothlet context. This includes database models, service classes, utility classes, and any other object-oriented patterns - as long as the class is not a built-in type.

---

## See Also

- [Hooks Documentation](HOOKS.md) - Hook system with context access
- [Principals](PERMISSIONS.md#principals) - Async-resolved, cached authorization facts keyed off the context
- [README](../README.md) - Main project documentation
