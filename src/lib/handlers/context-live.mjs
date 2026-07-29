/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-live.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:37 -08:00 (1772425297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Live bindings context manager (no AsyncLocalStorage)
 * @module @cldmv/slothlet/handlers/context-live
 * @internal
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";

/**
 * Stack resolution found a frame naming more than one suspended call, so which of them is
 * executing cannot be determined. Distinct from "no frame matched", which merely means the caller
 * is not one of the suspended calls — see {@link LiveContextManager#getCallerIdentity}.
 * @type {symbol}
 * @private
 */
const AMBIGUOUS = Symbol("slothlet.callerIdentity.ambiguous");

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
const escapeForRegExp = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
	 * `currentWrapper` is one mutable field per store, so it can only name one call. While at most
	 * one call is suspended it is necessarily that call's — nothing else is mid-flight to have
	 * overwritten it — and the field can be trusted for free. Once two or more are suspended the
	 * field names whichever entered last, and a call resuming from its `await` would read somebody
	 * else's identity; {@link LiveContextManager#getCallerIdentity} resolves those from the call
	 * stack instead.
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
	 * Resolve the caller identity for the call that is executing right now.
	 *
	 * Enforcement asks for identity through here rather than reading `store.currentWrapper`
	 * directly, because that field can only name one call. Two paths:
	 *
	 * - **At most one call suspended** — the field is necessarily that call's (or a synchronous
	 *   nested call's, which set it on the way in), so it is returned as-is. This is the ordinary
	 *   case and costs nothing.
	 * - **Two or more suspended** — the field names whichever entered last, so a call resuming
	 *   from its `await` would read another module's identity and inherit its rights. The true
	 *   caller is taken from the call stack instead: the gated access happens synchronously inside
	 *   the caller's own function body, so its frame is on the stack. Interleaving can scramble a
	 *   shared field; it cannot scramble the stack, since each flow has its own.
	 *
	 * Only the suspended calls are candidates, so this never needs a global file→module index —
	 * and when the stack matches none of them (or matches ambiguously), identity is reported as
	 * unresolved so enforcement fails closed rather than guessing.
	 *
	 * Live runtime only. The async manager scopes identity per flow with AsyncLocalStorage and has
	 * no such ambiguity.
	 *
	 * @returns {{currentWrapper: object|null, callerWrapper: object, unresolved?: boolean}|undefined}
	 *   Identity for the executing call, or undefined when there is no active context.
	 * @public
	 */
	getCallerIdentity() {
		const store = this.tryGetContext();
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
		const suspended = this.#suspendedFor(store);
		if (suspended.size < 2) {
			return { currentWrapper: store.currentWrapper, callerWrapper: store.callerWrapper };
		}
		const resolved = this.#resolveSuspendedFromStack(suspended);
		if (resolved === AMBIGUOUS) {
			// One frame named several suspended calls at once (the same module suspended twice), so
			// which of them is executing genuinely cannot be told. Deny rather than pick: report no
			// caller AND mark it unresolved, so enforcement does not fall through to the
			// host-initiated exemption and hand it that privilege.
			return { currentWrapper: null, callerWrapper: store.callerWrapper, unresolved: true };
		}
		if (resolved) return { currentWrapper: resolved.currentWrapper, callerWrapper: store.callerWrapper };

		// No suspended call is on the stack, so the caller is not one of the ambiguous ones and the
		// ambiguity does not apply to it. It is either the host — which has no module frame by
		// definition — or a module that entered synchronously and is therefore the field's current,
		// accurate occupant. Distinguish by whether the field still names a suspended call: if it
		// does it is stale (that call is parked at an `await`, not calling), so report no caller and
		// let the trusted-root check decide, which admits a genuine host call and refuses a forged
		// one. Otherwise the field is a fresh entry and is correct.
		const fieldIsStale = [...suspended].some((entry) => entry.currentWrapper === store.currentWrapper);
		if (fieldIsStale) return { currentWrapper: null, callerWrapper: store.callerWrapper };
		return { currentWrapper: store.currentWrapper, callerWrapper: store.callerWrapper };
	}

	/**
	 * Pick which suspended call the current stack belongs to.
	 *
	 * Matches the innermost stack frame that contains exactly one candidate's source path. Only a
	 * substring test is used: a frame carries the module's path (plus the loader's cache-busting
	 * query, and in a browser as a URL), while the syntax around it differs between V8,
	 * SpiderMonkey and JavaScriptCore — so nothing else about the line is parsed.
	 *
	 * The two negative outcomes are reported distinctly because they mean opposite things: a frame
	 * naming several candidates is unattributable and must fail closed, while no frame at all means
	 * the caller simply is not one of the suspended calls and the ambiguity does not concern it.
	 *
	 * @param {Set<{currentWrapper: object, filePath: string|null}>} suspended - Candidate calls.
	 * @returns {{currentWrapper: object, filePath: string}|symbol|null} The matching entry,
	 *   {@link AMBIGUOUS} when a frame matches more than one candidate, or null when none matches.
	 * @private
	 */
	#resolveSuspendedFromStack(suspended) {
		const candidates = [...suspended].filter((entry) => entry.filePath);
		/* v8 ignore next — entries always carry a filePath; guards a partial mock. */
		if (!candidates.length) return null;

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
		const stack = String(new PristineError().stack ?? "");
		PristineError.stackTraceLimit = previousLimit;
		PristineError.prepareStackTrace = previousPrepare;

		// Innermost frame outwards. A frame that names the module but not one of the candidate
		// functions — a module-private helper the leaf called on its way here — resolves nothing, so
		// keep walking out until a frame does. Only if the module appears and no frame ever pins a
		// single function is the result genuinely ambiguous.
		let sawModuleFrame = false;
		for (const line of stack.split("\n")) {
			const matched = candidates.filter((entry) => line.includes(entry.filePath));
			if (!matched.length) continue;
			sawModuleFrame = true;
			if (matched.length === 1) return matched[0];

			// Several suspended calls share this file. Enforcement keys on the api path, not on the
			// invocation, so if they are all the same function the identity is the same whichever one
			// is executing — nothing to disambiguate.
			if (new Set(matched.map((entry) => entry.apiPath)).size === 1) return matched[0];

			// Different functions of one module: the frame names the function as well as the file.
			// Only the text before the path is searched, so a name that also occurs inside the path
			// cannot match by accident.
			const head = line.slice(0, line.indexOf(matched[0].filePath));
			const byName = matched.filter((entry) => entry.fnName && new RegExp(`\\b${escapeForRegExp(entry.fnName)}\\b`).test(head));
			if (byName.length && new Set(byName.map((entry) => entry.apiPath)).size === 1) return byName[0];
		}
		// The module was on the stack but no frame pinned one of its suspended functions (anonymous
		// or renamed frames), so fail closed. Never seeing it at all means the caller simply is not
		// one of the suspended calls, which is a different answer entirely.
		return sawModuleFrame ? AMBIGUOUS : null;
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
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args, currentWrapper, rawErrors = false) {
		// CHILD INSTANCE APPROACH: Check if current is this instance OR a child of this instance
		const currentID = this.currentInstanceID;
		let isAlreadyInContext = false;

		if (currentID) {
			const currentStore = this.instances.get(currentID);
			isAlreadyInContext =
				currentID === instanceID || currentStore?.parentInstanceID === instanceID || currentID.startsWith(instanceID + "__run_");
		}

		// If already in correct context (base or child), just use current
		const targetInstanceID = isAlreadyInContext ? currentID : instanceID;

		const store = this.instances.get(targetInstanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceID: targetInstanceID,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		// Set current instance (synchronous)
		const previousInstanceID = this.currentInstanceID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;

		this.currentInstanceID = targetInstanceID;
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
			if (restored) return;
			restored = true;
			this.currentInstanceID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		};

		try {
			const result = fn.apply(thisArg, args);
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
				/* v8 ignore next — filePath/apiPath are set on every live wrapper; ?? guards a partial mock. */
				const apiPath = currentWrapper?.____slothletInternal?.apiPath ?? "";
				const entry = {
					currentWrapper,
					/* v8 ignore next */
					filePath: currentWrapper?.____slothletInternal?.filePath ?? null,
					apiPath,
					// Leaf segment of the api path — the function name as it appears in a stack frame,
					// used to tell two functions of the same module apart.
					fnName: apiPath.slice(apiPath.lastIndexOf(".") + 1)
				};
				if (currentWrapper) this.#suspendedFor(store).add(entry);
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
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext() {
		if (!this.currentInstanceID) {
			return undefined;
		}
		return this.instances.get(this.currentInstanceID);
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
