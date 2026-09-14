/**
 * @fileoverview Sibling leaf so the module's apiDir has more than one file and does not root-unwrap
 * onto the mount itself — keeping `initialize` at its own `<mount>.initialize` composed path.
 * @module api_test_routines_module.routine-widget.ping
 */

/**
 * @function ping
 * @returns {string} `"pong"`.
 */
export default function ping() {
	return "pong";
}
