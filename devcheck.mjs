/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /devcheck.mjs
 *	@Date: 2025-12-08 01:28:12 -08:00 (1765186092)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-07 17:30:26 -08:00 (1767835826)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcPath = path.join(__dirname, "src");
// const distPath = path.join(__dirname, "dist");

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

if (existsSync(srcPath) && !isCI) {
	// if (existsSync(srcPath) && !existsSync(distPath)) {
	const nodeEnv = process.env.NODE_ENV?.toLowerCase();
	const nodeOptions = process.env.NODE_OPTIONS || "";

	// Check if running from node_modules (parent folder is node_modules)
	const parentFolder = path.basename(path.dirname(__dirname));
	const isInstalledPackage = parentFolder === "node_modules";

	// Parse conditions from NODE_OPTIONS
	const hasSlothletDev = nodeOptions.indexOf("--conditions=slothlet-dev") !== -1;
	const hasGenericDev = nodeOptions.indexOf("--conditions=development") !== -1;
	const hasDevEnv = nodeEnv === "dev" || nodeEnv === "development";

	// Only check if we're in the slothlet repo (not installed in node_modules)
	if (!isInstalledPackage && !hasSlothletDev) {
		let errorMessage = "";

		// Determine which error message to show based on current state
		if (hasDevEnv && hasGenericDev) {
			// They have generic dev settings - tell them to switch to slothlet-dev
			errorMessage =
				"❌ Incorrect development environment detected!\n" +
				"📁 You have generic development settings (NODE_ENV=development, --conditions=development).\n" +
				"\n" +
				"⚠️  This causes slothlet to load from src/ which breaks tests and builds!\n" +
				"\n" +
				"🔧 Switch to slothlet-specific development settings:\n" +
				"   Windows (cmd):\n" +
				"     set NODE_OPTIONS=--conditions=slothlet-dev\n" +
				"\n" +
				"   Windows (PowerShell):\n" +
				"     $env:NODE_OPTIONS='--conditions=slothlet-dev'\n" +
				"\n" +
				"   Unix/Linux/macOS:\n" +
				"     export NODE_OPTIONS=--conditions=slothlet-dev\n" +
				"\n" +
				"💡 Using 'slothlet-dev' prevents conflicts with apps that use slothlet.";
		} else {
			// They don't have proper settings at all
			errorMessage =
				"❌ Development environment not properly configured!\n" +
				"📁 Source folder detected but NODE_ENV/NODE_OPTIONS not set for slothlet development.\n" +
				"\n" +
				"🔧 To fix this, run one of these commands:\n" +
				"   Windows (cmd):\n" +
				"     set NODE_ENV=development\n" +
				"     set NODE_OPTIONS=--conditions=slothlet-dev\n" +
				"\n" +
				"   Windows (PowerShell):\n" +
				"     $env:NODE_ENV='development'\n" +
				"     $env:NODE_OPTIONS='--conditions=slothlet-dev'\n" +
				"\n" +
				"   Unix/Linux/macOS:\n" +
				"     export NODE_ENV=development\n" +
				"     export NODE_OPTIONS=--conditions=slothlet-dev\n" +
				"\n" +
				"💡 This ensures slothlet loads from src/ instead of dist/ for development.\n" +
				"🔧 Using 'slothlet-dev' prevents conflicts with consumer development settings.\n" +
				"🚀 CI environments automatically skip this check.";
		}

		console.error(errorMessage);
		throw new Error(errorMessage);
		// eslint-disable-next-line no-unreachable
		process.exit(1);
	}
}
