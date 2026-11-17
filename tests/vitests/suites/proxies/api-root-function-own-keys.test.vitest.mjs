/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-root-function-own-keys.test.vitest.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:18-08:00 (1794882618)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api node whose default export is a function lists its keys as the function does, whatever kind of
 * function it is.
 *
 * @description
 * A root file whose default export is an async function made `Object.keys(api)` throw ("'ownKeys' on proxy: trap result
 * did not include 'prototype'"), and `"prototype" in api` throw as well: the api root answered from a stub function that
 * has a `prototype` of its own while the async function has none. The same held for an arrow, a bound function, a method
 * and a CommonJS async function.
 *
 * Each kind of function is the default export of a file at the api root, of a folder mounted with `api.add` (at `zz` and
 * at `zz.s`), of the only file in a folder (`e/x.mjs`) and of a folder's same-named file (`e/e.mjs`). The node is
 * reflected on in eager and lazy mode, the async and live runtime, with the permission system off and on under both
 * attributions. The expected answers are the function's own, imported as a plain module, with the file's other exports
 * as its members. Two documented differences are kept: the api root also lists the instance's own `slothlet`,
 * `shutdown`, `destroy` and `initialize`, and a node describes `prototype` as configurable (the node answers from a
 * function of its own, which holds none it could report as fixed).
 * @module tests/vitests/suites/proxies/api-root-function-own-keys
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import slothlet from "@cldmv/slothlet";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const require = createRequire(import.meta.url);

const HELPER = 'export function helper() { return "helper"; }\n';

/** Each kind of function, as a file's default export: [extension, source]. */
const SHAPES = {
	"async function with named exports": ["mjs", 'export default async function root() { return "root"; }\n' + HELPER],
	"async function": ["mjs", 'export default async function root() { return "root"; }\n'],
	"function with named exports": ["mjs", 'export default function root() { return "root"; }\n' + HELPER],
	function: ["mjs", 'export default function root() { return "root"; }\n'],
	"generator function": ["mjs", "export default function* root() { yield 1; }\n" + HELPER],
	"async generator function": ["mjs", "export default async function* root() { yield 1; }\n" + HELPER],
	class: ["mjs", 'export default class Root { v() { return "v"; } }\n' + HELPER],
	"arrow function": ["mjs", 'export default () => "root";\n' + HELPER],
	"bound function": ["mjs", 'function root() { return "root"; }\nexport default root.bind(null);\n' + HELPER],
	method: ["mjs", 'export default ({ root() { return "root"; } }).root;\n' + HELPER],
	"CommonJS async function": [
		"cjs",
		'module.exports = async function root() { return "root"; };\nmodule.exports.helper = function helper() { return "helper"; };\n'
	]
};

/** Where the function sits. */
const PLACES = ["api root", "mount zz", "mount zz.s", "only file of a folder", "same-named file of a folder"];

/** The members the api root holds of its own. */
const ROOT_BUILTINS = new Set(["slothlet", "shutdown", "destroy", "initialize"]);

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on, precise", permissions: { policy: "allow", caller: { attribution: "precise" } } },
	{ name: "permissions on, fast", permissions: { policy: "allow", caller: { attribution: "fast" } } }
];
const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry }))));

let fixtureRoot;
/** @type {Map<string, {base: string, mount?: string, file: string}>} */
const fixtures = new Map();
let twins = 0;

/**
 * Write one shape's file for one place.
 * @param {string} shape - The shape's name.
 * @param {string} place - Where the file sits.
 * @returns {Promise<{base: string, mount?: string, file: string}>} The instance's base, the folder to mount, the file.
 */
async function writeFixture(shape, place) {
	const [ext, source] = SHAPES[shape];
	const dir = join(fixtureRoot, `${Object.keys(SHAPES).indexOf(shape)}-${PLACES.indexOf(place)}`);
	if (place === "api root" || place.startsWith("mount")) {
		await mkdir(join(dir, "shape"), { recursive: true });
		await writeFile(join(dir, "shape", `root.${ext}`), source);
		await mkdir(join(dir, "host"), { recursive: true });
		await writeFile(join(dir, "host", "other.mjs"), 'export function other() { return "other"; }\n');
		return {
			base: place === "api root" ? join(dir, "shape") : join(dir, "host"),
			mount: join(dir, "shape"),
			file: join(dir, "shape", `root.${ext}`)
		};
	}
	const name = place === "only file of a folder" ? "x" : "e";
	await mkdir(join(dir, "api", "e"), { recursive: true });
	await writeFile(join(dir, "api", "e", `${name}.${ext}`), source);
	return { base: join(dir, "api"), file: join(dir, "api", "e", `${name}.${ext}`) };
}

/**
 * The plain-JavaScript twin: the file imported as a plain module, its default export with the other exports as members.
 * @param {string} file - The file.
 * @returns {Promise<{fn: Function, members: string[]}>} The function and the names of its members.
 */
async function twin(file) {
	if (file.endsWith(".cjs")) {
		delete require.cache[file];
		const fn = require(file);
		return { fn, members: [] };
	}
	const namespace = await import(`${pathToFileURL(file).href}?plain-twin-${++twins}`);
	return { fn: namespace.default, members: Object.keys(namespace).filter((key) => key !== "default") };
}

/**
 * What plain JavaScript answers for the twin, each check as the node is checked.
 * @param {{fn: Function, members: string[]}} plain - The twin.
 * @returns {object} The answers.
 */
function plainAnswers({ fn, members }) {
	const own = [...Reflect.ownKeys(fn).map(String), ...members];
	const descriptor = Object.getOwnPropertyDescriptor(fn, "prototype");
	return {
		keys: [...Object.keys(fn), ...members],
		ownKeys: [...own].sort(),
		names: [...Object.getOwnPropertyNames(fn), ...members].sort(),
		descriptors: [...new Set([...Object.keys(Object.getOwnPropertyDescriptors(fn)), ...members])].sort(),
		forIn: [...Object.keys(fn), ...members],
		spread: [...Object.keys({ ...fn }), ...members],
		hasPrototype: "prototype" in fn,
		prototype: descriptor
			? { writable: descriptor.writable, enumerable: descriptor.enumerable, value: typeof descriptor.value }
			: undefined,
		json: JSON.stringify(fn),
		clone: (() => {
			try {
				structuredClone(fn);
				return "cloned";
			} catch (error) {
				return error.name;
			}
		})(),
		getPrototypeOf: Object.getPrototypeOf(fn)
	};
}

/**
 * What the node answers, the api root's own members left out.
 * @param {Function} node - The node.
 * @param {boolean} isRoot - Whether it is the api root.
 * @returns {object} The answers.
 */
function nodeAnswers(node, isRoot) {
	const mine = (keys) => keys.map(String).filter((key) => !(isRoot && ROOT_BUILTINS.has(key)));
	const forIn = [];
	for (const key in node) forIn.push(key);
	const descriptor = Object.getOwnPropertyDescriptor(node, "prototype");
	return {
		keys: mine(Object.keys(node)),
		ownKeys: mine(Reflect.ownKeys(node)).sort(),
		names: mine(Object.getOwnPropertyNames(node)).sort(),
		descriptors: mine(Object.keys(Object.getOwnPropertyDescriptors(node))).sort(),
		forIn: mine(forIn),
		spread: mine(Object.keys({ ...node })),
		hasPrototype: "prototype" in node,
		prototype: descriptor
			? { writable: descriptor.writable, enumerable: descriptor.enumerable, value: typeof descriptor.value }
			: undefined,
		json: JSON.stringify(node),
		clone: (() => {
			try {
				structuredClone(node);
				return "cloned";
			} catch (error) {
				return error.name;
			}
		})(),
		getPrototypeOf: Object.getPrototypeOf(node)
	};
}

/**
 * Build an instance over a fixture and return the node its function is at, loaded.
 * @param {{base: string, mount?: string}} fixture - The fixture.
 * @param {string} place - Where the function sits.
 * @param {object} options - Instance options.
 * @returns {Promise<{api: object, node: Function}>} The api and the node.
 */
async function build(fixture, place, options) {
	const api = await slothlet({ base: fixture.base, silent: true, ...options });
	let node = api;
	if (place === "mount zz") {
		await api.slothlet.api.add("zz", fixture.mount);
		node = api.zz;
	} else if (place === "mount zz.s") {
		await api.slothlet.api.add("zz.s", fixture.mount);
		node = api.zz.s;
	} else if (place !== "api root") node = api.e;
	if (typeof node._materialize === "function") await node._materialize();
	return { api, node };
}

beforeAll(async () => {
	fixtureRoot = await makeTestTmpDir("root-fn-own-keys");
	for (const shape of Object.keys(SHAPES)) for (const place of PLACES) fixtures.set(`${shape}|${place}`, await writeFixture(shape, place));
});

afterAll(async () => {
	if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

describe.each(matrix)("a function's own keys on its api node > $mode / $runtime / $name", ({ mode, runtime, permissions }) => {
	const options = { mode, runtime, ...(permissions ? { permissions } : {}) };

	describe.each(PLACES)("%s", (place) => {
		it.each(Object.keys(SHAPES))("%s", async (shape) => {
			const fixture = fixtures.get(`${shape}|${place}`);
			const expected = plainAnswers(await twin(fixture.file));
			const { api, node } = await build(fixture, place, options);
			try {
				expect(typeof node).toBe("function");
				expect(nodeAnswers(node, place === "api root")).toEqual(expected);
				// The api root over the node lists it.
				if (place !== "api root") expect(Object.keys(api)).toContain(place.startsWith("mount") ? "zz" : "e");
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});

/**
 * Write an api root whose file's default export is `kind`, with a function and a data member beside it.
 * @param {string} kind - "async" or "plain".
 * @returns {Promise<string>} The base directory.
 */
async function writeGuardedRoot(kind) {
	const dir = join(fixtureRoot, `guarded-${kind}`);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "root.mjs"),
		`export default ${kind === "async" ? "async " : ""}function root() { return "root"; }\n` + HELPER + "export const secret = { n: 1 };\n"
	);
	return dir;
}

describe.each(
	MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution }))))
)(
	"a module reading an api root whose default export is an async function > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		it("is answered as for a root whose default export is a plain function, and refused what that one refuses", async () => {
			const readerDir = join(fixtureRoot, `reader-${mode}-${runtime}-${attribution}`);
			await mkdir(readerDir, { recursive: true });
			await writeFile(
				join(readerDir, "reader.mjs"),
				[
					'import { self } from "@cldmv/slothlet/runtime";',
					"export function look() {",
					"\tconst forIn = [];",
					"\tfor (const key in self) forIn.push(key);",
					"\tlet called;",
					"\ttry {",
					"\t\tcalled = self.helper();",
					"\t} catch (error) {",
					"\t\tcalled = error.code;",
					"\t}",
					'\treturn { keys: Object.keys(self), forIn, hasPrototype: "prototype" in self, called, secret: JSON.stringify(self.secret) };',
					"}",
					""
				].join("\n")
			);
			const look = async (kind) => {
				const api = await slothlet({
					base: await writeGuardedRoot(kind),
					mode,
					runtime,
					silent: true,
					permissions: {
						policy: "allow",
						caller: {
							attribution
						},
						rules: [
							{ caller: "reader.**", target: "helper", effect: "deny" },
							{ caller: "reader.**", target: "secret", effect: "deny" }
						]
					}
				});
				try {
					await api.slothlet.api.add("reader", readerDir, { id: "reader" });
					return { host: Object.keys(api), reader: await api.reader.look() };
				} finally {
					await api.slothlet.shutdown();
				}
			};
			const plain = await look("plain");
			const asynchronous = await look("async");
			// The call the rule denies stays refused.
			expect(plain.reader.called).toBe("PERMISSION_DENIED");
			expect(asynchronous.reader.called).toBe("PERMISSION_DENIED");
			// Everything else is answered as for the plain function's root, `prototype` as plain JavaScript answers it.
			const { hasPrototype: plainHas, ...plainRest } = plain.reader;
			const { hasPrototype: asyncHas, ...asyncRest } = asynchronous.reader;
			expect(asyncRest).toEqual(plainRest);
			expect(plainHas).toBe("prototype" in function () {});
			expect(asyncHas).toBe("prototype" in async function () {});
			expect(asynchronous.host).toEqual(plain.host);
			expect(asynchronous.host).toEqual(expect.arrayContaining(["helper", "secret"]));
		});
	}
);
