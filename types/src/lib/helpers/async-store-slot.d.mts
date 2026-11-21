/**
 * Whether what an `AsyncLocalStorage` holds can be reached from the running async resource or a fresh promise: true
 * while `AsyncContextFrame` is off.
 * @returns {boolean} True when it can.
 */
export function asyncStoreExposed(): boolean;
/**
 * Whether there are async hooks to probe here.
 * @returns {boolean} True on Node.
 */
export function asyncStoreProbeAvailable(): boolean;
/**
 * The object Node keeps every storage's value for `resource` on, keyed by each storage's `kResourceStore`: the
 * resource itself, or the object under `Symbol(kAsyncLocalStorageContext)` on it. Null where Node keeps nothing on
 * the resource (`AsyncContextFrame` on), where it has nothing there yet, or where the value sits somewhere the probe
 * did not recognise.
 * @param {*} resource - An async resource.
 * @returns {object|null} The object.
 */
export function resourceStoreHolder(resource: any): object | null;
/**
 * Whether Node keeps a storage's value on the async resource itself, in a place {@link resourceStoreHolder} reads.
 * @returns {boolean} True while `AsyncContextFrame` is off, on a layout the probe recognised.
 */
export function resourceStoreKnown(): boolean;
//# sourceMappingURL=async-store-slot.d.mts.map