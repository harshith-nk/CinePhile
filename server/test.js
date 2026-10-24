const { Connection } = require("monetdb");

async function main() {
  const conn = new Connection({
    host: "localhost",
    port: 50000,
    database: "demo",
    username: "monetdb",
    password: "monetdb",
  });

  await conn.connect();
  const result = await conn.execute(
    "SELECT id, title, release_year, genre, rating FROM movies LIMIT 3"
  );
  console.log(result);
  await conn.close();
}

main().catch(console.error);