const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read configuration from .env.local or environment
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    }
  }
}

loadEnv();

const args = process.argv.slice(2);
const backupFolderArg = args[0];
const targetUrl = args[1] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const targetKey = args[2] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!backupFolderArg) {
  console.log(`
Usage:
  node scripts/restore.js <path-to-backup-folder> [target-supabase-url] [target-key]

Example:
  node scripts/restore.js ./deepini_backup_2026-10-21
`);
  process.exit(1);
}

const backupDir = path.resolve(backupFolderArg);
const dbJsonPath = path.join(backupDir, 'database.json');
const imagesDir = path.join(backupDir, 'images');

if (!fs.existsSync(dbJsonPath)) {
  console.error(`Error: database.json not found in "${backupDir}"`);
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const sourceUrl = backupData.metadata?.supabase_url || 'https://lkbcqnzhiuinqgfledsc.supabase.co';

console.log('====================================================');
console.log('           DEEPINI DATABASE & MEDIA RESTORE         ');
console.log('====================================================');
console.log(`Source backup:    ${backupDir}`);
console.log(`Target Supabase:  ${targetUrl}`);

const supabase = createClient(targetUrl, targetKey);

// Order is critical to satisfy Foreign Key constraints
const INSERT_ORDER = [
  'rooms',
  'spatial_photos',
  'spatial_hotspots',
  'components',
  'tags',
  'component_tags',
  'component_locations',
  'projects',
  'project_components',
  'loans',
  'spatial_notes'
];

async function uploadImages() {
  if (!fs.existsSync(imagesDir)) {
    console.log('  No images folder found to restore.');
    return;
  }

  const files = fs.readdirSync(imagesDir);
  console.log(`\n[1/2] Restoring ${files.length} images to Supabase Storage bucket "images"...`);

  let completed = 0;
  const concurrency = 6;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (file) => {
        const filePath = path.join(imagesDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

        const { error } = await supabase.storage.from('images').upload(file, fileBuffer, {
          contentType,
          upsert: true
        });

        if (error && !error.message.includes('already exists')) {
          console.error(`  [!] Error uploading image ${file}:`, error.message);
        } else {
          completed++;
          if (completed % 25 === 0 || completed === files.length) {
            process.stdout.write(`\r  Progress: ${completed} / ${files.length} images uploaded`);
          }
        }
      })
    );
  }
  console.log('\n  ✓ Images restoration finished.');
}

async function restoreDatabase() {
  console.log('\n[2/2] Restoring database records in dependency order...');

  const replaceOldUrls = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string' && obj[key].includes(sourceUrl)) {
        obj[key] = obj[key].replace(sourceUrl, targetUrl);
      } else if (typeof obj[key] === 'object') {
        replaceOldUrls(obj[key]);
      }
    }
    return obj;
  };

  for (const table of INSERT_ORDER) {
    let rows = backupData.tables[table] || [];
    if (rows.length === 0) {
      console.log(`  - ${table.padEnd(22)}: 0 records (skipped)`);
      continue;
    }

    // Remap URLs if the target Supabase project domain is different
    if (sourceUrl !== targetUrl) {
      rows = rows.map((r) => replaceOldUrls({ ...r }));
    }

    // Upsert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from(table).upsert(batch);
      if (error) {
        console.error(`  [!] Error restoring into ${table}:`, error.message);
        break;
      }
      inserted += batch.length;
    }

    console.log(`  ✓ ${table.padEnd(22)}: ${inserted} / ${rows.length} restored`);
  }
}

async function main() {
  await uploadImages();
  await restoreDatabase();
  console.log('\n====================================================');
  console.log('✓ RESTORATION COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

main().catch(console.error);
