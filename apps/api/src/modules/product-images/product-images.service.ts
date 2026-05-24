import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProductImage } from '@orderhub/contracts';
import {
  AppError,
  NotFoundError,
} from '../../utils/errors.js';
import type {
  ProductImageRow,
  ProductImagesRepository,
} from './product-images.repository.js';

/** Public URL prefix the static handler is mounted at (see app.ts). */
export const UPLOADS_URL_PREFIX = '/uploads';

/** Image MIME types the upload endpoint accepts. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Max upload size in bytes (5 MB). Mirrors the multipart plugin's limit. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Disk-backed image storage. Injectable so tests can swap in fakes for
 * mkdir/writeFile/unlink without touching the real filesystem.
 */
export type Disk = {
  mkdir: (dir: string, options: { recursive: true }) => Promise<unknown>;
  writeFile: (filePath: string, data: Buffer) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
};

export const realDisk: Disk = {
  mkdir: (dir, options) => mkdir(dir, options),
  writeFile: (filePath, data) => writeFile(filePath, data),
  unlink: (filePath) => unlink(filePath),
};

export class ProductImagesService {
  constructor(
    private readonly repo: ProductImagesRepository,
    /** Absolute path to the uploads root (e.g. `<project>/apps/api/uploads`). */
    private readonly uploadsRoot: string,
    private readonly disk: Disk = realDisk,
  ) {}

  /**
   * Persist an uploaded image: validates shape, writes the file to
   * `<uploadsRoot>/products/<productId>/<uuid>.<ext>`, then inserts the row.
   *
   * If the DB insert fails after the file is on disk, we attempt to delete
   * the orphan — best-effort, swallowed if it fails so the original error
   * still surfaces.
   */
  async upload(input: {
    productId: string;
    mimeType: string;
    bytes: Buffer;
    sortOrder?: number;
  }): Promise<ProductImage> {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new AppError(
        415,
        'UNSUPPORTED_IMAGE_TYPE',
        `Unsupported image type "${input.mimeType}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}.`,
      );
    }
    if (input.bytes.length > MAX_UPLOAD_BYTES) {
      throw new AppError(
        413,
        'IMAGE_TOO_LARGE',
        `Image exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
      );
    }
    if (input.bytes.length === 0) {
      throw new AppError(400, 'EMPTY_UPLOAD', 'Uploaded file is empty.');
    }

    const ext = MIME_TO_EXT[input.mimeType] ?? 'bin';
    const filename = `${randomUUID()}.${ext}`;
    // Relative slug stored in DB and used in the public URL.
    const relativePath = path.posix.join('products', input.productId, filename);
    const absoluteDir = path.join(this.uploadsRoot, 'products', input.productId);
    const absolutePath = path.join(absoluteDir, filename);

    await this.disk.mkdir(absoluteDir, { recursive: true });
    await this.disk.writeFile(absolutePath, input.bytes);

    try {
      const row = await this.repo.insert({
        productId: input.productId,
        filePath: relativePath,
        sortOrder: input.sortOrder,
      });
      return toPublic(row);
    } catch (err) {
      // Best-effort cleanup of the orphan file so we don't leak disk on
      // repeated failures. Swallow the unlink error — the caller cares
      // about the original DB error.
      try {
        await this.disk.unlink(absolutePath);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  /**
   * Remove an image: deletes the DB row (returning what was deleted so we
   * know the file path), then unlinks the file. The file-unlink is
   * best-effort — a missing-on-disk file shouldn't fail the API call.
   */
  async delete(imageId: string): Promise<void> {
    const deleted = await this.repo.deleteById(imageId);
    if (!deleted) {
      throw new NotFoundError(
        'IMAGE_NOT_FOUND',
        'Image not found',
      );
    }
    const absolutePath = path.join(this.uploadsRoot, deleted.file_path);
    try {
      await this.disk.unlink(absolutePath);
    } catch {
      // Already gone, or we never wrote it. Don't surface — the DB is now
      // the source of truth and it agrees the image is gone.
    }
  }

  /** Batch-fetch images for many products keyed by productId. */
  async listForProducts(
    productIds: string[],
  ): Promise<Map<string, ProductImage[]>> {
    const byProduct = new Map<string, ProductImage[]>();
    // Skip the repo round-trip entirely for empty input — keeps the catalog
    // list cheap when no products are on the page.
    if (productIds.length === 0) return byProduct;
    const rows = await this.repo.findByProductIds(productIds);
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(toPublic(row));
      byProduct.set(row.product_id, list);
    }
    return byProduct;
  }
}

function toPublic(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    url: `${UPLOADS_URL_PREFIX}/${row.file_path}`,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
  };
}
