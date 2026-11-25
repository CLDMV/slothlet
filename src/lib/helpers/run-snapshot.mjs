/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/run-snapshot.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-23T00:08:30-08:00 (1795421310)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The snapshot a `run()` / `scope()` reads: the instance as it was when the run started.
 *
 * @description
 * Nothing is copied when a run opens. Each instance keeps a clock, and a run takes the next tick of it as its start. An
 * object the instance is about to change (a node of the api tree, or a value slothlet hands out as itself: a `Map`, a
 * `Date`, an object a leaf returned) is first saved as it is, once per window in which a run that has not seen the
 * change is open (a window starts when a run opens): the saved content is a version that answers the runs which
 * started while it was current. A run reads an object's version for its start, or the object itself when it has not
 * changed since. What the run changes it changes on a copy of its own, made on its first change.
 *
 * A nested run is a run of the run it was opened in: that run is its domain, with a clock of its own, and the outer
 * run's changes to its own copies are saved for the nested run the same way.
 *
 * Versions are kept only while a run that can still read them is open: when a run ends, the version its start fell in
 * goes unless another open run's start falls in it too, and once the last run of an instance has ended its versions are
 * dropped as a whole. A run that never ends keeps the one version per object it can read, however many other runs come
 * and go. A version lives with its object: an object the instance drops while a run is open is collected with its
 * versions. Opening a run, saving a version and reading one cost a lookup in the open runs' starts, not a pass over them,
 * and closing one costs the versions it was the newest reader of, so many runs open at once cost no more each than one.
 * An object that still holds what its last version holds is not saved again for a new window: that version answers the
 * new run too.
 *
 * Nothing here is asynchronous, and nothing uses the platform's async context: it works the same on both runtimes and
 * in a browser.
 *
 * @module @cldmv/slothlet/helpers/run-snapshot
 * @internal
 */
import {
	ArrayBufferMethods,
	ArrayMethods,
	Arrays,
	DataView,
	Date,
	EventTarget,
	FunctionMethods,
	functionSource,
	IteratorMethods,
	listPush,
	Map,
	MapMethods,
	mapEntries,
	NativeProxy,
	Objects,
	Promise,
	PromiseMethods,
	PrototypeFunctions,
	Reflect,
	RegExp,
	RegExpMethods,
	Set,
	SetMethods,
	setValues,
	StringMethods,
	Symbol,
	TypedArrayMethods,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";
import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * How many versions every instance keeps, across every instance: for the suite.
 * @type {number}
 * @private
 */
let keptVersions = 0;

/**
 * How many runs read a snapshot now, across every instance.
 * @type {number}
 * @private
 */
let openSnapshots = 0;

/**
 * A domain owns objects and opens runs: an instance (one per instance object), or a run, for the copies it made and the
 * runs opened in it.
 * @private
 */
class Domain {
	constructor() {
		/** The last tick handed out. */
		this.clock = 0;
		/** Start → how many open runs started on it. */
		this.starts = new Map();
		/** How many runs are open on it. */
		this.live = 0;
		/** The newest open run's start (0 with none open). */
		this.newest = 0;
		/** The open runs' starts, ascending and each once: kept in step with `starts`. */
		this.sorted = [];
		/** Object → the tick its current content dates from. */
		this.stamps = new WeakMap();
		/** Object → its saved versions `{from, to, content}`, oldest first. */
		this.versions = new WeakMap();
		/** How many versions it keeps. */
		this.count = 0;
		/** Key → the window (newest start) it was last checkpointed in (see {@link checkpointOnce}). */
		this.windows = new Map();
		/**
		 * The groups of versions it keeps, by who reads them (see {@link keep}): the newest open start that reads a
		 * version → the oldest open start that did when it was counted → the group. A group holds a count, not the
		 * versions: a version goes with the object it is a version of.
		 */
		this.readers = new Map();
	}
}

/**
 * Each instance object's domain.
 * @type {WeakMap<object, Domain>}
 * @private
 */
const INSTANCE_DOMAINS = new WeakMap();

/**
 * The domain of an instance object, made on first use.
 * @param {object} owner - The instance object.
 * @returns {Domain} Its domain.
 * @internal
 */
export function instanceDomain(owner) {
	let domain = WeakMapMethods.get(INSTANCE_DOMAINS, owner);
	if (domain === undefined) {
		domain = new Domain();
		WeakMapMethods.set(INSTANCE_DOMAINS, owner, domain);
	}
	return domain;
}

/**
 * The domain of an instance object, or null while it has none (no run was ever opened on it).
 * @param {object|null|undefined} owner - The instance object.
 * @returns {Domain|null} Its domain.
 * @internal
 */
export function domainOf(owner) {
	if (owner === null || owner === undefined || (typeof owner !== "object" && typeof owner !== "function")) return null;
	return WeakMapMethods.get(INSTANCE_DOMAINS, owner) ?? null;
}

/**
 * Tells a Proxy apart without running its traps (the platform's own check, set by the handlers that make nodes): a
 * Proxy is handed out and saved as it is, never inspected.
 * @type {function(*): boolean}
 * @private
 */
let isProxy = () => false;

/** Whether {@link setProxyCheck} has run. @type {boolean} */
let proxyCheckSet = false;

/**
 * Set how a Proxy is told apart (see {@link isProxy}).
 * @param {function(*): boolean} check - The check.
 * @returns {void}
 * @internal
 */
export function setProxyCheck(check) {
	// Set once, by the wrapper as it loads: a second set is refused, so code that sets it first makes slothlet's load fail.
	if (proxyCheckSet) throw ownBindingsRefusal("lib/helpers/run-snapshot", import.meta.url);
	proxyCheckSet = true;
	isProxy = check;
}

/**
 * Marks a view as slothlet's own (set by the builder of runs' views), so code that tells slothlet's values from a
 * module's hands it on as it is.
 * @type {function(object): object}
 * @private
 */
let markView = (view) => view;

/**
 * Set how a run's views are marked as slothlet's own (see {@link markView}).
 * @param {function(object): object} mark - The marker.
 * @returns {void}
 * @internal
 */
export function setViewMarker(mark) {
	markView = mark;
}

/**
 * Whether a run reads a snapshot anywhere, on any instance: the one check the paths that save objects make while none is.
 * @returns {boolean} True while one does.
 * @internal
 */
export function anyRunOpen() {
	return openSnapshots !== 0;
}

/**
 * Whether a run is open on a domain.
 * @param {Domain|null} domain - The domain.
 * @returns {boolean} True while one is.
 * @internal
 */
export function runsOpen(domain) {
	return domain !== null && domain.live !== 0;
}

/**
 * The index of the first entry of an ascending list that is not below `value`.
 * @param {Array<*>} list - The list.
 * @param {number} value - The value.
 * @param {function(*): number} [key] - What an entry is ordered by.
 * @returns {number} The index (the list's length when every entry is below it).
 * @private
 */
function lowerBound(list, value, key) {
	let low = 0;
	let high = list.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if ((key === undefined ? list[middle] : key(list[middle])) < value) low = middle + 1;
		else high = middle;
	}
	return low;
}

/**
 * Take the entry at `index` out of a list, in place.
 * @param {Array<*>} list - The list.
 * @param {number} index - The entry's index.
 * @returns {void}
 * @private
 */
function removeAt(list, index) {
	for (let at = index + 1; at < list.length; at++) list[at - 1] = list[at];
	list.length--;
}

/**
 * Count a start in on a domain.
 * @param {Domain} domain - The domain.
 * @param {number} start - The start.
 * @returns {void}
 * @private
 */
function addStart(domain, start) {
	const held = MapMethods.get(domain.starts, start) ?? 0;
	MapMethods.set(domain.starts, start, held + 1);
	domain.live++;
	if (start > domain.newest) domain.newest = start;
	if (held !== 0) return;
	// A new start is the newest nearly always (the clock only goes up): it goes at the end.
	const list = domain.sorted;
	const at = list.length === 0 || list[list.length - 1] < start ? list.length : lowerBound(list, start);
	listPush(list, start);
	for (let index = list.length - 1; index > at; index--) list[index] = list[index - 1];
	list[at] = start;
}

/**
 * Count a start out of a domain; the last one drops the domain's versions as a whole.
 * @param {Domain} domain - The domain.
 * @param {number} start - The start.
 * @returns {void}
 * @private
 */
function dropStart(domain, start) {
	const held = MapMethods.get(domain.starts, start) ?? 0;
	let below = 0;
	if (held <= 1) {
		MapMethods.delete(domain.starts, start);
		const at = lowerBound(domain.sorted, start);
		if (domain.sorted[at] === start) removeAt(domain.sorted, at);
		if (at > 0) below = domain.sorted[at - 1];
	} else MapMethods.set(domain.starts, start, held - 1);
	domain.live--;
	if (domain.live === 0) {
		domain.newest = 0;
		keptVersions -= domain.count;
		domain.count = 0;
		domain.stamps = new WeakMap();
		domain.versions = new WeakMap();
		domain.sorted = [];
		MapMethods.clear(domain.windows);
		MapMethods.clear(domain.readers);
		return;
	}
	// Another run still started on it: every version it reads is still read.
	if (held > 1) return;
	domain.newest = domain.sorted.length === 0 ? 0 : domain.sorted[domain.sorted.length - 1];
	// Only the versions the start that went was the newest reader of can have lost their last reader: the rest have a
	// newer one still open. A group whose oldest reader is at or below the open start just below it is read by that start
	// now, whole; the others are read by no open run any more, and go (see keep).
	const groups = MapMethods.get(domain.readers, start);
	if (groups === undefined) return;
	MapMethods.delete(domain.readers, start);
	for (const entry of mapEntries(groups)) {
		const oldest = entry[0];
		const group = entry[1];
		if (below !== 0 && below >= oldest) {
			let target = MapMethods.get(domain.readers, below);
			if (target === undefined) {
				target = new Map();
				MapMethods.set(domain.readers, below, target);
			}
			const present = MapMethods.get(target, oldest);
			if (present === undefined) MapMethods.set(target, oldest, group);
			else {
				group.into = present;
				present.size += group.size;
			}
		} else {
			group.released = true;
			domain.count -= group.size;
			keptVersions -= group.size;
		}
	}
}

/**
 * The versions a domain keeps that the same open runs read (see {@link keep}): how many there are, and whether they have
 * gone. Each version knows its group, and the group knows nothing of its versions: a version lives in its object's own
 * list and goes with the object, and one whose group has gone is read by no open run, and is cleared out of its list
 * when the object is next saved (see {@link beforeChange}).
 * @typedef {{size: number, released: boolean, into: ReaderGroup|null}} ReaderGroup
 * @private
 */

/**
 * A new, empty group of versions (see {@link ReaderGroup}): an object of no prototype, so nothing a module put on the
 * shared prototypes is read or run when it is made or read.
 * @returns {ReaderGroup} The group.
 * @private
 */
function newGroup() {
	return { __proto__: null, size: 0, released: false, into: null };
}

/**
 * The group a version is in now, following merges.
 * @param {{group: ReaderGroup}} version - The version.
 * @returns {ReaderGroup} Its group.
 * @private
 */
function groupOf(version) {
	let group = version.group;
	if (group.into === null) return group;
	while (group.into !== null) group = group.into;
	version.group = group;
	return group;
}

/**
 * Count a version under its readers (the open starts in its span): grouped by the newest of them and the oldest, so
 * closing a run touches only the groups it was the newest reader of, never the versions themselves. A version is read
 * by an open run while its group has not gone.
 * @param {Domain} domain - The domain.
 * @param {{from: number, to: number, group: ReaderGroup|null}} version - The version.
 * @returns {void}
 * @private
 */
function keep(domain, version) {
	const list = domain.sorted;
	const newest = list[lowerBound(list, version.to + 1) - 1];
	const oldest = list[lowerBound(list, version.from + 1)];
	let groups = MapMethods.get(domain.readers, newest);
	if (groups === undefined) {
		groups = new Map();
		MapMethods.set(domain.readers, newest, groups);
	}
	let group = MapMethods.get(groups, oldest);
	if (group === undefined) {
		group = newGroup();
		MapMethods.set(groups, oldest, group);
	}
	group.size++;
	version.group = group;
	domain.count++;
	keptVersions++;
}

/**
 * Whether a version is still read by an open run of its domain.
 * @param {{group: ReaderGroup}} version - The version.
 * @returns {boolean} True while it is.
 * @private
 */
function isKept(version) {
	return !groupOf(version).released;
}

/**
 * The end of a version's span.
 * @param {{to: number}} version - The version.
 * @returns {number} Its `to`.
 * @private
 */
function toOf(version) {
	return version.to;
}

/**
 * The snapshot state of one run: its start on its domain, the start it reads the instance at, and its own copies and
 * views. It is a domain itself for the runs opened in it.
 * @private
 */
class RunSnapshot extends Domain {
	/**
	 * @param {Domain} instance - The instance's domain.
	 * @param {RunSnapshot|null} parent - The run it was opened in.
	 */
	constructor(instance, parent) {
		super();
		this.instance = instance;
		this.parent = parent;
		const domain = parent ?? instance;
		this.start = ++domain.clock;
		addStart(domain, this.start);
		/** The tick of the instance's clock the run reads the instance at: its outermost run's start. */
		this.base = parent === null ? this.start : parent.base;
		if (parent !== null) addStart(instance, this.base);
		/** Raw object → the run's own copy, made on its first change. */
		this.copies = new WeakMap();
		/** Raw object → the run's view of it. */
		this.views = new WeakMap();
		/** Raw built-in → the run's own copy of it, made on its first read. */
		this.builtins = new WeakMap();
		/** The run's own copy → the tick of this run's clock it was made at. */
		this.created = new WeakMap();
		/** The run's own copy → the object it is a copy of. */
		this.origins = new WeakMap();
		/** The run's own copies of built-ins, which it changes where nothing sees it: saved when a run opens in it. */
		this.builtinList = [];
		/** Promise a call handed the run → the promise the run is handed (see {@link handOutSettled}). */
		this.promises = new WeakMap();
		this.closed = false;
		openSnapshots++;
		// What the run it was opened in holds in its own built-in copies is saved now, as of this run's start: the outer run
		// changes them as itself, where nothing sees the change.
		if (parent !== null) {
			const list = parent.builtinList;
			for (let index = 0; index < list.length; index++) beforeChange(parent, list[index], shallowCopy);
		}
	}
}

/**
 * Open the snapshot of a new run: O(1), nothing is copied.
 * @param {object} owner - The instance object.
 * @param {RunSnapshot|null|undefined} parent - The snapshot of the run it is opened in, if any.
 * @returns {RunSnapshot} The run's snapshot.
 * @internal
 */
export function openRunSnapshot(owner, parent) {
	return new RunSnapshot(instanceDomain(owner), parent && !parent.closed ? parent : null);
}

/**
 * Close a run's snapshot: its copies go with it, and the versions kept only for it go now (as a whole once no run of the
 * instance is open).
 * @param {RunSnapshot|null|undefined} snap - The snapshot.
 * @returns {void}
 * @internal
 */
export function closeRunSnapshot(snap) {
	if (snap === null || snap === undefined || snap.closed) return;
	snap.closed = true;
	openSnapshots--;
	if (snap.parent !== null) {
		dropStart(snap.parent, snap.start);
		dropStart(snap.instance, snap.base);
	} else dropStart(snap.instance, snap.start);
	keptVersions -= snap.count;
	snap.count = 0;
	MapMethods.clear(snap.readers);
	snap.copies = new WeakMap();
	snap.views = new WeakMap();
	snap.builtins = new WeakMap();
	snap.builtinList = [];
	snap.promises = new WeakMap();
}

/**
 * Save `subject` as it is before its domain changes it, for the runs that started since it last changed (the barrier).
 * Does nothing while no run is open, or when the content it has now is already saved for every open run.
 * @param {Domain|null} domain - The domain that owns it.
 * @param {object} subject - The object about to change.
 * @param {function(object): *} capture - Makes the content to keep.
 * @returns {boolean} True when a version was saved.
 * @internal
 */
export function beforeChange(domain, subject, capture) {
	if (domain === null || domain.live === 0) return false;
	const stamp = WeakMapMethods.get(domain.stamps, subject) ?? 0;
	if (stamp >= domain.newest) return false;
	let list = WeakMapMethods.get(domain.versions, subject);
	// Its versions hold the ones an open run reads, and ones no open run reads any more until they are cleared out here.
	if (list === undefined) {
		list = [];
		WeakMapMethods.set(domain.versions, subject, list);
	} else prune(list);
	const version = { __proto__: null, from: stamp, to: domain.clock, content: capture(subject), group: null };
	listPush(list, version);
	keep(domain, version);
	WeakMapMethods.set(domain.stamps, subject, domain.clock);
	return true;
}

/**
 * Clear the versions no open run reads any more out of an object's list, in place.
 * @param {Array<{group: ReaderGroup}>} list - The list.
 * @returns {void}
 * @private
 */
function prune(list) {
	let kept = 0;
	for (let index = 0; index < list.length; index++) if (isKept(list[index])) list[kept++] = list[index];
	list.length = kept;
}

/**
 * Whether `subject` was saved in the current window already (see {@link beforeChange}): its later changes need no
 * saving until another run opens.
 * @param {Domain|null} domain - The domain.
 * @param {object} subject - The object.
 * @returns {boolean} True when it was.
 * @internal
 */
export function savedThisWindow(domain, subject) {
	return domain === null || domain.live === 0 || (WeakMapMethods.get(domain.stamps, subject) ?? 0) >= domain.newest;
}

/**
 * Run `fn` once per window for `key` on a domain (a checkpoint a file takes before its code runs, say): not while no run
 * is open, and not again until another run opens.
 * @param {Domain|null} domain - The domain.
 * @param {*} key - What the checkpoint is for.
 * @param {function(): void} fn - The checkpoint.
 * @returns {void}
 * @internal
 */
export function checkpointOnce(domain, key, fn) {
	if (domain === null || domain.live === 0) return;
	if (MapMethods.get(domain.windows, key) === domain.newest) return;
	MapMethods.set(domain.windows, key, domain.newest);
	fn();
}

/**
 * Marker for "no version: read the object as it is".
 * @type {symbol}
 * @internal
 */
export const CURRENT = Symbol("slothlet.snapshot.current");

/**
 * The content `subject` had for a run that started at `start` on its domain: a saved version, or {@link CURRENT} when it
 * has not changed since.
 * @param {Domain|null} domain - The domain that owns it.
 * @param {object} subject - The object.
 * @param {number} start - The run's start.
 * @returns {*} The content, or {@link CURRENT}.
 * @internal
 */
export function versionAt(domain, subject, start) {
	if (domain === null) return CURRENT;
	const stamp = WeakMapMethods.get(domain.stamps, subject);
	if (stamp === undefined || start > stamp) return CURRENT;
	const list = WeakMapMethods.get(domain.versions, subject);
	if (list === undefined) return CURRENT;
	// The spans follow each other without overlapping: the first that ends at or after the start is the one it falls in,
	// if any.
	const index = lowerBound(list, start, toOf);
	if (index < list.length) {
		const version = list[index];
		if (version.from < start) {
			// A plain function's default prototype is saved as the function only (see saveDefaultPrototype): its content is
			// made on the first read that needs it. No other version is a function.
			if (typeof version.content === "function") version.content = defaultPrototypeOf(version.content);
			return version.content;
		}
	}
	return CURRENT;
}

/**
 * Whether `prototype` is the default prototype the language gives `fn`, as it was made: an extensible object inheriting
 * from `Object.prototype` that holds only `constructor`, naming `fn`, with its default attributes. Read by descriptors.
 * @param {*} prototype - The prototype.
 * @param {Function} fn - The function.
 * @returns {boolean} True for one.
 * @internal
 */
export function isDefaultPrototype(prototype, fn) {
	if (prototype === null || typeof prototype !== "object" || isProxy(prototype)) return false;
	if (Reflect.getPrototypeOf(prototype) !== Objects.prototype || !Reflect.isExtensible(prototype)) return false;
	const keys = Reflect.ownKeys(prototype);
	if (keys.length !== 1 || keys[0] !== "constructor") return false;
	const held = Reflect.getOwnPropertyDescriptor(prototype, "constructor");
	return held !== undefined && held.value === fn && held.writable === true && held.enumerable === false && held.configurable === true;
}

/**
 * A default prototype as the language makes it for `fn` (see {@link isDefaultPrototype}).
 * @param {Function} fn - The function.
 * @returns {object} The prototype.
 * @private
 */
function defaultPrototypeOf(fn) {
	const made = {};
	Reflect.defineProperty(made, "constructor", { __proto__: null, value: fn, writable: true, enumerable: false, configurable: true });
	return made;
}

/**
 * Save a plain function's default prototype that still holds only what the language gave it (see
 * {@link isDefaultPrototype}), for the runs open, as {@link beforeChange} saves any object: what it holds is known, so
 * the version is the function itself, and its content is made on the first read of it by a run that started before the
 * prototype changed (see {@link versionAt}). Nothing is copied for the many plain functions whose prototype nothing
 * changes.
 * @param {Domain|null} domain - The domain that owns it.
 * @param {object} prototype - The prototype.
 * @param {Function} fn - The function it is the default prototype of.
 * @returns {boolean} True when a version was saved.
 * @internal
 */
export function saveDefaultPrototype(domain, prototype, fn) {
	return beforeChange(domain, prototype, () => fn);
}

/**
 * Which built-in data kind `value` is, by the engine's own brand checks (a Proxy never passes one): `"map"`, `"set"`,
 * `"date"`, `"regexp"`, `"typed"`, `"buffer"`, `"dataview"`, or null.
 * @param {*} value - The value.
 * @returns {string|null} Its kind.
 * @internal
 */
export function builtinKind(value) {
	if (value === null || typeof value !== "object") return null;
	if (kindCheck !== null) {
		const kind = kindCheck(value);
		return kind === "weak" || kind === "promise" ? null : kind;
	}
	if (brand(PrototypeFunctions.Map.size, value)) return "map";
	if (brand(PrototypeFunctions.Set.size, value)) return "set";
	if (brand(PrototypeFunctions.Date.getTime, value)) return "date";
	if (brand(PrototypeFunctions.RegExp.source, value)) return "regexp";
	if (FunctionMethods.call(PrototypeFunctions.TypedArray.toStringTag, value) !== undefined) return "typed";
	if (brand(PrototypeFunctions.ArrayBuffer.byteLength, value)) return "buffer";
	if (brand(PrototypeFunctions.DataView.byteLength, value)) return "dataview";
	return null;
}

/**
 * The platform's own brand checks, when the handlers set them (see {@link setKindCheck}): they tell the kinds apart
 * without throwing, where calling a built-in's method to ask throws for every other object.
 * @type {function(object): (string|null)|null}
 * @private
 */
let kindCheck = null;

/** Whether {@link setKindCheck} has run. @type {boolean} */
let kindCheckSet = false;

/**
 * Set how a built-in's kind is told (see {@link builtinKind}).
 * @param {function(object): (string|null)} check - Answers `"map"`, `"set"`, `"date"`, `"regexp"`, `"typed"`,
 *   `"buffer"`, `"dataview"`, `"weak"` (a weak collection or reference), `"promise"`, or null.
 * @returns {void}
 * @internal
 */
export function setKindCheck(check) {
	// Set once, by the wrapper as it loads: a second set is refused, so code that sets it first makes slothlet's load fail.
	if (kindCheckSet) throw ownBindingsRefusal("lib/helpers/run-snapshot", import.meta.url);
	kindCheckSet = true;
	kindCheck = check;
}

/**
 * Whether calling `fn` on `value` passes the engine's brand check.
 * @param {Function|null} fn - A function of a built-in's prototype.
 * @param {*} value - The value.
 * @param {Array<*>} [args=[]] - Arguments.
 * @returns {boolean} True when it does not throw.
 * @private
 */
function brand(fn, value, args = []) {
	if (typeof fn !== "function") return false;
	try {
		Reflect.apply(fn, value, args);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether a class declares private names, per class (see {@link declaresPrivate}).
 * @type {WeakMap<Function, boolean>}
 * @private
 */
const PRIVATE_SCAN = new WeakMap();

/**
 * Whether an object's class, or one it extends, declares `#private` names: the class's source is scanned once for a
 * `#name` token outside strings, templates and comments, and the answer is kept per class. Private names compiled to
 * helper functions or a `WeakMap` cannot be told apart this way.
 * @param {*} value - The object.
 * @returns {boolean} True when its class declares them.
 * @internal
 */
export function declaresPrivate(value) {
	if (value === null || typeof value !== "object") return false;
	for (let proto = Reflect.getPrototypeOf(value); proto !== null && proto !== Objects.prototype; proto = Reflect.getPrototypeOf(proto)) {
		const held = Reflect.getOwnPropertyDescriptor(proto, "constructor");
		const ctor = held !== undefined && "value" in held ? held.value : undefined;
		if (typeof ctor !== "function") continue;
		let has = WeakMapMethods.get(PRIVATE_SCAN, ctor);
		if (has === undefined) {
			let source;
			try {
				source = functionSource(ctor);
			} catch {
				source = "";
			}
			has = RegExpMethods.exec(/^class[\s{]/, source) !== null && scanPrivate(source);
			WeakMapMethods.set(PRIVATE_SCAN, ctor, has);
		}
		if (has) return true;
	}
	return false;
}

/**
 * Whether class source holds a `#name` token outside strings, templates, regular expression literals and comments.
 * @param {string} source - The class's source.
 * @returns {boolean} True when it does.
 * @private
 */
function scanPrivate(source) {
	for (let index = 0; index < source.length; index++) {
		const char = source[index];
		if (char === "'" || char === '"' || char === "`") {
			for (index++; index < source.length && source[index] !== char; index++) if (source[index] === "\\") index++;
		} else if (char === "/" && source[index + 1] === "/") {
			while (index < source.length && source[index] !== "\n") index++;
		} else if (char === "/" && source[index + 1] === "*") {
			const end = StringMethods.indexOf(source, "*/", index + 2);
			if (end < 0) return false;
			index = end + 1;
		} else if (char === "#" && RegExpMethods.exec(/[A-Za-z_$\u0080-\uffff]/, source[index + 1] ?? "") !== null) return true;
	}
	return false;
}

/**
 * Whether a value is a live object a run shares with the instance rather than reads a snapshot of: a function, a
 * promise, a weak collection or reference, an `EventEmitter`-like or `EventTarget`. What such an object does (a
 * listener added, an event emitted) works both ways.
 * @param {*} value - The value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isSharedLive(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (typeof value === "function") return true;
	if (kindCheck !== null) {
		const kind = kindCheck(value);
		if (kind === "weak" || kind === "promise") return true;
		if (kind !== null) return false;
		if (typeof EventTarget === "function" && inherits(value, EventTarget)) return true;
		return isEmitterLike(value);
	}
	// Told by its prototype chain: calling `then` to ask would make a promise that rejects with it, unhandled.
	if (inherits(value, Promise)) return true;
	if (brand(PrototypeFunctions.WeakMap.has, value, [{}])) return true;
	if (brand(PrototypeFunctions.WeakSet.has, value, [{}])) return true;
	if (PrototypeFunctions.WeakRef.deref !== undefined && brand(PrototypeFunctions.WeakRef.deref, value)) return true;
	if (typeof EventTarget === "function" && inherits(value, EventTarget)) return true;
	return isEmitterLike(value);
}

/**
 * Whether a value is an emitter: it inherits `on` and `emit` functions from a prototype (Node's `EventEmitter`, or one
 * shaped like it).
 * @param {object} value - The value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isEmitterLike(value) {
	if (value === null || typeof value !== "object") return false;
	for (let proto = Reflect.getPrototypeOf(value); proto !== null && proto !== Objects.prototype; proto = Reflect.getPrototypeOf(proto)) {
		const on = Reflect.getOwnPropertyDescriptor(proto, "on");
		const emit = Reflect.getOwnPropertyDescriptor(proto, "emit");
		if (on !== undefined && emit !== undefined && typeof on.value === "function" && typeof emit.value === "function") return true;
	}
	return false;
}

/**
 * `value instanceof ctor`, by the prototype chain only.
 * @param {*} value - The value.
 * @param {Function} ctor - The class.
 * @returns {boolean} Whether it inherits from `ctor.prototype`.
 * @private
 */
function inherits(value, ctor) {
	const prototype = ctor.prototype;
	for (let proto = Reflect.getPrototypeOf(value); proto !== null; proto = Reflect.getPrototypeOf(proto))
		if (proto === prototype) return true;
	return false;
}

/**
 * A shallow copy of an object's own state, keeping its prototype: a built-in of the same kind holding the same entries,
 * or an object holding the same own members (data members as values, accessors as they are).
 * @param {object} raw - The object.
 * @returns {object} The copy.
 * @internal
 */
export function shallowCopy(raw) {
	const kind = builtinKind(raw);
	let copy;
	if (kind === "map") {
		copy = new Map();
		for (const entry of mapEntries(raw)) MapMethods.set(copy, entry[0], entry[1]);
	} else if (kind === "set") {
		copy = new Set();
		for (const member of setValues(raw)) SetMethods.add(copy, member);
	} else if (kind === "date") copy = new Date(FunctionMethods.call(PrototypeFunctions.Date.getTime, raw));
	else if (kind === "regexp") {
		copy = new RegExp(raw);
		copy.lastIndex = raw.lastIndex;
	} else if (kind === "typed") copy = TypedArrayMethods.slice(raw);
	else if (kind === "buffer") copy = ArrayBufferMethods.slice(raw, 0);
	else if (kind === "dataview") {
		const offset = FunctionMethods.call(PrototypeFunctions.DataView.byteOffset, raw);
		const length = FunctionMethods.call(PrototypeFunctions.DataView.byteLength, raw);
		copy = new DataView(ArrayBufferMethods.slice(FunctionMethods.call(PrototypeFunctions.DataView.buffer, raw), offset, offset + length));
	} else if (Arrays.isArray(raw)) copy = [];
	else copy = Objects.create(Reflect.getPrototypeOf(raw));
	if (kind !== null) {
		const prototype = Reflect.getPrototypeOf(raw);
		if (Reflect.getPrototypeOf(copy) !== prototype) Reflect.setPrototypeOf(copy, prototype);
	}
	if (kind === null || kind === "map" || kind === "set" || kind === "date" || kind === "regexp") {
		const keys = Reflect.ownKeys(raw);
		for (let index = 0; index < keys.length; index++) {
			const key = keys[index];
			const described = Reflect.getOwnPropertyDescriptor(raw, key);
			if (described === undefined) continue;
			if (kind === "regexp" && key === "lastIndex") continue;
			if (Arrays.isArray(copy) && key === "length") {
				copy.length = described.value;
				continue;
			}
			Reflect.defineProperty(copy, key, { __proto__: null, ...described, configurable: true });
		}
	}
	return copy;
}

/**
 * Save a value the instance is about to hand out as itself, and what it reaches, once per window: a `Map`, a `Date`, an
 * object a leaf returned. The instance's code may then change it where slothlet does not see the change, and the runs
 * open read it as it was. Shared live objects are left alone. Walked with a list of its own, not the call stack, so a
 * structure of any depth is saved. An object that holds just what its last version holds keeps that version for the
 * runs that started since (see {@link keepUnchanged}): a large value handed out again in every new window is compared,
 * not copied again.
 * @param {Domain|null} domain - The instance's domain.
 * @param {*} raw - The value.
 * @param {Set<object>} [seen] - Objects already walked.
 * @param {function(object): boolean|null} [skip] - Tells objects to leave alone (one whose reads would run code: a Proxy).
 * @returns {void}
 * @internal
 */
export function checkpointDeep(domain, raw, seen = new Set(), skip = null) {
	if (domain === null || domain.live === 0 || raw === null || typeof raw !== "object") return;
	const work = [raw];
	while (work.length !== 0) {
		const value = work[work.length - 1];
		work.length--;
		if (SetMethods.has(seen, value)) continue;
		SetMethods.add(seen, value);
		// Saved in this window already: so was what it reaches, or it has changed since through a path that saves it.
		const stamp = WeakMapMethods.get(domain.stamps, value);
		if (stamp !== undefined && stamp >= domain.newest) continue;
		if (isProxy(value) || (skip !== null && skip(value))) continue;
		const known = knownKind(value);
		if (known === "weak" || known === "promise" || (known === null && isLiveObject(value))) continue;
		if (known === null) saveMembers(domain, value, work);
		else {
			if (!keepUnchanged(domain, value, known)) beforeChange(domain, value, shallowCopy);
			if (known === "map") {
				for (const entry of mapEntries(value)) pushObject(work, entry[1]);
			} else if (known === "set") {
				for (const member of setValues(value)) pushObject(work, member);
			}
		}
		// A prototype of a module's own (a class's, or an object another inherits from) is changed as itself too: it is
		// saved with what inherits from it, up to the language's own.
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== null && !isLanguagePrototype(prototype)) pushObject(work, prototype);
	}
}

/**
 * The kinds {@link knownKind} found, by object: an object's kind is fixed when it is made, and telling some apart costs
 * a thrown error each time (a `WeakRef`'s check), which a large value saved again in every window would pay per member.
 * @type {WeakMap<object, string>}
 * @private
 */
const KNOWN_KINDS = new WeakMap();

/**
 * An object's kind as the platform's checks tell it (see {@link setKindCheck}): `"map"`, `"set"`, `"date"`, `"regexp"`,
 * `"typed"`, `"buffer"`, `"dataview"`, `"weak"`, `"promise"`, or null; asked of the platform once per object.
 * @param {object} value - The object.
 * @returns {string|null} Its kind.
 * @private
 */
function knownKind(value) {
	// Without the platform's checks, a shared live object is answered as a weak one: either is left alone.
	if (kindCheck === null) return isSharedLive(value) ? "weak" : builtinKind(value);
	let kind = WeakMapMethods.get(KNOWN_KINDS, value);
	if (kind === undefined) {
		kind = kindCheck(value) ?? "";
		WeakMapMethods.set(KNOWN_KINDS, value, kind);
	}
	return kind === "" ? null : kind;
}

/**
 * Whether an object of no built-in kind is one a run shares live (see {@link isSharedLive}): an `EventTarget` or an
 * emitter.
 * @param {object} value - The object.
 * @returns {boolean} True for one.
 * @private
 */
function isLiveObject(value) {
	return (typeof EventTarget === "function" && inherits(value, EventTarget)) || isEmitterLike(value);
}

/**
 * Add a value to a walk's list when it is an object.
 * @param {Array<object>} work - The list.
 * @param {*} value - The value.
 * @returns {void}
 * @private
 */
function pushObject(work, value) {
	if (value !== null && typeof value === "object") listPush(work, value);
}

/**
 * The last version of an object a run may read, when it still answers for the object's content as of now unless the
 * object changed where slothlet did not see it: the version saved when the object was last saved, as a copy of its
 * members (see {@link shallowCopy}). Null when there is none.
 * @param {Domain} domain - The domain.
 * @param {object} raw - The object.
 * @returns {{from: number, to: number, content: object}|null} The version.
 * @private
 */
function lastCopy(domain, raw) {
	const list = WeakMapMethods.get(domain.versions, raw);
	if (list === undefined || list.length === 0) return null;
	const last = list[list.length - 1];
	if (last.to !== (WeakMapMethods.get(domain.stamps, raw) ?? 0) || last.content === null || typeof last.content !== "object") return null;
	return last;
}

/**
 * Have an object's last version answer the runs that started since too, its content being the object's still: its span
 * reaches to now, and it is counted under the runs that read it now.
 * @param {Domain} domain - The domain.
 * @param {object} raw - The object.
 * @param {{from: number, to: number, group: ReaderGroup}} last - Its last version (see {@link lastCopy}).
 * @returns {void}
 * @private
 */
function extendVersion(domain, raw, last) {
	const group = groupOf(last);
	if (!group.released) {
		group.size--;
		domain.count--;
		keptVersions--;
	}
	last.to = domain.clock;
	keep(domain, last);
	WeakMapMethods.set(domain.stamps, raw, domain.clock);
}

/**
 * Save an object of no built-in kind (a plain object, an array, a class instance) for the runs open, and add the
 * objects its own enumerable data members hold to the walk: one pass over its members, which also tells whether it
 * still holds just what its last version holds (see {@link sameMembers}), in which case that version answers the runs
 * that started since too, instead of the same content saved again.
 * @param {Domain} domain - The domain.
 * @param {object} raw - The object.
 * @param {Array<object>} work - The walk's list.
 * @returns {void}
 * @private
 */
function saveMembers(domain, raw, work) {
	const keys = Reflect.ownKeys(raw);
	const last = lastCopy(domain, raw);
	let content = last === null ? null : last.content;
	let others = null;
	if (content !== null) {
		if (Reflect.getPrototypeOf(raw) !== Reflect.getPrototypeOf(content) || Arrays.isArray(raw) !== Arrays.isArray(content)) content = null;
		else {
			others = Reflect.ownKeys(content);
			if (others.length !== keys.length) content = null;
		}
	}
	for (let index = 0; index < keys.length; index++) {
		const key = keys[index];
		const mine = Reflect.getOwnPropertyDescriptor(raw, key);
		if (mine === undefined) {
			content = null;
			continue;
		}
		if (content !== null && (key !== others[index] || !sameMember(mine, Reflect.getOwnPropertyDescriptor(content, key)))) content = null;
		if (mine.enumerable && typeof key === "string" && "value" in mine) pushObject(work, mine.value);
	}
	if (content !== null) extendVersion(domain, raw, last);
	else beforeChange(domain, raw, shallowCopy);
}

/**
 * Whether two own members are one: the same value or accessors, with the same attributes (all but `configurable`,
 * which a version's copy always has).
 * @param {PropertyDescriptor} mine - The object's member.
 * @param {PropertyDescriptor|undefined} theirs - The version's.
 * @returns {boolean} True when they are.
 * @private
 */
function sameMember(mine, theirs) {
	if (theirs === undefined || mine.enumerable !== theirs.enumerable) return false;
	if ("value" in mine) return "value" in theirs && mine.writable === theirs.writable && Objects.is(mine.value, theirs.value);
	return !("value" in theirs) && mine.get === theirs.get && mine.set === theirs.set;
}

/**
 * When a `Map`, a `Set` or a `Date` a run may read holds just what its last version holds, have that version answer the
 * runs that started since too, instead of saving the same content again (see {@link extendVersion}).
 * @param {Domain} domain - The domain.
 * @param {object} raw - The object.
 * @param {string} kind - Its built-in kind (see {@link builtinKind}).
 * @returns {boolean} True when the version now answers the runs open.
 * @private
 */
function keepUnchanged(domain, raw, kind) {
	if (kind !== "map" && kind !== "set" && kind !== "date") return false;
	const last = lastCopy(domain, raw);
	if (last === null || !sameContent(raw, last.content, kind)) return false;
	extendVersion(domain, raw, last);
	return true;
}

/**
 * Whether a `Map`, a `Set` or a `Date` holds just what `content` (a version {@link shallowCopy} made of it) holds: the
 * same prototype, the same entries in the same order or the same time, and the same own members.
 * @param {object} raw - The object.
 * @param {object} content - The version's content.
 * @param {string} kind - The object's built-in kind.
 * @returns {boolean} True when it does.
 * @private
 */
function sameContent(raw, content, kind) {
	if (Reflect.getPrototypeOf(raw) !== Reflect.getPrototypeOf(content)) return false;
	if (Arrays.isArray(raw) !== Arrays.isArray(content) || knownKind(content) !== kind) return false;
	if (kind === "map") {
		if (MapMethods.size(raw) !== MapMethods.size(content)) return false;
		const held = MapMethods.entries(content);
		for (const entry of mapEntries(raw)) {
			const other = IteratorMethods.mapNext(held).value;
			if (!Objects.is(entry[0], other[0]) || !Objects.is(entry[1], other[1])) return false;
		}
	} else if (kind === "set") {
		if (SetMethods.size(raw) !== SetMethods.size(content)) return false;
		const held = SetMethods.values(content);
		for (const member of setValues(raw)) if (!Objects.is(member, IteratorMethods.setNext(held).value)) return false;
	} else if (kind === "date") {
		const time = FunctionMethods.call(PrototypeFunctions.Date.getTime, raw);
		if (!Objects.is(time, FunctionMethods.call(PrototypeFunctions.Date.getTime, content))) return false;
	}
	const keys = Reflect.ownKeys(raw);
	const others = Reflect.ownKeys(content);
	if (keys.length !== others.length) return false;
	for (let index = 0; index < keys.length; index++) {
		const key = keys[index];
		if (key !== others[index]) return false;
		const mine = Reflect.getOwnPropertyDescriptor(raw, key);
		if (mine === undefined || !sameMember(mine, Reflect.getOwnPropertyDescriptor(content, key))) return false;
	}
	return true;
}

/**
 * Whether a prototype is one the language or the platform gives (`Object.prototype`, `Map.prototype`, an emitter's):
 * one no snapshot keeps versions of. A module's own (a class's prototype, an object made to be inherited from) is not.
 * @type {WeakMap<object, boolean>}
 * @private
 */
const LANGUAGE_PROTOTYPES = new WeakMap();

/**
 * Whether `prototype` is the language's own (see {@link LANGUAGE_PROTOTYPES}): null, the prototype of a native class
 * (its own `constructor` is native code), or an emitter's, which a run shares live.
 * @param {object|null} prototype - The prototype.
 * @returns {boolean} True for one.
 * @internal
 */
export function isLanguagePrototype(prototype) {
	if (prototype === null || (typeof prototype !== "object" && typeof prototype !== "function")) return true;
	let held = WeakMapMethods.get(LANGUAGE_PROTOTYPES, prototype);
	if (held === undefined) {
		held = false;
		if (isProxy(prototype)) held = true;
		else {
			const described = Reflect.getOwnPropertyDescriptor(prototype, "constructor");
			const ctor = described !== undefined && "value" in described ? described.value : undefined;
			if (typeof ctor === "function") {
				let source;
				try {
					source = functionSource(ctor);
				} catch {
					source = "";
				}
				held = RegExpMethods.exec(/\{\s*\[native code\]\s*\}\s*$/, source) !== null;
			}
			if (!held) {
				const on = Reflect.getOwnPropertyDescriptor(prototype, "on");
				const emit = Reflect.getOwnPropertyDescriptor(prototype, "emit");
				held = on !== undefined && emit !== undefined && typeof on.value === "function" && typeof emit.value === "function";
			}
		}
		WeakMapMethods.set(LANGUAGE_PROTOTYPES, prototype, held);
	}
	return held;
}

/**
 * Views a run hands out of raw objects, each with its run and the object it reads.
 * @type {WeakMap<object, {snap: RunSnapshot, raw: object}>}
 * @private
 */
const RAW_VIEWS = new WeakMap();

/**
 * The object behind a run's view of a raw object, or `value` itself.
 * @param {*} value - A value.
 * @returns {*} The object it stands for.
 * @internal
 */
export function rawBehind(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	return WeakMapMethods.get(RAW_VIEWS, value)?.raw ?? value;
}

/**
 * Whether a value is a run's view of a raw object.
 * @param {*} value - A value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isRawRunView(value) {
	return value !== null && (typeof value === "object" || typeof value === "function") && WeakMapMethods.has(RAW_VIEWS, value);
}

/**
 * The content of `raw` as a run reads it: its own copy, else what its domain had when the run started.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The object.
 * @returns {object} The content.
 * @internal
 */
export function rawContent(snap, raw) {
	const own = WeakMapMethods.get(snap.copies, raw);
	if (own !== undefined) return own;
	return contentIn(snap.parent, snap.instance, originOf(snap, raw), snap.start, snap.base);
}

/**
 * The object a copy an outer run made stands for, followed out to the instance's: what a nested run reads it as is
 * that object as the outer run read it when the nested run started.
 * @param {RunSnapshot} snap - The run.
 * @param {object} value - An object.
 * @returns {object} The object it stands for, or `value` itself.
 * @internal
 */
export function originOf(snap, value) {
	for (let domain = snap.parent; domain !== null; domain = domain.parent) {
		const origin = WeakMapMethods.get(domain.origins, value);
		if (origin !== undefined) value = origin;
	}
	return value;
}

/**
 * Whether `outer` is a run `snap` was opened in, at any depth.
 * @param {RunSnapshot} outer - A run.
 * @param {RunSnapshot} snap - The run.
 * @returns {boolean} True when it is.
 * @private
 */
function encloses(outer, snap) {
	for (let domain = snap.parent; domain !== null; domain = domain.parent) if (domain === outer) return true;
	return false;
}

/**
 * The content of `raw` in the domain a run was opened on, as of the run's start.
 * @param {RunSnapshot|null} domain - The run it was opened in, or null for the instance.
 * @param {Domain} instance - The instance's domain.
 * @param {object} raw - The object.
 * @param {number} start - The run's start on `domain`.
 * @param {number} base - The run's start on the instance.
 * @returns {object} The content.
 * @private
 */
function contentIn(domain, instance, raw, start, base) {
	if (domain !== null) {
		const copy = WeakMapMethods.get(domain.copies, raw) ?? WeakMapMethods.get(domain.builtins, raw);
		if (copy !== undefined && WeakMapMethods.get(domain.created, copy) < start) {
			const held = versionAt(domain, copy, start);
			return held === CURRENT ? copy : held;
		}
		return contentIn(domain.parent, instance, raw, domain.start, base);
	}
	const held = versionAt(instance, raw, base);
	return held === CURRENT ? raw : held;
}

/**
 * The run's own copy of `raw`, made on its first change.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The object.
 * @returns {object} The copy.
 * @private
 */
function ownCopy(snap, raw) {
	let copy = WeakMapMethods.get(snap.copies, raw);
	if (copy === undefined) {
		copy = shallowCopy(rawContent(snap, raw));
		WeakMapMethods.set(snap.created, copy, snap.clock);
		WeakMapMethods.set(snap.origins, copy, raw);
		WeakMapMethods.set(snap.copies, raw, copy);
	} else beforeChange(snap, copy, shallowCopy);
	return copy;
}

/**
 * What a run hands out for a raw value it read (not a node of the tree): a shared live object as itself, a built-in as
 * the run's own copy of it, any other object as the run's view of it, read as of the run's start.
 * @param {RunSnapshot|null} snap - The run.
 * @param {*} value - The value.
 * @returns {*} What the run is handed.
 * @internal
 */
export function handOutRaw(snap, value) {
	if (snap === null || snap.closed || value === null || typeof value !== "object") return value;
	const known = WeakMapMethods.get(RAW_VIEWS, value);
	if (known !== undefined) {
		if (known.snap === snap) return value;
		// An outer run's view stands for its object, which this run reads as of its own start.
		if (encloses(known.snap, snap)) value = known.raw;
	}
	const madeBy = WeakMapMethods.get(OWN_BUILTINS, value);
	if (madeBy !== undefined) {
		if (madeBy === snap || !encloses(madeBy, snap)) return value;
		value = originOf(snap, value);
	}
	if (isProxy(value)) return value;
	if (isSharedLive(value)) return value;
	if (builtinKind(value) !== null) return builtinCopy(snap, value);
	return viewOf(snap, value);
}

/**
 * What a run is handed for a promise a call handed it: a promise of what the run is handed for the value it settles
 * with (see {@link handOutRaw}), the same one each time for the same promise. A rejection is handed on as it is.
 * @param {RunSnapshot|null} snap - The run.
 * @param {Promise<*>} promise - The promise.
 * @param {function(*): *} handOut - What the run is handed for the value.
 * @returns {Promise<*>} The promise the run is handed.
 * @internal
 */
export function handOutSettled(snap, promise, handOut) {
	if (snap === null || snap.closed) return promise;
	let handed = WeakMapMethods.get(snap.promises, promise);
	if (handed === undefined) {
		handed = PromiseMethods.then(promise, handOut);
		WeakMapMethods.set(snap.promises, promise, handed);
	}
	return handed;
}

/**
 * The runs' own copies of built-ins (see {@link builtinCopy}), each with the run that made it: handed out to it as
 * themselves.
 * @type {WeakMap<object, RunSnapshot>}
 * @private
 */
const OWN_BUILTINS = new WeakMap();

/**
 * The run's own copy of a built-in (a `Map`, `Set`, `Date`, `RegExp`, typed array, `ArrayBuffer` or `DataView`), made on
 * its first read from the content as of the run's start: a real object of its kind, so the language's own methods work
 * on it, and what the run changes on it stays in the run. The values a `Map` or `Set` holds are handed out as the run
 * reads them.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The built-in.
 * @returns {object} The copy.
 * @internal
 */
export function builtinCopy(snap, raw) {
	raw = originOf(snap, raw);
	let copy = WeakMapMethods.get(snap.builtins, raw);
	if (copy !== undefined) return copy;
	const source = rawContent(snap, raw);
	const kind = builtinKind(source);
	if (kind === "map") {
		copy = new Map();
		for (const entry of mapEntries(source)) MapMethods.set(copy, entry[0], handOutRaw(snap, entry[1]));
		Reflect.setPrototypeOf(copy, Reflect.getPrototypeOf(source));
	} else if (kind === "set") {
		copy = new Set();
		for (const member of setValues(source)) SetMethods.add(copy, handOutRaw(snap, member));
		Reflect.setPrototypeOf(copy, Reflect.getPrototypeOf(source));
	} else copy = shallowCopy(source);
	WeakMapMethods.set(OWN_BUILTINS, copy, snap);
	WeakMapMethods.set(snap.created, copy, snap.clock);
	WeakMapMethods.set(snap.origins, copy, raw);
	WeakMapMethods.set(snap.builtins, raw, copy);
	listPush(snap.builtinList, copy);
	return copy;
}

/**
 * The value a view hands to the object behind it when the run writes one: a run's view stands for its object.
 * @param {RunSnapshot} snap - The run.
 * @param {*} value - The value written.
 * @returns {*} The value to store.
 * @private
 */
function unwrapFor(snap, value) {
	const known =
		value !== null && (typeof value === "object" || typeof value === "function") ? WeakMapMethods.get(RAW_VIEWS, value) : undefined;
	return known !== undefined && known.snap === snap ? known.raw : value;
}

/**
 * Methods of a `#private` class's instance as a run's view hands them out: called with the view as `this`, they run on
 * the instance (see {@link viewOf}).
 * @type {WeakMap<object, WeakMap<Function, Function>>}
 * @private
 */
const PRIVATE_METHODS = new WeakMap();

/**
 * A method read through a run's view of an instance of a class with `#private` fields: called on the view it runs on
 * the instance itself, so its private fields are found.
 * @param {object} view - The view.
 * @param {object} raw - The instance.
 * @param {Function} fn - The method.
 * @returns {Function} The method as handed out.
 * @private
 */
function privateMethod(view, raw, fn) {
	let byView = WeakMapMethods.get(PRIVATE_METHODS, view);
	if (byView === undefined) {
		byView = new WeakMap();
		WeakMapMethods.set(PRIVATE_METHODS, view, byView);
	}
	let handed = WeakMapMethods.get(byView, fn);
	if (handed === undefined) {
		handed = new NativeProxy(fn, {
			__proto__: null,
			apply: (target, thisArg, args) => Reflect.apply(target, thisArg === view ? raw : thisArg, args)
		});
		WeakMapMethods.set(byView, fn, handed);
	}
	return handed;
}

/**
 * The run's view of a plain object, an array or a class instance it reached through a raw value: reads answer the
 * object as of the run's start (or the run's own copy, once the run changed it), and writes go to the run's own copy.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The object.
 * @returns {object} The view.
 * @internal
 */
export function viewOf(snap, raw) {
	raw = originOf(snap, raw);
	let view = WeakMapMethods.get(snap.views, raw);
	if (view !== undefined) return view;
	const shell = Arrays.isArray(raw) ? [] : Objects.create(Reflect.getPrototypeOf(raw));
	const hidden = declaresPrivate(raw);
	view = new NativeProxy(shell, {
		__proto__: null,
		get: (_t, prop) => {
			const value = Reflect.get(rawContent(snap, raw), prop, view);
			if (hidden && typeof value === "function") return privateMethod(view, raw, value);
			return handOutRaw(snap, value);
		},
		set: (_t, prop, value) => Reflect.set(ownCopy(snap, raw), prop, unwrapFor(snap, value)),
		has: (_t, prop) => Reflect.has(rawContent(snap, raw), prop),
		deleteProperty: (_t, prop) => Reflect.deleteProperty(ownCopy(snap, raw), prop),
		defineProperty: (_t, prop, descriptor) =>
			Reflect.defineProperty(
				ownCopy(snap, raw),
				prop,
				"value" in descriptor ? { __proto__: null, ...descriptor, value: unwrapFor(snap, descriptor.value) } : descriptor
			),
		ownKeys: (target) => {
			const keys = Reflect.ownKeys(rawContent(snap, raw));
			if (Arrays.isArray(target) && !ArrayMethods.includes(keys, "length")) listPush(keys, "length");
			return keys;
		},
		getOwnPropertyDescriptor: (target, prop) => {
			const described = Reflect.getOwnPropertyDescriptor(rawContent(snap, raw), prop);
			if (described === undefined) return undefined;
			if (Arrays.isArray(target) && prop === "length") {
				target.length = described.value;
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}
			if ("value" in described) described.value = handOutRaw(snap, described.value);
			described.configurable = true;
			return described;
		},
		getPrototypeOf: () => Reflect.getPrototypeOf(rawContent(snap, raw)),
		setPrototypeOf: (_t, prototype) => Reflect.setPrototypeOf(ownCopy(snap, raw), prototype)
	});
	view = markView(view);
	WeakMapMethods.set(RAW_VIEWS, view, { snap, raw });
	WeakMapMethods.set(snap.views, raw, view);
	return view;
}

/**
 * How many versions every instance keeps and how many runs read a snapshot, across every instance: for the suite.
 * @returns {{versions: number, runs: number}} The counts.
 * @internal
 */
export function snapshotCounts() {
	return { versions: keptVersions, runs: openSnapshots };
}
