import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcPath = path.join(__dirname, "src");

if (existsSync(srcPath)) {
	const nodeEnv = process.env.NODE_ENV?.toLowerCase();
	const hasNodeOptions = process.env.NODE_OPTIONS?.includes("--conditions=development");

	if (!nodeEnv || (!["dev", "development"].includes(nodeEnv) && !hasNodeOptions)) {
		console.error("❌ Development environment not properly configured!");
		console.error("📁 Source folder detected but NODE_ENV/NODE_OPTIONS not set for development.");
		console.error("");
		console.error("🔧 To fix this, run one of these commands:");
		console.error("   Windows (cmd):");
		console.error("     set NODE_ENV=development");
		console.error("     set NODE_OPTIONS=--conditions=development");
		console.error("");
		console.error("   Windows (PowerShell):");
		console.error("     $env:NODE_ENV='development'");
		console.error("     $env:NODE_OPTIONS='--conditions=development'");
		console.error("");
		console.error("   Unix/Linux/macOS:");
		console.error("     export NODE_ENV=development");
		console.error("     export NODE_OPTIONS=--conditions=development");
		console.error("");
		console.error("💡 This ensures slothlet loads from src/ instead of dist/ for development.");
		process.exit(1);
	}
}
