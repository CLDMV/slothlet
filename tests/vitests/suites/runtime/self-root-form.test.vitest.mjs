/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-root-form.test.vitest.mjs
 *	@Date: 2026-11-15T17:13:59-08:00 (1794791639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:26-08:00 (1794882626)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's `self` takes the form the host's `api` takes for the same instance (#803).
 *
 * @description
 * For a function root (`root.mjs` exporting a function, an async arrow among them) `self` is callable as `api` is:
 * `typeof`, `Object.prototype.toString`, `instanceof`, the prototype, and a call or construction of it, by every route.
 * For an object root it stays an object. Each operation is run on `self` inside a module and on `api` in the host, and
 * the two answers are compared row by row (see `api_tests/api_test_self_parity/shape.mjs`).
 *
 * `JSON.stringify(self)` gives what `JSON.stringify(api)` gives the host, less the members the module is refused,
 * which are left out as a listing leaves them out and never thrown for; a read of such a member by name is still
 * refused (fixture `jsonroot`).
 */

import path from "node:path";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { readFileSync } from "node:fs";
// The host's own copy: run by the host, a file an instance loaded is taken for that module's code while a call of the
// instance is suspended (an async root's call, made by a row of the report).
import { shape } from "../../../../api_tests/api_test_self_parity/host/shape.mjs";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_self_parity");
const DENIED = "threw:PERMISSION_DENIED";

/** The rows a call or construction of the root answers. */
const CALL_ROWS = ["directCall", "reflectApply", "construct", "reflectConstruct", "dotCall", "dotApply", "bound"];

const CONFIGS = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

const ROOTS = [
	{ folder: "fnroot", typeof: "function", tag: "[object Function]" },
	{ folder: "asyncroot", typeof: "function", tag: "[object AsyncFunction]" },
	{ folder: "objroot", typeof: "object", tag: "[object Object]" }
];

const POLICIES = [
	// Off keeps the framework's built-in protections: a module is refused `slothlet.permissions.principal` and `control`.
	{ label: "permissions off", permissions: () => undefined, exact: false },
	{ label: "permissions disabled", permissions: () => ({ mode: "disabled" }), exact: true },
	{ label: "permissions on, default allow", permissions: (attribution) => ({ caller: { attribution } }), exact: false },
	{
		label: "permissions on, default deny, the probe allowed everything",
		permissions: (attribution) => ({
			caller: { attribution },
			policy: "deny",
			rules: [{ caller: "probe.**", target: "**", effect: "allow" }]
		}),
		exact: false
	}
];

/**
 * `util.inspect` with one member to a line, so a rendering that leaves members out is the full one less those lines.
 * @param {*} value - The value.
 * @returns {string} Its rendering.
 */
const inspect = (value) => util.inspect(value, { compact: false, depth: 3 });

/**
 * What `api` answers in the host.
 * @param {object} api - The api.
 * @returns {Record<string, *>} What each operation gave.
 */
const hostShape = (api) => shape(api, { inspect });

/**
 * What `self` answers inside the probe module.
 * @param {object} api - The api.
 * @returns {Promise<Record<string, *>>} What each operation gave.
 */
const moduleShape = (api) => api.probe.report(inspect);

/**
 * Whether one rendering is another less some of its lines, in the same order: what a module is shown of the api with
 * the members it may not read left out (#807). A line's trailing comma is not compared, since the last member shown
 * carries none.
 * @param {string} shown - The module's rendering.
 * @param {string} whole - The host's rendering.
 * @returns {boolean} True when `shown` is `whole` less some lines.
 */
const isWholeLessLines = (shown, whole) => {
	// An object every member of which is left out renders as `key: {}`: the host's `key: {` … `}` less its lines.
	const strip = (text) =>
		text
			.split("\n")
			.map((line) => line.replace(/,$/, ""))
			.flatMap((line) => (/: \{\}$/.test(line) ? [line.slice(0, -1), `${line.match(/^\s*/)[0]}}`] : [line]));
	const all = strip(whole);
	let at = 0;
	for (const line of strip(shown)) {
		while (at < all.length && all[at] !== line) at++;
		if (at === all.length) return false;
		at++;
	}
	return true;
};

/**
 * Compare `self`'s answers with `api`'s, permission checks aside (#803, #807): with the permission system disabled
 * they are the host's exactly; otherwise the rendering leaves out what the module may not read (with the system off,
 * the framework's built-in protections still apply), and every other answer is the host's.
 * @param {Record<string, *>} rows - The module's answers.
 * @param {Record<string, *>} host - The host's answers.
 * @param {boolean} exact - Whether the module may read all the host does.
 * @returns {void}
 */
const expectMirror = (rows, host, exact) => {
	if (exact) {
		expect(rows).toEqual(host);
		return;
	}
	const { inspect: shown, ...rest } = rows;
	const { inspect: whole, ...hostRest } = host;
	expect(rest).toEqual(hostRest);
	expect(isWholeLessLines(shown, whole)).toBe(true);
	expect(shown).toMatch(/\bmath: \{/);
	expect(shown).toMatch(/\bprobe: \{/);
};

it("the host's copy of the report is the modules' copy", () => {
	const code = (file) => readFileSync(path.join(FIXTURE, file), "utf8").split("\nexport function shape")[1];
	expect(code("host/shape.mjs")).toBe(code("shape.mjs"));
});

describe.each(CONFIGS)("a module's self takes the api root's form > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(ROOTS)("root $folder", (root) => {
		describe.each(POLICIES)("$label", (policy) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: path.join(FIXTURE, root.folder),
					mode,
					runtime,
					silent: true,
					permissions: policy.permissions(attribution)
				});
			}, 60000);

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			}, 60000);

			it("self answers every operation as the host's api does, less what the module may not read", async () => {
				expectMirror(await moduleShape(api), hostShape(api), policy.exact);
			});

			it("self is of the root's kind", async () => {
				const rows = await moduleShape(api);
				expect(rows.typeof).toBe(root.typeof);
				expect(rows.toStringTag).toBe(root.tag);
				expect(rows.mathAdd).toBe(5);
			});
		});

		describe("permissions on, the probe refused the root", () => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: path.join(FIXTURE, root.folder),
					mode,
					runtime,
					silent: true,
					permissions: {
						caller: {
							attribution
						},
						rules: [
							{ caller: "probe.**", target: "**", effect: "deny" },
							{ caller: "probe.**", target: "math.**", effect: "allow" }
						]
					}
				});
			}, 60000);

			afterAll(async () => {
				await api?.shutdown?.();
				api = null;
			}, 60000);

			it("every route calling or constructing the root is refused, as self.call() is; the form is the root's", async () => {
				const rows = await moduleShape(api);
				expect(rows.typeof).toBe(root.typeof);
				expect(rows.mathAdd).toBe(5);
				if (root.typeof === "function") {
					for (const row of CALL_ROWS) expect([row, rows[row]]).toEqual([row, DENIED]);
				} else {
					for (const row of CALL_ROWS) expect([row, rows[row]]).toEqual([row, hostShape(api)[row]]);
				}
			});
		});
	});
});

describe.each(CONFIGS)("self is closed as the api root is > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(ROOTS)("root $folder", (root) => {
		it.each(POLICIES.flatMap((policy) => ["preventExtensions", "seal", "freeze"].map((how) => [policy.label, how, policy])))(
			"%s, %s: Object.isExtensible, isSealed and isFrozen of self answer as they do of api (#827)",
			async (_label, how, policy) => {
				const api = await slothlet({
					base: path.join(FIXTURE, root.folder),
					mode,
					runtime,
					silent: true,
					permissions: policy.permissions(attribution)
				});
				try {
					await api.probe;
					expect(await api.probe.closed()).toEqual([true, false, false]);
					Object[how](api);
					expect(await api.probe.closed()).toEqual([Object.isExtensible(api), Object.isSealed(api), Object.isFrozen(api)]);
				} finally {
					await api.shutdown();
				}
			}
		);
	});
});

describe.each(["async", "live"])("self's form per instance > %s", (runtime) => {
	it("instances of both kinds running at once each give their files the form of their own api", async () => {
		const fn = await slothlet({ base: path.join(FIXTURE, "fnroot"), runtime, silent: true });
		const obj = await slothlet({ base: path.join(FIXTURE, "objroot"), runtime, silent: true });
		try {
			expectMirror(await moduleShape(fn), hostShape(fn), false);
			expectMirror(await moduleShape(obj), hostShape(obj), false);
			expect((await moduleShape(fn)).typeof).toBe("function");
			expect((await moduleShape(obj)).typeof).toBe("object");
		} finally {
			await fn.shutdown();
			await obj.shutdown();
		}
	});

	it("a file of a folder beneath the root, taking self at its top level, takes the callable form", async () => {
		const api = await slothlet({ base: path.join(FIXTURE, "subroot"), runtime, silent: true });
		try {
			const rows = await api.sub.capture.report();
			expect(rows.typeof).toBe("function");
			expect(rows.directCall).toBe(4);
		} finally {
			await api.shutdown();
		}
	});

	it.each(["eager", "lazy"])(
		"%s: a file beside the root file, taking self at its top level, takes the callable form when the root plainly exports a function",
		async (mode) => {
			const api = await slothlet({ base: path.join(FIXTURE, "siblingroot"), mode, runtime, silent: true });
			try {
				const rows = await api.capture.report();
				expect(rows.typeof).toBe("function");
				expect(rows.directCall).toBe(4);
				expect(Object.keys(api)[0]).toBe("capture");
			} finally {
				await api.shutdown();
			}
		}
	);

	it("a CommonJS file reading self from the runtime's namespace takes the callable form", async () => {
		const api = await slothlet({ base: path.join(FIXTURE, "cjsroot"), runtime, silent: true });
		try {
			expect(await api.cjsprobe.report()).toEqual({
				typeof: "function",
				toStringTag: "[object Function]",
				instanceofFunction: true,
				directCall: 4,
				dotCall: 4,
				mathAdd: 5
			});
		} finally {
			await api.shutdown();
		}
	});

	it("a full reload keeps the form, from the reloaded files' first import", async () => {
		const api = await slothlet({ base: path.join(FIXTURE, "fnroot"), runtime, silent: true });
		try {
			await api.slothlet.reload();
			expectMirror(await moduleShape(api), hostShape(api), false);
		} finally {
			await api.shutdown();
		}
		const sub = await slothlet({ base: path.join(FIXTURE, "subroot"), runtime, silent: true });
		try {
			await sub.slothlet.reload();
			expect((await sub.sub.capture.report()).typeof).toBe("function");
		} finally {
			await sub.shutdown();
		}
	});

	it("a partial reload keeps the form", async () => {
		const api = await slothlet({ base: path.join(FIXTURE, "fnroot"), runtime, silent: true });
		try {
			await api.slothlet.api.reload("probe");
			expectMirror(await moduleShape(api), hostShape(api), false);
		} finally {
			await api.shutdown();
		}
	});
});

describe.each(["async", "live"])("self in a scope the host opens > %s", (runtime) => {
	describe.each(["fnroot", "objroot"])("root %s", (folder) => {
		it.each(["partial", "full"])("with %s isolation, self answers as the host's api does", async (isolation) => {
			const api = await slothlet({ base: path.join(FIXTURE, folder), runtime, silent: true });
			try {
				const rows = await api.slothlet.context.scope({ context: {}, isolation, fn: () => moduleShape(api) });
				expectMirror(rows, hostShape(api), false);
			} finally {
				await api.shutdown();
			}
		});
	});
});

describe.each(["async", "live"])("a callable self on the global object > %s", (runtime) => {
	it("a later instance's scan of the global object's interfaces passes over it", async () => {
		const first = await slothlet({ base: path.join(FIXTURE, "fnroot"), runtime, silent: true });
		const key = "__slothletSelfParity803";
		try {
			globalThis[key] = (await first.probe.expose()).self;
			expect(typeof globalThis[key]).toBe("function");
			await first.shutdown();
			const second = await slothlet({ base: path.join(FIXTURE, "objroot"), runtime, silent: true });
			expect(await second.math.add(1, 2)).toBe(3);
			await second.shutdown();
		} finally {
			delete globalThis[key];
		}
	});
});

describe.each(CONFIGS)("self() runs the root as the api root > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	const SECRET = "SECRET";
	const OWN_LEAF_POLICIES = [
		{ label: "default allow, no rule", permissions: { rules: [] }, expected: SECRET },
		{
			label: "every caller denied the vault",
			permissions: { rules: [{ caller: "**", target: "vault.**", effect: "deny" }] },
			expected: DENIED
		},
		{
			label: "the reader denied the vault",
			permissions: { rules: [{ caller: "reader.**", target: "vault.**", effect: "deny" }] },
			expected: SECRET
		},
		{
			label: "the reader refused the call of the root",
			permissions: {
				rules: [
					{ caller: "reader.**", target: "**", effect: "deny" },
					{ caller: "reader.**", target: "vault.**", effect: "allow" }
				]
			},
			expected: DENIED
		},
		{ label: "permissions off", permissions: undefined, expected: SECRET },
		{ label: "permissions disabled", permissions: { mode: "disabled" }, expected: SECRET }
	];

	describe.each(OWN_LEAF_POLICIES)("$label", (policy) => {
		let api;

		beforeAll(async () => {
			const permissions = policy.permissions === undefined ? undefined : { caller: { attribution }, ...policy.permissions };
			api = await slothlet({ base: path.join(FIXTURE, "ownleaf"), mode, runtime, silent: true, permissions });
		}, 60000);

		afterAll(async () => {
			await api?.shutdown?.();
			api = null;
		}, 60000);

		it("self() answers as self.call() does", async () => {
			expect(await api.reader.callRoot()).toBe(policy.expected);
		});

		it("Reflect.apply(self, …) answers as self.call() does", async () => {
			expect(await api.reader.reflectRoot()).toBe(policy.expected);
		});
	});
});

/**
 * Every path of a JSON value, with the type of each leaf.
 * @param {*} value - The parsed value.
 * @param {string} [at=""] - Its path.
 * @param {Array<string>} [out=[]] - The paths so far.
 * @returns {Array<string>} The paths.
 */
const jsonPaths = (value, at = "", out = []) => {
	if (value !== null && typeof value === "object") {
		out.push(at);
		for (const key of Object.keys(value)) jsonPaths(value[key], `${at}.${key}`, out);
	} else out.push(`${at}=${typeof value}`);
	return out;
};

const SETTINGS = { public: 1, hidden: 2, list: [1, { a: 1, b: 2 }] };
const JSON_POLICIES = [
	{ label: "permissions off", permissions: () => undefined, config: { settings: SETTINGS }, hidden: 2, principal: "read", whole: false },
	{
		label: "permissions disabled",
		permissions: () => ({ mode: "disabled" }),
		config: { settings: SETTINGS },
		hidden: 2,
		principal: "read",
		whole: true
	},
	{
		label: "permissions on, no rule",
		permissions: (attribution) => ({ caller: { attribution } }),
		config: { settings: SETTINGS },
		hidden: 2,
		principal: DENIED,
		whole: false
	},
	{
		label: "permissions on, a deny rule on one member",
		permissions: (attribution) => ({ attribution, rules: [{ caller: "probe.**", target: "config.settings.hidden", effect: "deny" }] }),
		config: { settings: { public: 1, list: SETTINGS.list } },
		hidden: DENIED,
		principal: DENIED,
		whole: false
	},
	{
		label: "default deny, no rule",
		permissions: (attribution) => ({ caller: { attribution }, policy: "deny" }),
		// The file's node is traversal, listed with nothing the module may read.
		config: {},
		hidden: DENIED,
		principal: DENIED,
		whole: false
	},
	{
		label: "default deny, the probe allowed the config",
		permissions: (attribution) => ({
			caller: {
				attribution
			},
			policy: "deny",
			rules: [{ caller: "probe.**", target: "config.**", effect: "allow" }]
		}),
		config: { settings: SETTINGS },
		hidden: 2,
		principal: DENIED,
		whole: false
	}
];

describe.each(CONFIGS)("JSON.stringify(self) > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	describe.each(JSON_POLICIES)("$label", (policy) => {
		let api;

		beforeAll(async () => {
			api = await slothlet({
				base: path.join(FIXTURE, "jsonroot"),
				mode,
				runtime,
				silent: true,
				permissions: policy.permissions(attribution)
			});
		}, 60000);

		afterAll(async () => {
			await api?.shutdown?.();
			api = null;
		}, 60000);

		it("gives the host's serialization less what the module is refused, and never throws for it", async () => {
			const written = await api.probe.json();
			expect(typeof written).toBe("string");
			expect(written.startsWith("threw:")).toBe(false);
			const host = JSON.stringify(api);
			if (policy.whole) expect(written).toBe(host);
			const hostPaths = new Set(jsonPaths(JSON.parse(host)));
			for (const at of jsonPaths(JSON.parse(written))) expect([at, hostPaths.has(at)]).toEqual([at, true]);
			expect(JSON.parse(written).config).toEqual(policy.config);
		});

		it("a read of a refused member by name is still refused", async () => {
			expect(await api.probe.principalToJSON()).toBe(policy.principal);
			expect(await api.probe.hidden()).toBe(policy.hidden);
		});
	});
});
