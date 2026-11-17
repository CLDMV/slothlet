/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-manifest-validator.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:50-08:00 (1794882530)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Pure validator for slothlet module manifests (`slothlet.module.json`).
 * @module @cldmv/slothlet/helpers/module-manifest-validator
 * @internal
 *
 * @description
 * Receives a parsed manifest object plus package context (from package.json) and
 * returns a normalized manifest. Throws `SlothletError` with a typed `MODULE_*`
 * code on any validation failure. Performs no I/O — callers (`discover()`,
 * `addModule()`) handle filesystem reads separately.
 *
 * Path-traversal checks here are LEXICAL ONLY. Runtime symlink/realpath checks
 * belong in `discover()` after this validator passes.
 *
 * The reserved-mount list (`slothlet`, `shutdown`, `destroy`) is hardcoded
 * to mirror `normalizeApiPath` in `src/lib/handlers/api-manager.mjs`. If
 * slothlet ever adds reserved roots, both lists must stay in sync.
 */

import { SlothletError } from "#errors";
import { t } from "#i18n";

// Node-only static import resolved via top-level await so `node:path` never
// enters the static-import graph in browser bundles. Methods that consume
// `path` (mount/base validation) are Node-only — never invoked in
// browser mode because slothlet's browser path skips filesystem validation.
// path resolved in the platform module (#123); null in a browser — slothlet's browser path skips
// filesystem manifest validation.
import { path } from "#helpers/platform";
import { Arrays, copyList, Numbers, Objects, setFrom, SetMethods, String, StringMethods, splitText } from "#helpers/intrinsics";

/**
 * Reserved mount root segments. Mirror of the list in
 * `src/lib/handlers/api-manager.mjs` `normalizeApiPath()`. Any addition there
 * must be reflected here so module discovery rejects reserved-root claims at
 * the manifest layer instead of letting `api.add()` throw downstream.
 * @type {ReadonlySet<string>}
 */
const RESERVED_MOUNT_ROOTS = Objects.freeze(setFrom(["slothlet", "shutdown", "destroy"]));

/**
 * Allowed top-level fields in `slothlet.module.json`. Anything else throws
 * `MODULE_MANIFEST_UNKNOWN_FIELD` per the strict-schema decision in the design.
 * @type {ReadonlySet<string>}
 */
const ALLOWED_TOP_LEVEL_FIELDS = Objects.freeze(
	setFrom([
		"schema",
		"schemaVersion",
		"name",
		"version",
		"description",
		"mount",
		"mountPath",
		"base",
		"apiDir",
		"kind",
		"priority",
		"dependencies",
		"permissions",
		"events",
		"metadata"
	])
);

/**
 * The field names format 1 manifests (deprecated, still read) and format 2 manifests (current) use for the three renamed
 * fields. A manifest uses one set or the other.
 */
const FORMAT_1_NAMES = Objects.freeze({ schema: "schemaVersion", mount: "mountPath", base: "apiDir" });
const FORMAT_2_NAMES = Objects.freeze({ schema: "schema", mount: "mount", base: "base" });
const FORMAT_1_FIELDS = Objects.freeze(["schemaVersion", "mountPath", "apiDir"]);
const FORMAT_2_FIELDS = Objects.freeze(["schema", "mount", "base"]);

/**
 * Whether the manifest carries any of the named fields.
 * @param {object} manifest - Parsed manifest.
 * @param {string[]} fields - Field names to look for.
 * @returns {boolean} True when at least one is present.
 * @private
 */
function hasAnyField(manifest, fields) {
	for (let ofIndex = 0, ofList = fields; ofIndex < ofList.length; ofIndex++) {
		if (manifest[ofList[ofIndex]] !== undefined) return true;
	}
	return false;
}

/**
 * Whether a parsed manifest is written in the deprecated format 1 (`schemaVersion`, `mountPath`, `apiDir`).
 * @param {object} manifest - Parsed manifest.
 * @returns {boolean} True when it uses any format 1 field name.
 */
export function isFormat1(manifest) {
	return hasAnyField(manifest, FORMAT_1_FIELDS);
}

/**
 * Allowed effect values for permission rules.
 * @type {ReadonlySet<string>}
 */
const PERMISSION_EFFECT_VALUES = Objects.freeze(setFrom(["allow", "deny"]));

/**
 * Allowed effect values for event rules (#407). Three-level, unlike the binary call rules.
 * @type {ReadonlySet<string>}
 */
const EVENT_EFFECT_VALUES = Objects.freeze(setFrom(["deny", "notify", "allow"]));

/**
 * Validate a parsed slothlet.module.json manifest and return a normalized form.
 *
 * @param {object} manifest - Parsed JSON manifest object (must already be valid JSON).
 * @param {object} packageContext - Context derived from the host package.
 * @param {string} packageContext.packageName - npm package `name` from package.json.
 * @param {string} packageContext.packageVersion - npm package `version` from package.json.
 * @param {string} [packageContext.packageDescription] - npm package `description` from package.json.
 * @param {string} packageContext.packageRoot - Absolute filesystem path to the package root.
 * @param {string} packageContext.manifestPath - Path to the manifest file (used in error context for diagnostics).
 * @returns {object} Normalized manifest with the following shape:
 *   - All optional fields filled in from defaults / package.json fallbacks
 *   - `name`, `version` always present (from package.json if absent in manifest)
 *   - `description` from manifest (override) or package.json (fallback)
 *   - `priority` defaults to 0 if absent
 *   - `mount` normalized to an array of segments
 * @throws {SlothletError} with `MODULE_*` code on any validation failure.
 *
 * @example
 * const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
 * const pkgJson = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
 * const normalized = validateModuleManifest(manifest, {
 *   packageName: pkgJson.name,
 *   packageVersion: pkgJson.version,
 *   packageDescription: pkgJson.description,
 *   packageRoot,
 *   manifestPath
 * });
 */
export function validateModuleManifest(manifest, packageContext) {
	if (!manifest || typeof manifest !== "object" || Arrays.isArray(manifest)) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageContext?.packageName ?? "<unknown>",
			manifest: packageContext?.manifestPath ?? "<unknown>",
			reason: t("MODULE_MANIFEST_REASON_NOT_OBJECT")
		});
	}

	const { packageName, packageVersion, packageDescription, packageRoot, manifestPath } = packageContext;

	// Reject unknown top-level fields BEFORE other validation so users see typos
	// in field names rather than misleading "missing required field" errors.
	for (let ofIndex = 0, ofList = Objects.keys(manifest); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!SetMethods.has(ALLOWED_TOP_LEVEL_FIELDS, key)) {
			throw new SlothletError("MODULE_MANIFEST_UNKNOWN_FIELD", {
				package: packageName,
				manifest: manifestPath,
				field: key
			});
		}
	}

	// Format: format 2 names (`schema`, `mount`, `base`) or the deprecated format 1 names (`schemaVersion`, `mountPath`,
	// `apiDir`). A file may use one set, never both.
	const hasFormat1 = hasAnyField(manifest, FORMAT_1_FIELDS),
		hasFormat2 = hasAnyField(manifest, FORMAT_2_FIELDS);
	if (hasFormat1 && hasFormat2) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_MIXED_FORMATS")
		});
	}
	const names = hasFormat1 ? FORMAT_1_NAMES : FORMAT_2_NAMES;
	const expectedSchema = hasFormat1 ? 1 : 2;

	// schema: required, must match the format
	if (manifest[names.schema] === undefined) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: names.schema })
		});
	}
	if (manifest[names.schema] !== expectedSchema) {
		throw new SlothletError("MODULE_MANIFEST_FORMAT_UNSUPPORTED", {
			package: packageName,
			schema: String(manifest[names.schema])
		});
	}

	// mount: required, string or non-empty array of non-empty strings
	if (manifest[names.mount] === undefined) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: names.mount })
		});
	}
	const mountSegments = normalizeMount(manifest[names.mount], names.mount, packageName, manifestPath);

	// Reserved-mount root check (G3) — runs at manifest layer, not downstream.
	if (SetMethods.has(RESERVED_MOUNT_ROOTS, mountSegments[0])) {
		throw new SlothletError("MODULE_RESERVED_MOUNT", {
			package: packageName,
			mount: copyList(mountSegments)
		});
	}

	// base: required, string, lexically inside packageRoot
	const base = manifest[names.base];
	if (base === undefined) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: names.base })
		});
	}
	if (typeof base !== "string" || base.length === 0) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: names.base, expected: t("MODULE_MANIFEST_EXPECTED_NON_EMPTY_STRING") })
		});
	}
	validateBaseContainment(base, packageRoot, packageName);

	// name: optional in manifest; if present, MUST match package.json's name.
	if (manifest.name !== undefined) {
		if (typeof manifest.name !== "string") {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "name", expected: t("MODULE_MANIFEST_EXPECTED_STRING") })
			});
		}
		if (manifest.name !== packageName) {
			throw new SlothletError("MODULE_MANIFEST_NAME_MISMATCH", {
				package: packageName,
				expected: packageName,
				received: manifest.name
			});
		}
	}

	// version: optional in manifest; if present, MUST match package.json's version.
	if (manifest.version !== undefined) {
		if (typeof manifest.version !== "string") {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "version", expected: t("MODULE_MANIFEST_EXPECTED_STRING") })
			});
		}
		if (manifest.version !== packageVersion) {
			throw new SlothletError("MODULE_MANIFEST_VERSION_MISMATCH", {
				package: packageName,
				expected: packageVersion,
				received: manifest.version
			});
		}
	}

	// description: optional; manifest overrides package.json silently.
	if (manifest.description !== undefined && typeof manifest.description !== "string") {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "description", expected: t("MODULE_MANIFEST_EXPECTED_STRING") })
		});
	}

	// kind: optional, free-form string
	if (manifest.kind !== undefined && typeof manifest.kind !== "string") {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "kind", expected: t("MODULE_MANIFEST_EXPECTED_STRING") })
		});
	}

	// priority: optional, number, defaults to 0
	if (manifest.priority !== undefined && (typeof manifest.priority !== "number" || !Numbers.isFinite(manifest.priority))) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "priority", expected: t("MODULE_MANIFEST_EXPECTED_FINITE_NUMBER") })
		});
	}

	// dependencies: optional, object with string values
	if (manifest.dependencies !== undefined) {
		if (typeof manifest.dependencies !== "object" || manifest.dependencies === null || Arrays.isArray(manifest.dependencies)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "dependencies", expected: t("MODULE_MANIFEST_EXPECTED_PLAIN_OBJECT") })
			});
		}
		for (let ofIndex = 0, ofList = Objects.entries(manifest.dependencies); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				depName = ofEntry[0],
				depValue = ofEntry[1];
			if (typeof depValue !== "string") {
				throw new SlothletError("MODULE_MANIFEST_INVALID", {
					package: packageName,
					manifest: manifestPath,
					reason: t("MODULE_MANIFEST_REASON_DEPENDENCY_TYPE", { dependency: depName })
				});
			}
		}
	}

	// permissions: optional, array of {caller, target, effect} rules
	if (manifest.permissions !== undefined) {
		validatePermissions(manifest.permissions, packageName, manifestPath);
	}

	// events: optional, array of {caller, event, effect} rules (#407). Effect is deny/notify/allow.
	if (manifest.events !== undefined) {
		validateEventRules(manifest.events, packageName, manifestPath);
	}

	// metadata: optional, plain object (free-form contents allowed inside)
	if (manifest.metadata !== undefined) {
		if (typeof manifest.metadata !== "object" || manifest.metadata === null || Arrays.isArray(manifest.metadata)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "metadata", expected: t("MODULE_MANIFEST_EXPECTED_PLAIN_OBJECT") })
			});
		}
	}

	// All validations passed — return the normalized manifest.
	return {
		schema: 2,
		name: packageName,
		version: packageVersion,
		description: manifest.description ?? packageDescription,
		mount: mountSegments,
		base,
		kind: manifest.kind,
		priority: manifest.priority ?? 0,
		dependencies: manifest.dependencies,
		permissions: manifest.permissions,
		events: manifest.events,
		metadata: manifest.metadata
	};
}

/**
 * Normalize `mount` to a non-empty array of non-empty segments.
 * @param {unknown} mount - Raw manifest value.
 * @param {string} field - The field's name in the manifest's format (`mount` or `mountPath`), for the message.
 * @param {string} packageName - For error context.
 * @param {string} manifestPath - For error context.
 * @returns {string[]} Normalized segments.
 * @throws {SlothletError} `MODULE_MANIFEST_INVALID` on shape error.
 * @private
 */
function normalizeMount(mount, field, packageName, manifestPath) {
	if (typeof mount === "string") {
		if (mount.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_MOUNT_SHAPE", { field })
			});
		}
		return splitText(mount, ".");
	}
	if (Arrays.isArray(mount)) {
		if (mount.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_MOUNT_SHAPE", { field })
			});
		}
		for (let ofIndex = 0, ofList = mount; ofIndex < ofList.length; ofIndex++) {
			const segment = ofList[ofIndex];
			if (typeof segment !== "string" || segment.length === 0) {
				throw new SlothletError("MODULE_MANIFEST_INVALID", {
					package: packageName,
					manifest: manifestPath,
					reason: t("MODULE_MANIFEST_REASON_MOUNT_ENTRIES", { field })
				});
			}
		}
		return copyList(mount);
	}
	throw new SlothletError("MODULE_MANIFEST_INVALID", {
		package: packageName,
		manifest: manifestPath,
		reason: t("MODULE_MANIFEST_REASON_MOUNT_SHAPE", { field })
	});
}

/**
 * Verify `base` lexically resolves inside `packageRoot`. Does not touch the
 * filesystem — symlink/realpath checks belong in `discover()`.
 * @param {string} base - Raw base value from manifest.
 * @param {string} packageRoot - Absolute filesystem path to package root.
 * @param {string} packageName - For error context.
 * @throws {SlothletError} `MODULE_PATH_TRAVERSAL` if base escapes the root.
 * @private
 */
function validateBaseContainment(base, packageRoot, packageName) {
	const resolved = path.resolve(packageRoot, base);
	const rootWithSep = StringMethods.endsWith(packageRoot, path.sep) ? packageRoot : packageRoot + path.sep;
	if (resolved !== packageRoot && !StringMethods.startsWith(resolved, rootWithSep)) {
		throw new SlothletError("MODULE_PATH_TRAVERSAL", {
			package: packageName,
			base,
			resolved,
			folder: packageRoot
		});
	}
}

/**
 * Validate the `permissions` array per the locked permission-rule grammar.
 * Each rule must be `{caller: string, target: string, effect: "allow"|"deny"}`.
 * @param {unknown} permissions - Raw permissions value.
 * @param {string} packageName - For error context.
 * @param {string} manifestPath - For error context.
 * @throws {SlothletError} `MODULE_MANIFEST_INVALID` on shape error.
 * @private
 */
function validatePermissions(permissions, packageName, manifestPath) {
	if (!Arrays.isArray(permissions)) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", {
				field: "permissions",
				expected: t("MODULE_MANIFEST_EXPECTED_ARRAY_OF_RULE_OBJECTS")
			})
		});
	}
	for (let i = 0; i < permissions.length; i++) {
		const rule = permissions[i];
		if (!rule || typeof rule !== "object" || Arrays.isArray(rule)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_RULE", { index: i })
			});
		}
		if (typeof rule.caller !== "string" || rule.caller.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_CALLER", { index: i })
			});
		}
		if (typeof rule.target !== "string" || rule.target.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_TARGET", { index: i })
			});
		}
		if (!SetMethods.has(PERMISSION_EFFECT_VALUES, rule.effect)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_EFFECT", { index: i })
			});
		}
	}
}

/**
 * Validate the `events` array per the event-rule grammar (#407): `{caller, event, effect}` with
 * effect in deny/notify/allow. Mirrors {@link validatePermissions}.
 *
 * @param {unknown} events - Raw events value.
 * @param {string} packageName - Package name for error context.
 * @param {string} manifestPath - Manifest path for error context.
 * @returns {void}
 * @throws {SlothletError} MODULE_MANIFEST_INVALID on a malformed event rule.
 * @private
 */
function validateEventRules(events, packageName, manifestPath) {
	if (!Arrays.isArray(events)) {
		throw new SlothletError("MODULE_MANIFEST_INVALID", {
			package: packageName,
			manifest: manifestPath,
			reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "events", expected: t("MODULE_MANIFEST_EXPECTED_ARRAY_OF_RULE_OBJECTS") })
		});
	}
	for (let i = 0; i < events.length; i++) {
		const rule = events[i];
		if (!rule || typeof rule !== "object" || Arrays.isArray(rule)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_RULE", { index: i })
			});
		}
		if (typeof rule.caller !== "string" || rule.caller.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_PERMISSION_CALLER", { index: i })
			});
		}
		if (typeof rule.event !== "string" || rule.event.length === 0) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_EVENT_NAME", { index: i })
			});
		}
		if (!SetMethods.has(EVENT_EFFECT_VALUES, rule.effect)) {
			throw new SlothletError("MODULE_MANIFEST_INVALID", {
				package: packageName,
				manifest: manifestPath,
				reason: t("MODULE_MANIFEST_REASON_EVENT_EFFECT", { index: i })
			});
		}
	}
}
