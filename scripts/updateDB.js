const { db } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

async function updateDB() {
  const client = await db.connect();
  try {
    console.log("Adding column...");
    await client.query('ALTER TABLE leads ADD COLUMN IF NOT EXISTS regional_manager VARCHAR(255);');
    
    console.log("Backfilling territories...");
    await client.query(`
      UPDATE leads SET regional_manager = CASE 
        WHEN state IN ('ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA') THEN 'Regional Sales Manager 1'
        WHEN state IN ('DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC') THEN 'Regional Sales Manager 2'
        WHEN state IN ('GA', 'FL', 'AL', 'MS', 'TN', 'AR', 'LA') THEN 'Regional Sales Manager 3'
        WHEN state IN ('OH', 'IN', 'IL', 'MI', 'WI') THEN 'Regional Sales Manager 4'
        WHEN state IN ('MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS') THEN 'Regional Sales Manager 5'
        WHEN state IN ('TX', 'OK', 'NM', 'AZ') THEN 'Regional Sales Manager 6'
        WHEN state IN ('CO', 'WY', 'MT', 'ID', 'UT', 'NV') THEN 'Regional Sales Manager 7'
        WHEN state IN ('WA', 'OR', 'CA', 'AK', 'HI') THEN 'Regional Sales Manager 8'
        ELSE 'Unassigned'
      END;
    `);
    console.log("Database update complete!");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
  }
}
updateDB();
