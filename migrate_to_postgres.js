const sqlite3 = require('sqlite3').verbose();
const { db } = require('@vercel/postgres');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  if (!process.env.POSTGRES_URL) {
    console.error("ERROR: POSTGRES_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("Connecting to Vercel Postgres...");
  const client = await db.connect();

  console.log("Creating table in Postgres if it doesn't exist...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      company TEXT,
      contact_name TEXT,
      email TEXT,
      contact_phone TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      machine_make TEXT,
      machine_model TEXT,
      control TEXT,
      product TEXT,
      order_value NUMERIC
    );
  `);

  console.log("Connecting to local SQLite database...");
  const dbPath = path.resolve(__dirname, '../customer_leads.db');
  
  const sqlite = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error("Error opening local database:", err.message);
      process.exit(1);
    }
  });

  sqlite.all('SELECT * FROM leads', async (err, rows) => {
    if (err) {
      console.error("Error reading from local database:", err.message);
      process.exit(1);
    }

    console.log(`Found ${rows.length} rows in local SQLite DB. Preparing to migrate...`);

    // To prevent overwhelming the connection, we batch inserts
    let successCount = 0;
    
    for (const row of rows) {
      const query = `
        INSERT INTO leads (
          id, company, contact_name, email, contact_phone, 
          city, state, zip, machine_make, machine_model, control, product, order_value
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `;
      const params = [
        row.id, row.company, row.contact_name, row.email, row.contact_phone,
        row.city, row.state, row.zip, row.machine_make, row.machine_model, 
        row.control, row.product, row.order_value || 0
      ];

      try {
        await client.query(query, params);
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Migrated ${successCount}/${rows.length} leads...`);
        }
      } catch (insertErr) {
        console.error(`Error inserting lead ID ${row.id}:`, insertErr.message);
      }
    }

    console.log(`Migration Complete! Successfully migrated ${successCount} leads to Vercel Postgres.`);
    
    // Reset the sequence so new INSERTs don't clash with existing IDs
    try {
      await client.query(`SELECT setval('leads_id_seq', (SELECT MAX(id) FROM leads));`);
      console.log("Postgres auto-increment sequence updated.");
    } catch (seqErr) {
      console.error("Warning: Could not update ID sequence:", seqErr.message);
    }

    sqlite.close();
    client.release();
    process.exit(0);
  });
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
