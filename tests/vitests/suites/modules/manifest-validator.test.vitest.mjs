/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/modules/manifest-validator.test.vitest.mjs
 *	@Date: 2026-05-27T11:22:33-07:00 (1779906153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T17:25:48-08:00 (1794878748)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Tests for the pure module manifest validator.
 *
 * @description
 * Pure function — no slothlet instance needed, no matrix. Covers every
 * MODULE_* validation rule the validator can throw, plus the normalization
 * contract (defaults applied, package.json fallbacks for name/version,
 * description override semantics, mount segment normalization).
 *
 * @module tests/vitests/suites/modules/manifest-validator
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { validateModuleManifest } from "#helpers/module-manifest-validator";

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
		schema: 2,
		mount: ["drivers", "sample"],
		base: "./dist/api",
		...overrides
	};
}

// ─── Happy paths ─────────────────────────────────────────────────────────────

describe("validateModuleManifest — happy paths", () => {
	it("accepts a minimal manifest with only required fields", () => {
		const result = validateModuleManifest(makeMinimalManifest(), makeContext());
		expect(result.schema).toBe(2);
		expect(result.mount).toEqual(["drivers", "sample"]);
		expect(result.base).toBe("./dist/api");
		expect(result.name).toBe("@org/sample-driver"); // from package.json
		expect(result.version).toBe("1.4.2"); // from package.json
		expect(result.description).toBe("package.json description"); // fallback
		expect(result.priority).toBe(0); // default
	});

	it("accepts a fully-populated manifest and normalizes it", () => {
		const result = validateModuleManifest(
			{
				schema: 2,
				name: "@org/sample-driver",
				version: "1.4.2",
				description: "manifest override description",
				mount: ["drivers", "sample"],
				base: "./dist/api",
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

	it("normalizes a string mount into an array of segments", () => {
		const result = validateModuleManifest(makeMinimalManifest({ mount: "drivers.sample" }), makeContext());
		expect(result.mount).toEqual(["drivers", "sample"]);
	});

	it("preserves an array mount as-is", () => {
		const result = validateModuleManifest(makeMinimalManifest({ mount: ["a", "b", "c"] }), makeContext());
		expect(result.mount).toEqual(["a", "b", "c"]);
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
		expect(() => validateModuleManifest({ ...makeMinimalManifest(), priorty: 100 }, makeContext())).toThrowError(
			/MODULE_MANIFEST_UNKNOWN_FIELD/
		);
	});

	it("UNKNOWN_FIELD error names the offending key in context", () => {
		try {
			validateModuleManifest({ ...makeMinimalManifest(), bogus: true }, makeContext());
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_UNKNOWN_FIELD");
			expect(err.context.field).toBe("bogus");
			// the manifest path must stay in context so the error names which manifest file had the bad key.
			expect(err.context.manifest).toBe(path.join(TEST_PACKAGE_ROOT, "slothlet.module.json"));
		}
	});
});

// ─── schema (format 2) and format 1 ─────────────────────────────────────────

describe("validateModuleManifest — schema", () => {
	it("throws MODULE_MANIFEST_INVALID when schema missing", () => {
		const { schema: ___schema, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_FORMAT_UNSUPPORTED when schema is 3", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ schema: 3 }), makeContext())).toThrowError(
			/MODULE_MANIFEST_FORMAT_UNSUPPORTED/
		);
	});

	it("throws MODULE_MANIFEST_FORMAT_UNSUPPORTED when schema is 1 (the format 1 value is schemaVersion)", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ schema: 1 }), makeContext())).toThrowError(
			/MODULE_MANIFEST_FORMAT_UNSUPPORTED/
		);
	});

	it("throws MODULE_MANIFEST_FORMAT_UNSUPPORTED when schema is a string '2'", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ schema: "2" }), makeContext())).toThrowError(
			/MODULE_MANIFEST_FORMAT_UNSUPPORTED/
		);
	});

	it("MODULE_MANIFEST_FORMAT_UNSUPPORTED names the package and the schema in context", () => {
		try {
			validateModuleManifest(makeMinimalManifest({ schema: 3 }), makeContext());
			expect.unreachable();
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_FORMAT_UNSUPPORTED");
			expect(err.context.package).toBe("@org/sample-driver");
			expect(err.context.schema).toBe("3");
		}
	});
});

describe("validateModuleManifest — format 1 (deprecated)", () => {
	const format1 = (overrides = {}) => ({ schemaVersion: 1, mountPath: ["drivers", "sample"], apiDir: "./dist/api", ...overrides });

	it("reads a format 1 manifest and returns it under the format 2 names", () => {
		const result = validateModuleManifest(format1(), makeContext());
		expect(result.schema).toBe(2);
		expect(result.mount).toEqual(["drivers", "sample"]);
		expect(result.base).toBe("./dist/api");
		expect(result).not.toHaveProperty("schemaVersion");
		expect(result).not.toHaveProperty("mountPath");
		expect(result).not.toHaveProperty("apiDir");
	});

	it("applies the same checks under the format 1 names (reserved root)", () => {
		expect(() => validateModuleManifest(format1({ mountPath: ["slothlet"] }), makeContext())).toThrowError(/MODULE_RESERVED_MOUNT/);
	});

	it("names the format 1 field in the shape error", () => {
		try {
			validateModuleManifest(format1({ mountPath: "" }), makeContext());
			expect.unreachable();
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_INVALID");
			expect(err.context.reason).toContain("mountPath");
		}
	});

	it("throws MODULE_MANIFEST_FORMAT_UNSUPPORTED when schemaVersion is not 1", () => {
		expect(() => validateModuleManifest(format1({ schemaVersion: 2 }), makeContext())).toThrowError(/MODULE_MANIFEST_FORMAT_UNSUPPORTED/);
	});

	it.each([
		["schemaVersion with schema", { schema: 2 }],
		["mountPath with mount", { mount: ["a"] }],
		["apiDir with base", { base: "./api" }]
	])("throws MODULE_MANIFEST_INVALID when a manifest mixes format 1 and format 2 names (%s)", (_label, extra) => {
		try {
			validateModuleManifest(format1(extra), makeContext());
			expect.unreachable();
		} catch (err) {
			expect(err.code).toBe("MODULE_MANIFEST_INVALID");
			expect(err.context.reason).toMatch(/format 2.*format 1/);
		}
	});
});

// ─── mount ───────────────────────────────────────────────────────────────

describe("validateModuleManifest — mount", () => {
	it("throws MODULE_MANIFEST_INVALID when mount missing", () => {
		const { mount: ___mountPath, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mount is an empty string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: "" }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mount is an empty array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: [] }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mount array has non-string segment", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: ["a", 42] }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mount array has empty-string segment", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: ["a", ""] }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when mount is a number", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it.each(["slothlet", "shutdown", "destroy"])("throws MODULE_RESERVED_MOUNT when mount root is '%s'", (reserved) => {
		expect(() => validateModuleManifest(makeMinimalManifest({ mount: [reserved, "x"] }), makeContext())).toThrowError(
			/MODULE_RESERVED_MOUNT/
		);
	});

	it("MODULE_RESERVED_MOUNT error names the reserved root in context", () => {
		try {
			validateModuleManifest(makeMinimalManifest({ mount: "slothlet.x" }), makeContext());
		} catch (err) {
			expect(err.code).toBe("MODULE_RESERVED_MOUNT");
			expect(err.context.mount).toEqual(["slothlet", "x"]);
			expect(err.message).toContain("(slothlet.x)"); // segments read dotted in the message
		}
	});
});

// ─── base ──────────────────────────────────────────────────────────────────

describe("validateModuleManifest — base", () => {
	it("throws MODULE_MANIFEST_INVALID when base missing", () => {
		const { base: ___apiDir, ...rest } = makeMinimalManifest();
		expect(() => validateModuleManifest(rest, makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when base is empty string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ base: "" }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when base is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ base: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_PATH_TRAVERSAL when base escapes packageRoot via ..", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ base: "../escape" }), makeContext())).toThrowError(/MODULE_PATH_TRAVERSAL/);
	});

	it("throws MODULE_PATH_TRAVERSAL when base is an absolute path outside packageRoot", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ base: "/etc/passwd" }), makeContext())).toThrowError(/MODULE_PATH_TRAVERSAL/);
	});

	it("accepts base as a deep relative path inside packageRoot", () => {
		const result = validateModuleManifest(makeMinimalManifest({ base: "./dist/api/v2" }), makeContext());
		expect(result.base).toBe("./dist/api/v2");
	});

	it("accepts base as a bare directory name", () => {
		const result = validateModuleManifest(makeMinimalManifest({ base: "api" }), makeContext());
		expect(result.base).toBe("api");
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
			expect(err.context.package).toBe("@org/sample-driver");
			expect(err.context.received).toBe("@org/forked");
			expect(err.context.expected).toBe("@org/sample-driver");
		}
	});
});

// ─── kind / priority ─────────────────────────────────────────────────────────

describe("validateModuleManifest — kind / priority", () => {
	it("throws MODULE_MANIFEST_INVALID when kind is not a string", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ kind: 42 }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when priority is not a number", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ priority: "high" }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
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
		expect(() => validateModuleManifest(makeMinimalManifest({ dependencies: [] }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
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
		expect(() => validateModuleManifest(makeMinimalManifest({ permissions: {} }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing caller", () => {
		expect(() =>
			validateModuleManifest(makeMinimalManifest({ permissions: [{ target: "x", effect: "allow" }] }), makeContext())
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing target", () => {
		expect(() =>
			validateModuleManifest(makeMinimalManifest({ permissions: [{ caller: "x", effect: "allow" }] }), makeContext())
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when effect is neither allow nor deny", () => {
		expect(() =>
			validateModuleManifest(makeMinimalManifest({ permissions: [{ caller: "x", target: "y", effect: "maybe" }] }), makeContext())
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

// ─── events (#407) ──────────────────────────────────────────────────────────

describe("validateModuleManifest — events", () => {
	it("throws MODULE_MANIFEST_INVALID when events is not an array", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ events: {} }), makeContext())).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is not a plain object", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ events: ["not-an-object"] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is an array instead of an object", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ events: [["caller", "event", "allow"]] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing caller", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ events: [{ event: "x", effect: "allow" }] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when a rule is missing event", () => {
		expect(() => validateModuleManifest(makeMinimalManifest({ events: [{ caller: "x", effect: "allow" }] }), makeContext())).toThrowError(
			/MODULE_MANIFEST_INVALID/
		);
	});

	it("throws MODULE_MANIFEST_INVALID when effect is neither deny, notify, nor allow", () => {
		expect(() =>
			validateModuleManifest(makeMinimalManifest({ events: [{ caller: "x", event: "y", effect: "maybe" }] }), makeContext())
		).toThrowError(/MODULE_MANIFEST_INVALID/);
	});

	it("accepts a mix of deny, notify, and allow rules", () => {
		const result = validateModuleManifest(
			makeMinimalManifest({
				events: [
					{ caller: "a.**", event: "impl:created", effect: "deny" },
					{ caller: "b.**", event: "impl:changed", effect: "notify" },
					{ caller: "c.**", event: "materialized:complete", effect: "allow" }
				]
			}),
			makeContext()
		);
		expect(result.events).toHaveLength(3);
	});

	it("accepts empty events array", () => {
		const result = validateModuleManifest(makeMinimalManifest({ events: [] }), makeContext());
		expect(result.events).toEqual([]);
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
