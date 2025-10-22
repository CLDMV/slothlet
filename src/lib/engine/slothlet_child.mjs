/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/engine/slothlet_child.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 06:58:57 -07:00 (1761141537)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

import { installGlobalsInCurrentRealm, extendSelfWithReference, installPortalForSelf } from "./slothlet_helpers.mjs";

let initialized = false;

process.on("message", async (msg) => {
	try {
		if (msg.t === "init") {
			if (initialized) return;
			initialized = true;

			const { entry, loadConfig, contextMap, reference } = msg;

			// 1) Inject globals in this process
			installGlobalsInCurrentRealm(contextMap);

			// 2) Load entry & run slothlet.load(...)
			const { slothlet } = await import(entry);
			if (!slothlet) throw new Error("Entry did not export `slothlet`");

			const api = await slothlet.load(loadConfig, { context: contextMap, reference });
			globalThis.self = api;

			// 3) Extend and portal
			extendSelfWithReference(globalThis.self, reference);
			installPortalForSelf();

			process.send({ id: msg.id, ok: 1, result: true });
		} else if (msg.t === "call") {
			const result = await globalThis._portal.call(msg.path, msg.args || []);
			process.send({ id: msg.id, ok: 1, result });
		} else if (msg.t === "batch") {
			const result = await globalThis._portal.batch(msg.ops || []);
			process.send({ id: msg.id, ok: 1, result });
		} else if (msg.t === "dispose") {
			process.send({ id: msg.id, ok: 1, result: true });
			process.exit(0);
		}
	} catch (e) {
		process.send({ id: msg.id, ok: 0, error: String(e?.stack || e) });
	}
});
