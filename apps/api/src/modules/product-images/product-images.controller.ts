import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../utils/errors.js';
import {
  MAX_UPLOAD_BYTES,
  type ProductImagesService,
} from './product-images.service.js';

export class ProductImagesController {
  constructor(private readonly service: ProductImagesService) {}

  upload = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    // @fastify/multipart is registered in app.ts; req.file() pulls a single
    // file from a multipart/form-data body. The "file" field name is
    // implicit — any first file in the body works.
    const part = await req.file();
    if (!part) {
      throw new AppError(
        400,
        'NO_FILE',
        'Expected a multipart form-data body with a file part',
      );
    }
    const bytes = await part.toBuffer();
    // The plugin's `limits.fileSize` also enforces this, but the service
    // re-checks so the contract holds when called directly (e.g. tests).
    if (bytes.length > MAX_UPLOAD_BYTES) {
      throw new AppError(
        413,
        'IMAGE_TOO_LARGE',
        `Image exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
      );
    }
    const image = await this.service.upload({
      productId: req.params.id,
      mimeType: part.mimetype,
      bytes,
    });
    return reply.status(201).send({ status: 'success', data: { image } });
  };

  delete = async (
    req: FastifyRequest<{ Params: { id: string; imageId: string } }>,
    reply: FastifyReply,
  ) => {
    await this.service.delete(req.params.imageId);
    return reply.status(204).send();
  };
}
