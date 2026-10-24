import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const API = "http://localhost:5000/api";
const PAGE_SIZE = 24;

const SORTS = [
  ["rating", "Top rated"],
  ["votes", "Most voted"],
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["gross", "Biggest box office"],
  ["runtime", "Longest runtime"],
  ["title", "Title A to Z"],
];

const get = (path) =>
  fetch(`${API}${path}`).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const post = (path, body) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  });

const hiRes = (url) => (url ? url.replace(/_V1_.*\.jpg$/, "_V1_.jpg") : url);
const fmtRuntime = (m) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : null);
const fmtMoney = (n) =>
  n == null ? null : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
const starText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Poster(props) {
  return <PosterImage key={props.movie.id} {...props} />;
}

function PosterImage({ movie, className = "" }) {
  const original = movie.poster;
  const [src, setSrc] = useState(hiRes(original));
  const [failed, setFailed] = useState(false);

  if (!original || failed) {
    return (
      <div className={`poster poster-fallback ${className}`}>
        <span>{movie.title}</span>
      </div>
    );
  }
  return (
    <img
      className={`poster ${className}`}
      src={src}
      alt={`${movie.title} poster`}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => (src !== original ? setSrc(original) : setFailed(true))}
    />
  );
}

function Heart({ on, onClick, label }) {
  return (
    <button
      className={`heart ${on ? "on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={on}
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2 .6-1 1.9-2 3.8-2 3.2 0 5 3.1 3.7 6.3C19.5 16.4 12 21 12 21z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function MovieCard({ m, fav, onToggleFav, onOpen }) {
  return (
    <article className="card" onClick={() => onOpen(m.id)}>
      <div className="card-art">
        <Poster movie={m} />
        <span className="score">{Number(m.rating).toFixed(1)}</span>
        <Heart
          on={fav}
          onClick={onToggleFav}
          label={fav ? `Remove ${m.title} from watchlist` : `Add ${m.title} to watchlist`}
        />
      </div>
      <h3 className="card-title">{m.title}</h3>
      <p className="card-meta">
        {m.release_year} · {String(m.genre).split(",")[0]}
      </p>
    </article>
  );
}

/* ---------- Reviews ---------- */
function Reviews({ movieId }) {
  const [data, setData] = useState({ count: 0, avg: null, reviews: [] });
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem("cinephile-name") || "";
    } catch {
      return "";
    }
  });
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", error: false });

  const load = () =>
    get(`/movies/${movieId}/reviews`)
      .then(setData)
      .catch(() => {});

  useEffect(() => {
    setStars(0);
    setBody("");
    setMsg({ text: "", error: false });
    load();
  }, [movieId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: "", error: false });
    try {
      await post(`/movies/${movieId}/reviews`, { author, stars, body });
      try {
        localStorage.setItem("cinephile-name", author);
      } catch {}
      setStars(0);
      setBody("");
      setMsg({ text: "Review posted.", error: false });
      load();
    } catch (err) {
      setMsg({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="reviews">
      <h3>
        Reviews
        {data.count > 0 && (
          <span className="muted">
            {" "}
            {data.avg} / 5 from {data.count} {data.count === 1 ? "review" : "reviews"}
          </span>
        )}
      </h3>

      <form className="review-form" onSubmit={submit}>
        <div className="star-pick" role="group" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              className={n <= stars ? "on" : ""}
              onClick={() => setStars(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={n <= stars}
            >
              ★
            </button>
          ))}
        </div>
        <input
          placeholder="Your name (optional)"
          value={author}
          maxLength={40}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <textarea
          placeholder="What did you think of this film?"
          value={body}
          maxLength={600}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="review-actions">
          <button className="btn btn-main small" disabled={busy}>
            {busy ? "Posting…" : "Post review"}
          </button>
          {msg.text && <span className={msg.error ? "msg-error" : "msg-ok"}>{msg.text}</span>}
        </div>
      </form>

      {data.reviews.length === 0 ? (
        <p className="muted">No reviews yet. Be the first to write one.</p>
      ) : (
        <ul className="review-list">
          {data.reviews.map((r) => (
            <li key={r.id}>
              <div className="review-head">
                <strong>{r.author}</strong>
                <span className="review-stars" aria-label={`${r.stars} out of 5`}>
                  {starText(r.stars)}
                </span>
                <span className="muted">{r.created_at}</span>
              </div>
              <p>{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Movie details window ---------- */
function MovieModal({ id, onClose, onOpen, isFav, toggleFav, onSearch, onCompare }) {
  const [m, setM] = useState(null);

  useEffect(() => {
    setM(null);
    get(`/movies/${id}`)
      .then(setM)
      .catch(() => onClose());
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>
        {!m ? (
          <div className="modal-loading">Loading…</div>
        ) : (
          <>
            <div className="modal-glow" style={{ backgroundImage: `url(${hiRes(m.poster)})` }} />
            <div className="modal-body">
              <Poster movie={m} className="modal-poster" />
              <div className="modal-info">
                <h2>{m.title}</h2>
                <p className="facts">
                  {[m.release_year, fmtRuntime(m.runtime), m.certificate && `Rated ${m.certificate}`]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
                <div className="pills">
                  {String(m.genre)
                    .split(",")
                    .map((g) => (
                      <span key={g} className="pill-static">
                        {g.trim()}
                      </span>
                    ))}
                </div>
                <div className="ratings">
                  <div>
                    <strong>{Number(m.rating).toFixed(1)}</strong>
                    <span>IMDb · {Number(m.votes).toLocaleString()} votes</span>
                  </div>
                  {m.meta_score != null && (
                    <div>
                      <strong>{m.meta_score}</strong>
                      <span>Metascore</span>
                    </div>
                  )}
                  {m.gross != null && (
                    <div>
                      <strong>{fmtMoney(m.gross)}</strong>
                      <span>Box office</span>
                    </div>
                  )}
                </div>
                <p className="overview">{m.overview}</p>
                <p className="credit">
                  <span>Directed by</span>{" "}
                  <button className="link" onClick={() => onSearch(m.director)}>
                    {m.director}
                  </button>
                </p>
                {m.stars && (
                  <p className="credit">
                    <span>Starring</span> {m.stars}
                  </p>
                )}
                <div className="btn-row">
                  <button
                    className={`btn ${isFav(m.id) ? "btn-ghost" : "btn-main"}`}
                    onClick={() => toggleFav(m.id)}
                  >
                    {isFav(m.id) ? "Remove from watchlist" : "Add to watchlist"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => onCompare(m)}>
                    Compare
                  </button>
                </div>
              </div>
            </div>

            <Reviews movieId={m.id} />

            {m.similar?.length > 0 && (
              <div className="similar">
                <h3>If you liked this</h3>
                <div className="similar-row">
                  {m.similar.map((s) => (
                    <button key={s.id} className="similar-item" onClick={() => onOpen(s.id)}>
                      <Poster movie={s} />
                      <span>{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Compare ---------- */
function Picker({ movie, onPick, label }) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!dq.trim()) {
      setResults([]);
      return;
    }
    get(`/movies?search=${encodeURIComponent(dq)}&limit=6`)
      .then((d) => setResults(d.movies))
      .catch(() => {});
  }, [dq]);

  if (movie) {
    return (
      <div className="pick-chosen">
        <Poster movie={movie} />
        <div>
          <h3>{movie.title}</h3>
          <p className="muted">{movie.release_year}</p>
          <button className="link" onClick={() => onPick(null)}>
            Change film
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pick">
      <input
        placeholder={label}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={label}
      />
      {results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onPick(r);
                  setQ("");
                  setResults([]);
                }}
              >
                <Poster movie={r} />
                <span>
                  {r.title} ({r.release_year})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ROWS = [
  { label: "IMDb rating", get: (m) => m.rating, fmt: (v) => Number(v).toFixed(1), win: true },
  { label: "Votes", get: (m) => m.votes, fmt: (v) => Number(v).toLocaleString(), win: true },
  { label: "Metascore", get: (m) => m.meta_score, fmt: (v) => v, win: true },
  { label: "Box office", get: (m) => m.gross, fmt: fmtMoney, win: true },
  { label: "Runtime", get: (m) => m.runtime, fmt: fmtRuntime },
  { label: "Released", get: (m) => m.release_year, fmt: (v) => v },
  { label: "Director", get: (m) => m.director, fmt: (v) => v },
  { label: "Genre", get: (m) => m.genre, fmt: (v) => v },
  { label: "Starring", get: (m) => m.stars, fmt: (v) => v },
];

function Compare({ a, b, setA, setB, onOpen }) {
  let tallyA = 0;
  let tallyB = 0;
  let contested = 0;

  const rows = ROWS.map((r) => {
    const va = a ? r.get(a) : null;
    const vb = b ? r.get(b) : null;
    let win = null;
    if (a && b && r.win && va != null && vb != null && Number(va) !== Number(vb)) {
      win = Number(va) > Number(vb) ? "a" : "b";
      contested++;
      if (win === "a") tallyA++;
      else tallyB++;
    }
    return { ...r, va, vb, win };
  });

  let verdict = "Pick two films to see how they stack up.";
  if (a && b) {
    if (tallyA === tallyB) verdict = `It's a tie: ${tallyA} categories each out of ${contested}.`;
    else {
      const w = tallyA > tallyB ? a : b;
      verdict = `${w.title} leads in ${Math.max(tallyA, tallyB)} of ${contested} categories.`;
    }
  }

  return (
    <section className="compare">
      <div className="cmp-picks">
        <Picker movie={a} onPick={setA} label="Search for the first film" />
        <span className="cmp-vs">vs</span>
        <Picker movie={b} onPick={setB} label="Search for the second film" />
      </div>
      <p className="verdict">{verdict}</p>

      {a && b && (
        <div className="cmp-grid">
          {rows.map((r) => (
            <div className="cmp-row" key={r.label}>
              <span className="cmp-label">{r.label}</span>
              <span className={`cmp-cell ${r.win === "a" ? "win" : ""}`}>
                {r.va != null ? r.fmt(r.va) : "n/a"}
              </span>
              <span className={`cmp-cell ${r.win === "b" ? "win" : ""}`}>
                {r.vb != null ? r.fmt(r.vb) : "n/a"}
              </span>
            </div>
          ))}
          <div className="cmp-row">
            <span className="cmp-label">Details</span>
            <span className="cmp-cell">
              <button className="link" onClick={() => onOpen(a.id)}>
                Open {a.title}
              </button>
            </span>
            <span className="cmp-cell">
              <button className="link" onClick={() => onOpen(b.id)}>
                Open {b.title}
              </button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Insights ---------- */
const tipStyle = {
  contentStyle: {
    background: "#231833",
    border: "1px solid #3d2d55",
    borderRadius: 8,
    color: "#f4ecdd",
  },
  cursor: { fill: "rgba(245,168,59,0.08)" },
};

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <strong>{p.title}</strong>
      <br />
      {Number(p.rating).toFixed(1)} rating · {p.votes.toLocaleString()} votes
    </div>
  );
}

const fmtVotes = (v) => (v >= 1e6 ? `${v / 1e6}M` : `${Math.round(v / 1000)}k`);

function Insights({ onDirector, onOpen }) {
  const [byYear, setByYear] = useState([]);
  const [byGenre, setByGenre] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [byDecade, setByDecade] = useState([]);
  const [topGross, setTopGross] = useState([]);
  const [scatter, setScatter] = useState([]);

  useEffect(() => {
    get("/stats/by-year").then(setByYear).catch(() => {});
    get("/stats/by-genre").then(setByGenre).catch(() => {});
    get("/stats/top-directors").then(setDirectors).catch(() => {});
    get("/stats/by-decade").then(setByDecade).catch(() => {});
    get("/stats/top-grossing").then(setTopGross).catch(() => {});
    get("/stats/scatter").then(setScatter).catch(() => {});
  }, []);

  return (
    <section className="insights">
      <div className="panel wide">
        <h3>Films in the list, by release year</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={byYear}>
            <defs>
              <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5a83b" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#f5a83b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#3d2d55" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" stroke="#a596b8" tick={{ fontSize: 12 }} minTickGap={30} />
            <YAxis stroke="#a596b8" tick={{ fontSize: 12 }} />
            <Tooltip {...tipStyle} />
            <Area type="monotone" dataKey="count" stroke="#f5a83b" strokeWidth={2} fill="url(#amber)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h3>Total box office by decade (billion $)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byDecade}>
            <CartesianGrid stroke="#3d2d55" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="decade" stroke="#a596b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a596b8" tick={{ fontSize: 12 }} />
            <Tooltip {...tipStyle} formatter={(v) => [`$${v}B`, "Box office"]} />
            <Bar dataKey="grossBn" fill="#f5a83b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h3>Average rating by decade</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byDecade}>
            <CartesianGrid stroke="#3d2d55" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="decade" stroke="#a596b8" tick={{ fontSize: 12 }} />
            <YAxis domain={[7.5, 8.8]} stroke="#a596b8" tick={{ fontSize: 12 }} />
            <Tooltip {...tipStyle} />
            <Bar dataKey="avgRating" fill="#e0566b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel wide">
        <h3>Rating vs number of votes</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ left: 0, right: 20, top: 10 }}>
            <CartesianGrid stroke="#3d2d55" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="votes"
              name="Votes"
              scale="log"
              domain={[20000, 3000000]}
              ticks={[25000, 100000, 500000, 2000000]}
              tickFormatter={fmtVotes}
              stroke="#a596b8"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="rating"
              name="Rating"
              domain={[7.5, 9.4]}
              stroke="#a596b8"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={scatter} fill="#f5a83b" fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h3>Highest-grossing films</h3>
        <ol className="directors">
          {topGross.map((g) => (
            <li key={g.id}>
              <button className="link" onClick={() => onOpen(g.id)}>
                {g.title} ({g.release_year})
              </button>
              <span>{fmtMoney(g.gross)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <h3>Directors with the most films</h3>
        <ol className="directors">
          {directors.map((d) => (
            <li key={d.director}>
              <button className="link" onClick={() => onDirector(d.director)}>
                {d.director}
              </button>
              <span>
                {d.count} films · avg {d.avgRating}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel wide">
        <h3>Average rating by genre</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, byGenre.length * 24)}>
          <BarChart data={byGenre} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" domain={[7, 9]} stroke="#a596b8" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="genre"
              width={85}
              stroke="#a596b8"
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <Tooltip {...tipStyle} />
            <Bar dataKey="avgRating" fill="#e0566b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [view, setView] = useState("browse");
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState("rating");
  const dSearch = useDebounce(search);

  const [genres, setGenres] = useState([]);
  const [summary, setSummary] = useState(null);
  const [hero, setHero] = useState(null);

  const [movies, setMovies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState(null);
  const [cmpA, setCmpA] = useState(null);
  const [cmpB, setCmpB] = useState(null);
  const [favs, setFavs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cinephile-watchlist")) || [];
    } catch {
      return [];
    }
  });
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    get("/genres").then(setGenres).catch(() => {});
    get("/stats/summary").then(setSummary).catch(() => {});
    get("/random").then(setHero).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cinephile-watchlist", JSON.stringify(favs));
    } catch {}
  }, [favs]);

  useEffect(() => {
    if (view !== "browse") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      search: dSearch,
      genre,
      minYear,
      maxYear,
      minRating,
      sort,
      page: 1,
      limit: PAGE_SIZE,
    });
    get(`/movies?${params}`)
      .then((d) => {
        if (cancelled) return;
        setMovies(d.movies);
        setTotal(d.total);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled)
          setError("Can't reach the CinePhile server. Check that node server.js is running.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [dSearch, genre, minYear, maxYear, minRating, sort, view]);

  useEffect(() => {
    if (view !== "watchlist") return;
    if (favs.length === 0) {
      setWatchlist([]);
      return;
    }
    get(`/movies/by-ids?ids=${favs.join(",")}`)
      .then(setWatchlist)
      .catch(() => {});
  }, [view, favs]);

  const loadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    const params = new URLSearchParams({
      search: dSearch,
      genre,
      minYear,
      maxYear,
      minRating,
      sort,
      page: next,
      limit: PAGE_SIZE,
    });
    get(`/movies?${params}`)
      .then((d) => {
        setMovies((prev) => [...prev, ...d.movies]);
        setPage(next);
      })
      .finally(() => setLoadingMore(false));
  };

  const isFav = (id) => favs.includes(id);
  const toggleFav = (id) =>
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const surprise = () => get("/random").then((m) => setOpenId(m.id));

  const addToCompare = (m) => {
    if (!cmpA) setCmpA(m);
    else if (cmpA.id !== m.id) setCmpB(m);
    setOpenId(null);
    setView("compare");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searchFor = (text) => {
    setOpenId(null);
    setView("browse");
    setGenre("");
    setMinYear("");
    setMaxYear("");
    setMinRating("");
    setSearch(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeFilters = [search, genre, minYear, maxYear, minRating].filter(Boolean).length;
  const clearFilters = () => {
    setSearch("");
    setGenre("");
    setMinYear("");
    setMaxYear("");
    setMinRating("");
  };

  const list = view === "watchlist" ? watchlist : movies;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          CinePhile
        </div>
        <nav className="nav">
          <button className={view === "browse" ? "active" : ""} onClick={() => setView("browse")}>
            Browse
          </button>
          <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
            Compare
          </button>
          <button
            className={view === "watchlist" ? "active" : ""}
            onClick={() => setView("watchlist")}
          >
            Watchlist
            {favs.length > 0 && <span className="count">{favs.length}</span>}
          </button>
          <button
            className={view === "insights" ? "active" : ""}
            onClick={() => setView("insights")}
          >
            Insights
          </button>
        </nav>
        <button className="btn btn-main small" onClick={surprise}>
          Surprise me
        </button>
      </header>
            {view === "browse" && (
        <section className="intro">
          <h2 className="intro-title">Find your next favourite film.</h2>
          <p className="intro-text">
            CinePhile is a movie explorer built on the IMDb Top{" "}
            {summary ? summary.count.toLocaleString() : "1,000"}. Browse the best-rated films
            ever made, and decide what to watch tonight.
          </p>
          <ul className="intro-features">
            <li>
              <strong>Search and filter</strong>
              <span>By title, director, actor, genre, year or rating.</span>
            </li>
            <li>
              <strong>Compare</strong>
              <span>Put two films side by side and see which one wins.</span>
            </li>
            <li>
              <strong>Watchlist and reviews</strong>
              <span>Save films for later and write your own reviews.</span>
            </li>
            <li>
              <strong>Insights</strong>
              <span>Charts on box office, ratings and top directors.</span>
            </li>
          </ul>
        </section>
      )}

      {view === "browse" && hero && (
      
      
        <section className="hero">
          <div className="hero-glow" style={{ backgroundImage: `url(${hiRes(hero.poster)})` }} />
          <div className="hero-text">
            <p className="hero-kicker">Tonight's pick</p>
            <h1>{hero.title}</h1>
            <p className="hero-facts">
              {hero.release_year} · {fmtRuntime(hero.runtime)} · {Number(hero.rating).toFixed(1)} on IMDb
            </p>
            <p className="hero-overview">{hero.overview}</p>
            <div className="hero-actions">
              <button className="btn btn-main" onClick={() => setOpenId(hero.id)}>
                See details
              </button>
              <button className="btn btn-ghost" onClick={() => toggleFav(hero.id)}>
                {isFav(hero.id) ? "On your watchlist" : "Add to watchlist"}
              </button>
            </div>
          </div>
          <button
            className="hero-poster-btn"
            onClick={() => setOpenId(hero.id)}
            aria-label={`See details for ${hero.title}`}
          >
            <Poster movie={hero} className="hero-poster" />
          </button>
        </section>
      )}

      {view === "browse" && (
        <div className="toolbar">
          <div className="toolbar-row">
            <input
              className="search"
              placeholder="Search by title, director or actor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search movies"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              aria-label="Minimum rating"
            >
              <option value="">Any rating</option>
              <option value="8">8.0 and up</option>
              <option value="8.5">8.5 and up</option>
              <option value="9">9.0 and up</option>
            </select>
            <input
              className="year"
              type="number"
              placeholder="From year"
              value={minYear}
              onChange={(e) => setMinYear(e.target.value)}
              aria-label="From year"
            />
            <input
              className="year"
              type="number"
              placeholder="To year"
              value={maxYear}
              onChange={(e) => setMaxYear(e.target.value)}
              aria-label="To year"
            />
          </div>
          <div className="pills" role="group" aria-label="Genres">
            <button className={`pill ${genre === "" ? "on" : ""}`} onClick={() => setGenre("")}>
              All genres
            </button>
            {genres.map((g) => (
              <button
                key={g}
                className={`pill ${genre === g ? "on" : ""}`}
                onClick={() => setGenre(genre === g ? "" : g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="main">
        {view === "browse" && (
          <div className="results-bar">
            <p>
              {loading ? "Searching…" : `${total.toLocaleString()} ${total === 1 ? "film" : "films"}`}
              {summary && !activeFilters && !loading && (
                <span className="muted">
                  {" "}
                  from {summary.minYear} to {summary.maxYear}, average rating {summary.avgRating}
                </span>
              )}
            </p>
            {activeFilters > 0 && (
              <button className="link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {view === "watchlist" && (
          <div className="results-bar">
            <h2 className="section-title">Your watchlist</h2>
          </div>
        )}

        {view === "compare" && (
          <>
            <div className="results-bar">
              <h2 className="section-title">Compare two films</h2>
            </div>
            <Compare a={cmpA} b={cmpB} setA={setCmpA} setB={setCmpB} onOpen={setOpenId} />
          </>
        )}

        {view === "insights" && (
          <>
            <div className="results-bar">
              <h2 className="section-title">What the data says</h2>
            </div>
            <Insights onDirector={searchFor} onOpen={setOpenId} />
          </>
        )}

        {error && <div className="notice">{error}</div>}

        {(view === "browse" || view === "watchlist") && (
          <div className="grid">
            {loading && view === "browse"
              ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" />)
              : list.map((m) => (
                  <MovieCard
                    key={m.id}
                    m={m}
                    fav={isFav(m.id)}
                    onToggleFav={() => toggleFav(m.id)}
                    onOpen={setOpenId}
                  />
                ))}
          </div>
        )}

        {view === "browse" && !loading && !error && list.length === 0 && (
          <div className="empty">
            <h3>No films match these filters</h3>
            <p>Try a wider year range, a lower rating, or a different genre.</p>
            <button className="btn btn-main" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {view === "watchlist" && favs.length === 0 && (
          <div className="empty">
            <h3>Your watchlist is empty</h3>
            <p>Tap the heart on any poster to save a film here.</p>
            <button className="btn btn-main" onClick={() => setView("browse")}>
              Browse films
            </button>
          </div>
        )}

        {view === "browse" && !loading && movies.length < total && (
          <div className="more">
            <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : `Show more (${total - movies.length} left)`}
            </button>
          </div>
        )}
      </main>

      <footer className="footer">CinePhile · React, Express and MonetDB</footer>

      {openId && (
        <MovieModal
          id={openId}
          onClose={() => setOpenId(null)}
          onOpen={setOpenId}
          isFav={isFav}
          toggleFav={toggleFav}
          onSearch={searchFor}
          onCompare={addToCompare}
        />
      )}
    </div>
  );
}