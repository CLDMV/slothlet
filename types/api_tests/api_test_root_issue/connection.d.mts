export function connect(host: any, options?: {}): Promise<void>;
export function disconnect(options?: {}): Promise<void>;
/**
 * Check if currently connected to the TV.
 * @public
 * @returns {boolean} True if connected, false otherwise.
 *
 * @description
 * Returns the current connection status. This is a synchronous check of the
 * local connection state and does not verify active communication with the TV.
 *
 * @example
 * // ESM usage
 * import { isConnected } from '@cldmv/tv-control/api/connection';
 * if (isConnected()) {
 *   console.log('Connected to TV');
 * }
 *
 * @example
 * // CJS usage
 * const { isConnected } = require('@cldmv/tv-control/api/connection');
 * const connected = isConnected();
 */
export function isConnected(): boolean;
//# sourceMappingURL=connection.d.mts.map