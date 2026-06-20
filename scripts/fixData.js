require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function fixData() {
  try {
    console.log('Randomizing data to fix lopsided growth chart...');

    // Assigning a single random status
    console.log("Updating statuses and order_value...");
    await sql`
      UPDATE leads
      SET 
        status = CASE 
          WHEN random() < 0.30 THEN 'New'
          WHEN random() < 0.55 THEN 'Contacted'
          WHEN random() < 0.70 THEN 'Qualified'
          WHEN random() < 0.80 THEN 'Proposal'
          WHEN random() < 0.95 THEN 'Won'
          ELSE 'Lost'
        END,
        order_value = 10000 + FLOOR(random() * 290000)
    `;

    console.log("Re-distributing created_at globally over the last 12 months...");
    await sql`
      UPDATE leads
      SET created_at = NOW() - (random() * 365 || ' days')::interval
    `;

    console.log("Setting won_date for Won leads (10 to 90 days after created_at)...");
    await sql`
      UPDATE leads
      SET won_date = LEAST(NOW(), created_at + ((10 + random() * 80) || ' days')::interval)
      WHERE status = 'Won'
    `;

    // Ensure non-won deals have null won_date
    console.log("Clearing won_date for non-Won leads...");
    await sql`
      UPDATE leads
      SET won_date = NULL
      WHERE status != 'Won'
    `;

    console.log("Data successfully fixed!");

  } catch (error) {
    console.error('Error fixing data:', error);
  }
}

fixData();
