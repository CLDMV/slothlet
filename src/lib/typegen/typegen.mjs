/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/typegen/typegen.mjs
 *	@Date: 2026-05-12 19:49:58 -07:00 (1778640598)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:57:58 -07:00 (1778641078)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Programmatic and CLI-facing TypeScript declaration generator.
 * @module @cldmv/slothlet/typegen
 * @public
 *
 * @description
 * Loads a Slothlet API directory in eager + fast TypeScript mode, then writes a
 * `.d.ts` file describing the resulting API shape. Intended for users who want
 * editor-time type information for their API without running Slothlet in strict
 * mode at runtime.
 *
 * The same logic is exposed three ways:
 *   - As a function: `import { generateTypes } from "@cldmv/slothlet/typegen"`
 *   - As a CLI: `npx slothlet typegen ./api ./types/api.d.ts MyApi`
 *   - As a CLI with no args, falling back to the `slothlet.typegen` field in
 *     the project's `package.json`.
 *
 * Runtime is unaffected — the user runs this on demand (e.g. via `prebuild` or
 * `predev` scripts) and ships the generated `.d.ts` alongside (or instead of)
 * the source. Slothlet does NOT auto-regenerate types at load time.
 */
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { generateTypes as writeDeclarationFile } from "@cldmv/slothlet/processors/type-generator";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Generate a TypeScript declaration file (`.d.ts`) for a Slothlet API directory.
 *
 * Loads the API in eager + fast TypeScript mode (no type-checking pass needed —
 * the structure walk uses the loaded API and source files), writes the `.d.ts`,
 * and shuts the loaded instance down before returning.
 *
 * @param {object} options
 * @param {string} options.dir - Path to the API directory to scan (relative or absolute).
 * @param {string} options.output - Path to write the `.d.ts` file to (relative or absolute).
 * @param {string} options.interfaceName - Name of the generated TypeScript interface (e.g. `"MyApi"`).
 * @param {boolean|string|object} [options.typescript] - Override TypeScript loader config. Same union accepted by `slothlet({ typescript })`: pass `true` (default mode), `"fast"` / `"strict"`, or an object like `{ mode: "fast" }`. Defaults to `{ mode: "fast" }` when omitted.
 * @param {boolean} [options.includeDocumentation=true] - Include JSDoc comments in the generated declaration.
 * @returns {Promise<{filePath: string, content: string}>} Absolute path written and the declaration content.
 * @throws {SlothletError} `INVALID_CONFIG` when `dir`, `output`, or `interfaceName` is missing or not a string.
 * @public
 *
 * @example
 * import { generateTypes } from "@cldmv/slothlet/typegen";
 *
 * await generateTypes({
 *     dir: "./api",
 *     output: "./types/api.d.ts",
 *     interfaceName: "MyApi"
 * });
 */
export async function generateTypes(options = {}) {
	// Public API: callers may pass null / true / a primitive accidentally. JSDoc
	// promises a SlothletError(INVALID_CONFIG) for bad input — don't let a raw
	// TypeError escape from `options.dir` dereference.
	if (options === null || typeof options !== "object" || Array.isArray(options)) {
		throw new SlothletError(
			"INVALID_CONFIG",
			{
				option: "typegen.options",
				expected: "plain object",
				value: options,
				hint: "Call generateTypes({ dir, output, interfaceName }) with an options object.",
				validationError: true
			},
			null,
			{ validationError: true }
		);
	}

	assertOption(options.dir, "dir");
	assertOption(options.output, "output");
	assertOption(options.interfaceName, "interfaceName");

	const api = await slothlet({
		base: path.resolve(options.dir),
		mode: "eager",
		typescript: options.typescript ?? { mode: "fast" }
	});

	try {
		const result = await writeDeclarationFile(api, {
			output: path.resolve(options.output),
			interfaceName: options.interfaceName,
			includeDocumentation: options.includeDocumentation ?? true
		});
		return { filePath: result.filePath, content: result.output };
	} finally {
		await api.slothlet.shutdown();
	}
}

/**
 * Validate that an option is a non-empty string. Throws SlothletError otherwise.
 * @param {unknown} value
 * @param {string} name
 * @returns {void}
 * @throws {SlothletError}
 * @private
 */
function assertOption(value, name) {
	if (typeof value !== "string" || value.length === 0) {
		throw new SlothletError(
			"INVALID_CONFIG",
			{
				option: `typegen.${name}`,
				expected: "non-empty string",
				value,
				hint: `Provide options.${name} as a non-empty string when calling generateTypes(). For the CLI, use --${camelToKebab(name)} or the matching positional argument.`,
				validationError: true
			},
			null,
			{ validationError: true }
		);
	}
}

/**
 * Convert a camelCase string to kebab-case (used to render flag names in error messages).
 * @param {string} s
 * @returns {string}
 * @private
 */
function camelToKebab(s) {
	return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
