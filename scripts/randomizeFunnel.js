require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function randomizeFunnel() {
  try {
    console.log('Connecting to database and randomizing lead statuses...');

    // Fetch all lead IDs
    const result = await sql`SELECT id FROM leads`;
    const leads = result.rows;
    console.log(`Found ${leads.length} leads.`);

    let updatedCount = 0;

    // A realistic distribution (rough percentages)
    // New: 35%, Contacted: 25%, Qualified: 15%, Proposal: 10%, Won: 10%, Lost: 5%
    const statuses = [
      { status: 'New', weight: 0.35 },
      { status: 'Contacted', weight: 0.25 },
      { status: 'Qualified', weight: 0.15 },
      { status: 'Proposal', weight: 0.10 },
      { status: 'Won', weight: 0.10 },
      { status: 'Lost', weight: 0.05 }
    ];

    function getRandomStatus() {
      const rand = Math.random();
      let cumulative = 0;
      for (const s of statuses) {
        cumulative += s.weight;
        if (rand <= cumulative) {
          return s.status;
        }
      }
      return 'New';
    }

    // We can do this with a single SQL query to be faster, but since there are only a few thousand rows, a transaction or batched update might be better. 
    // Actually, setting random values in SQL is easiest:
    console.log("Updating via SQL directly...");
    await sql`
      UPDATE leads
      SET status = CASE
        WHEN random() < 0.35 THEN 'New'
        WHEN random() < 0.60 THEN 'Contacted'
        WHEN random() < 0.75 THEN 'Qualified'
        WHEN random() < 0.85 THEN 'Proposal'
        WHEN random() < 0.95 THEN 'Won'
        ELSE 'Lost'
      END
    `;

    console.log(`Successfully updated leads with randomized funnel statuses!`);

  } catch (error) {
    console.error('Error randomizing funnel data:', error);
  }
}

randomizeFunnel();
