/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-live.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:34 -07:00 (1791083014)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live bindings context manager (no AsyncLocalStorage)
 * @module @cldmv/slothlet/handlers/context-live
 * @internal
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";
import { setApiCallerPinner } from "@cldmv/slothlet/helpers/caller-pinning";
import { TRUSTED_ROOT, buildCapturedFlowStore } from "#handlers/trusted-root";

/**
 * Stack resolution found a frame naming more than one suspended call, so which of them is
 * executing cannot be determined. Distinct from "no frame matched", which merely means the caller
 * is not one of the suspended calls — see {@link LiveContextManager#getCallerIdentity}.
 * @type {symbol}
 * @private
 */
const AMBIGUOUS = Symbol("slothlet.callerIdentity.ambiguous");

/**
 * Marks a call pinned to the host (`runInContext(..., asHost)`, from `lockCaller.caller()` when the
 * pinned caller is the host) on the running-call stack. Unlike a context-only entry, which is looked
 * through, it answers "no module caller": the pinned callback runs as the host even when a module
 * invoked it synchronously.
 */
const HOST_ENTRY = Symbol("slothlet.callerIdentity.host");

/**
 * The `Error` constructor as it was at module load, before any leaf could run.
 *
 * Caller identity is read off a stack, so a leaf that can influence how stacks are produced can
 * influence who it appears to be. Capturing the constructor here means a later reassignment of the
 * global `Error` cannot redirect the capture.
 * @type {ErrorConstructor}
 * @private
 */
const PristineError = Error;

/**
 * Escape a literal for embedding in a RegExp.
 *
 * Function names reach the matcher from api paths, which are sanitised identifiers — but the
 * escape keeps a surprising name from being read as pattern syntax rather than text.
 *
 * @param {string} literal - Text to match literally.
 * @returns {string} Escaped source.
 * @private
 */
/**
 * The live manager that most recently registered the EventEmitter hooks.
 *
 * The helper's hooks are module-level, matching the existing context-checker registration, so a
 * pinned listener resolves the manager through this rather than capturing `this` — the listener can
 * outlive the call that registered it.
 * @type {LiveContextManager|null}
 * @private
 */
let liveContextManagerRef = null;

const escapeForRegExp = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Reduce a source location — a filesystem path or a URL — to a form two spellings of the same file
 * compare equal in.
 *
 * A stack frame names a module by URL (`file:///…/x.mjs?slothlet_instance=…`, percent-encoded),
 * while a wrapper records its file and a module its root folder as whatever the loader was handed —
 * usually a plain path. The scheme, query, hash and percent-encoding are dropped from a URL,
 * separators are made forward slashes, and a trailing slash is removed, so a root compares as a
 * prefix of the files inside it.
 *
 * @param {string} value - A path or URL.
 * @returns {string} The comparable form.
 * @internal
 *
 * @example
 * toComparablePath("file:///srv/app/api/x.mjs?slothlet_instance=a"); // "/srv/app/api/x.mjs"
 * toComparablePath("C:\\app\\api\\"); // "C:/app/api"
 */
export function toComparablePath(value) {
	// Some loaders (vitest's module runner among them) report a module by bare path with the loader's
	// cache-busting query still attached, so a query is dropped from a plain path as well.
	let text = String(value).replace(/\\/g, "/");
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
		text = text.replace(/[?#].*$/, "");
		try {
			text = decodeURIComponent(text);
		} catch {
			// A malformed escape cannot name a real file differently than it is spelled; compare it raw.
		}
		text = text.replace(/^file:\/\//i, "");
		// `file:///C:/x` → `C:/x`, the spelling a Windows path takes once its separators are normalised.
		if (/^\/[a-z]:\//i.test(text)) text = text.slice(1);
	} else {
		text = text.replace(/\?.*$/, "");
	}
	return text.replace(/\/+$/, "");
}

/**
 * Split one stack-trace line into the text naming the function and the location it runs at.
 *
 * Attribution must be decided by the location alone. The function name is printed first and is not
 * trustworthy — a computed method key (`{ ["/path/to/other/module.mjs"]() {} }`) puts arbitrary text,
 * including another module's path, into it. So the location is taken from where each engine puts
 * it, never searched for anywhere in the line:
 *
 * - V8: `at name (location)` — the last balanced parenthesis group — or `at [async ]location`.
 * - SpiderMonkey / JavaScriptCore: `name@location` — after the last `@` that starts a URL or path.
 *
 * The trailing `:line:column` is removed and the location reduced with {@link toComparablePath}.
 *
 * @param {string} line - One line of `Error#stack`.
 * @returns {{head: string, path: string}|null} The text before the location and the location's
 *   comparable path, or null for a line that is not a frame (the message line, an unbalanced one).
 * @internal
 *
 * @example
 * parseStackFrame("    at run (file:///srv/app/api/run.mjs?q=1:4:9)"); // { head: "at run ", path: "/srv/app/api/run.mjs" }
 * parseStackFrame("run@http://host/api/run.mjs:4:9"); // { head: "run", path: "http://host/api/run.mjs" }
 */
export function parseStackFrame(line) {
	const text = String(line).trim();
	let head = "";
	let location;
	if (text.startsWith("at ")) {
		if (text.endsWith(")")) {
			// Walk back from the closing parenthesis to its partner, so a location containing
			// parentheses of its own (`C:/Program Files (x86)/…`) stays whole.
			let depth = 0;
			let open = -1;
			for (let index = text.length - 1; index >= 0; index--) {
				if (text[index] === ")") depth++;
				else if (text[index] === "(" && --depth === 0) {
					open = index;
					break;
				}
			}
			if (open < 0) return null;
			head = text.slice(0, open);
			location = text.slice(open + 1, -1);
		} else {
			location = text.replace(/^at (?:async )?/, "");
		}
	} else {
		let at = -1;
		for (const match of text.matchAll(/@(?=[a-z][a-z0-9+.-]*:|\/)/gi)) at = match.index;
		if (at < 0) return null;
		head = text.slice(0, at);
		location = text.slice(at + 1);
	}
	return { head, path: toComparablePath(location.replace(/:\d+(?::\d+)?$/, "")) };
}

/**
 * Directory holding slothlet's own sources (`src/` or `dist/`).
 *
 * The frames at the top of every capture are the framework's — the gate, the wrapper, this
 * resolver. They are never attributed to a module by folder, even when a module's root folder
 * happens to contain slothlet's install (a base of `./` with slothlet in `node_modules`).
 * @type {string}
 * @private
 */
const FRAMEWORK_DIR = toComparablePath(new URL("../../", import.meta.url).href);

/**
 * Live bindings context manager (direct global state)
 * Uses direct instance tracking without AsyncLocalStorage overhead.
 *
 * Concurrency boundary: the active instance is tracked in a single global field
 * ({@link LiveContextManager#currentInstanceID}), so this manager isolates *sequential*
 * `run()`/`scope()` calls (each restores the prior instance on exit) but NOT *interleaved*
 * concurrent calls on the same instance — across an `await`, a sibling `run()` overwrites the
 * global and a resumed callback reads the wrong context. True per-async-flow isolation requires
 * AsyncLocalStorage (see {@link module:@cldmv/slothlet/handlers/context-async}); the live manager
 * is the deliberate trade-off for environments without `node:async_hooks` (browser/worker, see
 * #123) and for the lowest-overhead single-flow case. See docs/CONTEXT-PROPAGATION.md.
 * @public
 */
export class LiveContextManager {
	constructor() {
		this.instances = new Map(); // instanceID → context data
		this.currentInstanceID = null; // Currently active instance
	}

	/**
	 * Calls that have suspended at an `await` and not yet settled, for one instance.
	 *
	 * `currentWrapper` is one mutable field per store, so it can only name one call, and it is
	 * restored call by call as each settles — in settle order, not entry order — so once calls
	 * overlap it can name a call that is not running, or one that has already finished. The set of
	 * calls actually in flight is what {@link LiveContextManager#getCallerIdentity} reasons from
	 * instead: one suspended call is necessarily the caller of anything that is not a synchronous
	 * entry; two or more are told apart from the call stack.
	 *
	 * Tracked on the store rather than the manager because the manager is a singleton shared by
	 * every instance: a set held there would treat two instances running concurrently as ambiguous
	 * with each other, even though each has its own `currentWrapper` and neither can overwrite the
	 * other's. A Set rather than a counter because the resolver needs the candidates themselves.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {Set<object>} That instance's suspended-call set.
	 * @private
	 */
	#suspendedFor(store) {
		if (!store.__suspendedCalls) store.__suspendedCalls = new Set();
		return store.__suspendedCalls;
	}

	/**
	 * Module calls whose function body is executing synchronously right now, innermost last.
	 *
	 * A wrapper is pushed immediately before its function is applied and popped as soon as that
	 * application returns — for an async function, at its first `await`. While a wrapper is on this
	 * stack its code (or code it called synchronously) is what is running: an `await` continuation
	 * only ever resumes on an empty JavaScript stack, so no other flow can be executing underneath
	 * it. The top entry is therefore the caller, with no ambiguity to resolve — which is what makes a
	 * synchronously entered module (a nested leaf, or a `lockCaller`-pinned callback) attributable
	 * even while other calls are suspended and their async frames sit further down the stack (#512).
	 *
	 * @param {object} store - Instance context store.
	 * @returns {Array<object|symbol|null>} That store's synchronously-entered wrappers (`null` for a context-only entry, `HOST_ENTRY` for a host pin).
	 * @private
	 */
	#enteredFor(store) {
		if (!store.__enteredCalls) store.__enteredCalls = [];
		return store.__enteredCalls;
	}

	/**
	 * The identity a store carries when no module call is in flight on it.
	 *
	 * For an instance's base store that is no caller at all (host-initiated). For a `run()`/`scope()`
	 * store it is the caller inherited from the store it was derived from, so a module-initiated scope
	 * stays attributed to that module. Captured the first time the store is seen — before any call can
	 * have changed `currentWrapper` — because afterwards the field can be left naming a finished call.
	 *
	 * @param {object} store - Instance context store.
	 * @returns {object|null} The store's resting caller.
	 * @private
	 */
	#baselineFor(store) {
		if (!Object.prototype.hasOwnProperty.call(store, "__baselineWrapper")) store.__baselineWrapper = store.currentWrapper ?? null;
		return store.__baselineWrapper;
	}

	/**
	 * Resolve the caller identity for the call that is executing right now.
	 *
	 * Enforcement asks for identity through here rather than reading `store.currentWrapper`
	 * directly, because that field can only name one call and is restored out of order once calls
	 * overlap. In order:
	 *
	 * - **A synchronously entered call** — the top of the entered stack is executing now and is the
	 *   answer outright, however many other calls are suspended (see {@link LiveContextManager#enteredFor}).
	 * - **No call in flight** — the store's baseline: the host for an instance store, the inherited
	 *   caller for a `run()`/`scope()` store.
	 * - **One call suspended** — nothing else is in flight, so that call is the caller. The field is
	 *   not consulted: a call that settled after the synchronous caller that started it had returned
	 *   restores the field to that caller, which is then neither running nor suspended.
	 * - **Two or more suspended** — the true caller is taken from the call stack. The gated access
	 *   happens synchronously inside the resumed call's code, so a frame of it is on the stack;
	 *   interleaving can scramble a shared field, but not the stack, since each flow has its own.
	 *
	 * Only the suspended calls are candidates, so when the stack names none of them the caller is not
	 * one of the ambiguous calls and the baseline applies; when it names several it cannot tell apart,
	 * identity is reported as unresolved so enforcement fails closed rather than guessing.
	 *
	 * Live runtime only. The async manager scopes identity per flow with AsyncLocalStorage and has
	 * no such ambiguity.
	 *
	 * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
	 *   rather than from whichever instance is globally active. The manager is a singleton shared by
	 *   every instance, so the global `currentInstanceID` can point at a different `slothlet()` at the
	 *   moment this instance's access is enforced — either an outer leaf mid-boot of this nested
	 *   instance (its base store has no caller → treated as uncalled) or a concurrent sibling that
	 *   transiently overwrote the global while this instance's own call is parked at an `await` (its
	 *   store still holds the in-flight caller → resolved and enforced). Scoping the store keeps both
	 *   correct; a bare `currentInstanceID` read conflates them (#290). Omit for the legacy behavior.
	 * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}|undefined}
	 *   Identity for the executing call, or undefined when there is no active context.
	 * @public
	 */
	getCallerIdentity(instanceID) {
		const store = this.tryGetContext(instanceID);
		/* v8 ignore next — callers reach this only with an active instance. */
		if (!store) return undefined;
		// An identity captured at a moment when it was known to be reliable wins outright. The lazy
		// waiting-proxy path resolves the caller synchronously, inside that caller's own frame, and
		// then defers the actual invocation to a later turn — by which point the caller's frame has
		// been released and the stack can no longer name it. Honouring the earlier capture keeps the
		// answer from degrading just because enforcement runs late.
		if (store.__authoritativeWrapper) {
			return { currentWrapper: store.__authoritativeWrapper, callerWrapper: store.callerWrapper };
		}
		// Innermost synchronous entry that names a module. An entry without a wrapper (a context-only
		// `runInContext`) does not change who is calling, so it is looked through. A host pin does:
		// the callback runs as the host, even when a module invoked it synchronously (#477).
		const entered = this.#enteredFor(store);
		for (let index = entered.length - 1; index >= 0; index--) {
			if (entered[index] === HOST_ENTRY) return { currentWrapper: null, callerWrapper: null };
			if (entered[index]) return { currentWrapper: entered[index], callerWrapper: store.callerWrapper };
		}

		const suspended = this.#suspendedFor(store);
		if (suspended.size === 0) return { currentWrapper: this.#baselineFor(store), callerWrapper: store.callerWrapper };
		if (suspended.size === 1) {
			const [only] = suspended;
			return { currentWrapper: only.currentWrapper, callerWrapper: store.callerWrapper };
		}

		const resolved = this.#resolveSuspendedFromStack(suspended);
		// The stack could not tell which of several suspended calls is executing: a frame named more
		// than one of them (the same module suspended twice under different api paths, resuming in a
		// file they share), and no frame further out pinned a single one. Deny rather than pick: report
		// no caller AND mark it unresolved, so enforcement does not fall through to the host-initiated
		// exemption and hand it that privilege.
		if (resolved === AMBIGUOUS) {
			return { currentWrapper: null, callerWrapper: store.callerWrapper, unresolved: true };
		}
		if (resolved) return { currentWrapper: resolved.currentWrapper, callerWrapper: store.callerWrapper };

		// No suspended call is on the stack, so the caller is not one of them, and nothing entered
		// synchronously. What is running is the store's own resting flow — the host, or the scope's
		// inherited caller — never whichever call the field happens to name.
		return { currentWrapper: this.#baselineFor(store), callerWrapper: store.callerWrapper };
	}

	/**
	 * Module root folders for the instances the candidates belong to, longest first.
	 *
	 * Taken from each instance's module cache — the folder every `base`/`api.add()` module was loaded
	 * from — so a frame in any file of a module's folder can be attributed to that module, not only a
	 * frame in the exact file its suspended call entered through. Synthetic (in-memory) modules have
	 * no folder and contribute nothing. Longest first so a module mounted from inside another
	 * module's folder owns its own files.
	 *
	 * @param {Array<{currentWrapper: object}>} candidates - Suspended calls being resolved.
	 * @returns {Array<{moduleID: string, root: string}>} Module roots, longest first.
	 * @private
	 */
	#moduleRootsFor(candidates) {
		// Every candidate is a live wrapper, which always reaches its instance's cache; the optional
		// chain guards a partially-built wrapper handed in by a direct caller.
		/* v8 ignore next */
		const caches = new Set(candidates.map((entry) => entry.currentWrapper?.slothlet?.handlers?.apiCacheManager).filter(Boolean));
		const roots = [];
		for (const cache of caches) {
			for (const moduleID of cache.getAllModuleIDs()) {
				const { folderPath } = cache.get(moduleID);
				// No base directory (`base: null`) and in-memory modules have no folder to own files by.
				if (typeof folderPath !== "string" || folderPath.startsWith("synthetic:")) continue;
				roots.push({ moduleID, root: toComparablePath(folderPath) });
			}
		}
		// An empty root (a module mounted from `/`) would own every absolute path; it owns nothing.
		return roots.filter(({ root }) => root).sort((a, b) => b.root.length - a.root.length);
	}

	/**
	 * Pick which suspended call the current stack belongs to.
	 *
	 * Walks the frames innermost first, reading each frame's location (never its function name, see
	 * {@link parseStackFrame}). A frame is matched to candidates two ways:
	 *
	 * - **by file** — the location is the file a candidate entered through;
	 * - **by module** — otherwise, the location lies in a module's root folder and that module has
	 *   suspended calls: a call that resumes in a helper or sibling file of its module (the entry
	 *   file's frame is gone once a plain function hands back another file's promise) is still that
	 *   module's (#512). The deepest root wins, so a module mounted inside another's folder owns its
	 *   files; slothlet's own frames are never matched by module.
	 *
	 * Enforcement keys on the api path, so a frame settles the answer only when its matches share
	 * one. A by-file frame can also pin one of several by the function name before its location. A
	 * frame matching several api paths otherwise narrows the answer to them: walking on is only
	 * allowed to pick one of those, because an outer frame belonging to anything else is an outer
	 * caller — the flow that awaited this one — not the code that is running. Ending the walk still
	 * narrowed is ambiguous and fails closed.
	 *
	 * @param {Set<{currentWrapper: object, filePath: string|null, comparablePath: string, moduleID: string|null, apiPath: string, fnName: string}>} suspended - Candidate calls.
	 * @returns {object|symbol|null} The matching entry, {@link AMBIGUOUS} when the stack cannot tell
	 *   several candidates apart, or null when no frame names any candidate.
	 * @private
	 */
	#resolveSuspendedFromStack(suspended) {
		// Host-pinned calls (`lockCaller.caller()` with no module caller) are tracked with no filePath:
		// they have no module frame to match. When only those are suspended, no candidate can match.
		const candidates = [...suspended].filter((entry) => entry.filePath);
		if (!candidates.length) return null;
		const roots = this.#moduleRootsFor(candidates);

		// Raise the frame budget for this capture only: the caller's frame sits below slothlet's own
		// wrapper frames, and the default of 10 can cut it off in a deep chain.
		//
		// `prepareStackTrace` is neutralised for the duration as well. It is a writable global hook,
		// so a leaf can install one that returns an empty or forged trace — which would blank the
		// frames this resolver matches on, and a caller that cannot be attributed would otherwise be
		// let through as though it were the host. Forcing the engine's own formatter (and using the
		// `Error` captured at load) keeps the capture out of a leaf's reach. Both globals are
		// restored immediately, so a legitimate consumer's formatter is unaffected.
		const previousLimit = PristineError.stackTraceLimit;
		const previousPrepare = PristineError.prepareStackTrace;
		PristineError.stackTraceLimit = 50;
		PristineError.prepareStackTrace = undefined;
		// The `?? ""` arm covers an Error with no stack. V8 always populates it here — the class is
		// captured pristine precisely so a leaf cannot blank it — so the fallback guards an engine that
		// does not, not a state this suite can produce.
		/* v8 ignore next */
		const stack = String(new PristineError().stack ?? "");
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;

		let narrowed = null;
		for (const line of stack.split("\n")) {
			const frame = parseStackFrame(line);
			if (!frame) continue;
			// A browser-mode wrapper records its file relative to the manifest root, so a relative path
			// matches as a whole-segment suffix of the frame's location; an absolute one must be equal.
			let matched = candidates.filter((entry) => frame.path === entry.comparablePath || frame.path.endsWith("/" + entry.comparablePath));
			const byFile = matched.length > 0;
			if (!byFile) {
				if (frame.path.startsWith(FRAMEWORK_DIR + "/")) continue;
				const owner = roots.find(({ root }) => frame.path.startsWith(root + "/"));
				if (!owner) continue;
				matched = candidates.filter((entry) => entry.moduleID === owner.moduleID);
				// A module with nothing suspended: its code is running on some candidate's behalf (a
				// helper it lent), so keep walking out to that candidate.
				if (!matched.length) continue;
			}
			if (narrowed) {
				matched = matched.filter((entry) => narrowed.includes(entry));
				if (!matched.length) return AMBIGUOUS;
			}
			if (new Set(matched.map((entry) => entry.apiPath)).size === 1) return matched[0];

			// Different functions of one file: the frame names the function as well as the file. Only
			// the text before the location is searched, so a name inside the path cannot match by
			// accident. Not tried for a by-module frame — the function there is the helper's, not the
			// candidate's.
			if (byFile) {
				const byName = matched.filter((entry) => entry.fnName && new RegExp(`\\b${escapeForRegExp(entry.fnName)}\\b`).test(frame.head));
				if (byName.length && new Set(byName.map((entry) => entry.apiPath)).size === 1) return byName[0];
			}
			narrowed = matched;
		}
		return narrowed ? AMBIGUOUS : null;
	}

	/**
	 * Whether the currently-active flow belongs to the given instance — its base store, a
	 * `run()`/`scope()` child of it (`<id>__run_*`), or an instance whose `parentInstanceID` is it.
	 *
	 * Enforcement resolves a caller/store scoped to the instance doing the enforcing rather than to
	 * whichever instance happens to be globally active, so a nested instance's own boot is never
	 * enforced against an outer instance's ambient caller (#290). The manager is a singleton shared
	 * by every instance, so without this a leaf that boots a second `slothlet()` leaks its identity
	 * into the second instance's construction. Mirrors the child-context test in {@link LiveContextManager#runInContext}.
	 *
	 * @param {string|null} currentID - The globally-active instance id (`this.currentInstanceID`).
	 * @param {string} instanceID - The instance to test membership against.
	 * @returns {boolean} True when the active flow is that instance or a child scope of it.
	 * @private
	 */
	#flowBelongsToInstance(currentID, instanceID) {
		if (!currentID) return false;
		if (currentID === instanceID) return true;
		if (currentID.startsWith(instanceID + "__run_")) return true;
		return this.instances.get(currentID)?.parentInstanceID === instanceID;
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			return this.currentInstanceID !== null;
		});
		// The AsyncResource capture in the EventEmitter helper restores an AsyncLocalStorage context,
		// which this manager does not use — and in a browser AsyncResource does not exist at all. A
		// listener registered by a module therefore had no captured identity of its own; it worked only
		// because this manager's active-instance field outlives every call, so `self` resolved for
		// whatever happened to be running. Pinning the registering module here gives that propagation a
		// real implementation, and attributes the listener to the module rather than to the host.
		setApiCallerPinner((listener) => {
			const store = this.tryGetContext();
			const wrapper = store ? this.getCallerIdentity()?.currentWrapper : null;
			// Registered outside a module (host-level `on()`): nothing to pin, so leave it alone.
			if (!wrapper || !store) return listener;
			const instanceID = store.instanceID;
			return function slothlet_pinnedEventListener(...args) {
				// The instance can be gone by the time a deferred callback runs: a listener registered
				// before shutdown, or a timer already scheduled, still fires afterwards. Re-entering a
				// context that no longer exists throws CONTEXT_NOT_FOUND, and from a listener or timer
				// there is nobody to catch it — it surfaces as an uncaught exception and takes the
				// process down. Run the callback unpinned instead: with no context its `self` refuses,
				// which is the same fail-closed answer any unattributed deferred work gets.
				if (!liveContextManagerRef.instances.has(instanceID)) return listener.apply(this, args);
				// rawErrors: a listener's own throw must reach its emitter unchanged. Without it
				// runInContext would re-wrap anything that is not a SlothletError as
				// CONTEXT_EXECUTION_FAILED, rewriting errors an `error` handler is meant to receive.
				// Same reason the pinned-hook and lockCaller call sites pass it.
				return liveContextManagerRef.runInContext(instanceID, listener, this, args, wrapper, true);
			};
		});
		liveContextManagerRef = this;
	}

	/**
	 * Initialize context for a new instance
	 * @param {string} instanceID - Unique instance identifier
	 * @param {Object} config - Instance configuration
	 * @returns {Object} Created context store
	 * @public
	 */
	initialize(instanceID, config = {}) {
		if (this.instances.has(instanceID)) {
			throw new SlothletError("CONTEXT_ALREADY_EXISTS", { instanceID }, null, { validationError: true });
		}

		const store = {
			instanceID,
			self: {},
			context: {},
			config: { ...config },
			createdAt: Date.now()
		};

		this.instances.set(instanceID, store);

		// In live mode, automatically set as current if it's the first/only instance
		if (!this.currentInstanceID) {
			this.currentInstanceID = instanceID;
		}

		return store;
	}

	/**
	 * Run function with instance context active (live mode)
	 * @param {string} instanceID - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
	 * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
	 *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
	 *   for framework callbacks (`lockCaller`, pinned hooks) where the caller expects the
	 *   original error type/code/status.
	 * @param {boolean} [asHost=false] - When `true`, run `fn` with **no module caller**: both
	 *   `currentWrapper` and `callerWrapper` are cleared for the execution, so `fn` runs as the host
	 *   (`metadata.caller()` returns null inside it). `currentWrapper` is ignored. Used by
	 *   `lockCaller.caller()` when the pinned caller is the host.
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args, currentWrapper, rawErrors = false, asHost = false) {
		// CHILD INSTANCE APPROACH: Check if current is this instance OR a child of this instance
		const currentID = this.currentInstanceID;
		const isAlreadyInContext = this.#flowBelongsToInstance(currentID, instanceID);

		// If already in correct context (base or child), just use current
		const targetInstanceID = isAlreadyInContext ? currentID : instanceID;

		const store = this.instances.get(targetInstanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceID: targetInstanceID,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		// Pin the store's resting identity before anything below can change the field it is read from.
		this.#baselineFor(store);

		// Set current instance (synchronous)
		const previousInstanceID = this.currentInstanceID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;

		this.currentInstanceID = targetInstanceID;
		if (asHost) {
			// Pinned to "no module caller": the call runs as the host, not as whichever module is ambient.
			store.callerWrapper = null;
			store.currentWrapper = null;
		}
		// currentWrapper is optional; false branch is covered directly in context-live-branches tests
		// but v8 hit-counter overflows to -255 in the parallel matrix, appearing uncovered.
		/* v8 ignore next */
		if (currentWrapper) {
			store.callerWrapper = previousWrapper;
			store.currentWrapper = currentWrapper;
		}

		// Restore previous state. Idempotent: the sync and settle paths must never both apply it,
		// or a nested call's saved state would be restored twice.
		let restored = false;
		const restore = () => {
			// Idempotence guard. The sync and settle paths are mutually exclusive by construction, so the
			// second call this protects against does not occur — but restoring twice would roll a nested
			// call's saved state back over the live one, which is worth guarding regardless.
			/* v8 ignore next */
			if (restored) return;
			restored = true;
			this.currentInstanceID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		};

		// Mark this call as executing synchronously for exactly as long as `fn` is on the stack — for an
		// async function, up to its first `await`. Pushed unconditionally (a wrapper-less entry pushes
		// null, which the resolver skips) so the pop below always removes what was pushed here.
		const entered = this.#enteredFor(store);
		entered.push(asHost ? HOST_ENTRY : (currentWrapper ?? null));

		try {
			let result;
			try {
				result = fn.apply(thisArg, args);
			} finally {
				entered.pop();
			}
			// An async module function returns at its first `await`, long before its body is done.
			// Restoring here would drop the caller identity for the rest of that body — and an absent
			// caller reads as host-initiated, so every permission-gated read or call after an `await`
			// would be allowed outright regardless of policy. Awaiting is mandatory for lazy access,
			// so that is the normal path, not an edge case. Hold the identity until the call settles,
			// and record the call as suspended so an overlapping sibling can be told apart from it.
			//
			// Native promises only. A lazy wrapper's waiting proxy is also thenable, but it is a
			// pending *value*, not the call's completion — adopting it here would consume the
			// thenable and hand back a plain promise in its place. Those reads carry their own
			// caller snapshot taken when the proxy was created, so they stay attributed anyway.
			if (result instanceof Promise) {
				// A host-pinned call (`asHost`) has no wrapper, so it is tracked with an empty api path and
				// no filePath (see #resolveSuspendedFromStack).
				/* v8 ignore next — a live wrapper always carries filePath/apiPath; the ?? on a present wrapper guards a partial mock. */
				const apiPath = currentWrapper?.____slothletInternal?.apiPath ?? "";
				/* v8 ignore next */
				const filePath = currentWrapper?.____slothletInternal?.filePath ?? null;
				const entry = {
					currentWrapper,
					filePath,
					// The same file as a stack frame spells it, compared by the resolver (relative to the
					// manifest root in browser mode).
					comparablePath: toComparablePath(filePath),
					// Owning module, so a frame in any file of that module can be attributed to this call.
					/* v8 ignore next */
					moduleID: currentWrapper?.____slothletInternal?.moduleID ?? null,
					apiPath,
					// Leaf segment of the api path — the function name as it appears in a stack frame,
					// used to tell two functions of the same module apart.
					fnName: apiPath.slice(apiPath.lastIndexOf(".") + 1)
				};
				// Only a call with a module caller is tracked as suspended — a host-initiated call has no
				// identity to disambiguate later, so there is nothing to record. Every promise-returning call
				// reaching here carries the wrapper being invoked, so the skip arm guards a caller-less entry
				// this path is not handed.
				//
				// A call pinned to the host (`asHost`) is the exception: it deliberately holds the shared
				// field at null for its whole async lifetime. Were it untracked, a single suspended module
				// call resuming meanwhile would trust that null field and be treated as the host — failing
				// open. Tracking it keeps the count honest, so that module is resolved from its stack instead.
				/* v8 ignore next */
				if (currentWrapper || asHost) this.#suspendedFor(store).add(entry);
				const settle = () => {
					this.#suspendedFor(store).delete(entry);
					restore();
				};
				return result.then(
					(value) => {
						settle();
						return value;
					},
					(error) => {
						settle();
						throw error;
					}
				);
			}
			restore();
			return result;
		} catch (error) {
			restore();
			// Rethrow framework errors directly so they propagate with their original code.
			// rawErrors also opts out non-SlothletError throws so framework callbacks keep
			// their original error type/code/status.
			if (rawErrors || error instanceof SlothletError) throw error;
			throw new SlothletError(
				"CONTEXT_EXECUTION_FAILED",
				{
					instanceID
				},
				error
			);
		}
	}

	/**
	 * Capture the caller identity of the executing flow so it can be re-entered later.
	 *
	 * Used by around hooks: a pinned around handler runs as the module that registered it, but the
	 * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
	 * that call's own caller.
	 *
	 * @param {string} instanceID - Instance whose flow to capture.
	 * @returns {{instanceID: string|null, store: object, currentWrapper: object|undefined, callerWrapper: object|undefined}|null}
	 *   Snapshot for {@link LiveContextManager#runInFlow}, or null when the instance has no store.
	 * @public
	 */
	captureFlow(instanceID) {
		const store = this.tryGetContext(instanceID);
		/* v8 ignore next — a live instance always has a store while its api is callable; guards a torn-down instance. */
		if (!store) return null;
		return { instanceID: this.currentInstanceID, store, currentWrapper: store.currentWrapper, callerWrapper: store.callerWrapper };
	}

	/**
	 * Run a callback with a flow captured by {@link LiveContextManager#captureFlow} active, then put
	 * back whatever was active before. Only the synchronous portion runs under the captured identity;
	 * a call started inside it holds its own identity until it settles, as every live call does.
	 *
	 * @param {{instanceID: string|null, store: object, currentWrapper: object|undefined, callerWrapper: object|undefined}} flow - Captured flow.
	 * @param {function(): *} fn - Callback to run.
	 * @returns {*} The callback's return value.
	 * @public
	 */
	runInFlow(flow, fn) {
		const { store } = flow;
		const previousInstanceID = this.currentInstanceID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;
		this.currentInstanceID = flow.instanceID;
		store.currentWrapper = flow.currentWrapper;
		store.callerWrapper = flow.callerWrapper;
		try {
			return fn();
		} finally {
			this.currentInstanceID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		}
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		if (!this.currentInstanceID) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_LIVE", {}, null, { validationError: true });
		}

		const store = this.instances.get(this.currentInstanceID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{
					instanceID: this.currentInstanceID,
					availableInstances: Array.from(this.instances.keys()).join(", ") || "none"
				},
				null,
				{ validationError: true }
			);
		}

		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 *
	 * @param {string} [instanceID] - When provided, resolve the store scoped to this instance rather
	 *   than to the globally-active one. If the active flow belongs to this instance (base or a
	 *   `run()`/`scope()` child) its store is returned; otherwise the instance has no active flow and
	 *   its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
	 *   exemption) evaluate against the right instance instead of an unrelated ambient caller (#290).
	 *   Omit for the legacy "globally-active store" behavior.
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext(instanceID) {
		if (instanceID === undefined) {
			if (!this.currentInstanceID) {
				return undefined;
			}
			return this.instances.get(this.currentInstanceID);
		}
		if (this.#flowBelongsToInstance(this.currentInstanceID, instanceID)) {
			return this.instances.get(this.currentInstanceID);
		}
		return this.instances.get(instanceID);
	}

	/**
	 * Capture the parts of this instance's executing flow that a later, out-of-band run must
	 * reproduce: the user context (`context.run()`'s), the caller identity, the owner-locked context
	 * keys and whether the flow is host-trusted. Used by the event system (#497) so a deferred
	 * delivery runs exactly as an immediate one would have. Holds references only — nothing is cloned
	 * or serialized.
	 *
	 * @param {string} instanceID - Instance whose flow to capture.
	 * @returns {object|null} An opaque flow snapshot for {@link runInSnapshotFlow}, or null when the
	 *   instance has no context store.
	 * @public
	 */
	snapshotFlow(instanceID) {
		const store = this.tryGetContext(instanceID);
		if (!store) return null;
		const identity = this.getCallerIdentity(instanceID);
		return {
			context: store.context,
			currentWrapper: identity.currentWrapper ?? null,
			callerWrapper: identity.callerWrapper ?? null,
			contextOwners: store.__contextOwners ?? null,
			trusted: store[TRUSTED_ROOT] === true
		};
	}

	/**
	 * Run `fn` inside a flow rebuilt from a {@link snapshotFlow} snapshot, on top of the instance's
	 * CURRENT base store (so a snapshot taken before a reload runs against the reloaded instance).
	 * The replayed store is made the active instance for the duration of `fn` — including its async
	 * tail — exactly as `run()`/`scope()` do in the live runtime. The deliverer's own ambient context
	 * is not merged in: the snapshot's context replaces it.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {object} captured - Snapshot from {@link snapshotFlow}.
	 * @param {Function} fn - Function to run (may be async).
	 * @returns {Promise<*>} Resolves/rejects with `fn`'s outcome.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no base store.
	 * @public
	 */
	async runInSnapshotFlow(instanceID, captured, fn) {
		const childStore = buildCapturedFlowStore(this.instances, instanceID, captured);
		this.instances.set(childStore.instanceID, childStore);
		const previousInstanceID = this.currentInstanceID;
		try {
			this.currentInstanceID = childStore.instanceID;
			return await fn();
		} finally {
			this.currentInstanceID = previousInstanceID;
			this.instances.delete(childStore.instanceID);
		}
	}

	/**
	 * Cleanup instance context
	 * @param {string} instanceID - Instance to cleanup
	 * @public
	 */
	cleanup(instanceID) {
		const store = this.instances.get(instanceID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{ instanceID, availableInstances: Array.from(this.instances.keys()).join(", ") || "none" },
				null,
				{ validationError: true }
			);
		}

		// Clear the store data
		store.self = {};
		store.context = {};

		// Remove from instances map
		this.instances.delete(instanceID);

		// Clear current instance if it was this one
		if (this.currentInstanceID === instanceID) {
			this.currentInstanceID = null;
		}
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "live",
			currentInstanceID: this.currentInstanceID,
			instances: Array.from(this.instances.entries()).map(([id, store]) => ({
				id,
				createdAt: store.createdAt,
				contextKeys: Object.keys(store.context),
				selfKeys: Object.keys(store.self)
			}))
		};
	}
}

/**
 * Singleton live context manager
 * @public
 */
export const liveContextManager = new LiveContextManager();
