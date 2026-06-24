ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referrer_id INT NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_sync_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS total_gifts_count INT DEFAULT 0;

ALTER TABLE user_gifts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS backdrop_color VARCHAR NULL,
  ADD COLUMN IF NOT EXISTS serial_number INT NULL;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  status VARCHAR NOT NULL,
  fetched INT NOT NULL DEFAULT 0,
  accepted INT NOT NULL DEFAULT 0,
  rejected INT NOT NULL DEFAULT 0,
  page INT NOT NULL DEFAULT 0,
  error TEXT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  mode VARCHAR NOT NULL,
  creator_type VARCHAR NOT NULL DEFAULT 'system',
  creator_id INT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  description TEXT NULL,
  status VARCHAR NOT NULL DEFAULT 'draft',
  reward_points INT NOT NULL DEFAULT 0,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  id SERIAL PRIMARY KEY,
  challenge_id INT NOT NULL REFERENCES challenges(id),
  user_id INT NOT NULL REFERENCES users(id),
  progress INT NOT NULL DEFAULT 0,
  target INT NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'active',
  claimed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_proposals (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT NULL,
  creator_id INT NULL REFERENCES users(id),
  status VARCHAR NOT NULL DEFAULT 'open',
  votes_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  provider VARCHAR NOT NULL,
  purpose VARCHAR NOT NULL,
  amount NUMERIC(20, 9) NOT NULL,
  currency VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  external_tx_id TEXT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_votes (
  id SERIAL PRIMARY KEY,
  proposal_id INT NOT NULL REFERENCES challenge_proposals(id),
  user_id INT NOT NULL REFERENCES users(id),
  payment_id INT NOT NULL REFERENCES payments(id),
  vote_weight INT NOT NULL,
  gift_count INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (proposal_id, user_id),
  UNIQUE (payment_id)
);

CREATE TABLE IF NOT EXISTS score_ledger (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  source VARCHAR NOT NULL,
  source_id TEXT NULL,
  points INT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (source, source_id, user_id)
);

CREATE TABLE IF NOT EXISTS referral_events (
  id SERIAL PRIMARY KEY,
  referrer_id INT NOT NULL REFERENCES users(id),
  referred_id INT NOT NULL REFERENCES users(id),
  status VARCHAR NOT NULL,
  reason TEXT NULL,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (referred_id)
);

CREATE TABLE IF NOT EXISTS santa_pool_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  user_gift_id INT NOT NULL REFERENCES user_gifts(id),
  payment_id INT NULL REFERENCES payments(id),
  status VARCHAR NOT NULL DEFAULT 'pending',
  floor_price NUMERIC(20, 9) NULL,
  custody_tx_id TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS santa_pool_draws (
  id SERIAL PRIMARY KEY,
  seed TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'draft',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS cpa_tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT NULL,
  reward_points INT NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'active',
  verification_type VARCHAR NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpa_completions (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL REFERENCES cpa_tasks(id),
  user_id INT NOT NULL REFERENCES users(id),
  status VARCHAR NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS users_referrer_idx ON users (referrer_id);
CREATE INDEX IF NOT EXISTS user_gifts_user_round_gift_idx ON user_gifts (user_id, round_id, gift_id);
CREATE INDEX IF NOT EXISTS sync_jobs_user_updated_idx ON sync_jobs (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS challenges_mode_status_idx ON challenges (mode, status);
CREATE INDEX IF NOT EXISTS challenge_proposals_status_idx ON challenge_proposals (status);
CREATE INDEX IF NOT EXISTS payments_user_status_idx ON payments (user_id, status);
CREATE INDEX IF NOT EXISTS score_ledger_user_idx ON score_ledger (user_id, created_at DESC);
