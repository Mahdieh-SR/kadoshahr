import "dotenv/config";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const { rows } = await client.query("select version()");
  console.log("OK:", rows[0].version);
} catch (e) {
  console.error("FAIL:", e.message);
} finally {
  await client.end().catch(() => {});
}
