const { Client } = require('pg');
require('dotenv').config();

async function clearRecords() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log('Clearing asistencias...');
    await client.query('TRUNCATE TABLE asistencias RESTART IDENTITY CASCADE');
    
    console.log('Clearing enlaces_cortos...');
    await client.query('TRUNCATE TABLE enlaces_cortos RESTART IDENTITY CASCADE');
    
    console.log('Records cleared successfully. Students and Classes remain intact.');
  } catch (err) {
    console.error('Error clearing records:', err);
  } finally {
    await client.end();
  }
}

clearRecords();
