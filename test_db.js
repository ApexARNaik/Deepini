const fs = require('fs');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  console.log('Starting PGlite...');
  const db = new PGlite();
  
  // 1. Read and execute the migration SQL
  const sql = fs.readFileSync('C:\\Users\\Atul RN\\.gemini\\antigravity-ide\\brain\\102638f8-7c4e-485a-882b-6e8450bb6aa3\\20260820_init_migration.sql', 'utf8');
  console.log('Applying migrations...');
  await db.exec(sql);
  
  // 2. Insert dummy data
  console.log('Inserting dummy data...');
  const roomRes = await db.query(`INSERT INTO rooms (name) VALUES ('Workshop') RETURNING id`);
  const roomId = roomRes.rows[0].id;
  
  const photoRes = await db.query(`INSERT INTO spatial_photos (room_id, image_url, label) VALUES ($1, 'https://example.com/photo.jpg', 'Wall A') RETURNING id`, [roomId]);
  const photoId = photoRes.rows[0].id;
  
  const hotspotRes = await db.query(`INSERT INTO spatial_hotspots (photo_id, label, shape_points, is_leaf) VALUES ($1, 'Bin 1', '[]', true) RETURNING id`, [photoId]);
  const hotspotId = hotspotRes.rows[0].id;
  
  const compRes = await db.query(`INSERT INTO components (name) VALUES ('Resistor 10k') RETURNING id`);
  const componentId = compRes.rows[0].id;
  
  // Add 100 units to Bin 1
  await db.query(`INSERT INTO component_locations (component_id, hotspot_id, quantity) VALUES ($1, $2, 100)`, [componentId, hotspotId]);
  
  const projRes = await db.query(`INSERT INTO projects (name) VALUES ('Robotic Arm') RETURNING id`);
  const projectId = projRes.rows[0].id;
  
  // 3. Query initial component_totals
  console.log('\n--- Initial component_totals ---');
  let totals = await db.query(`SELECT * FROM component_totals`);
  console.table(totals.rows);
  
  // 4. Test Checkout RPC
  console.log('\n--- Checking out 20 units... ---');
  const checkoutRes = await db.query(`SELECT checkout_component($1, $2, $3, 20) AS pc_id`, [projectId, componentId, hotspotId]);
  const pcId = checkoutRes.rows[0].pc_id;
  
  totals = await db.query(`SELECT * FROM component_totals`);
  console.table(totals.rows);
  
  // 5. Test Checkin RPC
  console.log('\n--- Checking in 20 units back to Bin 1... ---');
  await db.query(`SELECT checkin_component($1, $2)`, [pcId, hotspotId]);
  
  totals = await db.query(`SELECT * FROM component_totals`);
  console.table(totals.rows);
  
  // 6. Test Cascade Delete Logic
  console.log('\n--- Testing Cascade Delete Logic ---');
  console.log('Setting pending_delete = true and checking out 50 units...');
  await db.query(`UPDATE components SET pending_delete = true WHERE id = $1`, [componentId]);
  const checkoutRes2 = await db.query(`SELECT checkout_component($1, $2, $3, 50) AS pc_id`, [projectId, componentId, hotspotId]);
  const pcId2 = checkoutRes2.rows[0].pc_id;
  
  let compCount = await db.query(`SELECT count(*) FROM components`);
  console.log('Components before final checkin (should be 1):', compCount.rows[0].count);
  
  console.log('Checking in the 50 units (this should trigger cascade delete)...');
  await db.query(`SELECT checkin_component($1, $2)`, [pcId2, hotspotId]);
  
  compCount = await db.query(`SELECT count(*) FROM components`);
  console.log('Components after final checkin (should be 0):', compCount.rows[0].count);
  
  console.log('Test completed successfully!');
  
  await db.close();
}

main().catch(console.error);
