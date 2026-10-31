/**
 * Make one write of the framework's own to a node: a mount, removal, or rebuild step of `api.add` /
 * `remove` / `reload`, or the framework fixing a node's integrity to match its module's value.
 *
 * Such a write runs through the same traps a module's `self.X.Y = …` reaches, and in whatever context the
 * operation was started from, often a module's. It is not that module's write, so the ownership rule
 * ({@link runtime_assertOwnedWrite}) lets it through, for this node and only while `write` runs.
 *
 * @param {object} node - The node written: a wrapper proxy or wrapper. Anything else needs no exemption.
 * @param {function(): *} write - The write; synchronous.
 * @returns {*} What `write` returns.
 * @internal
 *
 * @example
 * runtime_frameworkWrite(parent, () => { parent[key] = value; });
 */
export function runtime_frameworkWrite(node: object, write: () => any): any;
/**
 * The node behind a value: a view `self` handed out ({@link runtime_selfView}), or a member it handed out as the node
 * holds it fixed, stands for its node, which is what is stored when the view is written into the api. A function a
 * module was handed, as the module sees it ({@link runtime_inboundFunction}), stands for the function. Anything else
 * is returned as is.
 *
 * @param {*} value - A value about to be stored.
 * @returns {*} The node a view stands for, or `value`.
 * @internal
 *
 * @example
 * runtime_unwrapSelfView(self.callee.ops) === api.callee.ops; // true
 */
export function runtime_unwrapSelfView(value: any): any;
/**
 * The module code reading the api right now, for a value the framework hands out (#625): the executing
 * module's wrapper, the reader that owns nothing for code the live runtime could not attribute, or null
 * for host code, which is handed the api itself.
 *
 * @param {object} slothlet - Instance the api belongs to.
 * @returns {object|null} The module reader, or null for the host.
 * @internal
 *
 * @example
 * const reader = runtime_selfModuleReader(slothlet);
 * return reader ? runtime_selfRootView(slothlet, reader) : slothlet.api;
 */
export function runtime_selfModuleReader(slothlet: object): object | null;
/**
 * The calls the code running now acts under besides its own module, when it is code a caller supplied to another
 * module's call (#597): each has to be allowed a change the module makes as well. Empty for a module's own code and
 * for the host.
 *
 * @param {object} slothlet - Instance the code runs in.
 * @param {object|null} [writer] - The module the change is made as; the ceilings are read only while it is the one
 *   executing, so a writer captured earlier gets none from whatever runs now.
 * @returns {ReadonlyArray<object>} The ceiling's calls.
 * @internal
 *
 * @example
 * for (const call of [writer, ...runtime_selfModuleCeilings(slothlet, writer)]) apiManager.assertOwnedWrite(parts, call);
 */
export function runtime_selfModuleCeilings(slothlet: object, writer?: object | null): ReadonlyArray<object>;
/**
 * Hand out a node of the api reached through `self` as a view that keeps who read it (#625).
 *
 * `self.X = …` with no module executing is refused (`RUNTIME_NO_ACTIVE_CONTEXT_SELF`): nobody is there to
 * own the write. A node a module took through `self` and wrote into later from outside any call would
 * otherwise reach the node with no caller, which is the host's standing. So a write through the view made
 * with no module executing (outside a `run()` / `scope()` the host opened) is held to the module that read
 * the node: it goes through when that module owns the node's path, and is refused when it does not. A
 * module's own node therefore stays writable from a callback it hands the host, and the host can write
 * through a node a module handed back from its own subtree; another module's node cannot be written that
 * way. While a module is executing the write reaches the node, whose own rule then applies.
 *
 * The view reads, calls, and enumerates as the node does. What it hands back of the node — a member read,
 * a property descriptor's value, what a method returns — comes back as a view for the same reader, also a
 * view another reader handed back (a module returning its own node). A method called through it runs as
 * its own module: called on the node it was read from, it gets that module's view of the node as its
 * receiver, the one it reads through `self` itself, so it can keep its receiver and write its own node
 * later. A receiver supplied for another node and every argument reach it as the caller passed them, so a
 * node lent to it, even one of its own module's, stays held to the caller. A class instance or EventEmitter a method gets as
 * its receiver (#590, #340) comes back as a view of the node it was called on. The same node reached
 * through the host's `api` is not a view and is not affected. One view per node and reader, so a module
 * comparing what it read twice sees the same object. A node inside a plain object or array a module
 * returns is handed over as it is: the module chose to share it.
 *
 * @param {*} node - Value read through `self`.
 * @param {object} [reader] - Who read it; the code executing now when omitted.
 * @returns {*} A view of an api node, or `node` unchanged.
 * @internal
 *
 * @example
 * const ops = self.callee.ops; // a view of api.callee.ops
 * ops.note = "x"; // inside a call: the node's own ownership rule decides
 */
export function runtime_selfView(node: any, reader?: object): any;
/**
 * Record a stand-in for one of the framework's root members (an isolated scope's copy-on-write view of the
 * `slothlet` namespace) as that member, so module code reading it through the scope's `self` is handed the same
 * view of it as outside the scope ({@link runtime_selfFrameworkView}). Anything else is left unrecorded.
 *
 * @param {object} copy - The stand-in.
 * @param {*} member - The value it stands in for.
 * @returns {object} `copy`.
 * @internal
 *
 * @example
 * runtime_registerFrameworkMemberCopy(makeCopyOnWriteSelf(api.slothlet), api.slothlet);
 */
export function runtime_registerFrameworkMemberCopy(copy: object, member: any): object;
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
export function runtime_registerFrameworkMember(member: object | Function, slothlet: object, name: string): object | Function;
/**
 * The framework's own namespace (`self.slothlet`) and root functions (`self.shutdown`, `self.destroy`) as a
 * module reads them (#625).
 *
 * What they do depends on who calls: `diag.getAPI()` hands module code a view of the api and the host the
 * api itself, `hook.on()` / `lifecycle.on()` register for the module calling or for the host. A function a
 * module read and kept, called later from outside any call, would run as the host. Through the view it runs
 * as the module that read it, and so does every other use of the view — a member read, a write — made with
 * no standing of its own. While a module executes, or inside a `run()` / `scope()` the host opened, the view
 * behaves as the member itself. The host is handed the member itself.
 *
 * A module never changes them (#625): they are shared by every module and the host, so an assignment,
 * definition, or deletion of a member at any depth, or a change to a member's prototype or extensibility
 * (freezing, sealing), meets the built-in write rules of the permission system (`slothlet.**:write` and the
 * like), which refuse it with `PERMISSION_DENIED` unless a host rule lifted them. A symbol key is held to the
 * same rules as a string key: a change under one meets the rules of the member it is made on.
 *
 * @param {*} member - A root member read through `self`.
 * @param {object} [reader] - Who read it; the code executing now when omitted.
 * @param {object} [slothlet] - Instance it belongs to; looked up when omitted.
 * @returns {*} A view of the member, or `member` unchanged.
 * @internal
 *
 * @example
 * const diag = runtime_selfFrameworkView(api.slothlet).diag; // later diag.getAPI() still answers the module
 */
export function runtime_selfFrameworkView(member: any, reader?: object, slothlet?: object): any;
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
 *   `INVALID_CONFIG_API_PATH_INVALID` for the reserved name otherwise.
 * @internal
 *
 * @example
 * runtime_assertFrameworkRootChange(ctx.slothlet, "slothlet"); // throws inside a module call
 */
export function runtime_assertFrameworkRootChange(slothlet: object, prop: string | symbol): void;
/**
 * Where a change to `self` itself lands, once the code running now may make it (#625): defining or deleting a
 * member of `self`, or a symbol-keyed member of it.
 *
 * `self` is one object shared by every module of every instance; it stands for the api of the instance the
 * running code belongs to. A change to it follows the rule a top-level `self.X = …` does: a module changes
 * only what it owns (the framework's own members never, by the built-in write rules), a symbol key or a change
 * to `self` as a whole is held to the root of the tree, and code the live runtime cannot attribute is refused.
 * The change is made on that instance's api — or on the isolated scope's own view of it — never on the object
 * behind `self`.
 *
 * @param {object} ctx - The active context store (`self`, `slothlet`).
 * @param {string|symbol|null} prop - Member of `self` changed, or null for `self` as a whole.
 * @returns {object} The object the change is made on.
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED` / `PERMISSION_DENIED` when module code changes a member it may
 *   not, and `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing.
 * @internal
 *
 * @example
 * return Reflect.deleteProperty(runtime_selfChangeTarget(ctx, prop), prop);
 */
export function runtime_selfChangeTarget(ctx: object, prop: string | symbol | null): object;
/**
 * The module a framework view runs the executing code as, when that view was used with no caller of its
 * own (a function of `self.slothlet` a module kept, called later from outside any call) (#625).
 *
 * Run that way the code has no caller, which reads as "called from the host". What pins the caller
 * (`lockCaller.caller`) pins this module instead, so a kept function never acts as the host.
 *
 * @param {object} slothlet - Instance the executing code runs in.
 * @returns {object|null} The reader's wrapper, or null when the executing code is no such use.
 * @internal
 *
 * @example
 * const pinned = metadata.callerWrapper() ?? runtime_frameworkViewCaller(slothlet);
 */
export function runtime_frameworkViewCaller(slothlet: object): object | null;
/**
 * The whole api as a reader reads it through `self`, for a payload the framework hands a module (#625): the
 * `api` a hook handler a module registered is handed. Every member read through it is the reader's view
 * ({@link runtime_selfView}), and a change to a root member follows the rule a top-level `self.X = …` does:
 * made while a module executes, it is that module's; made later from outside any call, it is held to the
 * reader, so a module cannot keep the `api` a hook was handed and write another module's subtree through it
 * once the host calls it back.
 *
 * @param {object} slothlet - Instance the api belongs to.
 * @param {object} reader - The module the view belongs to.
 * @returns {object} The root view.
 * @internal
 *
 * @example
 * const api = runtime_selfRootView(slothlet, moduleWrapper);
 * api.callee.ops; // the module's view of api.callee.ops
 */
export function runtime_selfRootView(slothlet: object, reader: object): object;
/**
 * Record a function the framework pinned to a caller (see {@link runtime_isCallerLocked}).
 *
 * @param {Function} fn - The pinned function.
 * @returns {Function} `fn`.
 * @internal
 *
 * @example
 * return runtime_markCallerLocked(locked);
 */
export function runtime_markCallerLocked(fn: Function): Function;
/**
 * Whether the framework pinned `fn` to a caller ({@link runtime_markCallerLocked}).
 *
 * @param {*} fn - Candidate.
 * @returns {boolean} True for a function the framework pinned.
 * @internal
 *
 * @example
 * if (runtime_isCallerLocked(handler)) return handler;
 */
export function runtime_isCallerLocked(fn: any): boolean;
/**
 * A hook handler a module registered, handed its payload as that module reads the api through `self` (#625).
 *
 * The pipeline hands a hook the call's own values: the arguments as the caller passed them, the result as
 * the method returned it (its own module's view of a node, for one), what `next()` hands back, and the
 * whole api. Kept by a handler a module registered, any of them would let that module write another
 * module's node later, with the standing of whoever's view it is. So the handler gets its own module's
 * view of every node among them, and a root view ({@link runtime_selfRootView}) as `api`. What it hands
 * back — the args or result it was given, or an array of them — reaches the pipeline as the call's own
 * values again, and a change it makes to the `args` array in place reaches the call too.
 *
 * @param {Function} handler - The handler, pinned to its module.
 * @param {object} slothlet - Instance the hook is registered on.
 * @param {object} reader - The module that registered the hook.
 * @returns {Function} The handler with its payload viewed for the module.
 * @internal
 *
 * @example
 * hook.handler = runtime_selfHookHandler(pinned, slothlet, ownerWrapper);
 */
export function runtime_selfHookHandler(handler: Function, slothlet: object, reader: object): Function;
/**
 * Drop the record of what a module made (#597): a module removed whole, or — with no module given — every module of
 * an instance that shut down. Stand-ins already handed out keep working; the module's next value is a new stand-in.
 * @param {object} slothlet - The instance.
 * @param {string} [moduleID] - The module, or every module of the instance when omitted.
 * @returns {void}
 * @internal
 * @example
 * releaseModuleMakers(slothlet, "plugins-core");
 */
export function releaseModuleMakers(slothlet: object, moduleID?: string): void;
/**
 * How many module records an instance holds (see {@link runtime_makerOf}).
 * @param {object} slothlet - The instance.
 * @returns {number} The count.
 * @internal
 * @example
 * moduleMakerCount(slothlet); // 3
 */
export function moduleMakerCount(slothlet: object): number;
/**
 * The `then` an `await` of `value` would read: the first property named `then` along its prototype
 * chain, as a descriptor, so that a getter is never run to find it. A Proxy may report a prototype chain
 * that loops back (its own `getPrototypeOf` returning itself); the walk stops at the first object it has
 * already seen.
 * @param {object|Function} value - A value.
 * @returns {PropertyDescriptor|undefined} The `then` descriptor, or undefined when there is none.
 * @internal
 *
 * @example
 * findThen(Object.create({ then: 1 })); // { value: 1, writable: true, … }
 */
export function findThen(value: object | Function): PropertyDescriptor | undefined;
/**
 * Whether a `then` property makes its value awaitable (#571): a function, or a getter, which may return
 * one and is never run to find out. A `then` holding data does not, nor does a setter-only accessor, which
 * an `await` reads as `undefined`: an `await` passes such a value through. The one rule every `then` check
 * in slothlet applies.
 * @param {PropertyDescriptor|undefined} descriptor - The `then` descriptor (see {@link findThen}).
 * @returns {boolean} True for a callable `then` or a `then` getter.
 * @internal
 *
 * @example
 * isAwaitableThen({ value: { required: ["b"] } }); // false
 */
export function isAwaitableThen(descriptor: PropertyDescriptor | undefined): boolean;
/**
 * Whether a value holds or inherits a `then` that makes it awaitable (#571), found by descriptor (see
 * {@link findThen}) so that a getter is never run to find out.
 * @param {object|Function} value - A module's value (not a Proxy: a Proxy's traps are its own answer).
 * @returns {boolean} True when the `then` an `await` would read is a function or a getter.
 * @public
 *
 * @example
 * hasThenMember({ get then() { throw new Error(); } }); // true, and the getter does not run
 */
export function hasThenMember(value: object | Function): boolean;
/**
 * The error refusing a value whose `then` would make it awaitable where slothlet awaits it (#571), naming
 * where it was found.
 * @param {Function} SlothletError - The instance's error class.
 * @param {string} location - The api path, or file and export, of the value.
 * @returns {Error} A MODULE_THENABLE_EXPORT validation error.
 * @internal
 *
 * @example
 * throw thenableExportError(this.SlothletError, "session");
 */
export function thenableExportError(SlothletError: Function, location: string): Error;
/**
 * Whether a module's value is a thenable, which an `await` or an async return would call: it holds or
 * inherits a `then` member (found by descriptor first, so a `then` getter is refused without running),
 * or reading `then` gives a function. The read only runs code when no descriptor names `then`
 * anywhere on the chain, which leaves a Proxy's `get` trap, the same read an `await` makes. No Proxy
 * brand check is needed, so the answer is the same in the browser, where there is none (#580 review).
 * @param {object|Function} value - A module's value.
 * @returns {boolean} True when `value` is thenable or names a `then` member.
 * @public
 *
 * @example
 * isThenableModuleValue(new Proxy({}, { get: (t, k) => (k === "then" ? () => {} : undefined) })); // true
 */
export function isThenableModuleValue(value: object | Function): boolean;
/**
 * Whether a value is an instance of a class: an object whose prototype is neither `Object.prototype`
 * nor `null` (plain objects) nor `Array.prototype`.
 * @param {unknown} value - Value to test.
 * @returns {boolean} True for a class instance.
 * @public
 *
 * @example
 * isClassInstance(new Map()); // true
 * isClassInstance({ a: 1 }); // false
 */
export function isClassInstance(value: unknown): boolean;
/**
 * Resolves a value to its backing UnifiedWrapper instance.
 * Accepts a proxy registered via createProxy() or a raw UnifiedWrapper instance.
 * Returns null for any other value.
 *
 * @param {unknown} value - Value to resolve
 * @returns {UnifiedWrapper|null} The backing wrapper, or null
 *
 * @example
 * const wrapper = resolveWrapper(someProxy);
 * if (wrapper) wrapper.____slothletInternal.impl = newImpl;
 */
export function resolveWrapper(value: unknown): UnifiedWrapper | null;
/**
 * Whether `key` is one of the names a wrapper answers itself when it has no member of that name
 * (`name`, `length`, `prototype`, …; see {@link WRAPPER_ANSWERED_PROPS}).
 * @param {string} key - Member name.
 * @returns {boolean} True for a wrapper-answered name.
 * @internal
 *
 * @example
 * isWrapperAnsweredName("name"); // true
 */
export function isWrapperAnsweredName(key: string): boolean;
/**
 * The node behind a value read out of the api: a per-reader view a read under a module's identity hands back stands
 * for the node it was built over; anything else is the value itself (#625).
 * @param {*} value - A value read out of the api.
 * @returns {*} The node behind it.
 * @internal
 *
 * @example
 * runtime_nodeBehind(heldReference) === api.victim.v; // true for a view of victim.v
 */
export function runtime_nodeBehind(value: any): any;
/**
 * Read `key` off `container` as an api member: what `container[key]` holds, or `undefined` when there
 * is no member of that name.
 *
 * The two differ only for the names a wrapper answers itself (`name`, `length`, …; see
 * {@link WRAPPER_ANSWERED_PROPS}). `api.session.name` reads `"session"` when `session` has no `name`
 * member. That is the right answer for a caller asking what the node's name is, and the wrong one for
 * a caller deciding whether `session.name` is already taken: treating the string as an existing value
 * made `api.add("session.name", …)` refuse to mount, and a deeper mount path reject `session.name` as
 * not traversable (#571). Composition code that asks "is there a member here?" reads through this.
 *
 * An unloaded lazy wrapper's exports are unknown until it loads, so its own read is returned as-is. A
 * plain object's member is an own property: one it only inherits is not a member.
 * @param {object|Function} container - Api node (a wrapper proxy) or plain object to read from.
 * @param {string} key - Member name.
 * @returns {unknown} The member, or `undefined` when the wrapper would only answer `key` itself.
 * @internal
 *
 * @example
 * readApiMember(api.profile, "name"); // undefined — `profile` has no `name` member
 * api.profile.name; // "profile"
 */
export function readApiMember(container: object | Function, key: string): unknown;
/**
 * {@link readApiMember}, loading an unloaded lazy wrapper first when `key` is a name the wrapper
 * answers itself — the one case where an unloaded node cannot tell its own answer from a member of
 * that name (#571). Any other key is read without loading.
 *
 * The member comes back in an envelope: a lazy member is itself thenable (awaiting it loads it), so
 * resolving the promise with the member would load every node the read reaches.
 * @param {object|Function} container - Api node (a wrapper proxy) or plain object to read from.
 * @param {string} key - Member name.
 * @returns {Promise<{value: unknown}>} The member as `value`, or `undefined` when there is none.
 * @internal
 *
 * @example
 * const { value } = await loadApiMember(api.profile, "name"); // loads a lazy `profile`, then reads its `name` member
 */
export function loadApiMember(container: object | Function, key: string): Promise<{
    value: unknown;
}>;
/**
 * Whether `value` can be called: a plain function can; an api node can only when it is a callable
 * leaf, not a namespace. An unloaded lazy node is loaded first, since its callability is unknown until
 * then. `typeof` alone cannot tell — a lazy namespace is a function-typed proxy — so a root `shutdown/`
 * or `destroy/` folder was taken for a user lifecycle hook in lazy mode and calling it threw, where
 * eager (an object namespace) ignored it (#583).
 * @param {unknown} value - Candidate.
 * @returns {Promise<boolean>} True when `value` is callable.
 * @internal
 *
 * @example
 * if (await isCallableValue(slothlet.userHooks.shutdown)) await slothlet.userHooks.shutdown();
 */
export function isCallableValue(value: unknown): Promise<boolean>;
export namespace TYPE_STATES {
    let UNMATERIALIZED: symbol;
    let IN_FLIGHT: symbol;
}
/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - __impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @extends ComponentBase
 * @public
 */
export class UnifiedWrapper extends ComponentBase {
    /**
     * The version of an object implementation adoption may change. `___adoptImplChildren` deletes the
     * members it moves onto the wrapper (`delete this.____slothletInternal.impl[key]`); done on the module's
     * own export, it would empty it for every other holder, such as a second wrapper loading the same
     * cached module during a reload. A slothlet wrapper proxy is snapshotted; everything else follows
     * {@link module:@cldmv/slothlet/helpers/composition.copyForComposition}.
     *
     * @param {*} value - The implementation value.
     * @returns {*} A copy or layer of `value`, or `value` itself when nothing can change it.
     * @static
     * @private
     */
    private static _cloneImpl;
    /**
     * Copy one member of a wrapper onto another wrapper, as two colliding nodes merge.
     *
     * @description
     * A data member is copied as its value. An accessor adoption put on the source runs the module's own
     * getter and setter on the target node instead, so it reads and writes through the node that holds
     * the slot; any other accessor is copied as it is. Reading the member would run the getter once and
     * keep what it returned (#585 review).
     *
     * @param {object} source - The wrapper the member comes from.
     * @param {object} target - The wrapper it is copied onto.
     * @param {PropertyKey} key - The member's key.
     * @returns {void}
     * @package
     *
     * @example
     * UnifiedWrapper._copyMember(fileWrapper, folderWrapper, "total");
     */
    static _copyMember(source: object, target: object, key: PropertyKey): void;
    /**
     * Describe one member of a wrapper for a plain object that will become another node's impl.
     *
     * @description
     * An accessor adoption put on the wrapper is described as the module's own getter and setter, so
     * adopting the object runs them on its new node; any other accessor is described as it is, and a data
     * member as its value (#585 review).
     *
     * @param {object} source - The wrapper the member comes from.
     * @param {PropertyKey} key - The member's key.
     * @returns {PropertyDescriptor} A configurable, enumerable descriptor.
     * @package
     *
     * @example
     * Object.defineProperty(impl, "total", UnifiedWrapper._memberDescriptor(fileWrapper, "total"));
     */
    static _memberDescriptor(source: object, key: PropertyKey): PropertyDescriptor;
    /**
     * Reconstruct a full implementation object from a wrapper whose _impl may have
     * been depleted by ___adoptImplChildren.
     *
     * @description
     * After ___adoptImplChildren runs, children are moved from _impl onto the wrapper as
     * own properties and deleted from _impl. This helper reconstructs the original
     * impl by merging the remaining _impl keys with the adopted children extracted
     * from the wrapper.
     *
     * Recursively walks the wrapper tree so nested objects whose _impl was also
     * depleted are properly reconstructed. For callable (function) impls, returns
     * the function directly since keepImplProperties prevents depletion.
     *
     * @param {Object} wrapper - The UnifiedWrapper instance to extract from
     * @returns {*} The reconstructed implementation mirroring original module exports
     * @static
     * @private
     */
    private static _extractFullImpl;
    /**
     * Whether an impl makes its wrapper callable: a function, or an object with a default-exported
     * function.
     * @param {*} impl - The impl.
     * @returns {boolean} True for a callable impl.
     * @private
     *
     * @example
     * UnifiedWrapper._isCallableImpl({ default() {} }); // true
     */
    private static _isCallableImpl;
    /**
     * Retire the lazy wrappers inside a materialization result that is dropped because its wrapper
     * was invalidated while loading (#588). The result's unloaded lazy children were counted when they
     * were built and are now unreachable, so they would otherwise keep `remaining` above 0 forever.
     * Each is invalidated, not only uncounted: one already loading in the background would otherwise
     * finish and count lazy descendants of its own that nothing can reach. One that already loaded holds
     * its own lazy children, which are unreachable too, so the wrappers it holds are retired with it
     * (#585 review).
     * @param {unknown} impl - The dropped materialization result.
     * @returns {void}
     * @private
     *
     * @example
     * UnifiedWrapper._uncountUnappliedImpl(result);
     */
    private static _uncountUnappliedImpl;
    /**
     * Invalidate a wrapper and every wrapper it holds as a member, children first, since invalidating a
     * wrapper removes its members (#585 review).
     * @param {UnifiedWrapper} wrapper - The wrapper to retire.
     * @param {Set<UnifiedWrapper>} seen - Wrappers already visited, so a cycle is walked once.
     * @returns {void}
     * @private
     *
     * @example
     * UnifiedWrapper._invalidateTree(wrapper, new Set());
     */
    private static _invalidateTree;
    /**
     * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
     * @param {Object} options - Configuration options
     * @param {string} options.mode - "lazy" or "eager"
     * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
     * @param {Function|Object|null} [options.initialImpl=null] - Initial implementation (null for lazy mode)
     * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
     * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
     * @param {boolean} [options.materializeOnCreate=false] - Whether to materialize on creation
     * @param {string} [options.filePath=null] - File path of the module source
     * @param {string[]|null} [options.exportPath] - Access path within `filePath`'s module namespace
     *   that produced `initialImpl` (#484). When omitted it is looked up from the ownership export index
     *   by `initialImpl`'s identity; `null` records "no module origin".
     * @param {string} [options.moduleID=null] - Module identifier
     * @param {string} [options.sourceFolder=null] - Source folder for metadata
     * @param {Iterable<string>|null} [options.memberNames=null] - Names of the entries in this wrapper's
     *   folder (sanitized), when the build already listed them. A member by one of these names wins over
     *   anything the wrapper or its proxy target would answer for it (`session/name/` →
     *   `api.session.name`, `session/prototype/` → `api.session.prototype`), including before an
     *   unloaded lazy wrapper has loaded (#571).
     * @param {WeakSet<object>|null} [options.__adoptVisited=null] - Internal: one-shot cycle-guard set
     *   threaded through the eager child-adoption recursion so a self-referential value cannot recurse
     *   forever (#330). Set only on nested wrappers built during a single adopt traversal; null for a
     *   normal (root / reload) construction.
     * @param {boolean} [options.deferChildAdopt=false] - Internal: defer eager child adoption to first
     *   getTrap access (and propagate the deferral to descendants). Used for wrap-on-set of a
     *   user-assigned object so an arbitrarily deep runtime-grafted chain is wrapped one level per
     *   access instead of recursing synchronously through every level at assignment and overflowing
     *   the stack (#329 / #247 unbounded depth).
     * @param {{parent: object, key: PropertyKey, byIndex: boolean, sourceValue: *}|null} [options.__position=null] - Internal:
     *   set by ___createChildWrapper for a child whose path follows an array position; applied before the constructor
     *   adopts members, so the child's own members are built under the position-following path too.
     *
     * @description
     * Creates a unified wrapper instance for a specific API path. Extends ComponentBase
     * to access slothlet.contextManager, slothlet.instanceID, and slothlet.handlers.ownership.
     *
     * @example
     * const wrapper = new UnifiedWrapper(this.slothlet, {
     * 	mode: "lazy",
     * 	apiPath: "math",
     * 	initialImpl: null,
     * 	materializeFunc: async () => import("./math.mjs")
     * });
     */
    constructor(slothlet: Object, { mode, apiPath, initialImpl, materializeFunc, isCallable, materializeOnCreate, filePath, exportPath, moduleID, sourceFolder, memberNames, __adoptVisited, deferChildAdopt, __position }: {
        mode: string;
        apiPath: string;
        initialImpl?: Object | Function | null | undefined;
        materializeFunc?: Function | undefined;
        isCallable?: boolean | undefined;
        materializeOnCreate?: boolean | undefined;
        filePath?: string | undefined;
        exportPath?: string[] | null | undefined;
        moduleID?: string | undefined;
        sourceFolder?: string | undefined;
        memberNames?: Iterable<string> | null | undefined;
        __adoptVisited?: WeakSet<object> | null | undefined;
        deferChildAdopt?: boolean | undefined;
        __position?: {
            parent: object;
            key: PropertyKey;
            byIndex: boolean;
            sourceValue: any;
        } | null | undefined;
    });
    /**
     * Internal state accessor used by framework-internal code only.
     * Backed by the private `#internal` field - prototype property, not an own property,
     * so proxy invariants never apply and getTrap can legally return undefined for it.
     *
     * Uses a private-field brand check (`#internal in this`) so the getter is safe to
     * invoke with any receiver - including `UnifiedWrapper.prototype` itself during a
     * prototype chain walk via `Object.getPrototypeOf` - without throwing a TypeError.
     * Without the brand check, `Object.getPrototypeOf(proxy).____slothletInternal` would
     * throw because the prototype object was never constructed and has no `#internal` field.
     * @returns {Record<string, any>|undefined} Internal state container, or undefined for non-instances
     */
    get ____slothletInternal(): Record<string, any> | undefined;
    /**
     * Custom inspect output for Node.js `util.inspect`.
     *
     * Defined as an ordinary named method and wired to the `util.inspect.custom`
     * symbol via a prototype assignment after the class. A computed
     * `[util.inspect.custom]` member in the class body makes tsc emit a spurious
     * numeric index signature (`[x: number]`) into the generated `.d.mts`; an
     * ordinary named method emits cleanly instead.
     * @returns {*} The actual implementation for inspection.
     * @internal
     */
    ____inspectCustom(____depth: any, ____options: any, ____inspect: any): any;
    /**
     * Get current implementation
     * @returns {Function|Object|null} Current __impl value
     * @public
     */
    public get __impl(): Function | Object | null;
    /**
     * Core implementation-application logic shared by ___setImpl and lazy materialization.
     * Clones the implementation (protecting the API cache from ___adoptImplChildren's
     * delete operations), clears the invalid flag, upgrades __isCallable when a
     * callable impl arrives on a configurable wrapper, updates __filePath for lazy
     * folder wrappers, and adopts children.
     *
     * @param {*} newImpl - The new implementation value.
     * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
     *   wrappers regardless of mode (used by ___setImpl to preserve live references).
     * @private
     */
    private _applyNewImpl;
    /**
     * Give a namespace the function a later contribution supplies, keeping its children (#533).
     *
     * @description
     * A merge (`merge` / `merge-replace`) keeps the existing node and only adds the incoming children,
     * so the incoming module's own function was dropped and a namespace created by an earlier module
     * could never become callable. The function is resolved like any other merged member: a namespace
     * with no function yet always takes it; one that already has a function keeps it under `merge`
     * (first writer wins) and takes the incoming one under `merge-replace` (incoming wins). The children
     * are untouched: the incoming impl's own members were already adopted into child wrappers, which the
     * caller merges separately.
     *
     * @param {*} impl - The incoming contribution's impl at this node.
     * @param {boolean} [replaceExisting=false] - True under `merge-replace`: the incoming function
     *   replaces an existing one.
     * @returns {boolean} True when the namespace took the function.
     * @private
     *
     * @example
     * existingWrapper.___adoptCallableImpl(nextWrapper.____slothletInternal.impl, collisionMode === "merge-replace");
     */
    private ___adoptCallableImpl;
    /**
     * Replace this wrapper's non-callable proxy with a callable one (#533).
     *
     * @description
     * A Proxy's callability is fixed when it is created, and a namespace that started non-callable
     * uses the wrapper itself as its target (so `typeof` reads "object"). When a function arrives, a new
     * proxy is built from the same handler on a function target, registered for this wrapper, and
     * installed in the parent in place of the old one, so `api.<path>` is callable from then on. The
     * old proxy's traps are re-pointed at the new proxy (the same forwarding restart() gives a held
     * reference, #504), so a reference held from before keeps reading, enumerating and writing through
     * to the live namespace — but stays non-callable itself and keeps `typeof` "object".
     *
     * The upgrade is one-way: when the function later goes away (a remove or a reload), the callable
     * proxy stays and a call throws `INVALID_CONFIG_NOT_A_FUNCTION`, the same as for a namespace that
     * was callable from the start.
     *
     * @returns {void}
     * @private
     *
     * @example
     * if (internal.proxyTraps !== null) wrapper.___upgradeToCallableProxy();
     */
    private ___upgradeToCallableProxy;
    /**
     * Rebuild a loaded lazy node on the target eager gives its value (#585 review).
     *
     * @description
     * A lazy node's proxy is built on a function target, since what the node holds is unknown until it
     * loads, and a Proxy's target is fixed when it is created. Eager builds an array on the array itself
     * (so `Array.isArray` sees it) and any other non-callable value on the wrapper. Once a lazy node loads
     * an array or a primitive, a proxy is built from the same handler on that target and put in the parent
     * in place of the lazy one, which forwards every operation to it from then on, as a namespace upgraded
     * to callable does (#533).
     *
     * @returns {void}
     * @private
     *
     * @example
     * if (Array.isArray(internal.impl)) wrapper.___settleLazyProxy();
     */
    private ___settleLazyProxy;
    /**
     * Swap the proxy the parent node holds for this wrapper at its apiPath (#533).
     *
     * @description
     * Walks the live api tree from the root along `apiPath` through raw wrappers' own properties (no
     * proxy traps, so nothing materializes) and replaces the child only where it is exactly `oldProxy`,
     * keeping its property descriptor (children are defined configurable). `boundApi`/`self` forward to
     * the same root, so one swap covers them. When the path no longer leads to `oldProxy` (the node was
     * detached or replaced), nothing changes; the old proxy forwards to the new one regardless.
     *
     * @param {object} oldProxy - The proxy being replaced.
     * @param {object} newProxy - Its replacement.
     * @returns {void}
     * @private
     *
     * @example
     * wrapper.___replaceInParent(oldProxy, newProxy);
     */
    private ___replaceInParent;
    /**
     * Set new implementation and adopt children.
     * Delegates core impl work to _applyNewImpl, then emits lifecycle events
     * and updates materialization state.
     *
     * @param {*} newImpl - New implementation
     * @param {string} [moduleID] - Optional moduleID for lifecycle event (for replacements)
     * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
     *   wrappers and bypass collision-merged key guards. Use this for direct/explicit
     *   ___setImpl calls where reference preservation is the intent. Do NOT set for
     *   hot-reload paths (syncWrapper) where lazy refs should intentionally break.
     * @param {boolean} [attributeChildren=false] - When true, the children this call adopts (new ones and
     *   reused ones, all the way down) belong to `moduleID` rather than to this wrapper's own module. A
     *   reload passes it when it rebuilds one module's contribution to a namespace that another module
     *   created, so the rebuilt leaves stay attributed to the module that exports them (#525).
     * @private
     */
    private ___setImpl;
    /**
     * Reset wrapper to un-materialized lazy state with a fresh materialization function.
     * Used during reload to restore lazy wrappers to their shell state instead of
     * eagerly loading all implementations. Preserves proxy identity so existing
     * references continue to work - next property access triggers materialization
     * from the fresh materializeFunc (which reads updated source files from disk).
     * @param {Function} newMaterializeFunc - Fresh materialization function from rebuild
     * @param {Iterable<string>|null} [memberNames=null] - The rebuilt folder's entry names, replacing the
     *   ones this wrapper was built with (#571): until the next load they decide which names are members.
     * @returns {void}
     * @private
     */
    private ___resetLazy;
    /**
     * Trigger materialization (lazy mode only)
     * @returns {Promise<void>}
     * @private
     */
    private ___materialize;
    /**
     * @private
     * @returns {Promise<void>}
     *
     * @description
     * Exposes lazy materialization for waiting proxies and nested wrappers.
     *
     * @example
     * await wrapper._materialize();
     */
    private _materialize;
    /**
     * Keep the instance's lazy materialization count in step with this wrapper (#588). The wrapper
     * records whether it is counted as unloaded (`pending`), counted and loaded (`settled`), or never
     * counted, so each wrapper moves the count exactly once per transition no matter which path loads,
     * re-arms or discards it. A wrapper from a tree a restart replaced leaves the new tree's count alone.
     * A member a forced replace hides from the api is `parked`: nothing can reach it to load it, so it is
     * not counted until it is put back (`unpark`), and loading or re-arming it meanwhile leaves it parked.
     * One hidden after it loaded is `parked-loaded`: out of the total while hidden, and back in it, loaded,
     * once put back.
     * @param {"register"|"loaded"|"rearm"|"discard"|"park"|"unpark"} event - What happened to the wrapper.
     * @returns {void}
     * @private
     *
     * @example
     * wrapper.___trackLazyLoad("loaded");
     */
    private ___trackLazyLoad;
    /**
     * Park the wrappers this parked wrapper holds as members, and theirs, so a hidden subtree's
     * wrappers made after it was hidden are left out of the materialization count too (#585 review).
     * Putting the member back unparks the whole subtree.
     * @param {Set<object>} [seen] - Wrappers already visited.
     * @returns {void}
     * @private
     *
     * @example
     * if (internal.lazyCount === "parked") wrapper.___parkChildren();
     */
    private ___parkChildren;
    /**
     * @private
     * @returns {void}
     *
     * @description
     * Invalidates this wrapper when its parent removes the API path.
     *
     * @example
     * wrapper.___invalidate();
     */
    private ___invalidate;
    /**
     * Whether the value at `key` on this wrapper was assigned by the user rather than adopted from a
     * module's impl (#543).
     * @param {string} key - Own child key.
     * @returns {boolean} True for a key assigned through the proxy outside a build (any value kind), or
     *   holding a wrap-on-set `userAssigned` wrapper.
     * @private
     */
    private ___isUserAssignedKey;
    /**
     * @private
     * @returns {void}
     *
     * @description
     * Moves child properties off the impl and attaches them to wrapper as properties
     * so this wrapper only represents the current API path.
     *
     * @example
     * wrapper.___adoptImplChildren();
     */
    private ___adoptImplChildren;
    /**
     * @private
     * @param {string|symbol} key - Child property name
     * @param {unknown} value - Child value
     * @param {WeakSet<object>|null} [visited=null] - Cycle-guard set threaded through an eager adopt
     *   traversal so a self-referential value cannot recurse forever (#330); null outside a traversal.
     * @param {boolean} [deferChildAdopt=false] - Defer the child's own eager adoption to first getTrap
     *   access, so a deep wrap-on-set graft is wrapped one level per access instead of recursively (#329).
     * @returns {Object|Function|null|undefined} Wrapped child proxy, or null/undefined when the value is
     *   stored unwrapped (opaque built-ins, null, cycle bail-out) or is undefined.
     *
     * @description
     * Creates a child wrapper for impl values, including primitives.
     *
     * @example
     * const child = wrapper.___createChildWrapper("add", fn);
     */
    private ___createChildWrapper;
    /**
     * Create recursive waiting proxy for deep lazy loading
     * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
     * wrappers to materialize before accessing the final property.
     *
     * Waiting proxies are ONLY created when not materialized or in-flight.
     * Once materialized, we return actual cached values, not waiting proxies.
     * Therefore, waiting proxies always represent in-flight/unmaterialized state.
     *
     * CRITICAL: Caches waiting proxies by propChain key to ensure subsequent accesses
     * return the SAME proxy object, which can then delegate once materialization completes.
     * This matches v2's propertyProxyCache behavior.
     *
     * @private
     * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
     * @returns {Proxy} Proxy that waits for materialization before applying calls.
     */
    private ___createWaitingProxy;
    /**
     * Create main proxy for this wrapper
     * Handles lazy/eager mode logic, property access, and context binding
     *
     * @returns {Proxy} Main proxy for API
     * @public
     */
    public createProxy(): ProxyConstructor;
    #private;
}
import { IMPL_METADATA_KEYS } from "@cldmv/slothlet/helpers/reserved-keys";
import { isFrameworkReservedKey } from "@cldmv/slothlet/helpers/reserved-keys";
import { ComponentBase } from "#factories/component-base";
export { IMPL_METADATA_KEYS, isFrameworkReservedKey };
//# sourceMappingURL=unified-wrapper.d.mts.map