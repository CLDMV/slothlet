/**
 * @fileoverview A file named after its folder, with code outside every export that a leaf hands out.
 * @module api_test_toplevel_callable_root/samename
 */

import { self } from "@cldmv/slothlet/runtime";

/** Code of this file outside every export. */
const helper = () => self.vault.get();

export const give = () => helper;
export const direct = () => self.vault.get();
