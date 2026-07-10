/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/config.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-17 21:13:35 -07:00 (1776485615)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Configuration normalization utilities
 * @module @cldmv/slothlet/helpers/config
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { SlothletError } from "@cldmv/slothlet/errors";

// Node-vs-browser host detection, resolved once in the platform module (#123). Used by
// Config.normalizeEnvTarget()'s auto-detect fallback path.
import { isNode as IS_NODE } from "@cldmv/slothlet/helpers/platform";

/**
 * Normalize the `hook` config (V2-style support) into a canonical
 * `{ enabled, pattern, suppressErrors }` object.
 *
 * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
 * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
 * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
 * so `reload()` can re-feed it.
 *
 * Exported as a standalone function (not just a {@link Config} method) because the HookManager
 * is constructed during `_initializeComponents` — BEFORE `transformConfig` runs — so it cannot
 * rely on the normalized config being in place yet, and must normalize the raw `config.hook`
 * itself from the same source of truth.
 *
 * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
 * @returns {{enabled: boolean, pattern: (string|null), suppressErrors: boolean, pin: boolean}} Normalized hook config.
 * @public
 */
export function normalizeHookConfig(hook) {
	const hookConfig = { enabled: false, pattern: "**", suppressErrors: false, pin: true };
	if (hook === true || hook === false) {
		// Boolean: enabled/disabled with all patterns
		hookConfig.enabled = hook;
		hookConfig.pattern = hook ? "**" : null;
	} else if (typeof hook === "string") {
		// String: enabled with a specific global path pattern
		hookConfig.enabled = true;
		hookConfig.pattern = hook;
	} else if (hook && typeof hook === "object") {
		// Object: { enabled, pattern, suppressErrors }
		hookConfig.enabled = hook.enabled !== false; // Default true if object provided
		hookConfig.pattern = hook.pattern || "**";
		hookConfig.suppressErrors = hook.suppressErrors || false;
		hookConfig.pin = hook.pin !== false;
	}
	return hookConfig;
}

/**
 * Configuration normalization utilities
 * @class Config
 * @extends ComponentBase
 * @public
 */
export class Config extends ComponentBase {
	static slothletProperty = "config";

	/**
	 * Normalize collision configuration for handling property collisions
	 * @param {string|Object} collision - Collision mode or object with per-context modes
	 * @returns {Object} Normalized collision configuration with initial and api.slothlet.api.add modes
	 * @public
	 *
	 * @description
	 * Normalizes collision handling configuration for both initial load (buildAPI)
	 * and hot reload (api.add) contexts. Supports six collision modes:
	 * - "skip": Silently ignore collision, keep existing value
	 * - "warn": Warn about collision, keep existing value
	 * - "replace": Replace existing value completely
	 * - "merge": Merge properties (preserve original + add new)
	 * - "merge-replace": Merge properties (add new + overwrite existing with new values)
	 * - "error": Throw error on collision
	 *
	 * @example
	 * // String shorthand applies to both contexts
	 * normalizeCollision("merge")
	 * // => { initial: "merge", api: "merge" }
	 *
	 * @example
	 * // Object allows per-context control
	 * normalizeCollision({ initial: "warn", api: "error" })
	 * // => { initial: "warn", api: "error" }
	 */
	normalizeCollision(collision) {
		const validModes = ["skip", "warn", "replace", "merge", "merge-replace", "error"];
		const defaultMode = "merge";

		// String shorthand applies to both contexts
		if (typeof collision === "string") {
			const normalized = collision.toLowerCase();
			const mode = validModes.includes(normalized) ? normalized : defaultMode;
			return { initial: mode, api: mode };
		}

		// Object allows per-context control
		if (collision && typeof collision === "object") {
			const validateMode = (m) => {
				if (!m) return defaultMode;
				const normalized = String(m).toLowerCase();
				return validModes.includes(normalized) ? normalized : defaultMode;
			};
			return {
				initial: validateMode(collision.initial),
				api: validateMode(collision.api)
			};
		}

		// Default: merge for both contexts
		return { initial: defaultMode, api: defaultMode };
	}

	/**
	 * Normalize runtime input to internal standard format
	 * @param {string} runtime - Input runtime type (various formats accepted)
	 * @returns {string} Normalized runtime type ("async" or "live")
	 * @public
	 */
	normalizeRuntime(runtime) {
		if (!runtime || typeof runtime !== "string") {
			return "async"; // Default to AsyncLocalStorage
		}

		const normalized = runtime.toLowerCase().trim();

		// AsyncLocalStorage runtime variants
		if (normalized === "async" || normalized === "asynclocal" || normalized === "asynclocalstorage") {
			return "async";
		}

		// Live bindings runtime variants
		if (normalized === "live" || normalized === "livebindings" || normalized === "experimental") {
			return "live";
		}

		// Default to async for unknown values
		return "async";
	}

	/**
	 * Normalize mode input to internal standard format
	 * @param {string} mode - Input mode type (various formats accepted)
	 * @returns {string} Normalized mode type ("eager" or "lazy")
	 * @public
	 */
	normalizeMode(mode) {
		if (!mode || typeof mode !== "string") {
			return "eager"; // Default to eager
		}

		const normalized = mode.toLowerCase().trim();

		// Lazy mode variants
		if (normalized === "lazy" || normalized === "deferred" || normalized === "proxy") {
			return "lazy";
		}

		// Eager mode variants
		if (normalized === "eager" || normalized === "immediate" || normalized === "preload") {
			return "eager";
		}

		// Default to eager for unknown values
		return "eager";
	}

	/**
	 * Normalize mutations configuration for API modification control
	 * @param {Object} mutations - Mutations config object with add/remove/reload properties
	 * @returns {Object} Normalized mutations configuration
	 * @public
	 *
	 * @description
	 * Normalizes mutation control configuration for API runtime modifications.
	 * Controls whether api.slothlet.api.add(), api.slothlet.api.remove(), and
	 * api.slothlet.reload() operations are allowed.
	 *
	 * @example
	 * // Allow all mutations (default)
	 * normalizeMutations({ add: true, remove: true, reload: true })
	 * // => { add: true, remove: true, reload: true }
	 *
	 * @example
	 * // Disable all mutations
	 * normalizeMutations({ add: false, remove: false, reload: false })
	 * // => { add: false, remove: false, reload: false }
	 */
	normalizeMutations(mutations) {
		const defaults = { add: true, remove: true, reload: true, permissions: true };

		// If mutations is not an object, use defaults
		if (!mutations || typeof mutations !== "object") {
			return defaults;
		}

		// Merge with defaults, ensuring boolean values
		return {
			add: mutations.add === false ? false : true,
			remove: mutations.remove === false ? false : true,
			reload: mutations.reload === false ? false : true,
			permissions: mutations.permissions === false ? false : true
		};
	}

	/**
	 * Normalize debug configuration
	 * @param {boolean|Object} debug - Debug flag or object with targeted flags
	 * @returns {Object} Normalized debug object with all flags
	 * @public
	 */
	normalizeDebug(debug) {
		if (!debug) {
			return {
				builder: false,
				api: false,
				index: false,
				modes: false,
				wrapper: false,
				ownership: false,
				context: false,
				initialization: false,
				materialize: false,
				versioning: false,
				permissions: false
			};
		}

		// If debug is a boolean true, enable all debug flags
		if (debug === true) {
			return {
				builder: true,
				api: true,
				index: true,
				modes: true,
				wrapper: true,
				ownership: true,
				context: true,
				initialization: true,
				materialize: true,
				versioning: true,
				permissions: true
			};
		}

		// If debug is an object, merge with defaults
		if (typeof debug === "object") {
			return {
				builder: debug.builder || false,
				api: debug.api || false,
				index: debug.index || false,
				modes: debug.modes || false,
				wrapper: debug.wrapper || false,
				ownership: debug.ownership || false,
				context: debug.context || false,
				initialization: debug.initialization || false,
				materialize: debug.materialize || false,
				versioning: debug.versioning || false,
				permissions: debug.permissions || false
			};
		}

		// Unknown type, default to all false
		return {
			builder: false,
			api: false,
			index: false,
			modes: false,
			wrapper: false,
			ownership: false,
			context: false,
			initialization: false,
			materialize: false,
			versioning: false,
			permissions: false
		};
	}

	/**
	 * Normalize execution-environment target from the raw `platform` config value.
	 *
	 * @description
	 * Distinct from `normalizeEnv()` which handles the `process.env` snapshot
	 * allowlist (`config.env`). This method determines *where* slothlet is executing
	 * so that filesystem-dependent code paths can be bypassed in browser/worker builds.
	 *
	 * When `platform` is omitted the method auto-detects by checking whether
	 * `process.versions.node` is available (true in Node.js; absent or undefined
	 * in browsers, web workers, and Electron renderers without nodeIntegration).
	 * Pass `"browser"` or `"node"` to override auto-detection for edge cases
	 * (e.g. Deno, Electron with custom process polyfills).
	 *
	 * @param {*} platform - Raw value of `config.platform` before normalisation.
	 * @returns {"browser"|"node"} Execution-environment target.
	 * @public
	 *
	 * @example
	 * normalizeEnvTarget("browser"); // => "browser" (explicit override)
	 * normalizeEnvTarget("node");    // => "node"    (explicit override)
	 * normalizeEnvTarget(undefined); // => "browser" or "node" (auto-detected)
	 */
	normalizeEnvTarget(platform, hasManifest = false) {
		if (platform === "browser") return "browser";
		if (platform === "node") return "node";
		// manifest presence is a strong browser-mode signal — treat it as browser
		// unless the caller explicitly passed platform: "node" (handled above).
		if (hasManifest) return "browser";
		// Auto-detect via the module-scope `IS_NODE` constant computed once at
		// module load. The false-arm of the ternary fires only in real browsers /
		// workers / Electron renderers; the Node-only vitest runner cannot exercise
		// it without stubbing the `process` global (which destabilizes vitest).
		/* v8 ignore next */
		return IS_NODE ? "node" : "browser";
	}

	/**
	 * Normalize the `hook` config (V2-style support) into a canonical
	 * `{ enabled, pattern, suppressErrors }` object.
	 *
	 * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
	 * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
	 * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
	 * so `reload()` can re-feed it. Shared by {@link transformConfig} and the HookManager so both
	 * derive the same values regardless of construction order (the manager is built before
	 * transformConfig runs, so it cannot rely on the normalized config being in place yet).
	 *
	 * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
	 * @returns {{enabled: boolean, pattern: (string|null), suppressErrors: boolean, pin: boolean}} Normalized hook config.
	 * @public
	 */
	normalizeHook(hook) {
		return normalizeHookConfig(hook);
	}

	/**
	 * Transform and validate configuration
	 * @param {Object} config - Raw configuration options
	 * @returns {Object} Normalized configuration
	 * @throws {SlothletError} If configuration is invalid
	 * @public
	 */
	transformConfig(config = {}) {
		// Determine execution environment target before any filesystem operations.
		// manifest presence acts as a fallback browser-mode signal.
		const hasManifest = config.manifest != null;
		const envTarget = this.normalizeEnvTarget(config.platform, hasManifest);

		// Accept `base` as the primary option; `dir` is a deprecated v3 alias.
		// `base` is always required — in node mode it is the API directory path;
		// in browser mode it is the base URL used to resolve module specifiers when
		// no resolveModuleSpecifier override is provided.
		const rawBase = config.base ?? config.dir;
		if (config.dir !== undefined && config.base === undefined && !config.silent) {
			new this.SlothletWarning("V3_CONFIG_DEPRECATED", {
				option: "dir",
				replacement: "base"
			});
		}
		if (!rawBase) {
			throw new this.SlothletError("INVALID_CONFIG_DIR_MISSING", {}, null, { validationError: true });
		}

		// Browser-mode specific validation.
		if (envTarget === "browser") {
			if (!config.manifest || typeof config.manifest !== "object" || Array.isArray(config.manifest)) {
				throw new this.SlothletError("INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST", {}, null, { validationError: true });
			}
			if (!Array.isArray(config.manifest.files) || !Array.isArray(config.manifest.directories)) {
				throw new this.SlothletError(
					"INVALID_CONFIG_BROWSER_MANIFEST_INVALID",
					{
						received: typeof config.manifest
					},
					null,
					{ validationError: true }
				);
			}
			// resolveModuleSpecifier is optional — if omitted (undefined) or normalized to null
			// (the config normalization below stores `?? null`), it defaults to new URL(path, dir).
			// Only a provided NON-function value is rejected. Treating null like undefined keeps
			// transformConfig idempotent, so reload() — which re-feeds the already-normalized
			// config — does not throw (#91).
			if (
				config.resolveModuleSpecifier !== undefined &&
				config.resolveModuleSpecifier !== null &&
				typeof config.resolveModuleSpecifier !== "function"
			) {
				throw new this.SlothletError(
					"INVALID_CONFIG_BROWSER_RESOLVE_SPECIFIER_INVALID",
					{ received: typeof config.resolveModuleSpecifier },
					null,
					{ validationError: true }
				);
			}
		}

		// Resolve relative paths from caller's context (node mode only).
		// In browser mode base is a URL string — pass it through as-is.
		const resolvedDir = envTarget === "browser" ? rawBase : this.slothlet.helpers.resolver.resolvePathFromCaller(rawBase);

		// ===== BACKWARD COMPATIBILITY =====
		// Handle deprecated allowMutation config (v2 compatibility)
		let mutations = null;
		if (config.allowMutation === false) {
			// Map allowMutation: false to all mutations disabled
			mutations = { add: false, remove: false, reload: false };
			if (!config.silent) {
				new this.SlothletWarning("V2_CONFIG_UNSUPPORTED", {
					option: "allowMutation",
					replacement: "api.mutations: { add: false, remove: false, reload: false }",
					hint: "The allowMutation config option was part of v2. Use api.mutations for granular control in v3."
				});
			}
		}

		// Handle root-level collision config (backward compatibility)
		// TODO: Remove before v3 release - this was a v3 development thing, not v2 backward compat
		let collision = null;
		if (config.collision && !config.api?.collision) {
			collision = this.normalizeCollision(config.collision);
			if (!config.silent) {
				new this.SlothletWarning("V2_CONFIG_UNSUPPORTED", {
					option: "collision",
					replacement: "api.collision",
					hint: "Root-level collision config was part of v2. Use api.collision in v3."
				});
			}
		}

		// Process api.* namespace (new v3 structure)
		const apiConfig = config.api || {};
		const finalCollision = apiConfig.collision ? this.normalizeCollision(apiConfig.collision) : collision || this.normalizeCollision(null);
		const finalMutations = apiConfig.mutations ? this.normalizeMutations(apiConfig.mutations) : mutations || this.normalizeMutations(null);

		// Validate scope.merge strategy if provided
		let scopeConfig = config.scope;
		if (scopeConfig && typeof scopeConfig === "object" && scopeConfig.merge) {
			const validMergeStrategies = ["shallow", "deep"];
			if (!validMergeStrategies.includes(scopeConfig.merge)) {
				throw new this.SlothletError(
					"INVALID_CONFIG",
					{
						option: "scope.merge",
						value: scopeConfig.merge,
						expected: validMergeStrategies.join(" or "),
						hint: `Invalid merge strategy: "${scopeConfig.merge}". Must be "shallow" or "deep".`,
						validationError: true
					},
					null,
					{ validationError: true }
				);
			}
		}

		// Parse hook configuration (V2-style support) — shared with the HookManager.
		const hookConfig = this.normalizeHook(config.hook);

		// Parse tracking configuration
		let trackingConfig = { materialization: false };
		if (config.tracking === true || config.tracking === false) {
			// Boolean: enable/disable materialization tracking
			trackingConfig.materialization = config.tracking;
		} else if (config.tracking && typeof config.tracking === "object") {
			// Object: { materialization: boolean }
			trackingConfig.materialization = config.tracking.materialization === true;
		}

		// backgroundMaterialize implies materialization tracking - auto-enable
		if (config.backgroundMaterialize === true) {
			trackingConfig.materialization = true;
		}

		// Validate versionDispatcher option
		if (config.versionDispatcher !== undefined && config.versionDispatcher !== null) {
			if (typeof config.versionDispatcher !== "string" && typeof config.versionDispatcher !== "function") {
				throw new this.SlothletError("INVALID_CONFIG_VERSION_DISPATCHER", {
					received: typeof config.versionDispatcher,
					validationError: true
				});
			}
		}

		// Normalize permissions configuration
		const permissionsConfig = this.normalizePermissions(config.permissions);

		// Normalize suppressFixes — array of rule IDs (e.g. ["C03"]) that opt out of specific
		// bug-fix behaviors. Each listed rule emits a deprecation warning. This option is
		// temporary and will be removed in v4 when the corrected behaviors become permanent.
		const suppressFixes = this.normalizeSuppressFixes(config.suppressFixes, config.silent);

		// Parse i18n configuration (dev-facing; process-global)
		let i18nConfig = null;
		if (config.i18n && typeof config.i18n === "object") {
			i18nConfig = {
				language: typeof config.i18n.language === "string" ? config.i18n.language : undefined
			};
		}

		// Build normalized config
		return {
			...config,
			base: resolvedDir,
			dir: resolvedDir,
			manifest: config.manifest ?? null,
			resolveModuleSpecifier: config.resolveModuleSpecifier ?? null,
			envTarget,
			mode: this.normalizeMode(config.mode),
			runtime: this.normalizeRuntime(config.runtime),
			apiDepth: config.apiDepth !== undefined ? config.apiDepth : Infinity,
			reference: config.reference || null,
			context: config.context || null,
			i18n: i18nConfig,
			debug: this.normalizeDebug(config.debug),
			diagnostics: config.diagnostics === true,
			hook: hookConfig,
			collision: finalCollision,
			api: {
				collision: finalCollision,
				mutations: finalMutations
			},
			scope: scopeConfig,
			tracking: trackingConfig,
			backgroundMaterialize: config.backgroundMaterialize === true,
			silent: config.silent === true,
			typescript: this.normalizeTypeScript(config.typescript),
			env: this.normalizeEnv(config.env),
			versionDispatcher: config.versionDispatcher ?? null,
			permissions: permissionsConfig,
			suppressFixes
		};
	}

	/**
	 * Normalize and validate the suppressFixes option. Emits a deprecation warning for each
	 * rule ID present. Invalid entries (non-strings, unknown rule IDs) are silently dropped.
	 *
	 * @param {string[]|undefined} suppressFixes - Raw suppressFixes value from user config.
	 * @param {boolean} silent - If true, suppress warnings.
	 * @returns {Set<string>} Normalized set of suppressed rule IDs.
	 * @example
	 * // Rule IDs use the <rule>_<PR> form. The C03 fix landed in PR #116.
	 * normalizeSuppressFixes(["C03_116"], false); // emits WARN_SUPPRESS_FIX_ACTIVE for C03_116
	 * @public
	 */
	normalizeSuppressFixes(suppressFixes, silent) {
		// Known suppressible rule IDs — extend this list as more fixes land in v3.
		// Format: <rule>_<PR number> (e.g. "C03_116" = API rule C03, fixed in PR #116).
		const KNOWN_FIX_IDS = new Set(["C03_116"]);
		const REPO_PR_BASE = "https://github.com/CLDMV/slothlet/pull/";

		if (!Array.isArray(suppressFixes) || suppressFixes.length === 0) {
			return new Set();
		}

		const result = new Set();
		for (const rule of suppressFixes) {
			if (typeof rule !== "string" || !KNOWN_FIX_IDS.has(rule)) {
				continue;
			}
			result.add(rule);
			if (!silent) {
				// Extract PR number from the trailing _<number> segment of the rule ID
				const prNumber = rule.split("_").pop();
				const url = `${REPO_PR_BASE}${prNumber}`;
				new this.SlothletWarning("WARN_SUPPRESS_FIX_ACTIVE", { rule, url });
			}
		}
		return result;
	}

	/**
	 * Normalize TypeScript configuration
	 * @param {boolean|string|Object} typescript - TypeScript config (true, "fast", or { mode: "fast"|"strict", ... })
	 * @returns {Object|null} Normalized TypeScript configuration or null if disabled
	 * @public
	 */
	normalizeTypeScript(typescript) {
		// Disabled by default
		if (!typescript) {
			return null;
		}

		// Boolean true defaults to fast mode
		if (typescript === true) {
			return { enabled: true, mode: "fast" };
		}

		// String "fast" or "strict"
		if (typeof typescript === "string") {
			const mode = typescript.toLowerCase();
			if (mode === "fast" || mode === "strict") {
				return { enabled: true, mode };
			}
			// Unknown string defaults to fast
			return { enabled: true, mode: "fast" };
		}

		// Object configuration
		if (typeof typescript === "object") {
			const mode = typescript.mode === "strict" ? "strict" : "fast";
			return {
				enabled: true,
				mode,
				types: typescript.types || null,
				target: typescript.target || "es2020",
				sourcemap: typescript.sourcemap || false
			};
		}

		// Unknown type, disable
		return null;
	}

	/**
	 * Normalize env snapshot configuration.
	 *
	 * @description
	 * Validates the `env` option from user config. When `include` is a non-empty
	 * string array, returns `{ include }` (the allowlist used by `_captureEnvSnapshot`).
	 * Any other value — including `undefined`, `null`, `{}`, or an empty `include`
	 * array — is normalised to `null`, meaning the full `process.env` snapshot is used.
	 *
	 * @param {Object|null|undefined} env - Raw env option from user config.
	 * @param {string[]} [env.include] - Allowlist of env variable names to capture.
	 * @returns {{ include: string[] }|null} Normalized env config, or `null` for full snapshot.
	 * @public
	 *
	 * @example
	 * // No restriction — full snapshot
	 * normalizeEnv(undefined); // => null
	 * normalizeEnv(null);      // => null
	 * normalizeEnv({});        // => null
	 *
	 * @example
	 * // Include allowlist
	 * normalizeEnv({ include: ["NODE_ENV", "PORT"] });
	 * // => { include: ["NODE_ENV", "PORT"] }
	 *
	 * @example
	 * // Non-string keys in the include array are filtered out
	 * normalizeEnv({ include: ["NODE_ENV", 42, null] });
	 * // => { include: ["NODE_ENV"] }
	 */
	normalizeEnv(env) {
		if (!env || typeof env !== "object") {
			return null; // No restriction — full snapshot
		}
		const include = Array.isArray(env.include) ? env.include.filter((k) => typeof k === "string") : null;
		if (include && include.length > 0) {
			return { include };
		}
		return null; // Empty or invalid include — treat as no restriction
	}

	/**
	 * Normalize permissions configuration.
	 *
	 * @param {object|null} [permissions] - Raw permissions config from user.
	 * @param {string} [permissions.defaultPolicy="allow"] - Fallback policy: "allow" or "deny".
	 * @param {boolean} [permissions.enabled=true] - Global toggle.
	 * @param {string|boolean} [permissions.audit="default"] - Audit level: `"default"` (denied + self-bypass only),
	 *   `"verbose"` (all decisions). `true` and `false` are accepted and both normalize to `"default"`.
	 * @param {boolean} [permissions.readGating=true] - When `true` (the default), reading a terminal
	 *   data value (primitive, Buffer, TypedArray, Date, Map, etc.) off a module API path is
	 *   permission-checked, the same way calls are. Set `false` to opt out and gate calls only.
	 * @param {Array<object>} [permissions.rules=[]] - Initial permission rules.
	 * @returns {object|null} Normalized permissions config, or null when permissions is absent or not an object.
	 *
	 * @example
	 * normalizePermissions({ defaultPolicy: "deny", rules: [{ caller: "**", target: "admin.**", effect: "deny" }] });
	 * // => { defaultPolicy: "deny", enabled: true, audit: "default", readGating: true, rules: [...] }
	 */
	normalizePermissions(permissions) {
		if (!permissions || typeof permissions !== "object") {
			return null;
		}

		// Validate defaultPolicy
		let defaultPolicy;
		if (permissions.defaultPolicy === "deny") {
			defaultPolicy = "deny";
		} else if (permissions.defaultPolicy === "allow" || permissions.defaultPolicy === undefined) {
			defaultPolicy = "allow";
		} else {
			throw new SlothletError(
				"INVALID_CONFIG",
				{
					option: "permissions.defaultPolicy",
					value: permissions.defaultPolicy,
					expected: '"allow" or "deny"',
					hint: "HINT_INVALID_CONFIG"
				},
				null,
				{ validationError: true }
			);
		}

		const enabled = permissions.enabled !== false;

		// Validate audit
		let audit;
		if (permissions.audit === "verbose") {
			audit = "verbose";
		} else if (permissions.audit === "default" || permissions.audit === undefined) {
			audit = "default";
		} else if (permissions.audit === true) {
			// Boolean true normalizes to "default" (denied + self-bypass events only)
			audit = "default";
		} else if (permissions.audit === false) {
			// Boolean false normalizes to "default" (denied + self-bypass events only; audit is not disabled)
			audit = "default";
		} else {
			throw new SlothletError(
				"INVALID_CONFIG",
				{
					option: "permissions.audit",
					value: permissions.audit,
					expected: '"default" or "verbose"',
					hint: "HINT_INVALID_CONFIG"
				},
				null,
				{ validationError: true }
			);
		}

		// Validate readGating — gates terminal data-value property reads.
		// Defaults to true (opt-out): reads are enforced alongside calls unless explicitly disabled.
		let readGating;
		if (permissions.readGating === false) {
			readGating = false;
		} else if (permissions.readGating === true || permissions.readGating === undefined) {
			readGating = true;
		} else {
			throw new SlothletError(
				"INVALID_CONFIG",
				{
					option: "permissions.readGating",
					value: permissions.readGating,
					expected: "boolean",
					hint: "HINT_INVALID_CONFIG"
				},
				null,
				{ validationError: true }
			);
		}

		// Validate rules
		if (permissions.rules !== undefined && !Array.isArray(permissions.rules)) {
			throw new SlothletError(
				"INVALID_CONFIG",
				{
					option: "permissions.rules",
					value: permissions.rules,
					expected: "array",
					hint: "HINT_INVALID_CONFIG"
				},
				null,
				{ validationError: true }
			);
		}

		const rules = Array.isArray(permissions.rules) ? permissions.rules : [];

		return { defaultPolicy, enabled, audit, readGating, rules };
	}
}
