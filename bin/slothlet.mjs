#!/usr/bin/env node
/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: bin/slothlet.mjs
 *	@Date: 2026-05-12T19:50:37-07:00 (1778640637)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:33-08:00 (1795869033)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
 *   1. Flags: `--base` / `-b`, `--output` / `-o`, `--name` / `-n`, `--no-augment`
 *   2. Positional: `<base> <output> <name>`
 *   3. Fallback: `slothlet.typegen` field in the project's `package.json`
 *
 * Flags override positional, positional overrides package.json. Any combination
 * is allowed — missing fields fall through to the next source.
 *
 * @example
 * # All three forms produce the same result:
 * slothlet typegen ./api ./types/api.d.ts MyApi
 * slothlet typegen --base ./api --output ./types/api.d.ts --name MyApi
 * # With package.json containing { "slothlet": { "typegen": { "base": "./api", "output": "./types/api.d.ts", "name": "MyApi" } } }:
 * slothlet typegen
 */
import fs from "node:fs";
import path from "node:path";
import { generate } from "@cldmv/slothlet/typegen";

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
	process.stdout.write(`Usage: slothlet typegen [<base> <output> <name>]
       slothlet typegen --base <base> --output <output> --name <name>
       slothlet typegen        # reads from "slothlet.typegen" in package.json

Generates a TypeScript .d.ts file describing the API loaded from <base>.
The file declares an interface named <name> and extends 'SlothletSelf'
from '@cldmv/slothlet/runtime' with it, so every module that imports 'self'
(.ts, .mts, or JSDoc-checked .mjs/.cjs) gets full autocomplete and
type-checking on 'self.*'. Include the generated file in your tsconfig.

Options:
  -b, --base <path>             Path to the API directory
  -o, --output <path>           Output path for the generated .d.ts
  -n, --name <name>             Name of the generated TypeScript interface
      --no-augment              Don't type 'self' from this declaration
  -h, --help                    Show this help

Resolution order (per option): flag → positional → package.json's "slothlet.typegen".

Examples:
  slothlet typegen ./api ./types/api.d.ts MyApi
  slothlet typegen --base ./api --output ./types/api.d.ts --name MyApi
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

	const missing = ["base", "output", "name"].filter((k) => !resolved[k]);
	if (missing.length > 0) {
		process.stderr.write(
			`slothlet typegen: missing required option(s): ${missing.join(", ")}.\n` +
				`Provide them as flags, positional args, or in package.json's "slothlet.typegen" field.\n\n`
		);
		printTypegenHelp();
		process.exit(2);
	}

	try {
		const result = await generate(resolved);
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
 * @returns {{base?: string, output?: string, name?: string, augment?: boolean}}
 * @private
 */
function parseTypegenArgs(args) {
	const opts = {};
	const positional = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-b" || arg === "--base") {
			opts.base = requireValue(args, ++i, arg);
		} else if (arg === "-o" || arg === "--output") {
			opts.output = requireValue(args, ++i, arg);
		} else if (arg === "-n" || arg === "--name") {
			opts.name = requireValue(args, ++i, arg);
		} else if (arg === "--no-augment") {
			opts.augment = false;
		} else if (arg.startsWith("-")) {
			throw new Error(`unknown option '${arg}'`);
		} else {
			positional.push(arg);
		}
	}
	if (opts.base === undefined && positional[0]) opts.base = positional[0];
	if (opts.output === undefined && positional[1]) opts.output = positional[1];
	if (opts.name === undefined && positional[2]) opts.name = positional[2];
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
 * Fill missing options from `package.json` → `slothlet.typegen`, which takes the `generate()` option names (a key
 * `generate()` does not take is refused there). Missing or unparseable package.json is treated as an empty source
 * (no error).
 * @param {{base?: string, output?: string, name?: string, augment?: boolean}} opts
 * @returns {object} The options for `generate()`.
 * @private
 */
function mergeWithPackageJson(opts) {
	if (opts.base && opts.output && opts.name && opts.augment !== undefined) return opts;

	const pkgPath = path.resolve(process.cwd(), "package.json");
	if (!fs.existsSync(pkgPath)) return opts;

	let pkg;
	try {
		pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
	} catch {
		return opts;
	}

	const fromPkg = pkg?.slothlet?.typegen ?? {};
	const merged = { ...fromPkg };
	for (const key of Object.keys(opts)) if (opts[key] !== undefined) merged[key] = opts[key];
	return merged;
}
