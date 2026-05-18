#!/usr/bin/env node
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /bin/slothlet.mjs
 *	@Date: 2026-05-12 19:50:37 -07:00 (1778640637)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:57:57 -07:00 (1778641077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Slothlet CLI entrypoint.
 * @public
 *
 * @description
 * Currently provides one subcommand:
 *   - `typegen`: generate a TypeScript .d.ts file describing a Slothlet API directory.
 *
 * Three argument shapes are accepted (in order of precedence):
 *   1. Flags: `--dir` / `-d`, `--output` / `-o`, `--interface-name` / `-n`
 *   2. Positional: `<dir> <output> <interfaceName>`
 *   3. Fallback: `slothlet.typegen` field in the project's `package.json`
 *
 * Flags override positional, positional overrides package.json. Any combination
 * is allowed — missing fields fall through to the next source.
 *
 * @example
 * # All three forms produce the same result:
 * slothlet typegen ./api ./types/api.d.ts MyApi
 * slothlet typegen --dir ./api --output ./types/api.d.ts --interface-name MyApi
 * # With package.json containing { "slothlet": { "typegen": { "dir": "./api", "output": "./types/api.d.ts", "interfaceName": "MyApi" } } }:
 * slothlet typegen
 */
import fs from "node:fs";
import path from "node:path";
import { generateTypes } from "@cldmv/slothlet/typegen";

const argv = process.argv.slice(2);
const subcommand = argv[0];

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
	printRootHelp();
	process.exit(subcommand ? 0 : 1);
}

if (subcommand === "typegen") {
	await runTypegen(argv.slice(1));
} else {
	process.stderr.write(`slothlet: unknown command '${subcommand}'\n\n`);
	printRootHelp();
	process.exit(1);
}

/**
 * Print top-level help text.
 * @returns {void}
 * @private
 */
function printRootHelp() {
	process.stdout.write(`Usage: slothlet <command> [options]

Commands:
  typegen [options]    Generate a TypeScript .d.ts file for a Slothlet API directory

Run 'slothlet <command> --help' for command-specific options.
`);
}

/**
 * Print typegen subcommand help text.
 * @returns {void}
 * @private
 */
function printTypegenHelp() {
	process.stdout.write(`Usage: slothlet typegen [<dir> <output> <interfaceName>]
       slothlet typegen --dir <dir> --output <output> --interface-name <name>
       slothlet typegen        # reads from "slothlet.typegen" in package.json

Generates a TypeScript .d.ts file describing the API loaded from <dir>.
The file declares an interface named <interfaceName> and a 'self' constant of
that interface type, so '.ts' modules in your API can use 'self.*' with full
autocomplete and type-checking.

Options:
  -d, --dir <path>              Path to the API directory
  -o, --output <path>           Output path for the generated .d.ts
  -n, --interface-name <name>   Name of the generated TypeScript interface
  -h, --help                    Show this help

Resolution order (per option): flag → positional → package.json's "slothlet.typegen".

Examples:
  slothlet typegen ./api ./types/api.d.ts MyApi
  slothlet typegen --dir ./api --output ./types/api.d.ts --interface-name MyApi
  slothlet typegen        # reads { "slothlet": { "typegen": { ... } } } from package.json
`);
}

/**
 * Run the typegen subcommand.
 * @param {string[]} args - Arguments after the `typegen` subcommand
 * @returns {Promise<void>}
 * @private
 */
async function runTypegen(args) {
	if (args.includes("--help") || args.includes("-h")) {
		printTypegenHelp();
		process.exit(0);
	}

	let parsed;
	try {
		parsed = parseTypegenArgs(args);
	} catch (err) {
		process.stderr.write(`slothlet typegen: ${err.message}\n\n`);
		printTypegenHelp();
		process.exit(2);
	}

	const resolved = mergeWithPackageJson(parsed);

	const missing = ["dir", "output", "interfaceName"].filter((k) => !resolved[k]);
	if (missing.length > 0) {
		process.stderr.write(
			`slothlet typegen: missing required option(s): ${missing.join(", ")}.\n` +
				`Provide them as flags, positional args, or in package.json's "slothlet.typegen" field.\n\n`
		);
		printTypegenHelp();
		process.exit(2);
	}

	try {
		const result = await generateTypes(resolved);
		process.stdout.write(`✓ Wrote ${result.filePath}\n`);
		process.exit(0);
	} catch (err) {
		process.stderr.write(`slothlet typegen failed: ${err.message ?? err}\n`);
		process.exit(1);
	}
}

/**
 * Parse typegen flags and positional args. Throws on flag-without-value.
 * Unknown long flags throw; unknown positional args are stored but later checks decide what to do.
 * @param {string[]} args
 * @returns {{dir?: string, output?: string, interfaceName?: string}}
 * @private
 */
function parseTypegenArgs(args) {
	const opts = {};
	const positional = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-d" || arg === "--dir") {
			opts.dir = requireValue(args, ++i, arg);
		} else if (arg === "-o" || arg === "--output") {
			opts.output = requireValue(args, ++i, arg);
		} else if (arg === "-n" || arg === "--interface-name") {
			opts.interfaceName = requireValue(args, ++i, arg);
		} else if (arg.startsWith("-")) {
			throw new Error(`unknown option '${arg}'`);
		} else {
			positional.push(arg);
		}
	}
	if (opts.dir === undefined && positional[0]) opts.dir = positional[0];
	if (opts.output === undefined && positional[1]) opts.output = positional[1];
	if (opts.interfaceName === undefined && positional[2]) opts.interfaceName = positional[2];
	return opts;
}

/**
 * Pull a required flag value from argv. Throws if missing or another flag.
 * @param {string[]} args
 * @param {number} idx
 * @param {string} flagName
 * @returns {string}
 * @private
 */
function requireValue(args, idx, flagName) {
	const value = args[idx];
	if (value === undefined || value.startsWith("-")) {
		throw new Error(`option '${flagName}' requires a value`);
	}
	return value;
}

/**
 * Fill missing options from `package.json` → `slothlet.typegen`. Missing or
 * unparseable package.json is treated as an empty source (no error).
 * @param {{dir?: string, output?: string, interfaceName?: string}} opts
 * @returns {{dir?: string, output?: string, interfaceName?: string}}
 * @private
 */
function mergeWithPackageJson(opts) {
	if (opts.dir && opts.output && opts.interfaceName) return opts;

	const pkgPath = path.resolve(process.cwd(), "package.json");
	if (!fs.existsSync(pkgPath)) return opts;

	let pkg;
	try {
		pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
	} catch {
		return opts;
	}

	const fromPkg = pkg?.slothlet?.typegen ?? {};
	return {
		dir: opts.dir ?? fromPkg.dir,
		output: opts.output ?? fromPkg.output,
		interfaceName: opts.interfaceName ?? fromPkg.interfaceName
	};
}
