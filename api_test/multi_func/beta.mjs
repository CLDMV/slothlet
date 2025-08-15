/**
 * Beta module for multi-file API loader test (exports an object with methods).
 * @returns {object}
 * @example
 * import api from './api_test';
 * api.multi_func.beta.hello(); // 'beta hello'
 */
export default {
  /**
   * Returns a test string.
   * @returns {string}
   * @example
   * hello(); // 'beta hello'
   */
  hello() {
    return 'beta hello';
  }
};
