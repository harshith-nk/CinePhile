const express = require("express");
const cors = require("cors");
const { Connection } = require("monetdb");

const app = express();
app.use(cors());
app.use(express.json());

const conn = new Connection({
  host: "localhost",
  port: 50000,
  database: "demo",
  username: "monetdb",
  password: "monetdb",
});

const esc = (s) => String(s).replace(/'/g, "''");

const COLS =
  "id, title, release_year, genre, rating, votes, director, overview, poster, runtime_min, certificate, stars, meta_score, gross";

const toMovie = (r) => ({
  id: r[0],
  title: r[1],
  release_year: r[2],
  genre: r[3],
  rating: r[4],
  votes: r[5],
  director: r[6],
  overview: r[7],
  poster: r[8],
  runtime: r[9],
  certificate: r[10],
  stars: r[11],
  meta_score: r[12],
  gross: r[13] == null ? null : Number(r[13]),
});

const SORTS = {
  rating: "rating DESC, votes DESC",
  votes: "votes DESC",
  newest: "release_year DESC",
  oldest: "release_year ASC",
  title: "title ASC",
  runtime: "runtime_min DESC",
  gross: "gross DESC",
};

const fail = (res, err) => {
  console.error(err);
  res.status(500).json({ error: err.message });
};

// Browse: search + filters + sort + pagination
app.get("/api/movies", async (req, res) => {
  try {
    const { search, genre, minYear, maxYear, minRating, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 24));

    const where = [];
    if (search) {
      const s = esc(search).toLowerCase();
      where.push(
        `(LOWER(title) LIKE '%${s}%' OR LOWER(director) LIKE '%${s}%' OR LOWER(stars) LIKE '%${s}%')`
      );
    }
    if (genre) where.push(`genre LIKE '%${esc(genre)}%'`);
    if (minYear && !isNaN(minYear)) where.push(`release_year >= ${Number(minYear)}`);
    if (maxYear && !isNaN(maxYear)) where.push(`release_year <= ${Number(maxYear)}`);
    if (minRating && !isNaN(minRating)) where.push(`rating >= ${Number(minRating)}`);
    const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";

    const orderBy = SORTS[sort] || SORTS.rating;

    const countRes = await conn.execute("SELECT COUNT(*) FROM movies" + whereSql);
    const total = Number(countRes.data[0][0]);

    const result = await conn.execute(
      `SELECT ${COLS} FROM movies${whereSql} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${(page - 1) * limit}`
    );
    res.json({ total, movies: result.data.map(toMovie) });
  } catch (err) {
    fail(res, err);
  }
});

// Watchlist: several movies by id
app.get("/api/movies/by-ids", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n));
    if (ids.length === 0) return res.json([]);
    const result = await conn.execute(
      `SELECT ${COLS} FROM movies WHERE id IN (${ids.join(",")}) ORDER BY rating DESC`
    );
    res.json(result.data.map(toMovie));
  } catch (err) {
    fail(res, err);
  }
});

// Surprise me
app.get("/api/random", async (req, res) => {
  try {
    const n = Math.floor(Math.random() * 1000) + 1;
    const result = await conn.execute(`SELECT ${COLS} FROM movies WHERE id = ${n}`);
    if (result.data.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(toMovie(result.data[0]));
  } catch (err) {
    fail(res, err);
  }
});

// One movie + similar movies
app.get("/api/movies/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await conn.execute(`SELECT ${COLS} FROM movies WHERE id = ${id}`);
    if (result.data.length === 0) return res.status(404).json({ error: "Not found" });
    const movie = toMovie(result.data[0]);

    const firstGenre = String(movie.genre || "").split(",")[0].trim();
    let similar = [];
    if (firstGenre) {
      const sim = await conn.execute(
        `SELECT ${COLS} FROM movies WHERE id <> ${id} AND genre LIKE '%${esc(firstGenre)}%' ORDER BY rating DESC, votes DESC LIMIT 8`
      );
      similar = sim.data.map(toMovie);
    }
    res.json({ ...movie, similar });
  } catch (err) {
    fail(res, err);
  }
});

// Headline numbers
app.get("/api/stats/summary", async (req, res) => {
  try {
    const r = await conn.execute(
      "SELECT COUNT(*), MIN(release_year), MAX(release_year), AVG(rating) FROM movies"
    );
    const [count, minYear, maxYear, avg] = r.data[0];
    res.json({
      count: Number(count),
      minYear,
      maxYear,
      avgRating: Number(Number(avg).toFixed(2)),
    });
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/stats/by-year", async (req, res) => {
  try {
    const result = await conn.execute(
      "SELECT release_year, COUNT(*) FROM movies WHERE release_year IS NOT NULL GROUP BY release_year ORDER BY release_year"
    );
    res.json(result.data.map((r) => ({ year: r[0], count: Number(r[1]) })));
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/stats/by-genre", async (req, res) => {
  try {
    const result = await conn.execute("SELECT genre, rating FROM movies");
    const map = {};
    for (const [genres, rating] of result.data) {
      for (const g of String(genres).split(",").map((x) => x.trim())) {
        if (!g) continue;
        if (!map[g]) map[g] = { sum: 0, count: 0 };
        map[g].sum += Number(rating);
        map[g].count += 1;
      }
    }
    res.json(
      Object.entries(map)
        .map(([genre, v]) => ({
          genre,
          count: v.count,
          avgRating: Number((v.sum / v.count).toFixed(2)),
        }))
        .sort((a, b) => b.count - a.count)
    );
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/stats/top-directors", async (req, res) => {
  try {
    const result = await conn.execute(
      "SELECT director, COUNT(*), AVG(rating) FROM movies GROUP BY director HAVING COUNT(*) >= 3 ORDER BY COUNT(*) DESC, AVG(rating) DESC LIMIT 8"
    );
    res.json(
      result.data.map((r) => ({
        director: r[0],
        count: Number(r[1]),
        avgRating: Number(Number(r[2]).toFixed(2)),
      }))
    );
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/genres", async (req, res) => {
  try {
    const result = await conn.execute("SELECT genre FROM movies");
    const set = new Set();
    for (const [genres] of result.data) {
      String(genres).split(",").forEach((x) => x.trim() && set.add(x.trim()));
    }
    res.json([...set].sort());
  } catch (err) {
    fail(res, err);
  }
});
// ---------- Reviews ----------
app.get("/api/movies/:id/reviews", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const list = await conn.execute(
      `SELECT id, author, stars, body, created_at FROM reviews WHERE movie_id = ${id} ORDER BY id DESC LIMIT 30`
    );
    const agg = await conn.execute(
      `SELECT COUNT(*), AVG(stars) FROM reviews WHERE movie_id = ${id}`
    );
    const count = Number(agg.data[0][0]);
    res.json({
      count,
      avg: count ? Number(Number(agg.data[0][1]).toFixed(1)) : null,
      reviews: list.data.map((r) => ({
        id: r[0],
        author: r[1],
        stars: r[2],
        body: r[3],
        created_at: String(r[4]).slice(0, 10),
      })),
    });
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/movies/:id/reviews", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const stars = parseInt(req.body.stars);
    const body = String(req.body.body || "").trim().slice(0, 600);
    const author = String(req.body.author || "").trim().slice(0, 40) || "Anonymous";
    if (!(stars >= 1 && stars <= 5))
      return res.status(400).json({ error: "Pick a star rating from 1 to 5." });
    if (body.length < 3)
      return res.status(400).json({ error: "Write at least a few words in your review." });
    await conn.execute(
      `INSERT INTO reviews (movie_id, author, stars, body) VALUES (${id}, '${esc(author)}', ${stars}, '${esc(body)}')`
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// ---------- Extra stats for Insights ----------
app.get("/api/stats/by-decade", async (req, res) => {
  try {
    const result = await conn.execute(
      "SELECT decade, SUM(gross), AVG(rating), COUNT(*) FROM (SELECT (release_year / 10) * 10 AS decade, gross, rating FROM movies WHERE release_year IS NOT NULL) AS t GROUP BY decade ORDER BY decade"
    );
    res.json(
      result.data.map((r) => ({
        decade: `${r[0]}s`,
        grossBn: Number((Number(r[1] || 0) / 1e9).toFixed(2)),
        avgRating: Number(Number(r[2]).toFixed(2)),
        count: Number(r[3]),
      }))
    );
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/stats/top-grossing", async (req, res) => {
  try {
    const result = await conn.execute(
      "SELECT id, title, release_year, gross FROM movies WHERE gross IS NOT NULL ORDER BY gross DESC LIMIT 10"
    );
    res.json(
      result.data.map((r) => ({
        id: r[0],
        title: r[1],
        release_year: r[2],
        gross: Number(r[3]),
      }))
    );
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/stats/scatter", async (req, res) => {
  try {
    const result = await conn.execute("SELECT id, title, rating, votes FROM movies");
    res.json(
      result.data.map((r) => ({ id: r[0], title: r[1], rating: r[2], votes: Number(r[3]) }))
    );
  } catch (err) {
    fail(res, err);
  }
});

async function start() {
  await conn.connect();
  await conn.setAutocommit(true);
  console.log("Connected to MonetDB");
  app.listen(5000, () => console.log("Server running on http://localhost:5000"));
}

start().catch(console.error);