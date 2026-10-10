/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-multi-instance-identity.test.vitest.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview With two instances in one realm, a call resuming after an await resolves against its own instance (#592).
 *
 * @description
 * The live runtime keeps the active instance in one field shared by every instance, and restores it in
 * settle order. When an earlier call of an instance settles while a later one is still suspended, the
 * field goes back to whatever was active before — another instance. Readers that take no instance id
 * (`self`, `context`, the boundary pinner) and the instance's own `lockCaller()` / `metadata.self()`
 * then resolved against that other instance. Each must resolve against the instance whose module is
 * running.
 *
 * Fixtures: `api_tests/api_test_live_caller_identity` (`a`, `d`, `svc`) as the instance under test,
 * `api_tests/api_test_live_caller_identity_second` (`g`) as the other instance, created first.
 *
 * @module tests/vitests/suites/context/context-live-multi-instance-identity
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, getBrowserMatrixConfigs, getManifest, makeBrowserConfig } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity");
const SECOND = path.resolve(__dirname, "../../../../api_tests/api_test_live_caller_identity_second");

const PLATFORMS = [
	...getMatrixConfigs().map(({ name, config }) => ({ name: `node > ${name}`, config, browser: false })),
	...getBrowserMatrixConfigs().map(({ name, config }) => ({ name: `browser > ${name}`, config, browser: true }))
];

let MANIFEST;
let SECOND_MANIFEST;

beforeAll(async () => {
	MANIFEST = await getManifest(ROOT);
	SECOND_MANIFEST = await getManifest(SECOND);
});

/**
 * A promise and the function that releases it.
 * @returns {[Promise<void>, Function]} Gate and release.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return [promise, release];
}

/**
 * Let every pending microtask and one timer turn run.
 * @returns {Promise<void>} Resolves on the next macrotask.
 */
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * What `d.resume` reports when everything resolves against its own instance.
 * @param {string} tag - The instance's context tag.
 * @returns {object} Expected result.
 */
const resolvedFor = (tag) => ({
	tag,
	selfAfterAwait: "resolved",
	metadataSelf: "d.resume",
	lockCallerPinned: true,
	served: { pinned: true }
});

describe.each(PLATFORMS)(
	"Live runtime > two instances: identity readers resolve against their own instance (#592) > $name",
	({ config, browser }) => {
		const instances = [];

		afterEach(async () => {
			while (instances.length) await instances.pop().shutdown();
		});

		/**
		 * Create an instance and track it for shutdown.
		 * @param {string} dir - Base folder.
		 * @param {object} manifest - Browser manifest for that folder.
		 * @param {string} tag - Context tag the instance carries.
		 * @returns {Promise<object>} The api.
		 */
		async function create(dir, manifest, tag) {
			const base = browser ? makeBrowserConfig(config, dir, manifest) : { ...config, base: dir };
			const api = await slothlet({ ...base, silent: true, context: { tag }, hook: { enabled: true } });
			instances.push(api);
			return api;
		}

		/**
		 * Pin every function argument of a `svc` call with this instance's `lockCaller`, from an around hook,
		 * and record what the hook saw.
		 * @param {object} api - Instance api.
		 * @returns {Array<{hookCaller: string|null, lockCallerPinned: boolean}>} The records, filled as calls run.
		 */
		function pinServiceCallbacks(api) {
			const seen = [];
			api.slothlet.hook.on("svc.**:around", ({ args, next, caller }) => {
				const pinned = args.map((arg) => (typeof arg === "function" ? api.slothlet.lockCaller(arg) : arg));
				seen.push({ hookCaller: caller?.apiPath ?? null, lockCallerPinned: pinned.some((fn, index) => fn !== args[index]) });
				return next(pinned);
			});
			return seen;
		}

		it("after an earlier call settles, self, context, metadata.self() and lockCaller() resolve against the resumed call's instance", async () => {
			await create(SECOND, SECOND_MANIFEST, "second"); // created first: the instance the field rests on
			const api = await create(ROOT, MANIFEST, "main");
			const seen = pinServiceCallbacks(api);
			const [aGate, releaseA] = gate();
			const [dGate, releaseD] = gate();
			const a = api.a.slow(aGate); // settles first, restoring the field to the other instance
			await turn();
			const d = api.d.resume(dGate);
			await turn();
			releaseA();
			expect(await a).toBe("a");
			releaseD();
			expect(await d).toEqual(resolvedFor("main"));
			expect(seen).toEqual([{ hookCaller: "d.resume", lockCallerPinned: true }]);
		});

		it("still resolves its own instance while the other instance has a call suspended too", async () => {
			const second = await create(SECOND, SECOND_MANIFEST, "second");
			const api = await create(ROOT, MANIFEST, "main");
			pinServiceCallbacks(api);
			const [gGate, releaseG] = gate();
			const [aGate, releaseA] = gate();
			const [dGate, releaseD] = gate();
			const held = second.g.hold(gGate);
			await turn();
			const a = api.a.slow(aGate);
			await turn();
			const d = api.d.resume(dGate);
			await turn();
			releaseA();
			expect(await a).toBe("a");
			releaseD();
			expect(await d).toEqual(resolvedFor("main"));
			releaseG();
			expect(await held).toBe("g");
		});

		// Each instance imports its own copy of a module (`?slothlet_instance=…`, in Node and browser mode alike),
		// so a stack frame says which instance it belongs to even when two instances share a folder.
		it("two instances of the same folder, each with the same call suspended, each resolve against their own", async () => {
			const first = await create(ROOT, MANIFEST, "first");
			const other = await create(ROOT, MANIFEST, "other");
			pinServiceCallbacks(first);
			pinServiceCallbacks(other);
			const [firstGate, releaseFirst] = gate();
			const [otherGate, releaseOther] = gate();
			const fromFirst = first.d.resume(firstGate);
			await turn();
			const fromOther = other.d.resume(otherGate); // entered last: the field names `other`
			await turn();
			releaseFirst();
			expect(await fromFirst).toEqual(resolvedFor("first"));
			releaseOther();
			expect(await fromOther).toEqual(resolvedFor("other"));
		});

		it("control: one instance on its own resolves the same way", async () => {
			const api = await create(ROOT, MANIFEST, "main");
			pinServiceCallbacks(api);
			const [aGate, releaseA] = gate();
			const [dGate, releaseD] = gate();
			const a = api.a.slow(aGate);
			await turn();
			const d = api.d.resume(dGate);
			await turn();
			releaseA();
			expect(await a).toBe("a");
			releaseD();
			expect(await d).toEqual(resolvedFor("main"));
		});
	}
);
