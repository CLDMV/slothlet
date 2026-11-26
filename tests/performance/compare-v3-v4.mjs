/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/performance/compare-v3-v4.mjs
 *	@Date: 2026-11-17T08:40:03-08:00 (1794933603)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T22:02:23-08:00 (1795586543)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * v3 → v4 performance comparison.
 *
 * Runs the same workloads (see `compare-v3-v4-worker.mjs`) against two slothlet builds on one machine, back to back:
 *
 * - **v3**: `@cldmv/slothlet@3.24.0` installed from the npm registry (its published `dist/`) into an isolated folder,
 *   with the `api_tests/api_test` fixtures and `api-test-config.jsonc` extracted from the `v3.24.0` git tag. The
 *   fixtures import `@cldmv/slothlet/runtime`, so they must resolve to the build being measured; each version uses
 *   its own copy of the fixture tree for that reason.
 * - **v4**: this checkout, either its built `dist/` (default when `dist/` exists) or `src/` through the
 *   `slothlet-dev` export condition.
 *
 * Every run is a fresh Node process loading one build. Rounds alternate which version goes first and which mode
 * (eager / lazy) goes first, so each version sees every position equally often. Per metric the report gives the
 * median over rounds and the spread (min–max and interquartile range).
 *
 * `--v3-version=<x.y.z>` measures another v3 release than 3.24.0 (setup installs it and extracts that tag's fixtures;
 * releases before 3.9.0 get the api folder as `dir`, their name for `base`). `--only=v3|v4` runs one version alone,
 * so each version can run on its own machine or container, one after another; `--report=<a.json>,<b.json>,…` then
 * merges those results into one table, a column per version in the order given, the last compared with each other.
 *
 * Usage:
 *   node tests/performance/compare-v3-v4.mjs --setup [--v3-version=<x.y.z>] [--v3-dir=<dir>]   # install + fixtures
 *   node tests/performance/compare-v3-v4.mjs [--rounds=8] [--v3-version=<x.y.z>] [--v3-dir=<dir>] [--v4=dist|src]
 *                                            [--only=v3|v4] [--out=<dir>] [--match-v3-defaults] [--quick]
 *   node tests/performance/compare-v3-v4.mjs --report=<a.json>,<b.json>[,…] [--out=<dir>]
 *
 * `--quick` runs 2 rounds with tiny iteration counts. It proves the harness runs end to end; its numbers mean nothing.
 * `--match-v3-defaults` passes `routines: { auto: false, stack: false }` to v4 (the v3 defaults of `autoRoutines` and
 * `stackRoutines`); without it each version runs with its own shipped defaults.
 */

import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");

const args = process.argv.slice(2);
/**
 * Reads a `--name=value` flag.
 * @param {string} name - Flag name without dashes.
 * @param {string} [fallback] - Default value.
 * @returns {string|undefined} The value.
 */
function flag(name, fallback) {
	const hit = args.find((arg) => arg.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
}
const has = (name) => args.includes(`--${name}`);

const V3_VERSION = flag("v3-version", "3.24.0");
if (!/^3\.\d+\.\d+$/u.test(V3_VERSION)) {
	throw new Error(`--v3-version must be a 3.x.y release, got ${V3_VERSION}`);
}
const only = flag("only");
if (only !== undefined && only !== "v3" && only !== "v4") {
	throw new Error("--only must be v3 or v4");
}
const quick = has("quick");
const v3Dir = resolve(REPO, flag("v3-dir", `tmp/perf-compare/v${V3_VERSION}`));
const outDir = resolve(REPO, flag("out", "tmp/perf-compare/results"));
const rounds = Number(flag("rounds", quick ? "2" : "8"));
const matchV3Defaults = has("match-v3-defaults");
const iterations = quick
	? { startup: 3, calls: 20, complex: 20, multi: 10, realistic: 50 }
	: { startup: 50, calls: 200, complex: 200, multi: 100, realistic: 500 };

/**
 * Whether a v3 release predates 3.9.0, which renamed the `dir` option to `base`.
 * @param {string} version - x.y.z.
 * @returns {boolean} True before 3.9.0.
 */
function takesDir(version) {
	const [major, minor] = version.split(".").map(Number);
	return major === 3 && minor < 9;
}

/**
 * Reads the CPU limit of the container the process runs in (cgroup v2), when there is one.
 * @returns {number|null} CPUs, or null without a limit.
 */
function cpuLimit() {
	try {
		const [quota, period] = readFileSync("/sys/fs/cgroup/cpu.max", "utf-8").trim().split(/\s+/u);
		return quota === "max" ? null : Number(quota) / Number(period);
	} catch {
		return null;
	}
}

/**
 * Installs the v3 release from the registry into `v3Dir` and extracts the tag's fixtures next to it.
 * @returns {Promise<void>}
 */
async function setup() {
	mkdirSync(v3Dir, { recursive: true });
	const pkgPath = join(v3Dir, "package.json");
	if (!existsSync(pkgPath)) {
		writeFileSync(pkgPath, JSON.stringify({ name: "slothlet-v3-bench", private: true, type: "module" }, null, "\t") + "\n");
	}
	// chokidar: api_test/events/watcher.mjs imports it; v3.24.0 declared ^6.0.0 (older fixtures don't import it).
	execFileSync("npm", ["install", `@cldmv/slothlet@${V3_VERSION}`, "chokidar@^6.0.0", "--no-audit", "--no-fund", "--ignore-scripts"], {
		cwd: v3Dir,
		stdio: "inherit"
	});
	const paths = ["api_tests/api_test", "tests/vitests/setup/api-test-config.jsonc"];
	let archive = null;
	try {
		archive = execFileSync("git", ["archive", `v${V3_VERSION}`, ...paths], {
			cwd: REPO,
			maxBuffer: 256 * 1024 * 1024,
			stdio: ["ignore", "pipe", "ignore"]
		});
	} catch {
		// No git checkout or no local tag: take the tag's source archive from GitHub instead.
	}
	if (archive) {
		execFileSync("tar", ["-x", "-C", v3Dir], { input: archive });
	} else {
		const url = `https://codeload.github.com/CLDMV/slothlet/tar.gz/refs/tags/v${V3_VERSION}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`could not download ${url}: ${response.status}`);
		}
		const tarball = Buffer.from(await response.arrayBuffer());
		execFileSync("tar", ["-xz", "-C", v3Dir, "--strip-components=1", ...paths.map((p) => `slothlet-${V3_VERSION}/${p}`)], {
			input: tarball
		});
	}
	console.log(`v3 ${V3_VERSION} ready in ${v3Dir}`);
}

/**
 * Describes the two builds under test.
 * @returns {object[]} Version descriptors.
 */
function versions() {
	if (only !== "v4") {
		const v3Pkg = join(v3Dir, "node_modules/@cldmv/slothlet/package.json");
		if (!existsSync(v3Pkg) || !existsSync(join(v3Dir, "api_tests/api_test"))) {
			throw new Error(`v3 build not found in ${v3Dir}; run with --setup first`);
		}
		const installed = JSON.parse(readFileSync(v3Pkg, "utf-8")).version;
		if (installed !== V3_VERSION) {
			throw new Error(`${v3Dir} holds @cldmv/slothlet ${installed}, expected ${V3_VERSION}`);
		}
	}
	const v4Source = flag("v4", existsSync(join(REPO, "dist")) ? "dist" : "src");
	if (v4Source !== "dist" && v4Source !== "src") {
		throw new Error("--v4 must be dist or src");
	}
	if (v4Source === "dist" && !existsSync(join(REPO, "dist"))) {
		throw new Error("--v4=dist needs a build: run npm run build first");
	}
	const v4Pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf-8"));
	let sha = "unknown";
	try {
		sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf-8" }).trim();
	} catch {
		// Not a git checkout; the version string still identifies the build.
	}
	const all = [
		{
			key: "v3",
			label: `v${V3_VERSION}`,
			source: "npm registry, dist",
			entry: join(v3Dir, "node_modules/@cldmv/slothlet/index.mjs"),
			apiDir: join(v3Dir, "api_tests/api_test"),
			configPath: join(v3Dir, "tests/vitests/setup/api-test-config.jsonc"),
			conditions: [],
			// The shared fixtures collide on purpose (`math.mjs` vs `math/`, `exportDefault`'s default vs named export) and
			// `api-test-config.jsonc` expects the `replace` outcome, as the test suites configure it (v3 shape here).
			extraOptions: {
				...(takesDir(V3_VERSION) ? { dir: join(v3Dir, "api_tests/api_test") } : {}),
				api: { collision: { initial: "replace", api: "replace" } }
			}
		},
		{
			key: "v4",
			label: `v${v4Pkg.version} (${sha})`,
			source: v4Source === "src" ? "this checkout, src/ (--conditions=slothlet-dev)" : "this checkout, dist/",
			entry: join(REPO, "index.mjs"),
			apiDir: join(REPO, "api_tests/api_test"),
			configPath: join(REPO, "tests/vitests/setup/api-test-config.jsonc"),
			conditions: v4Source === "src" ? ["--conditions=slothlet-dev"] : [],
			extraOptions: {
				api: { collision: { mode: { initial: "replace", api: "replace" } } },
				...(matchV3Defaults ? { routines: { auto: false, stack: false } } : {})
			}
		}
	];
	return only ? all.filter((v) => v.key === only) : all;
}

/**
 * Machine description for the report.
 * @returns {object} Node, OS, CPU, RAM.
 */
function machine() {
	let distro = os.type();
	try {
		const release = readFileSync("/etc/os-release", "utf-8");
		distro = /^PRETTY_NAME="?([^"\n]*)"?/mu.exec(release)?.[1] ?? distro;
	} catch {
		// Not Linux; os.type() stands in.
	}
	const cpus = os.cpus();
	return {
		node: process.version,
		os: `${distro} (${os.platform()} ${os.release()}, ${os.arch()})`,
		cpu: `${cpus[0]?.model ?? "unknown"}, ${cpus.length} logical processors`,
		ramGB: Math.round(os.totalmem() / 1024 ** 3),
		cpuLimit: cpuLimit()
	};
}

/**
 * Runs one worker process and parses its JSON line.
 * @param {object} version - Version descriptor.
 * @param {boolean} eagerFirst - Mode order inside the run.
 * @returns {Promise<object>} Worker result.
 */
function runWorker(version, eagerFirst) {
	const spec = {
		entry: version.entry,
		apiDir: version.apiDir,
		configPath: version.configPath,
		eagerFirst,
		iterations,
		extraOptions: version.extraOptions,
		seed: 0x5107
	};
	// Same environment for both builds: no inherited export conditions, no NODE_ENV switch.
	const env = { ...process.env, NODE_OPTIONS: "" };
	delete env.NODE_ENV;
	return new Promise((resolvePromise, reject) => {
		const child = spawn(
			process.execPath,
			[...version.conditions, join(__dirname, "compare-v3-v4-worker.mjs"), `--spec=${JSON.stringify(spec)}`],
			{
				env,
				stdio: ["ignore", "pipe", "pipe"]
			}
		);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("exit", (code) => {
			const line = stdout.trim().split("\n").pop();
			if (code !== 0 || !line?.startsWith("{")) {
				reject(new Error(`${version.label} worker exited ${code}\n${stderr}\n${stdout}`));
				return;
			}
			resolvePromise(JSON.parse(line));
		});
	});
}

/**
 * Summary statistics over rounds.
 * @param {number[]} values - One value per round.
 * @returns {{median: number, min: number, max: number, q1: number, q3: number, n: number}} Stats.
 */
function stats(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const quantile = (q) => {
		const pos = (sorted.length - 1) * q;
		const lo = Math.floor(pos);
		const hi = Math.ceil(pos);
		return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
	};
	return {
		median: quantile(0.5),
		min: sorted[0],
		max: sorted[sorted.length - 1],
		q1: quantile(0.25),
		q3: quantile(0.75),
		n: sorted.length
	};
}

/**
 * Formats milliseconds as ms or μs.
 * @param {number} ms - Milliseconds.
 * @returns {string} Display string.
 */
function fmt(ms) {
	return ms < 1 ? `${(ms * 1000).toFixed(2)}μs` : `${ms.toFixed(2)}ms`;
}

const LABELS = {
	"startup.eager": "Startup, eager (create + shutdown)",
	"startup.lazy": "Startup, lazy (create + shutdown)",
	"startup.eager.create": "Startup, eager (create only)",
	"startup.lazy.create": "Startup, lazy (create only)",
	"startup.eager.shutdown": "Shutdown, eager",
	"startup.lazy.shutdown": "Shutdown, lazy",
	"calls.eager": "Function call `math.add`, eager",
	"calls.lazy.first": "Function call `math.add`, lazy first call (materialization)",
	"calls.lazy": "Function call `math.add`, lazy subsequent",
	"complex.eager": "Nested `nested.date.today`, eager",
	"complex.lazy.first": "Nested `nested.date.today`, lazy first call",
	"complex.lazy": "Nested `nested.date.today`, lazy subsequent",
	"multi.mathAdd.eager": "`math/math.mjs`, eager",
	"multi.mathAdd.lazy.first": "`math/math.mjs`, lazy first call",
	"multi.mathAdd.lazy": "`math/math.mjs`, lazy subsequent",
	"multi.stringUpper.eager": "`string/string.mjs`, eager",
	"multi.stringUpper.lazy.first": "`string/string.mjs`, lazy first call",
	"multi.stringUpper.lazy": "`string/string.mjs`, lazy subsequent",
	"multi.funcmod.eager": "`funcmod/funcmod.mjs`, eager",
	"multi.funcmod.lazy.first": "`funcmod/funcmod.mjs`, lazy first call",
	"multi.funcmod.lazy": "`funcmod/funcmod.mjs`, lazy subsequent",
	"realistic.eager": "Realistic usage, eager",
	"realistic.lazy": "Realistic usage, lazy"
};

/**
 * Builds the markdown report.
 * @param {object} report - Full JSON report.
 * @returns {string} Markdown.
 */
function markdown(report) {
	const [a, b] = report.versions;
	const lines = [];
	lines.push(`### ${a.label} → ${b.label}`);
	lines.push("");
	lines.push(
		`${environment(report)} ${a.label}: ${a.source}. ${b.label}: ${b.source}${report.matchV3Defaults ? ", with `routines: { auto: false, stack: false }`" : ", shipped defaults"}.`
	);
	if (report.quick) {
		lines.push("");
		lines.push("> [!WARNING]");
		lines.push("> Quick smoke run (`--quick`): iteration counts are tiny and the numbers below are meaningless.");
	}
	lines.push("");
	lines.push(
		`Each cell is the median over rounds, with the interquartile range in brackets. "Change" is ${b.label.split(" ")[0]} relative to ${a.label}.`
	);
	lines.push("");
	lines.push(`| Workload | ${a.label} | ${b.label.split(" ")[0]} | Change |`);
	lines.push("| --- | --- | --- | --- |");
	for (const [metric, label] of Object.entries(LABELS)) {
		const sa = report.stats[a.key][metric];
		const sb = report.stats[b.key][metric];
		if (!sa || !sb) {
			continue;
		}
		const ratio = sb.median / sa.median;
		const change = ratio < 1 ? `${(1 / ratio).toFixed(2)}x faster` : `${ratio.toFixed(2)}x slower`;
		lines.push(
			`| ${label} | ${fmt(sa.median)} (${fmt(sa.q1)}–${fmt(sa.q3)}) | ${fmt(sb.median)} (${fmt(sb.q1)}–${fmt(sb.q3)}) | ${change} |`
		);
	}
	for (const mismatch of report.probeMismatches) {
		lines.push("");
		lines.push(
			`Probe \`${mismatch.probe}\` returned different values: ${mismatch.results.map((r) => `${r.who} → \`${r.value}\``).join(", ")}.`
		);
	}
	const failing = report.versions
		.map((v) => ({ v, list: [...new Set([...report.failing[v.key].eager, ...report.failing[v.key].lazy])] }))
		.filter(({ list }) => list.length > 0);
	if (failing.length > 0) {
		lines.push("");
		for (const { v, list } of failing) {
			lines.push(
				`Realistic-usage calls that threw or returned an unexpected value on ${v.label}: ${list.map((l) => `\`${l}\``).join(", ")}.`
			);
		}
	}
	return lines.join("\n") + "\n";
}

/**
 * One sentence describing where and how a report was measured.
 * @param {object} report - Full JSON report.
 * @returns {string} Sentence.
 */
function environment(report) {
	const limit = report.machine.cpuLimit ? `, limited to ${report.machine.cpuLimit} CPUs` : "";
	return `Measured ${report.date} on Node ${report.machine.node}, ${report.machine.os}, ${report.machine.cpu}${limit}, ${report.machine.ramGB} GB RAM. Load average (1/5/15 min) ${report.load.start.join(" / ")} at start and ${report.load.end.join(" / ")} at the end. ${report.rounds} rounds, each a fresh process; iterations per round: startup ${report.iterations.startup}, function calls ${report.iterations.calls}, nested ${report.iterations.complex}, per-module ${report.iterations.multi}, realistic ${report.iterations.realistic} (${report.realisticCalls} distinct calls).`;
}

/**
 * Builds one table from several reports (`--report`), a column per version in the order given. The last column is
 * compared with each earlier one.
 * @param {object[]} reports - Parsed JSON reports, each holding one or more versions.
 * @returns {string} Markdown.
 */
function mergedMarkdown(reports) {
	const columns = reports.flatMap((report) =>
		report.versions.map((v) => ({ label: v.label.split(" ")[0], full: v.label, source: v.source, stats: report.stats[v.key], report }))
	);
	const last = columns[columns.length - 1];
	const lines = [`### ${columns.map((c) => c.label).join(" / ")}`, ""];
	for (const c of columns) {
		lines.push(`- **${c.full}** (${c.source}): ${environment(c.report)}`);
	}
	lines.push("");
	lines.push(
		`Each cell is the median over rounds, with the interquartile range in brackets.${columns.length > 1 ? ` The change columns give ${last.label} relative to each earlier version.` : ""}`
	);
	lines.push("");
	const earlier = columns.slice(0, -1);
	lines.push(`| Workload | ${columns.map((c) => c.label).join(" | ")} |${earlier.map((c) => ` ${last.label} vs ${c.label} |`).join("")}`);
	lines.push(`| --- |${columns.map(() => " --- |").join("")}${earlier.map(() => " --- |").join("")}`);
	for (const [metric, label] of Object.entries(LABELS)) {
		if (columns.some((c) => !c.stats[metric])) {
			continue;
		}
		const cells = columns.map((c) => `${fmt(c.stats[metric].median)} (${fmt(c.stats[metric].q1)}–${fmt(c.stats[metric].q3)})`);
		const changes = earlier.map((c) => {
			const ratio = last.stats[metric].median / c.stats[metric].median;
			return ratio < 1 ? `${(1 / ratio).toFixed(2)}x faster` : `${ratio.toFixed(2)}x slower`;
		});
		lines.push(`| ${label} | ${[...cells, ...changes].join(" | ")} |`);
	}
	for (const report of reports) {
		for (const mismatch of report.probeMismatches) {
			lines.push("");
			lines.push(
				`Probe \`${mismatch.probe}\` returned different values: ${mismatch.results.map((r) => `${r.who} → \`${r.value}\``).join(", ")}.`
			);
		}
	}
	return lines.join("\n") + "\n";
}

/**
 * Entry point.
 * @returns {Promise<void>}
 */
async function main() {
	if (has("setup")) {
		await setup();
		return;
	}
	const reportFlag = flag("report");
	if (reportFlag) {
		const reports = reportFlag.split(",").map((file) => JSON.parse(readFileSync(resolve(file), "utf-8")));
		const md = mergedMarkdown(reports);
		mkdirSync(outDir, { recursive: true });
		const file = join(outDir, `compare-merged-${new Date().toISOString().replace(/[:.]/gu, "-")}.md`);
		writeFileSync(file, md);
		console.log("\n" + md);
		console.log(`Results: ${file}`);
		return;
	}
	const vs = versions();
	const load = { start: os.loadavg().map((n) => n.toFixed(2)) };
	const started = Date.now();
	const samples = Object.fromEntries(vs.map((v) => [v.key, []]));
	const failing = Object.fromEntries(vs.map((v) => [v.key, { eager: new Set(), lazy: new Set() }]));
	const runs = [];
	const probeResults = {};
	let realisticCalls = 0;

	console.log(`v3 → v4 comparison: ${rounds} rounds${quick ? " (QUICK: numbers are meaningless)" : ""}`);
	for (const v of vs) {
		console.log(`  ${v.label}: ${v.source}`);
	}
	if (vs.length === 2 && vs[1].conditions.length > 0) {
		console.log("  NOTE: v4 runs from src/ while v3 runs its published dist/. Run npm run build first for a like-for-like comparison.");
	}
	for (let round = 0; round < rounds; round++) {
		// Version order flips every round; mode order flips every two rounds, so 4 rounds cover every combination.
		const order = round % 2 === 0 ? vs : [...vs].reverse();
		const eagerFirst = Math.floor(round / 2) % 2 === 0;
		for (const v of order) {
			const result = await runWorker(v, eagerFirst);
			samples[v.key].push(result.metrics);
			realisticCalls = result.realistic.calls;
			probeResults[v.key] ??= result.probeResults;
			for (const mode of ["eager", "lazy"]) {
				for (const label of result.realistic.failing[mode]) {
					failing[v.key][mode].add(label);
				}
			}
			runs.push({ round, version: v.key, eagerFirst, elapsedMs: Math.round(result.elapsedMs), metrics: result.metrics });
			console.log(
				`  round ${round + 1}/${rounds} ${v.label.padEnd(18)} ${eagerFirst ? "eager-first" : "lazy-first "} ` +
					`startup eager ${fmt(result.metrics["startup.eager"])}, lazy ${fmt(result.metrics["startup.lazy"])} (${(result.elapsedMs / 1000).toFixed(1)}s)`
			);
		}
	}
	load.end = os.loadavg().map((n) => n.toFixed(2));

	const statsByVersion = {};
	for (const v of vs) {
		statsByVersion[v.key] = {};
		for (const metric of Object.keys(samples[v.key][0])) {
			statsByVersion[v.key][metric] = stats(samples[v.key].map((m) => m[metric]));
		}
	}
	// Every probe must return the same value on both versions and in both modes, or the timings compare different work.
	const probeMismatches = [];
	for (const name of Object.keys(probeResults[vs[0].key].eager)) {
		const seen = vs.flatMap((v) =>
			["eager", "lazy"].map((mode) => ({ who: `${v.label} ${mode}`, value: JSON.stringify(probeResults[v.key][mode][name]) }))
		);
		if (new Set(seen.map((s) => s.value)).size > 1) {
			probeMismatches.push({ probe: name, results: seen });
		}
	}
	const report = {
		date: new Date().toISOString().slice(0, 10),
		quick,
		rounds,
		iterations,
		matchV3Defaults,
		machine: machine(),
		load,
		wallClockSeconds: Math.round((Date.now() - started) / 1000),
		versions: vs.map(({ key, label, source, apiDir, extraOptions }) => ({ key, label, source, apiDir, extraOptions })),
		realisticCalls,
		probeResults,
		probeMismatches,
		failing: Object.fromEntries(vs.map((v) => [v.key, { eager: [...failing[v.key].eager], lazy: [...failing[v.key].lazy] }])),
		stats: statsByVersion,
		runs
	};

	mkdirSync(outDir, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
	const name = vs.length === 1 ? vs[0].label.split(" ")[0] : "v3-v4";
	const base = join(outDir, `compare-${name}-${quick ? "quick-" : ""}${stamp}`);
	const md = vs.length === 1 ? mergedMarkdown([report]) : markdown(report);
	writeFileSync(`${base}.json`, JSON.stringify(report, null, "\t") + "\n");
	writeFileSync(`${base}.md`, md);
	console.log("\n" + md);
	console.log(`Wall clock ${report.wallClockSeconds}s. Results: ${base}.json, ${base}.md`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
