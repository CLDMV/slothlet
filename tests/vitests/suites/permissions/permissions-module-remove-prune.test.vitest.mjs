/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-module-remove-prune.test.vitest.mjs
 *	@Date: 2026-11-25T01:54:20-08:00 (1795600460)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:18:13-08:00 (1795601893)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A removal module code makes decides whether a namespace it emptied is empty from the node itself, not
 * by listing it through the removing module's view (#625).
 *
 * After `api.remove` deletes a member, every namespace on the path that is left empty is removed with it. That check
 * listed the namespace through the view a read under the removing module's identity hands back, and the view resolves
 * who is reading for every member it describes, reading the stack each time. A scoped removal deletes each member the
 * module owns under the path one by one, so the stack was read for every member of every namespace on the path, once
 * per member removed: in the live runtime a removal from module code took seconds. Whether a namespace is empty is a
 * fact about the node, so it is read from the node, and the reads a removal makes no longer grow with every member the
 * namespaces on its path hold.
 *
 * Fixture: `api_tests/api_test_self_write_reach` — `guest/` (mounted as `guest`, and by its own code as `guest.kid`),
 * `victim/` (mounted by the host beside it, under `guest`).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { stackReadCount } from "#helpers/stack-read";
import { TEST_DIRS, apiPart } from "../../setup/vitest-helper.mjs";

const FIXTURE = TEST_DIRS.API_TEST_SELF_WRITE_REACH;
const GUEST = apiPart(FIXTURE, "guest");
const VICTIM = apiPart(FIXTURE, "victim");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("a module's removal prunes by what a namespace holds (#625) — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Mount the guest code at `guest`, have it mount itself again at `guest.kid`, mount the victim code beside that
	 * `siblings` times, then have the guest code remove the members `kid` owns under `guest.kid.x`.
	 * @param {number} siblings - How many other namespaces `guest` holds.
	 * @returns {Promise<number>} The stacks slothlet read during the removal.
	 */
	async function removalReads(siblings) {
		api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, permissions: {} });
		await api.slothlet.api.add("guest", GUEST, { id: "guest" });
		expect(await api.guest.x.addAt("guest.kid", GUEST, { id: "kid" })).toBe("done");
		for (let i = 0; i < siblings; i++) await api.slothlet.api.add(`guest.sibling${i}`, VICTIM, { id: `sibling${i}` });
		const before = stackReadCount();
		expect(await api.guest.x.removeAt("guest.kid.x", "kid")).toBe(true);
		const reads = stackReadCount() - before;
		expect(api.guest.kid).toBeUndefined();
		await api.slothlet.shutdown();
		api = null;
		return reads;
	}

	it("does not read the stack again for every member of the namespaces on the path, per member removed", async () => {
		const siblings = 4;
		const alone = await removalReads(0);
		const crowded = await removalReads(siblings);
		// A few reads for each namespace the removal passes over at most; the listing read the stack for each member of
		// `guest` once per member removed under `guest.kid.x`, over a hundred reads for each sibling.
		expect(crowded - alone).toBeLessThanOrEqual(siblings * 4);
	});

	it("still prunes the namespaces the removal left empty, and keeps one that holds another module's mount", async () => {
		api = await slothlet({ base: apiPart(FIXTURE), mode, runtime, silent: true, permissions: {} });
		await api.slothlet.api.add("guest", GUEST, { id: "guest" });
		expect(await api.guest.x.addAt("guest.kid", GUEST, { id: "kid" })).toBe("done");
		await api.slothlet.api.add("guest.kid.hostkid", VICTIM, { id: "hostkid" });

		expect(await api.guest.x.removeAt("guest.kid.x", "kid")).toBe(true);
		expect(api.guest.kid.x).toBeUndefined();
		expect(await api.guest.kid.hostkid.v.secret()).toBe("SECRET");

		expect(await api.slothlet.api.remove("guest.kid.hostkid")).toBe(true);
		expect(api.guest.kid).toBeUndefined();
		expect(typeof api.guest.x.removeAt).toBe("function");
	});
});
