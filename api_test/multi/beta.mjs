/**
 * Beta module for multi-file API loader test.
 * @returns {object}
 * @example
 * import api from './api_test';
 * api.multi.beta.world(); // 'beta world'
 */
export default {
  /**
   * Returns a test string.
   * @returns {string}
   * @example
   * world(); // 'beta world'
   */
  world() {
    return 'beta world';
  }
};
