/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stack_settings/routes.mjs
 *	@Date: 2026-11-14T12:00:00-08:00 (1794686400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T12:00:00-08:00 (1794686400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The rules and the routes `settler`'s reads take, shared by the test and its child process.
 * @module api_test_stack_settings.routes
 */

export const ROUTES = {
	rules: [
		{ caller: "settler.**", target: "vault.**", effect: "deny" },
		{ caller: "**", target: "only.**", effect: "deny" },
		{ caller: "good.**", target: "only.**", effect: "allow" }
	],
	runs: {
		// settler's own call.
		own: (api, change) => api.settler.own(change),
		// settler's own call, after an await.
		ownLater: (api, change) => api.settler.ownLater(change),
		// settler's function, run by good after an await: it runs as settler with good as its caller.
		handedToGood: async (api, change) => api.good.runIt(await api.settler.give(change)),
		// The same, run at once.
		handedToGoodAtOnce: async (api, change) => api.good.runItSync(await api.settler.give(change)),
		// settler's function reading the node only good may call, run by good.
		onlyThroughGood: async (api, change) => api.good.runIt(await api.settler.give(change, "only")),
		// settler's function, run by the host.
		handedToHost: async (api, change) => (await api.settler.give(change))(),
		// settler's read from a timer it set.
		timer: (api, change) => api.settler.timer(change)
	}
};
