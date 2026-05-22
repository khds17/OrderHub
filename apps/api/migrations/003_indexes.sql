-- UNIQUE constraints on users.email and products.slug already create implicit
-- B-tree indexes, so we skip the redundant idx_users_email / idx_products_slug
-- from the plan and only add indexes that don't already exist.
CREATE INDEX idx_orders_user_id          ON orders(user_id);
CREATE INDEX idx_orders_status           ON orders(status);
CREATE INDEX idx_order_items_order_id    ON order_items(order_id);
CREATE INDEX idx_refresh_tokens_user_id  ON refresh_tokens(user_id);
