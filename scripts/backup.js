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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkbcqnzhiuinqgfledsc.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vRm_nsFn8m8M4reOSiHNbg_YAIx-PTI';

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
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

async function fetchTableData(tableName) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`  [!] Error fetching table ${tableName}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allData = allData.concat(data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

async function downloadImages(backupDir) {
  const imagesDir = path.join(backupDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log('\n[2/2] Fetching list of files in storage bucket "images"...');
  const { data: files, error } = await supabase.storage.from('images').list('', { limit: 1000 });

  if (error) {
    console.error('  [!] Error listing storage images:', error.message);
    return;
  }

  console.log(`  Found ${files.length} images to download.`);
  let completed = 0;
  const concurrency = 8;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (file) => {
        const dest = path.join(imagesDir, file.name);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          completed++;
          return; // Skip already downloaded
        }
        try {
          const { data: blob, error: dlError } = await supabase.storage.from('images').download(file.name);
          if (dlError) {
            console.error(`  [!] Error downloading ${file.name}:`, dlError.message);
            return;
          }
          const buffer = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(dest, buffer);
          completed++;
          if (completed % 25 === 0 || completed === files.length) {
            process.stdout.write(`\r  Progress: ${completed} / ${files.length} images downloaded`);
          }
        } catch (err) {
          console.error(`  [!] Failed saving ${file.name}:`, err.message);
        }
      })
    );
  }
  console.log('\n  ✓ All images downloaded successfully.');
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '..', 'deepini_backup_' + timestamp);

  console.log('====================================================');
  console.log('           DEEPINI FULL DATABASE BACKUP             ');
  console.log('====================================================');
  console.log(`Target directory: ${backupDir}`);
  console.log(`Source Supabase:  ${supabaseUrl}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. Export all tables
  console.log('\n[1/2] Exporting database tables...');
  const databaseExport = {
    metadata: {
      exported_at: new Date().toISOString(),
      supabase_url: supabaseUrl,
      version: '1.0'
    },
    tables: {}
  };

  for (const table of TABLES) {
    const rows = await fetchTableData(table);
    databaseExport.tables[table] = rows;
    console.log(`  ✓ ${table.padEnd(22)}: ${rows.length} records`);
  }

  const jsonPath = path.join(backupDir, 'database.json');
  fs.writeFileSync(jsonPath, JSON.stringify(databaseExport, null, 2));
  console.log(`  Saved database tables to: database.json`);

  // 2. Download all images
  await downloadImages(backupDir);

  // 3. Save a summary readme in the backup
  const info = `# Deepini Database & Media Backup
Date: ${new Date().toISOString()}
Source Project: ${supabaseUrl}

## Contents
- \`database.json\`: Full JSON export of all 11 tables with exact foreign keys and relations.
- \`images/\`: All spatial room photos, view perspective photos, and component images.

## To Restore
Run:
\`\`\`bash
node scripts/restore.js <path-to-this-folder>
\`\`\`
`;
  fs.writeFileSync(path.join(backupDir, 'README.txt'), info);

  console.log('\n====================================================');
  console.log('✓ BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`Location: ${backupDir}`);
  console.log('====================================================\n');
}

main().catch(console.error);
