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
export function toComparablePath(value: string): string;
/**
 * The locations a suspended call's module was imported from, in the comparable form a stack frame's
 * location is reduced to (#601): a browser resolver's URL, or a TypeScript leaf's compiled copy.
 *
 * @param {object|null} wrapper - The wrapper being called.
 * @param {string|null} filePath - Its file.
 * @returns {Set<string>|null} Comparable locations, or null when none were recorded.
 * @private
 */
export function runtime_importedLocations(wrapper: object | null, filePath: string | null): Set<string> | null;
/**
 * The comparable form of a file's real path, when it differs from the path given (#601 review).
 *
 * Node reports a module in a stack frame by its real path, symlinks resolved, while slothlet records
 * the path it scanned. A base reached through a symlink (a package in a pnpm `node_modules`, a linked
 * workspace) therefore names every one of its files differently in a frame. Resolved once per path;
 * outside Node, or for a path that does not resolve, there is nothing to add.
 *
 * @param {string|null} filePath - A scanned path.
 * @returns {string|null} The real path's comparable form, or null when it is the same or unknown.
 * @private
 */
export function runtime_realComparablePath(filePath: string | null): string | null;
/**
 * The names a suspended call's entry function can appear under in a stack frame.
 * @param {string} apiPath - The call's api path.
 * @param {object|null} currentWrapper - The wrapper entered.
 * @returns {string[]} Its api key, and the function's own name when that is another.
 * @private
 */
export function runtime_entryNames(apiPath: string, currentWrapper: object | null): string[];
/**
 * Whether a stack frame's function text names a suspended call's entry function. Only the text before
 * the location is searched, so a name inside the path cannot match by accident.
 * @param {string} head - The frame's text before its location.
 * @param {{fnNames?: string[], fnName?: string}} entry - A suspended call.
 * @returns {boolean} True when the frame is that function.
 * @private
 */
export function runtime_namesEntry(head: string, entry: {
    fnNames?: string[];
    fnName?: string;
}): boolean;
/**
 * Read the current call stack as frames, innermost first: each frame's function text, its location in
 * comparable form, and the raw text to look for an instance's import tag in.
 *
 * On V8 (Node, Chromium) the engine hands over structured call sites, which skips formatting and
 * re-parsing every frame as text: the capture runs on every identity read while a call is suspended, so
 * that cost is paid per api call and per promise reaction. Elsewhere the formatted trace is parsed.
 *
 * The frame budget is set for this capture only: the caller's frame sits below slothlet's own wrapper
 * frames, and the default of 10 can cut it off in a deep chain. The trace reports whether the budget cut it
 * short, so a reader that found nothing can look deeper. `prepareStackTrace` is set by this
 * capture for its duration as well. It is a writable global hook, so a leaf can install one that returns
 * an empty or forged trace — which would blank the frames this resolver matches on, and a caller that
 * cannot be attributed would otherwise be let through as though it were the host. Using the `Error`
 * captured at load and a formatter of slothlet's own keeps the capture out of a leaf's reach. Both
 * globals are restored immediately, so a legitimate consumer's formatter is unaffected.
 *
 * @param {number} limit - The most frames to capture.
 * @returns {Iterable<{head: string, path: string, line: string, async: boolean, evaluated: boolean}> & {truncated: boolean}} The frames.
 * @private
 */
export function runtime_captureFrames(limit: number): Iterable<{
    head: string;
    path: string;
    line: string;
    async: boolean;
    evaluated: boolean;
}> & {
    truncated: boolean;
};
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
export function parseStackFrame(line: string): {
    head: string;
    path: string;
} | null;
/**
 * How a call's wrapper is recognised in a stack frame: its file in comparable form (and its real path
 * when a symlink makes that differ), the locations its module was imported from, its mount and api path,
 * and the names its function goes by. Built once per wrapper and implementation.
 *
 * @param {object} wrapper - A genuine UnifiedWrapper.
 * @returns {{filePath: string|null, comparablePath: string, realComparablePath: string|null, locations: Set<string>|null, moduleID: string|null, apiPath: string, fnName: string, fnNames: string[]}} The description.
 * @internal
 */
export function describeCall(wrapper: object): {
    filePath: string | null;
    comparablePath: string;
    realComparablePath: string | null;
    locations: Set<string> | null;
    moduleID: string | null;
    apiPath: string;
    fnName: string;
    fnNames: string[];
};
/**
 * Build the frame placer for a set of calls.
 *
 * A frame is placed by its location (never by its function name alone, see {@link parseStackFrame}):
 *
 * - **a call's file** — the file it entered through, or a URL the browser loader imported that file from
 *   (a resolver's `blob:` / `data:` URL need not end in the manifest path);
 * - **instance code** — a frame carrying an instance's import tag, or in one of its CommonJS copies, is that
 *   instance's code, and belongs to the calls of that instance whose leaves import its file (the import
 *   graph the instance's resolve hook records). Instance code that none of the calls imports is an orphan:
 *   some module is running that none of them accounts for;
 * - **a module's folder** — an untagged frame (a browser leaf's own imports carry no tag) in a module's root
 *   folder belongs to that module's calls (#512); the deepest root wins, so a module mounted inside
 *   another's folder owns its files.
 *
 * @param {Array<{currentWrapper: object, family: string|null, comparablePath: string, realComparablePath: string|null, locations: Set<string>|null, moduleID: string|null}>} candidates - The calls, each with a file.
 * @returns {{place: function(object): ({matches: Array<object>, byFile: boolean, byModule?: boolean}|null), families: Set<string>}}
 *   `place` answers a frame's placement — `{ matches }` (possibly none: an orphan), or null when the frame is
 *   no instance's code and in no module's folder; `byFile` marks a frame in a call's own file, whose
 *   function name may pin one of several. `families` are the instances the calls belong to.
 * @internal
 */
export function createFramePlacer(candidates: Array<{
    currentWrapper: object;
    family: string | null;
    comparablePath: string;
    realComparablePath: string | null;
    locations: Set<string> | null;
    moduleID: string | null;
}>): {
    place: (arg0: object) => ({
        matches: Array<object>;
        byFile: boolean;
        byModule?: boolean;
    } | null);
    families: Set<string>;
};
/**
 * Whether a frame is one the microtask runner puts below a resumed function: a resumed function has
 * nothing of its own below it.
 * @param {{path: string, head: string}} frame - A frame.
 * @returns {boolean} True for a runner frame.
 * @internal
 */
export function isRunnerFrame(frame: {
    path: string;
    head: string;
}): boolean;
/**
 * Register the test that recognises slothlet's own api values (node proxies, per-reader views), which carry
 * no code of a caller's.
 * @param {function(*): boolean} check - The test.
 * @returns {void}
 * @internal
 */
export function setApiValueCheck(check: (arg0: any) => boolean): void;
/**
 * Whether a call is handed anything that can run its caller's code while it executes: a receiver or an
 * argument with a `toString`, a getter, a Proxy trap or a callback of the caller's (#597). Plain data does not
 * count (see {@link runtime_isPlainData}). Only such a call ever reads the stack to find who supplied the code
 * that is running.
 *
 * @param {*} thisArg - The call's receiver.
 * @param {ArrayLike<*>|null|undefined} args - The call's arguments.
 * @returns {boolean} True when the call is to be checked for supplied code.
 * @internal
 */
export function carriesCallerCode(thisArg: any, args: ArrayLike<any> | null | undefined): boolean;
/**
 * Who supplied the code that is running inside a call that was handed code (#597).
 *
 * A leaf converting, reading or calling a value its caller handed it runs the caller's code — a `toString`,
 * a getter, a Proxy trap, a callback — and that code is the caller's, not the leaf's. The call record is the
 * leaf's: `{ wrapper, parent, flagged }`, `parent` being the record of the call that made it.
 *
 * The first frame below slothlet's own decides, and it fails closed. The code is the leaf's own only when that
 * frame is placed on the leaf and on no other call of the chain. A frame placed on calls further up names the
 * nearest of them. Anything else — evaluated code (it names whatever source it likes), a frame no call can be
 * placed on, a frame the leaf shares with another call (a helper both import), instance code none of them
 * accounts for, or no frame at all — is taken to be the code of the call that made the leaf's. Whatever is
 * named runs with the leaf as its ceiling, so the answer can only narrow what the leaf may do, never widen it.
 *
 * Only a flagged call with a module above it is resolved: everything else answers without reading the stack.
 *
 * @param {{wrapper: object, parent: object|null, flagged: boolean}|null|undefined} record - The running call.
 * @returns {object|null} The supplier's wrapper when it is a call above the leaf, otherwise null (the leaf's
 *   own code is running).
 * @internal
 */
export function resolveSupplier(record: {
    wrapper: object;
    parent: object | null;
    flagged: boolean;
} | null | undefined): object | null;
/**
 * Directory holding slothlet's own sources (`src/` or `dist/`).
 *
 * The frames at the top of every capture are the framework's — the gate, the wrapper, this
 * resolver. They are never attributed to a module by folder, even when a module's root folder
 * happens to contain slothlet's install (a base of `./` with slothlet in `node_modules`).
 * @type {string}
 * @private
 */
export const FRAMEWORK_DIR: string;
//# sourceMappingURL=frame-placement.d.mts.map