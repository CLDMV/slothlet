import { context } from "@cldmv/slothlet/runtime";

/**
 * Simple test class to verify context propagation
 */
class TestService {
	constructor(name) {
		this.name = name;
	}

	/**
	 * Method that accesses slothlet context
	 */
	getContextInfo() {
		return {
			userId: context.userId,
			session: context.session,
			serviceName: this.name
		};
	}
}

/**
 * Factory function that returns a class instance
 */
export function createTestService(name) {
	return new TestService(name);
}
