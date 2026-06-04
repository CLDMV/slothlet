/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/module-manifest-validator.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 18:57:20 -07:00 (1779933440)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
 * The reserved-mountPath list (`slothlet`, `shutdown`, `destroy`) is hardcoded
 * to mirror `normalizeApiPath` in `src/lib/handlers/api-manager.mjs`. If
 * slothlet ever adds reserved roots, both lists must stay in sync.
 */

import { SlothletError } from "@cldmv/slothlet/errors";
import { t } from "@cldmv/slothlet/i18n";

// Node-only static import resolved via top-level await so `node:path` never
// enters the static-import graph in browser bundles. Methods that consume
// `path` (mountPath/apiDir validation) are Node-only — never invoked in
// browser mode because slothlet's browser path skips filesystem validation.
// path resolved in the platform module (#123); null in a browser — slothlet's browser path skips
// filesystem manifest validation.
import { path } from "@cldmv/slothlet/helpers/platform";

/**
 * Reserved mountPath root segments. Mirror of the list in
 * `src/lib/handlers/api-manager.mjs` `normalizeApiPath()`. Any addition there
 * must be reflected here so module discovery rejects reserved-root claims at
 * the manifest layer instead of letting `api.add()` throw downstream.
 * @type {ReadonlySet<string>}
 */
const RESERVED_MOUNTPATH_ROOTS = Object.freeze(new Set(["slothlet", "shutdown", "destroy"]));

/**
 * Allowed top-level fields in `slothlet.module.json`. Anything else throws
 * `MODULE_MANIFEST_UNKNOWN_FIELD` per the strict-schema decision in the design.
 * @type {ReadonlySet<string>}
 */
const ALLOWED_TOP_LEVEL_FIELDS = Object.freeze(
	new Set(["schemaVersion", "name", "version", "description", "mountPath", "apiDir", "kind", "priority", "dependencies", "permissions", "metadata"])
);

/**
 * Allowed effect values for permission rules.
 * @type {ReadonlySet<string>}
 */
const PERMISSION_EFFECT_VALUES = Object.freeze(new Set(["allow", "deny"]));

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
 *   - `mountPath` normalized to an array of segments
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
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName: packageContext?.packageName ?? "<unknown>",
				manifestPath: packageContext?.manifestPath ?? "<unknown>",
				reason: t("MODULE_MANIFEST_REASON_NOT_OBJECT")
			},
			null,
			{ validationError: true }
		);
	}

	const { packageName, packageVersion, packageDescription, packageRoot, manifestPath } = packageContext;

	// Reject unknown top-level fields BEFORE other validation so users see typos
	// in field names rather than misleading "missing required field" errors.
	for (const key of Object.keys(manifest)) {
		if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
			throw new SlothletError(
				"MODULE_MANIFEST_UNKNOWN_FIELD",
				{
					packageName,
					field: key
				},
				null,
				{ validationError: true }
			);
		}
	}

	// schemaVersion: required, must be 1
	if (manifest.schemaVersion === undefined) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: "schemaVersion" })
			},
			null,
			{ validationError: true }
		);
	}
	if (manifest.schemaVersion !== 1) {
		throw new SlothletError(
			"MODULE_VERSION_UNSUPPORTED",
			{
				packageName,
				schemaVersion: String(manifest.schemaVersion)
			},
			null,
			{ validationError: true }
		);
	}

	// mountPath: required, string or non-empty array of non-empty strings
	if (manifest.mountPath === undefined) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: "mountPath" })
			},
			null,
			{ validationError: true }
		);
	}
	const mountPathSegments = normalizeMountPath(manifest.mountPath, packageName, manifestPath);

	// Reserved-mountPath root check (G3) — runs at manifest layer, not downstream.
	if (RESERVED_MOUNTPATH_ROOTS.has(mountPathSegments[0])) {
		throw new SlothletError(
			"MODULE_RESERVED_MOUNTPATH",
			{
				packageName,
				mountPathRoot: mountPathSegments[0],
				mountPath: mountPathSegments.join(".")
			},
			null,
			{ validationError: true }
		);
	}

	// apiDir: required, string, lexically inside packageRoot
	if (manifest.apiDir === undefined) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_MISSING_FIELD", { field: "apiDir" })
			},
			null,
			{ validationError: true }
		);
	}
	if (typeof manifest.apiDir !== "string" || manifest.apiDir.length === 0) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "apiDir", expected: "a non-empty string" })
			},
			null,
			{ validationError: true }
		);
	}
	validateApiDirContainment(manifest.apiDir, packageRoot, packageName);

	// name: optional in manifest; if present, MUST match package.json's name.
	if (manifest.name !== undefined) {
		if (typeof manifest.name !== "string") {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "name", expected: "a string" })
				},
				null,
				{ validationError: true }
			);
		}
		if (manifest.name !== packageName) {
			throw new SlothletError(
				"MODULE_MANIFEST_NAME_MISMATCH",
				{
					packageName,
					manifestName: manifest.name
				},
				null,
				{ validationError: true }
			);
		}
	}

	// version: optional in manifest; if present, MUST match package.json's version.
	if (manifest.version !== undefined) {
		if (typeof manifest.version !== "string") {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "version", expected: "a string" })
				},
				null,
				{ validationError: true }
			);
		}
		if (manifest.version !== packageVersion) {
			throw new SlothletError(
				"MODULE_MANIFEST_VERSION_MISMATCH",
				{
					packageName,
					manifestVersion: manifest.version,
					packageVersion
				},
				null,
				{ validationError: true }
			);
		}
	}

	// description: optional; manifest overrides package.json silently.
	if (manifest.description !== undefined && typeof manifest.description !== "string") {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "description", expected: "a string" })
			},
			null,
			{ validationError: true }
		);
	}

	// kind: optional, free-form string
	if (manifest.kind !== undefined && typeof manifest.kind !== "string") {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "kind", expected: "a string" })
			},
			null,
			{ validationError: true }
		);
	}

	// priority: optional, number, defaults to 0
	if (manifest.priority !== undefined && (typeof manifest.priority !== "number" || !Number.isFinite(manifest.priority))) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "priority", expected: "a finite number" })
			},
			null,
			{ validationError: true }
		);
	}

	// dependencies: optional, object with string values
	if (manifest.dependencies !== undefined) {
		if (typeof manifest.dependencies !== "object" || manifest.dependencies === null || Array.isArray(manifest.dependencies)) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "dependencies", expected: "a plain object" })
				},
				null,
				{ validationError: true }
			);
		}
		for (const [depName, depValue] of Object.entries(manifest.dependencies)) {
			if (typeof depValue !== "string") {
				throw new SlothletError(
					"MODULE_MANIFEST_INVALID",
					{
						packageName,
						manifestPath,
						reason: t("MODULE_MANIFEST_REASON_DEPENDENCY_TYPE", { dependency: depName })
					},
					null,
					{ validationError: true }
				);
			}
		}
	}

	// permissions: optional, array of {caller, target, effect} rules
	if (manifest.permissions !== undefined) {
		validatePermissions(manifest.permissions, packageName, manifestPath);
	}

	// metadata: optional, plain object (free-form contents allowed inside)
	if (manifest.metadata !== undefined) {
		if (typeof manifest.metadata !== "object" || manifest.metadata === null || Array.isArray(manifest.metadata)) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "metadata", expected: "a plain object" })
				},
				null,
				{ validationError: true }
			);
		}
	}

	// All validations passed — return the normalized manifest.
	return {
		schemaVersion: 1,
		name: packageName,
		version: packageVersion,
		description: manifest.description ?? packageDescription,
		mountPath: mountPathSegments,
		apiDir: manifest.apiDir,
		kind: manifest.kind,
		priority: manifest.priority ?? 0,
		dependencies: manifest.dependencies,
		permissions: manifest.permissions,
		metadata: manifest.metadata
	};
}

/**
 * Normalize `mountPath` to a non-empty array of non-empty segments.
 * @param {unknown} mountPath - Raw manifest value.
 * @param {string} packageName - For error context.
 * @param {string} manifestPath - For error context.
 * @returns {string[]} Normalized segments.
 * @throws {SlothletError} `MODULE_MANIFEST_INVALID` on shape error.
 * @private
 */
function normalizeMountPath(mountPath, packageName, manifestPath) {
	if (typeof mountPath === "string") {
		if (mountPath.length === 0) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_MOUNTPATH_SHAPE")
				},
				null,
				{ validationError: true }
			);
		}
		return mountPath.split(".");
	}
	if (Array.isArray(mountPath)) {
		if (mountPath.length === 0) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_MOUNTPATH_SHAPE")
				},
				null,
				{ validationError: true }
			);
		}
		for (const segment of mountPath) {
			if (typeof segment !== "string" || segment.length === 0) {
				throw new SlothletError(
					"MODULE_MANIFEST_INVALID",
					{
						packageName,
						manifestPath,
						reason: t("MODULE_MANIFEST_REASON_MOUNTPATH_ENTRIES")
					},
					null,
					{ validationError: true }
				);
			}
		}
		return mountPath.slice();
	}
	throw new SlothletError(
		"MODULE_MANIFEST_INVALID",
		{
			packageName,
			manifestPath,
			reason: t("MODULE_MANIFEST_REASON_MOUNTPATH_SHAPE")
		},
		null,
		{ validationError: true }
	);
}

/**
 * Verify `apiDir` lexically resolves inside `packageRoot`. Does not touch the
 * filesystem — symlink/realpath checks belong in `discover()`.
 * @param {string} apiDir - Raw apiDir value from manifest.
 * @param {string} packageRoot - Absolute filesystem path to package root.
 * @param {string} packageName - For error context.
 * @throws {SlothletError} `MODULE_PATH_TRAVERSAL` if apiDir escapes the root.
 * @private
 */
function validateApiDirContainment(apiDir, packageRoot, packageName) {
	const resolved = path.resolve(packageRoot, apiDir);
	const rootWithSep = packageRoot.endsWith(path.sep) ? packageRoot : packageRoot + path.sep;
	if (resolved !== packageRoot && !resolved.startsWith(rootWithSep)) {
		throw new SlothletError(
			"MODULE_PATH_TRAVERSAL",
			{
				packageName,
				apiDir,
				resolvedPath: resolved,
				packageRoot
			},
			null,
			{ validationError: true }
		);
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
	if (!Array.isArray(permissions)) {
		throw new SlothletError(
			"MODULE_MANIFEST_INVALID",
			{
				packageName,
				manifestPath,
				reason: t("MODULE_MANIFEST_REASON_FIELD_TYPE", { field: "permissions", expected: "an array of rule objects" })
			},
			null,
			{ validationError: true }
		);
	}
	for (let i = 0; i < permissions.length; i++) {
		const rule = permissions[i];
		if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_PERMISSION_RULE", { index: i })
				},
				null,
				{ validationError: true }
			);
		}
		if (typeof rule.caller !== "string" || rule.caller.length === 0) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_PERMISSION_CALLER", { index: i })
				},
				null,
				{ validationError: true }
			);
		}
		if (typeof rule.target !== "string" || rule.target.length === 0) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_PERMISSION_TARGET", { index: i })
				},
				null,
				{ validationError: true }
			);
		}
		if (!PERMISSION_EFFECT_VALUES.has(rule.effect)) {
			throw new SlothletError(
				"MODULE_MANIFEST_INVALID",
				{
					packageName,
					manifestPath,
					reason: t("MODULE_MANIFEST_REASON_PERMISSION_EFFECT", { index: i })
				},
				null,
				{ validationError: true }
			);
		}
	}
}
