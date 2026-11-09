/**
 * @fileoverview #726 — the definer of a `self` call is the nearest leaf on the stack: walking out from the call, the
 * first frame of the same file that lies inside an export's source range names the leaf. Only when no frame of that file
 * is inside any leaf's range is the definer the file's module. A frame of another file ends the search.
 *
 * @description
 * Fixture `api_test_sync_leaf_thenable`: every vault call of `b/give.mjs` goes through the file-level helper `attempt`.
 * A `then`, getter or trap written inside a leaf and calling `attempt` runs as that leaf; a getter written in a helper
 * (`errorWithGetter`, `errorCarrying`) and run later by slothlet, or `attempt` handed out bare and run by another
 * module, has no leaf frame of `give.mjs` on the stack and runs as the module `b.give`. `c.vault.whoami` reports
 * `self.slothlet.metadata.caller()`, which has to name the same definer the permission check used.
 *
 * Fixture `api_test_definer_rule` (lazy, vault not loaded yet): handed-out code refused a `self` call leaves no
 * unhandled rejection behind.
 *
 * Every case runs under both `permissions.attribution` values, eager and lazy, async and live.
 *
 * @module tests/vitests/suites/permissions/permissions-definer-nearest-leaf
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_SYNC_LEAF_THENABLE;
const DEFINER_RULE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_definer_rule");

/** Deny by default; the vault's secret is `a`'s alone. */
const RULES = [
	{ caller: "a.**", target: "c.vault.secret", effect: "allow" },
	{ caller: "**", target: "c.vault.whoami", effect: "allow" },
	{ caller: "a.**", target: "b.**", effect: "allow" },
	{ caller: "b.**", target: "d.**", effect: "allow" }
];

const DENIED = { ok: false, code: "PERMISSION_DENIED" };

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/**
 * Seen by the vault: the definer the check used.
 * @param {string} value - The api path.
 * @returns {{ok: true, value: string}} The outcome `attempt` records.
 */
const seenAs = (value) => ({ ok: true, value });

describe.each(MATRIX)("Permissions > definer is the nearest leaf frame > $name (#726)", ({ attribution, mode, runtime }) => {
	let api = null;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * The fixture api under the deny-by-default rules, with hooks on.
	 * @returns {Promise<object>} The api.
	 */
	const build = async () => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			hook: { enabled: true },
			permissions: { defaultPolicy: "deny", attribution, rules: RULES }
		});
		return api;
	};

	it.each(["syncThen", "timerThen", "microtaskThen"])(
		"%s: then calls a helper; the definer is the leaf whose range holds then",
		async (leaf) => {
			await build();
			expect(await api.a.use.give(leaf, "secret")).toEqual(DENIED);
			expect(await api.a.use.give(leaf, "whoami")).toEqual(seenAs(`b.give.${leaf}`));
		}
	);

	it("getterThen: the getter and the function it returns both run as b.give.getterThen", async () => {
		await build();
		expect(await api.a.use.give("getterThen", "secret")).toEqual({ getter: DENIED, then: DENIED });
		expect(await api.a.use.give("getterThen", "whoami")).toEqual({
			getter: seenAs("b.give.getterThen"),
			then: seenAs("b.give.getterThen")
		});
	});

	it("proxy: every trap the await runs calls the helper as b.give.proxy", async () => {
		await build();
		await api.a.use.give("proxy", "whoami");
		const seen = await api.b.give.drain();
		expect(seen.length).toBeGreaterThan(0);
		expect(seen).toEqual(seen.map(() => seenAs("b.give.proxy")));
	});

	it("a leaf's own call into the helper is that leaf", async () => {
		await build();
		expect(await api.a.use.give("viaHelper", "whoami")).toEqual(seenAs("b.give.viaHelper"));
		expect(await api.b.give.viaHelper("whoami")).toEqual(seenAs("b.give.viaHelper"));
	});

	it("the helper handed out bare and run by another module is the module b.give", async () => {
		await build();
		const helper = await api.b.give.helper();
		expect(await api.a.use.run(helper, "whoami")).toEqual(seenAs("b.give"));
		expect(await api.a.use.run(helper, "secret")).toEqual(DENIED);
	});

	it("the helper handed out bare and run by the host is the module b.give", async () => {
		await build();
		const helper = await api.b.give.helper();
		expect(await helper("whoami")).toEqual(seenAs("b.give"));
		expect(await helper("secret")).toEqual(DENIED);
	});

	it.each(["throw", "reject", "thenable"])(
		"%s: a message getter written in a helper, read by an error hook, is the module b.give",
		async (how) => {
			await build();
			api.slothlet.hook.on("b.**:error", ({ error }) => void error?.message, { id: "nearest-error" });
			expect(await api.a.use.fails("failWithGetter", "whoami", how, false, "message")).toBe(true);
			const seen = await api.b.give.drain();
			expect(seen.length).toBeGreaterThan(0);
			expect(seen).toEqual(seen.map(() => seenAs("b.give")));
		}
	);

	it.each(["proxy", "constructorGetter", "staticName"])(
		"%s: code an error carries, written in a helper and run by slothlet, is the module b.give",
		async (kind) => {
			await build();
			api.slothlet.hook.on("b.**:error", ({ error }) => void error?.message, { id: "nearest-error" });
			expect(await api.a.use.fails("failWith", kind, "whoami", "throw")).toBe(true);
			const seen = await api.b.give.drain();
			expect(seen).toEqual(seen.map(() => seenAs("b.give")));
		}
	);

	it.each(["message", "proxy", "constructorGetter", "staticName"])(
		"%s: a hook's own failure, read by slothlet, reports the definer the check used through metadata.caller()",
		async (kind) => {
			await build();
			api.slothlet.hook.on("**:error", () => {}, { id: "nearest-error-all" });
			api.slothlet.hook.on("b.give.made:after", ({ result }) => result.boom(), { id: "nearest-made-after" });
			await api.a.use.fails("made", kind, "whoami");
			const seen = await api.b.give.drain();
			expect(seen).toEqual(seen.map(() => seenAs("b.give")));
		}
	);
});

describe.each(MATRIX)("Permissions > refused handed-out code, node not loaded yet > $name (#726)", ({ attribution, mode, runtime }) => {
	let api = null;
	let unhandled = [];
	/** @param {*} reason - The rejection reason. */
	const record = (reason) => unhandled.push(reason?.code ?? String(reason));

	afterEach(async () => {
		process.off("unhandledRejection", record);
		await api?.shutdown();
		api = null;
		unhandled = [];
	});

	it("a module's own function bag hands back is refused with no unhandled rejection, the vault never loaded first", async () => {
		process.on("unhandledRejection", record);
		api = await slothlet({
			base: DEFINER_RULE,
			mode,
			runtime,
			silent: true,
			permissions: {
				defaultPolicy: "deny",
				attribution,
				rules: [
					{ caller: "bag.**", target: "vault.**", effect: "allow" },
					{ caller: "**", target: "bag.**", effect: "allow" }
				]
			}
		});
		const fn = await api.supplier.pickOwn();
		/**
		 * Run code from the host, reporting a refusal by its code.
		 * @param {Function} run - The code.
		 * @returns {Promise<*>} What it returned, or the code of what it threw.
		 */
		const settle = async (run) => {
			try {
				return await run();
			} catch (e) {
				return e?.code ?? String(e?.message ?? e);
			}
		};
		expect(await settle(() => fn())).toBe("PERMISSION_DENIED");
		expect(await settle(() => api.bag.call(fn))).toBe("PERMISSION_DENIED");
		// Unhandled rejections are reported after the microtasks and timers of the turn they happened in.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(unhandled).toEqual([]);
	});
});
