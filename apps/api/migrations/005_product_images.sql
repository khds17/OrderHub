-- One row per uploaded image. The bytes themselves live on the API host's
-- filesystem under `apps/api/uploads/`; `file_path` is the relative slug
-- the static handler maps to that directory. Storing only the path keeps
-- the DB lean and lets us swap to S3 later by changing the upload service
-- without a schema change.

CREATE TABLE product_images (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_path   TEXT         NOT NULL,
  -- Manual ordering for the admin; ties broken by created_at for stability.
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- The most common query is "give me this product's images in display order".
CREATE INDEX idx_product_images_product_sort
  ON product_images (product_id, sort_order, created_at);
