// _child.mjs
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
