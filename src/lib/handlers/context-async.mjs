/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-async.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T20:16:45-07:00 (1792293405)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview AsyncLocalStorage-based context manager
 * @module @cldmv/slothlet/handlers/context-async
 * @internal
 */
// Node-only ALS resolved in the platform module so node:async_hooks stays out of the browser
// static graph (#123). Browser uses the live context manager, so this manager never runs there.
import { AsyncLocalStorage } from "@cldmv/slothlet/helpers/platform";
import { nativeThen } from "@cldmv/slothlet/helpers/promise-context";
import { SlothletError } from "@cldmv/slothlet/errors";
import { runtime_isClassInstance, runtime_wrapClassInstance } from "@cldmv/slothlet/helpers/class-instance-wrapper";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";
import { TRUSTED_ROOT, buildCapturedFlowStore } from "#handlers/trusted-root";
import { attributeResult, carriesCallerCode, enterCall, isHandedOut, resolveSupplier } from "#handlers/frame-placement";

/**
 * AsyncLocalStorage-based context manager for async runtime
 * Uses ALS for full context isolation across async operations
 * @public
 */
export class AsyncContextManager {
	constructor() {
		// Null in a browser (AsyncLocalStorage gated out). A module-level singleton instantiates this
		// manager in every host (even when live mode is the active runtime), so the `: null` arm is
		// genuinely exercised by the vitest browser run rather than ignored.
		this.als = AsyncLocalStorage ? new AsyncLocalStorage() : null;
		this.instances = new Map(); // instanceID → context data
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			const store = this.als.getStore();
			return store && store.instanceID ? true : false;
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
		return store;
	}

	/**
	 * Run function with instance context active
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
	 * @param {object|null} [ceiling=null] - For an identity pinned from a caller-supplied-code read (#597): the
	 *   call that code ran inside, which has to allow everything `currentWrapper` does here as well.
	 * @param {{store: object|null, identity: object}|null} [resolved=null] - The caller identity already resolved
	 *   on the store the call enters (by the permission gate), taken as the call's caller instead of reading it
	 *   again. Ignored for another store.
	 * @param {boolean} [attribute=false] - When `true`, a function or iterator `fn` returns (or resolves to) is handed back
	 *   set up to run as `currentWrapper`'s module, whoever runs it (#597). Set for a leaf's own call.
	 * @param {boolean} [madeCode=false] - When `true`, `fn` is code a module made and handed out, run as that module
	 *   (#597): the call is always checked for code another module made running inside it.
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(
		instanceID,
		fn,
		thisArg,
		args,
		currentWrapper,
		rawErrors = false,
		asHost = false,
		ceiling = null,
		resolved = null,
		attribute = false,
		madeCode = false
	) {
		// Check if we're already in an active ALS context
		const activeStore = this.als.getStore();
		let baseStore;

		// CHILD INSTANCE APPROACH: Check if active store is this instance OR a child of this instance
		const isActiveOurInstance = activeStore && (activeStore.instanceID === instanceID || activeStore.parentInstanceID === instanceID);

		if (isActiveOurInstance) {
			// Already in context for this instance (base or child) - use active store to preserve modifications
			baseStore = activeStore;
		} else {
			// Not in context or different instance - get base store
			baseStore = this.instances.get(instanceID);
			if (!baseStore) {
				throw new SlothletError("CONTEXT_NOT_FOUND", {
					instanceID,
					availableInstances: Array.from(this.instances.keys())
				});
			}
		}

		// Create a new store with currentWrapper for this execution. The call record (#597) is set explicitly
		// on every path: spreading the base store must never leave a nested call holding its parent's.
		const executionStore = { ...baseStore };
		executionStore.record = this.#recordOf(baseStore);
		if (asHost) {
			// Pinned to "no module caller": the flow runs as the host, not as whichever module is ambient.
			executionStore.callerWrapper = null;
			executionStore.currentWrapper = null;
			executionStore.callerCeiling = null;
			executionStore.currentCeiling = null;
			executionStore.record = null;
			// Running as the host means enforcement must see a host-initiated flow. The marker is
			// non-enumerable (never spread onto a module's execution store), so apply it explicitly — the
			// same marker the instance's base store carries for a genuinely host-initiated call.
			Object.defineProperty(executionStore, TRUSTED_ROOT, { value: true, configurable: true });
		} else if (currentWrapper) {
			const parent = executionStore.record;
			// The caller is the call executing in this flow — or, when that call was handed code and the code is
			// what is calling, the call that supplied it, with the executing call as its ceiling (#597). An
			// unflagged call never reads the stack.
			if (parent?.flagged) {
				const identity = resolved?.identity && resolved.store === baseStore ? resolved.identity : this.#identityOf(baseStore);
				executionStore.callerWrapper = identity.currentWrapper;
				executionStore.callerCeiling = identity.ceiling ?? null;
			} else {
				executionStore.callerWrapper = baseStore.currentWrapper;
				executionStore.callerCeiling = parent ? (parent.ceiling ?? null) : (baseStore.currentCeiling ?? null);
			}
			executionStore.currentWrapper = currentWrapper;
			executionStore.currentCeiling = null;
			executionStore.record = {
				wrapper: currentWrapper,
				parent:
					parent ??
					(baseStore.currentWrapper
						? { wrapper: baseStore.currentWrapper, parent: null, flagged: false, ceiling: baseStore.currentCeiling ?? null }
						: null),
				flagged: madeCode || carriesCallerCode(thisArg, args),
				ceiling
			};
		}

		// A leaf's own call hands back what its module made as that module's (#597).
		const attributed = attribute && currentWrapper && !asHost ? (value) => attributeResult(currentWrapper, value) : (value) => value;

		// Only wrap in als.run() if we're not already in the right context
		if (isActiveOurInstance) {
			// Already in correct context - use a child ALS context so currentWrapper/callerWrapper propagate correctly
			return this.als.run(executionStore, () => {
				try {
					const result = currentWrapper && !asHost ? enterCall(currentWrapper, fn, thisArg, args) : fn.apply(thisArg, args);
					// Wrap class instances to preserve context. For an async leaf the synchronous
					// return is a pending Promise (Promise is excluded from class-instance detection),
					// so wrap the RESOLVED value instead — otherwise an async leaf that returns a class
					// instance never gets context-preserving method wrapping (#328). No rejection
					// handler: async rejections already propagate untouched here, matching the leaf
					// error contract pinned by sync-leaf-error-propagation (#252).
					if (result instanceof Promise) {
						return nativeThen(result, (value) =>
							this.#wrapClassInstanceResult(attributed(value), instanceID, executionStore.currentWrapper)
						);
					}
					return this.#wrapClassInstanceResult(attributed(result), instanceID, executionStore.currentWrapper);
				} catch (error) {
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
			});
		}

		// Not in context or switching instance - create new ALS context
		return this.als.run(executionStore, () => {
			try {
				const result = currentWrapper && !asHost ? enterCall(currentWrapper, fn, thisArg, args) : fn.apply(thisArg, args);
				// Wrap class instances to preserve context. For an async leaf the synchronous
				// return is a pending Promise (Promise is excluded from class-instance detection),
				// so wrap the RESOLVED value instead — otherwise an async leaf that returns a class
				// instance never gets context-preserving method wrapping (#328). No rejection
				// handler: async rejections already propagate untouched here, matching the leaf
				// error contract pinned by sync-leaf-error-propagation (#252).
				if (result instanceof Promise) {
					return nativeThen(result, (value) => this.#wrapClassInstanceResult(attributed(value), instanceID, executionStore.currentWrapper));
				}
				return this.#wrapClassInstanceResult(attributed(result), instanceID, executionStore.currentWrapper);
			} catch (error) {
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
		});
	}

	/**
	 * Wrap a value in a context-preserving proxy when it is a class instance, else return it as-is.
	 * Shared by the synchronous and async (resolved-Promise) return paths of {@link runInContext}.
	 * A fresh per-call cache is correct here — cross-call idempotency is handled by the wrapper's own
	 * `SLOTHLET_CLASS_WRAPPED` sentinel, not this cache.
	 * @private
	 * @param {*} value - Resolved return value of the leaf.
	 * @param {string} instanceID - Instance whose context the value belongs to.
	 * @param {Object} [currentWrapper] - Wrapper of the creating module (caller identity for later self.* calls).
	 * @returns {*} A context-preserving proxy for a class instance, otherwise `value` unchanged.
	 */
	#wrapClassInstanceResult(value, instanceID, currentWrapper) {
		if (isHandedOut(value)) return value;
		if (runtime_isClassInstance(value)) {
			// A class instance a module made runs as that module, as everything else it hands out does; one handed to
			// the module comes back as itself (#597).
			if (currentWrapper) return attributeResult(currentWrapper, value);
			const instanceCache = new WeakMap();
			return runtime_wrapClassInstance(value, this, instanceID, instanceCache, currentWrapper);
		}
		return value;
	}

	/**
	 * Capture the executing async flow's slothlet store so it can be re-entered later.
	 *
	 * Used by around hooks: a pinned around handler runs as the module that registered it, but the
	 * rest of the pipeline its `next()` runs belongs to the intercepted call, whose target must see
	 * that call's own caller.
	 *
	 * @returns {{store: object|undefined}} Snapshot for {@link AsyncContextManager#runInFlow}.
	 * @public
	 */
	captureFlow() {
		const store = this.als.getStore();
		const record = store ? this.#recordOf(store) : null;
		if (!record?.flagged) return { store };
		// Resolved now, while the code that is running is on the stack: re-entered later from another stack,
		// the supplier of the code (#597) could no longer be told apart, so the flow keeps the answer.
		const identity = this.#identityOf(store);
		const ceiling = identity.ceiling ?? null;
		return {
			store: {
				...store,
				currentWrapper: identity.currentWrapper,
				currentCeiling: ceiling,
				record: { wrapper: identity.currentWrapper, parent: record.parent, flagged: false, ceiling }
			}
		};
	}

	/**
	 * Run a callback with a flow captured by {@link AsyncContextManager#captureFlow} active. Only
	 * slothlet's own AsyncLocalStorage is switched — any other async context (an application's own
	 * `AsyncLocalStorage.run()` scope around `next()`) stays exactly as it is.
	 *
	 * @param {{store: object|undefined}} flow - Captured flow.
	 * @param {function(): *} fn - Callback to run.
	 * @returns {*} The callback's return value.
	 * @public
	 */
	runInFlow(flow, fn) {
		return this.als.run(flow.store, fn);
	}

	/**
	 * Run `fn` as a given module identity, unmarked (#597): the identity a slothlet function was read under, which it
	 * keeps whoever ends up calling it. Built on the store executing now (or the instance's base store), so the call
	 * keeps that flow's context; the identity is the one given, with the call it is made from as its parent.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {{currentWrapper: object, ceiling?: object|ReadonlyArray<object>|null, callerWrapper?: object|null, callerCeiling?: object|ReadonlyArray<object>|null}} identity - Who runs.
	 * @param {function(): *} fn - What to run.
	 * @returns {*} What `fn` returned.
	 * @throws {SlothletError} CONTEXT_NOT_FOUND when the instance has no store.
	 * @internal
	 */
	runAsIdentity(instanceID, identity, fn) {
		const active = this.als.getStore();
		const base =
			active && (active.instanceID === instanceID || active.parentInstanceID === instanceID) ? active : this.instances.get(instanceID);
		if (!base) {
			throw new SlothletError("CONTEXT_NOT_FOUND", { instanceID, availableInstances: Array.from(this.instances.keys()) });
		}
		const ceiling = identity.ceiling ?? null;
		const parent =
			this.#recordOf(base) ??
			(base.currentWrapper ? { wrapper: base.currentWrapper, parent: null, flagged: false, ceiling: base.currentCeiling ?? null } : null);
		const store = {
			...base,
			currentWrapper: identity.currentWrapper,
			callerWrapper: identity.callerWrapper ?? null,
			currentCeiling: ceiling,
			callerCeiling: identity.callerCeiling ?? null,
			record: { wrapper: identity.currentWrapper, parent, flagged: false, ceiling }
		};
		return this.als.run(store, fn);
	}

	/**
	 * Run `fn` attributed to no module (#597): inside a module's call, the flow keeps its context but no module is
	 * executing and it is not the host's, so a permission check made from it fails closed. Outside any module's call
	 * `fn` runs as it is. Used where slothlet runs code that is no caller's — a module being built at a module's
	 * request.
	 *
	 * @param {string} instanceID - Instance to run against.
	 * @param {function(): *} fn - What to run.
	 * @returns {*} What `fn` returned.
	 * @internal
	 */
	runUnattributed(instanceID, fn) {
		const active = this.als.getStore();
		if (!active || (active.instanceID !== instanceID && active.parentInstanceID !== instanceID)) return fn();
		if (!active.currentWrapper && !active.record) return fn();
		const store = {
			...active,
			currentWrapper: null,
			callerWrapper: null,
			currentCeiling: null,
			callerCeiling: null,
			record: null
		};
		return this.als.run(store, fn);
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		const store = this.als.getStore();
		if (!store) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_ASYNC", {}, null, { validationError: true });
		}
		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 *
	 * @param {string} [instanceID] - When provided, resolve the store scoped to this instance rather
	 *   than to the active async flow. The active ALS store is used only when it belongs to this
	 *   instance (its own store or a child scope of it); otherwise this instance has no active flow
	 *   and its own base store is returned, so host-level checks (e.g. the `TRUSTED_ROOT` read-gate
	 *   exemption) evaluate against the right instance. AsyncLocalStorage propagates across `await`,
	 *   so a leaf that boots a second `slothlet()` would otherwise carry its own store into the
	 *   nested instance's construction (#290). Omit for the legacy "active flow store" behavior.
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext(instanceID) {
		// `als` is null in a browser (AsyncLocalStorage gated out, #123). The runtime dispatcher
		// (getCurrentRuntime) probes this even in live mode, so honour the documented
		// "returns undefined instead of throwing" contract instead of dereferencing a null ALS.
		// The browser run reaches this `!als` arm through that live-mode self-dispatch path.
		if (!this.als) return undefined;
		const store = this.als.getStore();
		if (instanceID === undefined) return store;
		if (store && (store.instanceID === instanceID || store.parentInstanceID === instanceID)) {
			return store;
		}
		return this.instances.get(instanceID);
	}

	/**
	 * Resolve the caller identity for the executing async flow.
	 *
	 * Counterpart to the live manager's accessor of the same name, so enforcement can ask for
	 * identity without knowing which runtime it is on. No disambiguation is needed here:
	 * `runInContext` publishes a fresh execution store into AsyncLocalStorage, so the store this
	 * returns already belongs to the calling flow and cannot be another call's.
	 *
	 * @param {string} [instanceID] - When provided, resolve identity from THIS instance's own store
	 *   rather than from the active async flow. AsyncLocalStorage propagates across `await`, so an
	 *   outer leaf booting this nested instance would otherwise be seen as its caller; scoping to the
	 *   instance's own store reports no caller for that nested boot (base store has none) while still
	 *   returning the real caller when this instance's own flow is active (#290). Omit for the legacy
	 *   "active flow caller" behavior.
	 * @returns {{currentWrapper: object, callerWrapper: object}|undefined} Identity, or undefined
	 *   when there is no active context.
	 * @public
	 */
	getCallerIdentity(instanceID) {
		const store = this.tryGetContext(instanceID);
		if (!store) return undefined;
		const identity = this.#identityOf(store);
		return {
			currentWrapper: identity.currentWrapper,
			callerWrapper: store.callerWrapper,
			ceiling: identity.ceiling,
			callerCeiling: store.callerCeiling ?? undefined
		};
	}

	/**
	 * The call record a store's flow is executing, when it is the call the store names.
	 * @param {object} store - A context store.
	 * @returns {object|null} The record, or null.
	 * @private
	 */
	#recordOf(store) {
		const record = store.record;
		return record && record.wrapper === store.currentWrapper ? record : null;
	}

	/**
	 * Who is executing in a store's flow: the call it names, or — when that call was handed code by a call
	 * above it and that code is what is running — the supplier, with the call as its ceiling (#597).
	 *
	 * @param {object} store - A context store.
	 * @returns {{currentWrapper: object|undefined, ceiling: object|undefined}} The identity.
	 * @private
	 */
	#identityOf(store) {
		const record = this.#recordOf(store);
		if (!record) return { currentWrapper: store.currentWrapper, ceiling: store.currentCeiling ?? undefined };
		const supplier = resolveSupplier(record);
		if (supplier) return { currentWrapper: supplier.wrapper, ceiling: supplier.ceiling };
		return { currentWrapper: record.wrapper, ceiling: record.ceiling ?? undefined };
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
			ceiling: identity.ceiling ?? null,
			callerCeiling: identity.callerCeiling ?? null,
			contextOwners: store.__contextOwners ?? null,
			trusted: store[TRUSTED_ROOT] === true
		};
	}

	/**
	 * Run `fn` inside a flow rebuilt from a {@link snapshotFlow} snapshot, on top of the instance's
	 * CURRENT base store (so a snapshot taken before a reload runs against the reloaded instance).
	 * The deliverer's own ambient context is not merged in: the snapshot's context replaces it.
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
		try {
			return await this.als.run(childStore, fn);
		} finally {
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
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "async",
			activeStore: this.als.getStore()?.instanceID || null,
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
 * Singleton async context manager
 * @public
 */
export const asyncContextManager = new AsyncContextManager();
