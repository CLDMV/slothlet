/**
 * Additional module in the multiple files test case
 */

export function validate(input) {
	return Boolean(input);
}

export function transform(data) {
	return data.toUpperCase();
}

export default {
	name: "validator",
	purpose: "data validation"
};
