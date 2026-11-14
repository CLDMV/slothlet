/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-default-value.test.vitest.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node of a file whose default export is an `Error` or a boxed primitive fronts the value as data (#771):
 * `Object.keys()` lists none of its methods, `instanceof` answers as the value does, and `toString` / `valueOf` run on the
 * value and are no api paths of their own.
 *
 * @description
 * The fixture's `single/` folder exports an `Error` of each kind (a `TypeError`, an error with a cause, an
 * `AggregateError`, an instance of a subclass written in the file) and a boxed `String`, `Number`, `Boolean`, `BigInt`
 * and `Symbol` by default. The host and a module reading through `self` ask each node the questions the fixture's
 * `value` asks, in eager and lazy mode, the async and live runtime, with the permission system on (both attributions),
 * off and disabled. The expected answers are plain JavaScript's on the same value imported outside slothlet.
 * @module tests/vitests/suites/proxies/api-node-default-value
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_api_node_default_value");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions on, precise", permissions: { mode: "on", defaultPolicy: "allow", attribution: "precise" } },
	{ name: "permissions on, fast", permissions: { mode: "on", defaultPolicy: "allow", attribution: "fast" } },
	{ name: "permissions off", permissions: { mode: "off" } },
	{ name: "permissions disabled", permissions: { mode: "disabled" } }
];

const configs = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));
const guarded = configs.filter(({ permissions }) => permissions.mode === "on");

/** The values asked, by key. */
const VALUES = ["derror", "dcause", "dagg", "dsub", "dstr", "dnum", "dbool", "dbig", "dsym"];

/**
 * Build an instance with the files of single values, the reader and the writer mounted as modules of their own, every
 * node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function mount(options) {
	const api = await slothlet({ base: join(FIXTURE, "host"), silent: true, hook: true, ...options });
	for (const name of ["single", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { moduleID: name });
	for (const name of ["single", "reader", "writer"]) await api[name];
	for (const key of VALUES) await api.single[key];
	return api;
}

/**
 * The value a fixture file exports by default, imported as a module imports it, outside slothlet.
 * @param {string} key - The file's name.
 * @returns {Promise<*>} The value.
 */
async function twin(key) {
	return (await import(`${pathToFileURL(join(FIXTURE, "single", `${key}.mjs`)).href}?plain-twin-value`)).default;
}

/**
 * What a value answers, the same questions as the fixture's `value` asks.
 * @param {*} node - The value or its node.
 * @returns {object} The answers.
 */
function questions(node) {
	const answer = (check) => {
		try {
			return check();
		} catch (error) {
			return { threw: error?.code ?? error?.name ?? "threw" };
		}
	};
	const probe = answer(() => [node.toString, node.valueOf, node.message, node.stack].length);
	return {
		keys: answer(() => Object.keys(node)),
		keysAfter: answer(() => (probe, Object.keys(node))),
		spread: answer(() => Object.keys({ ...node })),
		isError: answer(() => node instanceof Error),
		isTypeError: answer(() => node instanceof TypeError),
		isAggregate: answer(() => node instanceof AggregateError),
		isString: answer(() => node instanceof String),
		isNumber: answer(() => node instanceof Number),
		isBoolean: answer(() => node instanceof Boolean),
		message: answer(() => node.message),
		cause: answer(() => JSON.stringify(node.cause)),
		code: answer(() => node.code),
		stack: answer(() => typeof node.stack),
		errors: answer(() => node.errors?.map((error) => error.message)),
		string: answer(() => String(node)),
		template: answer(() => `${node}`),
		plus: answer(() => node + 1),
		valueOf: answer(() => {
			const primitive = node.valueOf();
			return typeof primitive === "object" ? "object" : `${typeof primitive}:${String(primitive)}`;
		}),
		toString: answer(() => node.toString()),
		json: answer(() => JSON.stringify(node)),
		clone: answer(() => {
			const copy = structuredClone(node);
			return `${typeof copy}:${String(copy)}`;
		})
	};
}

describe.each(configs)(
	"a node of a file's default Error or boxed primitive > $mode / $runtime / $name",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it.each(VALUES)("answers the host and a module reading it through self as the value does: %s", async (key) => {
			const expected = questions(await twin(key));
			api = await mount({ mode, runtime, permissions });
			expect(questions(api.single[key])).toEqual(expected);
			expect(await api.reader.value("single", key)).toEqual(expected);
			expect(await api.writer.value("single", key)).toEqual(expected);
		});

		it.each(VALUES)("reading toString and valueOf gives the node no members of its own: %s", async (key) => {
			const expected = Object.keys(await twin(key));
			api = await mount({ mode, runtime, permissions });
			const node = api.single[key];
			void node.toString;
			void node.valueOf;
			node.toString();
			expect(Object.keys(node)).toEqual(expected);
		});

		it("a method a subclass of Error defines in the file still runs on the value", async () => {
			const plain = await twin("dsub");
			api = await mount({ mode, runtime, permissions });
			expect(api.single.dsub.describe()).toBe(plain.describe());
			expect(await api.reader.describeOf("single", "dsub")).toBe(plain.describe());
			expect(String(api.single.dsub)).toBe(String(plain));
		});

		it("its methods are no api paths: a hook on one never runs", async () => {
			api = await mount({ mode, runtime, permissions });
			let ran = 0;
			api.slothlet.hook.on("single.derror.toString:before", () => void ran++);
			api.slothlet.hook.on("single.dstr.valueOf:before", () => void ran++);
			String(api.single.derror);
			api.single.derror.toString();
			api.single.dstr.valueOf();
			await api.reader.value("single", "derror");
			await api.reader.value("single", "dstr");
			expect(ran).toBe(0);
		});
	}
);

describe.each(guarded)(
	"rules on a node of a file's default Error or boxed primitive > $mode / $runtime / $name",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const build = (rules) => mount({ mode, runtime, permissions: { ...permissions, rules } });

		it.each(["derror", "dstr"])("a rule on one of its methods' names is no rule on the value: %s", async (key) => {
			const expected = questions(await twin(key));
			api = await build([{ caller: "reader.**", target: `single.${key}.toString`, effect: "deny" }]);
			expect(await api.reader.value("single", key)).toEqual(expected);
			expect(questions(api.single[key])).toEqual(expected);
		});

		it.each(["derror", "dstr", "dnum"])(
			"a rule on its path, and on everything beneath it, refuses the module it names every member: %s",
			async (key) => {
				const expected = questions(await twin(key));
				for (const target of [`single.${key}`, `single.${key}.**`]) {
					api = await build([{ caller: "reader.**", target, effect: "deny" }]);
					const answers = await api.reader.value("single", key);
					for (const question of ["string", "template", "toString", "valueOf", "plus"])
						expect(answers[question]).toEqual({ threw: "PERMISSION_DENIED" });
					// The host and a module the rule does not name read on, as in plain JavaScript.
					expect(questions(api.single[key])).toEqual(expected);
					expect(await api.writer.value("single", key)).toEqual(expected);
					await api.shutdown();
					api = null;
				}
			}
		);
	}
);
