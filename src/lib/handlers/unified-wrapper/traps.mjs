/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/traps.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:39-08:00 (1795651539)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Traps layer of the wrapper: the node's Proxy and its traps.
 *
 * Upward services: none; this layer reads only layers below it and the table's own entries.
 * @module @cldmv/slothlet/handlers/unified-wrapper/traps
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { util, EventEmitter, scheduleMacrotask } from "#helpers/platform";
import { isCompositionLayer, layerHeldKeys, layerMethodOriginal, layerUnderlying, holdMember } from "#helpers/composition";
import { isFrameworkName, isFrameworkReservedKey } from "#helpers/reserved-keys";
import { settleThenable, isHookProcessed, failureSource } from "#handlers/hook-manager";
import { pinnedResultThen, pinnedThen } from "#helpers/promise-context";
import {
	ArrayMethods,
	Arrays,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	functionToString,
	listPush,
	MapMethods,
	NativeObject,
	NativeProxy,
	Objects,
	Promise,
	PromiseMethods,
	Promises,
	PrototypeFunctions,
	Reflect,
	RegExpMethods,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	TypeError,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods,
	WeakMap,
	WeakRefMethods,
	WeakRef,
	Map
} from "#helpers/intrinsics";
import { anyRunOpen, runsOpen, domainOf } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { handsOutAsModule } from "#handlers/frame-placement";
import { absorbsFrameworkName, isFrameworkInternal, isFrameworkMarkerKey } from "#handlers/framework-internals";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let reservedKeysOwn,
	trustedRootOwn,
	registerLeafFile,
	hasOwn,
	FRAMEWORK_WRITES,
	SELF_VIEW_NODES,
	isUnchangingDefinition,
	SELF_INSTANCE_NODES,
	unwrapSelfView,
	selfModuleReader,
	selfIsMethodNode,
	INTRINSIC_HAS_INSTANCE,
	inherits,
	isEnginePromise,
	isErrorValue,
	dataKind,
	inheritedEngineMember,
	valueOfFor,
	NODE_MEMBER,
	holdsDataKind,
	frontedDataMember,
	NO_STORED_VALUE,
	placingTrap,
	assertOwnedWrite,
	rulesShared,
	runShared,
	takeRunWrite,
	NODE_TARGETS,
	snapshotPrototype,
	checkpointHandout,
	builtinBehind,
	snapshotBarrier,
	takeCapturedAccess,
	takeAccess,
	enforceRead,
	WRAPPER_ANSWERED_PROPS,
	GET_TRAP_ALLOWED_INTERNALS,
	valueHoldsName,
	isBuiltinFunctionMember,
	enforceCodeMember,
	isCodeMemberWithheld,
	behindGivenView,
	prototypeGiven,
	inRunTree,
	ownRunTreeArray,
	markRunTreeHeld,
	runTreeHides,
	ownsPrototype,
	moduleObjectOf,
	OBJECT_PROTO_SETTER,
	moduleObjectKeys,
	NO_NODE_PRIMITIVE,
	nodePrimitive,
	followModuleObject,
	reportsWritable,
	onImpl,
	originalAccessor,
	nodesShared,
	memberHoldsCode,
	searchDepth,
	searchBudget,
	FUNCTION_NODES,
	nodeRefOf,
	prototypeForReader,
	prototypeForHolder,
	behindMemberView,
	emitterOwnPrototype,
	readsEngineProto,
	instanceClassNode,
	UNLOADED_HAS_INSTANCE,
	functionOf,
	hasOwnMember,
	isArrayMember,
	isReadRedacted,
	fixedDescriptor,
	arrayKeyHolder,
	SERIALIZERS,
	enforcePermission,
	nodeInCycle,
	capturedReader,
	readAsReader,
	INSPECT_HOOKS,
	bindCapturedIdentity,
	guardPromotedResult,
	unwrapError,
	createNamedProxyTarget,
	findThen,
	isAwaitableThen,
	isFixedOnTarget,
	isArrayIndex,
	isPosition,
	isPastFixedLength,
	adoptArrayIntegrity,
	canDefine,
	definitionBindsTarget,
	isFixedReadOnly,
	shellValue,
	refuseFixedObjectDefinition,
	syncArrayIntegrity,
	standInMember,
	withRestartForwarding,
	inspectShown,
	defineProxyInspect,
	UnifiedWrapper,
	isClassInstance,
	resolveWrapper,
	registerProxy,
	adoptAccessor,
	frameworkWrite,
	givenAsIs,
	givenViewOn,
	SEALED_SHELL_READER,
	callingModule,
	isSlothletValue,
	INTRINSICS,
	makerOf,
	LAYER_FRONTS,
	CLASS_INSTANCES,
	FUNCTION_NODE_SETS,
	isSharedValue,
	recordPrototypePath,
	prototypeSiteOf,
	prototypeHandleOf,
	WITHHELD_PROTOTYPES,
	markFrameworkInternal,
	atClassSite,
	DATA_NODE_IMPLS,
	isTerminalData,
	accessEntry,
	pinsAsCode,
	pinnedCodeMember,
	RUN_VIEW_ACCESS,
	SETTLED_CHECKPOINTS,
	isCallerLocked,
	INHERITED_MEMBER_NODES,
	EMPTY_INHERITED_NODES,
	readGateDecision,
	readsNothingBeneath,
	serializesItself,
	PENDING_INVARIANT_READ,
	HAS_INSTANCE_BY_IMPL,
	selfHasInstance,
	FUNCTION_HAS_INSTANCE;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/** Whether {@link TrapsLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * The `Symbol.hasInstance` a loaded callable node answers (#632): the language's own test against its function, which
 * walks the instance's prototype chain to the function's `prototype` without running any of the module's code.
 * @param {Function} fn - The node's function.
 * @returns {Function} The test.
 * @private
 */
function hasInstanceOf(fn) {
	let test = WeakMapMethods.get(HAS_INSTANCE_BY_IMPL, fn);
	if (!test) {
		// A class extending the node's view inherits from the member view a reader got of `prototype`, which counts as it
		// (see selfHasInstance); a function with no `prototype` of its own (a bound one) answers as the language does.
		test = (value) => {
			const prototype = fn.prototype;
			return prototype !== null && typeof prototype === "object"
				? selfHasInstance(prototype, value)
				: Reflect.apply(FUNCTION_HAS_INSTANCE, fn, [value]);
		};
		WeakMapMethods.set(HAS_INSTANCE_BY_IMPL, fn, test);
	}
	return test;
}

/**
 * Take the pending engine read {@link PENDING_INVARIANT_READ} when it is this one.
 *
 * @param {object} wrapper - The node's wrapper whose descriptor is read.
 * @param {string|symbol} prop - The key read.
 * @returns {boolean} Whether this read is the engine's check after a view's definition.
 * @private
 */
function takeInvariantRead(wrapper, prop) {
	const pending = PENDING_INVARIANT_READ;
	PENDING_INVARIANT_READ = null;
	return pending !== null && pending.wrapper === wrapper && pending.prop === prop;
}

/**
 * Whether a node holds a member fixed (non-configurable): on its target, on its wrapper, or on the value behind it.
 * @param {object} wrapper - The node's wrapper.
 * @param {object} target - The proxy's target.
 * @param {string|symbol} prop - The member.
 * @returns {boolean} True when the member cannot be removed.
 * @private
 */
function holdsFixed(wrapper, target, prop) {
	if (isFixedOnTarget(target, prop)) return true;
	if (target !== wrapper && isFixedOnTarget(wrapper, prop)) return true;
	const impl = wrapper.____slothletInternal.impl;
	return impl !== null && typeof impl === "object" && !util.types.isProxy(impl) && isFixedOnTarget(impl, prop);
}

/**
 * A serialized snapshot of the wrapper tree with the terminal leaves the reader may not read left out.
 *
 * `toJSON` reconstructs the underlying data directly from the impl tree, so it bypasses the
 * proxy traps entirely — without this, `JSON.stringify(namespace)` would hand a gated caller
 * every terminal value beneath a namespace it cannot read. The snapshot shares the module's own objects, so
 * an object that loses a leaf, or holds an array, is copied rather than changed: serializing never edits a
 * module's data, frozen or not. Plain objects are recursed into, as their traversal is ungated by design. An
 * array in the snapshot is the module's own array (#602): the copy holds its api node instead, so
 * `JSON.stringify` reads each element through the node, gated as the value it reads at that moment, as
 * `JSON.stringify` of the array member does (#603 review).
 *
 * @param {object} wrapper - Wrapper the snapshot was extracted from.
 * @param {*} data - Extracted snapshot; never changed.
 * @param {string} basePath - Api path corresponding to `data`.
 * @param {object} node - The api node corresponding to `data`.
 * @param {WeakSet<object>} seen - The objects on the current path: an object the snapshot holds at two
 *   keys is redacted at each, and a cycle still stops.
 * @param {{currentWrapper: object, context: object}} [callerOverride] - The reader to redact for, when it is not
 *   the one reading now (a module serializing a node it kept, see {@link capturedView}).
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}), for the reader reading now.
 * @returns {*} `data`, or a copy of it with what the reader may not read left out.
 * @private
 */
function redactSerialized(wrapper, data, basePath, node, seen, callerOverride, kept = null) {
	if (!data || typeof data !== "object" || Arrays.isArray(data) || WeakSetMethods.has(seen, data)) return data;
	WeakSetMethods.add(seen, data);
	let copy = null;
	// The copy keeps the object's prototype, so a `toJSON` it inherits still serializes it.
	const own = () => (copy ??= Objects.assign(Objects.create(Objects.getPrototypeOf(data)), data));
	for (let ofIndex = 0, ofList = Objects.keys(data); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const value = data[key];
		const targetPath = `${basePath}.${key}`;
		if (isTerminalData(value)) {
			if (!readGateDecision(wrapper, targetPath, callerOverride, kept).allowed) delete own()[key];
		} else if (value !== null && typeof value === "object" && readsNothingBeneath(wrapper, targetPath, callerOverride, kept, null, value)) {
			// An object member the rules leave the reader nothing of is left out, as a value it may not read is.
			delete own()[key];
		} else if (Arrays.isArray(value)) {
			own()[key] = node[key];
		} else if (serializesItself(value)) {
			own()[key] = wrapper.___serializedHolder(value, targetPath, callerOverride, kept);
		} else {
			const redacted = redactSerialized(wrapper, value, targetPath, node[key], seen, callerOverride, kept);
			if (redacted !== value) own()[key] = redacted;
		}
	}
	WeakSetMethods.delete(seen, data);
	return copy ?? data;
}

/**
 * Keep the node made for a member a node inherits (see {@link inheritedMemberNode}).
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - The member's value.
 * @param {*} node - The node made for it.
 * @returns {*} `node`.
 * @private
 */
function keepInheritedMemberNode(wrapper, prop, value, node) {
	let byKey = WeakMapMethods.get(INHERITED_MEMBER_NODES, wrapper);
	if (byKey === undefined) WeakMapMethods.set(INHERITED_MEMBER_NODES, wrapper, (byKey = new Map()));
	MapMethods.set(byKey, prop, { value, node });
	return node;
}

/**
 * The node a node made before for a member it inherits, while that member still has the same value.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - The member's value now.
 * @returns {*} The node, or `undefined`.
 * @private
 */
function inheritedMemberNode(wrapper, prop, value) {
	const held = MapMethods.get(WeakMapMethods.get(INHERITED_MEMBER_NODES, wrapper) ?? EMPTY_INHERITED_NODES, prop);
	return held !== undefined && held.value === value ? held.node : undefined;
}

/**
 * Whether a node inherits a member by a symbol key from the prototype on its record (see {@link ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @param {symbol} prop - The key.
 * @returns {boolean} Whether it does.
 * @private
 */
function inheritsSymbol(wrapper, prop) {
	const prototype = wrapper.___nodeInherits(prop);
	return prototype !== undefined && prototype !== null && Reflect.has(prototype, prop);
}

/**
 * Whether a node fronts a value a module keeps whole and live (a class instance, an emitter, a value grafted at
 * runtime), whose members the node reads from the value itself.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {boolean} True for such a node.
 * @private
 */
function frontsLiveValue(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (impl === null || (typeof impl !== "object" && typeof impl !== "function")) return false;
	return internal.deferChildAdopt || (EventEmitter && inherits(impl, EventEmitter)) || isClassInstance(impl);
}

/**
 * Run a hooked call whose path has around hooks.
 *
 * @param {object} wrapper - The UnifiedWrapper being invoked.
 * @param {object} hookManager - The instance's HookManager.
 * @param {Array<object>} arounds - Around hooks that fire for this call (already permission-filtered).
 * @param {{asyncBefore: boolean, asyncAfter: boolean, asyncAround: boolean}} strategy - The path's dispatch strategy.
 * @param {*} thisArg - Receiver for the target.
 * @param {Array} callArgs - Arguments the caller passed.
 * @param {object} api - Bound API handed to hooks.
 * @param {object} ctx - User context handed to hooks.
 * @param {{store: object|null, identity: object}|null} [entryIdentity=null] - The caller identity the permission
 *   gate resolved, which the target is entered with (see enforcePermission).
 * @returns {*} The call's result — a plain value on the synchronous pipeline, a Promise on the
 *   asynchronous one (guarded when a synchronous target was promoted).
 * @private
 *
 * @description
 * Pipeline order, outermost first: `always`/`error` observers → around hooks (highest priority
 * outermost) → before hooks → the function → after hooks. The observers sit outside the around
 * chain, so they see exactly what the caller receives: an error an around hook rethrows reaches the
 * error hooks (with the source of wherever it was first thrown), one it swallows does not, and
 * `always` fires once after the chain settles. `suppressErrors` likewise applies to what escapes the
 * chain — inside it, failures propagate through `next()` so an around hook can handle them.
 *
 * The synchronous pipeline is kept when every matching before/after/around handler is synchronous
 * and the target is not declared `async` (and, in lazy mode, is already materialized); otherwise the
 * whole call runs asynchronously, with the same promotion guard as a call promoted by an async
 * before/after hook.
 */
function runAroundPipeline(wrapper, hookManager, arounds, strategy, thisArg, callArgs, api, ctx, entryIdentity = null) {
	const internal = wrapper.____slothletInternal;
	const path = internal.apiPath;
	const contextManager = wrapper.____slothlet.contextManager;
	const instanceID = wrapper.____slothlet.instanceID;

	// Who is calling: the same resolution that makes `metadata.caller()` inside the target null —
	// the target's execution store takes its caller from the wrapper active in THIS instance's flow
	// at the moment of the call.
	const callerWrapper = contextManager.getCallerIdentity(instanceID)?.currentWrapper ?? null;
	const entry = !callerWrapper;
	// The same `caller` object a version dispatcher and a permission record get: { path, module, metadata, version }.
	const caller = callerWrapper ? (wrapper.____slothlet.handlers.versionManager?.buildCallerArg(callerWrapper) ?? null) : null;

	// Only a pinned (module-registered) around hook runs under a different identity than the call, so
	// only then is the call's own flow captured for its next() to restore.
	const flow = ArrayMethods.some(arounds, (hook) => isCallerLocked(hook.handler)) ? contextManager.captureFlow(instanceID) : null;
	const runInCallerFlow = flow ? (fn) => contextManager.runInFlow(flow, fn) : null;

	// First record wins: an error rethrown by an around hook keeps the source it was first thrown
	// from; an error an around hook throws itself is recorded as an `around` failure. Matched with
	// Object.is, so a rejection value not equal to itself (NaN) still finds its record.
	const sources = [];
	const errorSink = (error, source) => {
		if (!ArrayMethods.some(sources, (entryRecord) => Objects.is(entryRecord.error, error))) listPush(sources, { error, source });
	};
	// The stage to report a rejection nothing recorded as; see AroundChainOptions.onUnobserved.
	let unobserved = null;
	const onUnobserved = (source) => {
		unobserved = source;
	};
	const functionSource = (error) => failureSource({ type: "function", at: wrapper.____clock.now() }, wrapper.___readTargetFailure(error));

	const invokeTarget = (targetArgs) => {
		const impl = internal.impl;
		// rawErrors: a leaf's throw is application data — never re-typed (#252).
		if (typeof impl === "function") {
			return contextManager.runInContext(
				wrapper.____instanceID,
				impl,
				thisArg,
				targetArgs,
				wrapper,
				true,
				false,
				null,
				entryIdentity,
				true
			);
		}
		if (impl && typeof impl === "object" && typeof impl.default === "function") {
			return contextManager.runInContext(
				wrapper.____instanceID,
				impl.default,
				impl,
				targetArgs,
				wrapper,
				true,
				false,
				null,
				entryIdentity,
				true
			);
		}
		throw new wrapper.____SlothletError("API_PATH_NOT_CALLABLE", { path: segmentsOf(path), received: typeof impl });
	};

	// Observers, run once per call on the way out.
	const settleValue = (value) => {
		hookManager.executeAlwaysHooks(path, callArgs, value, false, [], api, ctx);
		return value;
	};
	const settleError = (error) => {
		// Every rejection is recorded on its way out except one of a thenable no view could be put on (a frozen
		// `then`); that one is the target's, so it is classified as the target before anything reads it (#599).
		const recordedSource = ArrayMethods.find(sources, (record) => Objects.is(record.error, error))?.source;
		const unrecorded = recordedSource === undefined && unobserved ? wrapper.___readTargetFailure(error) : null;
		const originalError = unrecorded ? unrecorded.originalError() : unwrapError(error);
		// A failure an inner hooked call already reported is not reported again (same rule as the
		// pipeline without around hooks); `always` still observes this call.
		if (!isHookProcessed(error)) {
			const recorded = recordedSource ?? failureSource({ ...unobserved }, unrecorded ?? hookManager.failureOf(error));
			hookManager.executeErrorHooks(path, originalError, recorded, callArgs, api, ctx);
		}
		hookManager.executeAlwaysHooks(path, callArgs, undefined, true, [originalError], api, ctx);
		if (wrapper.____slothlet.config?.hook?.errors === "suppress") return undefined;
		throw error;
	};

	const leafIsAsync = util.types.isAsyncFunction(internal.impl) || util.types.isAsyncFunction(internal.impl?.default);
	const lazyPending = internal.mode === "lazy" && !internal.state.materialized;
	const promoted = strategy.asyncBefore || strategy.asyncAfter || strategy.asyncAround;
	const options = { caller, entry, errorSink, runInCallerFlow, onUnobserved };

	if (promoted || leafIsAsync || lazyPending) {
		const core = async (coreArgs) => {
			const beforeResult = await hookManager.executeBeforeHooksAsync(path, coreArgs, api, ctx, errorSink);
			if (beforeResult.shortCircuit) return beforeResult.value;
			coreArgs = beforeResult.args;
			let settled;
			try {
				if (internal.mode === "lazy" && !internal.state.materialized) {
					await wrapper.___materialize();
				}
				const raw = invokeTarget(coreArgs);
				settled = raw && typeof raw === "object" && typeof raw.then === "function" ? await raw : raw;
			} catch (error) {
				errorSink(error, functionSource(error));
				throw error;
			}
			const afterResult = await hookManager.executeAfterHooksAsync(path, settled, coreArgs, api, ctx, errorSink);
			return afterResult.modified ? afterResult.result : settled;
		};
		const run = pinnedThen(
			hookManager.executeAroundChain(arounds, path, callArgs, api, ctx, { ...options, core, isAsync: true }),
			settleValue,
			settleError
		);
		// Same contract as a call promoted by an async before/after hook: a target declared `async`
		// already hands its callers a Promise; a promoted synchronous one hands back a guarded one.
		return promoted && !leafIsAsync ? guardPromotedResult(run, path, wrapper.____SlothletError) : run;
	}

	const core = (coreArgs) => {
		const beforeResult = hookManager.executeBeforeHooks(path, coreArgs, api, ctx, errorSink);
		if (beforeResult.shortCircuit) return beforeResult.value;
		coreArgs = beforeResult.args;
		let result;
		try {
			result = invokeTarget(coreArgs);
		} catch (error) {
			errorSink(error, functionSource(error));
			throw error;
		}
		// A plain (not `async`-declared) target returning a Promise: after hooks attach to it, exactly
		// as on the pipeline without around hooks.
		if (result && typeof result === "object" && typeof result.then === "function") {
			const afterReaction = (resolved) => {
				const afterResult = hookManager.executeAfterHooks(path, resolved, coreArgs, api, ctx, errorSink);
				return afterResult.modified ? afterResult.result : resolved;
			};
			const recordAsTarget = (error) => errorSink(error, functionSource(error));
			// A promise of the engine's own is reacted to with the language's `then`, as `await` reacts to it; one of a
			// module's class through its own `then`, as `await` calls it.
			const react = isEnginePromise(result)
				? FunctionMethods.bind(pinnedThen, null, result)
				: inherits(result, Promise)
					? FunctionMethods.bind(result.then, result)
					: null;
			if (react !== null) {
				return react(afterReaction, (error) => {
					recordAsTarget(error);
					throw error;
				});
			}
			// A hand-written thenable is reacted to as `await` would, its rejections recorded as the target's however
			// its `then` delivers them (see HookManager#observeThenable).
			return hookManager.observeThenable(result, afterReaction, recordAsTarget, () =>
				onUnobserved({ type: "function", timestamp: wrapper.____clock.now() })
			);
		}
		const afterResult = hookManager.executeAfterHooks(path, result, coreArgs, api, ctx, errorSink);
		return afterResult.modified ? afterResult.result : result;
	};

	let value;
	try {
		value = hookManager.executeAroundChain(arounds, path, callArgs, api, ctx, { ...options, core, isAsync: false });
	} catch (error) {
		return settleError(error);
	}
	// The only thenable an around hook may return on this pipeline is one `next()` returned, passed
	// through or derived from (`next().then(check)`); observe it when it settles.
	if (value && typeof value === "object" && typeof value.then === "function") {
		if (isEnginePromise(value)) return pinnedThen(value, settleValue, settleError);
		return inherits(value, Promise) ? value.then(settleValue, settleError) : settleThenable(value, settleValue, settleError);
	}
	return settleValue(value);
}

/**
 * Whether a node of a run's tree holds a member it was given in the run on its wrapper, over the live value it fronts
 * (a class instance, an emitter): the value is the module's, which the instance's tree fronts too.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {boolean} True when the node's own member answers.
 * @private
 */
function runTreeHolds(wrapper, prop) {
	const held = wrapper.____slothletInternal.runHeldKeys;
	return held !== undefined && SetMethods.has(held, prop);
}

/**
 * What a caller is handed for a promise a call returned while a run is open: a promise of the same value, which is
 * saved for the runs open before the caller has it (see {@link checkpointHandout}), the same one each time for
 * the same promise. A rejection is handed on as it is.
 * @param {object} slothlet - The instance.
 * @param {Promise<*>} promise - The promise.
 * @returns {Promise<*>} The promise the caller is handed.
 * @private
 */
function checkpointSettled(slothlet, promise) {
	if (!runsOpen(domainOf(slothlet)) || RUN_VIEW_ACCESS !== 0) return promise;
	let handed = WeakMapMethods.get(SETTLED_CHECKPOINTS, promise);
	if (handed === undefined) {
		handed = PromiseMethods.then(promise, (value) => {
			checkpointHandout(slothlet, value);
			return value;
		});
		WeakMapMethods.set(SETTLED_CHECKPOINTS, promise, handed);
	}
	return handed;
}

/**
 * Apply a definition to a sealed node's shell target (see the preventExtensions trap), and to the module's
 * array for an array member, so both answer as the array itself would (#603, #609).
 *
 * @description
 * A sealed shell holds each data member as a data property, so the node reports the same attributes a sealed
 * or frozen object of its own would. A writable member's value is not pinned by the proxy invariants, so reads
 * keep going through the node and its permission check; a value defined on it goes through the node's own
 * write. A member made read-only is pinned for every reader: the shell takes the member's value as the node
 * holds it at that moment, and a read the rules deny is refused rather than answered (see
 * {@link gateFixedValue}). A member the module's array holds as an accessor stays an accessor that
 * reads and writes through the node. Each change is applied to the module's array as well when it holds the
 * key, after both accept it, so freezing the node freezes the array's elements as freezing the array would.
 *
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object|Function|Array} target - The sealed shell.
 * @param {string|symbol} prop - Property key.
 * @param {PropertyDescriptor} descriptor - Descriptor to define.
 * @returns {boolean} Whether the definition was applied.
 * @private
 *
 * @example
 * defineOnSealedShell(wrapper, shell, "0", { configurable: false, writable: false }); // what Object.freeze sends
 */
function defineOnSealedShell(wrapper, target, prop, descriptor) {
	const current = Reflect.getOwnPropertyDescriptor(target, prop);
	// A non-extensible node takes no new key, as on the object itself.
	if (!current) return false;
	const impl = wrapper.____slothletInternal.impl;
	// A node fronting a module's own object defines on that object too, as freezing the object would (#757).
	const holder = Arrays.isArray(impl)
		? arrayKeyHolder(impl, prop)
		: MapMethods.has(FRAMEWORK_WRITES, wrapper)
			? null
			: moduleObjectOf(wrapper, prop);
	const mirrors = holder !== null && hasOwn(holder, prop);
	let attributes = descriptor;
	let mirrored = descriptor;
	if (!("value" in current)) {
		// An accessor that reads through the node: only its attributes change.
		if ("get" in descriptor || "set" in descriptor || "value" in descriptor || "writable" in descriptor) return false;
	} else if (!("get" in descriptor) && !("set" in descriptor)) {
		attributes = { ...descriptor };
		mirrored = { ...descriptor };
		// A member made read-only is pinned as the node holds it now: an earlier write through the node reached the
		// module's value, not the shell's copy. The module's array keeps its own value, not the api node.
		if (current.writable && descriptor.writable === false && !("value" in descriptor)) {
			attributes.value = shellValue(wrapper, prop);
			// A function node's own member holding the module's code is held as a stand-in every holder may be described
			// (see pinnedCodeMember).
			if (functionOf(impl) !== null && !hasOwn(wrapper, prop) && pinsAsCode(attributes.value, wrapper.____slothlet))
				attributes.value = pinnedCodeMember(wrapper, attributes.value);
			if (mirrors) delete mirrored.value;
		}
		// The shell holds a module object's accessor as data (see sealShell): the object's accessor takes only the
		// attributes an accessor has, as freezing the object itself defines it (#757).
		const held = mirrors && !Arrays.isArray(impl) ? Reflect.getOwnPropertyDescriptor(holder, prop) : undefined;
		if (held !== undefined && !("value" in held)) {
			if ("value" in descriptor) return false;
			mirrored = { ...mirrored };
			delete mirrored.value;
			delete mirrored.writable;
		}
	}
	// Both are checked before either changes, so a refusal by one leaves the other as it was.
	if (!canDefine(target, prop, attributes) || (mirrors && !canDefine(holder, prop, mirrored))) return false;
	// A value goes through the node's own write while the member is writable, so the module's value takes it.
	if ("value" in descriptor && current.writable && !Reflect.set(wrapper.____slothletInternal.proxy, prop, descriptor.value)) return false;
	if (mirrors) Reflect.defineProperty(holder, prop, mirrored);
	Reflect.defineProperty(target, prop, attributes);
	return true;
}

/**
 * An impl's own accessor descriptor as the node describes it (#597): each half the node did not adopt is adopted
 * (see {@link adoptAccessor}), so a getter or setter taken from the description and run anywhere runs as the
 * module the node belongs to. A data descriptor is returned as it is.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyDescriptor|undefined} descriptor - The impl's descriptor.
 * @returns {PropertyDescriptor|undefined} The descriptor to report.
 * @private
 */
function describeImplMember(wrapper, descriptor) {
	if (!descriptor || (typeof descriptor.get !== "function" && typeof descriptor.set !== "function")) return descriptor;
	const adopted = adoptAccessor(wrapper, descriptor);
	return { __proto__: null, ...descriptor, get: adopted.get, set: adopted.set };
}

/**
 * Write a member of the module's object a node fronts, as the same assignment to the object does (#746). Only the
 * object's own members are touched: a new key becomes an ordinary member of it, and a setter the module has put there
 * since the node was built runs on the object as the module the node belongs to, never as the writer (#597).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} object - The module's object (see {@link moduleObjectOf}).
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - What to write.
 * @returns {boolean} Whether the object took the write.
 * @private
 */
function writeModuleObject(wrapper, object, prop, value) {
	const held = Reflect.getOwnPropertyDescriptor(object, prop);
	if (held === undefined) {
		const added =
			Reflect.isExtensible(object) &&
			Reflect.defineProperty(object, prop, { __proto__: null, value, writable: true, enumerable: true, configurable: true });
		if (added && typeof prop === "string") SetMethods.add(moduleObjectKeys(object), prop);
		return added;
	}
	if ("value" in held) return held.writable === true && Reflect.defineProperty(object, prop, { __proto__: null, value });
	if (typeof held.set !== "function") return false;
	wrapper.___runAccessor(held.set, object, [value]);
	return true;
}

/**
 * The reader of an access, resolved now, for a read answered once the access has ended (an `await` of a lazy node,
 * answered after the load). Null while permissions or read gating are off.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object|null} access - The access.
 * @returns {{store: object|null|undefined, identity: object|undefined}|null} The reader.
 * @private
 */
function pinReader(wrapper, access) {
	const pm = wrapper.____slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return null;
	const entry = accessEntry(access, wrapper);
	if (entry) return entry;
	const contextManager = wrapper.____slothlet.contextManager;
	const instanceID = wrapper.____slothlet.instanceID;
	return {
		store: contextManager?.tryGetContext?.(instanceID),
		identity: contextManager?.getCallerIdentity?.(instanceID)
	};
}

/**
 * Check a member read through a node that holds built-in data or an error (a file's default export that is a `Map`, a
 * `Date`, an error, …) as a read of that value at the node's path: the node is the value there, as the same value
 * exported by name is, so a read rule naming the path refuses every member read through it, a getter of the engine's
 * and a method alike. The framework's own keys, and `then` (which `await` asks for), are no member reads.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member read.
 * @param {{wrapper: object, reader: object}|null} kept - The access a node a module kept is making.
 * @param {object|null} access - The read of `self` this is part of, when it was resolved already.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when the reader may not read the value.
 * @private
 *
 * @example
 * // single/derror.mjs: export default new RangeError("bad"); rule: deny reader.** → single.derror
 * self.single.derror.message; // PERMISSION_DENIED, as self.owner.failure.message is under a rule on owner.failure
 */
function gateDataNodeMember(wrapper, prop, kept, access) {
	if (prop === "then" || isFrameworkReservedKey(prop)) return;
	const permissionManager = wrapper.____slothlet.handlers?.permissionManager;
	if (!permissionManager || !permissionManager.isEnabled() || !permissionManager.isReadGatingEnabled()) return;
	const impl = wrapper.____slothletInternal.impl;
	// A primitive a loaded node holds (a lazy folder kept before it loaded as one) is data like a built-in (#797).
	if (nodePrimitive(wrapper) !== NO_NODE_PRIMITIVE) {
		wrapper.___gateNodeValue(kept, access);
		return;
	}
	if (impl === null || typeof impl !== "object") return;
	let isData = WeakMapMethods.get(DATA_NODE_IMPLS, impl);
	if (isData === undefined) {
		isData = !util.types.isProxy(impl) && isTerminalData(impl);
		WeakMapMethods.set(DATA_NODE_IMPLS, impl, isData);
	}
	if (!isData) return;
	wrapper.___gateNodeValue(kept, access);
}

/**
 * The prototype a node fronting an instance of a class of the module's reports, by `Object.getPrototypeOf` and through
 * `__proto__` (#667): the instance's own, its class's `prototype`. It holds the class's methods and `constructor`, so
 * reaching it is checked as a call of the class's node (see instanceClassFront), whoever holds the instance's
 * node — read through `self` or handed to the module as an argument — exactly as reading the class's `prototype` is. A
 * reader the class is closed to is refused it: the prototype is never stood in for by another, so no write meant for
 * the class lands on a prototype every value shares.
 * @param {UnifiedWrapper} wrapper - The instance's node's wrapper.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making into the instance.
 * @returns {object|undefined} The prototype, or `undefined` for a node fronting no such instance.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not call the class's node.
 * @private
 */
function instanceClassPrototype(wrapper, kept = null) {
	const classNode = wrapper.___instanceClassFront();
	if (!classNode) return undefined;
	const classWrapper = resolveWrapper(classNode);
	const prototype = Reflect.getPrototypeOf(wrapper.____slothletInternal.impl);
	enforceCodeMember(classWrapper, prototype, kept);
	return atClassSite(wrapper.____slothlet, prototypeForReader(classWrapper, classWrapper.___exposePrototype(prototype), "prototype"));
}

/**
 * What a node whose own prototype holds the module's code (an emitter of a class of the module's) reports to a reader
 * that may not call it (#632, #667): an object inheriting from the nearest prototype above it holding none of the
 * module's code, so `instanceof` against the language's or Node's own classes still holds, by `Object.getPrototypeOf`
 * and through `__proto__` alike. It holds nothing of its own and takes no change: a write meant for the module's class
 * is refused, never landing on a prototype other values share. The same object each time, for the same node and
 * nearest prototype.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object|null} nearest - The nearest prototype holding none of the module's code.
 * @returns {object|null} The stand-in, or `null` when there is no such prototype.
 * @private
 */
function withheldPrototype(wrapper, nearest) {
	if (nearest === null) return null;
	const held = WeakMapMethods.get(WITHHELD_PROTOTYPES, wrapper);
	if (held?.nearest === nearest) return held.standIn;
	// A change through it is checked as a call of the node, so a reader it was withheld from is refused as reading the
	// prototype itself would refuse it; any other reader finds it closed, as a frozen object is.
	const refuse = () => {
		enforcePermission(wrapper, [], false);
		return false;
	};
	const standIn = new NativeProxy(Objects.freeze(Objects.create(nearest)), {
		set: (target, prop, value, receiver) => (receiver === standIn ? refuse() : Reflect.set(target, prop, value, receiver)),
		defineProperty: refuse,
		deleteProperty: refuse,
		setPrototypeOf: refuse,
		preventExtensions: (target) => {
			refuse();
			return Reflect.preventExtensions(target);
		}
	});
	markFrameworkInternal(standIn);
	WeakMapMethods.set(WITHHELD_PROTOTYPES, wrapper, { nearest, standIn });
	return standIn;
}

/**
 * The prototype a closed node holding a class instance keeps on its shell (#725). A closed node reports its shell's
 * prototype to every holder, so the shell holds the instance's prototype as a view standing as the node does, at the
 * path reading it is checked at: a write through it is decided when it is made, so turning the permission system on
 * later still holds a module not allowed the write to it. A prototype made by no module is held as it is.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|null|undefined} What the shell holds, or `undefined` for a node holding no such instance.
 * @private
 */
function instanceShellPrototype(wrapper) {
	const site = wrapper.___instancePrototypeSite();
	if (site === undefined) return undefined;
	const { prototype, checked } = site;
	if (prototype === null || WeakSetMethods.has(INTRINSICS, prototype) || isSharedValue(prototype) || !wrapper.____slothlet)
		return prototype;
	recordPrototypePath(wrapper.____slothlet, checked.___exposePrototype(prototype), site.site);
	return prototypeHandleOf(wrapper.____slothlet, prototype);
}

/**
 * The prototype a closed emitter's shell holds (#667). A closed node reports its shell's prototype to every holder of
 * the node, for as long as the node lives: the host, and each module the host or another module hands the node to. The
 * shell therefore holds a view standing as the node does whenever the prototype is the module's code, whether the
 * permission system is on now or not: a write through it is decided when it is made, so turning the system on later
 * still holds a module not owning the emitter to it. A prototype made by no module is held as it is.
 * @param {UnifiedWrapper} wrapper - The emitter's node's wrapper.
 * @param {object} prototype - The emitter's own prototype.
 * @returns {object} What the shell holds.
 * @private
 */
function sealedShellPrototype(wrapper, prototype) {
	if (!wrapper.____slothlet || WeakSetMethods.has(INTRINSICS, prototype) || isSharedValue(prototype)) return prototype;
	recordPrototypePath(wrapper.____slothlet, prototype, prototypeSiteOf(wrapper, null));
	return prototypeHandleOf(wrapper.____slothlet, prototype);
}

/**
 * Record `node` as the one fronting `fn` behind its layer, unless another live node of the instance already does.
 * @param {object} slothlet - The instance.
 * @param {*} fn - The function behind the layer.
 * @param {Function} node - The node.
 * @returns {void}
 * @private
 */
function recordLayerFront(slothlet, fn, node) {
	if (typeof fn !== "function") return;
	let byFunction = WeakMapMethods.get(LAYER_FRONTS, slothlet);
	if (!byFunction) WeakMapMethods.set(LAYER_FRONTS, slothlet, (byFunction = new WeakMap()));
	if ((WeakMapMethods.get(byFunction, fn) == null ? undefined : WeakRefMethods.deref(WeakMapMethods.get(byFunction, fn))) === undefined)
		WeakMapMethods.set(byFunction, fn, new WeakRef(node));
}

/**
 * Record `wrapper`'s node as the one fronting its function, when its file exports that function, unless another node of
 * the instance already does.
 * @param {UnifiedWrapper} wrapper - The node's wrapper, whose proxy exists.
 * @returns {void}
 * @private
 */
function recordFunctionNode(wrapper) {
	const { impl, proxy, filePath } = wrapper.____slothletInternal;
	if (typeof impl !== "function" || !wrapper.____slothlet) return;
	// A function node built over a folder's or a mount's default function holds slothlet's layer over it: the function
	// behind the layer is the one its `prototype.constructor` names, so it is fronted by this node too.
	if (isCompositionLayer(impl)) recordLayerFront(wrapper.____slothlet, layerUnderlying(impl), proxy);
	// Only a function its file exports stands for it: a node built for one the module did not export (a class reached
	// through an instance's members) is a member of that instance, not the class's own node.
	if (!filePath || !wrapper.____slothlet.handlers?.ownership?.resolveExportPath?.(filePath, impl)) return;
	let byFunction = WeakMapMethods.get(FUNCTION_NODES, wrapper.____slothlet);
	if (!byFunction) WeakMapMethods.set(FUNCTION_NODES, wrapper.____slothlet, (byFunction = new WeakMap()));
	if ((WeakMapMethods.get(byFunction, impl) == null ? undefined : WeakRefMethods.deref(WeakMapMethods.get(byFunction, impl))) === undefined)
		WeakMapMethods.set(byFunction, impl, new WeakRef(proxy));
	WeakMapMethods.set(CLASS_INSTANCES, impl, new WeakRef(wrapper.____slothlet));
	// Every node fronting it, for a class exported under more than one name (#667).
	let everyFunction = WeakMapMethods.get(FUNCTION_NODE_SETS, wrapper.____slothlet);
	if (!everyFunction) WeakMapMethods.set(FUNCTION_NODE_SETS, wrapper.____slothlet, (everyFunction = new WeakMap()));
	const live = filterList(WeakMapMethods.get(everyFunction, impl) ?? [], (ref) => WeakRefMethods.deref(ref) !== undefined);
	if (!ArrayMethods.some(live, (ref) => WeakRefMethods.deref(ref) === proxy)) listPush(live, new WeakRef(proxy));
	WeakMapMethods.set(everyFunction, impl, live);
}

/**
 * Record a value written onto a module's node as handed to that module (#597), unless the module itself writes it:
 * handed back out, it is the writer's value as it was, never the module's code.
 * @param {object} wrapper - The node's wrapper.
 * @param {*} value - The value written.
 * @returns {void}
 * @private
 */
function markWritten(wrapper, value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	if (!wrapper?.____slothlet?.instanceID || !wrapper.____slothlet.contextManager?.runInContext || !handsOutAsModule(wrapper)) return;
	if (isSlothletValue(value) || WeakSetMethods.has(INTRINSICS, value)) return;
	const maker = makerOf(wrapper);
	if (WeakMapMethods.has(maker.made, value)) return;
	const writer = wrapper.____slothlet.contextManager.tryGetContext?.(wrapper.____slothlet.instanceID)?.currentWrapper ?? null;
	if (writer && WeakSetMethods.has(trustedRootOwn.genuineWrappers, writer) && makerOf(writer) === maker) return;
	WeakSetMethods.add(maker.handedIn, value);
}

/**
 * Whether a prototype set on a node would be set on a value the module holds (its own object, its array, a class
 * instance or emitter it exports) rather than on the node's own record (see the node's setPrototypeOf trap).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {boolean} True when the module's value takes it.
 * @private
 */
function prototypeOnSharedValue(wrapper) {
	if (MapMethods.has(FRAMEWORK_WRITES, wrapper)) return false;
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (moduleObjectOf(wrapper) !== null || Arrays.isArray(impl)) return true;
	return (
		impl !== null &&
		typeof impl === "object" &&
		!util.types.isProxy(impl) &&
		hasOwn(internal, "sourceValue") &&
		internal.sourceValue === impl
	);
}

/**
 * The arguments a call from one module into another is handed while the permission system is on (the class prototype
 * guard, see {@link crossTo}): each object of the caller's reaches the callee as a crossing view, so what the
 * callee stores into it (one of its class's instances, say) reaches the caller as values the callee hands on do. A call
 * from the host, or from a module into itself, is handed its arguments as they are.
 * @param {object} wrapper - The wrapper being called.
 * @param {ArrayLike<*>} args - The call's arguments.
 * @returns {ArrayLike<*>} The arguments, the same list when nothing changed.
 * @private
 */
function crossArguments(wrapper, args) {
	const slothlet = wrapper?.____slothlet;
	if (!args?.length || !slothlet?.handlers?.permissionManager?.isEnabled?.()) return args;
	return wrapper.___crossArgumentsFrom(args, callingModule(slothlet));
}

/**
 * The prototype a closed node's shell holds when the node was given one: a view standing for every holder of the node
 * (the host too), since a closed node reports its shell's prototype to all of them, whether the permission system is on
 * now or not; each read through it is decided for whoever makes it. The language's own prototypes are held as they are.
 * @param {object} wrapper - The node's wrapper.
 * @param {object|Function|null} prototype - The prototype the node was given.
 * @returns {object|Function|null} What the shell holds.
 * @private
 */
function givenShellPrototype(wrapper, prototype) {
	if (givenAsIs(prototype)) return prototype;
	return givenViewOn(wrapper.____slothletInternal, wrapper, wrapper, prototype, SEALED_SHELL_READER, () => assertOwnedWrite(wrapper, null));
}

/**
 * The node a data definition on a node holds in place of the object or function it defines, as a value assigned to
 * the node is held (wrap-on-set): `null` for a value held as it is (a primitive, a built-in data object, a proxy, a
 * node), for any definition during a build, and for a member the definition leaves fixed (read-only and
 * non-configurable), which JavaScript requires the node to report and hand out as the value defined. A definition of
 * a member with the value it holds already keeps that member's node.
 * @param {object} wrapper - The node's wrapper.
 * @param {object} target - The node's proxy target.
 * @param {string|symbol} prop - The member.
 * @param {PropertyDescriptor} descriptor - The definition.
 * @returns {object|null} The node to hold, or `null`.
 * @private
 *
 * @example
 * Object.defineProperty(self.secret.holder, "late", { value: { hidden: "H" }, writable: true });
 * self.secret.holder.late.hidden; // read through the node at secret.holder.late.hidden, gated as any member
 */
function definedValueNode(wrapper, target, prop, descriptor) {
	if (!("value" in descriptor) || wrapper.____slothlet.____buildDepth > 0) return null;
	const value = descriptor.value;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
	if (util.types.isProxy(value) || resolveWrapper(value) !== null) return null;
	if (wrapper.___definitionFixes(target, prop, descriptor)) return null;
	const current = Reflect.getOwnPropertyDescriptor(wrapper, prop);
	const currentNode = current && "value" in current ? resolveWrapper(current.value) : null;
	if (currentNode && hasOwn(currentNode.____slothletInternal, "sourceValue") && currentNode.____slothletInternal.sourceValue === value)
		return current.value;
	const wrapped = wrapper.___createChildWrapper(prop, value, null, true);
	const wrappedInternal = wrapped === null || wrapped === undefined ? null : resolveWrapper(wrapped);
	if (!wrappedInternal) return null;
	wrappedInternal.____slothletInternal.userAssigned = true;
	return wrapped;
}

/**
 * Give an object node the integrity of the object it was built from (#667): a node of an object its module froze,
 * sealed or closed to new members when it loaded is frozen, sealed or closed the same way, as the framework's write, so
 * `Object.isFrozen` answers as on the object and a write the object refuses is refused through the node. The node is
 * built from a copy of the object (see copyForComposition), which is open, so the integrity is read off the object
 * itself. Only a node built from a value it was handed (an export, a member of one): an unloaded lazy node has no value
 * yet, and is closed once it loads.
 * @param {UnifiedWrapper} wrapper - The node's wrapper, whose proxy exists.
 * @returns {void}
 * @private
 *
 * @example
 * adoptObjectIntegrity(wrapper); // wrapper built from Object.freeze({ a: 1 }): Object.isFrozen(proxy) is now true
 */
function adoptObjectIntegrity(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (!hasOwn(internal, "sourceValue")) return;
	const source = internal.sourceValue;
	if (source === null || typeof source !== "object" || Arrays.isArray(source) || util.types.isProxy(source)) return;
	if (Reflect.isExtensible(source)) return;
	if (internal.mode === "lazy" && !internal.state.materialized) return;
	const { proxy } = internal;
	const syncing = internal.integritySyncing;
	internal.integritySyncing = true;
	try {
		frameworkWrite(wrapper, () => {
			if (Objects.isFrozen(source)) Objects.freeze(proxy);
			else if (Objects.isSealed(source)) Objects.seal(proxy);
			else Objects.preventExtensions(proxy);
		});
	} finally {
		internal.integritySyncing = syncing;
	}
}

/**
 * An accessor descriptor defined on an api node at runtime, with its getter and setter adopted as the node's (#597):
 * defined by `Object.defineProperty` after the module loaded, it runs as an exported one does, never as whoever
 * reads it. A data descriptor, or a partial one changing only attributes, is returned as it is.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyDescriptor} descriptor - The descriptor being defined.
 * @returns {PropertyDescriptor} The descriptor to define.
 * @private
 */
function adoptDefinedAccessor(wrapper, descriptor) {
	if (typeof descriptor?.get !== "function" && typeof descriptor?.set !== "function") return descriptor;
	const adopted = adoptAccessor(wrapper, descriptor);
	const result = { ...descriptor };
	if ("get" in descriptor) result.get = adopted.get ?? descriptor.get;
	if ("set" in descriptor) result.set = adopted.set ?? descriptor.set;
	return result;
}

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function TrapsLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/traps", import.meta.url);
	built = true;
	return Base.layer(
		class Traps extends Base {
			static {
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					UnifiedWrapper = registered;
					INSPECT_HOOKS = methods.values.INSPECT_HOOKS;
					definitionBindsTarget = methods.values.definitionBindsTarget;
					dataKind = methods.values.dataKind;
					defineProxyInspect = methods.values.defineProxyInspect;
					frontedDataMember = methods.values.frontedDataMember;
					holdsDataKind = methods.holds.dataKind;
					inheritedEngineMember = methods.inherited.engineMember;
					inherits = methods.values.inherits;
					inspectShown = methods.inspect.shown;
					isArrayIndex = methods.is.arrayIndex;
					isArrayMember = methods.is.arrayMember;
					isBuiltinFunctionMember = methods.is.builtinFunctionMember;
					isCodeMemberWithheld = methods.is.codeMemberWithheld;
					isEnginePromise = methods.is.enginePromise;
					isErrorValue = methods.is.errorValue;
					isFixedOnTarget = methods.is.fixedOnTarget;
					isFixedReadOnly = methods.is.fixedReadOnly;
					isPastFixedLength = methods.is.pastFixedLength;
					isPosition = methods.is.position;
					isReadRedacted = methods.is.readRedacted;
					isUnchangingDefinition = methods.is.unchangingDefinition;
					ownsPrototype = methods.values.ownsPrototype;
					valueHoldsName = methods.values.valueHoldsName;
					FUNCTION_NODES = methods.nodes.FUNCTION_NODES;
					NO_NODE_PRIMITIVE = methods.nodes.NO_NODE_PRIMITIVE;
					NODE_TARGETS = methods.nodes.NODE_TARGETS;
					nodeRefOf = methods.node.refOf;
					nodesShared = methods.nodes.nodesShared;
					nodeInCycle = methods.node.inCycle;
					followModuleObject = methods.nodes.followModuleObject;
					instanceClassNode = methods.instance.classNode;
					moduleObjectKeys = methods.module.objectKeys;
					moduleObjectOf = methods.module.objectOf;
					nodePrimitive = methods.node.primitive;
					originalAccessor = methods.nodes.originalAccessor;
					prototypeForHolder = methods.prototype.forHolder;
					prototypeForReader = methods.prototype.forReader;
					prototypeGiven = methods.prototype.given;
					reportsWritable = methods.nodes.reportsWritable;
					valueOfFor = methods.nodes.valueOfFor;
					enforcePermission = methods.rules.enforcePermission;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					NO_STORED_VALUE = methods.rules.NO_STORED_VALUE;
					rulesShared = methods.rules.rulesShared;
					arrayKeyHolder = methods.rules.arrayKeyHolder;
					assertOwnedWrite = methods.rules.assertOwnedWrite;
					bindCapturedIdentity = methods.rules.bindCapturedIdentity;
					canDefine = methods.rules.canDefine;
					enforceCodeMember = methods.rules.enforceCodeMember;
					enforceRead = methods.rules.enforceRead;
					fixedDescriptor = methods.rules.fixedDescriptor;
					hasOwnMember = methods.has.ownMember;
					memberHoldsCode = methods.rules.memberHoldsCode;
					onImpl = methods.rules.onImpl;
					placingTrap = methods.rules.placingTrap;
					readAsReader = methods.read.asReader;
					refuseFixedObjectDefinition = methods.rules.refuseFixedObjectDefinition;
					shellValue = methods.rules.shellValue;
					takeAccess = methods.rules.takeAccess;
					takeCapturedAccess = methods.rules.takeCapturedAccess;
					withRestartForwarding = methods.rules.withRestartForwarding;
					runShared = methods.run.shared;
					checkpointHandout = methods.checkpoint.handout;
					guardPromotedResult = methods.run.guardPromotedResult;
					inRunTree = methods.run.inRunTree;
					markRunTreeHeld = methods.run.markRunTreeHeld;
					ownRunTreeArray = methods.run.ownRunTreeArray;
					runTreeHides = methods.run.treeHides;
					snapshotBarrier = methods.run.snapshotBarrier;
					snapshotPrototype = methods.run.snapshotPrototype;
					takeRunWrite = methods.run.takeRunWrite;
					unwrapError = methods.run.unwrapError;
					hasOwn = methods.has.own;
					INTRINSIC_HAS_INSTANCE = methods.views.INTRINSIC_HAS_INSTANCE;
					NODE_MEMBER = methods.views.NODE_MEMBER;
					behindMemberView = methods.views.behindMemberView;
					builtinBehind = methods.views.builtinBehind;
					capturedReader = methods.captured.reader;
					emitterOwnPrototype = methods.views.emitterOwnPrototype;
					functionOf = methods.function.of;
					readsEngineProto = methods.views.readsEngineProto;
					selfIsMethodNode = methods.self.isMethodNode;
					selfModuleReader = methods.self.moduleReader;
					unwrapSelfView = methods.views.unwrapSelfView;
					SELF_INSTANCE_NODES = methods.views.SELF_INSTANCE_NODES;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					SERIALIZERS = methods.views.SERIALIZERS;
					behindGivenView = methods.membrane.behindGivenView;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					standInMember = methods.stand.inMember;
					adoptArrayIntegrity = methods.materialize.adoptArrayIntegrity;
					syncArrayIntegrity = methods.materialize.syncArrayIntegrity;
					createNamedProxyTarget = methods.uw.createNamedProxyTarget;
					findThen = methods.uw.findThen;
					GET_TRAP_ALLOWED_INTERNALS = methods.uw.GET_TRAP_ALLOWED_INTERNALS;
					isAwaitableThen = methods.is.awaitableThen;
					isClassInstance = methods.is.classInstance;
					OBJECT_PROTO_SETTER = methods.uw.OBJECT_PROTO_SETTER;
					registerLeafFile = methods.uw.registerLeafFile;
					reservedKeysOwn = methods.uw.reservedKeysOwn;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					UNLOADED_HAS_INSTANCE = methods.uw.UNLOADED_HAS_INSTANCE;
					WRAPPER_ANSWERED_PROPS = methods.uw.WRAPPER_ANSWERED_PROPS;
					registerProxy = methods.values.registerProxy;
					adoptAccessor = methods.materialize.adoptAccessor;
					frameworkWrite = methods.framework.write;
					givenAsIs = methods.given.asIs;
					givenViewOn = methods.given.viewOn;
					SEALED_SHELL_READER = methods.membrane.SEALED_SHELL_READER;
					callingModule = methods.views.callingModule;
					isSlothletValue = methods.is.slothletValue;
					INTRINSICS = methods.values.INTRINSICS;
					makerOf = methods.nodes.makerOf;
					LAYER_FRONTS = methods.nodes.LAYER_FRONTS;
					CLASS_INSTANCES = methods.nodes.CLASS_INSTANCES;
					FUNCTION_NODE_SETS = methods.nodes.FUNCTION_NODE_SETS;
					isSharedValue = methods.is.sharedValue;
					recordPrototypePath = methods.nodes.recordPrototypePath;
					prototypeSiteOf = methods.prototype.siteOf;
					prototypeHandleOf = methods.prototype.handleOf;
					WITHHELD_PROTOTYPES = methods.nodes.WITHHELD_PROTOTYPES;
					markFrameworkInternal = methods.uw.markFrameworkInternal;
					atClassSite = methods.views.atClassSite;
					DATA_NODE_IMPLS = methods.rules.DATA_NODE_IMPLS;
					isTerminalData = methods.is.terminalData;
					accessEntry = methods.access.entry;
					pinsAsCode = methods.root.pinsAsCode;
					pinnedCodeMember = methods.rules.pinnedCodeMember;
					RUN_VIEW_ACCESS = methods.run.RUN_VIEW_ACCESS;
					SETTLED_CHECKPOINTS = methods.run.SETTLED_CHECKPOINTS;
					isCallerLocked = methods.is.callerLocked;
					INHERITED_MEMBER_NODES = methods.values.INHERITED_MEMBER_NODES;
					EMPTY_INHERITED_NODES = methods.values.EMPTY_INHERITED_NODES;
					readGateDecision = methods.read.gateDecision;
					readsNothingBeneath = methods.rules.readsNothingBeneath;
					serializesItself = methods.values.serializesItself;
					PENDING_INVARIANT_READ = methods.views.PENDING_INVARIANT_READ;
					HAS_INSTANCE_BY_IMPL = methods.views.HAS_INSTANCE_BY_IMPL;
					selfHasInstance = methods.self.hasInstance;
					FUNCTION_HAS_INSTANCE = methods.views.FUNCTION_HAS_INSTANCE;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/traps", import.meta.url);
				super(slothlet);
			}

			/**
			 * Create main proxy for this wrapper
			 * Handles lazy/eager mode logic, property access, and context binding
			 *
			 * @returns {Proxy} Main proxy for API
			 * @public
			 */
			___createProxy() {
				const wrapper = this;
				if (wrapper.____slothletInternal.proxy) {
					return wrapper.____slothletInternal.proxy;
				}

				// Proxy target depends on whether this is callable
				// For callable endpoints, use a function as proxy target so typeof === "function"
				// For non-callable, use wrapper itself as target
				// CRITICAL: In lazy mode with unknown callability (isCallable === false but configurable),
				// we MUST use a function target because callability isn't known until materialization.
				// Once the proxy is created, its target type can't change, so we default to function
				// for lazy mode. The apply trap handles non-callable cases gracefully.
				const mightBeCallable =
					wrapper.____slothletInternal.isCallable ||
					(wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.isCallableLocked);
				let proxyTarget;
				if (mightBeCallable) {
					// Create a named function as proxy target for callable wrappers
					// This ensures typeof proxy === "function" and enables function calls
					proxyTarget = createNamedProxyTarget(wrapper.____slothletInternal.apiPath, "callableProxy");
				} else if (Arrays.isArray(wrapper.____slothletInternal.impl)) {
					// Array impl - an empty array shell the wrapper owns is the proxy target, so Array.isArray sees an
					// array while every read, write and definition goes to the module's current array (getTrap
					// delegates reads to the live impl; getPrototypeOf returns Array.prototype). The module's array is
					// never the target: freezing a target pins its elements as plain values every reader must be given,
					// a permission check included, and an eager reload replaces the array under a held reference
					// (#603, #609). Sealing the node fixes its members on the shell as it reports them (see preventExtensions).
					proxyTarget = [];
				} else {
					// Non-callable wrapper - an empty shell the wrapper owns is the target, as for a callable node: the
					// members stay on the wrapper, its live store, and sealing or freezing the node fixes them on the
					// shell as it reports them, its permission check kept on every read (#609). The wrapper itself as the
					// target would be frozen with the node, pinning its own state along with the members.
					proxyTarget = Objects.create(null);
				}

				defineProxyInspect(wrapper, proxyTarget);

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {string|symbol} prop - Property name
				 * @param {Object} receiver - Proxy receiver
				 * @returns {unknown} Resolved property value
				 *
				 * @description
				 * Resolves properties from wrapper properties (children), impl values, or target properties.
				 * Filters internal properties (starting with _ or __) from external access.
				 */
				const getTrap = (target, prop, ____receiver, access = null) => {
					// The wrapper's internal record, read once for this call: the wrapper holds the same record for its whole life.
					const wrapperInternal = wrapper.____slothletInternal;
					// A node of a run's own tree that took a prototype of its own inherits through it what it does not hold itself.
					const runPrototype = wrapperInternal.runPrototype;
					if (
						runPrototype !== undefined &&
						Reflect.isExtensible(target) &&
						Reflect.getOwnPropertyDescriptor(wrapperInternal.proxy, prop) === undefined
					) {
						return runPrototype.prototype === null ? undefined : Reflect.get(runPrototype.prototype, prop, ____receiver);
					}
					// A node a module kept, reading through this one, says who it reads for: taken first, before any code this
					// read runs (a getter, a Proxy's trap) could take it, and handed to this read's own gate (#661) and to a getter
					// of the node's this read runs (see runAccessor).
					const kept = takeCapturedAccess(wrapper);
					if (!kept) return getTrapFor(null, target, prop, ____receiver, access);
					const previous = rulesShared.keptAccessorRead;
					rulesShared.keptAccessorRead = kept;
					try {
						return getTrapFor(kept, target, prop, ____receiver, access);
					} finally {
						rulesShared.keptAccessorRead = previous;
					}
				};
				const getTrapFor = (kept, target, prop, ____receiver, access = null) => {
					// The wrapper's internal record, read once for this call: the wrapper holds the same record for its whole life.
					const wrapperInternal = wrapper.____slothletInternal;
					// What the module's own object holds now is what the node answers (#757).
					followModuleObject(wrapper, target, prop);
					// A member of built-in data or an error the node holds is a read of that value at the node's path.
					gateDataNodeMember(wrapper, prop, kept, access);
					// Read-level permission gating (default-on; opt out via permissions.gating.read: false).
					// Delegates to the module-level enforceReadGate — shared with the
					// waiting-proxy resolver so lazy reads are gated identically.
					const enforceReadGate = (resolvedValue) => enforceRead(wrapper, prop, resolvedValue, undefined, kept, access);

					// CRITICAL: For non-configurable properties on target, must return actual value
					// This satisfies proxy invariants when target has non-configurable own props.
					if (target !== wrapper && prop in target) {
						const desc = Objects.getOwnPropertyDescriptor(target, prop);
						// The function stub target is a bound function with no non-configurable own property (see
						// createNamedProxyTarget); a target the wrapper does not create could still have one, and
						// its member by that name wins only while the invariant allows (a writable one, #571).
						// Only a read-only plain value pins the answer, and is gated before it is returned: a sealed node's
						// writable members (see the preventExtensions trap) leave the read below, gating included, free.
						// An array target's own `length` is non-configurable but writable, which the invariant leaves free
						// too: an array-backed wrapper reads its current array, which an eager reload replaces under the
						// target it was built over (#602). A frozen array's fixed keys still read from the target.
						if (
							desc &&
							"value" in desc &&
							!desc.configurable &&
							!(desc.writable && (hasOwnMember(wrapper, prop) || Arrays.isArray(wrapperInternal.impl)))
						) {
							// Non-configurable property on target - must return actual value
							// But if it's a function target for callable wrapper, redirect to wrapper
							// No framework-reserved property is ever defined on a function target; defensive redirect.
							/* v8 ignore next 3 */
							if (isFrameworkReservedKey(prop)) {
								return wrapper[prop];
							}
							const fixedValue = target[prop];
							wrapper.___gateFixedValue(prop, fixedValue, kept);
							return fixedValue;
						}
					}
					// When target IS the wrapper (non-callable), non-configurable props must return
					// their actual value to satisfy proxy invariants (e.g. ____slothlet from ComponentBase).
					// In practice all wrapper own-properties are configurable; the body is never entered.
					/* v8 ignore start */
					if (target === wrapper && typeof prop === "string") {
						const desc = Objects.getOwnPropertyDescriptor(target, prop);
						if (desc && !desc.configurable) {
							return target[prop];
						}
					}
					/* v8 ignore stop */

					// Filter internal properties from external access (but allow access from within).
					// Only framework-reserved keys are hidden — user properties with any prefix are visible.
					// Impl-metadata names count as reserved here too: `____childFilePaths` rides on a lazy impl and is
					// absent from `INTERNAL_KEYS`, so without this it fell through to the impl read below and handed
					// absolute host paths to any caller — while eager, having no such impl, returned undefined.
					const isInternalProp = isFrameworkReservedKey(prop);

					// Allow access to specific internal APIs that have explicit handlers below
					// CRITICAL: Every prop with an explicit handler in the getTrap MUST be listed here,
					// otherwise the filter short-circuits before the handler runs.
					if (isInternalProp && !SetMethods.has(GET_TRAP_ALLOWED_INTERNALS, prop)) {
						return undefined; // Hide internal properties from external access
					}

					// Debug logging for collision scenarios. The entry is built only when a debug logger is set: without one
					// `debug()` drops it, and building it reads nothing that runs code.
					if ((prop === "power" || prop === "add") && this.____slothlet.debugLogger) {
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_GET_START",
							apiPath: wrapperInternal.apiPath,
							prop: String(prop),
							mode: wrapperInternal.mode,
							// collisionMode is always set; the || "none" fallback is never reached.
							/* v8 ignore next */
							collisionMode: wrapperInternal.state.collisionMode || "none",
							materialized: wrapperInternal.state.materialized,
							hasImpl: wrapperInternal.impl !== null,
							inWrapper: !isInternalProp && hasOwn(wrapper, prop)
						});
					}

					if (prop === "____materializeOnCreate") return wrapperInternal.materializeOnCreate;
					if (prop === "____displayName") return wrapperInternal.displayName;
					if (prop === "___materialize") return FunctionMethods.bind(wrapper.___materialize, wrapper);
					// Note: "____state", "____impl" are intentionally NOT handled here - blocked from proxy.
					// A node reports what slothlet knows about it through `slothlet.node(target)`, never through keys of its own.
					// "____invalid" is not in allowedInternals so the filter above always short-circuits before this line.
					/* v8 ignore next */
					if (prop === "____invalid") return wrapperInternal.invalid;
					// A loaded node holding a primitive (kept from before its folder loaded as one) answers as the value: its
					// members are the value's, run on the value, and it serializes as the value (#797). Gated above.
					const heldPrimitive = nodePrimitive(wrapper);
					if (heldPrimitive !== NO_NODE_PRIMITIVE && prop !== "then" && prop !== util.inspect.custom && !hasOwn(wrapper, prop)) {
						if (prop === "toJSON") return () => heldPrimitive;
						return standInMember(heldPrimitive, prop);
					}
					// Transparent array wrapper: when the impl is an array this proxy is array-targeted. Array
					// INTRINSICS (length, Symbol.iterator, array methods, Symbol.toStringTag, constructor, …)
					// delegate to the live array so the wrapper behaves exactly like an Array — isArray,
					// length, iteration, spread, methods and JSON.stringify all work. Numeric INDEX reads fall
					// through to the normal property-wrapping path below, so each element becomes a child
					// UnifiedWrapper (apiPath `arr.<i>`) — api.add, permission gating, context, hooks and
					// reload work at arr[i] and deeper, exactly like object properties. Array methods/iterator
					// run with `this` = this proxy, so they read indices back through getTrap → child wrappers.
					/**
					 * An array member's value, read once by the block below.
					 * @type {{value: unknown}|null}
					 */
					let arrayElement = null;
					{
						const arrImpl = wrapperInternal.impl;
						if (Arrays.isArray(arrImpl)) {
							// A key the module put on the array itself (`list.toJSON = …`, `list.meta = {…}`) is a member
							// like an element, not an intrinsic: reading it raw would skip the gates, hooks and context
							// an object's member gets (#603 review). `length` stays the array's own.
							if (!isArrayMember(arrImpl, prop)) {
								// A composed node's layer binds the array's methods to the raw array; taken from the array under it,
								// they run with this node as `this` and read and write through its traps.
								const intrinsics = layerUnderlying(arrImpl);
								const arrValue = Reflect.get(intrinsics, prop, intrinsics);
								enforceReadGate(arrValue);
								return arrValue;
							}
							// A member's child wrapper, kept on the wrapper, is a cache of `arrImpl[prop]` (#602):
							// a write, `pop()` or `splice()` may since have replaced or removed the element, through
							// the api or through the module's own reference to the array. Drop it then, so the read
							// below resolves the member the array holds now.
							// The member is read once, as a read of the array does: a getter the array holds runs once, and a
							// proxy array answers through its own get trap even for a key it does not hold (#603 review).
							const element = Reflect.get(arrImpl, prop, arrImpl);
							if (hasOwn(wrapper, prop)) {
								const cached = Objects.getOwnPropertyDescriptor(wrapper, prop).value;
								const cachedSource = resolveWrapper(cached)?.____slothletInternal.sourceValue;
								if (cached !== element && cachedSource !== element) delete wrapper[prop];
							}
							if (element === undefined) return undefined;
							arrayElement = { value: element };
							// member → fall through to the child-wrapping path below, with the value just read.
						}
					}
					// A node of a built-in data object answers what its kind defines from the object, as the object does.
					const fronted = frontedDataMember(wrapper, prop);
					if (fronted !== NODE_MEMBER) return fronted;
					// #475 / #571: a member whose name collides with a property this trap otherwise answers
					// itself (`name`, `length`, `toString`, …) — a module export, or a folder entry such as
					// `session/name/` — takes the ordinary child path below: reachable, and read-gated like any
					// other member. Without this the wrapper's own answer (the api-path name, the impl's arity,
					// …) shadowed the member and skipped enforcement entirely. Only those names and `then` consult it,
					// so any other read skips the lookup.
					const memberShadowsWrapperProp =
						(prop === "then" || SetMethods.has(WRAPPER_ANSWERED_PROPS, prop)) &&
						(hasOwnMember(wrapper, prop) || valueHoldsName(wrapper, prop));
					if (prop === "then") {
						// An unmaterialized lazy wrapper is thenable the same way its waiting proxies are: `await`
						// means "load now". Resolving with the proxy itself keeps the awaited value identical to
						// every later access, so enumeration cannot race a fire-and-forget materialization and
						// answer with a partial surface. A materialized wrapper stays non-thenable, so awaits on
						// settled values remain pass-throughs rather than re-entrant loads.
						if (wrapperInternal.mode === "lazy" && !wrapperInternal.state.materialized) {
							// A node that loads as a primitive resolves with the value, as an `await` of the value does, and is a
							// read of the node for whoever awaits it (#797).
							const pinned = pinReader(wrapper, access);
							return (onFulfilled, onRejected) =>
								PromiseMethods.catch(
									PromiseMethods.then(wrapper.___materialize(), () => {
										const held = nodePrimitive(wrapper);
										if (held === NO_NODE_PRIMITIVE) return onFulfilled(wrapperInternal.proxy);
										if (pinned) wrapper.___gateNodeValue(kept, null, pinned);
										return onFulfilled(held);
									}),
									onRejected
								);
						}
						// A `then` holding data (a JSON Schema `if`/`then`/`else`) reads back as itself: it does not make
						// the node awaitable. A member by that name takes the ordinary member read below, gating and
						// unwrapping included; a callable one never reaches a node (it is refused at load), so a loaded
						// node otherwise answers `undefined` and an `await` of it resolves the node.
						const hasThenMemberOfItsOwn = memberShadowsWrapperProp || hasOwn(wrapper, "then");
						if (!hasThenMemberOfItsOwn || typeof wrapper.then === "function") {
							const thenImpl = wrapperInternal.impl;
							if (!hasThenMemberOfItsOwn && thenImpl !== null && (typeof thenImpl === "object" || typeof thenImpl === "function")) {
								// One the impl inherits (a prototype's data `then`) is read off the impl, as native.
								const inherited = findThen(thenImpl);
								if (inherited && !isAwaitableThen(inherited)) {
									enforceReadGate(inherited.value);
									return inherited.value;
								}
							}
							return undefined;
						}
					}
					// A node fronting a class instance answers `__proto__` with the prototype it reports to `Object.getPrototypeOf`,
					// as an object's `__proto__` is its prototype (#667): the same answer behind the same checks, never a member of
					// its own. A `__proto__` the module's value holds or inherits from below `Object.prototype` is a member like any
					// other.
					if (prop === "__proto__") {
						const protoImpl = wrapperInternal.impl;
						if (
							protoImpl !== null &&
							typeof protoImpl === "object" &&
							functionOf(protoImpl) === null &&
							!util.types.isProxy(protoImpl) &&
							isClassInstance(protoImpl) &&
							readsEngineProto(protoImpl)
						) {
							return reportedPrototype(target, () => kept);
						}
						// A namespace slothlet composed answers the prototype it reports too, unless the prototype it has holds a
						// `__proto__` member of its own, or it has none to inherit the accessor from.
						// So does a function node given another prototype; one keeping its function's reads it as the function does, below.
						if (protoImpl !== null && (typeof protoImpl === "object" || typeof protoImpl === "function") && !hasOwn(wrapper, prop)) {
							const from = wrapper.___nodeInherits(prop);
							if (
								from !== undefined &&
								from !== null &&
								!util.types.isProxy(from) &&
								(typeof protoImpl === "object" || prototypeGiven(wrapper)) &&
								readsEngineProto(from)
							) {
								return reportedPrototype(target, () => kept);
							}
						}
					}
					if (prop === "constructor" && !memberShadowsWrapperProp) {
						// A live object impl within a wrap-on-set/add() GRAFTED subtree (`deferChildAdopt`,
						// same gate as the getPrototypeOf trap), OR any EventEmitter-derived impl regardless
						// of how it was mounted, exposes its OWN real constructor — e.g. a wrap-on-set plain
						// object, or a `net.Socket`/EventEmitter mounted via either wrap-on-set or api.add()
						// (#340) — `instanceof`/brand checks that read `.constructor` see the actual class. An
						// ordinary framework-built namespace wrapper's impl is an internal scaffold object,
						// so it keeps the previous generic `Object.prototype.constructor`, exactly as before.
						const internal = wrapperInternal;
						const constructorImpl = internal.impl;
						// A function node answers its function's own `constructor` (`Function`, `AsyncFunction`, …), as the
						// function does, rather than `Object` (#630); one the module defined on it is its code (#632).
						if (typeof constructorImpl === "function") {
							const fnConstructor = wrapper.___functionMember(constructorImpl, prop);
							const inherited = inheritedEngineMember(constructorImpl, prop, fnConstructor);
							if (inherited) return inherited.value;
							enforceCodeMember(wrapper, fnConstructor, kept);
							return fnConstructor;
						}
						// An instance of a class a node fronts answers that node, as the instance answers its class (#667): the reader
						// gets the class as a read of the node gives it.
						const exportedClass = wrapper.___exportedInstanceClass();
						if (exportedClass !== null) return wrapper.___functionNodeFor(exportedClass);
						const constructorIsLiveIdentity = internal.deferChildAdopt || (EventEmitter && inherits(constructorImpl, EventEmitter));
						if (constructorIsLiveIdentity && constructorImpl && typeof constructorImpl === "object" && constructorImpl.constructor) {
							// A class of the module's is its code, checked as a call of the node (#632).
							const liveConstructor = constructorImpl.constructor;
							enforceCodeMember(wrapper, liveConstructor, kept);
							return liveConstructor;
						}
						// An instance of a class of the module's that no node fronts (the module keeps the class to itself) answers
						// its class as a member of the instance's node, as `__proto__` gives its prototype (#667): read through
						// that node, the class's `prototype` and methods stay behind the node's checks.
						const instanceClass = instanceClassNode(wrapper);
						if (instanceClass !== null) return instanceClass;
						// A `constructor` its prototype answers through an accessor of the module's is read as any accessor member
						// is, run as the module (#597): the class it answers is handed out as above, as the plain instance answers it.
						const constructorAccessor =
							constructorImpl !== null && typeof constructorImpl === "object" && !Arrays.isArray(constructorImpl)
								? wrapper.___implAccessor(prop)
								: null;
						if (constructorAccessor?.descriptor) {
							const answered = wrapper.___readImplMember(prop);
							if (answered === null || (typeof answered !== "object" && typeof answered !== "function")) return answered;
							if (typeof answered !== "function") return wrapper.___createChildWrapper(prop, answered) ?? answered;
							if (nodeRefOf(FUNCTION_NODES, wrapper.____slothlet, answered) !== undefined) return wrapper.___functionNodeFor(answered);
							return instanceClassNode(wrapper, answered) ?? answered;
						}
						// A namespace given another prototype reads its `constructor` from there, through the member read below.
						const constructorFrom = wrapper.___nodeInherits(prop);
						if (constructorFrom === undefined || constructorFrom === Objects.prototype) return NativeObject;
					}
					if (prop === util.inspect.custom) {
						// What the node shows to `util.inspect` (see inspectShown): the same as its target's own hook.
						return (...args) => inspectShown(wrapper, args);
					}
					if (prop === Symbol.toStringTag) {
						// Return "Object" for object exports, "Function" for function exports
						const impl = wrapperInternal.impl;
						// A built-in data object answers the tag the language gives its kind (`Map`, `Set`, a typed array's), as it
						// does itself; one whose kind has none (a date) answers "Object", as a Proxy of it does.
						if (dataKind(impl) !== null) {
							const tag = Reflect.get(impl, prop, impl);
							return typeof tag === "string" ? tag : "Object";
						}
						if (typeof impl === "function") {
							return "Function";
						}
						if (impl && typeof impl === "object" && typeof impl.default === "function") {
							return "Function";
						}
						return "Object";
					}
					// A lazy node not loaded yet has made no instances, so `instanceof` against it answers false. It
					// is answered here rather than through `prototype`, which stays unset until the node loads, so a
					// `class extends` of an unloaded node fails loudly instead of extending a stand-in.
					if (prop === Symbol.hasInstance) {
						const { mode, state, impl } = wrapperInternal;
						if (mode === "lazy" && !state.materialized) return UNLOADED_HAS_INSTANCE;
						// A loaded callable node answers `instanceof` from its function's own `prototype`, as the engine would,
						// without reading `prototype` through the node: that read is checked as a call of the node (#632), and a
						// module the node is closed to may still test an instance against it.
						const fnImpl = functionOf(impl);
						if (fnImpl && !wrapper.___hasOwnSymbolMember(prop)) {
							// A `Symbol.hasInstance` the function inherits from a class of the module's (a base class's own static) is
							// that class's code, which `instanceof` asks as it asks it on the plain function (#667); it is handed out
							// as a static method is, so reading it is checked as a call of the node (#632).
							const inherited = Reflect.get(fnImpl, prop, fnImpl);
							if (typeof inherited === "function" && inherited !== INTRINSIC_HAS_INSTANCE) {
								enforceCodeMember(wrapper, inherited, kept);
								return inherited;
							}
							return hasInstanceOf(fnImpl);
						}
					}
					// A symbol the module's value holds as its own key is a member, as in plain JS (`obj[sym]`); any other
					// symbol is not one, and the wrapper has no answer of its own for it.
					// One the node inherits from a prototype set on it is read below, as a member by any other key is.
					if (typeof prop === "symbol" && !wrapper.___hasOwnSymbolMember(prop) && !inheritsSymbol(wrapper, prop)) return undefined;
					if (prop === "length" && !memberShadowsWrapperProp) {
						// Return actual function length from impl
						const impl = wrapperInternal.impl;
						if (typeof impl === "function") {
							return impl.length;
						}
						if (impl && typeof impl === "object" && typeof impl.default === "function") {
							return impl.default.length;
						}
						return 0;
					}
					if (prop === "prototype" && !memberShadowsWrapperProp) {
						// The impl function's own `prototype`, as the function itself reads it (so `instanceof`
						// against a callable wrapper tests the class's instances); a namespace has none.
						// The class's own prototype, which the module's instances report as theirs as well (#597).
						// It holds the class's methods and its `constructor`, so reading it is checked as a call of the node (#632).
						const impl = wrapperInternal.impl;
						const fnImpl = functionOf(impl);
						if (!fnImpl) return undefined;
						const prototype = fnImpl.prototype;
						enforceCodeMember(wrapper, prototype, kept);
						return prototypeForReader(wrapper, wrapper.___exposePrototype(prototype), "prototype");
					}
					if (prop === "name" && !memberShadowsWrapperProp) {
						// A class reached as an instance's `constructor` answers the name the class has, as on the plain instance (#667).
						if (hasOwn(wrapperInternal, "className")) return wrapperInternal.className;
						// Return name derived from API path, not the internal function name
						// This ensures consistency: api.logger should report as "logger", not "log"
						// apiPath is always set for valid wrappers; defensive false branch never taken.
						/* v8 ignore next */
						if (wrapperInternal.apiPath) {
							const pathParts = splitText(wrapperInternal.apiPath, ".");
							const lastPart = pathParts[pathParts.length - 1];
							// lastPart is always non-empty for valid paths; the false branch never falls through.
							/* v8 ignore next */
							if (lastPart) {
								return lastPart;
							}
						}
						// Fallback never reached since apiPath and lastPart are always truthy; || "unifiedWrapperProxy" is dead.
						/* v8 ignore next */
						return target.name || "unifiedWrapperProxy";
					}
					if (prop === "toString" && !memberShadowsWrapperProp) {
						// Return toString bound to the actual impl, not the proxy target
						// A `toString` the module defined on its function is its code, checked as a call of the node (#632).
						const impl = wrapperInternal.impl;
						const fnImpl = functionOf(impl);
						if (fnImpl) {
							const method = wrapper.___functionMember(fnImpl, prop);
							// A function given a prototype without one has none, as the plain function then has.
							if (typeof method !== "function") return method;
							enforceCodeMember(wrapper, method, kept);
							return FunctionMethods.bind(method, fnImpl);
						}
						// A loaded object node answers its `toString` as the object does, through the member read below (#630).
						if (impl === null || typeof impl !== "object") {
							// For non-callable wrappers, return a descriptive string
							if (typeof target === "function") {
								return FunctionMethods.bind(functionToString, target);
							}
							return () => `[UnifiedWrapper: ${wrapperInternal.apiPath}]`;
						}
					}
					if (prop === "valueOf" && !memberShadowsWrapperProp) {
						// A `valueOf` the module defined on its function is its code, bound to the impl and checked as a call of
						// the node (#632). The inherited one answers the node itself, as a value's own `valueOf()` answers the
						// value: called on a node it answers that node, and called detached the node it was read from, where
						// binding it to the impl handed out the raw function behind the node (#630).
						const impl = wrapperInternal.impl;
						const fnImpl = functionOf(impl);
						if (fnImpl) {
							const method = wrapper.___functionMember(fnImpl, prop);
							const inherited = inheritedEngineMember(fnImpl, prop, method);
							if (inherited) return valueOfFor(wrapperInternal.proxy);
							if (typeof method !== "function") return method;
							enforceCodeMember(wrapper, method, kept);
							return FunctionMethods.bind(method, fnImpl);
						}
						// A loaded object node reads its `valueOf` through the member read below.
						if (impl === null || typeof impl !== "object") return FunctionMethods.bind(PrototypeFunctions.Object.valueOf, target);
					}
					if (prop === "toJSON" && !memberShadowsWrapperProp) {
						// Called by JSON.stringify / util.inspect / pretty-format during serialization.
						// Delegate to a user-defined impl.toJSON when present; otherwise serialize as the
						// faithful underlying data (reconstructed from the wrapper tree, arrays preserved) so
						// the wrapper is opaque to the outside — JSON.stringify(wrapper) yields the real value,
						// not undefined. (Array impls are handled by the array-delegation block above.)
						const impl = wrapperInternal.impl;
						// A function node's own `toJSON` (a static method of a class) is the module's code, checked as a call of
						// the node (#632).
						// What it gives is held to the rules at the node's path and each member's name, for whoever serializes it
						// and, through a view a module kept, for that module too (see capturedView).
						if (impl && typeof impl.toJSON === "function") {
							const method = impl.toJSON;
							enforceCodeMember(wrapper, method, kept);
							const path = wrapperInternal.apiPath;
							const serializeOwn = (readers, ___node, keptAccess = kept, args = []) =>
								wrapper.___redactToJSONResult(Reflect.apply(method, impl, args), path, readers, keptAccess);
							const ownToJSON = (...args) => serializeOwn([undefined], null, kept, args);
							WeakMapMethods.set(SERIALIZERS, ownToJSON, serializeOwn);
							return ownToJSON;
						}
						// The snapshot for the given readers (`undefined` for whoever is reading now), read through `node`: a
						// module's kept node serializes for that module and for the module serializing it.
						const serialize = (readers, node, kept = null) => {
							// A getter is read through its node as whoever serializes now; one that reader may not run is left out,
							// as a member the reader may not read is.
							const readMember = (holder, key) => {
								try {
									return { value: holder.___createProxy()[key] };
								} catch (error) {
									if (error?.code === "PERMISSION_DENIED") return { withheld: true };
									throw error;
								}
							};
							const data = UnifiedWrapper._extractFullImpl(wrapper, readMember);
							// _extractFullImpl re-adds reload-only metadata (____childFilePaths — absolute file
							// paths — for lazy folder leaves) that must never leak into serialization output.
							if (data && typeof data === "object") {
								delete data.____childFilePaths;
								delete data.____childFilePathsPreMaterialize;
							}
							// The snapshot is rebuilt straight from the impl tree, so it bypasses the read
							// gate on getTrap. Strip leaves this caller may not read before handing it over.
							const pm = wrapper.____slothlet.handlers?.permissionManager;
							if (pm && pm.isEnabled() && pm.isReadGatingEnabled()) {
								let redacted = data;
								for (let r = 0; r < readers.length; r++) {
									const reader = readers[r];
									redacted = redactSerialized(wrapper, redacted, wrapperInternal.apiPath, node, new WeakSet(), reader, kept);
								}
								return redacted;
							}
							return data;
						};
						const toJSON = () => serialize([undefined], wrapperInternal.proxy);
						WeakMapMethods.set(SERIALIZERS, toJSON, serialize);
						return toJSON;
					}

					if (wrapperInternal.invalid) {
						return undefined;
					}

					if (wrapperInternal.mode === "lazy" && !wrapperInternal.state.materialized && !wrapperInternal.state.inFlight) {
						PromiseMethods.catch(wrapper.___materialize(), () => {});
					}

					// If lazy mode is materialized and property doesn't exist in ____impl, return undefined
					// CRITICAL: Check wrapper children BEFORE creating waiting proxy
					// In lazy mode with collisions, children may already be on wrapper (from file/folder merge)
					// Return these children directly instead of creating waiting proxy.
					// No reserved-name re-check here: every framework name either returned from its own handler
					// above or was filtered by `isInternalProp`, so anything still in flight is a module member.
					//
					// On a wrap-on-set LIVE VIEW (`deferChildAdopt`) an own property is only a cache of
					// `impl[prop]` (#495). Drop it when the underlying object has since moved on, so the read
					// below re-resolves from impl instead of serving a stale child: a cached child wrapper
					// fronting a value the key no longer holds, or a primitive live accessor whose key now holds
					// an object (the accessor would hand that object back raw, unwrapped).
					// A class-instance impl is a live view too (#590): its methods change its own fields.
					if (
						(wrapperInternal.deferChildAdopt || isClassInstance(wrapperInternal.impl)) &&
						hasOwn(wrapper, prop) &&
						!runTreeHolds(wrapper, prop)
					) {
						const liveImpl = wrapperInternal.impl;
						if (liveImpl !== null && (typeof liveImpl === "object" || typeof liveImpl === "function") && prop in liveImpl) {
							const cachedDesc = Objects.getOwnPropertyDescriptor(wrapper, prop);
							// Read as the module's own read of it (#597): a getter on the impl is the module's code.
							const current = wrapper.___readImplMember(prop);
							const stale =
								typeof cachedDesc.get === "function"
									? current !== null && (typeof current === "object" || typeof current === "function")
									: cachedDesc.value !== current && resolveWrapper(cachedDesc.value)?.____slothletInternal.impl !== current;
							if (stale) delete wrapper[prop];
						}
					}
					if (hasOwn(wrapper, prop)) {
						// CRITICAL: In replace mode, check if property should exist at all
						if (wrapperInternal.state.collisionMode === "replace" && (prop === "power" || prop === "add")) {
							this.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_GET_CACHED_REPLACE",
								apiPath: wrapper.apiPath,
								prop: String(prop),
								collisionMode: wrapperInternal.state.collisionMode,
								wrapperKeys: ArrayMethods.join(
									filterList(Objects.keys(wrapper), (k) => !isFrameworkReservedKey(k)),
									", "
								)
							});
						}
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_GET_CACHED",
							apiPath: wrapperInternal.apiPath,
							prop: String(prop),
							materialized: wrapperInternal.state.materialized,
							hasImpl: wrapperInternal.impl !== null
						});
						const cached = wrapper[prop];
						// If it's a wrapper (proxy) with a primitive impl, return the unwrapped value
						// This ensures live runtime gets the actual value, not the wrapper object
						const _cachedWrapper = resolveWrapper(cached);
						// A node holding a primitive, or a file's null or undefined (#792), answers the value itself.
						if (_cachedWrapper && _cachedWrapper.___holdsValue()) {
							const cachedValue = _cachedWrapper.___heldValue();
							enforceReadGate(cachedValue);
							return cachedValue;
						}
						// If cached is a wrapper (proxy) in lazy mode that needs materialization, trigger it
						if (_cachedWrapper) {
							const cachedWrapper = _cachedWrapper;
							if (
								cachedWrapper.____slothletInternal.mode === "lazy" &&
								!cachedWrapper.____slothletInternal.state.materialized &&
								!cachedWrapper.____slothletInternal.state.inFlight
							) {
								// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
								/* v8 ignore next */
								PromiseMethods.catch(cachedWrapper.___materialize(), () => {});
							}
						}
						// For objects and functions, return the proxy as-is.
						// A raw cached built-in (Buffer/Map/Date/…) is gated; child wrappers are not.
						enforceReadGate(cached);
						return cached;
					}

					// CRITICAL: Check if ____impl is already set (matches v2's state.materialized check)
					// This allows synchronous property access even during materialization
					// Must check BEFORE inFlight to handle synchronous setter pattern
					// Note: ____impl is initialized to null, so check for non-null explicitly
					if (wrapperInternal.impl !== null && wrapperInternal.impl !== undefined) {
						// If ____impl is a custom Proxy, delegate property access directly to it
						// Custom proxies handle their own property access logic (array indices, computed properties, etc.)
						if (!arrayElement && typeof wrapperInternal.impl === "object" && util.types.isProxy(wrapperInternal.impl)) {
							// A module's own Proxy answers as that module, whoever reads it (#597). What it hands out is not a node of its
							// own, so the module's code among it — a method of a class instance behind a composition layer — is checked
							// as a call of the node before it is handed out (#632).
							const proxied = wrapper.___readImplMember(prop);
							// A layer hands a method of the value under it out bound to that value: the method is what decides, so
							// a built-in's (a Map's `get`) is the language's, not the module's.
							enforceCodeMember(wrapper, layerMethodOriginal(proxied) ?? proxied, kept);
							return proxied;
						}

						// For regular objects/functions, check wrapper children or ____impl properties
						// (reserved names never reach here — see `isInternalProp` above)
						// In tests, wrapper never holds a prop directly via hasOwn; the true-branch body is never entered.
						/* v8 ignore start */
						if (hasOwn(wrapper, prop)) {
							if (prop === "power" || prop === "add") {
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_GET_PROXYGET_ACCESSING",
									prop,
									wrapperId: wrapperInternal.id,
									apiPath: wrapper.apiPath,
									collisionMode: wrapperInternal.state.collisionMode || "none"
								});
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_GET_PROXYGET_FOUND",
									wrapperKeys: ArrayMethods.join(
										filterList(Objects.keys(wrapper), (k) => !isFrameworkReservedKey(k)),
										", "
									)
								});
							}
							const cached = wrapper[prop];
							// If cached is a wrapper (proxy) in lazy mode that needs materialization, trigger it
							const _cachedWrapper4 = resolveWrapper(cached);
							if (_cachedWrapper4) {
								const cachedWrapper = _cachedWrapper4;
								if (
									cachedWrapper.____slothletInternal.mode === "lazy" &&
									!cachedWrapper.____slothletInternal.state.materialized &&
									!cachedWrapper.____slothletInternal.state.inFlight
								) {
									PromiseMethods.catch(cachedWrapper.___materialize(), () => {});
								}
							}
							enforceReadGate(cached);
							return cached;
						}
						/* v8 ignore stop */
					}

					// If lazy mode is materialized and property doesn't exist in wrapper or ____impl, return undefined
					// This prevents creating waiting proxies for properties that were deleted.
					// Only framework-reserved keys bypass this check (they're handled elsewhere in getTrap).
					const isInternalProp2 = typeof prop === "string" && SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, prop);
					if (
						wrapperInternal.mode === "lazy" &&
						wrapperInternal.state.materialized &&
						!isInternalProp2 &&
						!hasOwn(wrapper, prop) &&
						// A loaded namespace whose members live on the wrapper alone holds no impl: a remove that restored an
						// overwritten namespace leaves it so. It holds nothing else, so it waits for nothing.
						((wrapperInternal.impl === null && !wrapperInternal.state.inFlight) ||
							(wrapperInternal.impl &&
								// A Proxy answers reads through its get trap, which can serve members its `in` check does not
								// report; the read below asks it, as eager does (#585 review).
								!util.types.isProxy(wrapperInternal.impl) &&
								!wrapper.___implHas(wrapperInternal.impl, prop))) &&
						wrapper.___moduleInheritance(prop) === null
					) {
						return undefined;
					}

					if (wrapperInternal.mode === "lazy" && (wrapperInternal.state.inFlight || !wrapperInternal.impl)) {
						// Trigger materialization if not started yet
						// This ensures lazy wrappers start loading when their properties are accessed.
						// Tests always reach this block via inFlight=true; the !inFlight sub-condition is
						// never simultaneously true here, so ___materialize() is never called from this path.
						/* v8 ignore next */
						if (!wrapperInternal.state.materialized && !wrapperInternal.state.inFlight) {
							PromiseMethods.catch(wrapper.___materialize(), () => {});
						}

						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_LAZY_GET_CREATE_WAITING_PROXY",
							prop: String(prop),
							// collisionMode is always set on lazily-materialized wrappers; the || "none" fallback is never reached.
							/* v8 ignore next */
							collisionMode: wrapperInternal.state.collisionMode || "none",
							apiPath: wrapperInternal.apiPath
						});

						// If ____impl is already set and is a custom proxy, delegate even during inFlight.
						// No test has a native Proxy set as the impl while inFlight; body is unreachable.
						/* v8 ignore start */
						if (wrapperInternal.impl && typeof wrapperInternal.impl === "object" && util.types.isProxy(wrapperInternal.impl)) {
							return wrapper.___readImplMember(prop);
						}
						/* v8 ignore stop */
						return wrapper.___createWaitingProxy([prop]);
					}

					// If ____impl is a custom Proxy, delegate property access directly to it. A proxy over an array is
					// an array member, whose member was read above and is wrapped and gated like any other.
					// No test passes a native non-array Proxy as the impl; entire block is unreachable.
					/* v8 ignore start */
					if (
						!arrayElement &&
						wrapperInternal.impl &&
						typeof wrapperInternal.impl === "object" &&
						util.types.isProxy(wrapperInternal.impl)
					) {
						// Return the value directly - don't wrap it
						// This preserves custom proxy behavior for array access, computed properties, etc.
						// A module's own Proxy answers as that module, whoever reads it (#597).
						return wrapper.___readImplMember(prop);
					}
					/* v8 ignore stop */

					// Check if the property exists on impl before caching
					// This handles property descriptors (getters) correctly
					// impl is always set when this get trap is reached; the : undefined fallback is never taken.
					// An array member's value was read once already, by the array block above.
					/* v8 ignore next */
					// An accessor the impl holds that adoption did not put on the wrapper — one on an object assigned through
					// the api, or inherited — runs as the module the node belongs to, never as whoever reads it (#597).
					let value = arrayElement ? arrayElement.value : wrapperInternal.impl ? wrapper.___readImplMember(prop) : undefined;
					// A member the node inherits from its own prototype, or the module's object inherits from its, stays inherited:
					// read as a member of the node is, and never kept as one of the node's own (#913).
					const inheritedImpl = wrapperInternal.impl;
					const isInherited =
						value !== undefined &&
						!arrayElement &&
						(wrapper.___nodeInherits(prop) !== undefined ||
							(inheritedImpl !== null && typeof inheritedImpl === "object" && !hasOwn(inheritedImpl, prop) && !hasOwn(target, prop)));

					// Fallback: value lives directly on the proxy target rather than on impl.
					// Reached only when impl doesn't have the key but target does (e.g., a property
					// set directly on the wrapper object before the proxy was created).
					/* v8 ignore next */
					if (value === undefined && Objects.hasOwn(target, prop)) {
						value = target[prop];
					}

					if (value === undefined) {
						return undefined;
					}

					// Read-level permission gating: enforce before any terminal value is
					// returned below. No-op for child namespace/callable wrappers.
					enforceReadGate(value);

					// Return primitives directly without wrapping
					// Primitives: string, number, boolean, bigint, symbol, null
					const valueType = typeof value;
					if (
						value === null ||
						valueType === "string" ||
						valueType === "number" ||
						valueType === "boolean" ||
						valueType === "bigint" ||
						valueType === "symbol"
					) {
						return value;
					}

					// Return built-in objects that require proper 'this' binding directly without wrapping.
					// No test API method returns Map/Set/Date/RegExp/Promise/Error/ArrayBuffer; block unreachable.
					/* v8 ignore start */
					if (dataKind(value) !== null || isErrorValue(value)) {
						return value;
					}
					/* v8 ignore stop */

					// Return custom Proxy objects directly without wrapping
					// Custom proxies (like LGTVControllers) need direct access for array indices and special get traps
					// Wrapping them breaks array access patterns like proxy[0]
					// A Proxy a function node holds as a member of its function is the module's code like any other such member, and
					// is checked as a call of the node before it is handed out (#632).
					if (value && typeof value === "object" && util.types.isProxy(value)) {
						enforceCodeMember(wrapper, value, kept);
						return value;
					}

					if (value && (typeof value === "object" || typeof value === "function") && resolveWrapper(value) !== null) {
						return value;
					}

					// A callable leaf's built-in function surface — inherited Function.prototype/Object.prototype
					// members (apply, call, bind, constructor, …) and the non-enumerable own `prototype` slot — are
					// the function's OWN properties, not child endpoints. Return them directly: wrapping one
					// registered a phantom child and flipped the leaf's record from function to namespace on a mere
					// read (#304). Only a user-added ENUMERABLE own property of the impl materializes as a child.
					// Such a member holding the module's code — a static method, a member defined on the function — is handed out
					// as it is, so reading it is checked as a call of the node (#632).
					// A member inherited from the engine runs on the node, as on the plain value (#630).
					const currentImpl = wrapperInternal.impl;
					if (
						typeof currentImpl === "function" &&
						!FunctionMethods.call(PrototypeFunctions.Object.propertyIsEnumerable, currentImpl, prop)
					) {
						const inherited = inheritedEngineMember(currentImpl, prop, value);
						if (inherited) return inherited.value;
						// A member inherited from a prototype given to the node is no part of the module's function: it is read as
						// a member of the node is, below.
						if (!isInherited || !prototypeGiven(wrapper)) {
							enforceCodeMember(wrapper, value, kept);
							return value;
						}
					}
					// The same holds for an object node: a member it inherits from the engine (`hasOwnProperty`,
					// `__lookupGetter__`, `valueOf`, … from `Object.prototype`) is the object's own surface, not a child
					// endpoint. Wrapping one listed it among the node's keys and gave it an api path, where a `__`-prefixed
					// name read as a module-private export and was denied with permissions on (#630). A member of a class
					// the module wrote is still the module's, and stays a child.
					if (currentImpl !== null && typeof currentImpl === "object") {
						const inherited = inheritedEngineMember(currentImpl, prop, value);
						if (inherited) return inherited.value;
						// A built-in data object keeps what it holds out of its own listing as plain JavaScript does: a member it holds
						// non-enumerable (an error's `cause`, an aggregate error's `errors`) is read from it as data, not made a child
						// node, which `Object.keys()` would then list.
						if (
							holdsDataKind(currentImpl) &&
							hasOwn(currentImpl, prop) &&
							!FunctionMethods.call(PrototypeFunctions.Object.propertyIsEnumerable, currentImpl, prop)
						) {
							enforceCodeMember(wrapper, value, kept);
							return value;
						}
					}

					// A function member that is this node's own function, or an ancestor's, is that node, as in plain JS: it closes
					// the cycle where a new node below would open another level on every read.
					const cycle = nodeInCycle(wrapper, value);
					if (cycle !== null) return cycle.___createProxy();

					// An inherited member read before with the same value is the node made for it then (#913).
					if (isInherited) {
						const held = inheritedMemberNode(wrapper, prop, value);
						if (held !== undefined) return held;
					}

					// Propagate lazy adoption so a wrap-on-set subtree stays lazy on deep access (#329).
					const wrapped = wrapper.___createChildWrapper(prop, value, null, wrapperInternal.deferChildAdopt);
					// `___createChildWrapper` wraps ordinary object/function values — the only outcome reachable
					// from THIS call site, so `wrapped` is always truthy here in practice. It can also return
					// null for an opaque built-in (Map/Set/…) or a cycle bail-out, but neither is reachable via
					// this call: getTrap's own instanceof check just above already filters every opaque built-in
					// before `value` gets here, and the cycle guard can only trip when a value is already an
					// ANCESTOR on an in-progress recursive descent (a `visited` set threaded through an ongoing
					// walk, the way `___adoptImplChildren`'s own eager adoption does it) — this call always
					// passes a literal `null`, i.e. a fresh, empty guard, so `visited.has(value)` can never be
					// true here. A primitive never reaches this call either: getTrap's own earlier terminal-value
					// fast path (above) already returns it directly, before `value` gets here (#340). The
					// null-fallback branch below is kept only for defensive symmetry with `___adoptImplChildren`'s
					// and setTrap's analogous null handling, should a future change ever thread a real
					// cycle-guard set through here.
					// A value a getter returned is not cached: the getter runs again on the next read, as it would in
					// plain JavaScript, so a member it reads stays live (#590).
					if (wrapped && isInherited) return keepInheritedMemberNode(wrapper, prop, value, wrapped);
					if (wrapped && typeof Objects.getOwnPropertyDescriptor(currentImpl, prop)?.get === "function") return wrapped;
					/* v8 ignore start */
					if (wrapped) {
						Objects.defineProperty(wrapper, prop, {
							__proto__: null,
							value: wrapped,
							writable: false,
							enumerable: true,
							configurable: true
						});
						return wrapped;
					}

					return value;
					/* v8 ignore stop */
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target
				 * @param {Object} thisArg - Call receiver
				 * @param {Array} args - Call arguments
				 * @param {boolean} [___gatePassed=false] - Set only by the re-entry after a deferred permission gate.
				 * @param {{store: object|null, identity: object}|null} [___gateEntry=null] - That gate's resolved identity.
				 * @returns {unknown} Call result
				 *
				 * @description
				 * Invokes the underlying impl with context binding when callable.
				 * Integrates hook execution (before/after/always/error) synchronously.
				 * Follows V2 pattern: hooks execute synchronously, async handling via Promise.then().
				 */
				const applyTrap = (target, thisArg, args, ___gatePassed = false, ___gateEntry = null) => {
					// The wrapper's internal record, read once for this call: the wrapper holds the same record for its whole life.
					const wrapperInternal = wrapper.____slothletInternal;
					// An identity handed over for this call (see applyWithEntry) is taken once, as the trap starts, before
					// any code this call runs. One handed for another node's call is dropped: it reaches no call made later.
					let ___handed = null;
					if (rulesShared.handedEntry !== null) {
						if (rulesShared.handedEntry.wrapper === wrapper) ___handed = rulesShared.handedEntry.entry;
						rulesShared.handedEntry = null;
					}
					// A node a module kept, calling through this one, says who it calls for: taken first, before any code this
					// call runs (`this`, its arguments) could take it, and handed to this call's own gate (#661).
					const kept = takeCapturedAccess(wrapper);
					if (wrapperInternal.invalid) {
						// apiPath is always set on constructed wrappers; the || "api" fallback is never reached.
						/* v8 ignore next */
						throw new TypeError(`${wrapperInternal.apiPath || "api"} is invalidated`);
					}
					// What another module or the host passes in reaches this one through the class prototype guard, so what this
					// module stores into it reaches the caller the same way. Done first, on the arguments as the caller holds them.
					if (!___gatePassed) args = crossArguments(wrapper, args);
					// A function or Proxy this module handed out comes back to it as itself (#597), and so does an instance of its
					// own class the async runtime wrapped (#328).
					if (!___gatePassed) args = wrapper.___ownInstances(wrapper.___ownArguments(args));

					// Ordinary JS call semantics (`obj.method()`) pass the *proxy* obj was read through as
					// `this` — but a native method whose behavior depends on internal slots tied to exact
					// object identity (e.g. a `net.Socket`'s stream internals) breaks when it receives the
					// wrapper proxy instead of the real object (#340). Substitute the real underlying impl
					// whenever the call-site `this` resolves to one of OUR OWN wrappers WITHIN a wrap-on-set
					// GRAFTED subtree (`deferChildAdopt`), OR whose impl is an EventEmitter-derived value
					// regardless of mount path (api.add() included — ___adoptImplChildren now bails on such
					// an impl unconditionally, so it is never depleted the way an ordinary wrapper's impl is).
					// NOT applied to an ordinary (non-deferred, non-EventEmitter) wrapper — because
					// ___adoptImplChildren DEPLETES an ordinary wrapper's impl (adopted children are moved
					// onto the wrapper itself and deleted from impl); substituting that depleted impl as
					// `this` broke a plain method reading a SIBLING property via `this.xxx` (e.g. an array
					// element's `run() { return this.id; }` started reading `undefined` — `id` had already
					// been adopted off `impl` onto the wrapper). Within a deferred subtree, or for an
					// EventEmitter-derived impl, impl is never depleted, so the substitution is exactly the
					// real, complete object. A class instance is never depleted either (#589), and its methods
					// read and write the instance's own state through `this`, so it gets the instance too (#590).
					// An ordinary `thisArg`, or one not one of our wrappers, passes through unchanged.
					const thisArgWrapper = resolveWrapper(thisArg);
					const thisArgImpl = thisArgWrapper?.____slothletInternal?.impl;
					// `impl` is nulled by ___invalidate() on removal while `deferChildAdopt` is left
					// untouched, so a stale reference to a removed subtree's wrapper could otherwise still
					// read as "live identity" with a null impl — substituting `null` as `this` and handing
					// the underlying call a confusing TypeError instead of the invalidated-wrapper error.
					// Require the resolved impl to still be a real object/function before substituting it.
					const thisArgImplIsUsable = thisArgImpl !== null && (typeof thisArgImpl === "object" || typeof thisArgImpl === "function");
					const thisArgIsLiveIdentity =
						thisArgWrapper &&
						thisArgImplIsUsable &&
						(thisArgWrapper.____slothletInternal.deferChildAdopt ||
							(EventEmitter && inherits(thisArgImpl, EventEmitter)) ||
							isClassInstance(thisArgImpl));
					// A view `self` handed out is swapped for the value only when it is the method's own module's view of
					// the node the method was read from. A view of any other node a caller steers the method onto
					// (`.call()` / `.apply()`) stays the caller's view, whose writes are held to the caller (#625): the
					// value itself would let any module write another module's instance through a method of its own.
					// A node of a run's tree that holds members the run gave it over its live value stays the receiver, so the method
					// reads and writes the run's copy (see runTreeHolds), as a method called on a copy works on the copy.
					const thisArgIsOwnIdentity =
						thisArgIsLiveIdentity &&
						thisArgWrapper.____slothletInternal.runHeldKeys === undefined &&
						thisArgWrapper.____slothletInternal.runHiddenKeys === undefined &&
						(!WeakMapMethods.has(SELF_VIEW_NODES, thisArg) || selfIsMethodNode(thisArg, wrapper));
					const effectiveThisArg = thisArgIsOwnIdentity ? thisArgImpl : thisArg;
					// A method running on the value itself changes it where no trap sees it: the node is saved first for the runs
					// open (see helpers/run-snapshot).
					if (thisArgIsOwnIdentity && anyRunOpen()) snapshotBarrier(thisArgWrapper);
					// The value stands for its node when it comes back through `self` (#625).
					if (thisArgIsOwnIdentity) WeakMapMethods.set(SELF_INSTANCE_NODES, thisArgImpl, unwrapSelfView(thisArg));

					// Permission enforcement: check before hooks or function execution.
					// Only applies to inter-module calls (caller context exists); external calls
					// from user code (no caller in ALS context) are exempt. Shared with constructTrap.
					// args are threaded so function conditions can gate on the call's own arguments (#455).
					// #459: when a matching rule requires a principal that is not current for this identity, the gate
					// defers — this call alone resolves the stale principals, is enforced against the gate inputs
					// captured before the resolve, then re-enters with the gate already passed. Every other call stays
					// on the synchronous path. `___gatePassed` is only ever set by that re-entry (the Proxy invokes this
					// trap with three arguments).
					// The identity the gate resolved is what the call is entered with (see enforcePermission), carried
					// across a deferred gate too.
					const ___entry = ___gatePassed ? ___gateEntry : {};
					if (!___gatePassed) {
						const ___principalGate = enforcePermission(wrapper, args, true, kept, ___entry, ___handed, thisArg);
						if (___principalGate) {
							return wrapper.___runAfterPrincipalGate(___principalGate, () => applyTrap(target, thisArg, args, true, ___entry));
						}
					}
					const ___entryIdentity = ___entry?.identity ? ___entry : null;

					// Get hook manager if available
					const hookManager = wrapper.____slothlet.handlers?.hookManager;
					// Early exit if hooks disabled globally or this is a hook API function
					const hasHooks = hookManager && hookManager.enabled && !StringMethods.startsWith(wrapperInternal.apiPath, "slothlet.hook");

					// Get api (bound API) and ctx (user context) for hooks
					const api = wrapper.____slothlet.boundApi;
					const ctx = wrapper.____slothlet.config?.context || {};

					// Per-call dispatch strategy (#253): when any matching before/after handler is
					// asynchronous, the whole call runs an asynchronous pipeline — before-chain awaited,
					// target invoked, after-chain awaited — instead of refusing (before) or leaking a
					// pending Promise (after). Derived from the registration state per call and cached
					// behind the hook registry epoch, so removing the async hook returns the path to the
					// synchronous fast path below. Observers (always/error) never force promotion.
					if (hasHooks) {
						const ___strategy = hookManager.getDispatchStrategy(wrapperInternal.apiPath);
						// Around hooks (#496) wrap the whole before → function → after pipeline, with the
						// always/error observers outside them — a different shape from the paths below, so a
						// call that has any runs its own pipeline. A path with none never gets past this flag.
						if (___strategy.hasAround) {
							const ___arounds = hookManager.getHooksForPath("around", wrapperInternal.apiPath);
							// The permission filter can leave this caller with no around hooks at all; the call
							// then takes the ordinary pipeline (still promoted below when an async around is
							// registered for the path — promotion is a property of the path, not the caller).
							if (___arounds.length > 0) {
								return runAroundPipeline(wrapper, hookManager, ___arounds, ___strategy, effectiveThisArg, args, api, ctx, ___entryIdentity);
							}
						}
						if (___strategy.asyncBefore || ___strategy.asyncAfter || ___strategy.asyncAround) {
							const ___path = wrapperInternal.apiPath;
							const ___leafIsAsync =
								util.types.isAsyncFunction(wrapperInternal.impl) || util.types.isAsyncFunction(wrapperInternal.impl?.default);
							const ___promotedRun = (async () => {
								// Before-chain: same protocol as the sync path, thenables awaited.
								let beforeResult;
								try {
									beforeResult = await hookManager.executeBeforeHooksAsync(___path, args, api, ctx);
								} catch (error) {
									// The before-chain itself already ran the error hooks and already honoured
									// suppressErrors (it short-circuits instead of throwing when set), so reaching
									// here means the refusal really does propagate. What the sync path additionally
									// guarantees — from its `finally` — is that `always` observers still fire when a
									// before hook refuses. Promotion is invisible to the caller, so it must not
									// decide whether those observers run: without this, a failing before hook would
									// notify `always` only when no OTHER handler happened to be async.
									hookManager.executeAlwaysHooks(___path, args, undefined, true, [unwrapError(error)], api, ctx);
									throw error;
								}
								args = beforeResult.args;
								if (beforeResult.shortCircuit) {
									// A short-circuit resolves through the promoted pipeline — the target is never
									// invoked, and always hooks still observe the final value.
									hookManager.executeAlwaysHooks(___path, args, beforeResult.value, false, [], api, ctx);
									return beforeResult.value;
								}

								// Materialize if needed (lazy mode) — awaiting here replaces the sync path's
								// polling promise, since this pipeline may await freely.
								if (wrapperInternal.mode === "lazy" && !wrapperInternal.state.materialized) {
									await wrapper.___materialize();
								}

								const impl = wrapperInternal.impl;
								let settled;
								try {
									// rawErrors: a leaf's throw is application data — never re-typed (#252), here as on the
									// synchronous pipeline.
									let raw;
									if (typeof impl === "function") {
										raw = wrapper.____slothlet.contextManager
											? wrapper.____slothlet.contextManager.runInContext(
													wrapper.____instanceID,
													impl,
													effectiveThisArg,
													args,
													wrapper,
													true,
													false,
													null,
													___entryIdentity,
													true
												)
											: FunctionMethods.apply(impl, effectiveThisArg, args);
									} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
										raw = wrapper.____slothlet.contextManager
											? wrapper.____slothlet.contextManager.runInContext(
													wrapper.____instanceID,
													impl.default,
													impl,
													args,
													wrapper,
													true,
													false,
													null,
													___entryIdentity,
													true
												)
											: FunctionMethods.apply(impl.default, impl, args);
									} else {
										throw new wrapper.____SlothletError("API_PATH_NOT_CALLABLE", { path: segmentsOf(___path), received: typeof impl });
									}
									settled = raw && typeof raw === "object" && typeof raw.then === "function" ? await raw : raw;
								} catch (error) {
									// Target failure: same error-hook + suppression semantics as the sync path. Read as the target (#599).
									const failure = wrapper.___readTargetFailure(error);
									const originalError = failure.originalError();
									// The processed marker stops DUPLICATE error hooks for a failure an inner
									// hooked call already reported — it says nothing about `always`, which is a
									// per-call observer the sync path runs unconditionally from its `finally`.
									// Reachable: an outer target that re-raises the inner call's marked original
									// (rather than the context wrapper around it) lands here with the marker set.
									if (!isHookProcessed(error)) {
										const sourceInfo = failureSource({ type: "function", at: wrapper.____clock.now() }, failure);
										hookManager.executeErrorHooks(___path, originalError, sourceInfo, args, api, ctx);
									}
									hookManager.executeAlwaysHooks(___path, args, undefined, true, [originalError], api, ctx);
									if (wrapper.____slothlet.config?.hook?.errors === "suppress") return undefined;
									throw error;
								}

								// After-chain: thenable transforms awaited, strict order preserved. Wrapped for the
								// same reason the before-chain is: a failing after hook must still reach `always`,
								// which the sync path guarantees from its `finally`. The after-chain runs its own
								// error hooks and honours suppressErrors, so reaching here means it really throws.
								let promotedFinal;
								try {
									const afterResult = await hookManager.executeAfterHooksAsync(___path, settled, args, api, ctx);
									promotedFinal = afterResult.modified ? afterResult.result : settled;
								} catch (error) {
									hookManager.executeAlwaysHooks(___path, args, undefined, true, [unwrapError(error)], api, ctx);
									throw error;
								}
								hookManager.executeAlwaysHooks(___path, args, promotedFinal, false, [], api, ctx);
								return promotedFinal;
							})();

							// A genuinely-async target's callers already hold a Promise contract — hand the
							// pipeline back plainly. A promoted SYNC target's callers contracted a value, so
							// the returned Promise is guarded: awaiting works, value-coercion throws named.
							return ___leafIsAsync ? ___promotedRun : guardPromotedResult(___promotedRun, ___path, wrapper.____SlothletError);
						}
					}

					// Declare variables outside try-catch-finally so they're accessible in all blocks
					let result;
					let finalResult;
					let isAsync = false; // Track if we're dealing with a promise
					// Per-invocation, deliberately NOT on the wrapper: assigning it there made `lastSyncError` an
					// own enumerable property, so the first throwing hooked call permanently added it to that
					// node's `Object.keys()` as if it were a module export. A local is also re-entrancy safe —
					// one shared field cannot name the error of two overlapping calls on the same wrapper.
					let lastSyncError = null;
					// Whether the synchronous part threw, kept apart from the value thrown: a throw of `undefined` is a throw.
					let syncThrew = false;
					// Before and after hooks report their own failures before rethrowing them. A thrown primitive cannot carry
					// the processed mark (see isHookProcessed), so whether a hook stage threw is tracked here as well.
					let hookReported = false;
					const reportedByHooks = (stage) => {
						try {
							return stage();
						} catch (error) {
							hookReported = true;
							throw error;
						}
					};

					try {
						// Execute before hooks synchronously
						if (hasHooks) {
							const beforeResult = reportedByHooks(() => hookManager.executeBeforeHooks(wrapperInternal.apiPath, args, api, ctx));
							args = beforeResult.args;

							// Check for short-circuit
							if (beforeResult.shortCircuit) {
								// Set finalResult so finally block can call always hooks with correct value
								finalResult = beforeResult.value;
								return beforeResult.value;
							}
						}

						// Materialize if needed (lazy mode)
						if (wrapperInternal.mode === "lazy" && !wrapperInternal.state.materialized && !wrapperInternal.state.inFlight) {
							// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
							/* v8 ignore next */
							PromiseMethods.catch(wrapper.___materialize(), () => {});
						}

						// Wait for materialization if in flight (returns Promise)
						if (wrapperInternal.mode === "lazy" && wrapperInternal.state.inFlight) {
							return new Promise((resolve, reject) => {
								const checkMaterialized = () => {
									if (wrapperInternal.state.materialized) {
										const impl = wrapperInternal.impl;
										try {
											if (typeof impl === "function") {
												if (wrapper.____slothlet.contextManager) {
													// rawErrors: a leaf's throw is application data — never re-typed (#252).
													resolve(
														wrapper.____slothlet.contextManager.runInContext(
															wrapper.____instanceID,
															impl,
															effectiveThisArg,
															args,
															wrapper,
															true,
															false,
															null,
															___entryIdentity,
															true
														)
													);
												} else {
													resolve(FunctionMethods.apply(impl, effectiveThisArg, args));
												}
											} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
												if (wrapper.contextManager) {
													// rawErrors: a leaf's throw is application data — never re-typed (#252).
													resolve(
														wrapper.contextManager.runInContext(
															wrapper.____instanceID,
															impl.default,
															impl,
															args,
															wrapper,
															true,
															false,
															null,
															___entryIdentity,
															true
														)
													);
												} else {
													resolve(FunctionMethods.apply(impl.default, impl, args));
												}
											} else {
												reject(
													new wrapper.____slothlet.SlothletError("API_PATH_NOT_CALLABLE", {
														path: segmentsOf(wrapperInternal.apiPath),
														received: typeof impl
													})
												);
											}
										} catch (err) {
											// Error from impl during post-materialization execution; same path covered
											// via non-deferred eager/already-materialized tests.
											/* v8 ignore next */
											reject(err);
										}
										return;
									}
									// This path fires only if materialization silently fails to set inFlight —
									// a defensive guard against corrupted internal state; unreachable in practice.
									/* v8 ignore start */
									if (!wrapperInternal.state.inFlight) {
										reject(
											new wrapper.____slothlet.SlothletError("LAZY_MATERIALIZATION_FAILED", {
												path: segmentsOf(wrapperInternal.apiPath)
											})
										);
										return;
										/* v8 ignore stop */
									}
									scheduleMacrotask(checkMaterialized, undefined, wrapper.____clock);
								};
								checkMaterialized();
							});
						}

						// Execute the actual function
						const impl = wrapperInternal.impl;

						if (typeof impl === "function") {
							if (wrapper.____slothlet.contextManager) {
								// rawErrors: a leaf's throw is application data — never re-typed (#252).
								result = wrapper.____slothlet.contextManager.runInContext(
									wrapper.____instanceID,
									impl,
									effectiveThisArg,
									args,
									wrapper,
									true,
									false,
									null,
									___entryIdentity,
									true
								);
							} else {
								result = FunctionMethods.apply(impl, effectiveThisArg, args);
							}
						} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
							if (wrapper.____slothlet.contextManager) {
								// rawErrors: a leaf's throw is application data — never re-typed (#252).
								result = wrapper.____slothlet.contextManager.runInContext(
									wrapper.____instanceID,
									impl.default,
									impl,
									args,
									wrapper,
									true,
									false,
									null,
									___entryIdentity,
									true
								);
							} else {
								result = FunctionMethods.apply(impl.default, impl, args);
							}
						} else {
							throw new wrapper.____SlothletError("API_PATH_NOT_CALLABLE", {
								path: segmentsOf(wrapperInternal.apiPath),
								received: typeof impl
							});
						}

						// Check if result is a Promise (async function). A promise of the engine's own is reacted to with the language's
						// `then`, as `await` reacts to it, so a `then` module code put on `Promise.prototype` never sees it.
						const enginePromise = isEnginePromise(result);
						if (enginePromise || (result && typeof result === "object" && typeof result.then === "function")) {
							// Mark as async so finally block skips always hooks (we handle them in the promise chain)
							isAsync = true;
							// With no hook to run and no error to suppress, a reaction would hand on what the call settles with as it is.
							// A promise the runtime made for the call already settles that way, with the `Promise` taken at load: it is
							// handed on as it is.
							if (
								enginePromise &&
								!hasHooks &&
								wrapper.____slothlet.config?.hook?.errors !== "suppress" &&
								wrapper.____slothlet.contextManager?.ownsResult?.(result)
							)
								return result;
							// Async result - attach hooks to Promise chain. A hand-written thenable is reacted to as `await`
							// would, so a reaction that throws never surfaces at its own `then`'s call site.
							// The reactions run as the call's caller, which the runtime resolved when the call was entered.
							return (
								enginePromise
									? FunctionMethods.bind(pinnedResultThen, null, result)
									: inherits(result, Promise)
										? FunctionMethods.bind(result.then, result)
										: FunctionMethods.bind(settleThenable, null, result)
							)(
								(resolvedResult) => {
									try {
										// Execute after hooks synchronously with resolved value
										if (hasHooks) {
											const afterResult = reportedByHooks(() =>
												hookManager.executeAfterHooks(wrapperInternal.apiPath, resolvedResult, args, api, ctx)
											);
											const finalResult = afterResult.modified ? afterResult.result : resolvedResult;
											hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, finalResult, false, [], api, ctx);
											return finalResult;
										}
										return resolvedResult;
									} catch (error) {
										// Error in after hook during async resolution
										// If hasHooks were false we would have returned before any hooks ran; the catch is only entered when hasHooks=true.
										/* v8 ignore next */
										if (hasHooks) {
											// A hook's failure, read from its record (see HookManager#failureOf), never in the caller's flow (#599).
											const originalError = unwrapError(error);
											const sourceInfo = failureSource({ type: "after", at: wrapper.____clock.now() }, hookManager.failureOf(error));
											// The after chain reports its own hook's failure; this reports only what it did not.
											if (!hookReported && !isHookProcessed(error)) {
												hookManager.executeErrorHooks(wrapperInternal.apiPath, originalError, sourceInfo, args, api, ctx);
											}
											hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, undefined, true, [originalError], api, ctx);
										}

										// Check if errors should be suppressed
										const suppressErrors = wrapper.____slothlet.config?.hook?.errors === "suppress";
										if (suppressErrors) {
											return undefined;
										}

										throw error;
									}
								},
								(error) => {
									// Async function error, classified as the target before anything reads it (#599)
									if (hasHooks) {
										const failure = wrapper.___readTargetFailure(error);
										const originalError = failure.originalError();
										if (!isHookProcessed(error)) {
											const sourceInfo = failureSource({ type: "function", at: wrapper.____clock.now() }, failure);
											hookManager.executeErrorHooks(wrapperInternal.apiPath, originalError, sourceInfo, args, api, ctx);
										}
										// Always hooks execute for rejected promises
										hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, undefined, true, [originalError], api, ctx);
									}

									// Check if errors should be suppressed
									const suppressErrors = wrapper.____slothlet.config?.hook?.errors === "suppress";
									if (suppressErrors) {
										return undefined;
									}

									throw error;
								}
							);
						}

						// Sync result - execute after hooks (can modify result)
						finalResult = result;
						if (hasHooks) {
							const afterResult = reportedByHooks(() => hookManager.executeAfterHooks(wrapperInternal.apiPath, result, args, api, ctx));
							if (afterResult.modified) {
								finalResult = afterResult.result;
							}
						}
						return finalResult;
					} catch (error) {
						// Synchronous error (from before hook or function)
						lastSyncError = error; // Flag for finally block
						syncThrew = true;
						// The target's failure, classified as the target before anything reads it (#599); the finally's
						// always hooks then take the unwrapped error from what was read.
						const targetFailure = hasHooks && !hookReported ? wrapper.___readTargetFailure(error) : null;
						if (targetFailure && !isHookProcessed(error)) {
							const sourceInfo = failureSource({ type: "function", at: wrapper.____clock.now() }, targetFailure);
							hookManager.executeErrorHooks(wrapperInternal.apiPath, targetFailure.originalError(), sourceInfo, args, api, ctx);
						}

						// Check if errors should be suppressed
						const suppressErrors = wrapper.____slothlet.config?.hook?.errors === "suppress";
						if (suppressErrors) {
							// Don't throw - return undefined after always hooks run
							return undefined;
						}

						throw error;
					} finally {
						// Always hooks execute once for synchronous code paths
						// (async paths handle always hooks in their promise chains)
						// Skip only if we're dealing with an async result (promise)
						if (hasHooks && !isAsync) {
							// Track error state with a flag set in catch block. Nothing to clear afterwards now
							// that it is per-invocation — the reset only existed because the flag used to be a
							// field shared by every call on the wrapper.
							const syncError = lastSyncError;
							// Use finalResult if available (successful sync call), undefined if error
							const resultValue = syncThrew ? undefined : typeof finalResult !== "undefined" ? finalResult : result;
							const errors = syncThrew ? [unwrapError(syncError)] : [];
							hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, resultValue, syncThrew, errors, api, ctx);
						}
					}
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {string|symbol} prop - Property name
				 * @returns {boolean} True if property exists
				 *
				 * @description
				 * Checks for properties on impl, target (wrapper), filtering internals.
				 */
				const hasTrap = (target, prop) => {
					// `in` gates nothing: an access a kept node offers here is dropped first, before any code the answer runs
					// (a Proxy among the impl's prototypes) could take it (#661).
					takeCapturedAccess(wrapper);
					followModuleObject(wrapper, target, prop);
					if (prop === "___materialize") {
						return true;
					}

					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
						/* v8 ignore next */
						PromiseMethods.catch(wrapper.___materialize(), () => {});
					}

					// An array-backed wrapper holds the elements it cached, but the array decides which indices
					// exist: an element removed since (through the api or the module's own reference) is gone (#602).
					const arrayImpl = wrapper.____slothletInternal.impl;
					if (Arrays.isArray(arrayImpl) && isArrayIndex(prop)) {
						// A non-extensible target pins the answer to its own keys (proxy invariant), which is the
						// array it was built over once a reload has replaced the impl.
						if (!Reflect.isExtensible(target)) return Reflect.has(target, prop);
						return prop in arrayImpl || isFixedOnTarget(target, prop);
					}

					// Check wrapper properties (children), filter internals
					const isInternal = isFrameworkReservedKey(prop);
					if (!isInternal && hasOwn(wrapper, prop)) {
						return true;
					}

					// The impl carries framework metadata that is not an api member; `ownKeys` withholds it, so
					// `has` must agree or `in` reports a property the surface will not enumerate or describe —
					// the trap-by-trap disagreement read gating exists to prevent. A module's own Proxy answers as that
					// module (#597).
					if (
						!isInternal &&
						wrapper.____slothletInternal.impl &&
						(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function") &&
						(onImpl(wrapper, (impl) => wrapper.___implHas(impl, prop)) || wrapper.___moduleInheritance(prop) !== null)
					) {
						return true;
					}

					return Objects.hasOwn(target, prop);
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {string|symbol} prop - Property name
				 * @returns {PropertyDescriptor|undefined} Descriptor for the property
				 *
				 * @description
				 * Provides descriptors for target (wrapper), impl properties, filtering internals.
				 */
				const getOwnPropertyDescriptorTrap = (target, prop, redact = true, access = null) => {
					// The engine's check of a definition a view just made reads the node's fixed members ungated (#625).
					const engineCheck = takeInvariantRead(wrapper, prop);
					// A node a module kept, describing a member through this one, says who it reads for: taken first, before
					// any code this description runs could take it, and handed to every gate it makes (#661).
					const kept = takeCapturedAccess(wrapper);
					if (!engineCheck) followModuleObject(wrapper, target, prop);
					// What this description reads through the node itself, read for that reader too.
					const readNode = () =>
						kept
							? wrapper.___accessAsKept(kept.reader, () => wrapper.____slothletInternal.proxy[prop])
							: wrapper.____slothletInternal.proxy[prop];
					// A view asking for this member as it is held (describeAsHeld): taken now, for this read only.
					const asHeld = rulesShared.describingAsHeld?.wrapper === wrapper && rulesShared.describingAsHeld.prop === prop;
					if (asHeld) rulesShared.describingAsHeld = null;
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
						/* v8 ignore next */
						PromiseMethods.catch(wrapper.___materialize(), () => {});
					}

					if (prop === "____slothletInternal") return undefined;

					// The hook that shows the node to `util.inspect` is described to a module as a function that completes what it
					// shows under that module's identity, so a copy it keeps and calls later, with no caller of its own, still reads as it.
					if (prop === util.inspect.custom) {
						const hookDescriptor = Reflect.getOwnPropertyDescriptor(target, prop);
						if (hookDescriptor && WeakSetMethods.has(INSPECT_HOOKS, hookDescriptor.value)) {
							const reader = capturedReader(wrapper);
							// A sealed node's hook is fixed on its shell, which the invariants require the node to report as is.
							if (!reader || !hookDescriptor.configurable) return hookDescriptor;
							const hook = hookDescriptor.value;
							return {
								__proto__: null,
								...hookDescriptor,
								value: function (...args) {
									// Shown as to a module, whoever calls the copy later: it never hands out the module's code (#632).
									const shown = Arrays.isArray(target) ? Reflect.apply(hook, this, args) : inspectShown(wrapper, args, true);
									if (shown === null || typeof shown !== "object") return shown;
									const completed = Arrays.isArray(shown) ? [] : {};
									for (let ofIndex = 0, ofList = Objects.keys(shown); ofIndex < ofList.length; ofIndex++) {
										const key = ofList[ofIndex];
										completed[key] = readAsReader(wrapper, key, shown[key], reader);
									}
									if (Arrays.isArray(shown)) completed.length = shown.length;
									return completed;
								}
							};
						}
					}

					// A module may freeze or seal its own array after the node was read; the node reports what the array is.
					syncArrayIntegrity(wrapper, target);
					// A sealed node holds its members on its shell (see preventExtensions). A writable member's value is not
					// pinned there, so it is described as the node reads it now, through the read gate.
					if (!Reflect.isExtensible(target)) {
						const sealed = Reflect.getOwnPropertyDescriptor(target, prop);
						if (sealed && "value" in sealed && sealed.writable && prop !== "length") {
							// A value the caller may not read is withheld, as the invariants allow for a writable member: the key
							// must still be described, and sealing or freezing the node needs only its attributes.
							if (redact && isReadRedacted(wrapper, prop, kept, access)) return { __proto__: null, ...sealed, value: undefined };
							// So is a member of the function's own holding the module's code, to a caller that may not call the node
							// (#825): an open node leaves it out of its description, which a sealed node may not.
							// A view mirroring the member asks for it as held: a writable member's value is not pinned, so it is withheld
							// there too.
							if (redact && !hasOwn(wrapper, prop) && functionOf(wrapper.____slothletInternal.impl) !== null) {
								const implDescriptor = onImpl(wrapper, (impl) => (prop in impl ? Objects.getOwnPropertyDescriptor(impl, prop) : null));
								if (implDescriptor !== null && isCodeMemberWithheld(wrapper, implDescriptor, kept))
									return { __proto__: null, ...sealed, value: undefined };
							}
							return { __proto__: null, ...sealed, value: readNode() };
						}
						if (sealed && prop === "length" && Arrays.isArray(wrapper.____slothletInternal.impl) && sealed.writable) {
							return { __proto__: null, ...sealed, value: wrapper.____slothletInternal.impl.length };
						}
						return engineCheck ? sealed : fixedDescriptor(wrapper, prop, sealed, asHeld, kept);
					}

					// An array-backed wrapper describes its array as it is now (#602): an index it no longer holds
					// is absent even when an element wrapper is still cached for it, and `length` is the array's.
					// The proxy target is the array the wrapper was built over, which a reload replaces, so its own
					// fixed keys keep their invariant-required form, carrying the current value where writable.
					const arrayImpl = wrapper.____slothletInternal.impl;
					// Every member is described this way, a named or symbol-keyed one as much as an element (#603 review).
					if (Arrays.isArray(arrayImpl) && (prop === "length" || isArrayMember(arrayImpl, prop))) {
						// An element a caller may not read is not described to it, as ownKeys leaves it out (#609); one
						// fixed on the shell must still be described, with its value withheld.
						const withheld = redact && prop !== "length" && isReadRedacted(wrapper, prop, kept, access);
						const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
						// An object element is described by its api node, not the module's object: reading the node is the read
						// the permission rules see, where the raw object would hand every leaf under it to any caller.
						const readThroughNode = (value) =>
							value !== null && (typeof value === "object" || typeof value === "function") ? readNode() : value;
						if (fixed && !fixed.configurable) {
							if (!fixed.writable) return engineCheck ? fixed : fixedDescriptor(wrapper, prop, fixed, asHeld, kept);
							return { __proto__: null, ...fixed, value: withheld ? undefined : readThroughNode(arrayImpl[prop]) };
						}
						if (withheld) return undefined;
						const current = Reflect.getOwnPropertyDescriptor(arrayImpl, prop);
						if (current && "value" in current) current.value = readThroughNode(current.value);
						// An accessor element is described by accessors that go through the node, not the array's own
						// getter and setter, which would run for any caller without the read gate.
						if (current && !("value" in current)) {
							const node = wrapper.____slothletInternal.proxy;
							// The reader's identity travels with the getter: called later with no caller of its own, it still reads as that module.
							const reader = capturedReader(wrapper);
							return {
								__proto__: null,
								get: () => readAsReader(wrapper, prop, node[prop], reader),
								set: (value) => {
									node[prop] = value;
								},
								enumerable: current.enumerable,
								configurable: true
							};
						}
						return current && !current.configurable ? { __proto__: null, ...current, configurable: true } : current;
					}

					// Keep this trap consistent with ownKeys: a key withheld there must not be describable
					// here either, or `Object.keys()` and `Object.entries()` would disagree. Non-configurable
					// own keys of the target are exempt (proxy invariant) — see ownKeysTrap.
					let ownDesc = Objects.getOwnPropertyDescriptor(target, prop);
					// A lazy folder that loaded as a namespace has no `length` or `name` of a function, as the eager node has none:
					// its function target's own only stood in while it loaded.
					if (ownDesc?.configurable && (prop === "length" || prop === "name") && wrapper.___loadedAsNamespace()) ownDesc = undefined;
					if (redact && (!ownDesc || ownDesc.configurable) && isReadRedacted(wrapper, prop, kept, access)) {
						return undefined;
					}

					// The function target's own `name` / `length` are configurable, so a member by that name
					// (`tool/name/`) is described as the member, as the get trap reads it (#571).
					if (ownDesc && !(ownDesc.configurable && hasOwnMember(wrapper, prop))) {
						// The function's own `length` is described as a read answers it, from the function (the target is a stand-in
						// whose own `length` is not the function's); it is configurable on the target, so the invariants allow it.
						const fn = functionOf(wrapper.____slothletInternal.impl);
						if (prop === "length" && fn !== null && ownDesc.configurable && isBuiltinFunctionMember(wrapper, prop)) {
							return { __proto__: null, ...ownDesc, value: fn.length };
						}
						// The function's own `prototype` is described as a read answers it: the prototype's handle (#667). The target's
						// own is writable, so the invariants allow reporting another value.
						if (prop === "prototype" && fn !== null && "value" in ownDesc && ownDesc.writable && hasOwn(fn, "prototype")) {
							const prototype = fn.prototype;
							if (prototype !== null && typeof prototype === "object" && !isCodeMemberWithheld(wrapper, { value: prototype }, kept))
								return {
									__proto__: null,
									...ownDesc,
									value: prototypeForReader(wrapper, wrapper.___exposePrototype(prototype), "prototype")
								};
						}
						return ownDesc;
					}

					// #446 (general form of #443): the branches below surface a property from the wrapper or the
					// impl — a property the proxy TARGET may not physically carry, because a callable wrapper's
					// target is a fresh stub function, so a routine callable's `for`/`contributors`, or any value
					// assigned through wrap-on-set that carries a non-configurable own property, lives only on the
					// impl. Both branches are reached only AFTER the `hasOwnProperty.call(target, prop)` check
					// above returned false, so the target provably does not own `prop`. The ES Proxy invariant
					// forbids getOwnPropertyDescriptor from reporting a property as non-configurable unless the
					// target owns it as a non-configurable property — otherwise the engine throws "trap reported
					// non-configurability ... which is either non-existent or configurable in the proxy target".
					// Report such a virtualized descriptor as configurable (the only invariant-legal shape);
					// undefined and already-configurable descriptors pass through unchanged.
					const virtualizeDescriptor = (desc) => (desc && !desc.configurable ? { __proto__: null, ...desc, configurable: true } : desc);

					// Check wrapper properties (children), filter internals
					const isInternal = isFrameworkReservedKey(prop);
					if (!isInternal && hasOwn(wrapper, prop)) {
						const desc = Objects.getOwnPropertyDescriptor(wrapper, prop);
						// hasOwn() guarantees a descriptor exists; the null guard's false branch is dead code.
						// Return descriptor if it exists
						/* v8 ignore next */
						if (desc) {
							// The node keeps a member read-only on its own store, which only its traps write. What it reports is
							// whether a write through the node is taken, as the module's object reports it (#749).
							const described = virtualizeDescriptor(desc);
							if (!("value" in described)) return described;
							// A primitive member is held as a node of its own; its description holds the primitive, as a read of
							// the member answers it.
							const heldNode = resolveWrapper(described.value);
							return {
								__proto__: null,
								...described,
								value: heldNode && heldNode.___holdsValue() ? heldNode.___heldValue() : described.value,
								writable: reportsWritable(wrapper, prop)
							};
						}
					}

					// Same reserved-name filter the impl branch of `has` applies: a key `ownKeys` withholds and
					// `in` denies must not be describable here either, or `Object.keys()` and
					// `getOwnPropertyDescriptor()` report different surfaces for the same object.
					// A module's own Proxy answers as that module, and an accessor the node did not adopt is described by
					// adopted halves, so a getter or setter taken from the description runs as the module too (#597).
					if (
						!isInternal &&
						wrapper.____slothletInternal.impl &&
						(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function")
					) {
						const implDescriptor = onImpl(wrapper, (impl) => (prop in impl ? Objects.getOwnPropertyDescriptor(impl, prop) : null));
						// A member holding the module's code is described only to a caller that may call the node, as reading it
						// is checked (#632).
						if (implDescriptor !== null && redact && !asHeld && isCodeMemberWithheld(wrapper, implDescriptor, kept)) return undefined;
						// A function's own `prototype` is described as a read answers it: the prototype's handle (#667).
						if (
							implDescriptor !== null &&
							prop === "prototype" &&
							"value" in implDescriptor &&
							implDescriptor.value !== null &&
							typeof implDescriptor.value === "object" &&
							functionOf(wrapper.____slothletInternal.impl) !== null
						) {
							const value = prototypeForReader(wrapper, wrapper.___exposePrototype(implDescriptor.value), "prototype");
							return virtualizeDescriptor({ __proto__: null, ...implDescriptor, value });
						}
						// A member that is the node's own function, or an ancestor's, is described holding that node, as reading it gives.
						const cycle = implDescriptor && "value" in implDescriptor ? nodeInCycle(wrapper, implDescriptor.value) : null;
						if (cycle !== null) return virtualizeDescriptor({ __proto__: null, ...implDescriptor, value: cycle.___createProxy() });
						if (implDescriptor !== null) return virtualizeDescriptor(describeImplMember(wrapper, implDescriptor));
					}

					return undefined;
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {boolean} [redact=true] - Withhold the keys the calling module may not read.
				 * @returns {Array<string|symbol>} Property keys
				 *
				 * @description
				 * Returns property keys from target (wrapper), impl, filtering internals.
				 */
				const ownKeysTrap = (target, redact = true) => {
					// A node a module kept, listing this one's members, says who it reads for: taken first, and handed to every
					// gate the listing makes (#661).
					const kept = takeCapturedAccess(wrapper);
					followModuleObject(wrapper, target);
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
						/* v8 ignore next */
						PromiseMethods.catch(wrapper.___materialize(), () => {});
					}

					// A sealed node holds its members on its shell (see preventExtensions), and a non-extensible target
					// must be listed exactly (proxy invariant).
					if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);

					const keys = new Set();

					// An array-backed wrapper lists its array as it is now, in the array's own order (#602): not
					// the indices of the array it was built over (a reload replaces the impl) nor the element
					// wrappers it cached. The target's fixed keys are still reported, as the invariants require,
					// and so is a non-index member held on the wrapper (a mount under the array).
					const arrayImpl = wrapper.____slothletInternal.impl;
					if (Arrays.isArray(arrayImpl)) {
						// A non-extensible target must be listed exactly (proxy invariant).
						if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);
						for (let ofIndex = 0, ofList = Reflect.ownKeys(arrayImpl); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							SetMethods.add(keys, key);
						}
						for (let ofIndex = 0, ofList = Reflect.ownKeys(target); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							if (isFixedOnTarget(target, key)) SetMethods.add(keys, key);
						}
						for (let ofIndex = 0, ofList = Reflect.ownKeys(wrapper); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							if (!isArrayIndex(key) && Objects.getOwnPropertyDescriptor(wrapper, key)?.enumerable) SetMethods.add(keys, key);
						}
						for (const key of setValues(keys)) {
							if (!isFixedOnTarget(target, key) && isReadRedacted(wrapper, key, kept)) SetMethods.delete(keys, key);
						}
						return setToArray(keys);
					}

					// A function target's own `length` / `name` come first, as on any function. A lazy folder that loaded as a
					// namespace lists none, as the eager node does: its function target only stood in while it loaded.
					const uw_listsAsFunction = typeof target === "function" && !wrapper.___loadedAsNamespace();
					if (uw_listsAsFunction) {
						SetMethods.add(keys, "length");
						SetMethods.add(keys, "name");
					}

					// Add all target keys (wrapper or function), checking configurability
					for (let ofIndex = 0, ofList = Reflect.ownKeys(target); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						const descriptor = Objects.getOwnPropertyDescriptor(target, key);
						// Include non-configurable properties (required by proxy invariants)
						// OR enumerable properties (child wrappers)
						if (!descriptor.configurable || descriptor.enumerable) {
							SetMethods.add(keys, key);
						}
					}

					// CRITICAL: When proxy target is a callable function (not the wrapper itself),
					// children are defined on wrapper, not target. Include wrapper's enumerable keys.
					if (target !== wrapper) {
						for (let ofIndex = 0, ofList = Reflect.ownKeys(wrapper); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							const descriptor = Objects.getOwnPropertyDescriptor(wrapper, key);
							// Wrapper-owned sibling props are always enumerable in tests; non-enumerable path never taken.
							/* v8 ignore next */
							if (descriptor && descriptor.enumerable) {
								SetMethods.add(keys, key);
							}
						}
					}

					// Add impl keys
					const implKeys =
						wrapper.____slothletInternal.impl &&
						(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function")
							? onImpl(wrapper, (impl) => Reflect.ownKeys(impl))
							: [];
					// Framework metadata keys ride on a lazy impl (they survive adoption's metadataKeys skip)
					// but are not api members — leaking them made lazy enumeration differ from eager for the
					// same module. Filtered by exact name, never by prefix, so a user module exporting an
					// underscore-prefixed member keeps it enumerable in both modes.
					for (let ofIndex = 0, ofList = implKeys; ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						// A function impl's own `prototype` is listed as on the function itself; the bound-function
						// proxy target has none whose invariants it could break (see createNamedProxyTarget).
						if (!SetMethods.has(reservedKeysOwn.IMPL_METADATA_KEYS, key)) {
							SetMethods.add(keys, key);
						}
					}

					// Withhold keys whose terminal value this caller may not read, so enumeration cannot
					// disclose the shape of a namespace the caller has no access to. Non-configurable own
					// keys of the target must still be reported (proxy invariant), so they are never
					// filtered — they are framework internals, never gated user data.
					if (redact) {
						for (const key of setValues(keys)) {
							const targetDesc = Objects.getOwnPropertyDescriptor(target, key);
							if (targetDesc && !targetDesc.configurable) continue;
							if (isReadRedacted(wrapper, key, kept, null, true)) SetMethods.delete(keys, key);
						}
					}

					// A function lists its `prototype` right after `length` and `name`, before the members added to
					// it, as `Reflect.ownKeys(function f() {})` does; the members are gathered from the target, the
					// wrapper and the impl, so it is put back in its place once every key is known.
					if (uw_listsAsFunction && SetMethods.has(keys, "prototype")) {
						const uw_ordered = [];
						for (let ofIndex = 0, ofList = ["length", "name", "prototype"]; ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							if (SetMethods.has(keys, key)) listPush(uw_ordered, key);
						}
						for (const key of setValues(keys)) if (key !== "length" && key !== "name" && key !== "prototype") listPush(uw_ordered, key);
						return uw_ordered;
					}
					return setToArray(keys);
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {string|symbol} prop - Property name
				 * @param {unknown} value - Value to assign
				 * @returns {boolean} True when set succeeds
				 *
				 * @description
				 * Allows attaching properties directly to callable proxies.
				 */
				const setTrap = (target, prop, value) => {
					// A view `self` handed out stands for its node: the node is what is stored (#625).
					value = unwrapSelfView(value);
					// A value another module or the host writes onto the node is theirs, handed to this one (#597).
					markWritten(wrapper, value);
					// An object written after the api was built is data (#826).
					wrapper.___markAssignedData(value);
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						wrapper.___materialize();
					}
					// A node of a run's tree changes values the instance's tree shares: what it writes stays on the node itself.
					const runTreeNode = inRunTree(wrapper);
					if (runTreeNode) ownRunTreeArray(wrapper);
					// Keys that must not be settable from outside — every name with the framework's prefix, which would shadow
					// the wrapper's own members and state, or read-only informational accessors whose values come from
					// ____slothletInternal. Silently absorb the write so no TypeError leaks key existence.
					// ___materialize is exempted: the framework writes it directly on the target.
					// Module code meets the write rules first, so an assignment is refused as a definition is (#625).
					if (
						(SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, prop) ||
							(isFrameworkName(prop) &&
								!SetMethods.has(reservedKeysOwn.IMPL_METADATA_KEYS, prop) &&
								!(isFrameworkMarkerKey(prop) && isFrameworkInternal(wrapper)))) &&
						prop !== "___materialize"
					) {
						assertOwnedWrite(wrapper, prop);
						return true;
					}
					// `node.__proto__ = x` on a node fronting a module's own object runs the language's own `__proto__` setter, as
					// the same assignment to the object does (#757): an object or null sets the prototype, through the setPrototypeOf
					// trap and its checks, anything else is ignored. A `__proto__` member the object holds is written as a member.
					if (prop === "__proto__" && !hasOwn(wrapper, prop) && moduleObjectOf(wrapper) !== null) {
						Reflect.apply(OBJECT_PROTO_SETTER, wrapper.____slothletInternal.proxy, [value]);
						return true;
					}
					// A sealed callable node takes no new member, as a sealed function does not: its members were
					// fixed on the shell when it was sealed, and reflection answers from there.
					if (!Reflect.isExtensible(target) && !hasOwn(target, prop)) return false;
					// A member fixed read-only on a frozen shell takes no write, as on a frozen object: refused before the node's
					// own state changes, so a read of it still answers what the shell holds (#667).
					if (!Arrays.isArray(target) && isFixedReadOnly(target, prop)) return false;
					// A callable `then` would make the node awaitable (#571), so assigning one is refused; a `then`
					// holding data is an ordinary member and reads back.
					if (prop === "then" && isAwaitableThen({ value })) {
						throw new wrapper.____SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
					}
					// A module writes only under the subtree it owns, below the top level of `self` as at it (#625). A
					// framework-reserved key is the framework's own state: the built-in write rules keep modules off it.
					assertOwnedWrite(wrapper, prop);

					// An array-backed wrapper fronts its array: a write (an index, `length`, or what `push`/`splice`
					// do through it) lands on the array, exactly as it would on the array (#602). That is the
					// current impl, which an eager reload replaces under a held reference, not the proxy target.
					// A cached element wrapper at that index is dropped, so the next read resolves the new value.
					if (Arrays.isArray(wrapper.____slothletInternal.impl)) {
						const arrayImpl = wrapper.____slothletInternal.impl;
						// A non-extensible array takes no new index, as on the array itself; reflection answers from
						// the target then (see ownKeysTrap), so a write may not grow what it cannot report.
						if (!Reflect.isExtensible(target) && !Reflect.has(target, prop)) return false;
						// A fixed key of the target that takes no write (a frozen array's index or `length`) refuses
						// it before the array is touched: the proxy may not report a write its target cannot hold.
						if (isFixedReadOnly(target, prop)) return false;
						// A position at or past a read-only `length` takes no write, as on the array: the shell pins the length.
						if (isPastFixedLength(target, prop)) return false;
						// An array method moving an element (`shift`, `splice`, `reverse`, `sort`) reads it through this
						// proxy and gets its element wrapper back; the array keeps holding the element itself.
						// An element taken out of the array (`shift`, `pop`) reports the array's own path, so it counts too.
						const moved = resolveWrapper(value);
						const arrayPath = wrapper.____slothletInternal.apiPath;
						const movedPath = moved?.____slothletInternal.apiPath;
						const isOwnElement =
							moved !== null &&
							(movedPath === arrayPath || (movedPath == null ? undefined : StringMethods.startsWith(movedPath, `${arrayPath}.`))) &&
							"sourceValue" in moved.____slothletInternal;
						// A full-isolation run's `self` writing the array (see runWrite): every check above has passed, and the
						// write goes to the run's own copy of the array instead of the module's.
						const runSink = takeRunWrite(wrapper, prop);
						if (runSink !== null) return runSink({ op: "set", value });
						const written = Reflect.set(arrayImpl, prop, isOwnElement ? moved.____slothletInternal.sourceValue : value);
						// A sealed member reports its elements from its shell (see the preventExtensions trap): a new
						// `length` takes the shell's configurable elements past it away, as it did the array's. A length
						// write the array refuses can still have removed the elements above a fixed one, so the shell
						// follows what the array holds either way (#603 review).
						if (prop === "length" && Arrays.isArray(target) && !Reflect.isExtensible(target))
							Reflect.set(target, "length", arrayImpl.length);
						if (!written) return false;
						if (hasOwn(wrapper, prop)) delete wrapper[prop];
						// An element moved by an array method keeps its node at the index it lands on: the node holds what was
						// written through it, which a fresh node over the module's element would not (#603 review).
						if (isOwnElement && isPosition(prop)) {
							Objects.defineProperty(wrapper, prop, {
								__proto__: null,
								value: moved.____slothletInternal.proxy,
								writable: false,
								enumerable: true,
								configurable: true
							});
						}
						return true;
					}

					const internalKeys = setFrom(["___materialize"]);
					// An array node reads and lists its members through its array target. A member beside the elements
					// (a sibling file of a self-named array) is held by the array's composition layer, where those reads
					// find it; the module's own array is never written to (#585 review).
					const uw_arrayImpl = wrapper.____slothletInternal.impl;
					// An element or `length` is the array's own: written to it (through its layer, which passes it on),
					// as a write to the array would be, so its length and elements follow (#585 review).
					if (
						Arrays.isArray(uw_arrayImpl) &&
						(prop === "length" || (typeof prop === "string" && RegExpMethods.exec(/^(?:0|[1-9]\d*)$/, prop) !== null))
					) {
						return Reflect.set(uw_arrayImpl, prop, value);
					}
					if (
						!SetMethods.has(internalKeys, prop) &&
						Arrays.isArray(uw_arrayImpl) &&
						isCompositionLayer(uw_arrayImpl) &&
						!(typeof prop === "string" && RegExpMethods.exec(/^(?:0|[1-9]\d*)$/, prop) !== null)
					) {
						holdMember(uw_arrayImpl, prop, value);
						return true;
					}
					if (!SetMethods.has(internalKeys, prop)) {
						// An accessor the node holds answers a write as it would on an object: its setter runs, and an
						// accessor with no setter refuses the write (#585 review). The node's accessors are the module's
						// (adopted, or merged in from an addapi file or a collision) or a live forward to the impl, and
						// every one of them sets through its own setter.
						const ownAccessor = Objects.getOwnPropertyDescriptor(wrapper, prop);
						// A forward a node of a run's tree keeps to its live value would write the module's value: the node holds
						// the write itself instead. A module's own accessor runs its setter on the node, as anywhere.
						const forwardsToShared =
							runTreeNode &&
							ownAccessor !== undefined &&
							!("value" in ownAccessor) &&
							originalAccessor(ownAccessor).set === ownAccessor.set &&
							originalAccessor(ownAccessor).get === ownAccessor.get;
						if (ownAccessor && !("value" in ownAccessor) && !forwardsToShared) {
							if (!ownAccessor.set) return false;
							FunctionMethods.call(ownAccessor.set, wrapper.____slothletInternal.proxy ?? wrapper, value);
							return true;
						}
						// A full-isolation run's `self` writing a node of the tree the run reads but does not own yet (see
						// runWrite): every check above has passed, so the write is stored as the node would store it, in
						// the run's own record instead of on the node. A member the node reports read-only, or a new key the
						// module's object cannot take, refuses it as it would here.
						const runSink = takeRunWrite(wrapper, prop);
						if (runSink !== null) {
							if (!reportsWritable(wrapper, prop)) return false;
							const runModuleObject = moduleObjectOf(wrapper, prop);
							if (runModuleObject !== null && !hasOwn(runModuleObject, prop) && !Reflect.isExtensible(runModuleObject)) return false;
							return runSink({ op: "set", value: wrapper.___wrapOnSet(prop, value) });
						}
						const isObjectOrFunctionValue = value !== null && (typeof value === "object" || typeof value === "function");

						// Primitive (or null) write against a LIVE-IDENTITY wrapper's live impl object
						// (#340): land the write on `impl` itself — the same target primitive reads already
						// resolve from — and (re)define a live forwarding accessor at this key instead of a
						// frozen static snapshot, so the property stays two-way live with `impl` exactly like
						// the eager-adoption accessor `___adoptImplChildren` defines. An existing accessor's
						// own setter already does this — invoking it here rather than deleting+redefining
						// avoids stomping it with a static value.
						//
						// Scoped to a live-identity wrapper (`deferChildAdopt`, or an EventEmitter-derived
						// impl) — mirrors ___adoptImplChildren's own analogous accessor, which is scoped the
						// same way for the same reason. An ORDINARY wrapper's impl remains a real object
						// reference after adoption (adoption only deletes the specific keys it moved onto the
						// wrapper), so without this scoping a plain `api.ns.newProp = 1` on an unrelated
						// namespace would silently forward into and mutate that namespace's internal impl
						// object instead of storing on the wrapper like the rest of this trap does — and the
						// new property would never be visible to api.leaves()'s ownership tracking, which only
						// walks impl at adoption time. When there is no live impl to forward to, or the
						// wrapper isn't a live-identity one (e.g. the root api tree, an ordinary namespace, or
						// a wrapper not yet materialized), fall through unchanged to the original static-value
						// behavior below.
						if (!isObjectOrFunctionValue) {
							const liveImpl = wrapper.____slothletInternal.impl;
							// A class instance is live too (#589, #590): adoption leaves it whole, and its methods and getters
							// read its fields through `this`, so a write through the node lands on the instance, as a write
							// to the instance itself does.
							const isLiveIdentityWrapper =
								wrapper.____slothletInternal.deferChildAdopt ||
								(EventEmitter && inherits(liveImpl, EventEmitter)) ||
								isClassInstance(liveImpl);
							const hasLiveImpl =
								!runTreeNode &&
								isLiveIdentityWrapper &&
								liveImpl !== null &&
								liveImpl !== undefined &&
								(typeof liveImpl === "object" || typeof liveImpl === "function");
							if (hasLiveImpl) {
								// Reflect.set's boolean result matters: a non-writable/sealed impl fails the
								// write silently (no throw) and must not be reported as a successful assignment
								// — that would suppress the strict-mode TypeError a real object write would raise.
								// A setter the impl holds runs as the module the node belongs to, never as the writer (#597).
								const setSucceeded = wrapper.___writeImplMember(prop, value);
								if (!setSucceeded) return false;
								const existingDescriptor = Objects.getOwnPropertyDescriptor(wrapper, prop);
								if (!existingDescriptor || typeof existingDescriptor.set !== "function") {
									Objects.defineProperty(wrapper, prop, {
										__proto__: null,
										get: () => {
											const currentImpl = wrapper.____slothletInternal.impl;
											return currentImpl ? wrapper.___readImplMember(prop) : undefined;
										},
										set: (newValue) => {
											const currentImpl = wrapper.____slothletInternal.impl;
											if (currentImpl) wrapper.___writeImplMember(prop, newValue);
										},
										enumerable: true,
										configurable: true
									});
								}
								return true;
							}
						} else if (
							!runTreeNode &&
							(wrapper.____slothletInternal.deferChildAdopt ||
								(isClassInstance(wrapper.____slothletInternal.impl) &&
									!(EventEmitter && inherits(wrapper.____slothletInternal.impl, EventEmitter))))
						) {
							// Object/function write against a wrap-on-set LIVE VIEW (#495): land it on the live
							// impl exactly like the primitive branch above, rather than wrap-on-set onto the
							// wrapper. getTrap then serves it back lazily wrapped FROM impl, so the underlying
							// object sees the write and the view never shadows a later raw update of the key.
							// Any own property cached at this key (a child wrapper from an earlier read) is
							// dropped so the next read re-resolves from impl. A class-instance impl is live the same way
							// (#589, #590): its methods read the field the write sets. An EventEmitter-derived module
							// export is not, and its object writes stay userAssigned wrapper overrides that survive
							// reload (O15).
							const liveImpl = wrapper.____slothletInternal.impl;
							if (liveImpl !== null && (typeof liveImpl === "object" || typeof liveImpl === "function")) {
								if (!wrapper.___writeImplMember(prop, value)) return false;
								if (hasOwn(wrapper, prop)) delete wrapper[prop];
								return true;
							}
						}

						// A node built from a copy of a module's own object (an exported plain object, or one inside it) writes to
						// that object too, as the same assignment to the object does, so the module's code reads what was written
						// (#746). The object refusing the write (a member it holds read-only) refuses it here, before the node
						// changes. The framework's own writes (the build, a sibling file merged onto the node) change only the node:
						// composing never changes a module's value.
						const ownWrite = wrapper.____slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper);
						const moduleObject = ownWrite || runTreeNode ? null : moduleObjectOf(wrapper, prop);
						if (moduleObject !== null && !writeModuleObject(wrapper, moduleObject, prop, value)) return false;
						// A member defined read-only through the node takes no assignment, as on an object (#749).
						if (
							!ownWrite &&
							(wrapper.____slothletInternal.readOnlyKeys ? SetMethods.has(wrapper.____slothletInternal.readOnlyKeys, prop) : false) &&
							hasOwn(wrapper, prop)
						)
							return false;

						// A member the node already holds is replaced where it stands (the definition below), so it keeps its
						// place among the node's keys, as an assignment to an object's member does (#746).
						// Wrap-on-set: give an assigned function OR object the SAME context-preserving wrapper
						// construction api.add()/child-adoption uses, so its methods get working self/context AND
						// its nested terminal values are permission read-gated exactly like a build-mounted leaf
						// object — the docs' `self.X = …` promise (#329). Data objects are wrapped too: a raw
						// object bypasses read-gating (the parent's get trap only gates its own terminal props),
						// so wrapping is required for permission parity with build-mounted data.
						//
						// This trap is shared with the framework's own build (modes-processor scaffolds namespace
						// containers via `api[categoryName] = {}`), so wrap-on-set applies ONLY to genuine user
						// assignments made OUTSIDE a build: during a build (____buildDepth > 0) the value is stored
						// raw, exactly as before, so scaffolding is untouched. A user assignment is additionally
						// tagged `userAssigned` so a later selective reload preserves it verbatim instead of merging
						// the reloaded module's content into it. Skipped either way: primitives; opaque built-ins
						// (___createChildWrapper returns null); native proxies and existing wrappers (never iterate
						// a version dispatcher's traps — mirrors ___adoptImplChildren's proxy skip).
						const inBuild = wrapper.____slothlet.____buildDepth > 0;
						const stored = inBuild ? value : wrapper.___wrapOnSet(prop, value);
						Objects.defineProperty(wrapper, prop, {
							__proto__: null,
							value: stored,
							writable: false,
							enumerable: true,
							configurable: true
						});
						if (runTreeNode) markRunTreeHeld(wrapper, prop);
						// Remember a genuine user assignment by key, so adopting a (re)materialized impl never mistakes
						// it for a stale module child and clears it (#543). Build-time scaffolding is not recorded.
						if (!inBuild) {
							if (!wrapper.____slothletInternal.userAssignedKeys) wrapper.____slothletInternal.userAssignedKeys = new Set();
							SetMethods.add(wrapper.____slothletInternal.userAssignedKeys, prop);
						}
					} else {
						// For internal properties, just assign directly: on the wrapper for a namespace node, whose target
						// is a shell (#609), and on the function target of a callable one.
						(typeof target === "function" ? target : wrapper)[prop] = value;
					}
					return true;
				};

				/**
				 * @private
				 * @param {Object} target - Proxy target (wrapper)
				 * @param {string|symbol} prop - Property name to delete
				 * @returns {boolean} True when deletion succeeds
				 *
				 * @description
				 * Handles property deletion from wrapper proxies, removing from wrapper and impl.
				 */
				/**
				 * @private
				 * @param {Object} target - Proxy target
				 * @param {string|symbol} prop - Property name
				 * @param {PropertyDescriptor} descriptor - Descriptor to define
				 * @returns {boolean} Whether the property was defined
				 *
				 * @description
				 * An array-backed wrapper defines on its current array, as `set` writes there (#602): the proxy
				 * target is the array the wrapper was built over, which an eager reload replaces under a held
				 * reference. What the proxy invariants tie to the target (a non-extensible target, a key fixed on
				 * it, a non-configurable definition) is defined on the target too; the definition is checked
				 * against both first, so one refusing it leaves both unchanged. Any other wrapper defines on its
				 * target.
				 */
				const definePropertyTrap = (target, prop, descriptor) => {
					const arrayImpl = wrapper.____slothletInternal.impl;
					if (!Arrays.isArray(arrayImpl) || arrayImpl === target) {
						if (!Reflect.defineProperty(target, prop, descriptor)) return false;
						if (Arrays.isArray(arrayImpl) && hasOwn(wrapper, prop)) delete wrapper[prop];
						return true;
					}
					// A key of the module's own array is defined on that array; a composed node's other members (a sibling file,
					// a named export) live on its composition layer, which holds them.
					const underlying = layerUnderlying(arrayImpl);
					// A `length` the layer holds (a named export that won the slot) is the layer's, as the get trap reads it.
					const layerHoldsLength =
						prop === "length" && isCompositionLayer(arrayImpl) && ArrayMethods.includes(layerHeldKeys(arrayImpl), "length");
					const holder =
						!layerHoldsLength && (isArrayIndex(prop) || prop === "length" || hasOwn(underlying, prop)) ? underlying : arrayImpl;
					const bindsTarget = definitionBindsTarget(target, holder, prop, descriptor);
					// Both are checked before either changes, so a refusal by one leaves the other as it was.
					if ((bindsTarget && !canDefine(target, prop, descriptor)) || !canDefine(holder, prop, descriptor)) return false;
					if (!Reflect.defineProperty(holder, prop, descriptor)) return false;
					// The shell takes the member as the array now holds it, value included: a definition that leaves
					// out the value (`{ writable: false }` on `length`) would otherwise fix the shell's own.
					if (bindsTarget) Reflect.defineProperty(target, prop, Reflect.getOwnPropertyDescriptor(holder, prop));
					if (hasOwn(wrapper, prop)) delete wrapper[prop];
					return true;
				};

				const deletePropertyTrap = (target, prop) => {
					// Don't materialize when deleting - just delete directly
					// If lazy wrapper hasn't materialized yet, that's fine - we're deleting it anyway
					// if (wrapper.mode === "lazy" && !wrapper.____slothletInternal.state.materialized && !wrapper.____slothletInternal.state.inFlight) {
					// 	wrapper.___materialize();
					// }

					// Don't allow deletion of internal or read-only properties.
					// Return true (silently absorb) rather than false to avoid leaking that these
					// keys exist via the TypeError thrown by returning falsish in strict mode.
					const internalKeys = setFrom([
						// Framework mutation APIs
						"____slothletInternal",
						"____impl",
						"___setImpl",
						"___resetLazy",
						"___materialize",
						"___invalidate",
						"___getState",
						"____state",
						// Read-only internal props
						"____materializeOnCreate",
						"____displayName",
						"____invalid"
					]);
					if (SetMethods.has(internalKeys, prop)) {
						// Module code meets the write rules first, so a deletion is refused as a definition is (#625).
						assertOwnedWrite(wrapper, prop);
						return true; // silently ignore - do not expose the key's existence via TypeError
					}
					// Removing a member is a write to its path: a module removes only under the subtree it owns (#625),
					// and never a framework-reserved key (the built-in write rules).
					assertOwnedWrite(wrapper, prop);
					// A full-isolation run's `self` removing a member of a node of the tree the run does not own yet (see
					// runWrite): the removal is kept in the run's own record, and the node keeps the member. A member the node
					// holds fixed refuses it first, as it refuses the removal itself.
					if (
						runShared.RUN_WRITE !== null &&
						runShared.RUN_WRITE.node === wrapper &&
						runShared.RUN_WRITE.prop === prop &&
						holdsFixed(wrapper, target, prop)
					) {
						runShared.RUN_WRITE = null;
						return false;
					}
					const runSink = takeRunWrite(wrapper, prop);
					if (runSink !== null) return runSink({ op: "delete" });
					// A node of a run's tree changes its own copy of the array it fronts (see ownRunTreeArray).
					if (inRunTree(wrapper)) ownRunTreeArray(wrapper);

					// An array-backed wrapper's target is the array it was built over: a key fixed there (`length`, a
					// sealed array's index) stays, as it would on that array, and the current array is left as is. So
					// does any key a non-extensible target holds once a reload has put another array in its place: the
					// proxy may not report deleting what that target keeps.
					const arrayImpl = wrapper.____slothletInternal.impl;
					if (Arrays.isArray(arrayImpl) && isFixedOnTarget(target, prop)) return false;
					// A sealed array member holds its members on its shell (see preventExtensions): a configurable one is
					// deleted from both the shell and the module's array, as deleting it from the array itself would.
					if (Arrays.isArray(arrayImpl) && Arrays.isArray(target) && !Reflect.isExtensible(target) && hasOwn(target, prop)) {
						if (!Reflect.getOwnPropertyDescriptor(target, prop).configurable) return false;
						const holder = arrayKeyHolder(arrayImpl, prop);
						if (hasOwn(holder, prop) && !Reflect.deleteProperty(holder, prop)) return false;
						Reflect.deleteProperty(target, prop);
						if (hasOwn(wrapper, prop)) {
							// A named member's held node is retired, as it is on the ordinary path below; a position's is only
							// a cache of an element that may have moved (#602).
							if (!isPosition(prop)) resolveWrapper(Objects.getOwnPropertyDescriptor(wrapper, prop).value)?.___invalidate();
							delete wrapper[prop];
						}
						return true;
					}

					// If deleting a child wrapper, invalidate it
					const isInternal = isFrameworkReservedKey(prop);
					// A member held non-configurably cannot be deleted, as on the object itself, and nothing changes:
					// one defined so on the node (held on the wrapper, and on the target as the invariants require),
					// or one fixed on the target when the node was sealed.
					const heldDescriptor = isInternal ? undefined : Reflect.getOwnPropertyDescriptor(wrapper, prop);
					if ((heldDescriptor && !heldDescriptor.configurable) || (target !== wrapper && isFixedOnTarget(target, prop))) return false;
					// A key the backing object cannot delete (a non-configurable own property) fails before anything is
					// retired: its child wrapper stays live and the key stays assigned.
					const backing = wrapper.____slothletInternal.impl;
					if (
						!isInternal &&
						backing !== null &&
						typeof backing === "object" &&
						!util.types.isProxy(backing) &&
						Reflect.getOwnPropertyDescriptor(backing, prop)?.configurable === false
					) {
						return false;
					}
					// A node built from a copy of a module's own object deletes the member from that object too, as deleting it
					// from the object does (#746); a member the object holds non-configurably stays, and so does the node's.
					// The framework's own removals (a mount taken off the node) change only the node.
					const moduleObject =
						isInternal || MapMethods.has(FRAMEWORK_WRITES, wrapper) || inRunTree(wrapper) ? null : moduleObjectOf(wrapper, prop);
					if (moduleObject !== null && hasOwn(moduleObject, prop) && !Reflect.deleteProperty(moduleObject, prop)) return false;
					// Remove from ____impl if it's an object, before anything is retired: the backing value may refuse (its own
					// proxy, a frozen/sealed export #485), and the node then reports it the way the object itself would —
					// `false`, which a strict-mode `delete` turns into the same TypeError — with its child wrapper still live.
					// A composed array node's own elements are the module's array's: deleting them from its layer only hides them.
					// A function node's members are its function's (a layer over the module's function, which only hides them).
					// A node of a run's tree removes a member of the live value it fronts from itself alone: the value is the
					// module's, which the instance's tree fronts too (see runTreeHides).
					if (!isInternal && inRunTree(wrapper) && frontsLiveValue(wrapper) && hasOwn(backing, prop)) {
						SetMethods.add((wrapper.____slothletInternal.runHiddenKeys ??= new Set()), prop);
						if (wrapper.____slothletInternal.runHeldKeys) SetMethods.delete(wrapper.____slothletInternal.runHeldKeys, prop);
						if (hasOwn(wrapper, prop) && Objects.getOwnPropertyDescriptor(wrapper, prop).configurable) delete wrapper[prop];
						return true;
					}
					const deleteFrom = Arrays.isArray(backing) ? arrayKeyHolder(backing, prop) : backing;
					if (
						deleteFrom &&
						(typeof deleteFrom === "object" || typeof deleteFrom === "function") &&
						prop in deleteFrom &&
						!Reflect.deleteProperty(deleteFrom, prop)
					) {
						return false;
					}
					// A deleted key is no longer a user assignment to preserve across adoption (#543), nor one defined read-only.
					wrapper.____slothletInternal.userAssignedKeys == null
						? undefined
						: SetMethods.delete(wrapper.____slothletInternal.userAssignedKeys, prop);
					if (wrapper.____slothletInternal.readOnlyKeys) SetMethods.delete(wrapper.____slothletInternal.readOnlyKeys, prop);
					const isOwnMember = !isInternal && hasOwn(wrapper, prop);
					if (isOwnMember) {
						const childWrapper = wrapper[prop];
						const childWrapperRaw = resolveWrapper(childWrapper);
						// An array's element wrapper is only a cache of the element (#602): an array method deleting
						// an index (`pop`, `shift`, `splice`) may have moved that element to another index, so the
						// cache is dropped without invalidating the element's wrapper.
						if (childWrapperRaw && !(Arrays.isArray(wrapper.____slothletInternal.impl) && isPosition(prop))) {
							childWrapperRaw.___invalidate();
						}
						const descriptor = Objects.getOwnPropertyDescriptor(wrapper, prop);
						// Wrapper-owned props are always configurable; non-configurable descriptor branch is never reached.
						/* v8 ignore next */
						if (descriptor?.configurable) {
							delete wrapper[prop];
						}
					}

					// A function impl's own fixed property (a function's `prototype`, a class's `prototype`) cannot
					// be deleted from the function, so it cannot be deleted through the node either; the proxy
					// target no longer owns one to refuse it (see createNamedProxyTarget).
					if (!isOwnMember && typeof wrapper.____slothletInternal.impl === "function") {
						const implDescriptor = Reflect.getOwnPropertyDescriptor(wrapper.____slothletInternal.impl, prop);
						if (implDescriptor && !implDescriptor.configurable) return false;
					}

					// Remove from proxy target. An array-backed wrapper's target is the array it was built over; the
					// current array (deleted from above) is the one that counts, and a replaced one is left alone.
					if (!Arrays.isArray(wrapper.____slothletInternal.impl)) delete target[prop];

					return true;
				};

				/**
				 * @private
				 * @param {Function} target - Proxy target function
				 * @param {Array} args - Constructor arguments
				 * @param {Function} newTarget - The `new.target` value (the function `new` was applied to)
				 * @returns {Object} The constructed instance
				 *
				 * @description
				 * Handles `new proxy(args)` calls by delegating to the real impl constructor via
				 * Reflect.construct. Without this trap the engine falls back to constructing the
				 * empty stub proxyTarget function, producing a plain `{}` with no prototype chain
				 * and a silently skipped constructor body.
				 *
				 * The return value is the raw instance — not re-proxied — so that private class
				 * fields (stored on the real instance via internal WeakMaps) continue to work.
				 *
				 * @example
				 * // Slothlet module:  export class Foo { constructor(x) { this.x = x; } }
				 * const instance = new api.myModule.Foo(42);
				 * console.log(instance.x); // 42
				 */
				const constructTrap = (target, args, newTarget) => {
					// As applyTrap: a kept node's access, taken before any code this construction runs.
					const kept = takeCapturedAccess(wrapper);
					if (wrapper.____slothletInternal.invalid) {
						// apiPath is always set on constructed wrappers; the || "api" fallback is never reached.
						/* v8 ignore next */
						throw new TypeError(`${wrapper.____slothletInternal.apiPath || "api"} is invalidated`);
					}

					// Permission enforcement parity with applyTrap: gate `new proxy(args)` the same
					// way function calls are gated, before any materialization or construction.
					// Constructor args are threaded for resource-scoped conditions (#455).
					enforcePermission(wrapper, args, false, kept);

					// Lazy mode: start materialization if not already in flight.
					// Fire-and-forget — rejection suppressed to avoid unhandled-rejection event.
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						/* v8 ignore next */
						PromiseMethods.catch(wrapper.___materialize(), () => {});
					}

					// Lazy mode, in-flight: chain off the existing materializationPromise instead of polling.
					// The construct trap must return an object — Promise satisfies this invariant,
					// and the caller can await the result: `const inst = await new api.Foo(args)`.
					// Propagates the original materialization rejection rather than replacing it with a
					// generic error, and avoids busy-polling the event loop with setImmediate().
					if (wrapper.____slothletInternal.mode === "lazy" && wrapper.____slothletInternal.state.inFlight) {
						// A subclass's `super()` has to finish now, which nothing still loading can (#685).
						if (newTarget !== wrapper.____slothletInternal.proxy) {
							throw new wrapper.____SlothletError("LAZY_SUBCLASS_BEFORE_LOAD", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
						}
						// materializationPromise is always set when inFlight=true; Promise.resolve() guards
						// the unreachable case where it is somehow absent due to corrupted internal state.
						/* v8 ignore next */
						return PromiseMethods.then(Promises.resolve(wrapper.____slothletInternal.materializationPromise), () => {
							if (!wrapper.____slothletInternal.state.materialized) {
								// Materialization resolved without marking the wrapper as materialized —
								// a defensive guard against corrupted internal state; unreachable in practice.
								/* v8 ignore next */
								throw new wrapper.____slothlet.SlothletError("LAZY_MATERIALIZATION_FAILED", {
									path: segmentsOf(wrapper.____slothletInternal.apiPath)
								});
							}
							const impl = wrapper.____slothletInternal.impl;
							// newTarget is the proxy itself here (a subclass was refused above): impl stands in for it, so
							// [[Prototype]] resolves to impl.prototype (the real class prototype) rather than flowing
							// through the proxy getTrap.
							if (typeof impl === "function") return Reflect.construct(impl, args, impl);
							if (impl && typeof impl === "object" && typeof impl.default === "function") {
								return Reflect.construct(impl.default, args, impl.default);
							}
							throw new wrapper.____slothlet.SlothletError("API_PATH_NOT_CALLABLE", {
								path: segmentsOf(wrapper.____slothletInternal.apiPath),
								received: typeof impl
							});
						});
					}

					// Eager or already-materialized: construct directly from impl.
					// Use impl (not the proxy newTarget) as the newTarget for Reflect.construct so that
					// [[Prototype]] of the new instance is set to impl.prototype (the real class prototype)
					// rather than flowing through the proxy's getTrap, which returns a child wrapper.
					const impl = wrapper.____slothletInternal.impl;

					if (typeof impl === "function") {
						// When newTarget is the proxy itself, substitute impl so [[Prototype]] resolves
						// to impl.prototype (the real class prototype) rather than flowing through the
						// proxy getTrap. When newTarget is a derived class (e.g. super() inside a
						// subclass), forward it unchanged so derived construction semantics are preserved.
						const effectiveNewTarget = newTarget === wrapper.____slothletInternal.proxy ? impl : newTarget;
						return wrapper.___constructAsNode(impl, args, effectiveNewTarget);
					}

					if (impl && typeof impl === "object" && typeof impl.default === "function") {
						const effectiveNewTarget = newTarget === wrapper.____slothletInternal.proxy ? impl.default : newTarget;
						return wrapper.___constructAsNode(impl.default, args, effectiveNewTarget);
					}

					throw new wrapper.____SlothletError("API_PATH_NOT_CALLABLE", {
						path: segmentsOf(wrapper.____slothletInternal.apiPath),
						received: typeof impl
					});
				};

				/**
				 * Seal the node's shell: copy the members it reports onto it, then make it non-extensible (see the
				 * preventExtensions trap).
				 * @param {object|Function|Array} target - The shell.
				 * @returns {boolean} Whether the shell is now non-extensible.
				 * @private
				 */
				/**
				 * The prototype the node holds for every reader: its array's for an array member, its impl's own for an emitter or a
				 * live grafted object, null for any other node. Unchecked; the getPrototypeOf trap decides what a caller is reported.
				 * @returns {object|null} The prototype.
				 */
				const heldPrototype = () => {
					const internal = wrapper.____slothletInternal;
					// A prototype a node of a run's own tree took in place of the module's value (see the setPrototypeOf trap).
					if (internal.runPrototype !== undefined) return internal.runPrototype.prototype;
					const impl = internal.impl;
					if (Arrays.isArray(impl)) return Reflect.getPrototypeOf(impl);
					// A node of a built-in data object fronts it as data, so `instanceof Map` holds of it as of the object.
					if (holdsDataKind(impl)) return Reflect.getPrototypeOf(impl);
					// A node fronting a module's own object holds that object's prototype, one set on it since included (#757).
					const moduleObject = moduleObjectOf(wrapper);
					if (moduleObject !== null) return Reflect.getPrototypeOf(moduleObject);
					const isLiveIdentity = internal.deferChildAdopt || (EventEmitter && inherits(impl, EventEmitter));
					if (isLiveIdentity && impl && typeof impl === "object") return Objects.getPrototypeOf(impl);
					// A namespace slothlet composed has the prototype its record holds, as a function node does.
					return ownsPrototype(wrapper) ? wrapper.___recordedPrototype() : null;
				};
				/**
				 * The prototype the node reports to whoever asks now (#667), by `Object.getPrototypeOf` and, for an object node,
				 * through `__proto__` alike: the same answer, behind the same checks, on every path.
				 * @param {object} target - The proxy's target.
				 * @param {function(): ({wrapper: object, reader: object}|null)} takeKept - Takes the access a node a module kept is
				 *   making, once the answer needs it.
				 * @returns {object|null} The prototype.
				 */
				const reportedPrototype = (target, takeKept) => {
					const impl = wrapper.____slothletInternal.impl;
					// An array member reports the prototype its array has, which may be one set on it; a sealed shell reports its own.
					if (Arrays.isArray(impl) && wrapper.____slothletInternal.runPrototype === undefined)
						return Reflect.isExtensible(target) ? Reflect.getPrototypeOf(impl) : Reflect.getPrototypeOf(target);
					if (!Reflect.isExtensible(target)) {
						// A sealed node reports its shell's prototype to every reader, as the invariants require: the module's own
						// when the node is one of its emitters, as the view its shell holds, so reaching it is checked as a call of the
						// node (#632) and a change through it as a write at the node's path (#667). slothlet's own checks never read it
						// (see inherits).
						const fixed = Reflect.getPrototypeOf(target);
						// A prototype given to the node is reported as it is to every reader, as on an open node.
						const given = ownsPrototype(wrapper) && (typeof impl !== "function" || prototypeGiven(wrapper));
						if (nodesShared.heldPrototypeRead !== wrapper && !given) {
							// A class instance's prototype is checked as a call of its class's node, as on an open node (#725).
							const behind = behindMemberView(fixed);
							enforceCodeMember(wrapper.___prototypeCheckedBy(behind), behind, takeKept());
						}
						return fixed;
					}
					// A function node reports its function's prototype, a class it extends as that class's node (#667).
					if (typeof impl === "function") return wrapper.___functionNodePrototype(impl);
					const kept = takeKept();
					const emitter = emitterOwnPrototype(wrapper) !== undefined;
					// An instance of a class of the module's reports that class's prototype, as the instance does, behind the class's
					// node's checks (#667). Only an open node: a closed one reports its shell's. An emitter, its class exported or not,
					// answers as an emitter below.
					const classPrototype = emitter ? undefined : instanceClassPrototype(wrapper, kept);
					if (classPrototype !== undefined) return classPrototype;
					// An instance whose class cannot be told reports its own prototype, behind its own node's checks (#667).
					const unclassed = wrapper.___unclassedInstancePrototype();
					if (unclassed !== undefined) {
						enforceCodeMember(wrapper, unclassed, kept);
						return prototypeForReader(wrapper, wrapper.___exposePrototype(unclassed), null);
					}
					let prototype = heldPrototype();
					// A node's own prototype is reported as it is to the host; one it was given is handed to module code as that
					// module's view of it (see givenView).
					if (prototype === null) return null;
					if (ownsPrototype(wrapper)) return prototypeGiven(wrapper) ? wrapper.___givenPrototypeFor(prototype, kept) : prototype;
					// A prototype of the module's holds its class and methods, so it is reported only to a caller that may call
					// the node, as its `constructor` is read (#632). Any other caller is reported a stand-in inheriting from the
					// nearest prototype above it holding none of the module's code, so `instanceof` against the language's or
					// Node's own classes still holds, and no write lands on that shared prototype (#667).
					if (!isCodeMemberWithheld(wrapper, { value: prototype }, kept)) {
						if (!emitter) return prototype;
						// A module allowed the emitter reads and calls through it, and a change made through it stays the owner's (#667).
						return prototypeForHolder(
							wrapper.____slothlet,
							selfModuleReader(wrapper.____slothlet) ?? kept?.reader ?? null,
							wrapper.___emitterPrototypeHandle(prototype)
						);
					}
					while (memberHoldsCode(prototype, searchDepth(wrapper.____slothlet) + 1, searchBudget(wrapper.____slothlet)))
						prototype = Objects.getPrototypeOf(prototype);
					return withheldPrototype(wrapper, prototype);
				};
				const sealShell = (target) => {
					if (target !== wrapper && Reflect.isExtensible(target)) {
						// A lazy node not loaded yet has no members to fix in place, and loading it would have to add
						// them; it is sealed once loaded.
						const lazyState = wrapper.____slothletInternal;
						if (lazyState.mode === "lazy" && !lazyState.state.materialized) return false;
						// Each reported member, the shell's own `name` / `length` included, is fixed on the shell as the node
						// reports it, so the sealed node describes, seals and freezes as an object of its own would. Every
						// member is fixed, whoever seals the node: a sealed node lists one set of keys to every reader (proxy
						// invariant), so the keys the sealing caller may not read are fixed too, and only their values stay
						// gated (see defineOnSealedShell).
						const node = wrapper.____slothletInternal.proxy;
						// An array member seals the module's current array too, as sealing the array itself would. The
						// shell's own `length` is a plain value the proxy invariants pin once it is sealed, so it takes
						// the array's length now; it is the one member every reader sees as a value (#609).
						const array = wrapper.____slothletInternal.impl;
						if (Arrays.isArray(target) && Arrays.isArray(array)) {
							// An array that refuses to be sealed (a proxy whose own trap says no) refuses it here, before the shell changes.
							// A node of a run's own tree leaves the module's array, which the instance shares, as it is.
							if (!inRunTree(wrapper) && !Reflect.preventExtensions(layerUnderlying(array))) return false;
							// A shell whose `length` is already read-only (an export with a fixed length) holds the array's.
							if (Reflect.getOwnPropertyDescriptor(target, "length").writable) target.length = array.length;
						}
						// A sealed node reports its target's own prototype (proxy invariant): an object shell takes the one the node
						// holds, whoever seals it — not the one reported to the sealing caller, which may be withheld from it (#632). An
						// emitter's own prototype is taken as a view no reader keeps, so a change made through it is checked as one made
						// through the node is, as whoever is running then; the views of a reader that keeps the node hand it that reader's
						// own (#667).
						if (typeof target !== "function") {
							const prototype = heldPrototype();
							// A class instance's prototype is held as a view standing as the node does, as an emitter's is (#725).
							const instancePrototype = prototype === null ? instanceShellPrototype(wrapper) : undefined;
							Reflect.setPrototypeOf(
								target,
								instancePrototype !== undefined
									? instancePrototype
									: prototype !== null && prototype === emitterOwnPrototype(wrapper)
										? sealedShellPrototype(wrapper, prototype)
										: prototype
							);
						} else if (typeof array === "function") Reflect.setPrototypeOf(target, wrapper.___functionNodePrototype(array));
						// A lazy namespace's shell is a function, built before its value was known: it takes the namespace's prototype.
						else if (ownsPrototype(wrapper)) Reflect.setPrototypeOf(target, wrapper.___recordedPrototype());
						// A prototype the node was given is held as the view every holder of the closed node reads it through.
						if (prototypeGiven(wrapper)) {
							Reflect.setPrototypeOf(target, givenShellPrototype(wrapper, wrapper.___recordedPrototype()));
						}
						const keys = setFrom(concatLists(ownKeysTrap(target, false), Reflect.ownKeys(target)));
						const frontsModuleObject = !Arrays.isArray(target) && moduleObjectOf(wrapper) !== null;
						for (const key of setValues(keys)) {
							if (isFixedOnTarget(target, key)) continue;
							// The shell's inspect hook stays the shell's own (see defineProxyInspect): the node holds no member
							// there to fix in its place, so an object node frozen with it read the hook as `undefined` (#667).
							if (
								key === util.inspect.custom &&
								(Arrays.isArray(target) || WeakSetMethods.has(INSPECT_HOOKS, Reflect.getOwnPropertyDescriptor(target, key)?.value))
							)
								continue;
							const descriptor = getOwnPropertyDescriptorTrap(target, key, false) ?? Reflect.getOwnPropertyDescriptor(target, key);
							if (!descriptor) continue;
							// A data member is held as data, so the sealed node reports and freezes as an object of its own would;
							// a writable one is not pinned, and reads keep going through the node. An accessor the module's
							// array holds stays an accessor that reads and writes through the node.
							// So does an accessor of a module's own object the node fronts, as freezing the object keeps it one (#757).
							const isArrayAccessor = (Arrays.isArray(target) || frontsModuleObject) && !("value" in descriptor);
							Reflect.defineProperty(
								target,
								key,
								isArrayAccessor
									? {
											__proto__: null,
											get: frontsModuleObject && typeof descriptor.get !== "function" ? undefined : () => node[key],
											set:
												frontsModuleObject && typeof descriptor.set !== "function"
													? undefined
													: (value) => {
															node[key] = value;
														},
											enumerable: descriptor.enumerable,
											configurable: true
										}
									: {
											__proto__: null,
											value: shellValue(wrapper, key),
											writable: Arrays.isArray(target) ? descriptor.writable !== false : true,
											enumerable: descriptor.enumerable,
											configurable: true
										}
							);
						}
					}
					return Reflect.preventExtensions(target);
				};

				const proxyHandler = {
					// One chokepoint for capture-binding rather than the many return paths inside getTrap: whatever
					// the trap resolved, a wrapper handed to a module carries that module's identity from here on.
					get: (target, prop, receiver) => {
						// The access a view is making into this node, taken as the trap starts (see beginAccess).
						const access = takeAccess(wrapper);
						if (runTreeHides(wrapper, prop)) {
							const from = wrapper.___runTreeHiddenFrom();
							return from === null ? undefined : Reflect.get(from, prop, receiver);
						}
						const value = getTrap(target, prop, receiver, access);
						// A built-in handed out as itself (a `Map`, a `Date`) is saved first for the runs open (see helpers/run-snapshot).
						if (anyRunOpen() && value !== null && (typeof value === "object" || typeof value === "function")) {
							const held = builtinBehind(value);
							if (held !== null) checkpointHandout(wrapper.____slothlet, held);
							// So is a class's prototype, which a module's code and the host change as itself.
							else if (prop === "prototype") wrapper.___checkpointPrototypeHandout(wrapper.___wrapperClassPrototype());
						}
						// A member fixed read-only on a frozen shell must be read as the shell holds it (proxy invariant), so it
						// carries no view bound to the reader: it is checked against whoever calls or reads it.
						const fixed = target !== wrapper ? Reflect.getOwnPropertyDescriptor(target, prop) : undefined;
						if (fixed && "value" in fixed && !fixed.configurable && !fixed.writable) return value;
						return bindCapturedIdentity(wrapper, prop, value, access);
					},
					apply: (target, thisArg, args) => {
						// A member named `toJSON` is what `JSON.stringify` calls to serialize the node holding it: what it gives is
						// held to the rules at that node's path and each member's name, as the node's own members are.
						const path = wrapper.____slothletInternal.apiPath;
						const dot = typeof path === "string" ? StringMethods.lastIndexOf(path, ".") : -1;
						if (dot < 0 || (typeof path === "string" ? StringMethods.slice(path, dot + 1) : copyList(path, dot + 1)) !== "toJSON") {
							if (!anyRunOpen()) return applyTrap(target, thisArg, args);
							// While a run is open, the file's exports are saved before its code runs outside every run, and what the
							// call hands back as itself is saved before the caller has it (see helpers/run-snapshot).
							wrapper.___checkpointFile();
							const result = applyTrap(target, thisArg, args);
							if (result !== null && typeof result === "object") {
								// What an async call settles with is saved before the caller has it, as what a call returns is.
								if (util.types.isPromise(result)) return checkpointSettled(wrapper.____slothlet, result);
								checkpointHandout(wrapper.____slothlet, result);
							}
							return result;
						}
						const keptAccess = rulesShared.capturedAccess?.wrapper === wrapper ? rulesShared.capturedAccess : null;
						return wrapper.___redactToJSONResult(
							applyTrap(target, thisArg, args),
							typeof path === "string" ? StringMethods.slice(path, 0, dot) : copyList(path, 0, dot),
							[undefined],
							keptAccess
						);
					},
					construct: constructTrap,
					has: (target, prop) => {
						if (runTreeHides(wrapper, prop)) {
							const from = wrapper.___runTreeHiddenFrom();
							return from !== null && Reflect.has(from, prop);
						}
						return hasTrap(target, prop);
					},
					// A member is described holding what reading it hands out, the reading module's identity bound to a node as the
					// get trap binds it, so its description and a read of it give the same value (#667). A member fixed read-only on
					// a frozen shell is described as the shell holds it (proxy invariant), as it is read.
					getOwnPropertyDescriptor: (target, prop) => {
						const access = takeAccess(wrapper);
						if (runTreeHides(wrapper, prop) && !isFixedOnTarget(target, prop)) return undefined;
						const descriptor = getOwnPropertyDescriptorTrap(target, prop, true, access);
						if (!descriptor || !("value" in descriptor)) return descriptor;
						const fixed = target !== wrapper ? Reflect.getOwnPropertyDescriptor(target, prop) : undefined;
						if (fixed && "value" in fixed && !fixed.configurable && !fixed.writable) return descriptor;
						const bound = bindCapturedIdentity(wrapper, prop, descriptor.value, access);
						return bound === descriptor.value ? descriptor : { __proto__: null, ...descriptor, value: bound };
					},
					ownKeys: (target) => {
						const keys = ownKeysTrap(target);
						if (wrapper.____slothletInternal.runHiddenKeys === undefined) return keys;
						return filterList(keys, (key) => !runTreeHides(wrapper, key) || isFixedOnTarget(target, key));
					},
					// What a module's write stores is owned by the module owning the member, or by the writer for one it creates.
					set: placingTrap(wrapper, setTrap, (args) => args[2]),
					// A callable `then` is refused here, as in the set trap. A callable node's target is a bare function shell
					// while its members live on the wrapper, so a definition lands on the wrapper, where reads find
					// it; the shell takes it too only when the proxy invariants bind it there (a non-configurable
					// definition, a sealed shell, a key the shell holds non-configurably). Any other target, and any
					// framework-reserved key, is defined on the target as before.
					defineProperty: placingTrap(
						wrapper,
						(target, prop, descriptor) => {
							if (prop === "then" && isAwaitableThen(descriptor)) {
								throw new wrapper.____SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
							}
							// A definition that changes nothing (freezing an already frozen node) is no write (#667).
							if (!Reflect.isExtensible(target) && isUnchangingDefinition(target, prop, descriptor)) return true;
							// Defining a member is a write to its path: a module defines only under the subtree it owns (#625),
							// and never a framework-reserved key (the built-in write rules).
							assertOwnedWrite(wrapper, prop);
							// A view `self` handed out stands for its node: the node is what is defined (#625).
							if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) };
							// An object defined after the api was built is data, as one assigned is (#826).
							if ("value" in descriptor) wrapper.___markAssignedData(descriptor.value);
							// A name with the framework's prefix is never a member: a definition is absorbed as an assignment is, so nothing
							// is stored and nothing reads back (the framework's own `___materialize`, metadata and branded markers excepted).
							const absorbed = absorbsFrameworkName(target, prop, descriptor, wrapper);
							if (absorbed !== undefined) return absorbed;
							// A framework-reserved key never reads through the node, so it stays off the wrapper's own state.
							if (isFrameworkReservedKey(prop)) return Reflect.defineProperty(target, prop, descriptor);
							// A member fixed in one step holding an object would be handed out as it is: refused while permissions are on.
							if (
								"value" in descriptor &&
								!MapMethods.has(FRAMEWORK_WRITES, wrapper) &&
								wrapper.___definitionFixes(target, prop, descriptor)
							) {
								refuseFixedObjectDefinition(wrapper.____slothlet, wrapper.____slothletInternal.apiPath, prop, descriptor.value);
							}
							// An object or function defined on the node is held as a node of its own, as one assigned to it is: what is
							// read through it is gated at its own path and a write through it is held to its owner. The module's own
							// object keeps the value itself.
							const raw = descriptor;
							const heldNode = definedValueNode(wrapper, target, prop, descriptor);
							if (heldNode !== null) descriptor = { __proto__: null, ...descriptor, value: heldNode };
							// A full-isolation run's `self` defining a member of a node of the tree the run does not own yet (see
							// runWrite): checked as above, and kept in the run's own record instead of on the node.
							// A closed node, or a member it holds fixed, refuses a definition it could not take first.
							if (
								runShared.RUN_WRITE !== null &&
								runShared.RUN_WRITE.node === wrapper &&
								runShared.RUN_WRITE.prop === prop &&
								(!Reflect.isExtensible(target) || isFixedOnTarget(target, prop)) &&
								!canDefine(target, prop, descriptor)
							) {
								runShared.RUN_WRITE = null;
								return false;
							}
							const runSink = takeRunWrite(wrapper, prop);
							if (runSink !== null) return runSink({ op: "define", descriptor });
							// A node of a run's tree defines on its own copy of the array it fronts, and holds what it defines over the
							// live value it fronts (see runTreeHolds).
							if (inRunTree(wrapper)) {
								ownRunTreeArray(wrapper);
								markRunTreeHeld(wrapper, prop);
							}
							if (target === wrapper) {
								if (!Reflect.defineProperty(target, prop, descriptor)) return false;
								if (heldNode !== null) SetMethods.add((wrapper.____slothletInternal.userAssignedKeys ??= new Set()), prop);
								return true;
							}
							// A sealed node holds its members on the shell (see the preventExtensions trap), where a definition
							// changes them as it would on the object, a value going through the node's own write.
							if (!Reflect.isExtensible(target)) return defineOnSealedShell(wrapper, target, prop, descriptor);
							// An accessor defined at runtime runs as the node's module, as an exported one does (#597).
							descriptor = adoptDefinedAccessor(wrapper, descriptor);
							// An array member defines on its current array (#602), unless the position lies past a read-only length.
							if (Arrays.isArray(target)) return isPastFixedLength(target, prop) ? false : definePropertyTrap(target, prop, descriptor);
							const internal = wrapper.____slothletInternal;
							// As the set trap does: a lazy node loads first, so loading does not overwrite the definition.
							if (internal.mode === "lazy" && !internal.state.materialized && !internal.state.inFlight) wrapper.___materialize();
							const bindsTarget = definitionBindsTarget(target, wrapper, prop, descriptor);
							// A partial definition binding the shell (`{ configurable: false }`) keeps the member as it is: the shell
							// takes the rest of its descriptor from the member, its value as the node holds it (#603 review).
							let shellDescriptor = descriptor;
							if (bindsTarget && !hasOwn(target, prop) && !("get" in descriptor) && !("set" in descriptor)) {
								const member = getOwnPropertyDescriptorTrap(target, prop, false);
								if (member && "value" in member) {
									shellDescriptor = {
										__proto__: null,
										value: shellValue(wrapper, prop),
										writable: true,
										enumerable: member.enumerable,
										configurable: member.configurable,
										...descriptor
									};
								}
							}
							// A node built from a copy of a module's own object defines the member on that object too, as the same
							// definition of the object does (#746).
							const moduleObject = MapMethods.has(FRAMEWORK_WRITES, wrapper) || inRunTree(wrapper) ? null : moduleObjectOf(wrapper, prop);
							// All are checked before any changes, so a refusal by one leaves the others as they were.
							if (
								(bindsTarget && !canDefine(target, prop, shellDescriptor)) ||
								!canDefine(wrapper, prop, descriptor) ||
								(moduleObject !== null && !canDefine(moduleObject, prop, raw))
							)
								return false;
							if (moduleObject !== null && !Reflect.defineProperty(moduleObject, prop, raw)) return false;
							if (moduleObject !== null && typeof prop === "string") SetMethods.add(moduleObjectKeys(moduleObject), prop);
							// Whether the member takes a write once defined, as the same definition leaves it on an object (#749): the
							// node's own store keeps every member read-only, so what was asked for is remembered beside it.
							const wasData = hasOwn(wrapper, prop) && "value" in Reflect.getOwnPropertyDescriptor(wrapper, prop);
							const wasWritable = wasData && reportsWritable(wrapper, prop);
							if (bindsTarget) Reflect.defineProperty(target, prop, shellDescriptor);
							if (!Reflect.defineProperty(wrapper, prop, descriptor)) return false;
							const isAccessor = "get" in descriptor || "set" in descriptor;
							const staysWritable = !isAccessor && ("writable" in descriptor ? descriptor.writable === true : wasWritable);
							if (isAccessor || staysWritable) {
								if (internal.readOnlyKeys) SetMethods.delete(internal.readOnlyKeys, prop);
							} else SetMethods.add((internal.readOnlyKeys ??= new Set()), prop);
							if (heldNode !== null) SetMethods.add((internal.userAssignedKeys ??= new Set()), prop);
							return true;
						},
						(args) => ("value" in args[2] ? args[2].value : NO_STORED_VALUE)
					),
					// A member a module created at runtime is no one's once deleted.
					deleteProperty: placingTrap(wrapper, deletePropertyTrap, null),
					// Array-targeted wrappers expose Array.prototype so array methods and `instanceof Array`
					// resolve. Generalized beyond arrays for a wrap-on-set/add() GRAFTED subtree (#340,
					// gated on `deferChildAdopt` — the same flag that marks that whole subtree), AND for any
					// EventEmitter-derived impl regardless of how it was mounted: a live OBJECT impl there
					// (a wrap-on-set plain object, an EventEmitter-derived instance, a real `net.Socket`
					// mounted via wrap-on-set OR api.add(), …) exposes its own REAL prototype chain, so
					// `instanceof` against the actual class resolves correctly instead of always failing
					// against a null prototype. An ORDINARY framework-built namespace/folder wrapper's impl
					// is an internal scaffold object (e.g. `{}`) whose own prototype is irrelevant to the
					// wrapper's identity — those keep the null prototype exactly as before; only a deferred
					// (grafted) subtree or an EventEmitter-derived impl is generalized. Keyed off the LIVE
					// impl (not the fixed target) so a reused wrapper whose impl is swapped stays consistent
					// with the get trap's array delegation.
					//
					// Proxy invariant guard: for the array case the proxy TARGET is the array itself (its
					// real prototype already IS Array.prototype, so that branch is self-consistent even once
					// non-extensible). For the non-array live-identity case the target is `wrapper` — a
					// DIFFERENT object from `impl` — so once `target` becomes non-extensible (a user calling
					// `Object.preventExtensions()`/`Object.freeze()` on this proxy), the spec requires
					// `getPrototypeOf` to return `target`'s own real prototype exactly, or the engine throws
					// on every subsequent `instanceof`/`Object.getPrototypeOf()` call. Fall back to
					// `Reflect.getPrototypeOf(target)` in that case rather than substituting `impl`'s.
					// A callable node's target is a bare function shell, and an array member's an empty array shell
					// (#603, #609), while the members live on the wrapper or the module's array. Sealing a shell alone
					// would leave reflection reporting members the target cannot hold, which the proxy invariants
					// forbid once it is non-extensible. Its reported members are copied onto the shell first, so the
					// sealed node lists, describes and reads them from there.
					preventExtensions: (target) => {
						// Closing a node already closed changes nothing, as on a plain object (#667).
						syncArrayIntegrity(wrapper, target);
						if (!Reflect.isExtensible(target)) return true;
						// Sealing or freezing a node changes what its owner may write to it, so a module may do it only to a
						// node it owns (#625). Checked before anything is sealed: a refused freeze leaves the node as it was.
						assertOwnedWrite(wrapper, null);
						// A full-isolation run's `self` closes its own view of the node once the change is allowed (see runWrite).
						const runSink = takeRunWrite(wrapper, null);
						if (runSink !== null) return runSink({ op: "close" });
						// A node fronting a module's own object closes that object too, as closing the object does (#757): the
						// object refusing it refuses it here, before the node changes. Composing never changes a module's value, and
						// neither does a node of a run's own tree, which shares the module's values with the instance: it closes itself.
						const moduleObject =
							wrapper.____slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper) || inRunTree(wrapper)
								? null
								: moduleObjectOf(wrapper);
						if (moduleObject !== null && !Reflect.preventExtensions(moduleObject)) return false;
						// Sealing reads the node's own descriptors, which must not start a sync of the half-sealed shell.
						const internalState = wrapper.____slothletInternal;
						const syncing = internalState.integritySyncing;
						internalState.integritySyncing = true;
						try {
							return sealShell(target);
						} finally {
							internalState.integritySyncing = syncing;
						}
					},
					// A module may freeze or seal its own array after the node was read; the node reports what the array is.
					isExtensible: (target) => {
						syncArrayIntegrity(wrapper, target);
						wrapper.___followModuleIntegrity(target);
						return Reflect.isExtensible(target);
					},
					// A prototype set on an array member is set on its array, under a composed node's layer, which refuses
					// one itself; a sealed shell keeps the one it reports.
					setPrototypeOf: (target, proto) => {
						// A prototype set on a node is set on its module's value: a module may do it only to a node it owns (#625).
						assertOwnedWrite(wrapper, null);
						// A full-isolation run's `self` keeps the prototype in the run once the change is allowed (see runWrite).
						const runSink = takeRunWrite(wrapper, null);
						if (runSink !== null) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === unwrapSelfView(proto);
							return runSink({ op: "prototype", prototype: proto });
						}
						const impl = wrapper.____slothletInternal.impl;
						// A node of a run's own tree shares the module's values with the instance: a prototype set on it that would be
						// set on one of them is the node's own instead, which it reports and inherits through.
						if (inRunTree(wrapper) && prototypeOnSharedValue(wrapper)) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
							const internal = wrapper.____slothletInternal;
							if (internal.mode === "lazy" && !internal.state.materialized) return false;
							internal.runPrototype = { prototype: unwrapSelfView(proto) };
							return true;
						}
						// A node fronting a module's own object sets that object's prototype, which the node reports (#757); a
						// closed node keeps the one its shell holds, as the closed object does.
						const moduleObject = MapMethods.has(FRAMEWORK_WRITES, wrapper) ? null : moduleObjectOf(wrapper);
						if (moduleObject !== null && !Arrays.isArray(impl)) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
							return Reflect.setPrototypeOf(moduleObject, unwrapSelfView(proto));
						}
						if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
						if (Arrays.isArray(impl)) return Reflect.setPrototypeOf(layerUnderlying(impl), proto);
						// A node reports its impl's prototype and its members inherit through the impl, so the change goes there or
						// nowhere: setting it on the shell answered true and changed nothing (#802). A value the module holds as it
						// is (an emitter, a class instance) takes it, as setting it on that value does.
						const internal = wrapper.____slothletInternal;
						if (internal.mode === "lazy" && !internal.state.materialized) return false;
						if (
							impl !== null &&
							typeof impl === "object" &&
							!util.types.isProxy(impl) &&
							hasOwn(internal, "sourceValue") &&
							internal.sourceValue === impl
						)
							return Reflect.setPrototypeOf(impl, unwrapSelfView(proto));
						// A function node never writes to the module's function (a member written through it stays the node's), and
						// a namespace slothlet composed is no value of a module's: either takes the prototype on its own record,
						// which the node reports and inherits from (see fillPrototype). Any other node answers true only
						// for the prototype it already has.
						if (!ownsPrototype(wrapper)) {
							return unwrapSelfView(proto) === (typeof impl === "function" ? Reflect.getPrototypeOf(impl) : heldPrototype());
						}
						// The one its value came with is the node's again as it was before any was given.
						const given = behindGivenView(unwrapSelfView(proto));
						wrapper.___recordedPrototype();
						internal.prototypeGiven = given !== (typeof impl === "function" ? Reflect.getPrototypeOf(impl) : Objects.prototype);
						internal.prototype = given;
						return true;
					},
					getPrototypeOf: (target) => {
						// A prototype of a module's own handed out is saved first for the runs open (see helpers/run-snapshot).
						if (anyRunOpen()) wrapper.___checkpointPrototypeHandout(snapshotPrototype(wrapper));
						return reportedPrototype(target, () => takeCapturedAccess(wrapper));
					}
				};
				// A run that started before a change reads the node as it was (see helpers/run-snapshot): every trap that changes
				// the node saves it first, once per window, while a run is open.
				{
					const { set, defineProperty, deleteProperty, setPrototypeOf, preventExtensions } = proxyHandler;
					const save = () => {
						if (anyRunOpen()) snapshotBarrier(wrapper);
					};
					proxyHandler.set = (target, prop, value, receiver) => (save(), set(target, prop, value, receiver));
					proxyHandler.defineProperty = (target, prop, descriptor) => (save(), defineProperty(target, prop, descriptor));
					proxyHandler.deleteProperty = (target, prop) => (save(), deleteProperty(target, prop));
					proxyHandler.setPrototypeOf = (target, prototype) => (save(), setPrototypeOf(target, prototype));
					proxyHandler.preventExtensions = (target) => (save(), preventExtensions(target));
				}
				// Once a restart() replaces this wrapper's tree, every trap forwards to the live tree (#504).
				const proxyTraps = withRestartForwarding(proxyHandler, wrapper);
				wrapper.____slothletInternal.proxy = new NativeProxy(proxyTarget, proxyTraps);
				WeakMapMethods.set(NODE_TARGETS, wrapper, proxyTarget);
				if (Arrays.isArray(proxyTarget)) adoptArrayIntegrity(wrapper);
				else adoptObjectIntegrity(wrapper);
				// Kept only for a proxy that is not callable yet: ___upgradeToCallableProxy() builds the callable
				// replacement from the same handler and re-points these traps at it (#533).
				if (typeof proxyTarget !== "function") {
					wrapper.____slothletInternal.proxyHandler = proxyHandler;
					wrapper.____slothletInternal.proxyTraps = proxyTraps;
				} else if (wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.isCallableLocked) {
					// Kept for a lazy node built on a function target before its value is known:
					// ___settleLazyProxy() rebuilds it on eager's target once the value is known to be no function.
					wrapper.____slothletInternal.lazyProxyHandler = proxyHandler;
					wrapper.____slothletInternal.lazyProxyTraps = proxyTraps;
				}

				registerProxy(wrapper.____slothletInternal.proxy, wrapper);
				recordFunctionNode(wrapper);
				// Register this wrapper instance as genuine so permission enforcement can distinguish a real
				// caller identity (`ctx.currentWrapper`) from a forged object and fail closed on the latter.
				WeakSetMethods.add(trustedRootOwn.genuineWrappers, wrapper);
				// Indexed by its file, so code running from that file elsewhere is known to be this leaf's (#597).
				registerLeafFile(wrapper);
				return wrapper.____slothletInternal.proxy;
			}
		}
	);
}
