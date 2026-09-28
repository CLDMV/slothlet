/**
 * Build the api described by `configJson` and write its declaration file.
 * @param {string|undefined} configJson - The serialized worker config (`SLOTHLET_CONFIG`): the
 *   slothlet config for an eager, fast-mode instance plus `types` (`{ output, interfaceName, ... }`).
 * @param {((message: {type: string, error?: string}) => void)|undefined} send - IPC sender to the
 *   parent (`process.send` in the fork); `undefined` when there is no IPC channel.
 * @returns {Promise<number>} The process exit code: `0` on success, `1` on failure.
 * @example
 * const code = await runTypeGeneration(process.env.SLOTHLET_CONFIG, process.send?.bind(process));
 */
export function runTypeGeneration(configJson: string | undefined, send: ((message: {
    type: string;
    error?: string;
}) => void) | undefined): Promise<number>;
/**
 * Run the type generation and hand its exit code to `exit`, but only when `argv1` is this file —
 * i.e. when the module is the process's entry script (the strict-mode fork). Any other import is a
 * no-op.
 * @param {string|undefined} argv1 - The entry script path (`process.argv[1]`).
 * @param {string|undefined} configJson - The serialized worker config (`SLOTHLET_CONFIG`).
 * @param {((message: {type: string, error?: string}) => void)|undefined} send - IPC sender to the parent.
 * @param {(code: number) => void} exit - Called with the exit code.
 * @returns {Promise<void>|null} The pending run, or `null` when this module is not the entry script.
 * @example
 * runIfEntry(process.argv[1], process.env.SLOTHLET_CONFIG, process.send?.bind(process), process.exit.bind(process));
 */
export function runIfEntry(argv1: string | undefined, configJson: string | undefined, send: ((message: {
    type: string;
    error?: string;
}) => void) | undefined, exit: (code: number) => void): Promise<void> | null;
//# sourceMappingURL=type-generation-worker.d.mts.map