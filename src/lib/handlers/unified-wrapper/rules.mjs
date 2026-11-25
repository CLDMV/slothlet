/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/rules.mjs
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
 * @fileoverview Rules layer of the wrapper: read gates, capabilities, ownership and standing checks, the framework's own writes and members, and access attribution.
 * @module @cldmv/slothlet/handlers/unified-wrapper/rules
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { isNode, util } from "#helpers/platform";
import { isCompositionLayer, layerForwards, layerHeldKeys, layerUnderlying } from "#helpers/composition";
import { SlothletError } from "#errors";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { combineCeilings, identityCeilings } from "#handlers/trusted-root";
import { toComparablePath } from "#handlers/frame-placement";
import { isFrameworkInternal, isFrameworkMarkerKey } from "#handlers/framework-internals";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	filterList,
	FunctionMethods,
	listPush,
	Map,
	mapList,
	MapMethods,
	NativeProxy,
	Number,
	Objects,
	PromiseMethods,
	Reflect,
	RegExpMethods,
	SetMethods,
	splitText,
	String,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { namesForeignFile, BINDING_NAME, hasCapabilityCheck } from "#helpers/capability-context";

import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 *
 * Upward (from layers above this one): hasOwn, HOST_READER, PROTOTYPE_HANDLE_READER, RUN_VIEWS, runtime_runnerCompilesLoad, runtime_namesHelperCopy, runtime_runnerCompilesHelper, runtime_selfModuleCeilings, runtime_selfWriteHasStanding, FRAMEWORK_MEMBERS, SELF_FRAMEWORK_ROOTS, runtime_adoptAccessor, PINNED_CODE_MEMBERS, runtime_checkedStandIn, runtime_behindPinnedCode, runtime_pinsAsCode, runtime_runAsMaker, searchDepth, searchBudget, runtime_carryTo, runtime_handedAsArgument, CROSSINGS, runtime_uncross, runtime_asOneModule, runtime_crossTo, runtime_functionOf, ANY_MEMBER_SEGMENT, runtime_memberPathOf, runtime_rootGate, runtime_heldValue, capturedViewShadows, runtime_capturedView, RESTART_FORWARD_TRAPS.
 */
let trustedRootOwn,
	handedLeafFunctions,
	frameDefiner,
	runtime_codeWritersOnStack,
	runtime_loadingFileRunning,
	runtime_loadingHelper,
	leafOfCopy,
	hasOwn,
	HOST_READER,
	ENDED_INSTANCES,
	PROTOTYPE_HANDLE_READER,
	RUN_VIEWS,
	runtime_runnerCompilesLoad,
	runtime_namesHelperCopy,
	runtime_runnerCompilesHelper,
	runtime_selfModuleCeilings,
	runtime_selfWriteHasStanding,
	ACTING_FOR,
	FRAMEWORK_MEMBERS,
	runtime_inheritsBuiltin,
	SELF_FRAMEWORK_ROOTS,
	runtime_isTerminalData,
	runtime_dataReadOptions,
	runtime_isPlainData,
	runtime_holdsAssignedData,
	runtime_isDataMemberNode,
	runtime_isBuiltinFunctionMember,
	ADOPTED_ACCESSORS,
	runtime_adoptAccessor,
	runtime_moduleInheritance,
	PINNED_CODE_MEMBERS,
	runtime_checkedStandIn,
	runtime_behindPinnedCode,
	runtime_pinsAsCode,
	runtime_prototypeGiven,
	runtime_inheritsFrom,
	runtime_moduleObjectOf,
	runtime_moduleObjectKeys,
	NO_NODE_PRIMITIVE,
	runtime_nodePrimitive,
	INTRINSICS,
	runtime_isSharedValue,
	runtime_isSlothletValue,
	runtime_isModuleStandIn,
	runtime_isModuleProxy,
	runtime_isBuiltinFunction,
	runtime_makerOf,
	runtime_runAsMaker,
	runtime_makerInstanceID,
	searchDepth,
	searchBudget,
	runtime_holdsCode,
	runtime_nodeAtPath,
	runtime_carryTo,
	runtime_handedAsArgument,
	CROSSINGS,
	runtime_uncross,
	runtime_asOneModule,
	runtime_crossTo,
	runtime_functionOf,
	runtime_isArrayMember,
	ANY_MEMBER_SEGMENT,
	runtime_memberPathOf,
	runtime_rootGate,
	runtime_holdsValue,
	runtime_heldValue,
	capturedViewShadows,
	runtime_capturedView,
	_proxyRegistry,
	runtime_isRestartStale,
	runtime_isArrayIndex,
	SlothletTypeError,
	RESTART_FORWARD_TRAPS,
	UnifiedWrapper,
	resolveWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * Nodes the framework itself is writing right now, each with how many of its writes to it are open.
 *
 * Held only for the synchronous extent of one write (see {@link runtime_frameworkWrite}), never across an
 * `await`, so no module code that runs while a framework operation is suspended — the module that started
 * it, another call of the same leaf, or any other module — can find it set.
 * @type {Map<UnifiedWrapper|object, number>}
 * @private
 */
const FRAMEWORK_WRITES = new Map();

/**
 * The instances' api root proxies ({@link runtime_registerRoot}).
 * @type {WeakSet<object>}
 * @private
 */
const ROOT_PROXIES = new WeakSet();

/**
 * Make one write of the framework's own to a node: a mount, removal, or rebuild step of `api.add` /
 * `remove` / `reload`, or the framework fixing a node's integrity to match its module's value.
 *
 * Such a write runs through the same traps a module's `self.X.Y = …` reaches, and in whatever context the
 * operation was started from, often a module's. It is not that module's write, so the ownership rule
 * ({@link runtime_assertOwnedWrite}) lets it through, for this node and only while `write` runs.
 *
 * @param {object} node - The node written: a wrapper proxy or wrapper, or an instance's api root. Anything else needs
 *   no exemption.
 * @param {function(): *} write - The write; synchronous.
 * @returns {*} What `write` returns.
 * @internal
 *
 * @example
 * runtime_frameworkWrite(parent, () => { parent[key] = value; });
 */
function runtime_frameworkWrite(node, write) {
	// The api root has no wrapper: its proxy stands for itself (see runtime_assertRootChange).
	const wrapper = resolveWrapper(node) ?? (WeakSetMethods.has(ROOT_PROXIES, node) ? node : null);
	if (!wrapper) return write();
	MapMethods.set(FRAMEWORK_WRITES, wrapper, (MapMethods.get(FRAMEWORK_WRITES, wrapper) ?? 0) + 1);
	try {
		return write();
	} finally {
		const open = MapMethods.get(FRAMEWORK_WRITES, wrapper) - 1;
		if (open > 0) MapMethods.set(FRAMEWORK_WRITES, wrapper, open);
		else MapMethods.delete(FRAMEWORK_WRITES, wrapper);
	}
}

/**
 * Refuse an access a module makes through an api node it was handed once its instance has shut down: the node reads,
 * lists, describes and calls nothing for it then, whatever it was allowed while the instance ran. The host reading its
 * own `api` is no module's access and is not refused here.
 * @param {object} slothlet - The instance the node belongs to.
 * @param {object} reader - Who the node was handed to.
 * @returns {void}
 * @throws {SlothletError} CONTEXT_NOT_ACTIVE_SELF once the instance has shut down, as a read of `self` then is.
 * @private
 */
function runtime_refuseEndedAccess(slothlet, reader) {
	if (reader === HOST_READER || !WeakSetMethods.has(ENDED_INSTANCES, slothlet)) return;
	// A prototype's handle is the same object to every reader, and no call runs once the instance has shut down: whose
	// code makes the access is read from the stack, as for a capability (see runtime_assertCapability). The host's own
	// code (and a package's it runs) goes on as before; a module's code, and code no one accounts for, is refused.
	if (reader === PROTOTYPE_HANDLE_READER) {
		const writers = runtime_codeWritersOnStack(slothlet);
		if (writers !== null && writers.length === 0) return;
	}
	throw new slothlet.SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
}

/**
 * Reader of a node read through `self` by code the live runtime could not attribute to one call. It owns
 * nothing.
 * @type {object}
 * @private
 */
const UNATTRIBUTED_READER = Objects.freeze({ reader: "unattributed" });

/**
 * Record a full-isolation run's view of a node with what it reads through, so a view written into the api is stored as
 * that node, as a view `self` hands out outside a run is ({@link runtime_unwrapSelfView}).
 * @param {object} view - The run's view.
 * @param {*} real - What it reads through.
 * @returns {object} `view`.
 * @internal
 */
function runtime_registerRunView(view, real) {
	WeakMapMethods.set(RUN_VIEWS, view, real);
	return view;
}

/**
 * Refuse code compiled under the name of a file this instance is loading now (every load of it) a capability that no
 * rule opens for that load's module path; a load whose paths are not known yet is refused it. Code compiled under the
 * name of a copy of one of the instance's helper files is placed as that helper's code: decided as the paths of the
 * api files importing it while one of them loads, and refused otherwise; under the name of a helper copy tagged with an
 * id no instance that is up holds, it is refused. A name tagged with another instance's id is
 * that instance's to judge while it is up with a check of its own registered (two instances load the same file under
 * their own tags, and the compile hooks are shared by the process); a name tagged with an id no registered check holds
 * (an unknown instance, or one that has shut down) is judged here as any other.
 * @param {object} slothlet - The instance.
 * @param {object} permissionManager - Its permission manager.
 * @param {string} name - The capability.
 * @param {string} route - What the code used.
 * @param {*} filename - The name the code is compiled under.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @private
 */
function runtime_assertNamedLoads(slothlet, permissionManager, name, route, filename) {
	if (typeof filename !== "string") return;
	const loader = slothlet?.processors?.loader;
	if (typeof loader?.loadsOfFile !== "function") return;
	const tag = RegExpMethods.exec(/[?&]slothlet_instance=([^&#]+)/, filename)?.[1] ?? null;
	if (tag !== null && tag !== String(slothlet.instanceID) && hasCapabilityCheck(tag)) return;
	const loads = loader.loadsOfFile(toComparablePath(filename));
	for (let index = 0; index < loads.length; index++) {
		const paths = loads[index].paths;
		if (paths?.length) permissionManager.assertCapabilityForPaths(paths, name, route);
		else permissionManager.assertCapability(UNATTRIBUTED_READER, name, route);
	}
	if (loads.length) return;
	const copy = runtime_namesHelperCopy(slothlet, filename);
	if (copy === null) return;
	const helper = copy === "own" ? runtime_loadingHelper(slothlet, toComparablePath(filename)) : null;
	if (helper?.paths?.length) permissionManager.assertCapabilityForPaths(helper.paths, name, route);
	else permissionManager.assertCapability(UNATTRIBUTED_READER, name, route);
}

/**
 * Refuse module code of this instance a built-in capability no rule opens for it (see
 * `PermissionManager#assertCapability`), told as any other access is: the call running, read from the stack where
 * calls are in flight; while no call runs, the code's own frames (a function a module handed out, run by the host, is
 * its definer's). Code the live runtime cannot attribute is refused; the host's own code, a package's run by the host,
 * and another instance's code are left to their own checks.
 *
 * @param {object} slothlet - The instance.
 * @param {string} name - The capability.
 * @param {string} route - What the code used, for the error.
 * @param {string|null} [moduleFile=null] - A file of this instance's the code is known to belong to (an import it
 *   makes as it links), so that code is never taken for the host's.
 * @param {*} [filename=null] - The file name the code is compiled under, when one is given: a real file outside the
 *   caller's own folder is refused even where a rule opens the capability.
 * @param {boolean|null} [runnerCompile=false] - Whether the call is vitest's compile of exactly the code its server sent
 *   for `filename` (see `helpers/vitest-worker-setup`): allowed once for a file of this instance's that is loading now,
 *   as Node's own loader compiling the file would be. Null when no worker setup records what the server sent: the first
 *   such compile of a loading file is then decided by the code that makes it, as any other code is.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @internal
 * @example
 * runtime_assertCapability(slothlet, "code", "new Function");
 */
function runtime_assertCapability(slothlet, name, route, moduleFile = null, filename = null, runnerCompile = false) {
	const permissionManager = slothlet?.handlers?.permissionManager;
	if (!permissionManager?.isEnabled?.()) return;
	// vitest's module runner compiling the code its server sent for a file of this instance's that is loading now: the
	// loader's own compile of the file, as Node's loader compiling it would be. One such compile per load.
	if (runnerCompile === true && runtime_runnerCompilesLoad(slothlet, filename)) return;
	// With no worker setup recording what vitest's server sent (vitest without the vite plugin, `server.deps.inline`
	// only), the runner's compile of a loading file cannot be told from other code by what it compiles. The first
	// runner-shaped compile of each load is then decided by the code making it, as below: vitest's runner is no
	// module's code, and a module's own code compiling under the name is still its own and refused. Every later compile
	// under the name is placed as the file's code.
	const unverifiedRunnerCompile = runnerCompile === null && runtime_runnerCompilesLoad(slothlet, filename);
	// vitest's runner compiling a copy of one of the instance's helper files: decided by the code making it, as below
	// (vitest's runner is no module's code). A helper is no load, so the verified compile is not answered above.
	const runnerHelperCompile = runtime_runnerCompilesHelper(slothlet, filename, runnerCompile);
	// Any other code compiled under the name of a file this instance is loading now, or of a copy of one of its helper
	// files, is placed as that file's code, whoever compiles it: decided as the file's module path, as its own top-level
	// code is.
	if (!unverifiedRunnerCompile && !runnerHelperCompile) runtime_assertNamedLoads(slothlet, permissionManager, name, route, filename);
	const contextManager = slothlet.contextManager;
	let caller = null;
	const identity = contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.currentWrapper) caller = identity.currentWrapper;
	// Calls the live runtime cannot tell apart are in flight: code that is no file of the instance's (the host's, a
	// package's, Node's own) is still not a module's; anything else could be any of them, and is refused.
	else if (identity?.unresolved && !identity.unaccounted) {
		const writers = runtime_codeWritersOnStack(slothlet);
		caller = writers === null || writers.length > 1 ? UNATTRIBUTED_READER : writers.length ? writers[0] : null;
	} else {
		const definer = frameDefiner(contextManager?.runningInstanceID?.() ?? null);
		if (definer?.wrapper) caller = definer.wrapper.slothlet === slothlet ? definer.wrapper : null;
		else if (definer?.unplaced || definer?.leaves) caller = UNATTRIBUTED_READER;
		// Code of a file of the instance's no node stands for yet (a file's top level as it first loads) or no leaf
		// accounts for is the instance's, never the host's.
		else if (runtime_codeWritersOnStack(slothlet) === null) caller = UNATTRIBUTED_READER;
	}
	// A file of the instance's linking an import: its own code, whatever the stack says (nothing of the file's runs yet).
	if (caller === null && moduleFile !== null) caller = UNATTRIBUTED_READER;
	// A file's own top-level code as it first loads, or an import it links, before any node stands for it: decided as the
	// file's module path (S4), as the loader reads it ahead of the build. Code that names no file loading (a helper's top
	// level, code no load accounts for) stays refused.
	if (caller === UNATTRIBUTED_READER) {
		const load = runtime_loadingFileRunning(slothlet, moduleFile);
		if (load?.paths?.length) {
			permissionManager.assertCapabilityForPaths(load.paths, name, route);
			if (filename !== null && namesForeignFile(filename, load.path)) {
				permissionManager.assertCapabilityForPaths(load.paths, name, route, filename === BINDING_NAME ? "binding" : "foreign-filename");
			}
			return;
		}
	}
	permissionManager.assertCapability(caller, name, route);
	// Opened for the caller: compiling under the name of a real file outside its own folder is still refused, since the
	// code would be placed as that file's (a package's, another module's, the host's).
	if (filename === null || caller === null || caller === UNATTRIBUTED_READER) return;
	if (namesForeignFile(filename, caller.____slothletInternal?.filePath ?? null)) {
		permissionManager.assertCapability(caller, name, route, filename === BINDING_NAME ? "binding" : "foreign-filename");
	}
}

/**
 * Refuse a change a reader's view makes to a node with no standing of its own ({@link runtime_selfWriteHasStanding}):
 * such a change is the reader's, and goes through only under a path the reader owns and may write. The host owns
 * the whole tree; code that could not be attributed owns none of it.
 *
 * @param {object} slothlet - Instance the node belongs to.
 * @param {object|null} owner - Wrapper of the node changed, or null when there is none to check against.
 * @param {object} reader - The reader the view belongs to.
 * @param {string|symbol|null} prop - Member being changed, or null for a change to the node itself.
 * @returns {void}
 * @throws {SlothletError} `CONTEXT_NOT_ACTIVE_SELF` for a change outside what the reader owns, and what
 *   the reader's write rules throw.
 * @private
 */
function runtime_refuseWriteWithoutStanding(slothlet, owner, reader, prop) {
	const parts = owner ? filterList(splitText(String(owner.____slothletInternal.apiPath), "."), Boolean) : [];
	if (owner && typeof prop === "string") listPush(parts, prop);
	// With the system off only a change to the framework's own is checked (its keys on the node); disabled, none.
	// The host's reader goes through either way, so its write skips the frame read standing may make.
	if (!slothlet.handlers.apiManager.writeChecked(parts) || reader === HOST_READER || runtime_selfWriteHasStanding(slothlet)) return;
	if (reader !== UNATTRIBUTED_READER && owner) {
		// Held to the reader, the write meets the reader's write rules as well as its ownership (#625).
		if (slothlet.handlers.apiManager.mayWrite(parts, reader)) return slothlet.handlers.apiManager.assertOwnedWrite(parts, reader);
	}
	throw new slothlet.SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
}

/**
 * A view is its reader's: a write another module's code, or the host's, makes through it has to be the reader's to make
 * as well, so a function the reader hands someone to run (a bound built-in, which has no frame of the reader's) writes
 * nothing the reader could not. A write the reader's own module makes is decided for the leaf executing it alone,
 * unless a write rule keeps the two apart (files loaded from one folder share a module): then it is held to both.
 * @param {object} slothlet - The instance.
 * @param {object} reader - Who the view belongs to.
 * @param {object|null} writer - Who the write is made as: the module executing, or null for the host.
 * @param {string[]} parts - The api path written.
 * @returns {void}
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED` or `PERMISSION_DENIED` when the reader may not make the write.
 * @private
 */
function runtime_assertReaderWrite(slothlet, reader, writer, parts) {
	if (!reader?.____slothletInternal || reader === writer) return;
	if (writer !== null && runtime_asOneModule(slothlet, writer, reader)) return;
	if (!slothlet.handlers.apiManager.ownershipEnforced()) return;
	slothlet.handlers.apiManager.assertOwnedWrite(parts, reader);
}

/**
 * The name each of the framework's root members is served under on the api (`slothlet`, `shutdown`, `destroy`).
 * @type {WeakMap<object, string>}
 * @private
 */
const FRAMEWORK_MEMBER_NAMES = new WeakMap();

/**
 * The views {@link runtime_selfFrameworkView} built, per member and per reader, and the member behind each.
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const FRAMEWORK_VIEWS = new WeakMap();

/** @type {WeakMap<object, object>} */
const FRAMEWORK_VIEW_TARGETS = new WeakMap();

/**
 * Record a stand-in for one of the framework's root members (a view of the
 * `slothlet` namespace) as that member, so module code reading it through the scope's `self` is handed the same
 * view of it as outside the scope ({@link runtime_selfFrameworkView}). Anything else is left unrecorded.
 *
 * @param {object} copy - The stand-in.
 * @param {*} member - The value it stands in for.
 * @returns {object} `copy`.
 * @internal
 *
 * @example
 * runtime_registerFrameworkMemberCopy(viewOf(api.slothlet), api.slothlet);
 */
function runtime_registerFrameworkMemberCopy(copy, member) {
	const slothlet = WeakMapMethods.get(FRAMEWORK_MEMBERS, member);
	if (slothlet) runtime_registerFrameworkMember(copy, slothlet, WeakMapMethods.get(FRAMEWORK_MEMBER_NAMES, member));
	return copy;
}

/**
 * Record one of the framework's own root members of an instance's api, so module code reading it through
 * `self` is handed a view of it ({@link runtime_selfFrameworkView}).
 *
 * @param {object|Function} member - The `slothlet` namespace, `shutdown`, or `destroy`.
 * @param {object} slothlet - Instance it belongs to.
 * @param {string} name - The name it is served under on the api.
 * @returns {object|Function} `member`.
 * @internal
 *
 * @example
 * runtime_registerFrameworkMember(slothletNamespace, this.slothlet, "slothlet");
 */
function runtime_registerFrameworkMember(member, slothlet, name) {
	if (member !== null && (typeof member === "object" || typeof member === "function")) {
		WeakMapMethods.set(FRAMEWORK_MEMBERS, member, slothlet);
		WeakMapMethods.set(FRAMEWORK_MEMBER_NAMES, member, name);
	}
	return member;
}

/**
 * Refuse replacing one of the framework's root members (`self.slothlet`, `self.shutdown`, `self.destroy`)
 * through the runtime `self` (#625); a definition or deletion goes through {@link runtime_selfChangeTarget}.
 * While the permission system is on, module code meets the write rules first; the names are reserved for
 * everyone, so the assignment is refused either way, in an isolated scope as outside one.
 *
 * @param {object} slothlet - Instance the change is made on.
 * @param {string|symbol} prop - Member of `self` changed.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when module code changes a framework root member the write
 *   rules protect, `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing, and
 *   `API_PATH_INVALID` for the reserved name otherwise.
 * @internal
 *
 * @example
 * runtime_assertFrameworkRootChange(ctx.slothlet, "slothlet"); // throws inside a module call
 */
function runtime_assertFrameworkRootChange(slothlet, prop) {
	if (typeof prop !== "string" || !SetMethods.has(SELF_FRAMEWORK_ROOTS, prop)) return;
	if (slothlet.handlers.apiManager.frameworkProtected()) {
		const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
		if (identity?.unresolved) {
			throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(prop) });
		}
		// Code a caller supplied to another module's call changes it only where every module it acts for may (#597).
		if (identity?.currentWrapper) {
			for (
				let ofIndex = 0, ofList = concatLists([identity.currentWrapper], identityCeilings(identity));
				ofIndex < ofList.length;
				ofIndex++
			) {
				const writer = ofList[ofIndex];
				slothlet.handlers.apiManager.assertOwnedWrite([prop], writer);
			}
		}
	}
	// A reserved name, refused whoever assigns it, including inside an isolated scope, whose `self` takes the
	// assignment without reaching the api.
	slothlet.handlers.apiManager.normalizeApiPath([prop]);
}

/**
 * Build (or reuse) a reader's view of a member of the framework's namespace; see {@link runtime_selfFrameworkView}.
 *
 * @param {*} member - The member.
 * @param {object} slothlet - Instance it belongs to.
 * @param {object} reader - The reader the view belongs to.
 * @param {string} path - The member's api path (`slothlet.hook`), for the refusal of a change to it.
 * @returns {*} The view, or `member` when it is no object.
 * @private
 */
function runtime_frameworkViewOf(member, slothlet, reader, path) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	if (WeakMapMethods.has(FRAMEWORK_VIEW_TARGETS, member)) return member;
	let byReader = WeakMapMethods.get(FRAMEWORK_VIEWS, member);
	if (!byReader) {
		byReader = new WeakMap();
		WeakMapMethods.set(FRAMEWORK_VIEWS, member, byReader);
	}
	const cached = WeakMapMethods.get(byReader, reader);
	if (cached) return cached;

	// Made with no standing of its own, a use of the view is the reader's: it runs as that module. Run that
	// way it has no caller, yet it is no host call either: what pins "the caller" pins the reader instead.
	const asReader = (use) => {
		if (runtime_selfWriteHasStanding(slothlet)) return use();
		if (reader === UNATTRIBUTED_READER) {
			throw new slothlet.SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
		}
		return slothlet.contextManager.runInContext(slothlet.instanceID, () => runtime_asViewReader(reader, use), undefined, [], reader, true);
	};
	const unwrap = (value) =>
		value !== null && (typeof value === "object" || typeof value === "function")
			? (WeakMapMethods.get(FRAMEWORK_VIEW_TARGETS, value) ?? value)
			: value;
	const isFixed = (descriptor) => descriptor && "value" in descriptor && !descriptor.configurable && !descriptor.writable;
	const childPath = (prop) => (typeof prop === "string" ? `${path}.${prop}` : path);
	// Who makes a change through the view: the module executing now, or, for a change made with no standing of its
	// own, the reader; `null` for a change the host makes inside a `run()` / `scope()` it opened, which goes through as
	// it would on the member itself.
	const changeWriter = (parts) => {
		const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
		if (identity?.unresolved) {
			throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
		}
		if (identity?.currentWrapper) return identity.currentWrapper;
		if (runtime_selfWriteHasStanding(slothlet)) return null;
		if (reader === UNATTRIBUTED_READER) {
			throw new slothlet.SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
		}
		return reader;
	};
	// A module never changes the framework's namespace, unless a host rule lifted the built-in write rules (#625): with
	// the permission system on or off alike, only disabled leaves it open. Returns the module making the change.
	const refuseChange = (prop) => {
		if (!slothlet.handlers.apiManager.frameworkProtected()) return null;
		const parts = splitText(prop === null ? path : childPath(prop), ".");
		const writer = changeWriter(parts);
		// Code a caller supplied to another module's call changes it only where every module it acts for may (#597).
		if (writer !== null) {
			for (
				let ofIndex = 0, ofList = concatLists([writer], runtime_selfModuleCeilings(slothlet, writer));
				ofIndex < ofList.length;
				ofIndex++
			) {
				const call = ofList[ofIndex];
				slothlet.handlers.apiManager.assertOwnedWrite(parts, call);
			}
		}
		return writer;
	};
	// Once the instance has shut down, the view reads, lists, describes, calls and changes nothing: it is only ever handed
	// to module code.
	const refuseEnded = () => runtime_refuseEndedAccess(slothlet, reader);
	const view = new NativeProxy(member, {
		get(target, prop) {
			refuseEnded();
			return asReader(() => {
				// An accessor a module placed on the namespace runs with the view as `this`, never the member behind it,
				// which acts for no reader at all (#625).
				const value = Reflect.get(target, prop, view);
				if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
				if (isFixed(Reflect.getOwnPropertyDescriptor(target, prop))) return value;
				// What the language's own prototypes give every object or function (`constructor`, `toString`) is no member of
				// the namespace: it reads as it is, as at an api node.
				if (runtime_inheritsBuiltin(target, prop)) return value;
				return runtime_frameworkViewOf(value, slothlet, reader, childPath(prop));
			});
		},
		getOwnPropertyDescriptor(target, prop) {
			refuseEnded();
			return asReader(() => {
				const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
				if (!descriptor || !descriptor.configurable) return descriptor;
				// An accessor's functions are members too: kept and called later, they run as the reader, and a
				// change to them is refused like any other.
				if (!("value" in descriptor)) {
					return {
						__proto__: null,
						...descriptor,
						get: runtime_frameworkViewOf(descriptor.get, slothlet, reader, childPath(prop)),
						set: runtime_frameworkViewOf(descriptor.set, slothlet, reader, childPath(prop))
					};
				}
				return { __proto__: null, ...descriptor, value: runtime_frameworkViewOf(descriptor.value, slothlet, reader, childPath(prop)) };
			});
		},
		apply(target, thisArg, args) {
			refuseEnded();
			// The receiver is passed as given: a view of the namespace stays the view, so a function a module placed on
			// it never gets the member behind it, which acts for no reader at all (#625).
			return asReader(() => Reflect.apply(target, thisArg, args));
		},
		construct(target, args, newTarget) {
			refuseEnded();
			return asReader(() => Reflect.construct(target, args, newTarget === view ? target : newTarget));
		},
		set(target, prop, value) {
			refuseEnded();
			refuseChange(prop);
			return asReader(() => Reflect.set(target, prop, unwrap(value)));
		},
		defineProperty(target, prop, descriptor) {
			refuseEnded();
			refuseChange(prop);
			return asReader(() => Reflect.defineProperty(target, prop, descriptor));
		},
		deleteProperty(target, prop) {
			refuseEnded();
			refuseChange(prop);
			return asReader(() => Reflect.deleteProperty(target, prop));
		},
		setPrototypeOf(target, proto) {
			refuseEnded();
			refuseChange(null);
			return asReader(() => Reflect.setPrototypeOf(target, proto));
		},
		preventExtensions(target) {
			refuseEnded();
			refuseChange(null);
			return asReader(() => Reflect.preventExtensions(target));
		},
		// `in`, and asking for the prototype or extensibility, answer as the member does while the instance runs. A bare
		// list of its names has no trap: with one the engine checks each fixed member against the member itself, which the
		// built-in rules refuse module code (a function's `prototype`). Listing with descriptors is refused above.
		has(target, prop) {
			refuseEnded();
			return Reflect.has(target, prop);
		},
		getPrototypeOf(target) {
			refuseEnded();
			return Reflect.getPrototypeOf(target);
		},
		isExtensible(target) {
			refuseEnded();
			return Reflect.isExtensible(target);
		}
	});
	WeakMapMethods.set(byReader, reader, view);
	WeakMapMethods.set(FRAMEWORK_VIEW_TARGETS, view, member);
	return view;
}

/**
 * The readers a framework view is running a use for right now, with no caller of its own
 * ({@link runtime_frameworkViewOf}); innermost last.
 * @type {object[]}
 * @private
 */
const VIEW_READER_RUNS = [];

/**
 * Run `use` as a framework view's use on behalf of `reader`, made with no caller of its own.
 * @param {object} reader - The reader the view belongs to.
 * @param {Function} use - The use.
 * @returns {*} What `use` returns.
 * @private
 */
function runtime_asViewReader(reader, use) {
	listPush(VIEW_READER_RUNS, reader);
	try {
		return use();
	} finally {
		ArrayMethods.pop(VIEW_READER_RUNS);
	}
}

/**
 * The module a framework view runs the executing code as, when that view was used with no caller of its
 * own (a function of `self.slothlet` a module kept, called later from outside any call) (#625).
 *
 * Run that way the code has no caller, which reads as "called from the host". What pins the caller
 * (`pin.caller`) pins this module instead, so a kept function never acts as the host.
 *
 * @param {object} slothlet - Instance the executing code runs in.
 * @returns {object|null} The reader's wrapper, or null when the executing code is no such use.
 * @internal
 *
 * @example
 * const pinned = metadata.callerWrapper() ?? runtime_frameworkViewCaller(slothlet);
 */
function runtime_frameworkViewCaller(slothlet) {
	if (VIEW_READER_RUNS.length === 0) return null;
	const reader = VIEW_READER_RUNS[VIEW_READER_RUNS.length - 1];
	// Only while the reader is what executes: a callback pinned to the host that the use runs is the host.
	return slothlet.contextManager.getCallerIdentity(slothlet.instanceID)?.currentWrapper === reader ? reader : null;
}

/**
 * What a definition's `valueOf` gives for an accessor definition, which stores no value (see {@link runtime_placingTrap}).
 * @type {symbol}
 * @private
 */
const NO_STORED_VALUE = Symbol("slothlet.noStoredValue");

/**
 * A proxy trap that writes a member of `wrapper`, wrapped so ownership follows what module code stores: a node the
 * write builds for an object or function belongs to the module owning the member, and a member the write creates is
 * recorded as the writing module's own once the write stands; a deleted member a module created is no one's (see
 * {@link ApiManager#writeOwnerOf}, {@link ApiManager#recordCreated}, {@link ApiManager#forgetCreated}). Host code, the
 * framework's own writes, the build, symbol keys and framework-reserved keys are written as the trap writes them.
 *
 * @param {object} wrapper - The node whose trap it is.
 * @param {function(...*): boolean} trap - The `set`, `defineProperty` or `deleteProperty` trap.
 * @param {?function(Array<*>): *} valueOf - The value the trap's arguments store; null for a deletion.
 * @returns {function(...*): boolean} The wrapped trap.
 * @private
 *
 * @example
 * const set = runtime_placingTrap(wrapper, setTrap, (args) => args[2]);
 */
function runtime_placingTrap(wrapper, trap, valueOf) {
	return (...args) => {
		const prop = args[1];
		const slothlet = wrapper.slothlet;
		if (
			typeof prop !== "string" ||
			isFrameworkReservedKey(prop) ||
			MapMethods.has(FRAMEWORK_WRITES, wrapper) ||
			slothlet.____buildDepth > 0
		)
			return FunctionMethods.apply(trap, undefined, args);
		const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
		const writer = identity && !identity.unresolved ? (identity.currentWrapper ?? null) : null;
		if (writer === null) return FunctionMethods.apply(trap, undefined, args);
		const internal = wrapper.____slothletInternal;
		const parts = filterList(splitText(String(internal.apiPath), "."), Boolean);
		listPush(parts, prop);
		const apiManager = slothlet.handlers.apiManager;
		if (valueOf === null) {
			const removed = FunctionMethods.apply(trap, undefined, args);
			if (removed) apiManager.forgetCreated(parts);
			return removed;
		}
		// An accessor defined on the node stores no value: it is read by running its getter, which no gate checks, and
		// nothing is created for anyone to own.
		const stored = valueOf(args);
		if (stored === NO_STORED_VALUE) return FunctionMethods.apply(trap, undefined, args);
		// The node loads first, as the trap would load it, so what it already holds is known and adopted as its own.
		if (internal.mode === "lazy" && !internal.state.materialized && !internal.state.inFlight) wrapper.___materialize();
		const placed = apiManager.writeOwnerOf(parts, writer);
		if (placed === null) return FunctionMethods.apply(trap, undefined, args);
		const priorOwner = internal.adoptOwner;
		internal.adoptOwner = placed.owner;
		let written;
		try {
			written = FunctionMethods.apply(trap, undefined, args);
		} finally {
			internal.adoptOwner = priorOwner;
		}
		if (written && placed.created) apiManager.recordCreated(parts, placed.owner, stored);
		return written;
	};
}

/**
 * Refuse a change a module makes below the top level of the api to a subtree it does not own (#625).
 *
 * `self.X.Y = …` reaches the wrapper at `self.X`, not the runtime `self` set trap, so the ownership rule
 * the top-level write follows ({@link ApiManager#assertOwnedWrite}) is applied here to the member's full
 * api path — or, for a change to the node itself (its prototype, its extensibility), to the node's own
 * path. The caller is the module executing now. Host code owns the whole tree, and a write the framework makes itself ({@link runtime_frameworkWrite})
 * is not the module's. A symbol key is never an api path of its own, but it is held to the same rule as a
 * string key: a change under one meets the rule of the node it is made on, so a module writes symbol-keyed
 * members only on nodes it owns.
 *
 * @param {object} wrapper - Wrapper receiving the change.
 * @param {string|symbol|null} prop - Member being written, or null for a change to the node itself.
 * @returns {void}
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED` when the executing module does not own the path, and
 *   `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing.
 * @private
 */
function runtime_assertOwnedWrite(wrapper, prop) {
	if (MapMethods.has(FRAMEWORK_WRITES, wrapper)) return;
	const parts = filterList(splitText(String(wrapper.____slothletInternal.apiPath), "."), Boolean);
	if (typeof prop === "string") listPush(parts, prop);
	runtime_assertOwnedWriteAt(wrapper, parts);
}

/**
 * The rule {@link runtime_assertOwnedWrite} applies, for a change at a full api path: the one a loaded node applies to
 * a change to its member, and a lazy stand-in to a change at the path it stands for, before the node has loaded (#653).
 *
 * @param {object} wrapper - A wrapper of the instance the change is made in.
 * @param {string[]} parts - Segments of the api path changed.
 * @returns {void}
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED`, `LOOSE_SET_UNATTRIBUTED`, or `PERMISSION_DENIED`, as
 *   {@link runtime_assertOwnedWrite}.
 * @private
 */
function runtime_assertOwnedWriteAt(wrapper, parts) {
	const slothlet = wrapper.slothlet;
	if (!slothlet.handlers.apiManager.writeChecked(parts)) return;
	// The executing call's identity, never the store's own caller field: under the live runtime that field
	// names whichever call entered last, which is not who is running once calls overlap.
	const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	// Code the live runtime cannot attribute to one of several suspended calls is module code with no
	// owner to check against: refused, rather than handed the host's standing.
	if (identity?.unresolved) {
		throw new wrapper.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
	}
	const caller = identity?.currentWrapper;
	if (!caller) return;
	// Code a caller supplied to another module's call writes only where every module it acts for owns (#597).
	for (let ofIndex = 0, ofList = concatLists([caller], identityCeilings(identity)); ofIndex < ofList.length; ofIndex++) {
		const writer = ofList[ofIndex];
		slothlet.handlers.apiManager.assertOwnedWrite(parts, writer);
	}
	// A function another module handed over to run, which runs none of that module's code (a bound built-in), makes the
	// write for that module too, which has to be allowed it.
	for (let actIndex = 0; actIndex < ACTING_FOR.length; actIndex++) {
		const actor = ACTING_FOR[actIndex];
		if (actor !== caller && actor.slothlet === slothlet) runtime_assertReaderWrite(slothlet, actor, caller, parts);
	}
}

/**
 * The access a node a module kept is making into the node it stands for, while it makes it: that node, and the
 * module the kept node reads for. Read once, by the check of that node it is making (see
 * {@link resolveEnforcedCaller}).
 * @type {{wrapper: object, reader: object}|null}
 * @private
 */
const rulesShared = {
	__proto__: null,
	capturedAccess: null,
	keptAccessorRead: null,
	describingAsHeld: null,
	handedEntry: null
};

/**
 * The access a node a module kept is making while a read it made runs one of the node's getters: the getter takes it
 * once, before any code of the module runs (#661).
 * @type {{wrapper: object, reader: object}|null}
 * @private
 */

/**
 * Take the access a kept node is making into `wrapper`, if it is making one, so no other check can.
 * @param {object} wrapper - The node being accessed.
 * @returns {{wrapper: object, reader: object}|null} The access, or `null`.
 * @private
 *
 * @example
 * const kept = runtime_takeCapturedAccess(wrapper);
 */
function runtime_takeCapturedAccess(wrapper) {
	if (rulesShared.capturedAccess?.wrapper !== wrapper) return null;
	const kept = rulesShared.capturedAccess;
	rulesShared.capturedAccess = null;
	return kept;
}

/**
 * Make an access into `wrapper` for `reader`, a module that kept a node standing for it: where the stack cannot
 * say who is accessing, the check of `wrapper` takes it as `reader`'s (#661).
 * @param {object} wrapper - The node being accessed.
 * @param {object} reader - The module the kept node reads for.
 * @param {function(): *} access - The access.
 * @returns {*} What the access gave.
 * @private
 *
 * @example
 * runtime_accessAsKept(inner, capturedCaller, () => Reflect.get(child, "n"));
 */
function runtime_accessAsKept(wrapper, reader, access) {
	const previous = rulesShared.capturedAccess;
	rulesShared.capturedAccess = { wrapper, reader };
	try {
		return access();
	} finally {
		rulesShared.capturedAccess = previous;
	}
}

/**
 * The node or view the next trap is entered on with an access handed to it (see {@link runtime_readWithAccess}).
 * @type {object|null}
 * @private
 */
let handedAccessKey = null;

/**
 * The access handed to that trap.
 * @type {{filled: boolean, done: boolean, manager: object|null, store: object|null|undefined, identity: object|undefined}|null}
 * @private
 */
let handedAccess = null;

/**
 * One access a module's code makes through a view (a member read, a description of a member): who is making it is
 * resolved at most once, by the first check of the access that asks, and every later check of the same access takes
 * that answer instead of reading the stack again.
 *
 * One access runs several of slothlet's traps, one inside another: the view of `self`, the view that keeps its reader,
 * the node. The code making the access is the same for all of them, as only slothlet's own code runs between the
 * outermost trap and each check. The answer never leaves the access: it travels only in the traps' own variables and
 * through a hand-over the next trap takes as it starts ({@link runtime_takeAccess}), so code that runs inside the
 * access (a getter, a module's Proxy, a listener) and makes an access of its own starts a new one, and the answer is
 * dropped when the trap that began the access returns ({@link runtime_endAccess}), so nothing kept from it answers
 * for a later access.
 * @returns {{filled: boolean, done: boolean, manager: object|null, store: object|null|undefined, identity: object|undefined}} The access.
 * @private
 *
 * @example
 * const access = runtime_beginAccess();
 * try {
 * 	return runtime_readWithAccess(access, inner, child, prop, child);
 * } finally {
 * 	runtime_endAccess(access);
 * }
 */
function runtime_beginAccess() {
	return { filled: false, done: false, manager: null, store: undefined, identity: undefined };
}

/**
 * End an access its trap began: its answer is no longer taken by anything that still holds it.
 * @param {object|null} access - The access.
 * @returns {void}
 * @private
 */
function runtime_endAccess(access) {
	if (access !== null) access.done = true;
}

/**
 * Take the access handed to a trap, as the trap starts and before any other code runs. Whatever was handed is
 * dropped, whether or not it was meant for this trap, so it reaches no trap entered later.
 * @param {object} key - The node's wrapper, or the view, the trap belongs to.
 * @returns {object|null} The access, or null when none was handed to this trap.
 * @private
 */
function runtime_takeAccess(key) {
	if (handedAccessKey === null) return null;
	const access = handedAccessKey === key ? handedAccess : null;
	handedAccessKey = null;
	handedAccess = null;
	return access;
}

/**
 * Who is making an access, as `contextManager.getCallerIdentity(instanceID)` answers it: resolved once per access.
 * An answer resolved on another store (a node of another instance reached inside the same access) is not taken.
 * @param {object|null} access - The access, or null to resolve it now.
 * @param {object|null|undefined} contextManager - The instance's context manager.
 * @param {string} [instanceID] - The instance the identity is read for, as `getCallerIdentity` takes it.
 * @returns {object|undefined} The identity.
 * @private
 */
function runtime_accessIdentity(access, contextManager, instanceID) {
	if (access === null || access.done || !contextManager?.tryGetContext || !contextManager.getCallerIdentity)
		return contextManager?.getCallerIdentity?.(instanceID);
	const store = contextManager.tryGetContext(instanceID);
	if (access.filled) {
		return access.manager === contextManager && access.store === store ? access.identity : contextManager.getCallerIdentity(instanceID);
	}
	const identity = contextManager.getCallerIdentity(instanceID);
	access.manager = contextManager;
	access.store = store;
	access.identity = identity;
	access.filled = true;
	return identity;
}

/**
 * The identity of an access with the store it was read on, in the form a permission check takes as resolved already
 * (see {@link resolveEnforcedCaller}), or null when the access gives none for this node.
 * @param {object|null} access - The access.
 * @param {object} wrapper - The node being checked.
 * @returns {{store: object|null|undefined, identity: object|undefined}|null} The resolved identity.
 * @private
 */
function runtime_accessEntry(access, wrapper) {
	if (access === null || access.done) return null;
	const contextManager = wrapper.slothlet.contextManager;
	if (!contextManager?.tryGetContext || !contextManager.getCallerIdentity) return null;
	const instanceID = wrapper.slothlet.instanceID;
	const identity = runtime_accessIdentity(access, contextManager, instanceID);
	if (access.manager !== contextManager || access.identity !== identity) return null;
	const store = contextManager.tryGetContext(instanceID);
	return access.store === store ? { store, identity } : null;
}

/**
 * An access whose identity its caller resolved already, on the store it read it from.
 * @param {object} contextManager - The context manager that resolved it.
 * @param {object|null|undefined} store - The store it was resolved on.
 * @param {object|undefined} identity - The identity.
 * @returns {object} The access.
 * @internal
 *
 * @example
 * runtime_selfView(value, undefined, null, runtime_resolvedAccess(liveRuntime, store, identity));
 */
function runtime_resolvedAccess(contextManager, store, identity) {
	return { filled: true, done: false, manager: contextManager, store, identity };
}

/**
 * Read a member of a node for an access, handing the access to the node's own trap. Only the node's current proxy is
 * handed it: its traps take what is handed as they start. Anything else is read as it is.
 * @param {object|null} access - The access.
 * @param {object} key - The wrapper of the node, or the view, whose trap takes it.
 * @param {object} target - The node or view read.
 * @param {string|symbol} prop - The member.
 * @param {*} receiver - The receiver.
 * @returns {*} The member.
 * @private
 */
function runtime_readWithAccess(access, key, target, prop, receiver) {
	if (access === null || access.done || !runtime_takesAccess(key, target)) return Reflect.get(target, prop, receiver);
	handedAccessKey = key;
	handedAccess = access;
	try {
		return Reflect.get(target, prop, receiver);
	} finally {
		handedAccessKey = null;
		handedAccess = null;
	}
}

/**
 * Describe a member of a node for an access, handing the access to the node's own trap (see
 * {@link runtime_readWithAccess}).
 * @param {object|null} access - The access.
 * @param {object} key - The wrapper of the node, or the view, whose trap takes it.
 * @param {object} target - The node or view described.
 * @param {string|symbol} prop - The member.
 * @returns {PropertyDescriptor|undefined} The descriptor.
 * @private
 */
function runtime_describeWithAccess(access, key, target, prop) {
	if (access === null || access.done || !runtime_takesAccess(key, target)) return Reflect.getOwnPropertyDescriptor(target, prop);
	handedAccessKey = key;
	handedAccess = access;
	try {
		return Reflect.getOwnPropertyDescriptor(target, prop);
	} finally {
		handedAccessKey = null;
		handedAccess = null;
	}
}

/**
 * Whether the first code a read or a description of `target` runs is a trap that takes a handed access: a view that
 * keeps its reader (keyed by itself), or the current proxy of the node `key` is the wrapper of.
 * @param {object} key - The view, or the node's wrapper.
 * @param {object} target - What is read.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_takesAccess(key, target) {
	if (key === target) return WeakMapMethods.has(capturedViewShadows, target);
	return key.____slothletInternal?.proxy === target;
}

/**
 * Resolve the enforcing caller identity for a permission-gated call/read, failing closed on an
 * absent or forged caller inside an active context.
 *
 * Verdicts:
 * - `"allow"` — permit without a rule check. Only two situations qualify: (a) no active context AND
 *   the instance's base store carries the {@link TRUSTED_ROOT} marker (a genuinely host-initiated
 *   call/read), or (b) the explicit `permissions.caller.anonymous` opt-out is set.
 * - `"deny"` — fail closed: a caller identity is expected but missing (context present, no
 *   `currentWrapper`) or forged (a `currentWrapper` not in {@link genuineWrappers}).
 * - `"enforce"` — a genuine inter-module caller is present; proceed to `enforceAccess`. Returns the
 *   `callerWrapper` and `ctx` for path resolution, and the `ceilings` when the caller is code supplied to
 *   another call (#597): that call has to be allowed as well, never instead.
 *
 * @param {object} wrapper - The target UnifiedWrapper being called/read.
 * @param {{currentWrapper: object, context: object}|null} [ctxOverride] - Explicit caller context
 *   (the read gate's waiting-proxy snapshot; `null` means "captured no caller"). Omitted for the live
 *   getContext() path.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making into this
 *   node, taken by the trap making the check (see {@link runtime_takeCapturedAccess}).
 * @param {{store: object|null, identity: object}|null} [preResolved=null] - A caller identity already resolved
 *   for this call, with the store it was read on; taken instead of reading either again.
 * @returns {{verdict: "allow"|"deny", identity?: object, ctx?: object}|{verdict: "enforce", callerWrapper: object, ceilings: ReadonlyArray<object>, ctx: object, identity: object}}
 *   The verdict, with the identity it was decided on and the store it was read from.
 * @private
 */
function resolveEnforcedCaller(wrapper, ctxOverride, kept = null, preResolved = null) {
	// Scope both the store and the caller lookup to THIS wrapper's instance. The context managers
	// are singletons shared by every instance, so an outer instance mid-call (e.g. a leaf booting a
	// second `slothlet()`) would otherwise be seen as this instance's caller and enforced against
	// this instance's rules — a cross-instance contamination the isolation contract forbids (#290).
	const ownInstanceID = wrapper.slothlet.instanceID;
	// A caller identity resolved earlier in this same call, before an await that would lose it (see
	// runtime_applyWithEntry), is taken as it was resolved.
	const ctx = preResolved
		? preResolved.store
		: ctxOverride !== undefined
			? ctxOverride
			: wrapper.slothlet.contextManager?.tryGetContext?.(ownInstanceID);
	// Ask the context manager who is calling rather than reading the store's `currentWrapper`.
	// Under the live runtime that field is a single slot shared by every in-flight call, so a call
	// resuming from an `await` can read another module's identity; the manager disambiguates. An
	// explicit `ctxOverride` is already a snapshot of one reader, so it is taken as given.
	let identity = preResolved
		? preResolved.identity
		: ctxOverride !== undefined
			? ctxOverride
			: wrapper.slothlet.contextManager?.getCallerIdentity?.(ownInstanceID);
	// Identity was ambiguous and could not be attributed. Deny outright — falling through to the
	// absent-caller branch below would hand it the host-initiated exemption, which is precisely
	// the privilege it must not inherit. This is context-live's ambiguous answer: two api paths of one
	// module suspended and resuming in a file they share, with no frame to tell them apart (#512). Only
	// code no suspended call accounts for, reaching in through a node a module kept, is settled by it: the
	// access is that module's, and no more than it may do (#661). A tie between calls stays refused.
	if (identity?.unresolved) {
		if (!kept || !identity.unaccounted) return { verdict: "deny", identity, ctx };
		identity = { currentWrapper: kept.reader };
	}
	const callerWrapper = identity?.currentWrapper;
	if (!callerWrapper) {
		// No active module caller. Allow only a genuinely host-initiated call/read: the resolved
		// context carries the trusted-root marker. That marker lives on the instance's base store and
		// is propagated onto scope stores descended from it (host-level `run()`/`scope()`), but never
		// onto a module's execution store — so a stripped/forged context with no caller fails closed.
		// `ctx` is the live/scope store in live mode or inside a run(); when there is no active context
		// (async mode outside a call, `ctx` null) fall back to the instance's base store.
		// A run's store put back for work the run left behind stands for the instance's own: the work keeps the run's
		// context, never the run's standing (see `reopenFlowStore` in context-live).
		const instances = wrapper.slothlet.contextManager?.instances;
		const store =
			ctx && ctx[trustedRootOwn.REOPENED_FLOW] !== true
				? ctx
				: instances
					? MapMethods.get(instances, wrapper.slothlet.instanceID)
					: undefined;
		if (store && store[trustedRootOwn.TRUSTED_ROOT] === true) return { verdict: "allow", identity, ctx };
		if (wrapper.slothlet.config?.permissions?.caller?.anonymous) return { verdict: "allow", identity, ctx };
		return { verdict: "deny", identity, ctx };
	}
	// A caller identity is present but not a genuine wrapper — a forged object. Fail closed.
	if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, callerWrapper)) return { verdict: "deny", identity, ctx };
	// Code a caller supplied to another call runs as the supplier, and the call it runs inside has to allow
	// the access too, as does every call of its ceiling (#597). A ceiling that is not a genuine wrapper is forged
	// like a caller would be.
	const ceilings = identityCeilings(identity);
	for (let i = 0; i < ceilings.length; i++)
		if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, ceilings[i])) return { verdict: "deny", identity, ctx };
	return { verdict: "enforce", callerWrapper, ceilings, ctx, identity };
}

/**
 * Gate a read of what a node reports about itself (`slothlet.node(target)`) as a read of the node's own path.
 *
 * @description
 * The report is the framework's, not a member of the module, so it is checked against the node's path: a reader the
 * rules let read the node is answered, and one they deny it is refused, the name of the report taking no part. Off
 * while permissions or read gating are off, as every read gate is.
 * @param {object} wrapper - The node's wrapper (for a stand-in, its node's wrapper).
 * @param {string} nodePath - The node's api path.
 * @param {{currentWrapper: object, ceiling: *, context: object|null}|undefined} callerOverride - The reader, or
 *   undefined for the live caller.
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the rules deny the reader the node.
 * @private
 *
 * @example
 * runtime_enforceNodeReportRead(inner, "d.fn", { currentWrapper: reader, ceiling: null, context });
 */
function runtime_enforceNodeReportRead(wrapper, nodePath, callerOverride) {
	const pm = wrapper.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return;
	const decision = runtime_readGateDecision(wrapper, nodePath, callerOverride);
	if (decision.allowed) return;
	throw new wrapper.SlothletError("PERMISSION_DENIED", {
		caller: decision.caller,
		target: segmentsOf(nodePath)
	});
}

/**
 * Enforce read-level permission gating for a property read off a module API path.
 *
 * Default-on whenever permissions are configured; opt out via `permissions.gating.read: false`. Gates **terminal data values** — primitives
 * and built-in objects (`Buffer`, every `TypedArray` view, `ArrayBuffer`, `DataView`,
 * `Map`, `Set`, `WeakMap`, `WeakSet`, `Date`, `RegExp`, `Promise`, `Error`). Plain
 * objects, arrays, and functions become child namespace/callable `UnifiedWrapper`
 * proxies and are left ungated, so namespace traversal stays free and calls are
 * gated by `applyTrap`. External reads (no caller context) are exempt, mirroring
 * call enforcement. Shared by the `getTrap` chokepoints and the waiting-proxy
 * resolver so eager and lazy reads are gated identically.
 *
 * @param {object} wrapper - Parent UnifiedWrapper whose property is being read.
 * @param {string|symbol} prop - Property name being read.
 * @param {*} resolvedValue - The value about to be returned to the reader.
 * @param {{currentWrapper: object, context: object}|null} [callerOverride] - Explicit
 *   caller context. Supplied by the waiting-proxy resolver, which snapshots the
 *   reader's live store during synchronous chain traversal at proxy-creation time —
 *   the chain walk runs inside the caller's body, so the store still reflects the
 *   actual reader. The waitingProxyCache is keyed by caller identity AND bucketed
 *   per-request-context (WeakMap by `context` object) so different modules — or the
 *   same module under different `context.run({...}, …)` scopes — never share one
 *   snapshot; this keeps conditional rules evaluating against the correct context.
 *   Omitted for synchronous getTrap reads, which read the live context directly.
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the read is denied by a rule.
 * @private
 */
function runtime_enforceReadGate(wrapper, prop, resolvedValue, callerOverride, kept = null, access = null) {
	const pm = wrapper.slothlet.handlers?.permissionManager;
	// Cheap short-circuit first: skip all classification work when gating is off.
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return;
	if (!runtime_isTerminalData(resolvedValue)) return;
	// A function's own `name` and `length` are read as plain JS reads them, whatever the rules say of the function.
	if (runtime_isBuiltinFunctionMember(wrapper, prop)) return;

	const targetPath = runtime_memberPathOf(wrapper, prop);
	const decision = runtime_readGateDecision(wrapper, targetPath, callerOverride, kept, access);
	if (decision.allowed) return;
	throw new wrapper.SlothletError("PERMISSION_DENIED", {
		caller: decision.caller,
		target: segmentsOf(targetPath)
	});
}

/**
 * Resolve the read-gate verdict for `targetPath`, emitting the usual audit events.
 *
 * getTrap reads use the live context; the waiting-proxy resolver passes an explicit caller
 * (the context store, or null) captured when the proxy was created. Fail closed on an absent
 * or forged caller inside an active context; host-initiated reads stay allowed via
 * trusted-root. Routed through `enforceAccess` (not the silent `checkAccess`) so every denial
 * — including one that only redacts a key from enumeration — emits `permission:denied`.
 *
 * @param {object} wrapper - Parent UnifiedWrapper whose property is being read.
 * @param {string} targetPath - Fully-qualified api path of the value being read.
 * @param {{currentWrapper: object, context: object}|null} [callerOverride] - Explicit caller context.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @param {object|null} [access] - The access the read is part of.
 * @param {{store: object|null|undefined, identity: object|undefined}|null} [pinned] - The reader resolved earlier,
 *   when the read is answered after the access that made it has ended (see {@link runtime_pinReader}).
 * @param {"read"|"call"} [operation="read"] - The operation decided, by the rules whose access level covers it: a
 *   read, or the call running a getter is.
 * @returns {{allowed: boolean, caller: string|null}} Verdict and the resolved caller path.
 * @private
 */
function runtime_readGateDecision(wrapper, targetPath, callerOverride, kept = null, access = null, pinned = null, operation = "read") {
	// #283: slothlet's OWN reserved marker keys (____isVersionDispatcher/____logicalPath) are framework
	// machinery, not a consumer's module-private member. When they are carried by a branded
	// framework-internal wrapper (a version dispatcher, or a wrapper it merged into), exempt reads of
	// exactly those keys — by OBJECT IDENTITY, never by name. A consumer member of the same name lives
	// on a NON-branded wrapper and stays denied by the #269 host-privacy rule.
	if (isFrameworkInternal(wrapper)) {
		// slice(lastIndexOf + 1) yields the terminal segment, and the whole string when there is no
		// dot (lastIndexOf → -1 → slice(0)) — no separate branch needed.
		const leafKey = StringMethods.slice(targetPath, StringMethods.lastIndexOf(targetPath, ".") + 1);
		if (isFrameworkMarkerKey(leafKey)) return { allowed: true, caller: null };
	}
	// The live caller of an access that resolved it already is taken as resolved; an explicit caller is never replaced.
	const decision = resolveEnforcedCaller(
		wrapper,
		callerOverride,
		kept,
		callerOverride === undefined ? (pinned ?? runtime_accessEntry(access, wrapper)) : null
	);
	if (decision.verdict === "allow") {
		// Host-initiated, normally exempt — but a module-private target still routes through
		// enforcement so the `permissions.private.host` policy applies and is audited (#260).
		const hostPm = wrapper.slothlet.handlers.permissionManager;
		if (
			hostPm.isPrivateTarget?.(targetPath) &&
			!hostPm.enforceAccess(null, targetPath, null, wrapper.____slothletInternal.filePath, null)
		) {
			return { allowed: false, caller: null };
		}
		return { allowed: true, caller: null };
	}
	if (decision.verdict === "deny") return { allowed: false, caller: null };
	const { callerWrapper, ceilings, ctx } = decision;
	// Code of a module that is gone is allowed no call: the rules naming its old path are another module's now (#625).
	if (wrapper.slothlet.handlers.apiManager.isRemovedCaller(callerWrapper)) {
		return { allowed: false, caller: String(callerWrapper.____slothletInternal.apiPath ?? "") };
	}
	let verdict = runtime_readGateFor(wrapper, targetPath, callerWrapper, ctx, operation);
	// Both the supplier of the code reading and every call of its ceiling have to be allowed (#597).
	for (let i = 0; i < ceilings.length; i++) {
		const ceiling = ceilings[i];
		if (!verdict.allowed) return verdict;
		verdict = runtime_readGateFor(wrapper, targetPath, ceiling, ctx, operation);
	}
	return verdict;
}

/**
 * The read gate's verdict for one caller.
 * @param {object} wrapper - Parent UnifiedWrapper whose property is being read.
 * @param {string} targetPath - Fully-qualified api path of the value being read.
 * @param {object} callerWrapper - The caller to check.
 * @param {object|null} ctx - The caller's context store.
 * @param {"read"|"call"} [operation="read"] - The operation decided (see {@link runtime_readGateDecision}).
 * @returns {{allowed: boolean, caller: string|null}} Verdict and the caller's path.
 * @private
 */
function runtime_readGateFor(wrapper, targetPath, callerWrapper, ctx, operation = "read") {
	// The ?./?? fallbacks are defensive — apiPath/filePath are always set on live wrappers.
	/* v8 ignore start */
	const callerPath = callerWrapper.____slothletInternal?.apiPath ?? "";
	const callerFilePath = callerWrapper.____slothletInternal?.filePath ?? null;
	const targetFilePath = wrapper.____slothletInternal.filePath ?? null;
	/* v8 ignore stop */

	// `ctx.context ?? null` — the `?? null` fallback is defensive; the contextManager
	// always supplies a `.context` (at minimum `{}`), so the null branch is unreachable
	// in practice, parallel to the v8-ignored defensives above.
	const allowed = wrapper.slothlet.handlers.permissionManager.enforceAccess(
		callerPath,
		targetPath,
		callerFilePath,
		targetFilePath,
		/* v8 ignore next */
		ctx.context ?? null,
		null,
		operation === "read" ? runtime_dataReadOptions(wrapper.slothlet) : null
	);
	return { allowed, caller: callerPath };
}

/**
 * Who is reading, for an accessor run while a read is completed on a reader's behalf after the reader's own flow is
 * gone (a lazy chain resolving after an await): that reader's snapshot, `null` for the host, or `undefined` when the
 * read is the live flow's own.
 * @type {object|null|undefined}
 * @private
 */
let accessorReader = undefined;

/**
 * Make a read on a reader's behalf: any accessor it runs takes `reader` as who is reading (see {@link accessorReader}).
 * @template T
 * @param {object|null} reader - The reader's identity snapshot, or null for the host.
 * @param {function(): T} read - The read.
 * @returns {T} What the read returned.
 * @private
 */
function runtime_readOnBehalf(reader, read) {
	const previous = accessorReader;
	accessorReader = reader;
	try {
		return read();
	} finally {
		accessorReader = previous;
	}
}

/**
 * Run a module's getter or setter as the module it belongs to, the way a call to one of its functions through `self`
 * runs (#597): the reader has to be allowed to call the node holding it, and the node is who runs, with no ceiling
 * from whoever reads or writes (see {@link runtime_runAsMaker}).
 *
 * @param {object} wrapper - The wrapper holding the accessor.
 * @param {Function} accessor - The getter or setter.
 * @param {*} thisArg - Its receiver.
 * @param {Array<*>} args - Its arguments.
 * @param {boolean} [attribute=true] - Hand what it returns back as the module's (see {@link runtime_attributeResult}).
 * @returns {*} What it returned.
 * @throws {SlothletError} PERMISSION_DENIED when who is reading cannot be told.
 * @private
 */
function runtime_runAccessor(wrapper, accessor, thisArg, args, attribute = true) {
	const contextManager = wrapper.slothlet.contextManager;
	if (!contextManager?.runInContext || !wrapper.slothlet.instanceID) return Reflect.apply(accessor, thisArg, args);
	const reader = accessorReader !== undefined ? accessorReader : contextManager.getCallerIdentity?.(wrapper.slothlet.instanceID);
	// Code no call accounts for reads only through a node a module kept, as that module (#661).
	let kept = null;
	if (accessorReader === undefined && reader?.unresolved && reader.unaccounted) {
		if (rulesShared.keptAccessorRead?.wrapper === wrapper) {
			kept = rulesShared.keptAccessorRead;
			rulesShared.keptAccessorRead = null;
		} else kept = runtime_takeCapturedAccess(wrapper);
	}
	if (reader?.unresolved && !kept) {
		throw new wrapper.SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(wrapper.____slothletInternal.apiPath) });
	}
	// Running it is calling the module's code, so the reader has to be allowed to call the node, as a call through
	// `self` is checked (a reader completed on behalf of is checked as that reader).
	if (accessorReader === undefined) enforcePermission(wrapper, args, false, kept);
	else if (accessorReader?.currentWrapper) runtime_enforceAccessorReader(wrapper, accessorReader, args);
	return runtime_runAsMaker(wrapper, accessor, thisArg, args, attribute, true);
}

/**
 * Check a reader whose read is completed on its behalf (see {@link accessorReader}) may call the node whose accessor
 * the read runs, and every call of the ceiling it read under (#597).
 * @param {object} wrapper - The node's wrapper.
 * @param {object} reader - The reader's identity snapshot.
 * @param {Array<*>} args - The accessor's arguments.
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when it may not.
 * @private
 */
function runtime_enforceAccessorReader(wrapper, reader, args) {
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager?.isEnabled()) return;
	const targetPath = wrapper.____slothletInternal.apiPath;
	const runtimeContext = reader.context ?? null;
	for (let ofIndex = 0, ofList = concatLists([reader.currentWrapper], identityCeilings(reader)); ofIndex < ofList.length; ofIndex++) {
		const caller = ofList[ofIndex];
		runtime_enforceCallAs(wrapper, permissionManager, caller, targetPath, runtimeContext, { args, target: targetPath }, false);
	}
}

/**
 * Check that whoever reads a member of a node holding the module's code — a static method, a function's own
 * `prototype` and the methods on it, a member the module defined on its function — may call the node (#632). The
 * member is handed out as it is, not as a node of its own, so it carries no gate when it is called: reading it is
 * where the node's own call check is made, as running one of the node's getters is (see {@link runtime_runAccessor}).
 * Data, the language's own values and slothlet's own nodes are read as before.
 * @param {object} wrapper - The node's wrapper.
 * @param {*} value - The member read.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not call the node.
 * @private
 */
function runtime_enforceCodeMember(wrapper, value, kept = null) {
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager?.isEnabled()) return;
	if (!runtime_memberHoldsCode(value, searchDepth(wrapper.slothlet) + 1, searchBudget(wrapper.slothlet))) return;
	if (accessorReader === undefined) enforcePermission(wrapper, [], false, kept);
	else if (accessorReader?.currentWrapper) runtime_enforceAccessorReader(wrapper, accessorReader, []);
}

/**
 * The accessor a wrapper's impl holds or inherits for a key, found by descriptors alone so nothing of the impl's
 * runs to find it (#597): `{ descriptor }` for an accessor adoption did not put there, `{ proxy: true }` when the
 * walk reaches a module's own Proxy before any descriptor (its traps answer the key), and null otherwise —
 * a data member, no member, or `Object.prototype`'s own accessors (`__proto__`), which are left as they are.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @returns {{descriptor?: PropertyDescriptor, receiver?: object, proxy?: boolean}|null} What answers the key, with the
 *   receiver an accessor runs on.
 * @private
 */
function runtime_implAccessor(wrapper, prop) {
	// What the accessor runs on: the impl, or the value under a composition layer that answers the key (see
	// layerForwards), as plain JS would read the key there.
	let receiver = wrapper.____slothletInternal.impl;
	try {
		for (
			let holder = wrapper.____slothletInternal.impl, depth = 0;
			holder !== null && holder !== undefined && holder !== Objects.prototype && depth < 64;
			depth++
		) {
			// A module's own Proxy, or the stand-in slothlet hands it out as (#597), behind a composition layer or not, answers
			// with the module's traps: reading through it is a run of the module's code (#632).
			if (util.types.isProxy(holder)) {
				if (runtime_isModuleProxy(holder) || runtime_isModuleStandIn(holder)) return { proxy: true };
				// A composition layer over a plain value (named exports put onto a module's instance) answers a key it
				// neither holds nor hides from that value, which its getters and setters then run on, as on the value
				// itself (#632).
				if (!layerForwards(holder, prop)) return null;
				holder = layerUnderlying(holder);
				receiver = holder;
				continue;
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (descriptor) {
				const adopted = WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.get) || WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.set);
				return !adopted && (typeof descriptor.get === "function" || typeof descriptor.set === "function") ? { descriptor, receiver } : null;
			}
			holder = Reflect.getPrototypeOf(holder);
		}
	} catch {
		// An exotic holder that refuses to be described is used as it is.
	}
	return null;
}

/**
 * What a frozen function node or function root holds fixed for a member holding the module's code (its `prototype`, a
 * static method): a stand-in for the value, every use of which is checked as a call of the node, for whoever makes it.
 * A frozen object must describe each member it holds as it holds it, to every reader, so `Object.keys`, `for…in` and
 * `Object.isFrozen` hand the description of every member to whoever lists the node. Holding the value itself, that
 * description had to be refused to a reader that may not call the node, and the listing with it. The stand-in can be
 * described to anyone: the host and a module that may call the node use it as the value, and a module that may not is
 * refused each read, call or change made through it, as it is refused reading the member.
 * @param {object} gate - The node's wrapper, or the api root's stand-in for the gate (see {@link runtime_rootGate}).
 * @param {object|Function} value - The member's value.
 * @returns {object|Function} The stand-in.
 * @private
 *
 * @example
 * Object.freeze(api.math.Calc);
 * Object.keys(self.math.Calc); // [] to a module that may not call it, no longer refused
 * self.math.Calc.prototype; // still refused
 */
function runtime_pinnedCodeMember(gate, value) {
	return runtime_checkedStandIn(() => runtime_enforceCodeMember(gate, value), value);
}

/**
 * Read a member of a wrapper's impl, running an accessor it holds or inherits as the module the node belongs to (see
 * {@link runtime_runAccessor}) rather than as whoever reads it (#597), and a module's Proxy among them likewise.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @returns {*} The member's value.
 * @private
 */
function runtime_readImplMember(wrapper, prop) {
	const impl = wrapper.____slothletInternal.impl;
	// A member the module's object inherits from a prototype set on it is read as the object reads it (#757).
	const inherited = runtime_moduleInheritance(wrapper, prop);
	if (inherited !== null) return Reflect.get(inherited, prop, wrapper.____slothletInternal.proxy ?? wrapper);
	// A member the node inherits from a prototype given to it is read from there, on the node, as plain JS reads it.
	// While the node's prototype is its value's own, the value answers for what it inherits, below.
	const prototype = runtime_prototypeGiven(wrapper) ? runtime_inheritsFrom(wrapper, prop) : undefined;
	if (prototype !== undefined) {
		return prototype === null ? undefined : Reflect.get(prototype, prop, wrapper.____slothletInternal.proxy ?? wrapper);
	}
	const accessor = runtime_implAccessor(wrapper, prop);
	if (accessor?.proxy) return runtime_runAccessor(wrapper, () => impl[prop], undefined, [], true);
	if (accessor)
		return typeof accessor.descriptor.get === "function"
			? runtime_runAccessor(wrapper, accessor.descriptor.get, accessor.receiver, [])
			: undefined;
	return impl[prop];
}

/**
 * Write a member of a wrapper's impl, running a setter it holds or inherits as the module the node belongs to (see
 * {@link runtime_runAccessor}) rather than as whoever writes (#597), and a module's Proxy among them likewise. An
 * accessor with no setter refuses the write, as on the object.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - What to write.
 * @returns {boolean} Whether the write succeeded.
 * @private
 */
function runtime_writeImplMember(wrapper, prop, value) {
	const impl = wrapper.____slothletInternal.impl;
	const accessor = runtime_implAccessor(wrapper, prop);
	if (accessor?.proxy) return runtime_runAccessor(wrapper, () => Reflect.set(impl, prop, value), undefined, []);
	if (!accessor) return Reflect.set(impl, prop, value);
	if (typeof accessor.descriptor.set !== "function") return false;
	runtime_runAccessor(wrapper, accessor.descriptor.set, accessor.receiver, [value]);
	return true;
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
function runtime_gateDataNodeMember(wrapper, prop, kept, access) {
	if (prop === "then" || isFrameworkReservedKey(prop)) return;
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager || !permissionManager.isEnabled() || !permissionManager.isReadGatingEnabled()) return;
	const impl = wrapper.____slothletInternal.impl;
	// A primitive a loaded node holds (a lazy folder kept before it loaded as one) is data like a built-in (#797).
	if (runtime_nodePrimitive(wrapper) !== NO_NODE_PRIMITIVE) {
		runtime_gateNodeValue(wrapper, kept, access);
		return;
	}
	if (impl === null || typeof impl !== "object") return;
	let isData = WeakMapMethods.get(DATA_NODE_IMPLS, impl);
	if (isData === undefined) {
		isData = !util.types.isProxy(impl) && runtime_isTerminalData(impl);
		WeakMapMethods.set(DATA_NODE_IMPLS, impl, isData);
	}
	if (!isData) return;
	runtime_gateNodeValue(wrapper, kept, access);
}

/**
 * Gate a read of the value a node stands for as a read of the node's own path.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {{wrapper: object, reader: object}|null} kept - The access a node a module kept is making.
 * @param {object|null} access - The access the read is part of.
 * @param {object|null} [pinned] - The reader resolved earlier (see {@link runtime_pinReader}).
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the rules deny the reader the node.
 * @private
 */
function runtime_gateNodeValue(wrapper, kept, access, pinned = null) {
	const targetPath = wrapper.____slothletInternal.apiPath;
	const decision = runtime_readGateDecision(wrapper, targetPath, undefined, kept, access, pinned);
	if (decision.allowed) return;
	throw new wrapper.SlothletError("PERMISSION_DENIED", { caller: decision.caller, target: segmentsOf(targetPath) });
}

/**
 * The reader of an access, resolved now, for a read answered once the access has ended (an `await` of a lazy node,
 * answered after the load). Null while permissions or read gating are off.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object|null} access - The access.
 * @returns {{store: object|null|undefined, identity: object|undefined}|null} The reader.
 * @private
 */
function runtime_pinReader(wrapper, access) {
	const pm = wrapper.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return null;
	const entry = runtime_accessEntry(access, wrapper);
	if (entry) return entry;
	const contextManager = wrapper.slothlet.contextManager;
	const instanceID = wrapper.slothlet.instanceID;
	return {
		store: contextManager?.tryGetContext?.(instanceID),
		identity: contextManager?.getCallerIdentity?.(instanceID)
	};
}

/**
 * Whether each value a node holds is built-in data or an error ({@link runtime_gateDataNodeMember}), decided once per
 * value: what a value is does not change.
 * @type {WeakMap<object, boolean>}
 * @private
 */
const DATA_NODE_IMPLS = new WeakMap();

/**
 * Write a member of the module's object a node fronts, as the same assignment to the object does (#746). Only the
 * object's own members are touched: a new key becomes an ordinary member of it, and a setter the module has put there
 * since the node was built runs on the object as the module the node belongs to, never as the writer (#597).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} object - The module's object (see {@link runtime_moduleObjectOf}).
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - What to write.
 * @returns {boolean} Whether the object took the write.
 * @private
 */
function runtime_writeModuleObject(wrapper, object, prop, value) {
	const held = Reflect.getOwnPropertyDescriptor(object, prop);
	if (held === undefined) {
		const added =
			Reflect.isExtensible(object) &&
			Reflect.defineProperty(object, prop, { __proto__: null, value, writable: true, enumerable: true, configurable: true });
		if (added && typeof prop === "string") SetMethods.add(runtime_moduleObjectKeys(object), prop);
		return added;
	}
	if ("value" in held) return held.writable === true && Reflect.defineProperty(object, prop, { __proto__: null, value });
	if (typeof held.set !== "function") return false;
	runtime_runAccessor(wrapper, held.set, object, [value]);
	return true;
}

/**
 * Run an operation on a wrapper's impl — a key check, a description, a listing — as the module the node belongs to
 * when the impl is a module's own Proxy, whose traps are that module's code (#597); otherwise as it is.
 * @template T
 * @param {object} wrapper - The node's wrapper.
 * @param {function(object): T} operation - The operation, handed the impl.
 * @returns {T} What it returned.
 * @private
 */
function runtime_onImpl(wrapper, operation) {
	const impl = wrapper.____slothletInternal.impl;
	return runtime_isModuleProxy(impl) ? runtime_runAccessor(wrapper, () => operation(impl), undefined, [], true) : operation(impl);
}

/**
 * An impl's own accessor descriptor as the node describes it (#597): each half the node did not adopt is adopted
 * (see {@link runtime_adoptAccessor}), so a getter or setter taken from the description and run anywhere runs as the
 * module the node belongs to. A data descriptor is returned as it is.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyDescriptor|undefined} descriptor - The impl's descriptor.
 * @returns {PropertyDescriptor|undefined} The descriptor to report.
 * @private
 */
function runtime_describeImplMember(wrapper, descriptor) {
	if (!descriptor || (typeof descriptor.get !== "function" && typeof descriptor.set !== "function")) return descriptor;
	const adopted = runtime_adoptAccessor(wrapper, descriptor);
	return { __proto__: null, ...descriptor, get: adopted.get, set: adopted.set };
}

/**
 * The definer of the code making a call while no call runs (#726): when the frames tell it is a module's code (a
 * function the module handed out, run by the host), that code's definer, the nearest leaf frame of its file or the
 * file's module. Null while a call runs, for the host's own code, with the permission system off or `provenance` off,
 * and for code of another instance. With `unaccounted`, code the live runtime finds no call for is read the same way.
 * @param {object} slothlet - The instance of the node called.
 * @param {boolean} [unaccounted=false] - Read code no call accounts for by its frames too.
 * @param {{store?: object|null, identity?: object}|null} [resolved=null] - Receives the caller identity this read
 *   resolved and the store it resolved it on, as {@link runtime_liveEntry} gives them, so a call made right after
 *   takes it instead of reading it again.
 * @param {{ceiling?: object|ReadonlyArray<object>|null}|null} [held=resolved] - Receives, as `ceiling`, who else the
 *   code is held to.
 * @returns {object|null} The definer's wrapper.
 * @private
 */
function runtime_hostRunDefiner(slothlet, unaccounted = false, resolved = null, held = resolved) {
	const contextManager = slothlet?.contextManager;
	if (!contextManager?.runInContext || !slothlet.handlers?.permissionManager?.isEnabled?.()) return null;
	if (slothlet.config?.permissions?.caller?.provenance === false) return null;
	const identity = contextManager.getCallerIdentity?.(slothlet.instanceID);
	if (resolved && identity) {
		resolved.store = contextManager.tryGetContext?.(slothlet.instanceID) ?? null;
		resolved.identity = identity;
	}
	if (identity?.currentWrapper || (identity?.unresolved && !(unaccounted && identity.unaccounted))) return null;
	const definer = frameDefiner(contextManager.runningInstanceID?.() ?? null);
	// Code of a file several running instances hold, with nothing naming which of them is running, or code at a file of
	// theirs running in a script that is not the file's: it names some module's file, so it is not run as the host's.
	if (definer?.shared || definer?.foreign) throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf("self") });
	const leaf = definer?.wrapper;
	if (!leaf || leaf.slothlet !== slothlet) return null;
	// The others the code is held to as well: the leaves further out on the stack, and, for a helper file's own code,
	// every other module importing the helper.
	if (held && definer.callers?.length) held.ceiling = Reflect.apply(combineCeilings, undefined, definer.callers);
	return leaf;
}

/**
 * A call made through a node a module read while no call runs (#726): when the code making it is a module's (see
 * {@link runtime_hostRunDefiner}), the call is entered as that code's definer, as the `self` read that reached the node
 * was, so the target's `metadata.caller()` names the identity its checks used. Anywhere else the call is made as it is.
 * @param {object} target - The wrapper of the node called.
 * @param {Function} call - Makes the call.
 * @returns {Function} What makes the call.
 * @private
 */
function runtime_callAsDefiner(target, call) {
	return () => {
		const slothlet = target.slothlet;
		// A caller identity already handed to the call (one resolved before an await) stands.
		const resolved = rulesShared.handedEntry !== null && rulesShared.handedEntry.wrapper === target ? null : {};
		const held = {};
		const leaf = runtime_hostRunDefiner(slothlet, false, resolved, held);
		const instanceID = leaf ? runtime_makerInstanceID(slothlet) : null;
		// The call is made as it is, by the code whose identity was just read: the target's gate takes that identity
		// as it starts, with nothing but slothlet's own code run in between, instead of reading the stack again.
		if (instanceID === null) return resolved?.identity ? runtime_applyWithEntry(target, resolved, call) : call();
		return slothlet.contextManager.runInContext(
			instanceID,
			call,
			undefined,
			[],
			leaf,
			true,
			false,
			held.ceiling ?? null,
			null,
			false,
			true
		);
	};
}

/**
 * Whether a member of a value can hold a module's code, as {@link runtime_holdsCode} reads one.
 * @param {*} member - The member.
 * @param {number} depth - Levels still allowed below the value.
 * @param {{remaining: number}} budget - Properties still allowed.
 * @returns {boolean} True when it can hold code.
 * @private
 */
function runtime_memberHoldsCode(member, depth, budget) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return false;
	if (runtime_isSlothletValue(member) || WeakSetMethods.has(INTRINSICS, member) || runtime_isSharedValue(member)) return false;
	if (util.types.isProxy(member)) return true;
	if (typeof member === "function") return !runtime_isBuiltinFunction(member);
	return runtime_holdsCode(member, depth - 1, budget);
}

/**
 * Refuse a call of a stand-in whose function is a module's copy of a node's own function (see `leafOfCopy` in
 * `handlers/frame-placement`) when the node's rules refuse the caller: a module that imports or requires a leaf's file
 * itself holds the file's function under a module of its own, and running it is a call of the node however it was
 * reached. Checked as a call of the node is, for the live caller and every call it runs inside; nothing is checked
 * while the permission system is off or disabled, or for any other function.
 * A view over a node's own function itself (a crossing view another module was handed) is checked the same way, with
 * `ownToo`; a stand-in never stands for one (handing it out gives the node).
 * @param {object} slothlet - The instance.
 * @param {*} original - The function the stand-in stands for.
 * @param {ArrayLike<*>} args - The call's arguments, as the caller passed them.
 * @param {*} thisArg - The call's receiver.
 * @param {boolean} [ownToo=false] - Check a node's own function as well.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when the node's rules refuse the call.
 * @private
 */
function runtime_gateLeafCopy(slothlet, original, args, thisArg, ownToo = false) {
	if (typeof original !== "function" || !slothlet?.handlers?.permissionManager?.isEnabled?.()) return;
	const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, original);
	if (leaf !== undefined) {
		if (ownToo && WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) && leaf.slothlet === slothlet)
			enforcePermission(leaf, args, false, null, null, null, thisArg);
		return;
	}
	const node = leafOfCopy(slothlet, original);
	if (node === null) return;
	enforcePermission(node, args, false, null, null, null, thisArg);
}

/**
 * A member of the runtime `context` read by code a module handed out while no call runs (the host running a closure, a
 * method of returned data, a generator): read in the context of the instance its definer belongs to, as `self` is
 * ({@link runtime_selfReadAsDefiner}), so the code reads the context it was made in instead of nothing. Code whose
 * definer the frames cannot tell, the host's own code, and any code while `provenance` is off, read nothing.
 * @param {object} contextProxy - The runtime's `context`.
 * @param {string|symbol} prop - The member read.
 * @returns {*} The member, or undefined.
 * @internal
 *
 * @example
 * if (!ctx) return runtime_contextReadAsDefiner(context, prop);
 */
function runtime_contextReadAsDefiner(contextProxy, prop) {
	const definer = frameDefiner();
	if (definer === null || definer.unplaced) return undefined;
	const leaf = definer.wrapper ?? definer.leaves[0];
	const slothlet = leaf?.slothlet;
	if (slothlet?.handlers?.permissionManager?.isEnabled?.() && slothlet.config?.permissions?.caller?.provenance === false) return undefined;
	const contextManager = slothlet?.contextManager;
	const instanceID = contextManager?.runInContext ? runtime_makerInstanceID(slothlet) : null;
	if (instanceID === null) return undefined;
	const read = MapMethods.get(RUNTIME_CONTEXTS, contextManager) ?? contextProxy;
	return runtime_readOnBehalf(undefined, () =>
		contextManager.runInContext(instanceID, () => read[prop], undefined, [], leaf, true, false, null, null, false, true)
	);
}

/**
 * Each runtime's own `context`, by its context manager, as {@link RUNTIME_SELVES} holds each runtime's `self`.
 * @type {Map<object, object>}
 * @private
 */
const RUNTIME_CONTEXTS = new Map();

/**
 * The module that stored each object or function in the runtime `context` (see {@link runtime_contextWritten}).
 * @type {WeakMap<object, object>}
 * @private
 */
const CONTEXT_WRITERS = new WeakMap();

/**
 * Values a module read from the runtime `context` that no module stored there: the host's, which a module storing them
 * again under another key does not make its own.
 * @type {WeakSet<object>}
 * @private
 */
const CONTEXT_HOST_VALUES = new WeakSet();

/**
 * Record the module storing a value in the runtime `context`, so another module reading it gets it as a value that
 * module handed it ({@link runtime_contextRead}). What the host stores, and what a module stores again after reading it
 * from the host, is the host's and is recorded for no one.
 * @param {object} ctx - The active context store.
 * @param {*} value - The value being stored.
 * @returns {void}
 * @internal
 *
 * @example
 * runtime_contextWritten(ctx, value);
 * ctx.context[prop] = value;
 */
function runtime_contextWritten(ctx, value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	const writer = ctx?.currentWrapper;
	if (!writer?.____slothletInternal || !WeakSetMethods.has(trustedRootOwn.genuineWrappers, writer)) return;
	// A view keeps where its value came from; slothlet's own values are handed out their own way.
	if (WeakMapMethods.has(CROSSINGS, value) || runtime_isSlothletValue(value)) return;
	if (WeakSetMethods.has(CONTEXT_HOST_VALUES, value) || WeakMapMethods.has(CONTEXT_WRITERS, value)) return;
	WeakMapMethods.set(CONTEXT_WRITERS, value, writer);
}

/**
 * A value read from the runtime `context`, as whoever reads it gets it: what the host stored is the value itself, shared
 * as the host meant it to be; what a module stored reaches another module through the class prototype guard
 * ({@link runtime_crossTo}), and the host and the module that stored it as itself. Only the value stored under a key is
 * covered: what a module puts into an object the host shares there is plain JavaScript between the modules holding it.
 * @param {object} ctx - The active context store.
 * @param {*} value - The value read.
 * @returns {*} What the reader gets.
 * @internal
 *
 * @example
 * return runtime_contextRead(ctx, ctx.context[prop]);
 */
function runtime_contextRead(ctx, value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	const reader = ctx?.currentWrapper;
	const isModule = Boolean(reader?.____slothletInternal) && WeakSetMethods.has(trustedRootOwn.genuineWrappers, reader);
	if (WeakMapMethods.has(CROSSINGS, value))
		return isModule ? runtime_crossTo(value, reader, reader.slothlet, null) : runtime_uncross(value);
	if (!isModule) return value;
	const writer = WeakMapMethods.get(CONTEXT_WRITERS, value);
	if (writer === undefined) {
		if (!runtime_isSlothletValue(value)) WeakSetMethods.add(CONTEXT_HOST_VALUES, value);
		return value;
	}
	return runtime_crossTo(value, reader, reader.slothlet, writer);
}

/**
 * What an event's payload reaches a listener as (#667): slothlet's event dispatcher hands it from the module that
 * emitted it to the module that registered the listener, so it crosses between modules as an argument does
 * ({@link runtime_carryTo}). A listener the host registered, and one of the emitting module's own, gets it as it was
 * emitted, as does everyone while the permission system is off.
 * @param {*} payload - The payload.
 * @param {object|null} listener - The wrapper of the module that registered the listener, or null for the host.
 * @param {object|null} emitter - The wrapper of the module that emitted it, or null for the host.
 * @param {object} slothlet - The instance.
 * @returns {*} What the listener is handed.
 * @public
 */
function runtime_eventPayloadFor(payload, listener, emitter, slothlet) {
	if (payload === null || (typeof payload !== "object" && typeof payload !== "function") || !listener?.____slothletInternal) return payload;
	const caller = emitter?.____slothletInternal ? emitter : null;
	if (caller !== null && runtime_makerOf(caller) === runtime_makerOf(listener)) return payload;
	// It is handed over as a call's argument is: what a module's call returned to the host and the host emits as it is
	// still comes from that module, and the listener's own module's value comes back to it as itself.
	const handed = runtime_handedAsArgument(listener, payload, caller);
	// What the host emits of its own is handed on as it is, a prototype of a module's as reading it would (#667).
	if (handed === payload && caller === null) return runtime_carryTo(payload, listener, slothlet);
	return handed;
}

/**
 * Whether `prop` is an api member of the wrapper, so a read must resolve to it rather than to
 * anything the wrapper or its proxy target would otherwise answer for that name (the wrapper's own
 * `name` / `length` / `toString` / …, or a function target's own `prototype`). A member is an export
 * of the loaded module (#475) — an own member adopted onto the wrapper, or an own key of an object
 * impl that keeps its members (a grafted or EventEmitter impl) — or an entry of the wrapper's folder
 * (#571), such as `session/name/` or `session/prototype.mjs`.
 * A function impl's own `name` / `length` are the function's, not exports, so function impls never
 * count.
 *
 * An unloaded lazy module's exports are unknown, so they never count: the wrapper answers until the
 * module loads. Deciding otherwise would mean loading (or parsing) the module to find out, which
 * defeats lazy mode — slothlet itself reads `name` on wrappers routinely. A lazy folder's entries are
 * different: the build already listed them, and handed them to the wrapper as `memberNames`, which
 * count until the folder loads.
 * @param {object} wrapper - The UnifiedWrapper whose property is being read.
 * @param {string|symbol} prop - Property key.
 * @returns {boolean} True when the read must resolve to the member.
 * @private
 */
function runtime_hasOwnMember(wrapper, prop) {
	if (typeof prop !== "string") return false;
	if (hasOwn(wrapper, prop)) return true;
	const internal = wrapper.____slothletInternal;
	// The folder's entry names only stand in for members that are not composed yet: once the wrapper
	// has loaded, its own members are the truth, so a member removed later stops counting (#571 review).
	if (
		internal.mode === "lazy" &&
		!internal.state.materialized &&
		(internal.memberNames ? SetMethods.has(internal.memberNames, prop) : false)
	)
		return true;
	const impl = internal.impl;
	// A member a callable's composition layer holds is the module's (a named export that won the slot of
	// the function's own `name` or `length`), not the function's built-in (#585 review).
	if (typeof impl === "function" && isCompositionLayer(impl) && ArrayMethods.includes(layerHeldKeys(impl), prop)) return true;
	if (Arrays.isArray(impl)) return runtime_isArrayMember(impl, prop) && hasOwn(impl, prop);
	return impl !== null && typeof impl === "object" && hasOwn(impl, prop);
}

/**
 * Whether the rules leave a reader nothing to read at the path of an object member of a module's data (see
 * {@link runtime_isDataMemberNode}): a read there is refused, and so is a
 * read of any member beneath it (`config.nested.**`, or a deny on `config.nested` alone, which covers what a member of a
 * module's data holds). Such a member is no data the reader may see, and is left out of what lists or serializes the
 * object holding it, as a member holding a value the reader may not read is. A more specific allow beneath it
 * (`config.nested.public`) leaves the member listed, holding what that allow lets through.
 * @param {object} wrapper - The node whose member it is.
 * @param {string} targetPath - The member's api path.
 * @param {{currentWrapper: object, context: object}|undefined} callerOverride - The reader, when it is not the one
 *   reading now.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making.
 * @param {object|null} [access] - The read of `self` this is part of, when it was resolved already.
 * @param {*} [member] - The member's value, when the caller has it.
 * @returns {boolean} Whether the reader may read nothing there.
 * @private
 *
 * @example
 * // rule: deny reader.** → owner.config.nested.**
 * Object.keys(self.owner.config); // ["prim", "open"], as for a denied primitive member
 */
function runtime_readsNothingBeneath(wrapper, targetPath, callerOverride, kept = null, access = null, member = undefined) {
	if (runtime_readGateDecision(wrapper, targetPath, callerOverride, kept, access).allowed) return false;
	// Only a member of a module's data: a folder, a file or a function is listed whatever the rules on its path say. An
	// object written to the api after it was built is data too, and so is a plain object or array no node stands for
	// yet, which only data holds (#826).
	const memberNode =
		runtime_nodeAtPath(wrapper.slothlet, targetPath) ?? (member !== null && typeof member === "object" ? resolveWrapper(member) : null);
	const unwrappedData = memberNode === null && (runtime_holdsAssignedData(wrapper) || runtime_isPlainData(member));
	if (!runtime_isDataMemberNode(memberNode) && !unwrappedData) return false;
	const probePath = `${targetPath}.${ANY_MEMBER_SEGMENT}`;
	const beneath = runtime_readGateDecision(wrapper, probePath, callerOverride, kept, access);
	if (beneath.allowed) return false;
	// A more specific allow beneath the member lets what it names through, so the member is listed with just that.
	return !wrapper.slothlet.handlers.permissionManager.allowsBeneath(beneath.caller, targetPath, probePath);
}

/**
 * Refuse a change module code makes to the api root that the same change at a node would be refused: a member
 * assigned, defined or deleted is a write at its name, and a change to the root itself (its prototype, its
 * extensibility) or under a symbol a write at the root's own path, which only who owns the whole tree may make. The
 * framework's namespace and root functions are refused to module code, as an assignment through `self` is.
 * @param {object} slothlet - The instance.
 * @param {string|symbol|null} prop - The member changed, or null for the root itself.
 * @returns {void}
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED`, `LOOSE_SET_UNATTRIBUTED` or `PERMISSION_DENIED`, as at a node.
 * @internal
 */
function runtime_assertRootChange(slothlet, prop) {
	if (slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, slothlet.boundApi)) return;
	runtime_assertOwnedWriteAt(runtime_rootGate(slothlet), typeof prop === "string" ? [prop] : []);
	if (!SetMethods.has(SELF_FRAMEWORK_ROOTS, prop)) return;
	const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.currentWrapper || identity?.unresolved) slothlet.handlers.apiManager.normalizeApiPath([prop]);
}

/**
 * Refuse a member's value that the proxy must report as its target holds it — a non-configurable, read-only
 * data property — to a caller the rules deny. The invariants fix what such a read returns, not whether it
 * succeeds, so the read throws instead of handing the value over (#603 review).
 *
 * @param {object} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The key.
 * @param {*} value - The value the target holds.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the caller may not read the member.
 * @private
 */
function runtime_gateFixedValue(wrapper, prop, value, kept = null) {
	const impl = wrapper.____slothletInternal.impl;
	const isMember = Arrays.isArray(impl) ? runtime_isArrayMember(impl, prop) : runtime_hasOwnMember(wrapper, prop);
	if (isMember) runtime_enforceReadGate(wrapper, prop, value, undefined, kept);
	// A frozen function node holds its function's own members on its shell — a static method, its `prototype` — and
	// hands them out from there: the module's code among them is checked as a call of the node, as when unfrozen (#632).
	if (runtime_functionOf(impl) !== null) runtime_enforceCodeMember(wrapper, runtime_behindPinnedCode(value), kept);
}

/**
 * A fixed descriptor of the node's target, as the invariants require it, once the caller may read its value.
 *
 * @param {object} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The key.
 * @param {PropertyDescriptor|undefined} descriptor - The target's own descriptor.
 * @param {boolean} [asHeld=false] - Whether a view is asking for the member as it is held (see
 *   {@link runtime_describeAsHeld}), which no reader's rules decide.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @returns {PropertyDescriptor|undefined} The descriptor.
 * @throws {SlothletError} PERMISSION_DENIED for a read-only value the caller may not read.
 * @private
 */
function runtime_fixedDescriptor(wrapper, prop, descriptor, asHeld = false, kept = null) {
	// A view mirroring this member onto its shadow asks for it as it is held (see runtime_describeAsHeld).
	if (asHeld) return descriptor;
	// A stand-in for the module's code is described to anyone: each use of it is checked (see runtime_pinnedCodeMember).
	if (
		descriptor &&
		"value" in descriptor &&
		!descriptor.configurable &&
		!descriptor.writable &&
		!WeakMapMethods.has(PINNED_CODE_MEMBERS, descriptor.value)
	)
		runtime_gateFixedValue(wrapper, prop, descriptor.value, kept);
	return descriptor;
}

/**
 * The member a view is asking its node to describe as it is held, whoever reads it: that node and key, taken by
 * the node's descriptor trap as it starts, before any code that read might run can make a read of its own.
 * @type {{wrapper: object, prop: string|symbol}|null}
 * @private
 */

/**
 * A node's descriptor of a member as the node holds it, for a view mirroring the member onto its shadow: a fixed
 * member is described as it is fixed, whoever is reading. The view still gates every read it hands out; what its
 * shadow holds only has to agree with what the node holds (#655).
 * @param {object} wrapper - The node's wrapper.
 * @param {object} node - The node.
 * @param {string|symbol} prop - The member.
 * @param {object|null} [access=null] - The access the description is part of (see {@link runtime_beginAccess}).
 * @returns {PropertyDescriptor|undefined} The descriptor.
 * @private
 *
 * @example
 * runtime_describeAsHeld(inner, child, "secret"); // { value: "…", writable: false, configurable: false, … }
 */
function runtime_describeAsHeld(wrapper, node, prop, access = null) {
	const previous = rulesShared.describingAsHeld;
	rulesShared.describingAsHeld = { wrapper, prop };
	try {
		return runtime_describeWithAccess(access, wrapper, node, prop);
	} finally {
		rulesShared.describingAsHeld = previous;
	}
}

/**
 * Where a key of an array node is held: the composition layer for a member it holds (a named export), and
 * otherwise the module's own array under it, which a write or delete through the layer would only hide.
 *
 * @param {Array<*>} impl - The node's impl: the module's array, or a composition layer over it.
 * @param {string|symbol} prop - The key.
 * @returns {Array<*>} The object to change.
 * @private
 */
function runtime_arrayKeyHolder(impl, prop) {
	return isCompositionLayer(impl) && !ArrayMethods.includes(layerHeldKeys(impl), prop) ? layerUnderlying(impl) : impl;
}

/**
 * Refuse a call by code of a module that is gone (#625): it owns nothing, and the rules naming its old path are
 * another module's now, so none of them allows it anything.
 * @param {object} wrapper - The wrapper being called.
 * @param {object} callerWrapper - The calling module's wrapper.
 * @param {string} targetPath - The called path.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when the caller's module is gone.
 * @private
 */
function runtime_refuseRemovedCaller(wrapper, callerWrapper, targetPath) {
	if (!wrapper.slothlet.handlers.apiManager.isRemovedCaller(callerWrapper)) return;
	throw new wrapper.SlothletError("PERMISSION_DENIED", {
		caller: String(callerWrapper.____slothletInternal.apiPath ?? ""),
		target: segmentsOf(targetPath)
	});
}

/**
 * Enforce call/construct-level permission gating for a wrapper invocation.
 *
 * Shared by `applyTrap` (function calls) and `constructTrap` (`new` construction) so
 * both enforcement points behave identically. Only inter-module calls are gated —
 * external user code has no caller context and is exempt (mirroring the read gate).
 * When a caller context is present, the caller's api/file path and the target
 * wrapper's api/file path are resolved and handed to `enforceAccess`; a denied
 * verdict throws `PERMISSION_DENIED`.
 *
 * @param {object} wrapper - The target UnifiedWrapper being called or constructed.
 * @param {Array<*>} callArgs - The arguments of the call/construct being gated, threaded into the
 *   rule's function conditions as `{ args, target }` (#455) so a condition can authorize on the
 *   resource named in the call itself.
 * @param {boolean} [promote=false] - Whether this gate may defer to an async principal resolve
 *   (#459). True only for a call (applyTrap); construct must answer synchronously, so a stale
 *   principal there leaves its rule a non-match.
 * @param {{store?: object|null, identity?: object}|null} [resolved=null] - Receives the caller identity the gate
 *   resolved and the store it resolved it on, so the call can be entered with it instead of reading it again.
 * @param {{store: object|null, identity: object}|null} [preResolved=null] - A caller identity resolved for this
 *   call before an await (see runtime_applyWithEntry), enforced instead of reading the identity again.
 * @returns {Promise<void>|undefined} `undefined` when the gate was decided synchronously; a Promise
 *   when `promote` is set and a required principal is stale — it resolves once the principals are
 *   current and the call is allowed, and rejects with PERMISSION_DENIED otherwise.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @throws {SlothletError} PERMISSION_DENIED when the call/construct is denied by a rule.
 * @private
 */
function enforcePermission(wrapper, callArgs, promote = false, kept = null, resolved = null, preResolved = null, thisArg = undefined) {
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager || !permissionManager.isEnabled()) return;

	const targetPath = wrapper.____slothletInternal.apiPath;
	// #455: resource-scoped gate metadata — the call's own args + the concrete target path — forwarded
	// to any function condition on a matching rule as its second argument.
	const callMeta = { args: callArgs, target: targetPath };
	// Fail closed on an absent/forged caller inside an active context; host-initiated calls stay
	// allowed via the trusted-root marker (see resolveEnforcedCaller).
	const decision = resolveEnforcedCaller(wrapper, undefined, kept, preResolved);
	// The caller identity this gate resolved, for the call to enter with: re-reading it would walk the stack
	// again, and after a deferred gate the stack no longer holds the caller at all.
	if (resolved && decision.identity) {
		resolved.store = decision.ctx ?? null;
		resolved.identity = decision.identity;
	}
	if (decision.verdict === "allow") {
		// Host-initiated, normally exempt — but a module-private target still routes through
		// enforcement so the `permissions.private.host` policy applies and is audited (#260).
		if (
			permissionManager.isPrivateTarget?.(targetPath) &&
			!permissionManager.enforceAccess(null, targetPath, null, wrapper.____slothletInternal.filePath, null, callMeta)
		) {
			throw new wrapper.SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(targetPath) });
		}
		return;
	}
	if (decision.verdict === "deny") {
		throw new wrapper.SlothletError("PERMISSION_DENIED", {
			caller: null,
			target: segmentsOf(targetPath)
		});
	}
	const { callerWrapper, ceilings, ctx } = decision;
	// Code of a module that is gone is allowed no call: the rules naming its old path are another module's now (#625).
	runtime_refuseRemovedCaller(wrapper, callerWrapper, targetPath);
	const runtimeContext = ctx?.context ?? null;
	// A leaf's own function handed over as a value (imported raw from its file) is gated for the caller as though
	// it had called it through `self` (#597): the call it is handed to would otherwise run it with its own rights.
	const handed = handedLeafFunctions(thisArg, callArgs, wrapper.slothlet);
	if (handed) {
		for (let h = 0; h < handed.length; h++) {
			const leaf = handed[h];
			const leafPath = leaf.____slothletInternal.apiPath;
			for (let ofIndex = 0, ofList = concatLists([callerWrapper], ceilings); ofIndex < ofList.length; ofIndex++) {
				const caller = ofList[ofIndex];
				runtime_enforceCallAs(leaf, permissionManager, caller, leafPath, runtimeContext, { args: [], target: leafPath }, false);
			}
		}
	}
	let gate = runtime_enforceCallAs(wrapper, permissionManager, callerWrapper, targetPath, runtimeContext, callMeta, promote);
	// Code a caller supplied to another call runs as the supplier, and every call of its ceiling has to allow
	// the access as well (#597) — checked after the supplier, never instead of it.
	for (let i = 0; i < ceilings.length; i++) {
		const ceiling = ceilings[i];
		gate = gate
			? PromiseMethods.then(gate, () =>
					runtime_enforceCallAs(wrapper, permissionManager, ceiling, targetPath, runtimeContext, callMeta, true)
				)
			: runtime_enforceCallAs(wrapper, permissionManager, ceiling, targetPath, runtimeContext, callMeta, promote);
	}
	return gate;
}

/**
 * Enforce one caller's access to a call or construct — the rule check behind {@link enforcePermission}.
 *
 * @param {object} wrapper - The target UnifiedWrapper being called or constructed.
 * @param {object} permissionManager - The instance's PermissionManager.
 * @param {object} callerWrapper - The caller to check.
 * @param {string} targetPath - The target's api path.
 * @param {object|null} runtimeContext - The caller's per-request context.
 * @param {PermissionCallMeta} callMeta - `{ args, target }` of the gated call.
 * @param {boolean} promote - Whether the gate may defer to an async principal resolve (#459).
 * @returns {Promise<void>|undefined} `undefined` when decided synchronously; a Promise when deferred.
 * @throws {SlothletError} PERMISSION_DENIED when the caller is denied.
 * @private
 */
function runtime_enforceCallAs(wrapper, permissionManager, callerWrapper, targetPath, runtimeContext, callMeta, promote) {
	// The ?? fallbacks are defensive — .apiPath and .filePath are always set on live wrappers.
	/* v8 ignore start */
	const callerPath = callerWrapper.____slothletInternal?.apiPath ?? "";
	const callerFilePath = callerWrapper.____slothletInternal?.filePath ?? null;
	const targetFilePath = wrapper.____slothletInternal.filePath ?? null;
	/* v8 ignore stop */

	// #459: a promotable gate first scans for stale principals. When the scan finds none, the enforcement
	// right after it runs with principal grace, so a `ttl` that expires between the two clock reads
	// cannot flip the verdict (the epoch must still match; only the age check is waived).
	let enforceOptions = null;
	if (promote) {
		const pending = runtime_deferForPrincipals(
			wrapper,
			permissionManager,
			callerPath,
			targetPath,
			callerFilePath,
			targetFilePath,
			runtimeContext,
			callMeta
		);
		if (pending) return pending;
		enforceOptions = PRINCIPAL_GRACE;
	}

	if (!permissionManager.enforceAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, callMeta, enforceOptions)) {
		throw new wrapper.SlothletError("PERMISSION_DENIED", {
			caller: callerPath,
			target: segmentsOf(targetPath)
		});
	}
}

/**
 * Defer a call gate until the principals its rules require are current (#459).
 *
 * Every input to the gate — caller identity, context, call metadata — is captured here, before the
 * resolve's first `await`. Enforcing against those captured values afterwards (rather than
 * re-resolving the caller) keeps the decision attributed to the original caller in every runtime,
 * including ones where an `await` loses the ambient caller.
 *
 * @param {object} wrapper - Target UnifiedWrapper (for its error type).
 * @param {object} permissionManager - The instance's PermissionManager.
 * @param {string} callerPath - Caller api path.
 * @param {string} targetPath - Target api path.
 * @param {string|null} callerFilePath - Caller source file.
 * @param {string|null} targetFilePath - Target source file.
 * @param {object|null} runtimeContext - Per-request context.
 * @param {PermissionCallMeta} callMeta - `{ args, target }` of the gated call.
 * @returns {Promise<void>|null} `null` when nothing is stale (enforce synchronously as usual);
 *   otherwise a Promise that resolves when the call is allowed and rejects with PERMISSION_DENIED.
 * @private
 */
function runtime_deferForPrincipals(
	wrapper,
	permissionManager,
	callerPath,
	targetPath,
	callerFilePath,
	targetFilePath,
	runtimeContext,
	callMeta
) {
	// Optional call: a partial permission manager (a stub, or one from an older build) has no principals.
	const stale = permissionManager.stalePrincipals?.(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext);
	if (!stale || stale.length === 0) return null;
	return permissionManager.resolvePrincipals(stale).then(() => {
		if (
			!permissionManager.enforceAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, callMeta, PRINCIPAL_GRACE)
		) {
			throw new wrapper.SlothletError("PERMISSION_DENIED", { caller: callerPath, target: segmentsOf(targetPath) });
		}
	});
}

/**
 * Enforcement options for a gate that has just established its required principals are current (#459).
 * @type {Readonly<{ principalGrace: true }>}
 * @private
 */
const PRINCIPAL_GRACE = Objects.freeze({ principalGrace: true });

/**
 * A caller identity handed to the next call of one wrapper (see {@link runtime_applyWithEntry}).
 * @type {{wrapper: object, entry: {store: object|null, identity: object}}|null}
 * @private
 */

/**
 * Call a wrapper with a caller identity resolved before an await, so its gate and its entry take that
 * identity instead of reading one off a stack that no longer holds the caller. The identity is consumed by
 * the wrapper's own apply trap as it starts, synchronously within `apply`.
 * @param {object} wrapper - The wrapper `apply` calls.
 * @param {{store: object|null, identity: object}|null} entry - The identity.
 * @param {function(): *} apply - The call.
 * @returns {*} The call's result.
 * @private
 */
function runtime_applyWithEntry(wrapper, entry, apply) {
	const previous = rulesShared.handedEntry;
	rulesShared.handedEntry = entry ? { wrapper, entry } : null;
	try {
		return apply();
	} finally {
		rulesShared.handedEntry = previous;
	}
}

/**
 * Record a wrapper's function as its leaf function (#597; see {@link implWrappers}): the function itself (and the
 * module's function under it when it is a composition layer), or the
 * `default` export of a namespace, read from its descriptor so no getter runs.
 * @param {object} wrapper - The wrapper.
 * @param {*} impl - Its implementation.
 * @returns {void}
 * @private
 */
function runtime_registerLeafFunction(wrapper, impl) {
	if (typeof impl === "function") {
		WeakMapMethods.set(trustedRootOwn.implWrappers, impl, wrapper);
		// A composition layer stands over the module's own function, which is what the module's code holds and hands out.
		const underlying = layerUnderlying(impl);
		if (underlying !== impl && typeof underlying === "function") WeakMapMethods.set(trustedRootOwn.implWrappers, underlying, wrapper);
		return;
	}
	if (!isNode) return;
	const fallback = runtime_implDefault(impl);
	if (typeof fallback === "function") WeakMapMethods.set(trustedRootOwn.implWrappers, fallback, wrapper);
}

/**
 * An object implementation's own `default`, read from its descriptor so no getter or Proxy trap (module code) runs.
 * @param {*} impl - A wrapper's implementation.
 * @returns {*} Its `default` data value, or undefined for a function, a Proxy, an accessor or no `default`.
 * @private
 */
function runtime_implDefault(impl) {
	if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return undefined;
	try {
		return Objects.getOwnPropertyDescriptor(impl, "default")?.value;
	} catch {
		// A module namespace whose `default` binding is not initialised yet holds none.
		return undefined;
	}
}

/**
 * Enforce a captured reader's access, and its ceiling's when it read as code supplied to another call (#597):
 * both have to pass.
 *
 * @param {object} wrapper - Target UnifiedWrapper being invoked.
 * @param {object} capturedCaller - Module that read the reference out of the api.
 * @param {object|ReadonlyArray<object>|null} ceiling - The calls the reading code ran inside, when it was not the reader's own.
 * @param {string|undefined} targetPathOverride - Resolved target path (see runtime_enforceCapturedCaller).
 * @param {Array<*>} callArgs - Arguments of the invocation being gated.
 * @param {boolean} [promote=false] - Whether the gate may defer to an async principal resolve (#459).
 * @returns {Promise<void>|undefined} `undefined` when decided synchronously; a Promise when deferred.
 * @throws {SlothletError} PERMISSION_DENIED when either may not reach the target.
 * @private
 */
function runtime_enforceCapturedPair(wrapper, capturedCaller, ceiling, targetPathOverride, callArgs, promote = false) {
	let gate = runtime_enforceCapturedCaller(wrapper, capturedCaller, targetPathOverride, callArgs, promote);
	for (let i = 0, calls = identityCeilings({ currentWrapper: capturedCaller, ceiling }); i < calls.length; i++) {
		const call = calls[i];
		gate = gate
			? PromiseMethods.then(gate, () => runtime_enforceCapturedCaller(wrapper, call, targetPathOverride, callArgs, true))
			: runtime_enforceCapturedCaller(wrapper, call, targetPathOverride, callArgs, promote);
	}
	return gate;
}

/**
 * Enforce a captured reader's access to a wrapper it is about to invoke.
 *
 * Runs in addition to the live-caller check in {@link enforcePermission}, never instead of it. If a
 * captured identity replaced the live caller, a permitted module could take a reference and hand it to
 * an unprivileged one, which would then call it with borrowed authority — a wider hole than the one
 * captured identities exist to close. Both have to pass.
 *
 * @param {object} wrapper - Target UnifiedWrapper being invoked.
 * @param {object} capturedCaller - Module that read the reference out of the api.
 * @param {string} [targetPathOverride] - Resolved target path, for a lazy chain whose leaf is not known
 *   until invocation. Defaults to the wrapper's own path.
 * @param {Array<*>} callArgs - Arguments of the invocation being gated, threaded into function
 *   conditions as `{ args, target }` (#455) so a captured reference gets the same resource-scoped
 *   gating as a direct call.
 * @param {boolean} [promote=false] - Whether the gate may defer to an async principal resolve (#459);
 *   false where the invocation must be answered synchronously (construct).
 * @returns {Promise<void>|undefined} `undefined` when decided synchronously; a Promise when `promote`
 *   is set and a required principal is stale (resolves when allowed, rejects with PERMISSION_DENIED).
 * @throws {SlothletError} PERMISSION_DENIED when the capturing module may not reach the target.
 * @private
 */
function runtime_enforceCapturedCaller(wrapper, capturedCaller, targetPathOverride, callArgs, promote = false) {
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	/* v8 ignore next -- a view is only ever built while permissions are enabled, so this cannot be hit
	   unless enforcement is torn down between the read and the call; harmless either way. */
	if (!permissionManager || !permissionManager.isEnabled()) return;

	// Lazy composition resolves a chained path only at invocation, so the caller supplies the resolved
	// target rather than it being readable off the wrapper the chain started from.
	const targetPath = targetPathOverride ?? wrapper.____slothletInternal.apiPath;
	runtime_refuseRemovedCaller(wrapper, capturedCaller, targetPath);
	// The ?? fallbacks mirror enforcePermission: apiPath/filePath are always set on live wrappers.
	/* v8 ignore start */
	const callerPath = capturedCaller.____slothletInternal?.apiPath ?? "";
	const callerFilePath = capturedCaller.____slothletInternal?.filePath ?? null;
	const targetFilePath = wrapper.____slothletInternal.filePath ?? null;
	/* v8 ignore stop */
	const runtimeContext = wrapper.slothlet.contextManager?.tryGetContext?.()?.context ?? null;
	// #455: same resource-scoped gate metadata as the direct-call path.
	const callMeta = { args: callArgs, target: targetPath };

	// Same scan-then-enforce grace as enforcePermission (#459).
	let enforceOptions = null;
	if (promote) {
		const pending = runtime_deferForPrincipals(
			wrapper,
			permissionManager,
			callerPath,
			targetPath,
			callerFilePath,
			targetFilePath,
			runtimeContext,
			callMeta
		);
		if (pending) return pending;
		enforceOptions = PRINCIPAL_GRACE;
	}

	if (!permissionManager.enforceAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, callMeta, enforceOptions)) {
		throw new wrapper.SlothletError("PERMISSION_DENIED", { caller: callerPath, target: segmentsOf(targetPath) });
	}
}

/**
 * Complete a read made by a function a module took from the api (an accessor's getter) under the identity of
 * the module that took it: the read gate for a terminal value, and a captured view of a child, as the same read
 * made by that module would have had.
 *
 * @param {object} wrapper - Wrapper the member belongs to.
 * @param {string|symbol} prop - The member read.
 * @param {*} value - What the read returned.
 * @param {{wrapper: object, ceiling: object|null}|null} reader - The module that took the function (see
 *   {@link runtime_capturedReader}).
 * @returns {*} The value, or a captured view of it.
 * @private
 */
function runtime_readAsReader(wrapper, prop, value, reader) {
	if (!reader || value === undefined) return value;
	if (runtime_isTerminalData(value)) {
		const context = wrapper.slothlet.contextManager?.tryGetContext?.()?.context ?? null;
		runtime_enforceReadGate(wrapper, prop, value, { currentWrapper: reader.wrapper, ceiling: reader.ceiling, context });
		return value;
	}
	return resolveWrapper(value) === null ? value : runtime_capturedView(value, reader.wrapper, true, reader.ceiling);
}

/**
 * Attach the reading module's identity to a wrapper on its way out of the `get` trap.
 *
 * A reference read out of the api can be invoked long after the read, from a boundary that carries no
 * caller — a scheduler slothlet did not patch, or one in another realm. Nothing reads `self` at that
 * point, so the executing-module guard has nothing to refuse and the call would arrive unattributed,
 * which enforcement reads as host-initiated. The read itself is the last moment the reader's identity
 * is known, so it is recorded here.
 *
 * Costs nothing unless permissions are enabled and a module is doing the reading: a host read through
 * the bound `api` object has no executing module, so nothing is attached and host access is unchanged.
 *
 * @param {object} wrapper - Parent wrapper whose property was read.
 * @param {string|symbol} prop - The member read.
 * @param {*} value - Value the `get` trap resolved.
 * @param {object|null} [access=null] - The access the read is part of (see {@link runtime_beginAccess}).
 * @returns {*} The value, or a per-reader view of it.
 * @private
 */
function runtime_bindCapturedIdentity(wrapper, prop, value, access = null) {
	if (typeof prop !== "string" && typeof prop !== "symbol") return value;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager || !permissionManager.isEnabled()) return value;
	// Checked before anything costlier. The escape hatch exists for compatibility rather than cost: code
	// written against earlier versions may stash an api reference inside a module and call it from host
	// context expecting the host's standing, which this deliberately no longer grants. Measured overhead
	// is a few percent on permission-enabled instances — a per-reader object per wrapper read, which is
	// irreducible, since telling holders apart is the whole point of having one.
	// Optional call: a partial permission manager (a stub, or one from an older build) may not implement
	// it, and absent means the secure default rather than off.
	if (permissionManager.isCaptureEnabled?.() === false) return value;

	const inner = resolveWrapper(value);
	if (inner === null) return value;

	// Under lazy composition a chained read hands back a waiting proxy, which resolves against the
	// *base* of the chain rather than the property just read — `self.db.write.insert` yields one whose
	// wrapper is `db`. Binding to that would enforce against `db` instead of the leaf. A genuine child
	// wrapper's path ends in the property it was read from, which tells the two apart. Waiting proxies
	// need nothing here: they already snapshot the reader during chain traversal and reinstate it via
	// `__authoritativeWrapper` when they resolve.
	const innerPath = inner.____slothletInternal?.apiPath;
	/* v8 ignore next -- apiPath is always set on a resolved wrapper; guarded so a partially-built one
	   cannot throw on the hot read path. */
	// A symbol member's path ends in the symbol's description, as the child's path is built from `String(symbol)`.
	if (
		!innerPath ||
		(typeof prop === "symbol"
			? !StringMethods.endsWith(innerPath, `.${String(prop)}`)
			: ArrayMethods.pop(splitText(innerPath, ".")) !== prop)
	)
		return value;

	const capturedIdentity = runtime_accessIdentity(access, wrapper.slothlet.contextManager);
	const capturedCaller = capturedIdentity?.currentWrapper;
	if (!capturedCaller) return value;
	// A reader that is code supplied to another call keeps that call as its ceiling, so the reference cannot
	// carry the supplier past what the call it read inside may do (#597).
	return runtime_capturedView(value, capturedCaller, true, capturedIdentity.ceiling ?? null);
}

/**
 * Resolve the node at a stale wrapper's path (plus an optional property chain below it, for a
 * waiting proxy) in the LIVE api tree after a restart() (#504).
 *
 * @description
 * The walk is ordinary property access from the live root, so it behaves exactly as re-reading
 * `api.<path>` would — the same lazy materialization and the same read-level permission gate for
 * whoever holds the reference. The path is re-resolved on every use, so a held reference follows any
 * number of restarts. A path that no longer exists throws `RESTART_REFERENCE_UNRESOLVED`.
 *
 * @param {UnifiedWrapper} wrapper - The stale wrapper.
 * @param {string[]} [propChain=[]] - Property chain below the wrapper (waiting proxies).
 * @returns {unknown} The live node.
 * @throws {SlothletError} RESTART_REFERENCE_UNRESOLVED when the path is gone after the restart.
 * @private
 *
 * @example
 * const live = runtime_resolveRestartTarget(wrapper, ["handlers"]);
 */
function runtime_resolveRestartTarget(wrapper, propChain = []) {
	const apiPath = wrapper.____slothletInternal.apiPath;
	const segments = concatLists(apiPath ? splitText(String(apiPath), ".") : [], mapList(propChain, String));
	const fail = () => {
		throw new wrapper.SlothletError("RESTART_REFERENCE_UNRESOLVED", { path: segmentsOf(ArrayMethods.join(segments, ".")) });
	};
	// The tree of the code reading the node: the instance's, or the run's own (#876).
	const slothlet = wrapper.____slothlet;
	let node = slothlet.api;
	for (let ofIndex = 0, ofList = segments; ofIndex < ofList.length; ofIndex++) {
		const segment = ofList[ofIndex];
		if (node === null || node === undefined) fail();
		node = node[segment];
	}
	if (node === null || node === undefined) fail();
	// What the reader's tree holds at the path is a node of yet another tree (an alias stored across trees): it has no
	// node of its own there to forward to.
	const found = WeakMapMethods.get(_proxyRegistry, node);
	if (found !== undefined && runtime_isRestartStale(found)) fail();
	return node;
}

/**
 * Whether `Object.defineProperty(object, prop, descriptor)` would succeed, decided without defining it
 * (ValidateAndApplyPropertyDescriptor's checks). A definition that must land on two objects is checked
 * against both first, so one refusing it leaves the other unchanged. An array's `length` is also
 * refused when it would cut off a non-configurable element.
 *
 * @param {object} object - Object to define on.
 * @param {string|symbol} prop - Property key.
 * @param {PropertyDescriptor} descriptor - Descriptor to define.
 * @returns {boolean} True when the definition would be accepted.
 * @private
 *
 * @example
 * runtime_canDefine(Object.freeze([1]), "0", { value: 2 }); // false
 */
function runtime_canDefine(object, prop, descriptor) {
	const current = Reflect.getOwnPropertyDescriptor(object, prop);
	if (current === undefined) return Reflect.isExtensible(object);
	if (Arrays.isArray(object) && prop === "length" && "value" in descriptor) {
		// Only the indices the array holds are checked: a sparse array can have any length up to 2^32 - 1.
		for (let ofIndex = 0, ofList = Reflect.ownKeys(object); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (
				runtime_isArrayIndex(key) &&
				// Keys from 2^32 - 1 up are ordinary properties, which a shorter length does not remove.
				Number(key) < 4294967295 &&
				Number(key) >= descriptor.value &&
				Reflect.getOwnPropertyDescriptor(object, key).configurable === false
			) {
				return false;
			}
		}
	}
	if (current.configurable) return true;
	if (descriptor.configurable === true) return false;
	if ("enumerable" in descriptor && descriptor.enumerable !== current.enumerable) return false;
	const isAccessor = "get" in descriptor || "set" in descriptor;
	const isData = "value" in descriptor || "writable" in descriptor;
	if (!isAccessor && !isData) return true;
	if (isAccessor !== !("value" in current)) return false;
	if (isAccessor) {
		return (!("get" in descriptor) || descriptor.get === current.get) && (!("set" in descriptor) || descriptor.set === current.set);
	}
	if (current.writable) return true;
	return descriptor.writable !== true && (!("value" in descriptor) || Objects.is(descriptor.value, current.value));
}

/**
 * The value a sealed node's shell holds for a data member: a terminal value as it is, and anything else as
 * the member's api node, never the module's own object, which a fixed descriptor would hand to every reader.
 *
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {*} The value to hold.
 * @private
 */
function runtime_shellValue(wrapper, prop) {
	const { impl, proxy } = wrapper.____slothletInternal;
	const held = () => (hasOwn(wrapper, prop) ? Objects.getOwnPropertyDescriptor(wrapper, prop) : undefined);
	let raw;
	if (Arrays.isArray(impl)) raw = Reflect.get(impl, prop, impl);
	else if (held() && "value" in held()) {
		// A member's node is unwrapped only to the primitive it holds; a lazy node not loaded yet holds nothing
		// yet and is kept as the node it is.
		const node = resolveWrapper(held().value);
		raw = node && runtime_holdsValue(node) ? runtime_heldValue(node) : held().value;
	} else if (impl !== null && (typeof impl === "object" || typeof impl === "function")) raw = runtime_readImplMember(wrapper, prop);
	if (runtime_isTerminalData(raw) || raw === undefined) return raw;
	// An array's element or member gets its node from a read, which leaves it cached on the wrapper; the cache is
	// the node itself, where the read hands a module a view bound to it.
	if (Arrays.isArray(impl) && !held()) Reflect.get(proxy, prop);
	const cached = held();
	return cached && "value" in cached && resolveWrapper(cached.value) !== null ? cached.value : raw;
}

/**
 * Refuse, while the permission system is on, a definition that fixes a member (read-only and non-configurable) holding
 * an object or function in one step, on a node or the api root: the language requires the node to report and hand out
 * that very value, so nothing beneath it could be read, listed or written under the rules. Assigning the member
 * and then fixing it (`Object.defineProperty(node, key, { writable: false, configurable: false })`) keeps it a node.
 * A primitive, a built-in data object (read as one value under the rules), an api node, and every definition the
 * framework makes or makes during a build, are defined as asked; so is everything while the system is off or disabled.
 * @param {object} slothlet - The instance.
 * @param {string} apiPath - The path of the node defined on (`""` for the root).
 * @param {string|symbol} prop - The member.
 * @param {*} value - The value defined.
 * @returns {void}
 * @throws {SlothletTypeError} `PERMISSION_MEMBER_FIXED_OBJECT` (a `TypeError`) when the definition is refused.
 * @private
 *
 * @example
 * Object.defineProperty(self.box, "late", { value: { a: 1 }, writable: false, configurable: false }); // refused
 * self.box.late = { a: 1 };
 * Object.defineProperty(self.box, "late", { writable: false, configurable: false }); // fixed, still checked beneath
 */
function runtime_refuseFixedObjectDefinition(slothlet, apiPath, prop, value) {
	if (!slothlet.handlers?.permissionManager?.isEnabled()) return;
	if (slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, slothlet.boundApi)) return;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	if (resolveWrapper(value) !== null || UnifiedWrapper._staysValue(value)) return;
	// A definition the object cannot take: thrown as the language's `TypeError`, coded and translated.
	const refusal = new slothlet.SlothletError("PERMISSION_MEMBER_FIXED_OBJECT", {
		path: segmentsOf(apiPath ? `${apiPath}.${String(prop)}` : String(prop))
	});
	throw SlothletTypeError.from(refusal);
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
 * {@link runtime_gateFixedValue}). A member the module's array holds as an accessor stays an accessor that
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
 * runtime_defineOnSealedShell(wrapper, shell, "0", { configurable: false, writable: false }); // what Object.freeze sends
 */
function runtime_defineOnSealedShell(wrapper, target, prop, descriptor) {
	const current = Reflect.getOwnPropertyDescriptor(target, prop);
	// A non-extensible node takes no new key, as on the object itself.
	if (!current) return false;
	const impl = wrapper.____slothletInternal.impl;
	// A node fronting a module's own object defines on that object too, as freezing the object would (#757).
	const holder = Arrays.isArray(impl)
		? runtime_arrayKeyHolder(impl, prop)
		: MapMethods.has(FRAMEWORK_WRITES, wrapper)
			? null
			: runtime_moduleObjectOf(wrapper, prop);
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
			attributes.value = runtime_shellValue(wrapper, prop);
			// A function node's own member holding the module's code is held as a stand-in every holder may be described
			// (see runtime_pinnedCodeMember).
			if (runtime_functionOf(impl) !== null && !hasOwn(wrapper, prop) && runtime_pinsAsCode(attributes.value, wrapper.slothlet))
				attributes.value = runtime_pinnedCodeMember(wrapper, attributes.value);
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
	if (!runtime_canDefine(target, prop, attributes) || (mirrors && !runtime_canDefine(holder, prop, mirrored))) return false;
	// A value goes through the node's own write while the member is writable, so the module's value takes it.
	if ("value" in descriptor && current.writable && !Reflect.set(wrapper.____slothletInternal.proxy, prop, descriptor.value)) return false;
	if (mirrors) Reflect.defineProperty(holder, prop, mirrored);
	Reflect.defineProperty(target, prop, attributes);
	return true;
}

/**
 * Wrap a proxy handler so that, once restart() has replaced the wrapper's tree, every trap the
 * handler defines forwards to the live node at the wrapper's path instead (#504). Until then the
 * original traps run unchanged; the check is one epoch comparison per trap.
 *
 * @param {object} handler - The proxy handler (as passed to `new Proxy`).
 * @param {UnifiedWrapper} wrapper - The wrapper whose epoch decides staleness.
 * @param {string[]} [propChain=[]] - Property chain below the wrapper (waiting proxies).
 * @returns {object} The wrapped handler.
 * @private
 *
 * @example
 * new Proxy(target, runtime_withRestartForwarding({ get, apply }, wrapper));
 */
function runtime_withRestartForwarding(handler, wrapper, propChain = []) {
	const wrapped = {};
	for (let ofIndex = 0, ofList = Objects.entries(handler); ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			trap = ofEntry[0],
			original = ofEntry[1];
		const forward = RESTART_FORWARD_TRAPS[trap];
		// Fixed arity (no rest/spread): these traps sit on every property access and call, so the
		// common, non-stale path must not allocate. No trap takes more than four arguments.
		wrapped[trap] = function slothlet_restartForwardingTrap(a, b, c, d) {
			if (runtime_isRestartStale(wrapper)) {
				// An access or a caller identity handed to this node is not handed on to the node it forwards to.
				handedAccessKey = null;
				handedAccess = null;
				rulesShared.handedEntry = null;
				return forward(runtime_resolveRestartTarget(wrapper, propChain), a, b, c, d);
			}
			return FunctionMethods.call(original, handler, a, b, c, d);
		};
	}
	return wrapped;
}

/**
 * Re-point every trap of a proxy's (live, already-installed) handler at another node, so the proxy
 * built on it forwards every operation there from now on (#533).
 *
 * @description
 * The same forwarding restart() gives a held reference (#504), reused for a wrapper whose proxy is
 * replaced in place: when a plain namespace becomes callable, its non-callable proxy is swapped for one
 * on a function target, and the old proxy forwards to the new one. A Proxy looks its traps up on the
 * handler object at each operation, so overwriting them here changes the old proxy's behaviour without
 * adding anything to the traps the new proxy runs. The `RESTART_FORWARD_TRAPS` keep the old target's
 * proxy invariants (a non-configurable property of the target, a non-extensible target). `apply` and
 * `construct` are re-pointed too but never fire: a proxy built on a non-callable target has no
 * [[Call]], so a held reference to it stays non-callable.
 *
 * @param {object} trapHandler - The handler object the old proxy was created with.
 * @param {Function} resolveLive - Returns the node to forward to (re-read on every operation).
 * @returns {void}
 * @private
 *
 * @example
 * runtime_forwardHandlerTo(internal.proxyTraps, () => internal.proxy);
 */
function runtime_forwardHandlerTo(trapHandler, resolveLive) {
	for (let ofIndex = 0, ofList = Objects.entries(RESTART_FORWARD_TRAPS); ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			trap = ofEntry[0],
			forward = ofEntry[1];
		trapHandler[trap] = function slothlet_replacedProxyForwardingTrap(a, b, c, d) {
			// An access or a caller identity handed to the replaced proxy is not handed on to the node it forwards to.
			handedAccessKey = null;
			handedAccess = null;
			rulesShared.handedEntry = null;
			return forward(resolveLive(), a, b, c, d);
		};
	}
}

/** Whether {@link RulesLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function RulesLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/rules", import.meta.url);
	built = true;
	return Base.layer(
		class Rules extends Base {
			static {
				Base.define("rules", {
					FRAMEWORK_WRITES,
					ROOT_PROXIES,
					runtime_frameworkWrite,
					runtime_refuseEndedAccess,
					UNATTRIBUTED_READER,
					runtime_registerRunView,
					runtime_assertCapability,
					runtime_refuseWriteWithoutStanding,
					runtime_assertReaderWrite,
					FRAMEWORK_MEMBER_NAMES,
					FRAMEWORK_VIEW_TARGETS,
					runtime_registerFrameworkMemberCopy,
					runtime_registerFrameworkMember,
					runtime_assertFrameworkRootChange,
					runtime_frameworkViewOf,
					runtime_frameworkViewCaller,
					NO_STORED_VALUE,
					runtime_placingTrap,
					runtime_assertOwnedWrite,
					runtime_assertOwnedWriteAt,
					rulesShared,
					runtime_takeCapturedAccess,
					runtime_accessAsKept,
					runtime_beginAccess,
					runtime_endAccess,
					runtime_takeAccess,
					runtime_accessIdentity,
					runtime_resolvedAccess,
					runtime_readWithAccess,
					runtime_describeWithAccess,
					resolveEnforcedCaller,
					runtime_enforceNodeReportRead,
					runtime_enforceReadGate,
					runtime_readGateDecision,
					runtime_readGateFor,
					runtime_readOnBehalf,
					runtime_runAccessor,
					runtime_enforceCodeMember,
					runtime_implAccessor,
					runtime_pinnedCodeMember,
					runtime_readImplMember,
					runtime_writeImplMember,
					runtime_gateDataNodeMember,
					runtime_gateNodeValue,
					runtime_pinReader,
					runtime_writeModuleObject,
					runtime_onImpl,
					runtime_describeImplMember,
					runtime_hostRunDefiner,
					runtime_callAsDefiner,
					runtime_memberHoldsCode,
					runtime_gateLeafCopy,
					runtime_contextReadAsDefiner,
					RUNTIME_CONTEXTS,
					runtime_contextWritten,
					runtime_contextRead,
					runtime_eventPayloadFor,
					runtime_hasOwnMember,
					runtime_readsNothingBeneath,
					runtime_assertRootChange,
					runtime_gateFixedValue,
					runtime_fixedDescriptor,
					runtime_describeAsHeld,
					runtime_arrayKeyHolder,
					enforcePermission,
					runtime_applyWithEntry,
					runtime_registerLeafFunction,
					runtime_implDefault,
					runtime_enforceCapturedPair,
					runtime_readAsReader,
					runtime_bindCapturedIdentity,
					runtime_resolveRestartTarget,
					runtime_canDefine,
					runtime_shellValue,
					runtime_refuseFixedObjectDefinition,
					runtime_defineOnSealedShell,
					runtime_withRestartForwarding,
					runtime_forwardHandlerTo
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					UnifiedWrapper = registered;
					INTRINSICS = methods.values.INTRINSICS;
					runtime_dataReadOptions = methods.values.runtime_dataReadOptions;
					runtime_holdsAssignedData = methods.values.runtime_holdsAssignedData;
					runtime_holdsCode = methods.values.runtime_holdsCode;
					runtime_holdsValue = methods.values.runtime_holdsValue;
					runtime_inheritsBuiltin = methods.values.runtime_inheritsBuiltin;
					runtime_inheritsFrom = methods.values.runtime_inheritsFrom;
					runtime_isArrayIndex = methods.values.runtime_isArrayIndex;
					runtime_isArrayMember = methods.values.runtime_isArrayMember;
					runtime_isBuiltinFunction = methods.values.runtime_isBuiltinFunction;
					runtime_isBuiltinFunctionMember = methods.values.runtime_isBuiltinFunctionMember;
					runtime_isDataMemberNode = methods.values.runtime_isDataMemberNode;
					runtime_isModuleProxy = methods.values.runtime_isModuleProxy;
					runtime_isModuleStandIn = methods.values.runtime_isModuleStandIn;
					runtime_isPlainData = methods.values.runtime_isPlainData;
					runtime_isRestartStale = methods.values.runtime_isRestartStale;
					runtime_isSharedValue = methods.values.runtime_isSharedValue;
					runtime_isSlothletValue = methods.values.runtime_isSlothletValue;
					runtime_isTerminalData = methods.values.runtime_isTerminalData;
					_proxyRegistry = methods.nodes._proxyRegistry;
					ADOPTED_ACCESSORS = methods.nodes.ADOPTED_ACCESSORS;
					ENDED_INSTANCES = methods.nodes.ENDED_INSTANCES;
					NO_NODE_PRIMITIVE = methods.nodes.NO_NODE_PRIMITIVE;
					runtime_makerInstanceID = methods.nodes.runtime_makerInstanceID;
					runtime_makerOf = methods.nodes.runtime_makerOf;
					runtime_moduleInheritance = methods.nodes.runtime_moduleInheritance;
					runtime_moduleObjectKeys = methods.nodes.runtime_moduleObjectKeys;
					runtime_moduleObjectOf = methods.nodes.runtime_moduleObjectOf;
					runtime_nodeAtPath = methods.nodes.runtime_nodeAtPath;
					runtime_nodePrimitive = methods.nodes.runtime_nodePrimitive;
					runtime_prototypeGiven = methods.nodes.runtime_prototypeGiven;
					runtime_namesHelperCopy = methods.run.runtime_namesHelperCopy;
					runtime_runAsMaker = methods.run.runtime_runAsMaker;
					runtime_runnerCompilesHelper = methods.run.runtime_runnerCompilesHelper;
					runtime_runnerCompilesLoad = methods.run.runtime_runnerCompilesLoad;
					capturedViewShadows = methods.views.capturedViewShadows;
					FRAMEWORK_MEMBERS = methods.views.FRAMEWORK_MEMBERS;
					hasOwn = methods.views.hasOwn;
					HOST_READER = methods.views.HOST_READER;
					PINNED_CODE_MEMBERS = methods.views.PINNED_CODE_MEMBERS;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					RUN_VIEWS = methods.views.RUN_VIEWS;
					runtime_capturedView = methods.views.runtime_capturedView;
					runtime_functionOf = methods.views.runtime_functionOf;
					runtime_selfModuleCeilings = methods.views.runtime_selfModuleCeilings;
					runtime_selfWriteHasStanding = methods.views.runtime_selfWriteHasStanding;
					SELF_FRAMEWORK_ROOTS = methods.views.SELF_FRAMEWORK_ROOTS;
					ANY_MEMBER_SEGMENT = methods.membrane.ANY_MEMBER_SEGMENT;
					CROSSINGS = methods.membrane.CROSSINGS;
					runtime_asOneModule = methods.membrane.runtime_asOneModule;
					runtime_carryTo = methods.membrane.runtime_carryTo;
					runtime_crossTo = methods.membrane.runtime_crossTo;
					runtime_handedAsArgument = methods.membrane.runtime_handedAsArgument;
					runtime_memberPathOf = methods.membrane.runtime_memberPathOf;
					runtime_uncross = methods.membrane.runtime_uncross;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					runtime_behindPinnedCode = methods.root.runtime_behindPinnedCode;
					runtime_heldValue = methods.root.runtime_heldValue;
					runtime_pinsAsCode = methods.root.runtime_pinsAsCode;
					runtime_rootGate = methods.root.runtime_rootGate;
					RESTART_FORWARD_TRAPS = methods.waiting.RESTART_FORWARD_TRAPS;
					runtime_checkedStandIn = methods.waiting.runtime_checkedStandIn;
					runtime_adoptAccessor = methods.materialize.runtime_adoptAccessor;
					ACTING_FOR = methods.uw.ACTING_FOR;
					frameDefiner = methods.uw.frameDefiner;
					handedLeafFunctions = methods.uw.handedLeafFunctions;
					leafOfCopy = methods.uw.leafOfCopy;
					resolveWrapper = methods.uw.resolveWrapper;
					runtime_codeWritersOnStack = methods.uw.runtime_codeWritersOnStack;
					runtime_loadingFileRunning = methods.uw.runtime_loadingFileRunning;
					runtime_loadingHelper = methods.uw.runtime_loadingHelper;
					SlothletTypeError = methods.uw.SlothletTypeError;
					trustedRootOwn = methods.uw.trustedRootOwn;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/rules", import.meta.url);
				super(slothlet);
			}
		}
	);
}
