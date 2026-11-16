/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-source-folder.test.vitest.mjs
 *	@Date: 2026-11-15T20:34:50-08:00 (1794803690)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T21:11:27-08:00 (1794805887)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The system metadata of a node keeps the source folder its caller gives, with the instance's own
 * resolver (#818).
 *
 * @description
 * Every caller of `tagSystemMetadata` passes `sourceFolder` (the folder the node was composed from). The handler kept a
 * fallback that derived one from `filePath` through `helpers.resolver.path`, a member the resolver does not have, so
 * a call without `sourceFolder` threw with a real resolver. Tagging now stores what the caller gives.
 * @module tests/vitests/suites/metadata/metadata-source-folder
 */

import { describe, it, expect } from "vitest";
import { Metadata } from "#handlers/metadata";
import { registerInstance, getInstanceToken } from "#handlers/lifecycle-token";
import { Resolver } from "@cldmv/slothlet/helpers/resolve-from-caller";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * A minimal instance with the real resolver, registered so a lifecycle token is available.
 * @returns {{ meta: Metadata, token: symbol }} The handler and the token.
 */
function make() {
	const mock = { config: {}, debug: () => {}, SlothletError, SlothletWarning, helpers: {} };
	mock.helpers.resolver = new Resolver(mock);
	registerInstance(mock);
	return { meta: new Metadata(mock), token: getInstanceToken(mock) };
}

describe("Metadata.tagSystemMetadata with the instance's own resolver (#818)", () => {
	it("tags a node given a file path and no source folder, storing no source folder", () => {
		const { meta, token } = make();
		const fn = function add() {};
		expect(() => meta.tagSystemMetadata(fn, { filePath: "/api/math/add.mjs", moduleID: "math", apiPath: "math.add" }, token)).not.toThrow();
		const system = meta.getSystemMetadata(fn);
		expect(system.filePath).toBe("/api/math/add.mjs");
		expect(system.sourceFolder).toBeUndefined();
	});

	it("keeps the source folder its caller gives", () => {
		const { meta, token } = make();
		const fn = function add() {};
		meta.tagSystemMetadata(fn, { filePath: "/api/math/add.mjs", sourceFolder: "/api", moduleID: "math", apiPath: "math.add" }, token);
		expect(meta.getSystemMetadata(fn).sourceFolder).toBe("/api");
	});
});
