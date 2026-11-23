/**
 * The domain of an instance object, made on first use.
 * @param {object} owner - The instance object.
 * @returns {Domain} Its domain.
 * @internal
 */
export function instanceDomain(owner: object): Domain;
/**
 * The domain of an instance object, or null while it has none (no run was ever opened on it).
 * @param {object|null|undefined} owner - The instance object.
 * @returns {Domain|null} Its domain.
 * @internal
 */
export function domainOf(owner: object | null | undefined): Domain | null;
/**
 * Set how a Proxy is told apart (see {@link isProxy}).
 * @param {function(*): boolean} check - The check.
 * @returns {void}
 * @internal
 */
export function setProxyCheck(check: (arg0: any) => boolean): void;
/**
 * Set how a run's views are marked as slothlet's own (see {@link markView}).
 * @param {function(object): object} mark - The marker.
 * @returns {void}
 * @internal
 */
export function setViewMarker(mark: (arg0: object) => object): void;
/**
 * Whether a run reads a snapshot anywhere, on any instance: the one check the paths that save objects make while none is.
 * @returns {boolean} True while one does.
 * @internal
 */
export function anyRunOpen(): boolean;
/**
 * Whether a run is open on a domain.
 * @param {Domain|null} domain - The domain.
 * @returns {boolean} True while one is.
 * @internal
 */
export function runsOpen(domain: Domain | null): boolean;
/**
 * Open the snapshot of a new run: O(1), nothing is copied.
 * @param {object} owner - The instance object.
 * @param {RunSnapshot|null|undefined} parent - The snapshot of the run it is opened in, if any.
 * @returns {RunSnapshot} The run's snapshot.
 * @internal
 */
export function openRunSnapshot(owner: object, parent: RunSnapshot | null | undefined): RunSnapshot;
/**
 * Close a run's snapshot: its copies go with it, and the versions kept only for it go now (as a whole once no run of the
 * instance is open).
 * @param {RunSnapshot|null|undefined} snap - The snapshot.
 * @returns {void}
 * @internal
 */
export function closeRunSnapshot(snap: RunSnapshot | null | undefined): void;
/**
 * Save `subject` as it is before its domain changes it, for the runs that started since it last changed (the barrier).
 * Does nothing while no run is open, or when the content it has now is already saved for every open run.
 * @param {Domain|null} domain - The domain that owns it.
 * @param {object} subject - The object about to change.
 * @param {function(object): *} capture - Makes the content to keep.
 * @returns {boolean} True when a version was saved.
 * @internal
 */
export function beforeChange(domain: Domain | null, subject: object, capture: (arg0: object) => any): boolean;
/**
 * Whether `subject` was saved in the current window already (see {@link beforeChange}): its later changes need no
 * saving until another run opens.
 * @param {Domain|null} domain - The domain.
 * @param {object} subject - The object.
 * @returns {boolean} True when it was.
 * @internal
 */
export function savedThisWindow(domain: Domain | null, subject: object): boolean;
/**
 * Run `fn` once per window for `key` on a domain (a checkpoint a file takes before its code runs, say): not while no run
 * is open, and not again until another run opens.
 * @param {Domain|null} domain - The domain.
 * @param {*} key - What the checkpoint is for.
 * @param {function(): void} fn - The checkpoint.
 * @returns {void}
 * @internal
 */
export function checkpointOnce(domain: Domain | null, key: any, fn: () => void): void;
/**
 * The content `subject` had for a run that started at `start` on its domain: a saved version, or {@link CURRENT} when it
 * has not changed since.
 * @param {Domain|null} domain - The domain that owns it.
 * @param {object} subject - The object.
 * @param {number} start - The run's start.
 * @returns {*} The content, or {@link CURRENT}.
 * @internal
 */
export function versionAt(domain: Domain | null, subject: object, start: number): any;
/**
 * Whether `prototype` is the default prototype the language gives `fn`, as it was made: an extensible object inheriting
 * from `Object.prototype` that holds only `constructor`, naming `fn`, with its default attributes. Read by descriptors.
 * @param {*} prototype - The prototype.
 * @param {Function} fn - The function.
 * @returns {boolean} True for one.
 * @internal
 */
export function isDefaultPrototype(prototype: any, fn: Function): boolean;
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
export function saveDefaultPrototype(domain: Domain | null, prototype: object, fn: Function): boolean;
/**
 * Which built-in data kind `value` is, by the engine's own brand checks (a Proxy never passes one): `"map"`, `"set"`,
 * `"date"`, `"regexp"`, `"typed"`, `"buffer"`, `"dataview"`, or null.
 * @param {*} value - The value.
 * @returns {string|null} Its kind.
 * @internal
 */
export function builtinKind(value: any): string | null;
/**
 * Set how a built-in's kind is told (see {@link builtinKind}).
 * @param {function(object): (string|null)} check - Answers `"map"`, `"set"`, `"date"`, `"regexp"`, `"typed"`,
 *   `"buffer"`, `"dataview"`, `"weak"` (a weak collection or reference), `"promise"`, or null.
 * @returns {void}
 * @internal
 */
export function setKindCheck(check: (arg0: object) => (string | null)): void;
/**
 * Whether an object's class, or one it extends, declares `#private` names: the class's source is scanned once for a
 * `#name` token outside strings, templates and comments, and the answer is kept per class. Private names compiled to
 * helper functions or a `WeakMap` cannot be told apart this way.
 * @param {*} value - The object.
 * @returns {boolean} True when its class declares them.
 * @internal
 */
export function declaresPrivate(value: any): boolean;
/**
 * Whether a value is a live object a run shares with the instance rather than reads a snapshot of: a function, a
 * promise, a weak collection or reference, an `EventEmitter`-like or `EventTarget`. What such an object does (a
 * listener added, an event emitted) works both ways.
 * @param {*} value - The value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isSharedLive(value: any): boolean;
/**
 * Whether a value is an emitter: it inherits `on` and `emit` functions from a prototype (Node's `EventEmitter`, or one
 * shaped like it).
 * @param {object} value - The value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isEmitterLike(value: object): boolean;
/**
 * A shallow copy of an object's own state, keeping its prototype: a built-in of the same kind holding the same entries,
 * or an object holding the same own members (data members as values, accessors as they are).
 * @param {object} raw - The object.
 * @returns {object} The copy.
 * @internal
 */
export function shallowCopy(raw: object): object;
/**
 * Save a value the instance is about to hand out as itself, and what it reaches, once per window: a `Map`, a `Date`, an
 * object a leaf returned. The instance's code may then change it where slothlet does not see the change, and the runs
 * open read it as it was. Shared live objects are left alone.
 * @param {Domain|null} domain - The instance's domain.
 * @param {*} raw - The value.
 * @param {Set<object>} [seen] - Objects already walked.
 * @param {function(object): boolean|null} [skip] - Tells objects to leave alone (one whose reads would run code: a Proxy).
 * @returns {void}
 * @internal
 */
export function checkpointDeep(domain: Domain | null, raw: any, seen?: Set<object>, skip?: (arg0: object) => boolean | null): void;
/**
 * Whether `prototype` is the language's own (see {@link LANGUAGE_PROTOTYPES}): null, the prototype of a native class
 * (its own `constructor` is native code), or an emitter's, which a run shares live.
 * @param {object|null} prototype - The prototype.
 * @returns {boolean} True for one.
 * @internal
 */
export function isLanguagePrototype(prototype: object | null): boolean;
/**
 * The object behind a run's view of a raw object, or `value` itself.
 * @param {*} value - A value.
 * @returns {*} The object it stands for.
 * @internal
 */
export function rawBehind(value: any): any;
/**
 * Whether a value is a run's view of a raw object.
 * @param {*} value - A value.
 * @returns {boolean} True for one.
 * @internal
 */
export function isRawRunView(value: any): boolean;
/**
 * The content of `raw` as a run reads it: its own copy, else what its domain had when the run started.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The object.
 * @returns {object} The content.
 * @internal
 */
export function rawContent(snap: RunSnapshot, raw: object): object;
/**
 * The object a copy an outer run made stands for, followed out to the instance's: what a nested run reads it as is
 * that object as the outer run read it when the nested run started.
 * @param {RunSnapshot} snap - The run.
 * @param {object} value - An object.
 * @returns {object} The object it stands for, or `value` itself.
 * @internal
 */
export function originOf(snap: RunSnapshot, value: object): object;
/**
 * What a run hands out for a raw value it read (not a node of the tree): a shared live object as itself, a built-in as
 * the run's own copy of it, any other object as the run's view of it, read as of the run's start.
 * @param {RunSnapshot|null} snap - The run.
 * @param {*} value - The value.
 * @returns {*} What the run is handed.
 * @internal
 */
export function handOutRaw(snap: RunSnapshot | null, value: any): any;
/**
 * What a run is handed for a promise a call handed it: a promise of what the run is handed for the value it settles
 * with (see {@link handOutRaw}), the same one each time for the same promise. A rejection is handed on as it is.
 * @param {RunSnapshot|null} snap - The run.
 * @param {Promise<*>} promise - The promise.
 * @param {function(*): *} handOut - What the run is handed for the value.
 * @returns {Promise<*>} The promise the run is handed.
 * @internal
 */
export function handOutSettled(snap: RunSnapshot | null, promise: Promise<any>, handOut: (arg0: any) => any): Promise<any>;
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
export function builtinCopy(snap: RunSnapshot, raw: object): object;
/**
 * The run's view of a plain object, an array or a class instance it reached through a raw value: reads answer the
 * object as of the run's start (or the run's own copy, once the run changed it), and writes go to the run's own copy.
 * @param {RunSnapshot} snap - The run.
 * @param {object} raw - The object.
 * @returns {object} The view.
 * @internal
 */
export function viewOf(snap: RunSnapshot, raw: object): object;
/**
 * How many versions every instance keeps and how many runs read a snapshot, across every instance: for the suite.
 * @returns {{versions: number, runs: number}} The counts.
 * @internal
 */
export function snapshotCounts(): {
    versions: number;
    runs: number;
};
/**
 * Marker for "no version: read the object as it is".
 * @type {symbol}
 * @internal
 */
export const CURRENT: symbol;
/**
 * A domain owns objects and opens runs: an instance (one per instance object), or a run, for the copies it made and the
 * runs opened in it.
 * @private
 */
declare class Domain {
    /** The last tick handed out. */
    clock: number;
    /** Start → how many open runs started on it. */
    starts: Map<any, any>;
    /** How many runs are open on it. */
    live: number;
    /** The newest open run's start (0 with none open). */
    newest: number;
    /** The open runs' starts, ascending and each once: kept in step with `starts`. */
    sorted: any[];
    /** Object → the tick its current content dates from. */
    stamps: WeakMap<object, any>;
    /** Object → its saved versions `{from, to, content}`, oldest first. */
    versions: WeakMap<object, any>;
    /** How many versions it keeps. */
    count: number;
    /** Key → the window (newest start) it was last checkpointed in (see {@link checkpointOnce}). */
    windows: Map<any, any>;
    /** The objects it keeps versions of, while a run is open: pruned as runs end. */
    subjects: Set<any>;
}
/**
 * The snapshot state of one run: its start on its domain, the start it reads the instance at, and its own copies and
 * views. It is a domain itself for the runs opened in it.
 * @private
 */
declare class RunSnapshot extends Domain {
    /**
     * @param {Domain} instance - The instance's domain.
     * @param {RunSnapshot|null} parent - The run it was opened in.
     */
    constructor(instance: Domain, parent: RunSnapshot | null);
    instance: Domain;
    parent: RunSnapshot | null;
    start: any;
    /** The tick of the instance's clock the run reads the instance at: its outermost run's start. */
    base: any;
    /** Raw object → the run's own copy, made on its first change. */
    copies: WeakMap<object, any>;
    /** Raw object → the run's view of it. */
    views: WeakMap<object, any>;
    /** Raw built-in → the run's own copy of it, made on its first read. */
    builtins: WeakMap<object, any>;
    /** The run's own copy → the tick of this run's clock it was made at. */
    created: WeakMap<object, any>;
    /** The run's own copy → the object it is a copy of. */
    origins: WeakMap<object, any>;
    /** The run's own copies of built-ins, which it changes where nothing sees it: saved when a run opens in it. */
    builtinList: any[];
    /** Promise a call handed the run → the promise the run is handed (see {@link handOutSettled}). */
    promises: WeakMap<object, any>;
    closed: boolean;
}
export {};
//# sourceMappingURL=run-snapshot.d.mts.map