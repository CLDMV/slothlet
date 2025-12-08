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
	const hasSlothletDev = process.env.NODE_OPTIONS?.includes("--conditions=slothlet-dev");

	if (!nodeEnv || (!["dev", "development"].includes(nodeEnv) && !hasSlothletDev)) {
		console.error("❌ Development environment not properly configured!");
		console.error("📁 Source folder detected but NODE_ENV/NODE_OPTIONS not set for slothlet development.");
		console.error("");
		console.error("🔧 To fix this, run one of these commands:");
		console.error("   Windows (cmd):");
		console.error("     set NODE_ENV=development");
		console.error("     set NODE_OPTIONS=--conditions=slothlet-dev");
		console.error("");
		console.error("   Windows (PowerShell):");
		console.error("     $env:NODE_ENV='development'");
		console.error("     $env:NODE_OPTIONS='--conditions=slothlet-dev'");
		console.error("");
		console.error("   Unix/Linux/macOS:");
		console.error("     export NODE_ENV=development");
		console.error("     export NODE_OPTIONS=--conditions=slothlet-dev");
		console.error("");
		console.error("💡 This ensures slothlet loads from src/ instead of dist/ for development.");
		console.error("🔧 Using 'slothlet-dev' prevents conflicts with consumer development settings.");
		console.error("🚀 CI environments automatically skip this check.");
		process.exit(1);
	}
}
