CREATE TABLE summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_url TEXT NOT NULL,
  video_title TEXT NOT NULL,
  thumbnail_url TEXT,
  summary TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE(youtube_url)
);