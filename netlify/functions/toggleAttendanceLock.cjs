const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event) => {
  const { fecha, lock } = event.queryStringParameters || {};
  if (!fecha) return { statusCode: 400, body: "Missing fecha" };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    if (lock === 'true') {
      await client.query('INSERT INTO fechas_cerradas (fecha) VALUES ($1) ON CONFLICT DO NOTHING', [fecha]);
    } else {
      await client.query('DELETE FROM fechas_cerradas WHERE fecha = $1', [fecha]);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Fecha ${lock === 'true' ? 'cerrada' : 'abierta'} correctamente` })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
