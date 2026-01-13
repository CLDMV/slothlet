import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const vitestDir = new URL('processed/', import.meta.url).pathname.replace('P:\P:', 'P:\');
const vitestFolders = fs.readdirSync(vitestDir).filter(dir => fs.statSync(path.join(vitestDir, dir)).isDirectory());

let totalPasses = 0;
let totalFailures = 0;

vitestFolders.forEach(folder => {
  try {
    const result = execSync(`npm run vitest -- ${folder}`, { stdio: 'pipe' }).toString();
    const passes = (result.match(/PASS\s+(\d+)/) || [0, 0])[1];
    const failures = (result.match(/FAIL\s+(\d+)/) || [0, 0])[1];
    totalPasses += parseInt(passes, 10);
    totalFailures += parseInt(failures, 10);
    console.log(`Folder: ${folder} - Passes: ${passes}, Failures: ${failures}`);
  } catch (error) {
    console.error(`Error running tests in folder ${folder}:`, error.message);
    totalFailures++;
  }
});

console.log(`Total Passes: ${totalPasses}, Total Failures: ${totalFailures}`);