/**
 * @fileoverview Coverage for ModesUtils.getOwnershipCollisionMode's config-default fallback.
 * @module tests/vitests/suites/builders/modes-utils-coverage
 */

import { describe, it, expect } from "vitest";
import { ModesUtils } from "@cldmv/slothlet/helpers/modes-utils";
import { SlothletError } from "@cldmv/slothlet/errors";

const makeUtils = () => new ModesUtils({ config: {}, debug: () => {}, SlothletError, SlothletWarning: class {}, handlers: {} });

describe("ModesUtils.getOwnershipCollisionMode — config-default resolution", () => {
	it("returns the configured mode for the given context", () => {
		const u = makeUtils();
		expect(u.getOwnershipCollisionMode({ collision: { initial: "replace", api: "skip" } }, "initial")).toBe("replace");
		expect(u.getOwnershipCollisionMode({ collision: { initial: "replace", api: "skip" } }, "api")).toBe("skip");
	});

	it("falls back to 'merge' when collision config is absent or lacks the context", () => {
		const u = makeUtils();
		expect(u.getOwnershipCollisionMode({}, "initial")).toBe("merge"); // no collision key → ?. undefined → || "merge"
		expect(u.getOwnershipCollisionMode({ collision: {} }, "api")).toBe("merge"); // context missing → || "merge"
	});
});
