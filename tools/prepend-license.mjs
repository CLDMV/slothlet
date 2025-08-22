import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEXT_EXTS = new Set([".js", ".mjs", ".cjs", ".css", ".scss", ".less", ".html", ".jsonc", ".yml", ".yaml"]);

const APACHE_MARKER = "Licensed under the Apache License, Version 2.0";
const root = path.join(__dirname, "..");
const licensePath = path.join(root, ".configs", "license-header.txt");

function parseArgv(argv) {
	const out = { dir: null, owner: null, year: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--owner") out.owner = argv[++i] ?? null;
		else if (a.startsWith("--owner=")) out.owner = a.slice(8);
		else if (a === "--year") out.year = argv[++i] ?? null;
		else if (a.startsWith("--year=")) out.year = a.slice(7);
		else if (!a.startsWith("-") && !out.dir) out.dir = a; // first non-flag = target dir
	}
	return out;
}

// Parse "Name <email> (Company)" -> { name, company? }
function parsePersonString(s) {
	const companyMatch = s.match(/\(([^)]+)\)/);
	const nameMatch = s.match(/^([^<(]+)/);
	return {
		name: (nameMatch ? nameMatch[1] : s).trim(),
		company: companyMatch ? companyMatch[1].trim() : undefined
	};
}

function getAuthorName(pkg) {
	const a = pkg.author;
	if (!a) return undefined;
	if (typeof a === "string") return parsePersonString(a).name;
	if (typeof a === "object") return a.name?.trim() || undefined;
	return undefined;
}

function getAuthorCompany(pkg) {
	const a = pkg.author;
	if (a && typeof a === "object" && a.company && String(a.company).trim()) {
		return String(a.company).trim();
	}
	return undefined;
}

function getFirstContributor(pkg) {
	if (!Array.isArray(pkg.contributors) || pkg.contributors.length === 0) return undefined;
	const c = pkg.contributors[0];
	if (typeof c === "string") return parsePersonString(c);
	if (c && typeof c === "object") {
		return {
			name: c.name?.trim(),
			company: c.company?.trim() || c.organization?.trim()
		};
	}
	return undefined;
}

function makeOwnerFromPkg(pkg) {
	const authorName = getAuthorName(pkg);
	const authorCompany = getAuthorCompany(pkg);

	const firstContrib = getFirstContributor(pkg);
	const contribCompany = firstContrib?.company;
	const contribName = firstContrib?.name;

	// company precedence: author.company -> contributors[0].company -> contributors[0].name
	const company = authorCompany || contribCompany || contribName;
	const author = authorName;

	if (company && author) return `${company}/${author}`;
	if (company) return company;
	if (author) return author;

	// final fallbacks
	if (pkg.name && typeof pkg.name === "string") return pkg.name.replace(/^@[^/]+\//, "");
	return path.basename(root);
}

function getYear(cliYear) {
	const y = cliYear && String(cliYear).trim();
	if (y && /^\d{4}$/.test(y)) return y;
	return String(new Date().getFullYear());
}

async function resolveOwner(cliOwner) {
	if (cliOwner && String(cliOwner).trim()) return String(cliOwner).trim();
	try {
		const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf8");
		const pkg = JSON.parse(pkgRaw);
		return makeOwnerFromPkg(pkg);
	} catch {
		return path.basename(root);
	}
}

async function loadTemplate(owner, year) {
	const tpl = await fs.readFile(licensePath, "utf8");
	return tpl.replaceAll("[{date}]", year).replaceAll("[{owner}]", owner);
}

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const d of entries) {
		const p = path.join(dir, d.name);
		if (d.isDirectory()) {
			if (d.name === "node_modules" || d.name === ".git") continue;
			yield* walk(p);
		} else {
			yield p;
		}
	}
}

function looksTextFile(file) {
	const ext = path.extname(file).toLowerCase();
	return TEXT_EXTS.has(ext);
}

async function prependLicenseToFile(file, banner) {
	if (!looksTextFile(file)) return;
	let content = await fs.readFile(file, "utf8");

	content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

	if (content.includes(APACHE_MARKER)) return;

	let shebang = "";
	if (content.startsWith("#!")) {
		const idx = content.indexOf("\n");
		if (idx !== -1) {
			shebang = content.slice(0, idx + 1);
			content = content.slice(idx + 1);
		} else {
			shebang = content + "\n";
			content = "";
		}
	}

	const EOL = content.includes("\r\n") ? "\r\n" : "\n";

	function wrapBanner(content, fileExt) {
		switch (fileExt) {
			case ".js":
			case ".mjs":
			case ".cjs":
			case ".ts":
			case ".mts":
			case ".cts":
			case ".css":
			case ".scss":
			case ".less":
				return `/*${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}*/${EOL}${EOL}`;
			case ".html":
			case ".hbs":
				return `<!--${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}-->${EOL}${EOL}`;
			case ".json":
			case ".jsonc":
			case ".yml":
			case ".yaml":
			case ".md":
				return (
					banner
						.split(/\r?\n/)
						.map((l) => `# ${l}`)
						.join(EOL) +
					EOL +
					EOL
				);
			default:
				// default to /* ... */
				return `/*${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}*/${EOL}${EOL}`;
		}
	}

	const ext = path.extname(file).toLowerCase();
	const header = wrapBanner(content, ext);
	const out = shebang + header + content;
	await fs.writeFile(file, out, "utf8");
	process.stdout.write(`prepended: ${file}\n`);
}

async function main() {
	const { dir, owner: ownerArg, year: yearArg } = parseArgv(process.argv);
	const targetDir = dir || path.join(root, "dist");

	const stat = await fs.stat(targetDir).catch(() => null);
	if (!stat || !stat.isDirectory()) {
		console.error(`error: target directory not found: ${targetDir}`);
		process.exit(1);
	}

	const owner = await resolveOwner(ownerArg);
	const year = getYear(yearArg);
	const banner = await loadTemplate(owner, year);

	for await (const file of walk(targetDir)) {
		await prependLicenseToFile(file, banner).catch((err) => {
			console.error(`failed: ${file}\n${err.stack || err}`);
		});
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
