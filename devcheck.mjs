/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /devcheck.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T09:10:46-08:00 (1793553046)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Development check for a CLDMV package's source checkout. The same file is used unchanged in
// every repo: the package name comes from the package.json next to it, and the dev condition is
// `<name without scope>-dev` (`@cldmv/uuid` -> `uuid-dev`). It is never published.
//
// Load it synchronously from the package entry, before anything else can run (see
// docs/conventions/package-layout.md in CLDMV/.github). It exits the process when the checkout is
// run without the dev condition, because imports then resolve to dist/ instead of src/: a stale
// build if one exists, and ERR_MODULE_NOT_FOUND before this file can run if none does.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect if we're running in a CI environment
const isCI = !!(
	process.env.CI || // Generic CI flag
	process.env.GITHUB_ACTIONS || // GitHub Actions
	process.env.TRAVIS || // Travis CI
	process.env.CIRCLECI || // CircleCI
	process.env.GITLAB_CI || // GitLab CI
	process.env.BUILDKITE || // Buildkite
	process.env.JENKINS_URL || // Jenkins
	process.env.TF_BUILD // Azure DevOps
);

// Skip when installed as a dependency (a `node_modules` segment anywhere above this file, which
// covers scoped installs too). The npm package ships neither src/ nor this file, but a git or
// tarball install includes both, and the check must never exit a consumer's app.
const isInstalledPackage = __dirname.split(path.sep).includes("node_modules");

// The package's own name, from the package.json beside this file. Without one there is no
// condition to check, so the check is skipped.
function readPackageName() {
	try {
		const { name } = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8"));
		return typeof name === "string" && name ? name : undefined;
	} catch {
		return undefined;
	}
}

// Only meaningful in a source checkout: with src/ present the developer should be loading from
// it via the dev condition, so warn even after a build, since a built checkout has both src/ and
// dist/ and the condition is the only thing that selects src/.
const packageName = existsSync(path.join(__dirname, "src")) && !isCI && !isInstalledPackage ? readPackageName() : undefined;

if (packageName) {
	const devCondition = `${packageName.split("/").pop()}-dev`;

	// The condition can come from NODE_OPTIONS or the node CLI (`--conditions=x`,
	// `--conditions x`, `-C x`), which lands in execArgv; vitest passes it to workers that way.
	// Each flag carries ONE literal value: Node does not split on `,` or `|`, and repeated flags
	// add more. So collect each value whole and match exactly: `not-uuid-dev`, `uuid-dev,x` and
	// `uuid-dev|production` don't count. The condition is namespaced, not the generic
	// `development`, so a consumer's own `--conditions=development` can't switch this package to
	// a source tree it doesn't ship. NODE_ENV is not consulted: it doesn't affect resolution.
	const conditions = [];
	const scan = (tokens) => {
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i] === "--conditions" || tokens[i] === "-C") {
				// Space form: take the next token as the value and skip it, so a value that looks
				// like a flag isn't read again on the next iteration.
				if (tokens[i + 1] !== undefined) {
					conditions.push(tokens[i + 1]);
					i++;
				}
			} else if (tokens[i].startsWith("--conditions=")) {
				conditions.push(tokens[i].slice("--conditions=".length));
			}
			// `-C=x` isn't handled: Node rejects it ("bad option"), so it never reaches here.
		}
	};
	scan(process.execArgv);
	scan((process.env.NODE_OPTIONS || "").split(/\s+/).filter(Boolean));

	if (!conditions.includes(devCondition)) {
		console.error("❌ Development environment not properly configured!");
		console.error(`📁 ${packageName}: source folder detected but the '${devCondition}' condition is not set,`);
		console.error("   so imports resolve to dist/ (or fail if it isn't built) instead of src/.");
		console.error("");
		console.error("🔧 To load from src/ for development, set the condition:");
		console.error("   Windows (cmd):");
		console.error(`     set NODE_OPTIONS=--conditions=${devCondition}`);
		console.error("");
		console.error("   Windows (PowerShell):");
		console.error(`     $env:NODE_OPTIONS='--conditions=${devCondition}'`);
		console.error("");
		console.error("   Unix/Linux/macOS:");
		console.error(`     export NODE_OPTIONS=--conditions=${devCondition}`);
		console.error("");
		console.error(`   ...or pass it directly: node --conditions=${devCondition} <file>`);
		console.error("");
		console.error(`💡 '${devCondition}' is namespaced so it can't conflict with a consumer's own`);
		console.error("   development conditions.");
		console.error("🚀 CI environments automatically skip this check.");
		process.exit(1);
	}
}
