/**
 * Fixture: TypeScript file with untyped (implicit `any`) parameters.
 * Used to exercise the `p.type ? ... : "any"` fallback in extractFunctionSignature,
 * and the `node.type ? ... : "any"` fallback for untyped return values.
 */

// No type annotations on parameters or return — exercises the `: "any"` fallback
// in extractFunctionSignature for both params and return type.
export function identity(value) {
	return value;
}

// Untyped first param, typed second — exercises the fallback for individual params.
export function greet(name, times: number): string {
	return name.repeat(times);
}
