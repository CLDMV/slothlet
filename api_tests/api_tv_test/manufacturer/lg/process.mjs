/**
 * @fileoverview Simplified LG TV process functionality for testing.
 */

export function processInboundData(data, meta = {}) {
	return { processed: true, data: data, meta: meta };
}

export default {
	processInboundData
};
