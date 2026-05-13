import { self, instanceID } from "@cldmv/slothlet/runtime";

export async function chain(): Promise<string> {
	// Exercises bare-specifier import (`@cldmv/slothlet/runtime`) AND a
	// cross-module call through `self` from a `.mts` source file. If the loader
	// served this from a `data:` URL, both would fail.
	const pong = await self.bar.call();
	return `${instanceID}:${pong}`;
}
