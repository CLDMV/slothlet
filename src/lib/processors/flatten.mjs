/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/flatten.mjs
 *	@Date: 2026-01-24T08:43:52-08:00 (1769273032)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T14:12:24-07:00 (1791580344)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Flattening decision module.
 * @description
 * Provides the Flatten class for determining when and how to flatten API structures
 * based on comprehensive rule set. Implements 18 core conditions (C01-C18) from
 * API-RULES-CONDITIONS.md. Extends ComponentBase for access to Slothlet configuration.
 * @module @cldmv/slothlet/processors/flatten
 * @internal
 * @package
 * @example
 * // Flatten is instantiated by Slothlet and passed to processors
 * const flatten = new Flatten(slothlet);
 * const decision = flatten.getFlatteningDecision(options);
 * const categoryDecisions = flatten.buildCategoryDecisions(options);
 */
import { ComponentBase } from "#factories/component-base";
import { util } from "@cldmv/slothlet/helpers/platform";

/**
 * The language's own prototypes. Their members are not a module default's members.
 * @type {Set<object>}
 * @private
 */
const LANGUAGE_PROTOTYPES = new Set([Object.prototype, Function.prototype, Array.prototype]);

/**
 * A layer over a user Proxy that holds members added to it and sends every other operation to the
 * Proxy, so the Proxy's traps keep answering and nothing is ever written to it.
 * @param {object} proxy - The module's Proxy default.
 * @returns {object} The layer.
 * @private
 *
 * @example
 * const layer = overlayProxy(mod.default);
 * layer.extra = mod.extra; // held by the layer; mod.default is unchanged
 */
function overlayProxy(proxy) {
	const added = new Map();
	const removed = new Set();
	const isArray = Array.isArray(proxy);
	const forwards = (key) => !added.has(key) && !removed.has(key);
	// The layer's own target is an empty shell, not the Proxy: the invariants a Proxy must keep are
	// checked against its target, and a frozen or non-extensible Proxy target would forbid every added
	// key. The shell is always extensible, so the layer may report the added keys beside the Proxy's.
	return new Proxy(isArray ? [] : {}, {
		get: (_shell, key) => (added.has(key) ? added.get(key).value : forwards(key) ? Reflect.get(proxy, key) : undefined),
		has: (_shell, key) => added.has(key) || (forwards(key) && Reflect.has(proxy, key)),
		set(_shell, key, value) {
			removed.delete(key);
			added.set(key, { value, writable: true, enumerable: true, configurable: true });
			return true;
		},
		defineProperty(_shell, key, descriptor) {
			removed.delete(key);
			const current = added.get(key) ?? { value: undefined, writable: true, enumerable: true, configurable: true };
			added.set(key, { ...current, ...descriptor, configurable: true });
			return true;
		},
		deleteProperty(_shell, key) {
			// Hidden from the layer only; the module's Proxy keeps the member.
			added.delete(key);
			if (Reflect.getOwnPropertyDescriptor(proxy, key)) removed.add(key);
			return true;
		},
		getOwnPropertyDescriptor(shell, key) {
			if (added.has(key)) return { ...added.get(key) };
			if (!forwards(key)) return undefined;
			const descriptor = Reflect.getOwnPropertyDescriptor(proxy, key);
			if (!descriptor) return undefined;
			// An array shell's own `length` is fixed (non-configurable, writable); the layer reports the
			// Proxy's length in that same form. Every other member is reported configurable, as the
			// shell, which does not hold it, requires.
			if (isArray && key === "length") return { ...descriptor, configurable: false, writable: true };
			return { ...descriptor, configurable: true };
		},
		ownKeys: () => [
			...new Set([...Reflect.ownKeys(proxy).filter((key) => !removed.has(key)), ...added.keys(), ...(isArray ? ["length"] : [])])
		],
		getPrototypeOf: () => Reflect.getPrototypeOf(proxy)
	});
}

/**
 * Flattening decision processor
 * @class Flatten
 * @extends ComponentBase
 * @package
 */
// --- API-RULES condition markers (see docs/API-RULES/API-RULES-CONDITIONS.md) ---
// Rule 4 (F04) - C19: Hybrid default + named export merge — ~L304
// Rule 2 - C20: Named-only module → namespace object — ~L372
// Rule 2 - C21: Category decision default preserve — ~L399

export class Flatten extends ComponentBase {
	static slothletProperty = "flatten";

	/**
	 * Create a Flatten instance
	 * @param {Object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Check if module is self-referential (exports itself under same name).
	 * Rule 6 - Condition C01 from API-RULES-CONDITIONS.md.
	 * @param {object} mod - Module exports
	 * @param {string} moduleName - Name of the module
	 * @returns {boolean} True if self-referential
	 * @private
	 */
	#checkSelfReferential(mod, moduleName) {
		if (!mod || typeof mod !== "object") return false;
		return mod[moduleName] === mod;
	}

	/**
	 * Check if this is a multi-default context (multiple default exports in folder).
	 * Rule 5 - Conditions C02-C03 from API-RULES-CONDITIONS.md.
	 * @param {object} analysis - Export analysis
	 * @param {boolean} hasMultipleDefaults - Whether folder has multiple defaults
	 * @param {function} t - Translation function
	 * @returns {Promise<object|null>} Multi-default decision or null
	 * @private
	 */
	async #checkMultiDefault(analysis, hasMultipleDefaults, t) {
		if (!hasMultipleDefaults) return null;

		// Rule 5 - C02: Multi-default with default export - preserve namespace
		if (analysis.hasDefault) {
			return {
				preserveAsNamespace: true,
				reason: await t("FLATTEN_REASON_MULTI_DEFAULT_WITH_DEFAULT")
			};
		}

		// Rule 5 - C03: Multi-default without default - flatten named exports to parent namespace
		// A no-default file in a multi-default folder has its exports hoisted directly into
		// the parent folder namespace, dissolving the intermediate namespace hop.
		// The consumer in modes-processor.mjs reads this flag and merges moduleContent keys
		// into targetApi rather than assigning them under a nested property name.
		return {
			flattenToRoot: true,
			reason: await t("FLATTEN_REASON_MULTI_DEFAULT_WITHOUT_DEFAULT")
		};
	}

	/**
	 * Check if single named export matches filename (auto-flatten case).
	 * Rule 7 (F02, F03) - Condition C04 from API-RULES-CONDITIONS.md.
	 * @param {object} mod - Module exports
	 * @param {string} moduleName - Name of the module
	 * @param {string[]} moduleKeys - Keys of module exports
	 * @returns {boolean} True if should auto-flatten
	 * @private
	 */
	#checkAutoFlatten(mod, moduleName, moduleKeys) {
		if (moduleKeys.length !== 1) return false;
		return moduleKeys[0] === moduleName;
	}

	/**
	 * Core flattening decision function.
	 * Implements conditions C01-C07 from getFlatteningDecision().
	 * @param {object} options - Decision options
	 * @param {object} options.mod - Module exports
	 * @param {string} options.moduleName - Sanitized module name
	 * @param {string} options.categoryName - Category/folder name
	 * @param {object} options.analysis - Export analysis
	 * @param {boolean} options.hasMultipleDefaults - Multiple defaults in folder
	 * @param {string[]} options.moduleKeys - Keys from module
	 * @param {function} options.t - Translation function
	 * @returns {Promise<object>} Flattening decision
	 * @public
	 */
	async getFlatteningDecision(options) {
		const { mod, moduleName, categoryName, analysis, hasMultipleDefaults, moduleKeys, t } = options;

		// Rule 11 (F06) - C24: AddApi Special File Pattern
		// Files named addapi.{mjs,cjs,js,ts} always flatten regardless of autoFlatten setting
		const isAddapiFile = moduleName === "addapi";
		if (isAddapiFile) {
			// Check for metadata default export pattern (object default + named exports)
			if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleKeys.length > 0) {
				return {
					flattenToCategory: true,
					flattenType: "addapi-metadata-default",
					reason: await t("FLATTEN_REASON_ADDAPI_METADATA_DEFAULT")
				};
			}
			// Even without metadata pattern, addapi files should always flatten
			return {
				flattenToCategory: true,
				flattenType: "addapi-special-file",
				reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE")
			};
		}

		// Rule 6 - C01: Self-referential check - preserve namespace
		if (this.#checkSelfReferential(mod, moduleName)) {
			return {
				preserveAsNamespace: true,
				reason: await t("FLATTEN_REASON_SELF_REFERENTIAL")
			};
		}

		// Rule 5 - C02, C03: Multi-default context handling
		const multiDefaultDecision = await this.#checkMultiDefault(analysis, hasMultipleDefaults, t);
		if (multiDefaultDecision) {
			// Rule 9 still applies even in multi-default context: if the function has an explicit
			// name that differs in casing from the sanitized filename, preserve it as preferredName.
			if (multiDefaultDecision.preserveAsNamespace) {
				const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;
				if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
					const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
					const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
					if (normalizedFunctionName === normalizedModuleName) {
						multiDefaultDecision.preferredName = exportToCheck.name;
					}
				}
			}
			return multiDefaultDecision;
		}

		// Rule 7 (F02, F03) - C04: Auto-flatten single named export matching filename
		if (this.#checkAutoFlatten(mod, moduleName, moduleKeys)) {
			return {
				useAutoFlattening: true,
				reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_FILENAME")
			};
		}

		// Rule 1 (F01) - C05: Filename matches container - flatten to category
		if (moduleName === categoryName) {
			return {
				flattenToCategory: true,
				reason: await t("FLATTEN_REASON_FILENAME_MATCHES_CATEGORY")
			};
		}

		// Rule 4, Rule 9 - C16: Function name preference (check before default fallback)
		// When function/export name matches filename (case-insensitive), preserve exact casing
		const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;

		if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
			// Check if function name relates to filename (case-insensitive, ignoring separators)
			const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
			const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
			const functionNameMatchesFilename = normalizedFunctionName === normalizedModuleName;

			// Rule 9: Use exact function name to preserve casing (XMLParser vs xmlParser, getHTTPStatus vs getHttpStatus)
			if (functionNameMatchesFilename) {
				return {
					preserveAsNamespace: true,
					preferredName: exportToCheck.name, // Use exact function name
					reason: await t("FLATTEN_REASON_PRESERVING_FUNCTION_NAME")
				};
			}
		}

		// Rule 2 - C06: Single file context (INTENTIONALLY NOT IMPLEMENTED)
		// Architectural decision: Would auto-flatten single file directories, but this reduces
		// API path flexibility. Users should use C05 (filename matching) if they want flattening.

		// Rule 2 - C07: Default fallback - preserve as namespace
		return {
			preserveAsNamespace: true,
			reason: await t("FLATTEN_REASON_DEFAULT_PRESERVE_NAMESPACE")
		};
	}

	/**
	 * Copy a module's object default so named exports can be merged onto the copy without mutating the
	 * module's own export, keeping the default's shape: an array stays an array, and any other object
	 * keeps its prototype and property descriptors, so a class instance keeps its prototype methods and
	 * getters (an object spread kept neither). The same shape-preserving copy the wrapper makes of an
	 * object impl.
	 *
	 * A user Proxy cannot be copied without losing its traps (`lg[0]`-style access, for one), and writing
	 * the named exports onto it would reach its target, or its `set` trap, which may refuse them. It gets
	 * a layer instead: members added to the layer are held there, and everything else goes to the Proxy,
	 * so its traps keep answering and the module's export is never written to.
	 * @param {object} value - The module's object default.
	 * @returns {object} The copy, or the layer over the Proxy.
	 * @public
	 *
	 * @example
	 * const moduleContent = flatten.cloneDefault(mod.default);
	 */
	cloneDefault(value) {
		if (util.types.isProxy(value)) return overlayProxy(value);
		const descriptors = Object.getOwnPropertyDescriptors(value);
		if (Array.isArray(value)) return Object.defineProperties([], descriptors);
		return Object.create(Object.getPrototypeOf(value), descriptors);
	}

	/**
	 * Whether a module's default export has a member named `key`, so a same-named named export conflicts
	 * with it. A member is an own property, enumerable or not, or one a prototype the module defines
	 * provides (a class instance's methods and getters, a subclass constructor's inherited statics).
	 * Object.prototype, Function.prototype and Array.prototype are the language's, not the module's, so
	 * a named `toString` or `call` is not a conflict. Every path that combines a default with its named
	 * exports asks this one question, so the outcome does not depend on the path.
	 * @param {unknown} value - The module's default export.
	 * @param {string} key - The named export's key.
	 * @returns {boolean} True when the default has that member.
	 * @public
	 *
	 * @example
	 * flatten.defaultHasMember(new (class { add() {} })(), "add"); // true
	 * flatten.defaultHasMember({}, "toString"); // false
	 */
	defaultHasMember(value, key) {
		for (let node = value; node !== null && (typeof node === "object" || typeof node === "function"); node = Reflect.getPrototypeOf(node)) {
			if (LANGUAGE_PROTOTYPES.has(node)) return false;
			if (Reflect.getOwnPropertyDescriptor(node, key)) return true;
		}
		return false;
	}

	/**
	 * Put a named export on the composed default under `key`. A member the copy holds read-only (a
	 * non-writable own property of the default) cannot be assigned, so a named export that wins over it
	 * replaces the property instead of throwing.
	 * @param {object|Function} target - The composed default (a copy, or a function default).
	 * @param {string} key - The named export's key.
	 * @param {unknown} value - The named export.
	 * @returns {void}
	 * @public
	 *
	 * @example
	 * flatten.assignNamedExport(moduleContent, "secret", mod.secret);
	 */
	assignNamedExport(target, key, value) {
		const own = Reflect.getOwnPropertyDescriptor(target, key);
		if (own && !own.writable && !own.set) {
			Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
			return;
		}
		target[key] = value;
	}

	/**
	 * Resolve a conflict between a named export and the same-named own member of the module's default
	 * export, by collision mode (#421): `merge` / `skip` keep the default's member, `error` throws,
	 * `warn` warns and lets the named export overwrite, `replace` / `merge-replace` overwrite. Every path
	 * that combines a module's default with its named exports resolves conflicts here, so the outcome
	 * does not depend on which path composes the module (#587).
	 * @param {string} key - The conflicting key.
	 * @param {string|undefined} collisionMode - Effective collision mode.
	 * @param {string} apiPath - Api path of the module, for the error / warning.
	 * @returns {boolean} True when the named export overwrites the default's member.
	 * @throws {SlothletError} COLLISION_DEFAULT_EXPORT_ERROR under `error`.
	 * @public
	 *
	 * @example
	 * if (conflicts && !flatten.namedExportWinsOverDefault(key, "merge", "math")) continue;
	 */
	namedExportWinsOverDefault(key, collisionMode, apiPath) {
		if (collisionMode === "merge" || collisionMode === "skip") return false;
		if (collisionMode === "error") {
			throw new this.slothlet.SlothletError("COLLISION_DEFAULT_EXPORT_ERROR", { key, apiPath }, null, { validationError: true });
		}
		if (collisionMode === "warn") {
			new this.slothlet.SlothletWarning("WARNING_COLLISION_DEFAULT_EXPORT_OVERWRITE", { key, apiPath });
		}
		return true;
	}

	/**
	 * The collision mode a default/named export conflict resolves under: the per-call override, else
	 * the configured mode for this build context.
	 * @param {string|null} collisionModeOverride - Per-call override.
	 * @param {string} collisionContext - "initial" or "api".
	 * @returns {string|undefined} Effective collision mode.
	 * @private
	 */
	#defaultConflictMode(collisionModeOverride, collisionContext) {
		const collisionConfig = this.slothlet.config.api?.collision || this.slothlet.config.collision;
		return collisionModeOverride || (collisionContext === "initial" ? collisionConfig.initial : collisionConfig.api);
	}

	/**
	 * Build module content for API assignment.
	 *
	 * Canonical implementation of the C08-C09b content-building rules, including
	 * AddApi detection and collision handling. Previously this logic was inlined
	 * inside modes-processor.mjs; it now lives here so the processor stays focused
	 * on wrapping and assignment concerns only.
	 *
	 * Collision config, modesUtils helpers, and SlothletWarning are accessed
	 * directly through {@link this.slothlet} / {@link this.slothlet.config} — no caller
	 * plumbing required.
	 *
	 * @param {object}   options                              - Processing options.
	 * @param {object}   options.mod                         - Module exports.
	 * @param {object}   options.decision                    - Flattening decision from getFlatteningDecision.
	 * @param {string}   options.moduleName                  - Sanitized module name (used for C08 auto-flatten key lookup).
	 * @param {string}   options.propertyName                - Resolved preferred name (decision.preferredName || moduleName).
	 * @param {string[]} options.moduleKeys                  - Named export keys (excluding "default").
	 * @param {object}   options.analysis                    - { hasDefault, hasNamed, defaultExportType }.
	 * @param {object}   [options.file=null]                 - File descriptor for AddApi detection via file.name / file.fullName.
	 * @param {string}   [options.collisionContext="initial"] - Collision context ("initial" | "api").
	 * @param {string}   [options.apiPathPrefix=""]          - API path prefix for collision error messages.
	 * @param {string|null} [options.collisionModeOverride=null] - Caller's per-call override (e.g.
	 *   `api.add({ forceOverwrite: true })`), preferred over `collisionContext`'s config default for
	 *   the function-default-vs-named-export merge decision below.
	 * @returns {{ moduleContent: object|Function, origins: {self: (string[]|null), members: Object<string, string[]>} }}
	 *   Built module content ready for wrapping/assignment, plus where it came from (#484): `self` is the
	 *   content's own exportPath when it IS one export (`["default"]`, `["add"]`), `null` when it is a
	 *   fresh object composed here; `members` maps each key this step placed onto the content to the
	 *   exportPath it was read from. Keys the content already carried (a default object's own members)
	 *   are not listed — they are located under `self`.
	 * @public
	 */
	processModuleForAPI(options) {
		const {
			mod,
			decision,
			moduleName,
			propertyName,
			moduleKeys,
			analysis,
			file = null,
			collisionContext = "initial",
			apiPathPrefix = "",
			isSelfReferential = false,
			collisionModeOverride = null
		} = options;

		// Rule 11 (F06) - C24: AddApi Special File Pattern
		// When addapi.{mjs,cjs,js,ts} has a default export + named exports,
		// use the default as the namespace base and merge named exports onto it.
		const isAddapiFile =
			moduleName === "addapi" ||
			(file && file.name === "addapi") ||
			(file && file.fullName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(file.fullName.toLowerCase()));
		if (isAddapiFile && analysis.hasDefault && moduleKeys.length > 0) {
			// A function default carries the named exports itself, as before; an object default is copied, so
			// the module's own default object is not mutated. A named export conflicting with the default's
			// own member resolves by collision mode (#421, #587).
			const isObjectDefault = typeof mod.default === "object" && mod.default !== null;
			const moduleContent = isObjectDefault ? this.cloneDefault(mod.default) : mod.default;
			const collisionMode = this.#defaultConflictMode(collisionModeOverride, collisionContext);
			const members = {};
			for (const key of moduleKeys) {
				const conflicts = this.defaultHasMember(mod.default, key);
				if (conflicts && !this.namedExportWinsOverDefault(key, collisionMode, `${apiPathPrefix}.${propertyName}`)) continue;
				this.assignNamedExport(moduleContent, key, mod[key]);
				members[key] = [key];
			}
			return { moduleContent, origins: { self: ["default"], members } };
		}

		// Rule 7 (F02, F03) - C08: Auto-flattening (single named export matching module name)
		if (decision.useAutoFlattening) {
			return { moduleContent: mod[moduleName], origins: { self: [moduleName], members: {} } };
		}

		// Rule 1 (F01) - C09: Flatten to root/category — merge all exports into one flat content object for caller to assign
		if (decision.flattenToRoot || decision.flattenToCategory) {
			if (mod.default && moduleKeys.length === 0) {
				return { moduleContent: mod.default, origins: { self: ["default"], members: {} } };
			}
			if (mod.default && moduleKeys.length > 0) {
				const isFunctionDefault = typeof mod.default === "function";
				const moduleContent = isFunctionDefault ? mod.default : this.cloneDefault(mod.default);
				const members = {};
				if (!isFunctionDefault) {
					// The copy carries the default object's own members.
					for (const key of Object.keys(mod.default)) members[key] = ["default", key];
				}
				// A named export conflicting with the default's own member resolves by collision mode (#421, #587).
				const collisionMode = this.#defaultConflictMode(collisionModeOverride, collisionContext);
				for (const key of moduleKeys) {
					const conflicts = this.defaultHasMember(mod.default, key);
					if (conflicts && !this.namedExportWinsOverDefault(key, collisionMode, `${apiPathPrefix}.${propertyName}`)) continue;
					this.assignNamedExport(moduleContent, key, mod[key]);
					members[key] = [key];
				}
				return { moduleContent, origins: { self: isFunctionDefault ? ["default"] : null, members } };
			}
			// Only named exports: expose each directly (caller merges to parent)
			const moduleContent = {};
			const members = {};
			for (const key of moduleKeys) {
				moduleContent[key] = mod[key];
				members[key] = [key];
			}
			return { moduleContent, origins: { self: null, members } };
		}

		// Rule 6 - C09a: Self-referential non-function — use the named export that is itself (or full mod)
		if (isSelfReferential) {
			if (mod[moduleName]) return { moduleContent: mod[moduleName], origins: { self: [moduleName], members: {} } };
			const members = {};
			for (const key of Object.keys(mod)) members[key] = [key];
			return { moduleContent: mod, origins: { self: null, members } };
		}

		// Hybrid pattern: default + named exports
		if (mod.default && moduleKeys.length > 0) {
			if (typeof mod.default === "function") {
				// Default is a function: attach named exports as properties (e.g. logger(), logger.info())
				const moduleContent = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName);
				const members = {};
				const collisionConfig = this.slothlet.config.api?.collision || this.slothlet.config.collision;
				// Per-call override (e.g. api.add({ forceOverwrite: true })) takes priority over the
				// config default, matching every other collision decision in this same build
				// (#372/#373 review, suppressed finding).
				const collisionMode = collisionModeOverride || (collisionContext === "initial" ? collisionConfig.initial : collisionConfig.api);
				for (const key of moduleKeys) {
					if (!this.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
						continue;
					}
					const hasExisting = this.defaultHasMember(mod.default, key);
					if (hasExisting && !this.namedExportWinsOverDefault(key, collisionMode, `${apiPathPrefix}.${propertyName}`)) {
						continue;
					}
					this.assignNamedExport(moduleContent, key, mod[key]);
					members[key] = [key];
				}
				return { moduleContent, origins: { self: ["default"], members } };
			}
			if (typeof mod.default === "object" && mod.default !== null) {
				// Default is an object: copy it and merge named exports. Same-name conflicts are resolved by
				// collisionMode, consistent with the function-default branch above (#421). Copied so the
				// module's own default object is not mutated (#587).
				const moduleContent = this.cloneDefault(mod.default);
				const members = {};
				const collisionConfig = this.slothlet.config.api?.collision || this.slothlet.config.collision;
				const collisionMode = collisionModeOverride || (collisionContext === "initial" ? collisionConfig.initial : collisionConfig.api);
				for (const key of moduleKeys) {
					if (!this.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
						continue;
					}
					const hasExisting = this.defaultHasMember(mod.default, key);
					if (hasExisting && !this.namedExportWinsOverDefault(key, collisionMode, `${apiPathPrefix}.${propertyName}`)) {
						continue;
					}
					this.assignNamedExport(moduleContent, key, mod[key]);
					members[key] = [key];
				}
				return { moduleContent, origins: { self: ["default"], members } };
			}
			// Default is a primitive: wrap in a namespace object
			const moduleContent = { default: mod.default };
			const members = { default: ["default"] };
			for (const key of moduleKeys) {
				moduleContent[key] = mod[key];
				members[key] = [key];
			}
			return { moduleContent, origins: { self: null, members } };
		}

		// Rule 1 (F01), Rule 2 - C09b: Traditional namespace preservation — only default export, use it directly
		if (mod.default && moduleKeys.length === 0) {
			return {
				moduleContent: this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName),
				origins: { self: ["default"], members: {} }
			};
		}

		// Fallback: named-only exports (no default — all truthy-default paths return above)
		const moduleContent = {};
		const members = {};
		for (const key of moduleKeys) {
			moduleContent[key] = mod[key];
			members[key] = [key];
		}
		return { moduleContent, origins: { self: null, members } };
	}

	/**
	 * Build category-level flattening decisions.
	 * Implements conditions C10-C24 from buildCategoryDecisions().
	 * @param {object} options - Category options
	 * @param {string} options.categoryName - Category name
	 * @param {object} options.mod - Module exports
	 * @param {string} options.moduleName - Module name
	 * @param {string} options.fileBaseName - File base name
	 * @param {object} options.analysis - Export analysis
	 * @param {string[]} options.moduleKeys - Module keys
	 * @param {number} options.currentDepth - Current depth
	 * @param {unknown[]} options.moduleFiles - Files in category
	 * @param {function} options.t - Translation function
	 * @returns {Promise<object>} Category decision
	 * @public
	 */
	async buildCategoryDecisions(options) {
		const { categoryName, mod, moduleName, fileBaseName, analysis, moduleKeys, currentDepth, moduleFiles = [], t } = options;

		const decision = {
			shouldFlatten: false,
			flattenType: "preserve",
			preferredName: null,
			reason: await t("FLATTEN_REASON_NO_CONDITIONS_MET")
		};

		// Rule 11 (F06) - C24: AddApi Special File Pattern
		// Files named addapi.{mjs,cjs,js,ts} always flatten regardless of autoFlatten setting
		const isAddapiFile =
			moduleName === "addapi" ||
			fileBaseName === "addapi" ||
			(fileBaseName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(fileBaseName.toLowerCase()));
		if (isAddapiFile) {
			// Check for metadata default export pattern (object default + named exports)
			if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleKeys.length > 0) {
				return {
					shouldFlatten: true,
					flattenType: "addapi-metadata-default",
					reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE_PARENT")
				};
			}
			// Even without metadata pattern, addapi files should always flatten
			return {
				shouldFlatten: true,
				flattenType: "addapi-special-file",
				reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE")
			};
		}

		// Rule 2, Rule 3 - C10: Single-file function folder match
		if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "function-folder-match",
				reason: await t("FLATTEN_REASON_FUNCTION_FOLDER_MATCH")
			};
		}

		// Rule 4, Rule 8 (F02, F04, F05) - C11: Default export flattening
		if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-export-flatten",
				reason: await t("FLATTEN_REASON_DEFAULT_OBJECT_EXPORT_FLATTEN")
			};
		}

		// Rule 7 (F02, F03) - C12: Object auto-flatten (single named export matching filename)
		if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
			if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
				return {
					shouldFlatten: true,
					flattenType: "object-auto-flatten",
					reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_FILENAME")
				};
			}
		}

		// Rule 1, Rule 2 (F01) - C13: Filename-folder exact match flattening
		if (fileBaseName === categoryName && moduleKeys.length > 0) {
			return {
				shouldFlatten: true,
				flattenType: "filename-folder-match-flatten",
				reason: await t("FLATTEN_REASON_BASENAME_MATCHES_CATEGORY")
			};
		}

		// Rule 10 (F02) - C14: Parent-level flattening (generic filenames)
		if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod)) {
			const genericFilenames = ["singlefile", "index", "main", "default"];
			const isGenericFilename = genericFilenames.includes(moduleName.toLowerCase());

			if (moduleKeys.length === 1 && isGenericFilename) {
				return {
					shouldFlatten: true,
					flattenType: "parent-level-flatten",
					reason: await t("FLATTEN_REASON_GENERIC_FILENAME_SINGLE_EXPORT")
				};
			}
		}

		// Rule 9 - C15: Function name matches folder
		if (typeof mod === "function" && mod.name && currentDepth > 0) {
			const functionNameMatchesFolder =
				mod.name.toLowerCase() === categoryName.toLowerCase() ||
				mod.name.toLowerCase().replace(/[-_]/g, "") === categoryName.toLowerCase().replace(/[-_]/g, "");

			if (functionNameMatchesFolder) {
				return {
					shouldFlatten: true,
					flattenType: "function-folder-match",
					preferredName: mod.name,
					reason: await t("FLATTEN_REASON_FUNCTION_FOLDER_MATCH")
				};
			}
		}

		// Rule 4, Rule 9 - C16: Function name preference
		// Always prefer function name over sanitized filename when function name exists
		const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;

		if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
			// Check if function name relates to filename (case-insensitive, ignoring separators)
			const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
			const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
			const functionNameMatchesFilename = normalizedFunctionName === normalizedModuleName;

			// Rule 9: Always use function name to preserve casing (XMLParser vs xmlParser)
			if (functionNameMatchesFilename) {
				return {
					shouldFlatten: false,
					preferredName: exportToCheck.name, // Use exact function name (preserves XMLParser, getHTTPStatus, etc.)
					reason: await t("FLATTEN_REASON_PRESERVING_FUNCTION_NAME")
				};
			}
		}

		// Rule 4, Rule 8 (F02, F04, F05) - C17: Default function export flattening
		if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-function",
				preferredName: categoryName,
				reason: await t("FLATTEN_REASON_DEFAULT_FUNCTION_EXPORT")
			};
		}

		// Rule 7 (F02, F03) - C18: Object auto-flatten (final check)
		if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
			return {
				shouldFlatten: true,
				flattenType: "object-auto-flatten",
				preferredName: moduleName,
				reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_MODULE")
			};
		}

		return decision;
	}

	/**
	 * Decide whether a named export should be attached to a callable default export.
	 *
	 * Returns false when the named export is the same reference as the default (re-export
	 * pattern), or when the export key matches the function name (self-referential export).
	 *
	 * @param {string} key - Named export key.
	 * @param {unknown} value - Named export value.
	 * @param {Function} defaultFunc - Wrapped callable default export.
	 * @param {Function} originalDefault - Original default export.
	 * @returns {boolean} True if the export should be attached.
	 * @public
	 */
	shouldAttachNamedExport(key, value, defaultFunc, originalDefault) {
		if (!key || key === "default") {
			return false;
		}
		if (value === defaultFunc || value === originalDefault) {
			return false;
		}
		if (typeof defaultFunc === "function" && key === defaultFunc.name) {
			return false;
		}
		if (typeof originalDefault === "function" && key === originalDefault.name) {
			return false;
		}
		return true;
	}
}
