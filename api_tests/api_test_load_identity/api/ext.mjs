/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/ext.mjs
 *	@Date: 2026-11-11T11:47:43-08:00 (1794426463)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for relayed code: a module denied the vault that hands closures `bag` returned to leaves
 * that are allowed it.
 * @module api_test_load_identity.ext
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run code, reporting a refusal by its code.
 * @param {Function} fn - The code.
 * @returns {Promise<*>} What it returned, or the code of what it threw.
 */
const settle = async (fn) => {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
};

/**
 * Run one route.
 * @param {string} route - The route's name.
 * @returns {Promise<*>} Its outcome.
 */
export async function probe(route) {
	const made = await self.bag.make();
	const boxed = await self.bag.box();
	if (route === "direct") return settle(() => made());
	if (route === "ownMap") return settle(() => [1].map(boxed.run)[0]);
	if (route === "runnerCall") return settle(() => self.runner.call(made));
	if (route === "runnerBoxed") return settle(() => self.runner.call(boxed.run));
	if (route === "runnerMap") return settle(async () => (await self.runner.map([1], boxed.run))[0]);
	if (route === "runnerBound") return settle(() => self.runner.call(made.bind(null)));
	if (route === "runnerWrapped") return settle(() => self.runner.call(() => made()));
	if (route === "bagCall") return settle(() => self.bag.call(made));
	if (route === "bagBound") return settle(() => self.bag.call(boxed.run.bind(null)));
	if (route === "relayed") return settle(() => self.relay.pass(made));
	if (route === "hostLeaf") return settle(() => self.host.records.run(made));
	if (route === "hostLeafBoxed") return settle(() => self.host.records.run(boxed.run));
	if (route === "runnerOwn") return settle(() => self.runner.own());
	if (route === "runnerOwnWith") return settle(() => self.runner.ownWith(() => 1));
	if (route === "runnerOwnWithLater") return settle(() => self.runner.ownWithLater(() => 1));
	if (route === "runnerOwnWithAsync") return settle(() => self.runner.ownWithAsync(() => 1));
	if (route === "runnerOwnWithMap") return settle(() => self.runner.ownWithMap(() => 1));
	if (route === "runnerGetter")
		return settle(() =>
			self.runner.callGot({
				get fn() {
					return made;
				}
			})
		);
	if (route === "runnerGetterFetch")
		return settle(() =>
			self.runner.callAwaited({
				get fn() {
					return self.bag.make();
				}
			})
		);
	if (route === "runnerProxy") return settle(() => self.runner.call(new Proxy(made, {})));
	if (route === "runnerNested") return settle(() => self.runner.callNested({ inner: { list: [made] } }));
	if (route === "runnerAsync") return settle(async () => self.runner.call(await self.bag.makeAsync()));
	if (route === "runnerAsyncBound") return settle(async () => self.runner.call((await self.bag.makeAsync()).bind(null)));
	if (route === "runnerShared")
		return settle(() =>
			self.runner.share({
				get fn() {
					return self.runner.peek();
				}
			})
		);
	if (route === "instRun") return settle(() => self.runner.instRun(() => 1));
	if (route === "instRunLater") return settle(() => self.runner.instRunLater(() => 1));
	if (route === "instLater") return settle(() => self.runner.instLater(() => 1));
	if (route === "instGetter") return settle(() => self.runner.instGetter(() => 1));
	if (route === "instCallSameClass") return settle(async () => self.runner.instCall((await self.bag.inst()).run));
	if (route === "instCallOtherClass") return settle(async () => self.runner.instCall((await self.bag.other()).run));
	if (route === "instBindSameClass") return settle(async () => self.runner.instBind((await self.bag.inst()).run));
	if (route === "instForeign") return settle(async () => self.runner.instForeign(await self.bag.other()));
	if (route === "instProto") return settle(() => self.runner.instProto(() => 1));
	if (route === "handedInstRun") return settle(async () => self.runner.callRun(await self.bag.inst()));
	if (route === "handedInstGetter") return settle(async () => self.runner.readSecret(await self.bag.inst()));
	if (route === "instShared")
		return settle(() =>
			self.runner.instShare({
				get fn() {
					return Promise.resolve(self.runner.peekInstance()).then((instance) => instance.run.bind(instance));
				}
			})
		);
	if (route === "runnerKept") return settle(async () => (await self.runner.keep(made)) && self.runner.runKept(() => 1));
	if (route === "lent") return settle(async () => self.runner.call(await self.bag.lend()));
	if (route === "leaf") return settle(() => self.bag.read());
	return "no such route";
}

/**
 * A second export, so the file is a module with leaves.
 * @returns {string} A marker.
 */
export const ping = () => "pong";
