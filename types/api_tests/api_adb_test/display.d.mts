/**
 * Captures a screenshot from the Android TV device.
 * @param {Object} [options={}] - Screenshot capture options
 * @param {string} [options.format="png"] - Output format ("png", "jpg", "webp")
 * @param {number} [options.quality=90] - Image quality (1-100)
 * @param {number} [options.width] - Resize width
 * @param {number} [options.height] - Resize height
 * @param {boolean} [options.useSharp=true] - Use Sharp for image processing
 * @returns {Promise<Buffer>} Screenshot buffer
 */
export function capture(options?: {
    format?: string;
    quality?: number;
    width?: number;
    height?: number;
    useSharp?: boolean;
}): Promise<Buffer>;
/**
 * Gets display information.
 * @returns {Promise<Object>} Display info
 */
export function getInfo(): Promise<any>;
/**
 * Gets screen resolution.
 * @returns {Promise<Object>} Resolution info
 */
export function getResolution(): Promise<any>;
/**
 * Analyzes screenshot for brightness/darkness.
 * @param {Object} [options={}] - Analysis options
 * @returns {Promise<Object>} Analysis results
 */
export function analyzeScreenshot(options?: any): Promise<any>;
/**
 * Saves screenshot to file.
 * @param {string} filepath - Path to save screenshot
 * @param {Object} [options={}] - Save options
 * @returns {Promise<void>}
 */
export function saveScreenshot(filepath: string, options?: any): Promise<void>;
export default display;
declare namespace display {
    export { capture };
    export { getInfo };
    export { getResolution };
    export { analyzeScreenshot };
    export { saveScreenshot };
}
//# sourceMappingURL=display.d.mts.map