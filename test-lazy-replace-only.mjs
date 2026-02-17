#!/usr/bin/env node
import slothlet from './index.mjs';

const TEST_DIRS = {
	API_TEST: "./api_tests/api_test"
};

console.log('Testing ONLY LAZY + replace');

const api = await slothlet({
	mode: 'LAZY',
	dir: TEST_DIRS.API_TEST,
	api: {
		collision: {
			initial: 'replace',
			api: 'replace'
		},
		mutations: {
			add: true
		}
	}
});

console.log('\n1. INITIAL LOAD - Base API');
console.log(`api.math.add(1,1) = ${api.math.add(1,1)}`);

console.log('\n2. api.add("nested.comp1", API_TEST)');
await api.slothlet.api.add("nested.comp1", TEST_DIRS.API_TEST);

console.log(`typeof api.nested.comp1.math: ${typeof api.nested.comp1.math}`);
const comp1State = api.nested.comp1.math.___getState?.();
if (comp1State) {
	console.log(`comp1.math state: collisionMode=${comp1State.collisionMode}`);
}

const syncResult = api.nested.comp1.math.add(1, 1);
const isPromise = typeof syncResult?.then === 'function';
console.log(`api.nested.comp1.math.add(1,1) = ${syncResult} ${isPromise ? '(PROMISE!)' : ''}`);

if (isPromise) {
	const awaitedResult = await syncResult;
	console.log(`Awaited result: ${awaitedResult}`);
	console.log(`Source: ${awaitedResult === 2 ? 'math/ DIRECTORY ❌' : 'math.mjs FILE ✅'}`);
} else {
	console.log(`Source: ${syncResult === 2 ? 'math/ DIRECTORY ❌' : 'math.mjs FILE ✅'}`);
}

console.log('\n3. api.add("nested.comp2", API_TEST)');
await api.slothlet.api.add("nested.comp2", TEST_DIRS.API_TEST);

const syncResult2 = api.nested.comp2.math.add(1, 1);
const isPromise2 = typeof syncResult2?.then === 'function';
console.log(`api.nested.comp2.math.add(1,1) = ${syncResult2} ${isPromise2 ? '(PROMISE!)' : ''}`);

if (isPromise2) {
	const awaitedResult2 = await syncResult2;
	console.log(`Awaited result: ${awaitedResult2}`);
	console.log(`Source: ${awaitedResult2 === 2 ? 'math/ DIRECTORY ❌' : 'math.mjs FILE ✅'}`);
} else {
	console.log(`Source: ${syncResult2 === 2 ? 'math/ DIRECTORY ❌' : 'math.mjs FILE ✅'}`);
}

await api.shutdown();
