CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('taptaptap','flappy','hextris','ohhi')),
  board INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  submitted_name TEXT,
  submitted_score INTEGER,
  improved INTEGER,
  CHECK ((game = 'ohhi' AND board IN (4,6,8,10)) OR (game <> 'ohhi' AND board = 0))
);
CREATE INDEX IF NOT EXISTS runs_player_time ON runs(player, started_at);
CREATE INDEX IF NOT EXISTS runs_player_submitted ON runs(player, submitted_at);
CREATE INDEX IF NOT EXISTS runs_expiry ON runs(started_at);
CREATE TABLE IF NOT EXISTS scores (
  player TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('taptaptap','flappy','hextris','ohhi')),
  board INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 20),
  score INTEGER NOT NULL CHECK (score >= 0),
  sort_score INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  PRIMARY KEY (player, game, board),
  CHECK ((game = 'ohhi' AND board IN (4,6,8,10)) OR (game <> 'ohhi' AND board = 0)),
  CHECK (sort_score = CASE WHEN game = 'ohhi' THEN score ELSE -score END)
);
CREATE INDEX IF NOT EXISTS scores_ranking ON scores(game, board, hidden, sort_score, achieved_at, player);
