/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/performance/compare-v3-v4-worker.mjs
 *	@Date: 2026-11-17T08:39:03-08:00 (1794933543)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:54-08:00 (1795869054)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Worker for the v3 → v4 performance comparison (`compare-v3-v4.mjs`).
 *
 * One process loads exactly one slothlet build, runs every workload once in the order it was given, and prints a
 * single JSON object on stdout. The parent spawns one worker per (round, version) so the two builds never share a
 * process, a module cache or a JIT state.
 *
 * The workloads mirror `performance-benchmark-aggregated.mjs`: startup (eager / lazy), function calls on
 * `math.add`, the nested `nested.date.today` module, the three multi-module probes (`math.add`, `string.upper`,
 * `funcmod`), and realistic usage over the `apiTests` calls in `api-test-config.jsonc`. Each workload calls the api
 * directly (no materialize helpers), so the call path is the same public path on both versions.
 *
 * Input: one argv entry, `--spec=<json>` (see `compare-v3-v4.mjs` → `buildWorkerSpec`).
 */

import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const specArg = process.argv.find((arg) => arg.startsWith("--spec="));
if (!specArg) {
	throw new Error("compare-v3-v4-worker: missing --spec=<json>");
}
const spec = JSON.parse(specArg.slice("--spec=".length));
const { entry, apiDir, configPath, eagerFirst, iterations, extraOptions, seed } = spec;

const { default: slothlet } = await import(pathToFileURL(entry).href);

/**
 * Builds the options object for one instance.
 * @param {"eager"|"lazy"} mode - Loading mode.
 * @returns {object} Options for slothlet().
 */
function options(mode) {
	return { base: apiDir, mode, ...(extraOptions ?? {}) };
}

/**
 * Mean of an array of numbers.
 * @param {number[]} values - Samples.
 * @returns {number} Arithmetic mean.
 */
function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Times one async call.
 * @param {Function} fn - Work to time.
 * @returns {Promise<{time: number, result: unknown}>} Elapsed milliseconds and the result.
 */
async function timeOnce(fn) {
	const start = performance.now();
	const result = await fn();
	return { time: performance.now() - start, result };
}

/**
 * Runs fn `count` times and returns the mean elapsed time in milliseconds.
 * @param {Function} fn - Work to time.
 * @param {number} count - Iterations.
 * @returns {Promise<number>} Mean milliseconds per iteration.
 */
async function timeMean(fn, count) {
	const times = [];
	for (let i = 0; i < count; i++) {
		times.push((await timeOnce(fn)).time);
	}
	return mean(times);
}

// Each probe's first result is reported back, and the parent checks that both versions (and both modes) returned
// the same value, so a timing is never compared across two different call paths.
const probes = {
	mathAdd: (api) => api.math.add(2, 3),
	stringUpper: (api) => api.string.upper("test"),
	funcmod: (api) => api.funcmod(5, 6),
	nestedDate: (api) => api.nested.date.today()
};
const probeResults = { eager: {}, lazy: {} };

/**
 * Startup: create + shutdown, the same unit `performance-benchmark-aggregated.mjs` measures. Create-only and
 * shutdown-only means are recorded next to it.
 * @param {"eager"|"lazy"} mode - Loading mode.
 * @returns {Promise<{total: number, create: number, shutdown: number}>} Mean milliseconds.
 */
async function startup(mode) {
	const create = [];
	const shutdown = [];
	for (let i = 0; i < iterations.startup; i++) {
		const t0 = performance.now();
		const api = await slothlet(options(mode));
		const t1 = performance.now();
		await api.shutdown();
		const t2 = performance.now();
		create.push(t1 - t0);
		shutdown.push(t2 - t1);
	}
	return { total: mean(create) + mean(shutdown), create: mean(create), shutdown: mean(shutdown) };
}

/**
 * One probe on a fresh instance: the first call (materialization in lazy mode) and the mean of the next `count`.
 * @param {"eager"|"lazy"} mode - Loading mode.
 * @param {keyof typeof probes} name - Probe name.
 * @param {number} count - Subsequent iterations.
 * @returns {Promise<{first: number, subsequent: number}>} Milliseconds; the first result goes to `probeResults`.
 */
async function probe(mode, name, count) {
	const call = probes[name];
	const api = await slothlet(options(mode));
	try {
		const first = await timeOnce(() => call(api));
		probeResults[mode][name] = first.result;
		const subsequent = await timeMean(() => call(api), count);
		return { first: first.time, subsequent };
	} finally {
		await api.shutdown();
	}
}

/**
 * Deterministic PRNG (mulberry32) so both versions draw the same realistic-usage call sequence.
 * @param {number} a - Seed.
 * @returns {() => number} Generator of floats in [0, 1).
 */
function mulberry32(a) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Executes one config call ({ path, args }).
 * @param {object} api - Api instance.
 * @param {{path: string[], args: unknown[]}} call - Call description.
 * @returns {Promise<unknown>} Result.
 */
async function executeApiCall(api, call) {
	let target = api;
	for (const segment of call.path) {
		target = target[segment];
	}
	return typeof target === "function" ? await target(...call.args) : target;
}

/**
 * Realistic usage: warm every config call once, then time `iterations.realistic` calls drawn with a fixed seed.
 * Calls that throw or return something other than `expected` are counted and listed, not hidden.
 * @param {"eager"|"lazy"} mode - Loading mode.
 * @returns {Promise<{mean: number, calls: number, failing: string[]}>} Mean milliseconds per call and failures.
 */
async function realistic(mode) {
	const raw = await readFile(configPath, "utf-8");
	const config = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, ""));
	const calls = config.testConfig.apiTests.flatMap((section) => section.calls);
	const api = await slothlet(options(mode));
	const failing = new Set();
	try {
		for (const call of calls) {
			try {
				const result = await executeApiCall(api, call);
				if ("expected" in call && JSON.stringify(result) !== JSON.stringify(call.expected)) {
					failing.add(call.label ?? call.path.join("."));
				}
			} catch {
				failing.add(call.label ?? call.path.join("."));
			}
		}
		const random = mulberry32(seed);
		const times = [];
		for (let i = 0; i < iterations.realistic; i++) {
			const call = calls[Math.floor(random() * calls.length)];
			const start = performance.now();
			try {
				await executeApiCall(api, call);
			} catch {
				// Counted in the warm-up pass above.
			}
			times.push(performance.now() - start);
		}
		return { mean: mean(times), calls: calls.length, failing: [...failing] };
	} finally {
		await api.shutdown();
	}
}

/**
 * All workloads for one mode, in a fixed order.
 * @param {"eager"|"lazy"} mode - Loading mode.
 * @returns {Promise<object>} Raw per-mode results.
 */
async function runMode(mode) {
	const out = {};
	out.startup = await startup(mode);
	out.calls = await probe(mode, "mathAdd", iterations.calls);
	out.complex = await probe(mode, "nestedDate", iterations.complex);
	out.multi = {};
	for (const name of ["mathAdd", "stringUpper", "funcmod"]) {
		out.multi[name] = await probe(mode, name, iterations.multi);
	}
	out.realistic = await realistic(mode);
	return out;
}

const started = performance.now();
const modes = eagerFirst ? ["eager", "lazy"] : ["lazy", "eager"];
const results = {};
for (const mode of modes) {
	results[mode] = await runMode(mode);
}

// Flatten to "metric → milliseconds" so the parent aggregates every metric the same way.
const metrics = {
	"startup.eager": results.eager.startup.total,
	"startup.lazy": results.lazy.startup.total,
	"startup.eager.create": results.eager.startup.create,
	"startup.lazy.create": results.lazy.startup.create,
	"startup.eager.shutdown": results.eager.startup.shutdown,
	"startup.lazy.shutdown": results.lazy.startup.shutdown,
	"calls.eager": results.eager.calls.subsequent,
	"calls.lazy.first": results.lazy.calls.first,
	"calls.lazy": results.lazy.calls.subsequent,
	"complex.eager": results.eager.complex.subsequent,
	"complex.lazy.first": results.lazy.complex.first,
	"complex.lazy": results.lazy.complex.subsequent,
	"realistic.eager": results.eager.realistic.mean,
	"realistic.lazy": results.lazy.realistic.mean
};
for (const name of Object.keys(results.eager.multi)) {
	metrics[`multi.${name}.eager`] = results.eager.multi[name].subsequent;
	metrics[`multi.${name}.lazy.first`] = results.lazy.multi[name].first;
	metrics[`multi.${name}.lazy`] = results.lazy.multi[name].subsequent;
}

process.stdout.write(
	JSON.stringify({
		eagerFirst,
		metrics,
		probeResults,
		realistic: {
			calls: results.eager.realistic.calls,
			failing: { eager: results.eager.realistic.failing, lazy: results.lazy.realistic.failing }
		},
		elapsedMs: performance.now() - started
	}) + "\n"
);
// Fixture modules (the chokidar watcher, the tcp server) can leave handles open after shutdown.
process.exit(0);
