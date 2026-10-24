# CinePhile

A full-stack movie explorer built on the IMDb Top 1000 dataset. Browse, search and compare the best-rated films ever made, save a watchlist, write reviews, and explore charts about ratings and box office.

**Tech stack:** React (Vite) · Node.js · Express · MonetDB

## Features

- Search by title, director or actor
- Filter by genre, year range and minimum rating, with 7 sort options
- Poster grid with "Show more" pagination
- Movie details: cast, runtime, certificate, Metascore, box office and similar films
- Watchlist saved in the browser
- Reviews and star ratings saved in MonetDB
- Compare two films side by side
- Insights page: films per year, box office and ratings by decade, rating vs votes, top directors, highest-grossing films
- "Tonight's pick" spotlight and a "Surprise me" button

## Why MonetDB

MonetDB is a column-store database built for analytics. The Insights page relies on aggregate queries (`COUNT`, `SUM`, `AVG` with `GROUP BY` and `HAVING`) over the whole table, which is what MonetDB is designed for.

## Project structure

```
CinePhile/
  client/              React app (Vite)
  server/              Express API + MonetDB connection
  imdb_top_1000.csv    Dataset
  README.md
```

## Prerequisites

- Node.js 20 or newer
- MonetDB installed and running (database `demo`, user `monetdb`, password `monetdb`)

## Setup

### 1. Create and load the database

Start the MonetDB server, open the MonetDB client (`mclient`), and log in with user `monetdb` and password `monetdb`. Then run the following.

Raw table (the CSV is loaded as plain text first because it has messy values):

```sql
CREATE TABLE movies_raw (
  poster_link VARCHAR(500),
  series_title VARCHAR(255),
  released_year VARCHAR(20),
  certificate VARCHAR(20),
  runtime VARCHAR(20),
  genre VARCHAR(100),
  imdb_rating VARCHAR(10),
  overview VARCHAR(1000),
  meta_score VARCHAR(10),
  director VARCHAR(150),
  star1 VARCHAR(100),
  star2 VARCHAR(100),
  star3 VARCHAR(100),
  star4 VARCHAR(100),
  no_of_votes VARCHAR(20),
  gross VARCHAR(30)
);
```

Load the CSV (change the path to where the file is on your computer, and use forward slashes):

```sql
COPY OFFSET 2 INTO movies_raw FROM 'D:/Skills/CinePhile/imdb_top_1000.csv' USING DELIMITERS ',', E'\n', '"' NULL AS '';
```

Clean table used by the app (`year` is a reserved word in MonetDB, so the column is `release_year`):

```sql
CREATE TABLE movies (
  id INT,
  title VARCHAR(255),
  release_year INT,
  genre VARCHAR(100),
  rating DOUBLE,
  votes INT,
  director VARCHAR(150),
  overview VARCHAR(1000)
);

UPDATE movies_raw SET released_year = NULL WHERE released_year NOT LIKE '____';

INSERT INTO movies (id, title, release_year, genre, rating, votes, director, overview)
SELECT
  ROW_NUMBER() OVER (),
  series_title,
  CAST(released_year AS INT),
  genre,
  CAST(imdb_rating AS DOUBLE),
  CAST(no_of_votes AS INT),
  director,
  overview
FROM movies_raw;
```

Extra columns:

```sql
ALTER TABLE movies ADD COLUMN poster VARCHAR(500);
ALTER TABLE movies ADD COLUMN runtime_min INT;
ALTER TABLE movies ADD COLUMN certificate VARCHAR(20);
ALTER TABLE movies ADD COLUMN stars VARCHAR(400);
ALTER TABLE movies ADD COLUMN meta_score INT;
ALTER TABLE movies ADD COLUMN gross BIGINT;

UPDATE movies SET poster = (SELECT MIN(poster_link) FROM movies_raw WHERE series_title = movies.title);
UPDATE movies SET runtime_min = (SELECT MIN(CAST(REPLACE(runtime, ' min', '') AS INT)) FROM movies_raw WHERE series_title = movies.title);
UPDATE movies SET certificate = (SELECT MIN(certificate) FROM movies_raw WHERE series_title = movies.title);
UPDATE movies SET stars = (SELECT MIN(star1 || ', ' || star2 || ', ' || star3 || ', ' || star4) FROM movies_raw WHERE series_title = movies.title);
UPDATE movies SET meta_score = (SELECT MIN(CAST(meta_score AS INT)) FROM movies_raw WHERE series_title = movies.title);
UPDATE movies SET gross = (SELECT MIN(CAST(REPLACE(gross, ',', '') AS BIGINT)) FROM movies_raw WHERE series_title = movies.title);
```

Reviews table:

```sql
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT,
  author VARCHAR(60),
  stars INT,
  body VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Check that it worked:

```sql
SELECT COUNT(*) FROM movies;
```

It should return `1000`.

### 2. Start the API server

```bash
cd server
npm install
node server.js
```

You should see `Connected to MonetDB` and `Server running on http://localhost:5000`.

The database connection settings (host, port, database name, user, password) are at the top of `server/server.js`.

### 3. Start the React app

In a second terminal:

```bash
cd client
npm install
npm run dev
```

If `npm install` fails with an `edgesOut` error, use `npm install --legacy-peer-deps` and then `npm install react-is --legacy-peer-deps`.

Open http://localhost:5173 in your browser.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/movies` | Search, filter, sort and paginate (`search`, `genre`, `minYear`, `maxYear`, `minRating`, `sort`, `page`, `limit`) |
| GET | `/api/movies/:id` | One movie with similar films |
| GET | `/api/movies/by-ids?ids=1,2,3` | Several movies (used by the watchlist) |
| GET | `/api/random` | A random movie |
| GET | `/api/genres` | List of genres |
| GET | `/api/movies/:id/reviews` | Reviews and average stars for a movie |
| POST | `/api/movies/:id/reviews` | Add a review (`author`, `stars`, `body`) |
| GET | `/api/stats/summary` | Total films, year range, average rating |
| GET | `/api/stats/by-year` | Films per year |
| GET | `/api/stats/by-genre` | Average rating and count per genre |
| GET | `/api/stats/by-decade` | Box office and average rating per decade |
| GET | `/api/stats/top-directors` | Directors with the most films |
| GET | `/api/stats/top-grossing` | Ten highest-grossing films |
| GET | `/api/stats/scatter` | Rating and votes for every film |

## Notes

- The dataset is the "IMDB Dataset of Top 1000 Movies and TV Shows" from Kaggle.
- Poster images are loaded from the links in the dataset.
- The watchlist is stored in the browser's local storage; reviews are stored in MonetDB.

## Author

N K Harshith