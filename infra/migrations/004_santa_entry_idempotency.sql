CREATE UNIQUE INDEX IF NOT EXISTS santa_pool_entries_payment_unique_idx
  ON santa_pool_entries (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS santa_pool_entries_gift_unique_idx
  ON santa_pool_entries (user_gift_id);
