/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/prepublish-check.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:58 -08:00 (1772425318)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(path.dirname(__dirname));

const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

const pkgName = pkg.name;
const pkgFile = fs.readdirSync(projectRoot).find((f) => f.endsWith(".tgz"));
const tmpDir = path.join(projectRoot, "tmp-npm-test");
const distDir = path.join(projectRoot, "dist");

try {
	// Create temp directory
	fs.mkdirSync(tmpDir, { recursive: true });

	// Create test file
	fs.writeFileSync(
		path.join(tmpDir, "test.js"),
		`
    //const { slothlet } = require("../${pkgFile}");
    const { slothlet } = require("${pkgName}");
    console.log(typeof slothlet === "function" ? "PASS" : "FAIL");
`
	);
	// Initialize npm project
	execSync("npm init -y", { cwd: tmpDir, stdio: "inherit" });

	// Install the packed module
	execSync(`npm install ../${pkgFile}`, { cwd: tmpDir, stdio: "inherit" });

	// Run the test in production mode (clear development environment variables)
	const productionEnv = { ...process.env };
	delete productionEnv.NODE_ENV;
	delete productionEnv.NODE_OPTIONS;
	productionEnv.NODE_ENV = "production";

	execSync("node test.js", {
		cwd: tmpDir,
		stdio: "inherit",
		env: productionEnv
	});

	console.log("✅ Package test passed. Ready to publish!");
} catch (err) {
	console.error("❌ Package test failed:", err);
} finally {
	// Cleanup
	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.rmSync(distDir, { recursive: true, force: true });
	if (pkgFile) fs.unlinkSync(pkgFile);
}
