// _worker.mjs
import { parentPort, workerData } from "node:worker_threads";
import {
	installGlobalsInCurrentRealm,
	extendSelfWithReference,
	installPortalForSelf,
	reviveArgsReplaceTokens
} from "./slothlet_helpers.mjs";

const { entry, loadConfig, contextMap, reference } = workerData;

(async () => {
	// 1) Inject globals into the worker's own realm
	installGlobalsInCurrentRealm(contextMap);

	// 2) Load your entry and run slothlet.load(...)
	const { slothlet } = await import(entry);
	if (!slothlet) throw new Error("Entry did not export `slothlet`");

	const api = await slothlet.load(loadConfig, { context: contextMap, reference });
	// Attach __dispose__ to the real API object in the worker
	Object.defineProperty(api, "__dispose__", {
		value: async () => {
			parentPort.postMessage({ t: "dispose" });
			setImmediate(() => process.exit(0));
		},
		writable: false,
		enumerable: false,
		configurable: false
	});
	globalThis.self = api;

	// 3) Extend API with `reference` (no overwrite), then install portal
	extendSelfWithReference(globalThis.self, reference);
	installPortalForSelf();

	// 4) RPC loop
	// Callback invocation: send request to parent and await result
	const callbackResults = new Map();
	parentPort.on("message", async (msg) => {
		// console.debug("[worker] Received message:", msg);
		// Handle callback results from parent
		if (msg && msg.t === "callbackResult" && typeof msg.cb === "number") {
			// console.debug("[worker] Received callbackResult:", msg);
			const resolver = callbackResults.get(msg.cb);
			if (resolver) {
				callbackResults.delete(msg.cb);
				if (msg.ok) resolver.resolve(msg.result);
				else resolver.reject(new Error(msg.error));
			}
			return;
		}
		try {
			// Revive callback tokens in args
			function invokeCb(cbId, args) {
				// console.debug("[worker] Invoking callback token:", cbId, args);
				return new Promise((resolve, reject) => {
					callbackResults.set(cbId, { resolve, reject });
					parentPort.postMessage({ t: "callback", cb: cbId, args });
				});
			}
			if (msg.t === "call") {
				// console.debug("[worker] Handling 'call' with path:", msg.path, "args:", msg.args);
				// Special case: describe endpoint
				if (Array.isArray(msg.path) && msg.path.length === 1 && msg.path[0] === "describe") {
					function serialize(x) {
						if (typeof x === "function") {
							const props = {};
							for (const k of Object.keys(x)) props[k] = serialize(x[k]);
							return { __fn: x.name || "", props };
						}
						if (x && typeof x === "object") {
							if (Array.isArray(x)) return x.map(serialize);
							const out = {};
							for (const [k, v] of Object.entries(x)) out[k] = serialize(v);
							return out;
						}
						return x;
					}
					parentPort.postMessage({ id: msg.id, ok: 1, result: serialize(globalThis.self) });
					return;
					// parentPort.postMessage({ id: msg.id, ok: 1, result: JSON.stringify(globalThis.self) });
					// return;
					// Introspect the API structure
					function describeApi(obj, d = 2) {
						if (d < 0) return typeof obj;
						if (typeof obj === "function") {
							const keys = Object.getOwnPropertyNames(obj);
							const out = { __type: "function" };
							for (const k of keys) {
								out[k] = describeApi(obj[k], d - 1);
							}
							return out;
						}
						if (obj && typeof obj === "object") {
							const out = {};
							for (const k of Object.keys(obj)) {
								out[k] = describeApi(obj[k], d - 1);
							}
							return out;
						}
						return obj;
					}
					const result = describeApi(globalThis.self, 2);
					parentPort.postMessage({ id: msg.id, ok: 1, result: JSON.stringify(result) });
					return;
				}
				const revivedArgs = reviveArgsReplaceTokens(msg.args || [], invokeCb);
				// console.debug("[worker] Revived args:", revivedArgs);
				// Resolve the target from the path
				let target = globalThis.self;
				if (Array.isArray(msg.path)) {
					for (const seg of msg.path) {
						if (target == null) break;
						target = target[seg];
					}
				}
				let result;
				if (typeof target === "function") {
					// If the target is a function, call it
					result = await target(...revivedArgs);
				} else if (target && typeof target === "object" && typeof target.default === "function") {
					// If the target is an object with a default function, call default
					result = await target.default(...revivedArgs);
				} else {
					throw new TypeError("Resolved value is not a function");
				}
				// console.debug("[worker] _portal.call result:", result);
				parentPort.postMessage({ id: msg.id, ok: 1, result });
			} else if (msg.t === "batch") {
				// console.debug("[worker] Handling 'batch' with ops:", msg.ops);
				const revivedOps = Array.isArray(msg.ops)
					? msg.ops.map((op) => ({ ...op, args: reviveArgsReplaceTokens(op.args || [], invokeCb) }))
					: msg.ops;
				// console.debug("[worker] Revived ops:", revivedOps);
				const result = await globalThis._portal.batch(revivedOps);
				// console.debug("[worker] _portal.batch result:", result);
				parentPort.postMessage({ id: msg.id, ok: 1, result });
			} else if (msg.t === "dispose") {
				// console.debug("[worker] Handling 'dispose'");
				parentPort.postMessage({ id: msg.id, ok: 1, result: true });
				// Ensure worker exits after dispose
				// setImmediate(() => {
				// 	console.debug("[worker] Exiting after dispose...");
				// 	process.exit(0);
				// });
			}
		} catch (e) {
			parentPort.postMessage({ id: msg.id, ok: 0, error: String(e?.stack || e) });
		}
	});
})().catch((e) => {
	parentPort.postMessage({ id: 0, ok: 0, error: String(e?.stack || e) });
});
