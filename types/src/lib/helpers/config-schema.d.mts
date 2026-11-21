/**
 * Check a method's options object against its entry in {@link METHOD_OPTION_SCHEMAS}. `null` / `undefined` and values
 * that are not plain objects pass: the method's own validation names a wrong-shaped argument.
 * @param {*} options - The options object as given.
 * @param {string} method - The method path, a key of {@link METHOD_OPTION_SCHEMAS}.
 * @param {string} [where=method] - The method path the error names, when several methods share one schema
 *   (`"slothlet.hook.list"` checked against `"slothlet.hook.filter"`).
 * @returns {void}
 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY for a key the method does not take, with `where` = the method path.
 * @public
 * @example
 * assertOptionKeys({ collisionMode: "merge" }, "slothlet.api.add");
 * // throws INVALID_CONFIG_UNKNOWN_KEY { where: "slothlet.api.add", key: "collisionMode", path: ["collisionMode"] }
 */
export function assertOptionKeys(options: any, method: string, where?: string): void;
/**
 * Refuse every key of `value` the schema does not list, walking nested groups.
 * @param {*} value - The value given (a config, or a part of one).
 * @param {object} schema - The schema it is checked against.
 * @param {string} where - What is being checked, for the error (`"config"`, or a method's option name).
 * @param {string[]} [path=[]] - The key path of `value` inside what is being checked.
 * @returns {void}
 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY for the first key the schema does not list.
 * @public
 * @example
 * assertKnownKeys({ permissions: { defaultPolicy: "deny" } }, CONFIG_SCHEMA, "config");
 * // throws INVALID_CONFIG_UNKNOWN_KEY { where: "config", key: "permissions.defaultPolicy", path: ["permissions", "defaultPolicy"] }
 */
export function assertKnownKeys(value: any, schema: object, where: string, path?: string[]): void;
/**
 * Mark a config as one slothlet normalized itself.
 * @param {object} config - The normalized config.
 * @returns {object} The same config.
 * @public
 * @example
 * const normalized = markNormalized({ ...config, base });
 */
export function markNormalized(config: object): object;
/**
 * Check a `slothlet({...})` config against {@link CONFIG_SCHEMA}. A config slothlet normalized itself passes unchecked.
 * @param {*} config - The config as given.
 * @returns {void}
 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY for a key the v4 config does not have.
 * @public
 * @example
 * assertConfigKeys({ base: "./api", mode: "lazy" }); // passes
 */
export function assertConfigKeys(config: any): void;
/**
 * A value whose own keys are not checked: user data (`context`, `reference`, `metadata`), maps keyed by the user
 * (`lifecycle`), generated data (`loader.files`) and items the option's own validation reads (`permissions.rules`).
 * @type {symbol}
 */
export const OPEN: symbol;
/**
 * The v4 config schema. Each key maps to `true` (a value of any shape, its keys not walked), {@link OPEN}, or a nested
 * schema for a group: when the value given for a group is a plain object its keys are checked against the nested schema;
 * any other value (the boolean or string shorthand some groups take) is left to the group's own validation.
 * @type {Readonly<object>}
 */
export const CONFIG_SCHEMA: Readonly<object>;
/**
 * The options object each `api.slothlet.*` method (and `generate()` from `@cldmv/slothlet/typegen`) takes, keyed by the
 * method path the error names as `where`. Read by {@link assertOptionKeys}; the shape rules are the same as
 * {@link CONFIG_SCHEMA}'s. A `collision` group also takes its mode as a bare string (`"merge"` = `{ mode: "merge" }`).
 * @type {Readonly<Record<string, object>>}
 */
export const METHOD_OPTION_SCHEMAS: Readonly<Record<string, object>>;
//# sourceMappingURL=config-schema.d.mts.map