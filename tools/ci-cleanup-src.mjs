/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/ci-cleanup-src.mjs
 *	@Date: 2025-12-08T01:23:27-08:00 (1765185807)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:39 -08:00 (1770266379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CI-only script to remove src folder after build to ensure dist usage
 * This script only runs in CI environments to avoid accidentally deleting developer src folders
 */

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname); // Go up one level from tools/ to project root
const srcPath = path.join(rootDir, "src");

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

async function removeSrcInCI() {
	if (!isCI) {
		console.log("⚠️  Not in CI environment - skipping src removal for safety");
		return;
	}

	if (!existsSync(srcPath)) {
		console.log("✅ src folder doesn't exist - nothing to remove");
		return;
	}

	console.log("🧹 CI environment detected - removing src folder to force dist usage");
	try {
		await rm(srcPath, { recursive: true, force: true });
		console.log("✅ src folder removed successfully");
	} catch (error) {
		console.error("❌ Failed to remove src folder:", error.message);
		process.exit(1);
	}
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	removeSrcInCI();
}

export { removeSrcInCI };
