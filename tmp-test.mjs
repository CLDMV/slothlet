const m = await import('@cldmv/slothlet');
const s = m.default ?? m.slothlet ?? m;
const b = await s({mode:'eager',dir:'./api_tests_v3/api_test'});
console.log('utils in logger:', 'utils' in b.logger);
console.log('logger.utils:', b.logger.utils);
