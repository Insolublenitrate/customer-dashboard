require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function check() {
  const res = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads'`;
  console.log(res.rows);
}

check();
