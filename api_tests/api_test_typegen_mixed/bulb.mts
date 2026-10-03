/**
 * @fileoverview TypeScript leaf: an interface-annotated object leaf and a function returning a
 * `node:events` type (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.bulb
 */
import { EventEmitter } from "node:events";

/** Shape of a bulb's controls. */
export interface BulbApi {
	brightness: {
		get(): number;
		set(level: number): void;
	};
}

let level = 50;

/** Brightness control, typed through the `BulbApi` interface. */
export const brightness: BulbApi["brightness"] = {
	get: () => level,
	set: (next: number) => {
		level = next;
	}
};

/**
 * Create an event source for bulb changes.
 * @returns A fresh emitter.
 */
export function events(): EventEmitter {
	return new EventEmitter();
}
