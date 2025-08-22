// index.cjs
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function pickSyncTarget() {
	// const cjs = path.join(__dirname, "dist", "slothlet.cjs");
	// if (fs.existsSync(cjs)) return { kind: "cjs", file: cjs };

	const distEsm = path.join(__dirname, "dist", "slothlet.mjs");
	if (fs.existsSync(distEsm)) return { kind: "mjs", file: distEsm };

	const srcEsm = path.join(__dirname, "src", "slothlet.mjs");
	return { kind: "mjs", file: srcEsm };
}

const choice = pickSyncTarget();

if (choice.kind === "cjs") {
	module.exports = require(choice.file); // callable if your CJS build is callable
} else {
	// ESM fallback: return a CALLABLE proxy that resolves lazily
	let cache = null;
	let loading = null;

	async function load() {
		if (cache) return cache;
		if (!loading) {
			const url = pathToFileURL(choice.file).href;
			loading = import(url).then((m) => (cache = m && m.default ? m.default : m));
		}
		return loading;
	}

	function makeCallableProxy() {
		const target = function () {};
		return new Proxy(target, {
			get(_t, prop) {
				if (prop === "then") return undefined; // not a promise
				if (prop === "$load") return load; // optional explicit init
				return (...args) =>
					load().then((ns) => {
						const v = ns[prop];
						if (typeof v === "function") return v.apply(ns, args);
						if (args.length === 0) return v; // getter: await slothlet.prop
						throw new TypeError(`@cldmv/slothlet: "${String(prop)}" is not callable`);
					});
			},
			apply(_t, thisArg, argArray) {
				return load().then((ns) => {
					if (typeof ns !== "function") {
						throw new TypeError("@cldmv/slothlet: loaded module is not callable");
					}
					return ns.apply(thisArg, argArray);
				});
			}
		});
	}

	module.exports = makeCallableProxy();
}
