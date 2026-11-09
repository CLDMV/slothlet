/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/supplier/supplier.mjs
 *	@Date: 2026-11-08T19:11:03-08:00 (1794193863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:17:27-08:00 (1794194247)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): runs code `bag` hands out and hands code into `bag`'s calls. No
 * rule allows `supplier` to read the vault.
 * @module api_test_definer_rule.supplier
 */
import { self } from "@cldmv/slothlet/runtime";

const settle = async (fn) => {
	try {
		return await fn();
	} catch (e) {
		return e?.code ?? String(e?.message ?? e);
	}
};

export async function run() {
	const r = {};
	const fn = await self.bag.make();
	r.makePlain = typeof fn;
	r.A = await settle(() => fn());
	const data = await self.bag.box();
	r.boxPlain = typeof data?.run;
	r.B = await settle(() => data.run());
	let seen = "not run";
	const probe = {
		toString() {
			try {
				seen = self.vault.get();
			} catch (e) {
				seen = e;
			}
			return "x";
		}
	};
	r.echoResult = await settle(() => self.bag.echo(probe));
	r.C = await settle(async () => {
		if (seen instanceof Error) throw seen;
		return await seen;
	});
	r.D = await settle(() => self.bag.call(() => self.vault.get()));
	r.keepPlain = await settle(async () => {
		await self.shared.keep(() => self.vault.get());
		return "ok";
	});
	r.echoPlain = await settle(() => self.bag.echo(5));
	r.callPlain = await settle(() => self.bag.call(() => 7));
	const instance = await self.bag.inst();
	r.instance = await settle(() => instance.run());
	r.direct = await settle(() => self.vault.get());
	return r;
}
