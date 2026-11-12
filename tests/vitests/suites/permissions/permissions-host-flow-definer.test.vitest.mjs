/**
 * @fileoverview Code a module handed out runs as its definer when the host runs it inside a `run()` or `scope()`
 * flow, as it does when the host runs it outside one.
 *
 * @description
 * Fixture `api_test_fast_no_provenance`: `author.make` returns a function that reads the vault, `author.box` returns
 * data holding one. The host runs them directly, inside `api.slothlet.context.run()`, inside
 * `api.slothlet.context.scope()`, and after an `await` inside `run()`.
 *
 * Expected values come from the definer rule (PERMISSIONS.md, "Code a module hands out runs as its definer"): the
 * definer has to be allowed whoever runs the code, so with `author` denied the vault every route is refused, and with
 * no rule every route reads it. A flow the host opened changes the context the code sees, not whose code it is.
 * @module tests/vitests/suites/permissions/permissions-host-flow-definer
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_fast_no_provenance");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Run code and report a refusal by its code.
 * @param {function(): *} run - The code.
 * @returns {Promise<*>} What it returned, or the code of the error it threw.
 */
async function attempt(run) {
	try {
		return await run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

describe.each(matrix)(
	"handed-out code the host runs inside a flow it opened > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		describe.each([
			{
				label: "the definer denied the vault",
				rules: [{ caller: "author.**", target: "vault.**", effect: "deny" }],
				expected: "PERMISSION_DENIED"
			},
			{ label: "no rule", rules: [], expected: "SECRET" }
		])("$label", ({ rules, expected }) => {
			/**
			 * Build the instance and ask the author for its function and its data.
			 * @returns {Promise<{made: Function, box: {run: Function}}>} What the author handed out.
			 */
			async function open() {
				api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", attribution, rules } });
				await api.vault.get();
				return { made: await api.author.make(), box: await api.author.box() };
			}

			it(`a returned function answers ${expected} outside a flow, inside run(), inside scope() and after an await in run()`, async () => {
				const { made } = await open();
				expect({
					bare: await attempt(() => made()),
					run: await attempt(() => api.slothlet.context.run({}, () => made())),
					scope: await attempt(() => api.slothlet.context.scope({ context: {}, fn: () => made() })),
					afterAwait: await attempt(() =>
						api.slothlet.context.run({}, async () => {
							await null;
							return made();
						})
					)
				}).toEqual({ bare: expected, run: expected, scope: expected, afterAwait: expected });
			});

			it(`a function nested in returned data answers ${expected} outside a flow and inside run()`, async () => {
				const { box } = await open();
				expect({
					bare: await attempt(() => box.run()),
					run: await attempt(() => api.slothlet.context.run({}, () => box.run()))
				}).toEqual({ bare: expected, run: expected });
			});
		});

		it("the host's own calls inside run() are the host's", async () => {
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				permissions: { defaultPolicy: "deny", attribution, rules: [] }
			});
			expect(await api.slothlet.context.run({ user: "u" }, () => api.vault.get())).toBe("SECRET");
		});
	}
);
