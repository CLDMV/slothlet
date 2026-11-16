/**
 * Ask every instance whether the code running may use a capability.
 * @param {string} name - The capability.
 * @param {string} route - What the code used.
 * @param {string|null} [importer=null] - The importing file's URL, for an import being linked.
 * @returns {void}
 * @throws {SlothletError} `CAPABILITY_REFUSED`.
 * @internal
 * @example
 * checkCapability("code", "setTimeout");
 */
export function checkCapability(name: string, route: string, importer?: string | null, filename?: null): void;
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