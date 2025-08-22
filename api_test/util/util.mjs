const { self, context, reference } = await import(
	new URL(`../../src/slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

export function size(variable) {
	return "size";
}

export function secondFunc(variable) {
	return "secondFunc";
}
