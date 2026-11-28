/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: index.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
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
 * @fileoverview ESM entry point for @cldmv/slothlet with automatic source/dist detection and live-binding context.
 * @module @cldmv/slothlet
 */

// Single source of truth for the `slothlet.defaults` namespace (#341) — a helper module with no
// node:* specifiers, safe for the browser bundle's static-import graph (#123).
import { DEFAULT_ROUTINES, RESERVED_EXPORTS } from "#helpers/defaults";

// Readable output for an uncaught SlothletError, as a monitor: it sees the error before Node handles it, and changes
// nothing else. A host with its own `uncaughtException` handler gets every error, a SlothletError included, and Node
// ends the process for any other error the host leaves unhandled, as it would without slothlet.
// `process` is undefined in a browser, so define the handler unconditionally but
// only register it under Node — keeps this entry module loadable in a browser (#123).
const __isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);
const __slothletUncaughtHandler = (error) => {
	if (error?.name === "SlothletError" && process.listenerCount("uncaughtException") === 0) {
		console.error("\n================================================================================");
		console.error(`ERROR [${error.code}]: ${error.message}`);

		// Extract and show file/line from original error stack if available
		const stackToUse = error.cause?.stack || error.stack;
		if (stackToUse) {
			const stackLines = stackToUse.split("\n");
			// For import errors, try to extract from the error message first (more accurate)
			if (error.cause?.message?.includes("does not provide an export") || error.cause?.message?.includes("Cannot find module")) {
				// The file that failed to import is in the error details (`file`)
				const failedFile = error.details?.file;
				if (failedFile) {
					console.error(`\n📍 Location: ${failedFile} (import statement)`);
				}
			} else {
				// Otherwise extract from stack trace
				const firstStackLine = stackLines[1]; // First line after error message
				if (firstStackLine) {
					// Extract file:line info from stack trace (format: "at function (file:line:col)")
					const match = firstStackLine.match(/\((.+?):(\d+):(\d+)\)/) || firstStackLine.match(/at (.+?):(\d+):(\d+)/);
					if (match) {
						console.error(`\n📍 Location: ${match[1]}:${match[2]}`);
					}
				}
			}
		}

		if (error.hint) {
			console.error("\n💡 Hint:");
			console.error(`  ${error.hint}`);
		}

		// Show the error details (filter out error/hint/cause which are already shown)
		const contextKeys = Object.keys(error.details || {}).filter((k) => k !== "error" && k !== "hint" && k !== "cause");
		if (contextKeys.length > 0) {
			console.error("\nDetails:");
			for (const key of contextKeys) {
				const value = error.details[key];
				const displayValue = typeof value === "string" ? value : JSON.stringify(value, null, 2);
				console.error(`  ${key}: ${displayValue}`);
			}
		}

		// Show clean stack trace (prefer the cause's stack)
		const stackForDisplay = error.cause?.stack || error.stack;
		if (stackForDisplay) {
			console.error("\nStack Trace:");
			const stackLines = stackForDisplay.split("\n").slice(1); // Skip first line (error message)
			for (const line of stackLines) {
				console.error(`  ${line.trim()}`);
			}
		}

		console.error("================================================================================\n");
		process.exit(1);
	}
};
if (__isNode) process.on("uncaughtExceptionMonitor", __slothletUncaughtHandler);

/**
 * The framework surface of a composed api: `api.slothlet.*`, `api.shutdown()`, `api.destroy()`.
 * `slothlet typegen` output extends `SlothletSelf` with it, so `self.slothlet.*` is typed too.
 * @typedef {import("./src/slothlet.mjs").SlothletAPI} SlothletAPI
 */

/**
 * Creates a slothlet API instance with live-binding context and AsyncLocalStorage support.
 * Automatically wraps all API functions with context isolation for multi-instance support.
 *
 * The resolved api is typed as `SlothletAPI & T`. `T` defaults to `SlothletSelf` from
 * `@cldmv/slothlet/runtime`, which a `slothlet typegen` declaration extends with the project's api —
 * so a project with generated types gets a typed api with no annotation. A program that loads more
 * than one api passes the interface explicitly: `slothlet<OtherApi>({ base: "./other" })`.
 * @public
 * @async
 *
 * @template {object} [T=import("./src/lib/runtime/runtime.mjs").SlothletSelf]
 * @param {import("./src/slothlet.mjs").SlothletOptions} [options={}] - Configuration options for the slothlet instance. See {@link SlothletOptions} for the full set.
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI & T>} The bound API object with management methods
 *
 * @example // ESM
 * import slothlet from "@cldmv/slothlet";
 * const api = await slothlet({ base: './api', mode: 'lazy' });
 * const result = await api.math.add(2, 3); // 5
 *
 */
const slothlet = async (options = {}) => {
	// Dynamic imports after environment check
	const mod = await import("#slothlet");

	const slothletImpl = mod.slothlet ?? mod.default;

	return slothletImpl(options);
};

/**
 * Named export alias for the default slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // ESM named import
 * import { slothlet } from "@cldmv/slothlet";
 * const api = await slothlet({ base: './api' });
 */
// Default export and named alias — both bind the same function. `slothlet` is a
// `const` (not `export default function`) so the generated `.d.mts` reliably
// emits the named `export { slothlet }` alongside the default export.
export default slothlet;
export { slothlet };

// `slothlet.defaults` (#341) is attached on the REAL implementation (`src/slothlet.mjs`'s own
// exported function), but this file's `slothlet` is a distinct wrapper that only imports that
// implementation lazily, inside the call — so it carries none of the inner function's static
// properties. Attach the identical, single-sourced value here too (see the static import above),
// so `slothlet.defaults` is available synchronously through every entry point.
/** @type {Readonly<{routines: ReadonlyArray<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy"}>, reserved: ReadonlySet<string>}>} */
slothlet.defaults = Object.freeze({
	routines: DEFAULT_ROUTINES,
	reserved: RESERVED_EXPORTS
});

// The named alias as a property too, so the function carries the same own keys however the package
// is loaded. CommonJS has no separate named exports: `const { slothlet } = require("@cldmv/slothlet")`
// reads this property off `module.exports`, which is this same function. Set here, ESM and CJS
// consumers see an identical object (`defaults` and `slothlet`) regardless of which loads first.
slothlet.slothlet = slothlet;
