// index.mjs
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pickTarget() {
	const dist = path.join(__dirname, "dist", "slothlet.mjs");
	if (existsSync(dist)) return pathToFileURL(dist).href;
	const src = path.join(__dirname, "src", "slothlet.mjs");
	return pathToFileURL(src).href;
}

const mod = await import(pickTarget());
const slothlet = mod?.default ?? mod; // callable default expected

export default slothlet;
export { slothlet }; // optional named alias
