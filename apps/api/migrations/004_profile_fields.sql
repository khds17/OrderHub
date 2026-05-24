-- Profile expansion: surname + address on users, plus a saved (fake) card
-- per user. The card row never holds full PAN/CVV — only the last 4 digits +
-- holder + expiry, even though every card in this app is mock. Storing more
-- would be needless risk if this codebase ever turned real.

ALTER TABLE users
  ADD COLUMN surname VARCHAR(255),
  ADD COLUMN address TEXT;

CREATE TABLE payment_methods (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: one saved card per user. Switch to a non-unique FK + a separate
  -- "default" flag if multi-card support is ever needed.
  user_id     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  holder_name VARCHAR(255) NOT NULL,
  last4       VARCHAR(4)   NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  -- MM/YY. The route-layer Zod schema also enforces "month is in the future";
  -- this CHECK is just shape so a broken client can't corrupt the row.
  expiry      VARCHAR(5)   NOT NULL CHECK (expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
