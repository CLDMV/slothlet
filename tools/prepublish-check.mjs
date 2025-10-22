/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/prepublish-check.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 08:59:59 -07:00 (1761148799)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const pkg = JSON.parse(
	fs.readFileSync(
		path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\\?\/[A-Za-z]:/, "")), "..", "package.json"),
		"utf8"
	)
);

const pkgName = pkg.name;
const pkgFile = fs.readdirSync(".").find((f) => f.endsWith(".tgz"));
const tmpDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\\?\/[A-Za-z]:/, "")), "..", "tmp-npm-test");
const distDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\\?\/[A-Za-z]:/, "")), "..", "dist");

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
