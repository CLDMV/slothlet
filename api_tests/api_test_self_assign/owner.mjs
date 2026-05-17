/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_assign/owner.mjs
 *	@Date: 2026-05-12T22:04:02-07:00 (1778648642)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 22:32:30 -07:00 (1778650350)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// Mounted at apiPath "owner". Used by the wrap-on-set ownership tests:
// `writeUnderOwn` writes to self.owner (== own apiPath at top level — allowed)
// `writeOutside` writes to self.intruder (root, not owned — denied)
// `writeUnderOwnedNs` writes self.<rootSegment>.X (under own subtree — allowed when api.add'd)
import { self } from "@cldmv/slothlet/runtime";

export function writeUnderOwn(value) {
	// `self.owner` is this module's own top-level mount; rewriting it counts
	// as an owner-scoped write.
	self.owner = value;
	return self.owner;
}

export function writeOutside(value) {
	self.intruder = value;
	return self.intruder;
}

export function writeUnderOwnedNs(rootSegment, key, value) {
	// Used by tests to verify that writes UNDER the module's mount-point subtree
	// (not the function's apiPath) are accepted by setOwnedProperty's
	// validation pass. `rootSegment` should be the api.add()'d endpoint —
	// e.g. "ownerNs" if `api.slothlet.api.add("ownerNs", ...)` was used.
	self[rootSegment][key] = value;
	return self[rootSegment][key];
}

export function overwriteOwnMount(rootSegment, value) {
	// Top-level write where the property name equals this module's mount
	// endpoint. Exercises the SUCCESS arm of setOwnedProperty's ownership
	// validation (the implicit else of `if (!isUnderOwn)`).
	self[rootSegment] = value;
	return self[rootSegment];
}

export function readSelf(key) {
	return self[key];
}

/**
 * Probe `self` introspection from inside a module. Used by the `.run()` /
 * `.scope()` sandbox tests to exercise the copy-on-write `self` view's
 * `has` / `ownKeys` / `getOwnPropertyDescriptor` behavior under full isolation.
 * @returns {object} Introspection results.
 */
export function introspectSelf() {
	self.probeKey = "probe-value";
	return {
		hasProbe: "probeKey" in self, // overlay-backed key
		hasOwner: "owner" in self, // read-through to the live tree
		hasMissing: "definitelyNotAKey" in self, // absent in overlay and parent
		keyCount: Object.keys(self).length,
		descValue: Object.getOwnPropertyDescriptor(self, "probeKey")?.value,
		descMissing: Object.getOwnPropertyDescriptor(self, "definitelyNotAKey"), // → undefined
		readBack: self.probeKey
	};
}
