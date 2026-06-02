/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-suffix-syntax.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hook registration syntax (#118): the canonical suffix form `pattern:type`
 * (e.g. `"math.add:before"`) plus the deprecated-but-accepted legacy prefix form `type:pattern`
 * (e.g. `"before:math.add"`), which still works but emits a `HOOK_TYPEPATTERN_PREFIX_DEPRECATED`
 * warning carrying the suggested suffix form. Detection prefers the trailing type; the prefix path
 * is taken only when the leading token is a type and the trailing one is not.
 *
 * @module tests/vitests/suites/hooks/hooks-suffix-syntax
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;
const DEP = "HOOK_TYPEPATTERN_PREFIX_DEPRECATED";

describe.each(getMatrixConfigs())("Hooks > suffix syntax + prefix deprecation (#118) > $name", ({ config }) => {
	let api;

	beforeEach(() => {
		SlothletWarning.suppressConsole = true;
		SlothletWarning.clearCaptured();
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		SlothletWarning.clearCaptured();
	});

	const deps = () => SlothletWarning.captured.filter((w) => w.code === DEP);

	it("canonical suffix `pattern:type` registers and fires (no warning)", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		let seen = null;
		api.slothlet.hook.on("math.add:before", ({ path }) => {
			seen = path;
		});
		await api.math.add(2, 3);
		expect(seen).toBe("math.add");
		expect(deps()).toHaveLength(0);
	});

	it("legacy prefix `type:pattern` still fires but warns with the suffix suggestion", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		let seen = null;
		api.slothlet.hook.on("before:math.add", ({ path }) => {
			seen = path;
		});
		await api.math.add(1, 1);
		expect(seen).toBe("math.add"); // still works
		const d = deps();
		expect(d).toHaveLength(1);
		expect(d[0].context.given).toBe("before:math.add");
		expect(d[0].context.suggested).toBe("math.add:before");
	});

	it("`silent: true` suppresses the prefix deprecation warning", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true, silent: true });
		api.slothlet.hook.on("before:math.add", () => {});
		expect(deps()).toHaveLength(0);
	});

	it("suffix interpretation wins for an ambiguous `type:type` input", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		const id = api.slothlet.hook.on("before:after", () => {});
		const { registeredHooks } = api.slothlet.hook.list({ id });
		expect(registeredHooks[0].type).toBe("after"); // trailing token wins
		expect(registeredHooks[0].pattern).toBe("before"); // path pattern is "before"
		expect(deps()).toHaveLength(0); // resolved as suffix → no deprecation
	});

	it("rejects a pattern with no colon", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		expect(() => api.slothlet.hook.on("math.add", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects a pattern whose ends are not a hook type", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		expect(() => api.slothlet.hook.on("foo:bar", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects an empty path pattern in suffix and prefix forms", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		expect(() => api.slothlet.hook.on(":before", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
		expect(() => api.slothlet.hook.on("before:", () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("rejects a non-string typePattern", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true });
		expect(() => api.slothlet.hook.on(123, () => {})).toThrow(/INVALID_TYPE_PATTERN/);
	});

	it("reload re-registers hooks in suffix form without re-deprecating", async () => {
		api = await slothlet({ ...config, base: BASE, hook: true, api: { mutations: { reload: true } } });
		api.slothlet.hook.on("math.add:before", () => {}); // canonical suffix
		SlothletWarning.clearCaptured();
		await api.slothlet.reload();
		expect(deps()).toHaveLength(0); // exportHooks emits suffix → replay does not warn
	});
});
