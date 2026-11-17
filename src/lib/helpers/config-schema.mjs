/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/config-schema.mjs
 *	@Date: 2026-11-16T18:55:17-08:00 (1794884117)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:55:17-08:00 (1794884117)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The keys `slothlet({...})` accepts: the one schema the config validator walks. A key not listed here is
 * refused with `INVALID_CONFIG_UNKNOWN_KEY`, so a misspelled or renamed option never reads as "left at its default".
 * @module @cldmv/slothlet/helpers/config-schema
 * @internal
 */
import { ArrayMethods, Arrays, concatLists, FunctionMethods, Objects, Symbol, WeakSet, WeakSetMethods } from "#helpers/intrinsics";
import { SlothletError } from "#errors";

/**
 * A value whose own keys are not checked: user data (`context`, `reference`, `metadata`), maps keyed by the user
 * (`lifecycle`), generated data (`loader.files`) and items the option's own validation reads (`permissions.rules`).
 * @type {symbol}
 */
export const OPEN = Symbol("slothlet.config.open");

/**
 * The v4 config schema. Each key maps to `true` (a value of any shape, its keys not walked), {@link OPEN}, or a nested
 * schema for a group: when the value given for a group is a plain object its keys are checked against the nested schema;
 * any other value (the boolean or string shorthand some groups take) is left to the group's own validation.
 * @type {Readonly<object>}
 */
export const CONFIG_SCHEMA = deepFreeze({
	api: {
		collision: {
			mode: { initial: true, api: true },
			override: true
		},
		mutations: { add: true, events: true, permissions: true, reload: true, remove: true }
	},
	base: true,
	clock: { now: true, set: true, clear: true },
	context: OPEN,
	debug: {
		api: true,
		builder: true,
		context: true,
		index: true,
		initialization: true,
		materialize: true,
		modes: true,
		ownership: true,
		permissions: true,
		versioning: true,
		wrapper: true
	},
	depth: true,
	diagnostics: true,
	env: { include: true },
	helpers: true,
	hidden: true,
	hook: { enabled: true, errors: true, pattern: true, pin: true },
	i18n: { language: true },
	lifecycle: OPEN,
	loader: { files: OPEN, import: true, materialize: true, platform: true, resolve: true },
	metadata: OPEN,
	mode: true,
	permissions: {
		audit: true,
		caller: { anonymous: true, attribution: true, capture: true, ceiling: true, provenance: true },
		events: { policy: true, rules: OPEN },
		gating: { buffers: true, read: true },
		mode: true,
		owner: true,
		policy: true,
		private: { host: true, scope: true },
		rules: OPEN
	},
	reference: OPEN,
	routines: { auto: true, entries: OPEN, stack: true },
	runtime: true,
	sanitize: {
		first: true,
		preserve: { lower: true, upper: true },
		rules: { leave: true, lower: true, nocase: true, upper: true }
	},
	scanHiddenFolders: true,
	scope: { isolation: true, merge: true },
	silent: true,
	tracking: { materialization: true },
	typescript: {
		compiler: OPEN,
		mode: true,
		module: true,
		sourcemap: true,
		strict: true,
		target: true,
		types: { name: true, output: true }
	},
	versioning: { dispatcher: true }
});

/**
 * Freeze a schema and every nested schema in it.
 * @param {object} schema - The schema.
 * @returns {object} The same schema, frozen.
 * @private
 */
function deepFreeze(schema) {
	for (let i = 0, keys = Objects.keys(schema); i < keys.length; i++) {
		const child = schema[keys[i]];
		if (child !== null && typeof child === "object") deepFreeze(child);
	}
	return Objects.freeze(schema);
}

/**
 * Whether a value is a plain object: an object literal or one made with `Object.create(null)`.
 * @param {*} value - The value.
 * @returns {boolean} True for a plain object.
 * @private
 */
function isPlainObject(value) {
	if (value === null || typeof value !== "object" || Arrays.isArray(value)) return false;
	const proto = Objects.getPrototypeOf(value);
	return proto === Objects.prototype || proto === null;
}

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
export function assertKnownKeys(value, schema, where, path = []) {
	if (!isPlainObject(value)) return;
	for (let i = 0, keys = Objects.keys(value); i < keys.length; i++) {
		const key = keys[i];
		const keyPath = concatLists(path, [key]);
		if (!FunctionMethods.call(Objects.prototype.hasOwnProperty, schema, key)) {
			throw new SlothletError("INVALID_CONFIG_UNKNOWN_KEY", { where, key: ArrayMethods.join(keyPath, "."), path: keyPath }, null, {
				validationError: true
			});
		}
		const child = schema[key];
		if (child !== null && typeof child === "object") assertKnownKeys(value[key], child, where, keyPath);
	}
}

/**
 * Configs slothlet normalized itself (see `Config.transformConfig`). A reload feeds the instance's own normalized config
 * back in; it carries fields of slothlet's own and is never checked as a caller's config.
 * @type {WeakSet<object>}
 */
const NORMALIZED = new WeakSet();

/**
 * Mark a config as one slothlet normalized itself.
 * @param {object} config - The normalized config.
 * @returns {object} The same config.
 * @public
 * @example
 * const normalized = markNormalized({ ...config, base });
 */
export function markNormalized(config) {
	WeakSetMethods.add(NORMALIZED, config);
	return config;
}

/**
 * Check a `slothlet({...})` config against {@link CONFIG_SCHEMA}. A config slothlet normalized itself passes unchecked.
 * @param {*} config - The config as given.
 * @returns {void}
 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY for a key the v4 config does not have.
 * @public
 * @example
 * assertConfigKeys({ base: "./api", mode: "lazy" }); // passes
 */
export function assertConfigKeys(config) {
	if (config !== null && typeof config === "object" && WeakSetMethods.has(NORMALIZED, config)) return;
	assertKnownKeys(config, CONFIG_SCHEMA, "config");
}
