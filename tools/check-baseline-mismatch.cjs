const fs = require('fs');
const baseline = JSON.parse(fs.readFileSync('tests/vitests/baseline-tests.json', 'utf-8'));
const status = fs.readFileSync('tests/vitests/TEST-STATUS.md', 'utf-8');

console.log('Tests in baseline-tests.json but not marked as baseline in TEST-STATUS.md:\n');
for (const test of baseline) {
  const regex = new RegExp('\\| ' + test.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\|[^|]+\\|[^|]+\\| ✅ baseline');
  if (!regex.test(status)) {
    console.log('  -', test);
  }
}
