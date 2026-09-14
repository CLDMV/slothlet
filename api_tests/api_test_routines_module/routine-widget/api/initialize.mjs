/**
 * @fileoverview Leaf matched by a configured `initialize` routine, used to verify that mounting a
 * module via `api.modules.addModule()`/`addModules()` installs the routine's stacked callable at the
 * mounted leaf's composed path (#362 — the mount path previously never called rebuildStacks()).
 * @module api_test_routines_module.routine-widget.initialize
 */

/**
 * Records that it ran on the shared test log, so the installed routine callable can be observed to
 * actually invoke this contributor.
 * @function initialize
 * @param {...*} args - Whatever the caller forwarded.
 * @returns {string} A fixed marker.
 */
export default function initialize(...args) {
	(globalThis.__slothletRoutineModuleLog ??= []).push({ from: "routine-widget", args });
	return "routine-widget:initialize";
}
