const { Client } = require('pg');
require('dotenv').config();

async function clearLinks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query('TRUNCATE TABLE enlaces_cortos RESTART IDENTITY CASCADE');
    console.log('Table enlaces_cortos cleared successfully.');
  } catch (err) {
    console.error('Error clearing links:', err);
  } finally {
    await client.end();
  }
}

clearLinks();
