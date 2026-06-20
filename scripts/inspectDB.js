require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function inspect() {
  try {
    const res1 = await sql`SELECT COUNT(*) FROM leads WHERE status = 'Won'`;
    console.log('Total Won:', res1.rows[0].count);

    const res2 = await sql`SELECT COUNT(*) FROM leads WHERE status = 'Won' AND regional_manager IS NOT NULL AND regional_manager != 'Unassigned'`;
    console.log('Total Won with Manager:', res2.rows[0].count);

    const res3 = await sql`SELECT TO_CHAR(DATE_TRUNC('month', won_date), 'YYYY-MM') as month, COUNT(*) FROM leads WHERE status = 'Won' GROUP BY month ORDER BY month`;
    console.log('Distribution by Month:');
    console.log(res3.rows);

  } catch (err) {
    console.error(err);
  }
}
inspect();
