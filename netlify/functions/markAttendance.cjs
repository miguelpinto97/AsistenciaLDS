const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  const { alumnoId, fecha } = JSON.parse(event.body);
  if (!alumnoId || !fecha) {
    return { 
      statusCode: 400, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Missing data" }) 
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Insert attendance with conflict handling (already marked)
    await client.query(`
      INSERT INTO asistencias (alumno_id, fecha)
      VALUES ($1, $2)
      ON CONFLICT (alumno_id, fecha) DO NOTHING
    `, [alumnoId, fecha]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Attendance marked successfully" })
    };

  } catch (error) {
    console.error("Attendance error:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    await client.end();
  }
};
