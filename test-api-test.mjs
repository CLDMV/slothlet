import slothlet from './src/slothlet.mjs';

console.log('Loading api_tests/api_test...\n');

const api = await slothlet({ dir: './api_tests/api_test', mode: 'eager' });

console.log('API loaded successfully!');
console.log('Object.keys(api):', Object.keys(api).slice(0, 10));
console.log('✅ Test passed!');
