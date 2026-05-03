const { Client } = require('pg');
require('dotenv').config();

exports.handler = async (event) => {
  const { code } = event.queryStringParameters || {};
  if (!code) return { statusCode: 400, body: "Missing code" };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT ec.fecha, c.nombre as clase, c.id as clase_id
      FROM enlaces_cortos ec
      JOIN clases c ON ec.clase_id = c.id
      WHERE ec.codigo = $1
    `, [code]);

    if (res.rows.length === 0) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: "Link not found" }) 
      };
    }

    const row = res.rows[0];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claseId: row.clase_id,
        className: row.clase,
        fecha: row.fecha
      })
    };
  } catch (error) {
    console.error("Resolution error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    await client.end();
  }
};
