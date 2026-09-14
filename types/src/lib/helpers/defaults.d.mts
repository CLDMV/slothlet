/**
 * The default `apiDepth` (directory-traversal depth) applied when a caller does not specify one.
 * Unbounded by default. The config normalizer ({@link module:@cldmv/slothlet/helpers/config}) is
 * what every real compose path reads — it resolves `config.apiDepth` once and the mode processors
 * receive that already-normalized value. The mode processors' and the loader's own parameter
 * defaults exist only for the case where they are invoked directly, bypassing normalization (a
 * standalone call, a future direct consumer); they read this same constant so that case can never
 * silently disagree with the normalized default.
 * @type {number}
 */
export const DEFAULT_API_DEPTH: number;
/**
 * The built-in `routines` list applied when a caller omits the `routines` config option entirely.
 * Each entry is `{ name, mode }` (bare mount-relative names, non-recursive, mode-defaulted `order`)
 * — see `docs/LIFECYCLE.md` ("Routines") for the full contract, including the `recursive`/`order`/
 * `destroy`-mode fields a caller-supplied entry may also set. Passing `routines` at all REPLACES
 * this list (it is the off-switch); a consumer that wants to extend rather than replace it spreads
 * this array: `slothlet.defaults.routines`.
 *
 * Frozen at every level (the array, and each entry object) so a consumer's spread copies the
 * entries by reference safely without risking a mutation here leaking across consumers.
 * @type {ReadonlyArray<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy"}>}
 */
export const DEFAULT_ROUTINES: ReadonlyArray<{
    name: string;
    mode: "manual" | "startup" | "shutdown" | "destroy";
}>;
/**
 * The complete set of framework-reserved export names — names a module export can never
 * meaningfully claim because the framework's own wrapper machinery already owns them.
 *
 * Derived as the union of {@link ComponentBase.INTERNAL_KEYS} (wrapper state/control properties)
 * and `IMPL_METADATA_KEYS` (child-adoption metadata) — the same two Sets `isFrameworkReservedKey()`
 * (`#handlers/unified-wrapper`) checks against, combined here into one Set for convenient
 * introspection. Wrapped via {@link freezeSet} — `Object.freeze()` alone would leave `add`/
 * `delete`/`clear` callable, letting a consumer mutate this shared singleton (and corrupt what
 * every other consumer in the same process sees) despite it claiming to be frozen.
 * @type {ReadonlySet<string>}
 */
export const RESERVED_EXPORTS: ReadonlySet<string>;
//# sourceMappingURL=defaults.d.mts.map