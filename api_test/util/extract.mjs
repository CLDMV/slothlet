const { self, context, reference } = await import(
	new URL(`../../src/slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

export const extract = {
	data() {
		return "data";
	},
	section() {
		return "section";
	},
	NVRSection() {
		return "NVRSection";
	},
	parseDeviceName() {
		return "parseDeviceName";
	}
};
