-- Dev seed. NOT for any non-local environment.
-- Default password for all seeded users: "password123"
-- pgcrypto's crypt(..., gen_salt('bf', 10)) produces a $2a$ bcrypt hash
-- accepted by the node `bcrypt` library at login time.
--
-- Idempotent: TRUNCATE ... RESTART IDENTITY CASCADE before re-inserting so
-- this file can be re-run without primary-key collisions.

BEGIN;

TRUNCATE TABLE order_items, orders, refresh_tokens, products, categories, users
  RESTART IDENTITY CASCADE;

INSERT INTO users (email, password_hash, name, role) VALUES
  ('admin@orderhub.dev', crypt('password123', gen_salt('bf', 10)), 'Admin',   'ADMIN'),
  ('alice@orderhub.dev', crypt('password123', gen_salt('bf', 10)), 'Alice',   'CLIENT'),
  ('bob@orderhub.dev',   crypt('password123', gen_salt('bf', 10)), 'Bob',     'CLIENT');

INSERT INTO categories (name, slug) VALUES
  ('Electronics', 'electronics'),
  ('Books',       'books');

INSERT INTO products (category_id, name, slug, description, price, stock)
SELECT c.id, p.name, p.slug, p.description, p.price, p.stock
FROM (VALUES
  ('Laptop Pro',                              'laptop-pro',                              'A solid developer laptop.',   1499.00,  5,  'electronics'),
  ('Wireless Mouse',                          'wireless-mouse',                          'Ergonomic wireless mouse.',     39.90, 50,  'electronics'),
  ('Mechanical Keyboard',                     'mechanical-keyboard',                     'Tactile keyboard.',            129.00, 20,  'electronics'),
  ('Monitor 27"',                             'monitor-27',                              '4K IPS monitor.',              399.00, 10,  'electronics'),
  ('USB-C Hub',                               'usb-c-hub',                               '7-in-1 USB-C hub.',             49.00, 30,  'electronics'),
  ('Clean Code',                              'clean-code',                              'Robert C. Martin.',             35.00, 25,  'books'),
  ('The Pragmatic Programmer',                'the-pragmatic-programmer',                'Hunt & Thomas.',                38.00, 25,  'books'),
  ('Designing Data-Intensive Applications',   'designing-data-intensive-applications',   'Kleppmann.',                    55.00, 15,  'books'),
  ('Refactoring',                             'refactoring',                             'Martin Fowler.',                45.00, 15,  'books'),
  ('Domain-Driven Design',                    'domain-driven-design',                    'Eric Evans.',                   50.00, 12,  'books')
) AS p(name, slug, description, price, stock, cat_slug)
JOIN categories c ON c.slug = p.cat_slug;

COMMIT;
