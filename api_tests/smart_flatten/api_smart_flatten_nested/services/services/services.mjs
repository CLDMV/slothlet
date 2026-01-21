/**
 * Services file in deeply nested structure.
 * Tests that flattening doesn't apply recursively - should be api.services.services.getNestedService
 * NOT flattened to api.services.getNestedService
 */

export function getNestedService() {
	return "deeply-nested-service";
}

export function processNestedData(data) {
	return `processed-${data}`;
}
