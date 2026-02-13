import slothlet from './src/slothlet.mjs';

const api = await slothlet({ dir: './api_tests/api_test/math', mode: 'eager' });

console.log('Object.keys(api):');
console.log(Object.keys(api));

console.log('\nObject.keys(api.math):');
console.log(Object.keys(api.math));

console.log('\nObject.getOwnPropertyNames(api.math):');
console.log(Object.getOwnPropertyNames(api.math));

console.log('\nChecking for internal properties:');
console.log('  "____slothletInternal" in api.math:', "____slothletInternal" in api.math);
console.log('  "____id" in api.math:', "____id" in api.math);
console.log('  "____callableImpl" in api.math:', "____callableImpl" in api.math);
