const { self, context, reference } = await import(
	new URL(`../../src/slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

export const controller = {
	async getDefault() {
		return "getDefault";
	},
	async detectEndpointType() {
		return "detectEndpointType";
	},
	async detectDeviceType() {
		return "detectDeviceType";
	}
};
