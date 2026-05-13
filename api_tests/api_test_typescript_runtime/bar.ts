import { self } from "@cldmv/slothlet/runtime";

export async function call(): Promise<string> {
	return self.foo.ping();
}
