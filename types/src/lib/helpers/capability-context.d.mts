/**
 * Ask every instance whether the code running may use a capability.
 * @param {string} name - The capability.
 * @param {string} route - What the code used.
 * @param {string|null} [importer=null] - The importing file's URL, for an import being linked.
 * @param {*} [filename=null] - The file name the code is compiled under, when one is given.
 * @param {boolean|null} [runnerCompile=false] - Whether the compile is vitest's own compile of the code its server
 *   sent for that file (see {@link module:@cldmv/slothlet/helpers/vitest-worker-setup}); null, under vitest only, for
 *   a compile shaped as vitest's runner makes one when no worker setup records the server's replies, so it cannot be
 *   told either way.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
 * @internal
 * @example
 * checkCapability("code", "setTimeout");
 */
export function checkCapability(name: string, route: string, importer?: string | null, filename?: any, runnerCompile?: boolean | null): void;
/**
 * Whether an instance is up with a capability check of its own registered: code compiled under a name tagged with
 * that instance's id is then judged by that instance's check, not by any other's.
 * @param {*} instanceID - The instance id a name is tagged with.
 * @returns {boolean} True while that instance's check is registered.
 * @internal
 * @example
 * hasCapabilityCheck("b"); // true while instance "b" is up with the permission system configured
 */
export function hasCapabilityCheck(instanceID: any): boolean;
/**
 * Whether code compiled under a name would name a real file outside a leaf's own folder: the folder holding the file
 * the leaf was built from, and everything beneath it. A name no file holds, or a file in that folder, is not.
 * @param {*} filename - The name code is compiled under.
 * @param {string} leafFile - The leaf's file.
 * @returns {boolean} True for a file outside the folder.
 * @internal
 * @example
 * namesForeignFile("/app/node_modules/pkg/index.js", "/app/api/ext/render.mjs"); // true
 */
export function namesForeignFile(filename: any, leafFile: string): boolean;
/**
 * This file's internal bindings, for the files of slothlet's own that use them (see `ownBindingsRefusal` in
 * `helpers/instance-imports`).
 * @param {string} consumer - The file asking.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/**
 * What Node's `contextify` binding is checked as compiling under: a name {@link namesForeignFile} always finds foreign,
 * since the names the binding is later given cannot be read where it is taken.
 * @type {symbol}
 * @internal
 */
export const BINDING_NAME: symbol;
//# sourceMappingURL=capability-context.d.mts.map