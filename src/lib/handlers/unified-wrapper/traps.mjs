/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/traps.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Traps layer of the wrapper: the node's Proxy and its traps.
 * @module @cldmv/slothlet/handlers/unified-wrapper/traps
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { util, EventEmitter, scheduleMacrotask } from "#helpers/platform";
import { isCompositionLayer, layerHeldKeys, layerMethodOriginal, layerUnderlying, holdMember } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { settleThenable, isHookProcessed, failureSource } from "#handlers/hook-manager";
import { pinnedResultThen } from "#helpers/promise-context";
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
	WeakSetMethods
} from "#helpers/intrinsics";
import { anyRunOpen } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";

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
	runtime_takeInvariantRead,
	runtime_isUnchangingDefinition,
	SELF_INSTANCE_NODES,
	runtime_unwrapSelfView,
	runtime_selfModuleReader,
	runtime_selfIsMethodNode,
	INTRINSIC_HAS_INSTANCE,
	runtime_inherits,
	runtime_isEnginePromise,
	runtime_isErrorValue,
	runtime_dataKind,
	runtime_inheritedEngineMember,
	runtime_valueOfFor,
	NODE_MEMBER,
	runtime_holdsDataKind,
	runtime_frontedDataMember,
	NO_STORED_VALUE,
	runtime_placingTrap,
	runtime_assertOwnedWrite,
	rulesShared,
	runShared,
	runtime_takeRunWrite,
	runtime_wrapOnSet,
	NODE_TARGETS,
	runtime_snapshotPrototype,
	runtime_wrapperClassPrototype,
	runtime_checkpointPrototypeHandout,
	runtime_checkpointHandout,
	runtime_checkpointSettled,
	runtime_builtinBehind,
	runtime_checkpointFile,
	runtime_snapshotBarrier,
	runtime_takeCapturedAccess,
	runtime_accessAsKept,
	runtime_takeAccess,
	runtime_enforceReadGate,
	runtime_markAssignedData,
	WRAPPER_ANSWERED_PROPS,
	GET_TRAP_ALLOWED_INTERNALS,
	runtime_valueHoldsName,
	runtime_isBuiltinFunctionMember,
	runtime_adoptDefinedAccessor,
	runtime_enforceCodeMember,
	runtime_isCodeMemberWithheld,
	runtime_implAccessor,
	runtime_moduleInheritance,
	runtime_behindGivenView,
	runtime_givenPrototypeFor,
	runtime_givenShellPrototype,
	runtime_recordedPrototype,
	runtime_prototypeGiven,
	runtime_inRunTree,
	runtime_ownRunTreeArray,
	runtime_runTreeHolds,
	runtime_markRunTreeHeld,
	runtime_runTreeHides,
	runtime_frontsLiveValue,
	runtime_runTreeHiddenFrom,
	runtime_prototypeOnSharedValue,
	runtime_ownsPrototype,
	runtime_inheritsFrom,
	runtime_functionMember,
	runtime_inheritsSymbol,
	runtime_implHas,
	runtime_inheritedMemberNode,
	runtime_keepInheritedMemberNode,
	runtime_readImplMember,
	runtime_writeImplMember,
	runtime_moduleObjectOf,
	OBJECT_PROTO_SETTER,
	runtime_moduleObjectKeys,
	runtime_gateDataNodeMember,
	runtime_gateNodeValue,
	NO_NODE_PRIMITIVE,
	runtime_nodePrimitive,
	runtime_pinReader,
	runtime_followModuleObject,
	runtime_followModuleIntegrity,
	runtime_writeModuleObject,
	runtime_reportsWritable,
	runtime_onImpl,
	runtime_describeImplMember,
	runtime_originalAccessor,
	nodesShared,
	runtime_memberHoldsCode,
	searchDepth,
	searchBudget,
	runtime_constructAsNode,
	runtime_exposePrototype,
	runtime_markWritten,
	runtime_crossArguments,
	runtime_ownInstances,
	runtime_ownArguments,
	FUNCTION_NODES,
	nodeRefOf,
	runtime_recordFunctionNode,
	runtime_functionNodePrototype,
	runtime_functionNodeFor,
	runtime_prototypeForReader,
	runtime_prototypeForHolder,
	runtime_behindMemberView,
	runtime_emitterOwnPrototype,
	runtime_emitterPrototypeHandle,
	runtime_sealedShellPrototype,
	runtime_prototypeCheckedBy,
	runtime_instanceShellPrototype,
	runtime_unclassedInstancePrototype,
	runtime_readsEngineProto,
	runtime_withheldPrototype,
	runtime_exportedInstanceClass,
	runtime_instanceClassNode,
	runtime_instanceClassPrototype,
	UNLOADED_HAS_INSTANCE,
	runtime_functionOf,
	runtime_hasInstanceOf,
	runtime_hasOwnMember,
	runtime_isArrayMember,
	runtime_hasOwnSymbolMember,
	runtime_loadedAsNamespace,
	runtime_isReadRedacted,
	runtime_holdsValue,
	runtime_heldValue,
	runtime_gateFixedValue,
	runtime_fixedDescriptor,
	runtime_arrayKeyHolder,
	SERIALIZERS,
	runtime_redactSerialized,
	runtime_redactToJSONResult,
	enforcePermission,
	runtime_runAfterPrincipalGate,
	runtime_cycleNode,
	runtime_capturedReader,
	runtime_readAsReader,
	INSPECT_HOOKS,
	runtime_bindCapturedIdentity,
	runtime_guardPromotedResult,
	runtime_runAroundPipeline,
	runtime_readTargetFailure,
	unwrapError,
	createNamedProxyTarget,
	_proxyRegistry,
	findThen,
	isAwaitableThen,
	runtime_isFixedOnTarget,
	runtime_holdsFixed,
	runtime_isArrayIndex,
	runtime_isPosition,
	runtime_isPastFixedLength,
	runtime_adoptArrayIntegrity,
	runtime_adoptObjectIntegrity,
	runtime_canDefine,
	runtime_bindsTarget,
	runtime_isFixedReadOnly,
	runtime_shellValue,
	runtime_definitionFixes,
	runtime_refuseFixedObjectDefinition,
	runtime_definedValueNode,
	runtime_defineOnSealedShell,
	runtime_syncArrayIntegrity,
	runtime_standInMember,
	runtime_withRestartForwarding,
	runtime_inspectShown,
	runtime_defineProxyInspect,
	UnifiedWrapper,
	isClassInstance,
	resolveWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/** Whether {@link TrapsLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

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
					runtime_bindsTarget = methods.values.runtime_bindsTarget;
					runtime_dataKind = methods.values.runtime_dataKind;
					runtime_defineProxyInspect = methods.values.runtime_defineProxyInspect;
					runtime_frontedDataMember = methods.values.runtime_frontedDataMember;
					runtime_frontsLiveValue = methods.values.runtime_frontsLiveValue;
					runtime_holdsDataKind = methods.values.runtime_holdsDataKind;
					runtime_holdsFixed = methods.values.runtime_holdsFixed;
					runtime_holdsValue = methods.values.runtime_holdsValue;
					runtime_implHas = methods.values.runtime_implHas;
					runtime_inheritedEngineMember = methods.values.runtime_inheritedEngineMember;
					runtime_inheritedMemberNode = methods.values.runtime_inheritedMemberNode;
					runtime_inherits = methods.values.runtime_inherits;
					runtime_inheritsFrom = methods.values.runtime_inheritsFrom;
					runtime_inheritsSymbol = methods.values.runtime_inheritsSymbol;
					runtime_inspectShown = methods.values.runtime_inspectShown;
					runtime_isArrayIndex = methods.values.runtime_isArrayIndex;
					runtime_isArrayMember = methods.values.runtime_isArrayMember;
					runtime_isBuiltinFunctionMember = methods.values.runtime_isBuiltinFunctionMember;
					runtime_isCodeMemberWithheld = methods.values.runtime_isCodeMemberWithheld;
					runtime_isEnginePromise = methods.values.runtime_isEnginePromise;
					runtime_isErrorValue = methods.values.runtime_isErrorValue;
					runtime_isFixedOnTarget = methods.values.runtime_isFixedOnTarget;
					runtime_isFixedReadOnly = methods.values.runtime_isFixedReadOnly;
					runtime_isPastFixedLength = methods.values.runtime_isPastFixedLength;
					runtime_isPosition = methods.values.runtime_isPosition;
					runtime_isReadRedacted = methods.values.runtime_isReadRedacted;
					runtime_isUnchangingDefinition = methods.values.runtime_isUnchangingDefinition;
					runtime_keepInheritedMemberNode = methods.values.runtime_keepInheritedMemberNode;
					runtime_markAssignedData = methods.values.runtime_markAssignedData;
					runtime_ownsPrototype = methods.values.runtime_ownsPrototype;
					runtime_redactSerialized = methods.values.runtime_redactSerialized;
					runtime_redactToJSONResult = methods.values.runtime_redactToJSONResult;
					runtime_valueHoldsName = methods.values.runtime_valueHoldsName;
					_proxyRegistry = methods.nodes._proxyRegistry;
					FUNCTION_NODES = methods.nodes.FUNCTION_NODES;
					NO_NODE_PRIMITIVE = methods.nodes.NO_NODE_PRIMITIVE;
					NODE_TARGETS = methods.nodes.NODE_TARGETS;
					nodeRefOf = methods.nodes.nodeRefOf;
					nodesShared = methods.nodes.nodesShared;
					runtime_cycleNode = methods.nodes.runtime_cycleNode;
					runtime_emitterPrototypeHandle = methods.nodes.runtime_emitterPrototypeHandle;
					runtime_exportedInstanceClass = methods.nodes.runtime_exportedInstanceClass;
					runtime_exposePrototype = methods.nodes.runtime_exposePrototype;
					runtime_followModuleIntegrity = methods.nodes.runtime_followModuleIntegrity;
					runtime_followModuleObject = methods.nodes.runtime_followModuleObject;
					runtime_functionMember = methods.nodes.runtime_functionMember;
					runtime_instanceClassNode = methods.nodes.runtime_instanceClassNode;
					runtime_instanceClassPrototype = methods.nodes.runtime_instanceClassPrototype;
					runtime_instanceShellPrototype = methods.nodes.runtime_instanceShellPrototype;
					runtime_loadedAsNamespace = methods.nodes.runtime_loadedAsNamespace;
					runtime_markWritten = methods.nodes.runtime_markWritten;
					runtime_moduleInheritance = methods.nodes.runtime_moduleInheritance;
					runtime_moduleObjectKeys = methods.nodes.runtime_moduleObjectKeys;
					runtime_moduleObjectOf = methods.nodes.runtime_moduleObjectOf;
					runtime_nodePrimitive = methods.nodes.runtime_nodePrimitive;
					runtime_originalAccessor = methods.nodes.runtime_originalAccessor;
					runtime_prototypeCheckedBy = methods.nodes.runtime_prototypeCheckedBy;
					runtime_prototypeForHolder = methods.nodes.runtime_prototypeForHolder;
					runtime_prototypeForReader = methods.nodes.runtime_prototypeForReader;
					runtime_prototypeGiven = methods.nodes.runtime_prototypeGiven;
					runtime_prototypeOnSharedValue = methods.nodes.runtime_prototypeOnSharedValue;
					runtime_recordFunctionNode = methods.nodes.runtime_recordFunctionNode;
					runtime_reportsWritable = methods.nodes.runtime_reportsWritable;
					runtime_sealedShellPrototype = methods.nodes.runtime_sealedShellPrototype;
					runtime_unclassedInstancePrototype = methods.nodes.runtime_unclassedInstancePrototype;
					runtime_valueOfFor = methods.nodes.runtime_valueOfFor;
					runtime_withheldPrototype = methods.nodes.runtime_withheldPrototype;
					runtime_wrapperClassPrototype = methods.nodes.runtime_wrapperClassPrototype;
					enforcePermission = methods.rules.enforcePermission;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					NO_STORED_VALUE = methods.rules.NO_STORED_VALUE;
					rulesShared = methods.rules.rulesShared;
					runtime_accessAsKept = methods.rules.runtime_accessAsKept;
					runtime_arrayKeyHolder = methods.rules.runtime_arrayKeyHolder;
					runtime_assertOwnedWrite = methods.rules.runtime_assertOwnedWrite;
					runtime_bindCapturedIdentity = methods.rules.runtime_bindCapturedIdentity;
					runtime_canDefine = methods.rules.runtime_canDefine;
					runtime_defineOnSealedShell = methods.rules.runtime_defineOnSealedShell;
					runtime_describeImplMember = methods.rules.runtime_describeImplMember;
					runtime_enforceCodeMember = methods.rules.runtime_enforceCodeMember;
					runtime_enforceReadGate = methods.rules.runtime_enforceReadGate;
					runtime_fixedDescriptor = methods.rules.runtime_fixedDescriptor;
					runtime_gateDataNodeMember = methods.rules.runtime_gateDataNodeMember;
					runtime_gateFixedValue = methods.rules.runtime_gateFixedValue;
					runtime_gateNodeValue = methods.rules.runtime_gateNodeValue;
					runtime_hasOwnMember = methods.rules.runtime_hasOwnMember;
					runtime_implAccessor = methods.rules.runtime_implAccessor;
					runtime_memberHoldsCode = methods.rules.runtime_memberHoldsCode;
					runtime_onImpl = methods.rules.runtime_onImpl;
					runtime_pinReader = methods.rules.runtime_pinReader;
					runtime_placingTrap = methods.rules.runtime_placingTrap;
					runtime_readAsReader = methods.rules.runtime_readAsReader;
					runtime_readImplMember = methods.rules.runtime_readImplMember;
					runtime_refuseFixedObjectDefinition = methods.rules.runtime_refuseFixedObjectDefinition;
					runtime_shellValue = methods.rules.runtime_shellValue;
					runtime_takeAccess = methods.rules.runtime_takeAccess;
					runtime_takeCapturedAccess = methods.rules.runtime_takeCapturedAccess;
					runtime_withRestartForwarding = methods.rules.runtime_withRestartForwarding;
					runtime_writeImplMember = methods.rules.runtime_writeImplMember;
					runtime_writeModuleObject = methods.rules.runtime_writeModuleObject;
					runShared = methods.run.runShared;
					runtime_checkpointFile = methods.run.runtime_checkpointFile;
					runtime_checkpointHandout = methods.run.runtime_checkpointHandout;
					runtime_checkpointPrototypeHandout = methods.run.runtime_checkpointPrototypeHandout;
					runtime_checkpointSettled = methods.run.runtime_checkpointSettled;
					runtime_guardPromotedResult = methods.run.runtime_guardPromotedResult;
					runtime_inRunTree = methods.run.runtime_inRunTree;
					runtime_markRunTreeHeld = methods.run.runtime_markRunTreeHeld;
					runtime_ownRunTreeArray = methods.run.runtime_ownRunTreeArray;
					runtime_readTargetFailure = methods.run.runtime_readTargetFailure;
					runtime_recordedPrototype = methods.run.runtime_recordedPrototype;
					runtime_runAfterPrincipalGate = methods.run.runtime_runAfterPrincipalGate;
					runtime_runAroundPipeline = methods.run.runtime_runAroundPipeline;
					runtime_runTreeHiddenFrom = methods.run.runtime_runTreeHiddenFrom;
					runtime_runTreeHides = methods.run.runtime_runTreeHides;
					runtime_runTreeHolds = methods.run.runtime_runTreeHolds;
					runtime_snapshotBarrier = methods.run.runtime_snapshotBarrier;
					runtime_snapshotPrototype = methods.run.runtime_snapshotPrototype;
					runtime_takeRunWrite = methods.run.runtime_takeRunWrite;
					runtime_wrapOnSet = methods.run.runtime_wrapOnSet;
					unwrapError = methods.run.unwrapError;
					hasOwn = methods.views.hasOwn;
					INTRINSIC_HAS_INSTANCE = methods.views.INTRINSIC_HAS_INSTANCE;
					NODE_MEMBER = methods.views.NODE_MEMBER;
					runtime_behindMemberView = methods.views.runtime_behindMemberView;
					runtime_builtinBehind = methods.views.runtime_builtinBehind;
					runtime_capturedReader = methods.views.runtime_capturedReader;
					runtime_emitterOwnPrototype = methods.views.runtime_emitterOwnPrototype;
					runtime_functionOf = methods.views.runtime_functionOf;
					runtime_hasInstanceOf = methods.views.runtime_hasInstanceOf;
					runtime_hasOwnSymbolMember = methods.views.runtime_hasOwnSymbolMember;
					runtime_ownInstances = methods.views.runtime_ownInstances;
					runtime_readsEngineProto = methods.views.runtime_readsEngineProto;
					runtime_selfIsMethodNode = methods.views.runtime_selfIsMethodNode;
					runtime_selfModuleReader = methods.views.runtime_selfModuleReader;
					runtime_takeInvariantRead = methods.views.runtime_takeInvariantRead;
					runtime_unwrapSelfView = methods.views.runtime_unwrapSelfView;
					SELF_INSTANCE_NODES = methods.views.SELF_INSTANCE_NODES;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					SERIALIZERS = methods.views.SERIALIZERS;
					runtime_behindGivenView = methods.membrane.runtime_behindGivenView;
					runtime_constructAsNode = methods.membrane.runtime_constructAsNode;
					runtime_crossArguments = methods.membrane.runtime_crossArguments;
					runtime_functionNodeFor = methods.membrane.runtime_functionNodeFor;
					runtime_functionNodePrototype = methods.membrane.runtime_functionNodePrototype;
					runtime_givenPrototypeFor = methods.membrane.runtime_givenPrototypeFor;
					runtime_givenShellPrototype = methods.membrane.runtime_givenShellPrototype;
					runtime_ownArguments = methods.membrane.runtime_ownArguments;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					runtime_heldValue = methods.root.runtime_heldValue;
					runtime_standInMember = methods.waiting.runtime_standInMember;
					runtime_adoptArrayIntegrity = methods.materialize.runtime_adoptArrayIntegrity;
					runtime_adoptDefinedAccessor = methods.materialize.runtime_adoptDefinedAccessor;
					runtime_adoptObjectIntegrity = methods.materialize.runtime_adoptObjectIntegrity;
					runtime_definedValueNode = methods.materialize.runtime_definedValueNode;
					runtime_definitionFixes = methods.materialize.runtime_definitionFixes;
					runtime_syncArrayIntegrity = methods.materialize.runtime_syncArrayIntegrity;
					createNamedProxyTarget = methods.uw.createNamedProxyTarget;
					findThen = methods.uw.findThen;
					GET_TRAP_ALLOWED_INTERNALS = methods.uw.GET_TRAP_ALLOWED_INTERNALS;
					isAwaitableThen = methods.uw.isAwaitableThen;
					isClassInstance = methods.uw.isClassInstance;
					OBJECT_PROTO_SETTER = methods.uw.OBJECT_PROTO_SETTER;
					registerLeafFile = methods.uw.registerLeafFile;
					reservedKeysOwn = methods.uw.reservedKeysOwn;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					UNLOADED_HAS_INSTANCE = methods.uw.UNLOADED_HAS_INSTANCE;
					WRAPPER_ANSWERED_PROPS = methods.uw.WRAPPER_ANSWERED_PROPS;
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
			createProxy() {
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

				runtime_defineProxyInspect(wrapper, proxyTarget);

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
					// of the node's this read runs (see runtime_runAccessor).
					const kept = runtime_takeCapturedAccess(wrapper);
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
					runtime_followModuleObject(wrapper, target, prop);
					// A member of built-in data or an error the node holds is a read of that value at the node's path.
					runtime_gateDataNodeMember(wrapper, prop, kept, access);
					// Read-level permission gating (default-on; opt out via permissions.gating.read: false).
					// Delegates to the module-level runtime_enforceReadGate — shared with the
					// waiting-proxy resolver so lazy reads are gated identically.
					const enforceReadGate = (resolvedValue) => runtime_enforceReadGate(wrapper, prop, resolvedValue, undefined, kept, access);

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
							!(desc.writable && (runtime_hasOwnMember(wrapper, prop) || Arrays.isArray(wrapperInternal.impl)))
						) {
							// Non-configurable property on target - must return actual value
							// But if it's a function target for callable wrapper, redirect to wrapper
							// No framework-reserved property is ever defined on a function target; defensive redirect.
							/* v8 ignore next 3 */
							if (isFrameworkReservedKey(prop)) {
								return wrapper[prop];
							}
							const fixedValue = target[prop];
							runtime_gateFixedValue(wrapper, prop, fixedValue, kept);
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
					if ((prop === "power" || prop === "add") && this.slothlet.debugLogger) {
						this.slothlet.debug("wrapper", {
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
					const heldPrimitive = runtime_nodePrimitive(wrapper);
					if (heldPrimitive !== NO_NODE_PRIMITIVE && prop !== "then" && prop !== util.inspect.custom && !hasOwn(wrapper, prop)) {
						if (prop === "toJSON") return () => heldPrimitive;
						return runtime_standInMember(heldPrimitive, prop);
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
							if (!runtime_isArrayMember(arrImpl, prop)) {
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
					const fronted = runtime_frontedDataMember(wrapper, prop);
					if (fronted !== NODE_MEMBER) return fronted;
					// #475 / #571: a member whose name collides with a property this trap otherwise answers
					// itself (`name`, `length`, `toString`, …) — a module export, or a folder entry such as
					// `session/name/` — takes the ordinary child path below: reachable, and read-gated like any
					// other member. Without this the wrapper's own answer (the api-path name, the impl's arity,
					// …) shadowed the member and skipped enforcement entirely. Only those names and `then` consult it,
					// so any other read skips the lookup.
					const memberShadowsWrapperProp =
						(prop === "then" || SetMethods.has(WRAPPER_ANSWERED_PROPS, prop)) &&
						(runtime_hasOwnMember(wrapper, prop) || runtime_valueHoldsName(wrapper, prop));
					if (prop === "then") {
						// An unmaterialized lazy wrapper is thenable the same way its waiting proxies are: `await`
						// means "load now". Resolving with the proxy itself keeps the awaited value identical to
						// every later access, so enumeration cannot race a fire-and-forget materialization and
						// answer with a partial surface. A materialized wrapper stays non-thenable, so awaits on
						// settled values remain pass-throughs rather than re-entrant loads.
						if (wrapperInternal.mode === "lazy" && !wrapperInternal.state.materialized) {
							// A node that loads as a primitive resolves with the value, as an `await` of the value does, and is a
							// read of the node for whoever awaits it (#797).
							const pinned = runtime_pinReader(wrapper, access);
							return (onFulfilled, onRejected) =>
								PromiseMethods.catch(
									PromiseMethods.then(wrapper.___materialize(), () => {
										const held = runtime_nodePrimitive(wrapper);
										if (held === NO_NODE_PRIMITIVE) return onFulfilled(wrapperInternal.proxy);
										if (pinned) runtime_gateNodeValue(wrapper, kept, null, pinned);
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
							runtime_functionOf(protoImpl) === null &&
							!util.types.isProxy(protoImpl) &&
							isClassInstance(protoImpl) &&
							runtime_readsEngineProto(protoImpl)
						) {
							return reportedPrototype(target, () => kept);
						}
						// A namespace slothlet composed answers the prototype it reports too, unless the prototype it has holds a
						// `__proto__` member of its own, or it has none to inherit the accessor from.
						// So does a function node given another prototype; one keeping its function's reads it as the function does, below.
						if (protoImpl !== null && (typeof protoImpl === "object" || typeof protoImpl === "function") && !hasOwn(wrapper, prop)) {
							const from = runtime_inheritsFrom(wrapper, prop);
							if (
								from !== undefined &&
								from !== null &&
								!util.types.isProxy(from) &&
								(typeof protoImpl === "object" || runtime_prototypeGiven(wrapper)) &&
								runtime_readsEngineProto(from)
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
							const fnConstructor = runtime_functionMember(wrapper, constructorImpl, prop);
							const inherited = runtime_inheritedEngineMember(constructorImpl, prop, fnConstructor);
							if (inherited) return inherited.value;
							runtime_enforceCodeMember(wrapper, fnConstructor, kept);
							return fnConstructor;
						}
						// An instance of a class a node fronts answers that node, as the instance answers its class (#667): the reader
						// gets the class as a read of the node gives it.
						const exportedClass = runtime_exportedInstanceClass(wrapper);
						if (exportedClass !== null) return runtime_functionNodeFor(wrapper, exportedClass);
						const constructorIsLiveIdentity = internal.deferChildAdopt || (EventEmitter && runtime_inherits(constructorImpl, EventEmitter));
						if (constructorIsLiveIdentity && constructorImpl && typeof constructorImpl === "object" && constructorImpl.constructor) {
							// A class of the module's is its code, checked as a call of the node (#632).
							const liveConstructor = constructorImpl.constructor;
							runtime_enforceCodeMember(wrapper, liveConstructor, kept);
							return liveConstructor;
						}
						// An instance of a class of the module's that no node fronts (the module keeps the class to itself) answers
						// its class as a member of the instance's node, as `__proto__` gives its prototype (#667): read through
						// that node, the class's `prototype` and methods stay behind the node's checks.
						const instanceClass = runtime_instanceClassNode(wrapper);
						if (instanceClass !== null) return instanceClass;
						// A `constructor` its prototype answers through an accessor of the module's is read as any accessor member
						// is, run as the module (#597): the class it answers is handed out as above, as the plain instance answers it.
						const constructorAccessor =
							constructorImpl !== null && typeof constructorImpl === "object" && !Arrays.isArray(constructorImpl)
								? runtime_implAccessor(wrapper, prop)
								: null;
						if (constructorAccessor?.descriptor) {
							const answered = runtime_readImplMember(wrapper, prop);
							if (answered === null || (typeof answered !== "object" && typeof answered !== "function")) return answered;
							if (typeof answered !== "function") return wrapper.___createChildWrapper(prop, answered) ?? answered;
							if (nodeRefOf(FUNCTION_NODES, wrapper.slothlet, answered) !== undefined) return runtime_functionNodeFor(wrapper, answered);
							return runtime_instanceClassNode(wrapper, answered) ?? answered;
						}
						// A namespace given another prototype reads its `constructor` from there, through the member read below.
						const constructorFrom = runtime_inheritsFrom(wrapper, prop);
						if (constructorFrom === undefined || constructorFrom === Objects.prototype) return NativeObject;
					}
					if (prop === util.inspect.custom) {
						// What the node shows to `util.inspect` (see runtime_inspectShown): the same as its target's own hook.
						return (...args) => runtime_inspectShown(wrapper, args);
					}
					if (prop === Symbol.toStringTag) {
						// Return "Object" for object exports, "Function" for function exports
						const impl = wrapperInternal.impl;
						// A built-in data object answers the tag the language gives its kind (`Map`, `Set`, a typed array's), as it
						// does itself; one whose kind has none (a date) answers "Object", as a Proxy of it does.
						if (runtime_dataKind(impl) !== null) {
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
						const fnImpl = runtime_functionOf(impl);
						if (fnImpl && !runtime_hasOwnSymbolMember(wrapper, prop)) {
							// A `Symbol.hasInstance` the function inherits from a class of the module's (a base class's own static) is
							// that class's code, which `instanceof` asks as it asks it on the plain function (#667); it is handed out
							// as a static method is, so reading it is checked as a call of the node (#632).
							const inherited = Reflect.get(fnImpl, prop, fnImpl);
							if (typeof inherited === "function" && inherited !== INTRINSIC_HAS_INSTANCE) {
								runtime_enforceCodeMember(wrapper, inherited, kept);
								return inherited;
							}
							return runtime_hasInstanceOf(fnImpl);
						}
					}
					// A symbol the module's value holds as its own key is a member, as in plain JS (`obj[sym]`); any other
					// symbol is not one, and the wrapper has no answer of its own for it.
					// One the node inherits from a prototype set on it is read below, as a member by any other key is.
					if (typeof prop === "symbol" && !runtime_hasOwnSymbolMember(wrapper, prop) && !runtime_inheritsSymbol(wrapper, prop))
						return undefined;
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
						const fnImpl = runtime_functionOf(impl);
						if (!fnImpl) return undefined;
						const prototype = fnImpl.prototype;
						runtime_enforceCodeMember(wrapper, prototype, kept);
						return runtime_prototypeForReader(wrapper, runtime_exposePrototype(wrapper, prototype), "prototype");
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
						const fnImpl = runtime_functionOf(impl);
						if (fnImpl) {
							const method = runtime_functionMember(wrapper, fnImpl, prop);
							// A function given a prototype without one has none, as the plain function then has.
							if (typeof method !== "function") return method;
							runtime_enforceCodeMember(wrapper, method, kept);
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
						const fnImpl = runtime_functionOf(impl);
						if (fnImpl) {
							const method = runtime_functionMember(wrapper, fnImpl, prop);
							const inherited = runtime_inheritedEngineMember(fnImpl, prop, method);
							if (inherited) return runtime_valueOfFor(wrapperInternal.proxy);
							if (typeof method !== "function") return method;
							runtime_enforceCodeMember(wrapper, method, kept);
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
						// and, through a view a module kept, for that module too (see runtime_capturedView).
						if (impl && typeof impl.toJSON === "function") {
							const method = impl.toJSON;
							runtime_enforceCodeMember(wrapper, method, kept);
							const path = wrapperInternal.apiPath;
							const serializeOwn = (readers, ___node, keptAccess = kept, args = []) =>
								runtime_redactToJSONResult(wrapper, Reflect.apply(method, impl, args), path, readers, keptAccess);
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
									return { value: holder.createProxy()[key] };
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
							const pm = wrapper.slothlet.handlers?.permissionManager;
							if (pm && pm.isEnabled() && pm.isReadGatingEnabled()) {
								let redacted = data;
								for (let r = 0; r < readers.length; r++) {
									const reader = readers[r];
									redacted = runtime_redactSerialized(wrapper, redacted, wrapperInternal.apiPath, node, new WeakSet(), reader, kept);
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
						!runtime_runTreeHolds(wrapper, prop)
					) {
						const liveImpl = wrapperInternal.impl;
						if (liveImpl !== null && (typeof liveImpl === "object" || typeof liveImpl === "function") && prop in liveImpl) {
							const cachedDesc = Objects.getOwnPropertyDescriptor(wrapper, prop);
							// Read as the module's own read of it (#597): a getter on the impl is the module's code.
							const current = runtime_readImplMember(wrapper, prop);
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
							this.slothlet.debug("wrapper", {
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
						this.slothlet.debug("wrapper", {
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
						if (_cachedWrapper && runtime_holdsValue(_cachedWrapper)) {
							const cachedValue = runtime_heldValue(_cachedWrapper);
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
							const proxied = runtime_readImplMember(wrapper, prop);
							// A layer hands a method of the value under it out bound to that value: the method is what decides, so
							// a built-in's (a Map's `get`) is the language's, not the module's.
							runtime_enforceCodeMember(wrapper, layerMethodOriginal(proxied) ?? proxied, kept);
							return proxied;
						}

						// For regular objects/functions, check wrapper children or ____impl properties
						// (reserved names never reach here — see `isInternalProp` above)
						// In tests, wrapper never holds a prop directly via hasOwn; the true-branch body is never entered.
						/* v8 ignore start */
						if (hasOwn(wrapper, prop)) {
							if (prop === "power" || prop === "add") {
								this.slothlet.debug("wrapper", {
									key: "DEBUG_MODE_GET_PROXYGET_ACCESSING",
									prop,
									wrapperId: wrapperInternal.id,
									apiPath: wrapper.apiPath,
									collisionMode: wrapperInternal.state.collisionMode || "none"
								});
								this.slothlet.debug("wrapper", {
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
								!runtime_implHas(wrapper, wrapperInternal.impl, prop))) &&
						runtime_moduleInheritance(wrapper, prop) === null
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

						this.slothlet.debug("wrapper", {
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
							return runtime_readImplMember(wrapper, prop);
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
						return runtime_readImplMember(wrapper, prop);
					}
					/* v8 ignore stop */

					// Check if the property exists on impl before caching
					// This handles property descriptors (getters) correctly
					// impl is always set when this get trap is reached; the : undefined fallback is never taken.
					// An array member's value was read once already, by the array block above.
					/* v8 ignore next */
					// An accessor the impl holds that adoption did not put on the wrapper — one on an object assigned through
					// the api, or inherited — runs as the module the node belongs to, never as whoever reads it (#597).
					let value = arrayElement ? arrayElement.value : wrapperInternal.impl ? runtime_readImplMember(wrapper, prop) : undefined;
					// A member the node inherits from its own prototype, or the module's object inherits from its, stays inherited:
					// read as a member of the node is, and never kept as one of the node's own (#913).
					const inheritedImpl = wrapperInternal.impl;
					const isInherited =
						value !== undefined &&
						!arrayElement &&
						(runtime_inheritsFrom(wrapper, prop) !== undefined ||
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
					if (runtime_dataKind(value) !== null || runtime_isErrorValue(value)) {
						return value;
					}
					/* v8 ignore stop */

					// Return custom Proxy objects directly without wrapping
					// Custom proxies (like LGTVControllers) need direct access for array indices and special get traps
					// Wrapping them breaks array access patterns like proxy[0]
					// A Proxy a function node holds as a member of its function is the module's code like any other such member, and
					// is checked as a call of the node before it is handed out (#632).
					if (value && typeof value === "object" && util.types.isProxy(value)) {
						runtime_enforceCodeMember(wrapper, value, kept);
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
						const inherited = runtime_inheritedEngineMember(currentImpl, prop, value);
						if (inherited) return inherited.value;
						// A member inherited from a prototype given to the node is no part of the module's function: it is read as
						// a member of the node is, below.
						if (!isInherited || !runtime_prototypeGiven(wrapper)) {
							runtime_enforceCodeMember(wrapper, value, kept);
							return value;
						}
					}
					// The same holds for an object node: a member it inherits from the engine (`hasOwnProperty`,
					// `__lookupGetter__`, `valueOf`, … from `Object.prototype`) is the object's own surface, not a child
					// endpoint. Wrapping one listed it among the node's keys and gave it an api path, where a `__`-prefixed
					// name read as a module-private export and was denied with permissions on (#630). A member of a class
					// the module wrote is still the module's, and stays a child.
					if (currentImpl !== null && typeof currentImpl === "object") {
						const inherited = runtime_inheritedEngineMember(currentImpl, prop, value);
						if (inherited) return inherited.value;
						// A built-in data object keeps what it holds out of its own listing as plain JavaScript does: a member it holds
						// non-enumerable (an error's `cause`, an aggregate error's `errors`) is read from it as data, not made a child
						// node, which `Object.keys()` would then list.
						if (
							runtime_holdsDataKind(currentImpl) &&
							hasOwn(currentImpl, prop) &&
							!FunctionMethods.call(PrototypeFunctions.Object.propertyIsEnumerable, currentImpl, prop)
						) {
							runtime_enforceCodeMember(wrapper, value, kept);
							return value;
						}
					}

					// A function member that is this node's own function, or an ancestor's, is that node, as in plain JS: it closes
					// the cycle where a new node below would open another level on every read.
					const cycle = runtime_cycleNode(wrapper, value);
					if (cycle !== null) return cycle.createProxy();

					// An inherited member read before with the same value is the node made for it then (#913).
					if (isInherited) {
						const held = runtime_inheritedMemberNode(wrapper, prop, value);
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
					if (wrapped && isInherited) return runtime_keepInheritedMemberNode(wrapper, prop, value, wrapped);
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
					// An identity handed over for this call (see runtime_applyWithEntry) is taken once, as the trap starts, before
					// any code this call runs. One handed for another node's call is dropped: it reaches no call made later.
					let ___handed = null;
					if (rulesShared.handedEntry !== null) {
						if (rulesShared.handedEntry.wrapper === wrapper) ___handed = rulesShared.handedEntry.entry;
						rulesShared.handedEntry = null;
					}
					// A node a module kept, calling through this one, says who it calls for: taken first, before any code this
					// call runs (`this`, its arguments) could take it, and handed to this call's own gate (#661).
					const kept = runtime_takeCapturedAccess(wrapper);
					if (wrapperInternal.invalid) {
						// apiPath is always set on constructed wrappers; the || "api" fallback is never reached.
						/* v8 ignore next */
						throw new TypeError(`${wrapperInternal.apiPath || "api"} is invalidated`);
					}
					// What another module or the host passes in reaches this one through the class prototype guard, so what this
					// module stores into it reaches the caller the same way. Done first, on the arguments as the caller holds them.
					if (!___gatePassed) args = runtime_crossArguments(wrapper, args);
					// A function or Proxy this module handed out comes back to it as itself (#597), and so does an instance of its
					// own class the async runtime wrapped (#328).
					if (!___gatePassed) args = runtime_ownInstances(wrapper, runtime_ownArguments(wrapper, args));

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
							(EventEmitter && runtime_inherits(thisArgImpl, EventEmitter)) ||
							isClassInstance(thisArgImpl));
					// A view `self` handed out is swapped for the value only when it is the method's own module's view of
					// the node the method was read from. A view of any other node a caller steers the method onto
					// (`.call()` / `.apply()`) stays the caller's view, whose writes are held to the caller (#625): the
					// value itself would let any module write another module's instance through a method of its own.
					// A node of a run's tree that holds members the run gave it over its live value stays the receiver, so the method
					// reads and writes the run's copy (see runtime_runTreeHolds), as a method called on a copy works on the copy.
					const thisArgIsOwnIdentity =
						thisArgIsLiveIdentity &&
						thisArgWrapper.____slothletInternal.runHeldKeys === undefined &&
						thisArgWrapper.____slothletInternal.runHiddenKeys === undefined &&
						(!WeakMapMethods.has(SELF_VIEW_NODES, thisArg) || runtime_selfIsMethodNode(thisArg, wrapper));
					const effectiveThisArg = thisArgIsOwnIdentity ? thisArgImpl : thisArg;
					// A method running on the value itself changes it where no trap sees it: the node is saved first for the runs
					// open (see helpers/run-snapshot).
					if (thisArgIsOwnIdentity && anyRunOpen()) runtime_snapshotBarrier(thisArgWrapper);
					// The value stands for its node when it comes back through `self` (#625).
					if (thisArgIsOwnIdentity) WeakMapMethods.set(SELF_INSTANCE_NODES, thisArgImpl, runtime_unwrapSelfView(thisArg));

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
							return runtime_runAfterPrincipalGate(wrapper, ___principalGate, () => applyTrap(target, thisArg, args, true, ___entry));
						}
					}
					const ___entryIdentity = ___entry?.identity ? ___entry : null;

					// Get hook manager if available
					const hookManager = wrapper.slothlet.handlers?.hookManager;
					// Early exit if hooks disabled globally or this is a hook API function
					const hasHooks = hookManager && hookManager.enabled && !StringMethods.startsWith(wrapperInternal.apiPath, "slothlet.hook");

					// Get api (bound API) and ctx (user context) for hooks
					const api = wrapper.slothlet.boundApi;
					const ctx = wrapper.slothlet.config?.context || {};

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
								return runtime_runAroundPipeline(
									wrapper,
									hookManager,
									___arounds,
									___strategy,
									effectiveThisArg,
									args,
									api,
									ctx,
									___entryIdentity
								);
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
										raw = wrapper.slothlet.contextManager
											? wrapper.slothlet.contextManager.runInContext(
													wrapper.instanceID,
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
										raw = wrapper.slothlet.contextManager
											? wrapper.slothlet.contextManager.runInContext(
													wrapper.instanceID,
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
										throw new wrapper.SlothletError("API_PATH_NOT_CALLABLE", { path: segmentsOf(___path), received: typeof impl });
									}
									settled = raw && typeof raw === "object" && typeof raw.then === "function" ? await raw : raw;
								} catch (error) {
									// Target failure: same error-hook + suppression semantics as the sync path. Read as the target (#599).
									const failure = runtime_readTargetFailure(wrapper, error);
									const originalError = failure.originalError();
									// The processed marker stops DUPLICATE error hooks for a failure an inner
									// hooked call already reported — it says nothing about `always`, which is a
									// per-call observer the sync path runs unconditionally from its `finally`.
									// Reachable: an outer target that re-raises the inner call's marked original
									// (rather than the context wrapper around it) lands here with the marker set.
									if (!isHookProcessed(error)) {
										const sourceInfo = failureSource({ type: "function", at: wrapper.clock.now() }, failure);
										hookManager.executeErrorHooks(___path, originalError, sourceInfo, args, api, ctx);
									}
									hookManager.executeAlwaysHooks(___path, args, undefined, true, [originalError], api, ctx);
									if (wrapper.slothlet.config?.hook?.errors === "suppress") return undefined;
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
							return ___leafIsAsync ? ___promotedRun : runtime_guardPromotedResult(___promotedRun, ___path, wrapper.SlothletError);
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
												if (wrapper.slothlet.contextManager) {
													// rawErrors: a leaf's throw is application data — never re-typed (#252).
													resolve(
														wrapper.slothlet.contextManager.runInContext(
															wrapper.instanceID,
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
															wrapper.instanceID,
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
													new wrapper.slothlet.SlothletError("API_PATH_NOT_CALLABLE", {
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
											new wrapper.slothlet.SlothletError("LAZY_MATERIALIZATION_FAILED", {
												path: segmentsOf(wrapperInternal.apiPath)
											})
										);
										return;
										/* v8 ignore stop */
									}
									scheduleMacrotask(checkMaterialized, undefined, wrapper.clock);
								};
								checkMaterialized();
							});
						}

						// Execute the actual function
						const impl = wrapperInternal.impl;

						if (typeof impl === "function") {
							if (wrapper.slothlet.contextManager) {
								// rawErrors: a leaf's throw is application data — never re-typed (#252).
								result = wrapper.slothlet.contextManager.runInContext(
									wrapper.instanceID,
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
							if (wrapper.slothlet.contextManager) {
								// rawErrors: a leaf's throw is application data — never re-typed (#252).
								result = wrapper.slothlet.contextManager.runInContext(
									wrapper.instanceID,
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
							throw new wrapper.SlothletError("API_PATH_NOT_CALLABLE", {
								path: segmentsOf(wrapperInternal.apiPath),
								received: typeof impl
							});
						}

						// Check if result is a Promise (async function). A promise of the engine's own is reacted to with the language's
						// `then`, as `await` reacts to it, so a `then` module code put on `Promise.prototype` never sees it.
						const enginePromise = runtime_isEnginePromise(result);
						if (enginePromise || (result && typeof result === "object" && typeof result.then === "function")) {
							// Mark as async so finally block skips always hooks (we handle them in the promise chain)
							isAsync = true;
							// With no hook to run and no error to suppress, a reaction would hand on what the call settles with as it is.
							// A promise the runtime made for the call already settles that way, with the `Promise` taken at load: it is
							// handed on as it is.
							if (
								enginePromise &&
								!hasHooks &&
								wrapper.slothlet.config?.hook?.errors !== "suppress" &&
								wrapper.slothlet.contextManager?.ownsResult?.(result)
							)
								return result;
							// Async result - attach hooks to Promise chain. A hand-written thenable is reacted to as `await`
							// would, so a reaction that throws never surfaces at its own `then`'s call site.
							// The reactions run as the call's caller, which the runtime resolved when the call was entered.
							return (
								enginePromise
									? FunctionMethods.bind(pinnedResultThen, null, result)
									: runtime_inherits(result, Promise)
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
											const sourceInfo = failureSource({ type: "after", at: wrapper.clock.now() }, hookManager.failureOf(error));
											// The after chain reports its own hook's failure; this reports only what it did not.
											if (!hookReported && !isHookProcessed(error)) {
												hookManager.executeErrorHooks(wrapperInternal.apiPath, originalError, sourceInfo, args, api, ctx);
											}
											hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, undefined, true, [originalError], api, ctx);
										}

										// Check if errors should be suppressed
										const suppressErrors = wrapper.slothlet.config?.hook?.errors === "suppress";
										if (suppressErrors) {
											return undefined;
										}

										throw error;
									}
								},
								(error) => {
									// Async function error, classified as the target before anything reads it (#599)
									if (hasHooks) {
										const failure = runtime_readTargetFailure(wrapper, error);
										const originalError = failure.originalError();
										if (!isHookProcessed(error)) {
											const sourceInfo = failureSource({ type: "function", at: wrapper.clock.now() }, failure);
											hookManager.executeErrorHooks(wrapperInternal.apiPath, originalError, sourceInfo, args, api, ctx);
										}
										// Always hooks execute for rejected promises
										hookManager.executeAlwaysHooks(wrapperInternal.apiPath, args, undefined, true, [originalError], api, ctx);
									}

									// Check if errors should be suppressed
									const suppressErrors = wrapper.slothlet.config?.hook?.errors === "suppress";
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
						const targetFailure = hasHooks && !hookReported ? runtime_readTargetFailure(wrapper, error) : null;
						if (targetFailure && !isHookProcessed(error)) {
							const sourceInfo = failureSource({ type: "function", at: wrapper.clock.now() }, targetFailure);
							hookManager.executeErrorHooks(wrapperInternal.apiPath, targetFailure.originalError(), sourceInfo, args, api, ctx);
						}

						// Check if errors should be suppressed
						const suppressErrors = wrapper.slothlet.config?.hook?.errors === "suppress";
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
					runtime_takeCapturedAccess(wrapper);
					runtime_followModuleObject(wrapper, target, prop);
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
					if (Arrays.isArray(arrayImpl) && runtime_isArrayIndex(prop)) {
						// A non-extensible target pins the answer to its own keys (proxy invariant), which is the
						// array it was built over once a reload has replaced the impl.
						if (!Reflect.isExtensible(target)) return Reflect.has(target, prop);
						return prop in arrayImpl || runtime_isFixedOnTarget(target, prop);
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
						(runtime_onImpl(wrapper, (impl) => runtime_implHas(wrapper, impl, prop)) || runtime_moduleInheritance(wrapper, prop) !== null)
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
					const engineCheck = runtime_takeInvariantRead(wrapper, prop);
					// A node a module kept, describing a member through this one, says who it reads for: taken first, before
					// any code this description runs could take it, and handed to every gate it makes (#661).
					const kept = runtime_takeCapturedAccess(wrapper);
					if (!engineCheck) runtime_followModuleObject(wrapper, target, prop);
					// What this description reads through the node itself, read for that reader too.
					const readNode = () =>
						kept
							? runtime_accessAsKept(wrapper, kept.reader, () => wrapper.____slothletInternal.proxy[prop])
							: wrapper.____slothletInternal.proxy[prop];
					// A view asking for this member as it is held (runtime_describeAsHeld): taken now, for this read only.
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
							const reader = runtime_capturedReader(wrapper);
							// A sealed node's hook is fixed on its shell, which the invariants require the node to report as is.
							if (!reader || !hookDescriptor.configurable) return hookDescriptor;
							const hook = hookDescriptor.value;
							return {
								__proto__: null,
								...hookDescriptor,
								value: function (...args) {
									// Shown as to a module, whoever calls the copy later: it never hands out the module's code (#632).
									const shown = Arrays.isArray(target) ? Reflect.apply(hook, this, args) : runtime_inspectShown(wrapper, args, true);
									if (shown === null || typeof shown !== "object") return shown;
									const completed = Arrays.isArray(shown) ? [] : {};
									for (let ofIndex = 0, ofList = Objects.keys(shown); ofIndex < ofList.length; ofIndex++) {
										const key = ofList[ofIndex];
										completed[key] = runtime_readAsReader(wrapper, key, shown[key], reader);
									}
									if (Arrays.isArray(shown)) completed.length = shown.length;
									return completed;
								}
							};
						}
					}

					// A module may freeze or seal its own array after the node was read; the node reports what the array is.
					runtime_syncArrayIntegrity(wrapper, target);
					// A sealed node holds its members on its shell (see preventExtensions). A writable member's value is not
					// pinned there, so it is described as the node reads it now, through the read gate.
					if (!Reflect.isExtensible(target)) {
						const sealed = Reflect.getOwnPropertyDescriptor(target, prop);
						if (sealed && "value" in sealed && sealed.writable && prop !== "length") {
							// A value the caller may not read is withheld, as the invariants allow for a writable member: the key
							// must still be described, and sealing or freezing the node needs only its attributes.
							if (redact && runtime_isReadRedacted(wrapper, prop, kept, access)) return { __proto__: null, ...sealed, value: undefined };
							// So is a member of the function's own holding the module's code, to a caller that may not call the node
							// (#825): an open node leaves it out of its description, which a sealed node may not.
							// A view mirroring the member asks for it as held: a writable member's value is not pinned, so it is withheld
							// there too.
							if (redact && !hasOwn(wrapper, prop) && runtime_functionOf(wrapper.____slothletInternal.impl) !== null) {
								const implDescriptor = runtime_onImpl(wrapper, (impl) =>
									prop in impl ? Objects.getOwnPropertyDescriptor(impl, prop) : null
								);
								if (implDescriptor !== null && runtime_isCodeMemberWithheld(wrapper, implDescriptor, kept))
									return { __proto__: null, ...sealed, value: undefined };
							}
							return { __proto__: null, ...sealed, value: readNode() };
						}
						if (sealed && prop === "length" && Arrays.isArray(wrapper.____slothletInternal.impl) && sealed.writable) {
							return { __proto__: null, ...sealed, value: wrapper.____slothletInternal.impl.length };
						}
						return engineCheck ? sealed : runtime_fixedDescriptor(wrapper, prop, sealed, asHeld, kept);
					}

					// An array-backed wrapper describes its array as it is now (#602): an index it no longer holds
					// is absent even when an element wrapper is still cached for it, and `length` is the array's.
					// The proxy target is the array the wrapper was built over, which a reload replaces, so its own
					// fixed keys keep their invariant-required form, carrying the current value where writable.
					const arrayImpl = wrapper.____slothletInternal.impl;
					// Every member is described this way, a named or symbol-keyed one as much as an element (#603 review).
					if (Arrays.isArray(arrayImpl) && (prop === "length" || runtime_isArrayMember(arrayImpl, prop))) {
						// An element a caller may not read is not described to it, as ownKeys leaves it out (#609); one
						// fixed on the shell must still be described, with its value withheld.
						const withheld = redact && prop !== "length" && runtime_isReadRedacted(wrapper, prop, kept, access);
						const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
						// An object element is described by its api node, not the module's object: reading the node is the read
						// the permission rules see, where the raw object would hand every leaf under it to any caller.
						const readThroughNode = (value) =>
							value !== null && (typeof value === "object" || typeof value === "function") ? readNode() : value;
						if (fixed && !fixed.configurable) {
							if (!fixed.writable) return engineCheck ? fixed : runtime_fixedDescriptor(wrapper, prop, fixed, asHeld, kept);
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
							const reader = runtime_capturedReader(wrapper);
							return {
								__proto__: null,
								get: () => runtime_readAsReader(wrapper, prop, node[prop], reader),
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
					if (ownDesc?.configurable && (prop === "length" || prop === "name") && runtime_loadedAsNamespace(wrapper)) ownDesc = undefined;
					if (redact && (!ownDesc || ownDesc.configurable) && runtime_isReadRedacted(wrapper, prop, kept, access)) {
						return undefined;
					}

					// The function target's own `name` / `length` are configurable, so a member by that name
					// (`tool/name/`) is described as the member, as the get trap reads it (#571).
					if (ownDesc && !(ownDesc.configurable && runtime_hasOwnMember(wrapper, prop))) {
						// The function's own `length` is described as a read answers it, from the function (the target is a stand-in
						// whose own `length` is not the function's); it is configurable on the target, so the invariants allow it.
						const fn = runtime_functionOf(wrapper.____slothletInternal.impl);
						if (prop === "length" && fn !== null && ownDesc.configurable && runtime_isBuiltinFunctionMember(wrapper, prop)) {
							return { __proto__: null, ...ownDesc, value: fn.length };
						}
						// The function's own `prototype` is described as a read answers it: the prototype's handle (#667). The target's
						// own is writable, so the invariants allow reporting another value.
						if (prop === "prototype" && fn !== null && "value" in ownDesc && ownDesc.writable && hasOwn(fn, "prototype")) {
							const prototype = fn.prototype;
							if (prototype !== null && typeof prototype === "object" && !runtime_isCodeMemberWithheld(wrapper, { value: prototype }, kept))
								return {
									__proto__: null,
									...ownDesc,
									value: runtime_prototypeForReader(wrapper, runtime_exposePrototype(wrapper, prototype), "prototype")
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
								value: heldNode && runtime_holdsValue(heldNode) ? runtime_heldValue(heldNode) : described.value,
								writable: runtime_reportsWritable(wrapper, prop)
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
						const implDescriptor = runtime_onImpl(wrapper, (impl) => (prop in impl ? Objects.getOwnPropertyDescriptor(impl, prop) : null));
						// A member holding the module's code is described only to a caller that may call the node, as reading it
						// is checked (#632).
						if (implDescriptor !== null && redact && !asHeld && runtime_isCodeMemberWithheld(wrapper, implDescriptor, kept))
							return undefined;
						// A function's own `prototype` is described as a read answers it: the prototype's handle (#667).
						if (
							implDescriptor !== null &&
							prop === "prototype" &&
							"value" in implDescriptor &&
							implDescriptor.value !== null &&
							typeof implDescriptor.value === "object" &&
							runtime_functionOf(wrapper.____slothletInternal.impl) !== null
						) {
							const value = runtime_prototypeForReader(wrapper, runtime_exposePrototype(wrapper, implDescriptor.value), "prototype");
							return virtualizeDescriptor({ __proto__: null, ...implDescriptor, value });
						}
						// A member that is the node's own function, or an ancestor's, is described holding that node, as reading it gives.
						const cycle = implDescriptor && "value" in implDescriptor ? runtime_cycleNode(wrapper, implDescriptor.value) : null;
						if (cycle !== null) return virtualizeDescriptor({ __proto__: null, ...implDescriptor, value: cycle.createProxy() });
						if (implDescriptor !== null) return virtualizeDescriptor(runtime_describeImplMember(wrapper, implDescriptor));
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
					const kept = runtime_takeCapturedAccess(wrapper);
					runtime_followModuleObject(wrapper, target);
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
							if (runtime_isFixedOnTarget(target, key)) SetMethods.add(keys, key);
						}
						for (let ofIndex = 0, ofList = Reflect.ownKeys(wrapper); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							if (!runtime_isArrayIndex(key) && Objects.getOwnPropertyDescriptor(wrapper, key)?.enumerable) SetMethods.add(keys, key);
						}
						for (const key of setValues(keys)) {
							if (!runtime_isFixedOnTarget(target, key) && runtime_isReadRedacted(wrapper, key, kept)) SetMethods.delete(keys, key);
						}
						return setToArray(keys);
					}

					// A function target's own `length` / `name` come first, as on any function. A lazy folder that loaded as a
					// namespace lists none, as the eager node does: its function target only stood in while it loaded.
					const uw_listsAsFunction = typeof target === "function" && !runtime_loadedAsNamespace(wrapper);
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
							? runtime_onImpl(wrapper, (impl) => Reflect.ownKeys(impl))
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
							if (runtime_isReadRedacted(wrapper, key, kept, null, true)) SetMethods.delete(keys, key);
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
					value = runtime_unwrapSelfView(value);
					// A value another module or the host writes onto the node is theirs, handed to this one (#597).
					runtime_markWritten(wrapper, value);
					// An object written after the api was built is data (#826).
					runtime_markAssignedData(wrapper, value);
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						!wrapper.____slothletInternal.state.inFlight
					) {
						wrapper.___materialize();
					}
					// A node of a run's tree changes values the instance's tree shares: what it writes stays on the node itself.
					const runTreeNode = runtime_inRunTree(wrapper);
					if (runTreeNode) runtime_ownRunTreeArray(wrapper);
					// Keys that must not be settable from outside — they shadow private state or are
					// read-only informational accessors whose values come from ____slothletInternal.
					// Silently absorb the write so no TypeError leaks key existence.
					// ___materialize is exempted: the framework writes it directly on the target.
					// Module code meets the write rules first, so an assignment is refused as a definition is (#625).
					if (SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, prop) && prop !== "___materialize") {
						runtime_assertOwnedWrite(wrapper, prop);
						return true;
					}
					// `node.__proto__ = x` on a node fronting a module's own object runs the language's own `__proto__` setter, as
					// the same assignment to the object does (#757): an object or null sets the prototype, through the setPrototypeOf
					// trap and its checks, anything else is ignored. A `__proto__` member the object holds is written as a member.
					if (prop === "__proto__" && !hasOwn(wrapper, prop) && runtime_moduleObjectOf(wrapper) !== null) {
						Reflect.apply(OBJECT_PROTO_SETTER, wrapper.____slothletInternal.proxy, [value]);
						return true;
					}
					// A sealed callable node takes no new member, as a sealed function does not: its members were
					// fixed on the shell when it was sealed, and reflection answers from there.
					if (!Reflect.isExtensible(target) && !hasOwn(target, prop)) return false;
					// A member fixed read-only on a frozen shell takes no write, as on a frozen object: refused before the node's
					// own state changes, so a read of it still answers what the shell holds (#667).
					if (!Arrays.isArray(target) && runtime_isFixedReadOnly(target, prop)) return false;
					// A callable `then` would make the node awaitable (#571), so assigning one is refused; a `then`
					// holding data is an ordinary member and reads back.
					if (prop === "then" && isAwaitableThen({ value })) {
						throw new wrapper.SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
					}
					// A module writes only under the subtree it owns, below the top level of `self` as at it (#625). A
					// framework-reserved key is the framework's own state: the built-in write rules keep modules off it.
					runtime_assertOwnedWrite(wrapper, prop);

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
						if (runtime_isFixedReadOnly(target, prop)) return false;
						// A position at or past a read-only `length` takes no write, as on the array: the shell pins the length.
						if (runtime_isPastFixedLength(target, prop)) return false;
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
						// A full-isolation run's `self` writing the array (see runtime_runWrite): every check above has passed, and the
						// write goes to the run's own copy of the array instead of the module's.
						const runSink = runtime_takeRunWrite(wrapper, prop);
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
						if (isOwnElement && runtime_isPosition(prop)) {
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
							runtime_originalAccessor(ownAccessor).set === ownAccessor.set &&
							runtime_originalAccessor(ownAccessor).get === ownAccessor.get;
						if (ownAccessor && !("value" in ownAccessor) && !forwardsToShared) {
							if (!ownAccessor.set) return false;
							FunctionMethods.call(ownAccessor.set, wrapper.____slothletInternal.proxy ?? wrapper, value);
							return true;
						}
						// A full-isolation run's `self` writing a node of the tree the run reads but does not own yet (see
						// runtime_runWrite): every check above has passed, so the write is stored as the node would store it, in
						// the run's own record instead of on the node. A member the node reports read-only, or a new key the
						// module's object cannot take, refuses it as it would here.
						const runSink = runtime_takeRunWrite(wrapper, prop);
						if (runSink !== null) {
							if (!runtime_reportsWritable(wrapper, prop)) return false;
							const runModuleObject = runtime_moduleObjectOf(wrapper, prop);
							if (runModuleObject !== null && !hasOwn(runModuleObject, prop) && !Reflect.isExtensible(runModuleObject)) return false;
							return runSink({ op: "set", value: runtime_wrapOnSet(wrapper, prop, value) });
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
								(EventEmitter && runtime_inherits(liveImpl, EventEmitter)) ||
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
								const setSucceeded = runtime_writeImplMember(wrapper, prop, value);
								if (!setSucceeded) return false;
								const existingDescriptor = Objects.getOwnPropertyDescriptor(wrapper, prop);
								if (!existingDescriptor || typeof existingDescriptor.set !== "function") {
									Objects.defineProperty(wrapper, prop, {
										__proto__: null,
										get: () => {
											const currentImpl = wrapper.____slothletInternal.impl;
											return currentImpl ? runtime_readImplMember(wrapper, prop) : undefined;
										},
										set: (newValue) => {
											const currentImpl = wrapper.____slothletInternal.impl;
											if (currentImpl) runtime_writeImplMember(wrapper, prop, newValue);
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
									!(EventEmitter && runtime_inherits(wrapper.____slothletInternal.impl, EventEmitter))))
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
								if (!runtime_writeImplMember(wrapper, prop, value)) return false;
								if (hasOwn(wrapper, prop)) delete wrapper[prop];
								return true;
							}
						}

						// A node built from a copy of a module's own object (an exported plain object, or one inside it) writes to
						// that object too, as the same assignment to the object does, so the module's code reads what was written
						// (#746). The object refusing the write (a member it holds read-only) refuses it here, before the node
						// changes. The framework's own writes (the build, a sibling file merged onto the node) change only the node:
						// composing never changes a module's value.
						const ownWrite = wrapper.slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper);
						const moduleObject = ownWrite || runTreeNode ? null : runtime_moduleObjectOf(wrapper, prop);
						if (moduleObject !== null && !runtime_writeModuleObject(wrapper, moduleObject, prop, value)) return false;
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
						const inBuild = wrapper.slothlet.____buildDepth > 0;
						const stored = inBuild ? value : runtime_wrapOnSet(wrapper, prop, value);
						Objects.defineProperty(wrapper, prop, {
							__proto__: null,
							value: stored,
							writable: false,
							enumerable: true,
							configurable: true
						});
						if (runTreeNode) runtime_markRunTreeHeld(wrapper, prop);
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
						!layerHoldsLength && (runtime_isArrayIndex(prop) || prop === "length" || hasOwn(underlying, prop)) ? underlying : arrayImpl;
					const bindsTarget = runtime_bindsTarget(target, holder, prop, descriptor);
					// Both are checked before either changes, so a refusal by one leaves the other as it was.
					if ((bindsTarget && !runtime_canDefine(target, prop, descriptor)) || !runtime_canDefine(holder, prop, descriptor)) return false;
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
						runtime_assertOwnedWrite(wrapper, prop);
						return true; // silently ignore - do not expose the key's existence via TypeError
					}
					// Removing a member is a write to its path: a module removes only under the subtree it owns (#625),
					// and never a framework-reserved key (the built-in write rules).
					runtime_assertOwnedWrite(wrapper, prop);
					// A full-isolation run's `self` removing a member of a node of the tree the run does not own yet (see
					// runtime_runWrite): the removal is kept in the run's own record, and the node keeps the member. A member the node
					// holds fixed refuses it first, as it refuses the removal itself.
					if (
						runShared.RUN_WRITE !== null &&
						runShared.RUN_WRITE.node === wrapper &&
						runShared.RUN_WRITE.prop === prop &&
						runtime_holdsFixed(wrapper, target, prop)
					) {
						runShared.RUN_WRITE = null;
						return false;
					}
					const runSink = runtime_takeRunWrite(wrapper, prop);
					if (runSink !== null) return runSink({ op: "delete" });
					// A node of a run's tree changes its own copy of the array it fronts (see runtime_ownRunTreeArray).
					if (runtime_inRunTree(wrapper)) runtime_ownRunTreeArray(wrapper);

					// An array-backed wrapper's target is the array it was built over: a key fixed there (`length`, a
					// sealed array's index) stays, as it would on that array, and the current array is left as is. So
					// does any key a non-extensible target holds once a reload has put another array in its place: the
					// proxy may not report deleting what that target keeps.
					const arrayImpl = wrapper.____slothletInternal.impl;
					if (Arrays.isArray(arrayImpl) && runtime_isFixedOnTarget(target, prop)) return false;
					// A sealed array member holds its members on its shell (see preventExtensions): a configurable one is
					// deleted from both the shell and the module's array, as deleting it from the array itself would.
					if (Arrays.isArray(arrayImpl) && Arrays.isArray(target) && !Reflect.isExtensible(target) && hasOwn(target, prop)) {
						if (!Reflect.getOwnPropertyDescriptor(target, prop).configurable) return false;
						const holder = runtime_arrayKeyHolder(arrayImpl, prop);
						if (hasOwn(holder, prop) && !Reflect.deleteProperty(holder, prop)) return false;
						Reflect.deleteProperty(target, prop);
						if (hasOwn(wrapper, prop)) {
							// A named member's held node is retired, as it is on the ordinary path below; a position's is only
							// a cache of an element that may have moved (#602).
							if (!runtime_isPosition(prop)) resolveWrapper(Objects.getOwnPropertyDescriptor(wrapper, prop).value)?.___invalidate();
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
					if ((heldDescriptor && !heldDescriptor.configurable) || (target !== wrapper && runtime_isFixedOnTarget(target, prop)))
						return false;
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
						isInternal || MapMethods.has(FRAMEWORK_WRITES, wrapper) || runtime_inRunTree(wrapper)
							? null
							: runtime_moduleObjectOf(wrapper, prop);
					if (moduleObject !== null && hasOwn(moduleObject, prop) && !Reflect.deleteProperty(moduleObject, prop)) return false;
					// Remove from ____impl if it's an object, before anything is retired: the backing value may refuse (its own
					// proxy, a frozen/sealed export #485), and the node then reports it the way the object itself would —
					// `false`, which a strict-mode `delete` turns into the same TypeError — with its child wrapper still live.
					// A composed array node's own elements are the module's array's: deleting them from its layer only hides them.
					// A function node's members are its function's (a layer over the module's function, which only hides them).
					// A node of a run's tree removes a member of the live value it fronts from itself alone: the value is the
					// module's, which the instance's tree fronts too (see runtime_runTreeHides).
					if (!isInternal && runtime_inRunTree(wrapper) && runtime_frontsLiveValue(wrapper) && hasOwn(backing, prop)) {
						SetMethods.add((wrapper.____slothletInternal.runHiddenKeys ??= new Set()), prop);
						if (wrapper.____slothletInternal.runHeldKeys) SetMethods.delete(wrapper.____slothletInternal.runHeldKeys, prop);
						if (hasOwn(wrapper, prop) && Objects.getOwnPropertyDescriptor(wrapper, prop).configurable) delete wrapper[prop];
						return true;
					}
					const deleteFrom = Arrays.isArray(backing) ? runtime_arrayKeyHolder(backing, prop) : backing;
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
						if (childWrapperRaw && !(Arrays.isArray(wrapper.____slothletInternal.impl) && runtime_isPosition(prop))) {
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
					const kept = runtime_takeCapturedAccess(wrapper);
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
							throw new wrapper.SlothletError("LAZY_SUBCLASS_BEFORE_LOAD", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
						}
						// materializationPromise is always set when inFlight=true; Promise.resolve() guards
						// the unreachable case where it is somehow absent due to corrupted internal state.
						/* v8 ignore next */
						return PromiseMethods.then(Promises.resolve(wrapper.____slothletInternal.materializationPromise), () => {
							if (!wrapper.____slothletInternal.state.materialized) {
								// Materialization resolved without marking the wrapper as materialized —
								// a defensive guard against corrupted internal state; unreachable in practice.
								/* v8 ignore next */
								throw new wrapper.slothlet.SlothletError("LAZY_MATERIALIZATION_FAILED", {
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
							throw new wrapper.slothlet.SlothletError("API_PATH_NOT_CALLABLE", {
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
						return runtime_constructAsNode(wrapper, impl, args, effectiveNewTarget);
					}

					if (impl && typeof impl === "object" && typeof impl.default === "function") {
						const effectiveNewTarget = newTarget === wrapper.____slothletInternal.proxy ? impl.default : newTarget;
						return runtime_constructAsNode(wrapper, impl.default, args, effectiveNewTarget);
					}

					throw new wrapper.SlothletError("API_PATH_NOT_CALLABLE", {
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
					if (runtime_holdsDataKind(impl)) return Reflect.getPrototypeOf(impl);
					// A node fronting a module's own object holds that object's prototype, one set on it since included (#757).
					const moduleObject = runtime_moduleObjectOf(wrapper);
					if (moduleObject !== null) return Reflect.getPrototypeOf(moduleObject);
					const isLiveIdentity = internal.deferChildAdopt || (EventEmitter && runtime_inherits(impl, EventEmitter));
					if (isLiveIdentity && impl && typeof impl === "object") return Objects.getPrototypeOf(impl);
					// A namespace slothlet composed has the prototype its record holds, as a function node does.
					return runtime_ownsPrototype(wrapper) ? runtime_recordedPrototype(wrapper) : null;
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
						// (see runtime_inherits).
						const fixed = Reflect.getPrototypeOf(target);
						// A prototype given to the node is reported as it is to every reader, as on an open node.
						const given = runtime_ownsPrototype(wrapper) && (typeof impl !== "function" || runtime_prototypeGiven(wrapper));
						if (nodesShared.heldPrototypeRead !== wrapper && !given) {
							// A class instance's prototype is checked as a call of its class's node, as on an open node (#725).
							const behind = runtime_behindMemberView(fixed);
							runtime_enforceCodeMember(runtime_prototypeCheckedBy(wrapper, behind), behind, takeKept());
						}
						return fixed;
					}
					// A function node reports its function's prototype, a class it extends as that class's node (#667).
					if (typeof impl === "function") return runtime_functionNodePrototype(wrapper, impl);
					const kept = takeKept();
					const emitter = runtime_emitterOwnPrototype(wrapper) !== undefined;
					// An instance of a class of the module's reports that class's prototype, as the instance does, behind the class's
					// node's checks (#667). Only an open node: a closed one reports its shell's. An emitter, its class exported or not,
					// answers as an emitter below.
					const classPrototype = emitter ? undefined : runtime_instanceClassPrototype(wrapper, kept);
					if (classPrototype !== undefined) return classPrototype;
					// An instance whose class cannot be told reports its own prototype, behind its own node's checks (#667).
					const unclassed = runtime_unclassedInstancePrototype(wrapper);
					if (unclassed !== undefined) {
						runtime_enforceCodeMember(wrapper, unclassed, kept);
						return runtime_prototypeForReader(wrapper, runtime_exposePrototype(wrapper, unclassed), null);
					}
					let prototype = heldPrototype();
					// A node's own prototype is reported as it is to the host; one it was given is handed to module code as that
					// module's view of it (see runtime_givenView).
					if (prototype === null) return null;
					if (runtime_ownsPrototype(wrapper))
						return runtime_prototypeGiven(wrapper) ? runtime_givenPrototypeFor(wrapper, prototype, kept) : prototype;
					// A prototype of the module's holds its class and methods, so it is reported only to a caller that may call
					// the node, as its `constructor` is read (#632). Any other caller is reported a stand-in inheriting from the
					// nearest prototype above it holding none of the module's code, so `instanceof` against the language's or
					// Node's own classes still holds, and no write lands on that shared prototype (#667).
					if (!runtime_isCodeMemberWithheld(wrapper, { value: prototype }, kept)) {
						if (!emitter) return prototype;
						// A module allowed the emitter reads and calls through it, and a change made through it stays the owner's (#667).
						return runtime_prototypeForHolder(
							wrapper.slothlet,
							runtime_selfModuleReader(wrapper.slothlet) ?? kept?.reader ?? null,
							runtime_emitterPrototypeHandle(wrapper, prototype)
						);
					}
					while (runtime_memberHoldsCode(prototype, searchDepth(wrapper.slothlet) + 1, searchBudget(wrapper.slothlet)))
						prototype = Objects.getPrototypeOf(prototype);
					return runtime_withheldPrototype(wrapper, prototype);
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
						// gated (see runtime_defineOnSealedShell).
						const node = wrapper.____slothletInternal.proxy;
						// An array member seals the module's current array too, as sealing the array itself would. The
						// shell's own `length` is a plain value the proxy invariants pin once it is sealed, so it takes
						// the array's length now; it is the one member every reader sees as a value (#609).
						const array = wrapper.____slothletInternal.impl;
						if (Arrays.isArray(target) && Arrays.isArray(array)) {
							// An array that refuses to be sealed (a proxy whose own trap says no) refuses it here, before the shell changes.
							// A node of a run's own tree leaves the module's array, which the instance shares, as it is.
							if (!runtime_inRunTree(wrapper) && !Reflect.preventExtensions(layerUnderlying(array))) return false;
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
							const instancePrototype = prototype === null ? runtime_instanceShellPrototype(wrapper) : undefined;
							Reflect.setPrototypeOf(
								target,
								instancePrototype !== undefined
									? instancePrototype
									: prototype !== null && prototype === runtime_emitterOwnPrototype(wrapper)
										? runtime_sealedShellPrototype(wrapper, prototype)
										: prototype
							);
						} else if (typeof array === "function") Reflect.setPrototypeOf(target, runtime_functionNodePrototype(wrapper, array));
						// A lazy namespace's shell is a function, built before its value was known: it takes the namespace's prototype.
						else if (runtime_ownsPrototype(wrapper)) Reflect.setPrototypeOf(target, runtime_recordedPrototype(wrapper));
						// A prototype the node was given is held as the view every holder of the closed node reads it through.
						if (runtime_prototypeGiven(wrapper)) {
							Reflect.setPrototypeOf(target, runtime_givenShellPrototype(wrapper, runtime_recordedPrototype(wrapper)));
						}
						const keys = setFrom(concatLists(ownKeysTrap(target, false), Reflect.ownKeys(target)));
						const frontsModuleObject = !Arrays.isArray(target) && runtime_moduleObjectOf(wrapper) !== null;
						for (const key of setValues(keys)) {
							if (runtime_isFixedOnTarget(target, key)) continue;
							// The shell's inspect hook stays the shell's own (see runtime_defineProxyInspect): the node holds no member
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
											value: runtime_shellValue(wrapper, key),
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
						// The access a view is making into this node, taken as the trap starts (see runtime_beginAccess).
						const access = runtime_takeAccess(wrapper);
						if (runtime_runTreeHides(wrapper, prop)) {
							const from = runtime_runTreeHiddenFrom(wrapper);
							return from === null ? undefined : Reflect.get(from, prop, receiver);
						}
						const value = getTrap(target, prop, receiver, access);
						// A built-in handed out as itself (a `Map`, a `Date`) is saved first for the runs open (see helpers/run-snapshot).
						if (anyRunOpen() && value !== null && (typeof value === "object" || typeof value === "function")) {
							const held = runtime_builtinBehind(value);
							if (held !== null) runtime_checkpointHandout(wrapper.slothlet, held);
							// So is a class's prototype, which a module's code and the host change as itself.
							else if (prop === "prototype") runtime_checkpointPrototypeHandout(wrapper, runtime_wrapperClassPrototype(wrapper));
						}
						// A member fixed read-only on a frozen shell must be read as the shell holds it (proxy invariant), so it
						// carries no view bound to the reader: it is checked against whoever calls or reads it.
						const fixed = target !== wrapper ? Reflect.getOwnPropertyDescriptor(target, prop) : undefined;
						if (fixed && "value" in fixed && !fixed.configurable && !fixed.writable) return value;
						return runtime_bindCapturedIdentity(wrapper, prop, value, access);
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
							runtime_checkpointFile(wrapper);
							const result = applyTrap(target, thisArg, args);
							if (result !== null && typeof result === "object") {
								// What an async call settles with is saved before the caller has it, as what a call returns is.
								if (util.types.isPromise(result)) return runtime_checkpointSettled(wrapper.slothlet, result);
								runtime_checkpointHandout(wrapper.slothlet, result);
							}
							return result;
						}
						const keptAccess = rulesShared.capturedAccess?.wrapper === wrapper ? rulesShared.capturedAccess : null;
						return runtime_redactToJSONResult(
							wrapper,
							applyTrap(target, thisArg, args),
							typeof path === "string" ? StringMethods.slice(path, 0, dot) : copyList(path, 0, dot),
							[undefined],
							keptAccess
						);
					},
					construct: constructTrap,
					has: (target, prop) => {
						if (runtime_runTreeHides(wrapper, prop)) {
							const from = runtime_runTreeHiddenFrom(wrapper);
							return from !== null && Reflect.has(from, prop);
						}
						return hasTrap(target, prop);
					},
					// A member is described holding what reading it hands out, the reading module's identity bound to a node as the
					// get trap binds it, so its description and a read of it give the same value (#667). A member fixed read-only on
					// a frozen shell is described as the shell holds it (proxy invariant), as it is read.
					getOwnPropertyDescriptor: (target, prop) => {
						const access = runtime_takeAccess(wrapper);
						if (runtime_runTreeHides(wrapper, prop) && !runtime_isFixedOnTarget(target, prop)) return undefined;
						const descriptor = getOwnPropertyDescriptorTrap(target, prop, true, access);
						if (!descriptor || !("value" in descriptor)) return descriptor;
						const fixed = target !== wrapper ? Reflect.getOwnPropertyDescriptor(target, prop) : undefined;
						if (fixed && "value" in fixed && !fixed.configurable && !fixed.writable) return descriptor;
						const bound = runtime_bindCapturedIdentity(wrapper, prop, descriptor.value, access);
						return bound === descriptor.value ? descriptor : { __proto__: null, ...descriptor, value: bound };
					},
					ownKeys: (target) => {
						const keys = ownKeysTrap(target);
						if (wrapper.____slothletInternal.runHiddenKeys === undefined) return keys;
						return filterList(keys, (key) => !runtime_runTreeHides(wrapper, key) || runtime_isFixedOnTarget(target, key));
					},
					// What a module's write stores is owned by the module owning the member, or by the writer for one it creates.
					set: runtime_placingTrap(wrapper, setTrap, (args) => args[2]),
					// A callable `then` is refused here, as in the set trap. A callable node's target is a bare function shell
					// while its members live on the wrapper, so a definition lands on the wrapper, where reads find
					// it; the shell takes it too only when the proxy invariants bind it there (a non-configurable
					// definition, a sealed shell, a key the shell holds non-configurably). Any other target, and any
					// framework-reserved key, is defined on the target as before.
					defineProperty: runtime_placingTrap(
						wrapper,
						(target, prop, descriptor) => {
							if (prop === "then" && isAwaitableThen(descriptor)) {
								throw new wrapper.SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(wrapper.____slothletInternal.apiPath) });
							}
							// A definition that changes nothing (freezing an already frozen node) is no write (#667).
							if (!Reflect.isExtensible(target) && runtime_isUnchangingDefinition(target, prop, descriptor)) return true;
							// Defining a member is a write to its path: a module defines only under the subtree it owns (#625),
							// and never a framework-reserved key (the built-in write rules).
							runtime_assertOwnedWrite(wrapper, prop);
							// A view `self` handed out stands for its node: the node is what is defined (#625).
							if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: runtime_unwrapSelfView(descriptor.value) };
							// An object defined after the api was built is data, as one assigned is (#826).
							if ("value" in descriptor) runtime_markAssignedData(wrapper, descriptor.value);
							// A framework-reserved key never reads through the node, so it stays off the wrapper's own state.
							if (isFrameworkReservedKey(prop)) return Reflect.defineProperty(target, prop, descriptor);
							// A member fixed in one step holding an object would be handed out as it is: refused while permissions are on.
							if (
								"value" in descriptor &&
								!MapMethods.has(FRAMEWORK_WRITES, wrapper) &&
								runtime_definitionFixes(wrapper, target, prop, descriptor)
							) {
								runtime_refuseFixedObjectDefinition(wrapper.slothlet, wrapper.____slothletInternal.apiPath, prop, descriptor.value);
							}
							// An object or function defined on the node is held as a node of its own, as one assigned to it is: what is
							// read through it is gated at its own path and a write through it is held to its owner. The module's own
							// object keeps the value itself.
							const raw = descriptor;
							const heldNode = runtime_definedValueNode(wrapper, target, prop, descriptor);
							if (heldNode !== null) descriptor = { __proto__: null, ...descriptor, value: heldNode };
							// A full-isolation run's `self` defining a member of a node of the tree the run does not own yet (see
							// runtime_runWrite): checked as above, and kept in the run's own record instead of on the node.
							// A closed node, or a member it holds fixed, refuses a definition it could not take first.
							if (
								runShared.RUN_WRITE !== null &&
								runShared.RUN_WRITE.node === wrapper &&
								runShared.RUN_WRITE.prop === prop &&
								(!Reflect.isExtensible(target) || runtime_isFixedOnTarget(target, prop)) &&
								!runtime_canDefine(target, prop, descriptor)
							) {
								runShared.RUN_WRITE = null;
								return false;
							}
							const runSink = runtime_takeRunWrite(wrapper, prop);
							if (runSink !== null) return runSink({ op: "define", descriptor });
							// A node of a run's tree defines on its own copy of the array it fronts, and holds what it defines over the
							// live value it fronts (see runtime_runTreeHolds).
							if (runtime_inRunTree(wrapper)) {
								runtime_ownRunTreeArray(wrapper);
								runtime_markRunTreeHeld(wrapper, prop);
							}
							if (target === wrapper) {
								if (!Reflect.defineProperty(target, prop, descriptor)) return false;
								if (heldNode !== null) SetMethods.add((wrapper.____slothletInternal.userAssignedKeys ??= new Set()), prop);
								return true;
							}
							// A sealed node holds its members on the shell (see the preventExtensions trap), where a definition
							// changes them as it would on the object, a value going through the node's own write.
							if (!Reflect.isExtensible(target)) return runtime_defineOnSealedShell(wrapper, target, prop, descriptor);
							// An accessor defined at runtime runs as the node's module, as an exported one does (#597).
							descriptor = runtime_adoptDefinedAccessor(wrapper, descriptor);
							// An array member defines on its current array (#602), unless the position lies past a read-only length.
							if (Arrays.isArray(target))
								return runtime_isPastFixedLength(target, prop) ? false : definePropertyTrap(target, prop, descriptor);
							const internal = wrapper.____slothletInternal;
							// As the set trap does: a lazy node loads first, so loading does not overwrite the definition.
							if (internal.mode === "lazy" && !internal.state.materialized && !internal.state.inFlight) wrapper.___materialize();
							const bindsTarget = runtime_bindsTarget(target, wrapper, prop, descriptor);
							// A partial definition binding the shell (`{ configurable: false }`) keeps the member as it is: the shell
							// takes the rest of its descriptor from the member, its value as the node holds it (#603 review).
							let shellDescriptor = descriptor;
							if (bindsTarget && !hasOwn(target, prop) && !("get" in descriptor) && !("set" in descriptor)) {
								const member = getOwnPropertyDescriptorTrap(target, prop, false);
								if (member && "value" in member) {
									shellDescriptor = {
										__proto__: null,
										value: runtime_shellValue(wrapper, prop),
										writable: true,
										enumerable: member.enumerable,
										configurable: member.configurable,
										...descriptor
									};
								}
							}
							// A node built from a copy of a module's own object defines the member on that object too, as the same
							// definition of the object does (#746).
							const moduleObject =
								MapMethods.has(FRAMEWORK_WRITES, wrapper) || runtime_inRunTree(wrapper) ? null : runtime_moduleObjectOf(wrapper, prop);
							// All are checked before any changes, so a refusal by one leaves the others as they were.
							if (
								(bindsTarget && !runtime_canDefine(target, prop, shellDescriptor)) ||
								!runtime_canDefine(wrapper, prop, descriptor) ||
								(moduleObject !== null && !runtime_canDefine(moduleObject, prop, raw))
							)
								return false;
							if (moduleObject !== null && !Reflect.defineProperty(moduleObject, prop, raw)) return false;
							if (moduleObject !== null && typeof prop === "string") SetMethods.add(runtime_moduleObjectKeys(moduleObject), prop);
							// Whether the member takes a write once defined, as the same definition leaves it on an object (#749): the
							// node's own store keeps every member read-only, so what was asked for is remembered beside it.
							const wasData = hasOwn(wrapper, prop) && "value" in Reflect.getOwnPropertyDescriptor(wrapper, prop);
							const wasWritable = wasData && runtime_reportsWritable(wrapper, prop);
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
					deleteProperty: runtime_placingTrap(wrapper, deletePropertyTrap, null),
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
						runtime_syncArrayIntegrity(wrapper, target);
						if (!Reflect.isExtensible(target)) return true;
						// Sealing or freezing a node changes what its owner may write to it, so a module may do it only to a
						// node it owns (#625). Checked before anything is sealed: a refused freeze leaves the node as it was.
						runtime_assertOwnedWrite(wrapper, null);
						// A full-isolation run's `self` closes its own view of the node once the change is allowed (see runtime_runWrite).
						const runSink = runtime_takeRunWrite(wrapper, null);
						if (runSink !== null) return runSink({ op: "close" });
						// A node fronting a module's own object closes that object too, as closing the object does (#757): the
						// object refusing it refuses it here, before the node changes. Composing never changes a module's value, and
						// neither does a node of a run's own tree, which shares the module's values with the instance: it closes itself.
						const moduleObject =
							wrapper.slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper) || runtime_inRunTree(wrapper)
								? null
								: runtime_moduleObjectOf(wrapper);
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
						runtime_syncArrayIntegrity(wrapper, target);
						runtime_followModuleIntegrity(wrapper, target);
						return Reflect.isExtensible(target);
					},
					// A prototype set on an array member is set on its array, under a composed node's layer, which refuses
					// one itself; a sealed shell keeps the one it reports.
					setPrototypeOf: (target, proto) => {
						// A prototype set on a node is set on its module's value: a module may do it only to a node it owns (#625).
						runtime_assertOwnedWrite(wrapper, null);
						// A full-isolation run's `self` keeps the prototype in the run once the change is allowed (see runtime_runWrite).
						const runSink = runtime_takeRunWrite(wrapper, null);
						if (runSink !== null) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === runtime_unwrapSelfView(proto);
							return runSink({ op: "prototype", prototype: proto });
						}
						const impl = wrapper.____slothletInternal.impl;
						// A node of a run's own tree shares the module's values with the instance: a prototype set on it that would be
						// set on one of them is the node's own instead, which it reports and inherits through.
						if (runtime_inRunTree(wrapper) && runtime_prototypeOnSharedValue(wrapper)) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
							const internal = wrapper.____slothletInternal;
							if (internal.mode === "lazy" && !internal.state.materialized) return false;
							internal.runPrototype = { prototype: runtime_unwrapSelfView(proto) };
							return true;
						}
						// A node fronting a module's own object sets that object's prototype, which the node reports (#757); a
						// closed node keeps the one its shell holds, as the closed object does.
						const moduleObject = MapMethods.has(FRAMEWORK_WRITES, wrapper) ? null : runtime_moduleObjectOf(wrapper);
						if (moduleObject !== null && !Arrays.isArray(impl)) {
							if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
							return Reflect.setPrototypeOf(moduleObject, runtime_unwrapSelfView(proto));
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
							return Reflect.setPrototypeOf(impl, runtime_unwrapSelfView(proto));
						// A function node never writes to the module's function (a member written through it stays the node's), and
						// a namespace slothlet composed is no value of a module's: either takes the prototype on its own record,
						// which the node reports and inherits from (see runtime_fillPrototype). Any other node answers true only
						// for the prototype it already has.
						if (!runtime_ownsPrototype(wrapper)) {
							return runtime_unwrapSelfView(proto) === (typeof impl === "function" ? Reflect.getPrototypeOf(impl) : heldPrototype());
						}
						// The one its value came with is the node's again as it was before any was given.
						const given = runtime_behindGivenView(runtime_unwrapSelfView(proto));
						runtime_recordedPrototype(wrapper);
						internal.prototypeGiven = given !== (typeof impl === "function" ? Reflect.getPrototypeOf(impl) : Objects.prototype);
						internal.prototype = given;
						return true;
					},
					getPrototypeOf: (target) => {
						// A prototype of a module's own handed out is saved first for the runs open (see helpers/run-snapshot).
						if (anyRunOpen()) runtime_checkpointPrototypeHandout(wrapper, runtime_snapshotPrototype(wrapper));
						return reportedPrototype(target, () => runtime_takeCapturedAccess(wrapper));
					}
				};
				// A run that started before a change reads the node as it was (see helpers/run-snapshot): every trap that changes
				// the node saves it first, once per window, while a run is open.
				{
					const { set, defineProperty, deleteProperty, setPrototypeOf, preventExtensions } = proxyHandler;
					const save = () => {
						if (anyRunOpen()) runtime_snapshotBarrier(wrapper);
					};
					proxyHandler.set = (target, prop, value, receiver) => (save(), set(target, prop, value, receiver));
					proxyHandler.defineProperty = (target, prop, descriptor) => (save(), defineProperty(target, prop, descriptor));
					proxyHandler.deleteProperty = (target, prop) => (save(), deleteProperty(target, prop));
					proxyHandler.setPrototypeOf = (target, prototype) => (save(), setPrototypeOf(target, prototype));
					proxyHandler.preventExtensions = (target) => (save(), preventExtensions(target));
				}
				// Once a restart() replaces this wrapper's tree, every trap forwards to the live tree (#504).
				const proxyTraps = runtime_withRestartForwarding(proxyHandler, wrapper);
				wrapper.____slothletInternal.proxy = new NativeProxy(proxyTarget, proxyTraps);
				WeakMapMethods.set(NODE_TARGETS, wrapper, proxyTarget);
				if (Arrays.isArray(proxyTarget)) runtime_adoptArrayIntegrity(wrapper);
				else runtime_adoptObjectIntegrity(wrapper);
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

				WeakMapMethods.set(_proxyRegistry, wrapper.____slothletInternal.proxy, wrapper);
				runtime_recordFunctionNode(wrapper);
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
