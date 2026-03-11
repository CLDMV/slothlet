/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_lazy_nested_file_folder/pipe/pipe.mjs
 *	@Date: 2026-03-15T00:00:00-08:00 (1773705600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 19:13:57 -07:00 (1773022437)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview pipe.mjs with default function + named export, sits alongside pipe/ inner subfolder.
 *
 * This fixture is designed to trigger modes-processor.mjs L1530 (TRUE branch):
 *
 * When pipe/ outer directory's lazy_materializeFunc runs:
 *   1. pipe.mjs (file, default fn + named doWork) is processed eagerly with mode "eager":
 *      - default fn → materialized["pipe"] = eager wrapper (impl = fn, child key doWork attached)
 *   2. pipe/ (subdir, same name) → processFiles subdirs loop:
 *      - modes_lazyExisting = materialized["pipe"] (the file wrapper above)
 *      - existChildKeys includes "doWork" (the child wrapper key) → modes_fileFolderImpl = { doWork: fn }
 *      - createLazySubdirectoryWrapper(pipe/, ..., fileFolderCollisionImpl={ doWork: fn }, "merge")
 *      - pre-populate: Object.defineProperty(wrapper, "doWork", ...) → attached key on lazy wrapper
 *      - materializedKeys["pipe"] = lazy wrapper with doWork pre-populated (replaces file wrapper)
 *   3. materializedKeys = ["pipe"] (length 1 = categoryName "pipe") → L1526 fires
 *   4. nestedValue = lazy wrapper with doWork pre-populated → attachedKeys = ["doWork"] → L1530 TRUE
 *   5. returns nestedValue (the lazy wrapper) instead of nestedValue.__impl
 * @module api_smart_flatten_lazy_nested_file_folder.pipe
 */

/**
 * Default function export — makes this a hybrid file with default + named export.
 * @returns {string} Pipe identifier.
 * @example
 * pipe(); // "pipe-default"
 */
function pipe() {
	return "pipe-default";
}

export default pipe;

/**
 * Named export that becomes a child key attached to the default function wrapper.
 * Its presence in the eager wrapper triggers modes_fileFolderImpl capture
 * when the inner pipe/ subdirectory is processed.
 * @returns {string} Work result.
 * @example
 * doWork(); // "pipe-done"
 */
export function doWork() {
	return "pipe-done";
}
