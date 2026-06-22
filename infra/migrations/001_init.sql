CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT UNIQUE NOT NULL,
  username VARCHAR NULL,
  first_name VARCHAR NULL,
  wallet_address VARCHAR NULL,
  wallet_verified_at TIMESTAMP NULL,
  is_qualified BOOLEAN DEFAULT false,
  score INT DEFAULT 0,
  social_likes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rounds (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT false,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS target_gifts (
  id SERIAL PRIMARY KEY,
  gift_id TEXT NOT NULL UNIQUE,
  base_name VARCHAR NULL,
  weight INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_gifts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  round_id INT REFERENCES rounds(id),
  gift_id TEXT NOT NULL,
  base_name VARCHAR NULL,
  unique_name VARCHAR NULL,
  unique_number INT NOT NULL,
  model_name VARCHAR NULL,
  symbol_name VARCHAR NULL,
  backdrop_name VARCHAR NULL,
  is_burned BOOLEAN DEFAULT false,
  is_from_blockchain BOOLEAN DEFAULT false,
  score_weight INT NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (gift_id, unique_number, round_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  round_id INT REFERENCES rounds(id),
  voter_id INT REFERENCES users(id),
  candidate_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (voter_id, candidate_id, round_id)
);

CREATE TABLE IF NOT EXISTS social_likes (
  id SERIAL PRIMARY KEY,
  round_id INT REFERENCES rounds(id),
  voter_id INT REFERENCES users(id),
  candidate_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (voter_id, candidate_id, round_id)
);

CREATE TABLE IF NOT EXISTS wallet_proofs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  payload TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  actor_user_id INT REFERENCES users(id),
  action VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO rounds (title, is_active, starts_at)
SELECT 'Bands 2 launch round', true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM rounds WHERE is_active = true);

CREATE INDEX IF NOT EXISTS user_gifts_user_round_idx ON user_gifts (user_id, round_id);
CREATE INDEX IF NOT EXISTS votes_round_candidate_idx ON votes (round_id, candidate_id);
CREATE INDEX IF NOT EXISTS social_likes_round_candidate_idx ON social_likes (round_id, candidate_id);
