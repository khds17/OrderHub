-- pgcrypto provides gen_random_uuid() (UUID v4) and the crypt()/gen_salt()
-- helpers used by the seed to generate bcrypt-compatible password hashes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role      AS ENUM ('ADMIN', 'CLIENT', 'SUPPORT');
CREATE TYPE order_status   AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'SHIPPED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED');
