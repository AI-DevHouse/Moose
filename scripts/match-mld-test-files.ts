/**
 * Match MLD test files to actual WO IDs by title
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function matchTestFiles() {
  const supabase = createSupabaseServiceClient();
  const testDir = 'C:\\dev\\MLD-management\\WO Acceptance Tests';

  // Read all test files
  const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('-test.ts'));

  console.log('Extracting titles from test files...\n');

  const testFileData: Array<{file: string, title: string, currentId: string}> = [];

  for (const file of testFiles) {
    const content = fs.readFileSync(path.join(testDir, file), 'utf8');

    // Extract title from comment block (line 3)
    const lines = content.split('\n');
    const titleLine = lines.find(l => l.includes('* ') && !l.includes('Acceptance Tests:') && !l.includes('Risk Level:') && !l.includes('Batch:') && !l.includes('Technical Specification'));

    if (titleLine) {
      const title = titleLine.replace(/^\s*\*\s*/, '').trim();
      const currentId = file.match(/wo-(\d+)-test\.ts/)?.[1] || 'unknown';

      testFileData.push({ file, title, currentId });
      console.log(`${file}: "${title}"`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Searching for WOs in Supabase...\n');

  const renameOperations: Array<{oldPath: string, newPath: string, woId: number, title: string}> = [];

  for (const testData of testFileData) {
    // Search for WO by title
    const { data: wos, error } = await supabase
      .from('work_orders')
      .select('id, title')
      .ilike('title', `%${testData.title}%`);

    if (error) {
      console.error(`Error searching for "${testData.title}":`, error);
      continue;
    }

    if (wos && wos.length > 0) {
      const wo = wos[0];
      console.log(`✅ FOUND: "${testData.title}"`);
      console.log(`   Current file: ${testData.file}`);
      console.log(`   Actual WO ID: ${wo.id}`);
      console.log(`   DB Title: ${wo.title}`);

      const newFileName = `wo-${String(wo.id).padStart(3, '0')}-test.ts`;

      if (testData.file !== newFileName) {
        renameOperations.push({
          oldPath: path.join(testDir, testData.file),
          newPath: path.join(testDir, newFileName),
          woId: wo.id,
          title: wo.title
        });
        console.log(`   📝 Will rename to: ${newFileName}\n`);
      } else {
        console.log(`   ✓ Already correctly named\n`);
      }
    } else {
      console.log(`❌ NOT FOUND: "${testData.title}"`);
      console.log(`   File: ${testData.file}\n`);
    }
  }

  if (renameOperations.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('RENAME OPERATIONS:\n');

    renameOperations.forEach(op => {
      console.log(`WO-${String(op.woId).padStart(3, '0')}: ${op.title}`);
      console.log(`  ${path.basename(op.oldPath)} → ${path.basename(op.newPath)}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('Executing renames...\n');

    for (const op of renameOperations) {
      try {
        fs.renameSync(op.oldPath, op.newPath);
        console.log(`✅ Renamed: ${path.basename(op.oldPath)} → ${path.basename(op.newPath)}`);
      } catch (error) {
        console.error(`❌ Failed to rename ${path.basename(op.oldPath)}:`, error);
      }
    }

    console.log(`\n✅ Renamed ${renameOperations.length} test files`);
  } else {
    console.log('\n✅ All test files are correctly named');
  }
}

matchTestFiles().catch(console.error);
