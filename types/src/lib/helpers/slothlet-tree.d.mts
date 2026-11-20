/**
 * Whether a rule target pattern under `slothlet.` can match anything in the fixed tree. A target whose level grants
 * the write (`:write`, `:full`) is accepted as it is: it names a place in the namespace, where a write the host grants
 * can add a member that is not there yet. For any other target only the path part counts (a hook `:type` or a level
 * `:call`, `:read`, `:access` suffix is left off), and a target below a data member is accepted whatever its key.
 * @param {string} target - A rule target that starts with `slothlet.`.
 * @returns {boolean} True when the pattern matches at least one member.
 * @example
 * namesSlothletMember("slothlet.permissions.rules.add"); // true
 * namesSlothletMember("slothlet.permissions.addRule"); // false
 * namesSlothletMember("slothlet.hook.**"); // true
 * namesSlothletMember("slothlet.planted:write"); // true
 * namesSlothletMember("slothlet.planted:full"); // true
 * namesSlothletMember("slothlet.planted:read"); // false
 * namesSlothletMember("slothlet.i18n.translate.name"); // true: a property of the function
 */
export function namesSlothletMember(target: string): boolean;
/**
 * Every member of the control namespace, with every optional group present (`diag` with `diagnostics: true`, `hook`
 * with hooks on). A test walks a live instance and compares, so a method added, renamed or removed must be listed here.
 * @type {ReadonlyArray<string>}
 */
export const SLOTHLET_TREE: ReadonlyArray<string>;
/**
 * Members whose own keys are data rather than methods (the env snapshot, the config context and reference): a target
 * below one of these names a key slothlet does not know in advance, so any one is accepted.
 * @type {ReadonlyArray<string>}
 */
export const SLOTHLET_TREE_DATA: ReadonlyArray<string>;
//# sourceMappingURL=slothlet-tree.d.mts.map