require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function addTemporalData() {
  try {
    console.log('Adding temporal columns and randomizing data...');

    // 1. Add columns if they don't exist
    await sql`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS won_date TIMESTAMP
    `;
    console.log('Columns created_at and won_date ensured.');

    // 2. Randomize created_at to be within the last 365 days
    console.log('Assigning random created_at dates...');
    await sql`
      UPDATE leads
      SET created_at = NOW() - (random() * 365 || ' days')::interval
    `;

    // 3. For 'Won' leads, assign a won_date 10 to 90 days after created_at
    // But don't let won_date exceed NOW()
    // It's possible created_at was very recent, so we cap it at NOW()
    console.log('Assigning won_date for Won leads...');
    await sql`
      UPDATE leads
      SET won_date = LEAST(NOW(), created_at + ((10 + random() * 80) || ' days')::interval)
      WHERE status = 'Won'
    `;

    console.log('Successfully added temporal data!');

  } catch (error) {
    console.error('Error adding temporal data:', error);
  }
}

addTemporalData();
