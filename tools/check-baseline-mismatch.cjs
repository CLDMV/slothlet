/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/check-baseline-mismatch.cjs
 *	@Date: 2026-02-16T17:50:31-08:00 (1771293031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:57 -08:00 (1772425317)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
