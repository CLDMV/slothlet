// Mounted at apiPath "owner". Used by the wrap-on-set ownership tests:
// `writeUnderOwn` writes to self.owner (== own apiPath at top level — allowed)
// `writeOutside` writes to self.intruder (root, not owned — denied)
// `writeRoot` writes to self.bootstrapValue (root, not owned — denied unless caller is external)
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

export function readSelf(key) {
	return self[key];
}
