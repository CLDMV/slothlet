/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/manifest-validator.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 */

/**
 * @fileoverview Tests for the pure module manifest validator.
 *
 * @description
 * Pure function — no slothlet instance needed, no matrix. Covers every
 * MODULE_* validation rule the validator can throw, plus the normalization
 * contract (defaults applied, package.json fallbacks for name/version,
 * description override semantics, mountPath segment normalization).
 *
 * @module tests/vitests/suites/modules/manifest-validator
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { validateModuleManifest } from "../../../../src/lib/helpers/module-manifest-validator.mjs";

const TEST_PACKAGE_ROOT = "/srv/repos/slothlet/tests/vitests/suites/modules";

function makeContext(overrides = {}) {
	return {
		packageName: "@org/sample-driver",
		packageVersion: "1.4.2",
		packageDescription: "package.json description",
		packageRoot: TEST_PACKAGE_ROOT,
		manifestPath: path.join(TEST_PACKAGE_ROOT, "slothlet.module.json"),
		...overrides
	};
}

function makeMinimalManifest(overrides = {}) {
	return {
		schemaVersion: 1,
		mountPath: ["drivers", "sample"],
		apiDir: "./dist/api",
		...overrides
	};
}

// ─── Happy paths ─────────────────────────────────────────────────────────────

describe("validateModuleManifest — happy paths", () => {
	it("accepts a minimal manifest with only required fields", () => {
		const result = validateModuleManifest(makeMinimalManifest(), makeContext());
		expect(result.schemaVersion).toBe(1);
		expect(result.mountPath).toEqual(["drivers", "sample"]);
		expect(result.apiDir).toBe("./dist/api");
		expect(result.name).toBe("@org/sample-driver"); // from package.json
		expect(result.version).toBe("1.4.2"); // from package.json
		expect(result.description).toBe("package.json description"); // fallback
		expect(result.priority).toBe(0); // default
	});

	it("accepts a fully-populated manifest and normalizes it", () => {
		const result = validateModuleManifest(
			{
				schemaVersion: 1,
				name: "@org/sample-driver",
				version: "1.4.2",
				description: "manifest override description",
				mountPath: ["drivers", "sample"],
				apiDir: "./dist/api",
				kind: "driver",
				priority: 100,
				dependencies: { "@org/core": "^2.0.0" },
				permissions: [{ caller: "pipeline.**", target: "drivers.sample.**", effect: "allow" }],
				metadata: { tags: ["a", "b"] }
			},
			makeContext()
		);
		expect(result.kind).toBe("driver");
		expect(result.priority).toBe(100);
		expect(result.description).toBe("manifest override description"); // override
		expect(result.dependencies).toEqual({ "@org/core": "^2.0.0" });
		expect(result.permissions).toEqual([{ caller: "pipeline.**", target: "drivers.sample.**", effect: "allow" }]);
		expect(result.metadata).toEqual({ tags: ["a", "b"] });
	});

	it("normalizes a string mountPath into an array of segments", () => {
		const result = validateModuleManifest(makeMinimalManifest({ mountPath: "drivers.sample" }), makeContext());
		expect(result.mountPath).toEqual(["drivers", "sample"]);
	});

	it("preserves an array mountPath as-is", () => {
		const result = validateModuleManifest(makeMinimalManifest({ mountPath: ["a", "b", "c"] }), makeContext());
		expect(result.mountPath).toEqual(["a", "b", "c"]);
	});

	it("falls back to package.json description when manifest omits it", () => {
		const result = validateModuleManifest(makeMinimalManifest(), makeContext({ packageDescription: "from pkg" }));
		expect(result.description).toBe("from pkg");
	});

	it("manifest description silently overrides package.json description (no error)", () => {
		const result = validateModuleManifest(
			makeMinimalManifest({ description: "manifest wins" }),
			makeContext({ packageDescription: "pkg loses" })
		);
		expect(result.description).toBe("manifest wins");
	});

	it("allows manifest name when it matches package.json exactly", () => {
		const result = validateModuleManifest(makeMinimalManifest({ name: "@org/sample-driver" }), makeContext());
		expect(result.name).toBe("@org/sample-driver");
	});

	it("allows manifest version when it matches package.json exactly", () => {
		const result = validateModuleManifest(makeMinimalManifest({ version: "1.4.2" }), makeContext());
		expect(result.version).toBe("1.4.2");
	});
});

// ─── Top-level shape errors ─────────────────────────────────────────────────

describe("validateModuleManifest — top-level shape", () => {
	it("throws MODULE_MANIFEST_INVALID when manifest is null", () => {
		expect(() => validateModuleManifest(null, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when manifest is an array", () => {
		expect(() => validateModuleManifest([], makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when manifest is a string", () => {
		expect(() => validateModuleManifest("not an object", makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_UNKNOWN_FIELD on unrecognized top-level fields", () => {
		expect(() =>
			validateModuleManifest({ ...makeMinimalManifest(), priorty: 100 }, makeContext())
		).toThrowError(/MODULE_MANIFEST_UNKNOWN_FIELD/);
	});

	it("UNKNOWN_FIELD error names the offending key in context", () => {
		try {
			validateModuleManifest({ ...makeMinimalManifest(), bogus: true }, makeContext());
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_UNKNOWN_FIELD");
			expect(err.context.field).toBe("bogus");
		}
	});
});

// ─── schemaVersion ──────────────────────────────────────────────────────────

describe("validateModuleManifest — schemaVersion", () => {
	it("throws MODULE_MANIFEST_INVALID when schemaVersion missing", () => {
		const { schemaVersion: ___schemaVersion, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_VERSION_UNSUPPORTED when schemaVersion is 2", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ schemaVersion: 2 }), makeContext())).toThrowError(
			/MODULE_VERSION_UNSUPPORTED/
		);
	});

	it("throws MODULE_VERSION_UNSUPPORTED when schemaVersion is a string '1'", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ schemaVersion: "1" }), makeContext())).toThrowError(
			/MODULE_VERSION_UNSUPPORTED/
		);
	});
});

// ─── mountPath ───────────────────────────────────────────────────────────────

describe("validateModuleManifest — mountPath", () => {
	it("throws MODULE_MANIFEST_INVALID when mountPath missing", () => {
		const { mountPath: ___mountPath, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mountPath is an empty string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: "" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when mountPath is an empty array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: [] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when mountPath array has non-string segment", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: ["a", 42] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when mountPath array has empty-string segment", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: ["a", ""] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when mountPath is a number", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: 42 }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it.each(["slothlet", "shutdown", "destroy"])(
		"throws MODULE_RESERVED_MOUNTPATH when mountPath root is '%s'",
		(reserved) => {
			expect(() => validateModuleManifest(makeMinimalManifest({ mountPath: [reserved, "x"] }), makeContext())).toThrowError(
				/MODULE_RESERVED_MOUNTPATH/
			);
		}
	);

	it("MODULE_RESERVED_MOUNTPATH error names the reserved root in context", () => {
		try {
			validateModuleManifest(makeMinimalManifest({ mountPath: "slothlet.x" }), makeContext());
		} catch (err) {
			expect(err.code).toBe("MODULE_RESERVED_MOUNTPATH");
			expect(err.context.mountPathRoot).toBe("slothlet");
		}
	});
});

// ─── apiDir ──────────────────────────────────────────────────────────────────

describe("validateModuleManifest — apiDir", () => {
	it("throws MODULE_MANIFEST_INVALID when apiDir missing", () => {
		const { apiDir: ___apiDir, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when apiDir is empty string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ apiDir: "" }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when apiDir is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ apiDir: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_PATH_TRAVERSAL when apiDir escapes packageRoot via ..", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ apiDir: "../escape" }), makeContext())).toThrowError(
			/MODULE_PATH_TRAVERSAL/
		);
	});

	it("throws MODULE_PATH_TRAVERSAL when apiDir is an absolute path outside packageRoot", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ apiDir: "/etc/passwd" }), makeContext())).toThrowError(
			/MODULE_PATH_TRAVERSAL/
		);
	});

	it("accepts apiDir as a deep relative path inside packageRoot", () => {
		const result = validateModuleManifest(makeMinimalManifest({ apiDir: "./dist/api/v2" }), makeContext());
		expect(result.apiDir).toBe("./dist/api/v2");
	});

	it("accepts apiDir as a bare directory name", () => {
		const result = validateModuleManifest(makeMinimalManifest({ apiDir: "api" }), makeContext());
		expect(result.apiDir).toBe("api");
	});
});

// ─── name / version mismatch ─────────────────────────────────────────────────

describe("validateModuleManifest — name / version mismatch", () => {
	it("throws MODULE_MANIFEST_NAME_MISMATCH when manifest name differs from package.json", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ name: "@org/different" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_NAME_MISMATCH/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when name is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ name: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_VERSION_MISMATCH when manifest version differs from package.json", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ version: "2.0.0" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_VERSION_MISMATCH/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when version is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ version: 1 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("MODULE_MANIFEST_NAME_MISMATCH includes both names in context", () => {
		try {
			validateModuleManifest(makeMinimalManifest({ name: "@org/forked" }), makeContext());
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_NAME_MISMATCH");
			expect(err.context.packageName).toBe("@org/sample-driver");
			expect(err.context.manifestName).toBe("@org/forked");
		}
	});
});

// ─── kind / priority ─────────────────────────────────────────────────────────

describe("validateModuleManifest — kind / priority", () => {
	it("throws MODULE_MANIFEST_INVALID when kind is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ kind: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when priority is not a number", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ priority: "high" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when priority is NaN", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ priority: NaN }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when priority is Infinity", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ priority: Infinity }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("accepts negative priority numbers", () => {
		const result = validateModuleManifest(makeMinimalManifest({ priority: -10 }), makeContext());
		expect(result.priority).toBe(-10);
	});
});

// ─── dependencies ────────────────────────────────────────────────────────────

describe("validateModuleManifest — dependencies", () => {
	it("throws MODULE_MANIFEST_INVALID when dependencies is an array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ dependencies: [] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when dependencies has a non-string value", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ dependencies: { "@org/foo": 1 } }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("accepts empty dependencies object", () => {
		const result = validateModuleManifest(makeMinimalManifest({ dependencies: {} }), makeContext());
		expect(result.dependencies).toEqual({});
	});
});

// ─── permissions ─────────────────────────────────────────────────────────────

describe("validateModuleManifest — permissions", () => {
	it("throws MODULE_MANIFEST_INVALID when permissions is not an array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ permissions: {} }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing caller", () => {
		expect(() =>
			validateModuleManifest(
				makeMinimalManifest({ permissions: [{ target: "x", effect: "allow" }] }),
				makeContext()
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing target", () => {
		expect(() =>
			validateModuleManifest(
				makeMinimalManifest({ permissions: [{ caller: "x", effect: "allow" }] }),
				makeContext()
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when effect is neither allow nor deny", () => {
		expect(() =>
			validateModuleManifest(
				makeMinimalManifest({ permissions: [{ caller: "x", target: "y", effect: "maybe" }] }),
				makeContext()
			)
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("accepts a mix of allow and deny rules", () => {
		const result = validateModuleManifest(
			makeMinimalManifest({
				permissions: [
					{ caller: "a.**", target: "b.**", effect: "allow" },
					{ caller: "c.**", target: "d.**", effect: "deny" }
				]
			}),
			makeContext()
		);
		expect(result.permissions).toHaveLength(2);
	});

	it("accepts empty permissions array", () => {
		const result = validateModuleManifest(makeMinimalManifest({ permissions: [] }), makeContext());
		expect(result.permissions).toEqual([]);
	});
});

// ─── metadata ────────────────────────────────────────────────────────────────

describe("validateModuleManifest — metadata", () => {
	it("throws MODULE_MANIFEST_INVALID when metadata is an array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ metadata: [] }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when metadata is a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ metadata: "not an object" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("accepts arbitrary nested data inside the metadata block", () => {
		const meta = { tags: ["a"], vendor: "cldmv", nested: { foo: { bar: [1, 2, 3] } } };
		const result = validateModuleManifest(makeMinimalManifest({ metadata: meta }), makeContext());
		expect(result.metadata).toEqual(meta);
	});

	it("accepts an empty metadata object", () => {
		const result = validateModuleManifest(makeMinimalManifest({ metadata: {} }), makeContext());
		expect(result.metadata).toEqual({});
	});
});
