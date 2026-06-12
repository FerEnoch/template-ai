import {
  Controller,
  Post,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  ParseFilePipe,
  MaxFileSizeValidator,
  Logger,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { createHash } from "node:crypto";
import type { Response } from "express";
import { CACHE_CONFIG } from "../config/ai.js";
import { DocumentsService } from "./documents.service";
import { SmartFileValidator } from "./smart-file.validator";

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
};

@Controller("documents")
export class DocumentsController {
  public constructor(private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  public async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new SmartFileValidator(),
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }),
        ],
      }),
    )
    file: Express.Multer.File | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    uploadedAt: string;
    cachedFromDocumentId?: string;
  }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    try {
      // Compute SHA-256 from raw buffer BEFORE any disk I/O
      const contentHash = createHash("sha256").update(file.buffer).digest("hex");

      const result = await this.documentsService.upload({
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileBuffer: file.buffer,
        contentHash,
      });

      // Set X-Cache header only when cache feature is enabled
      if (CACHE_CONFIG.enabled) {
        res.setHeader("X-Cache", result.cacheHit ? "HIT" : "MISS");
      }

      return {
        id: result.document.id,
        filename: result.document.filename,
        mimeType: result.document.mimeType,
        sizeBytes: result.document.sizeBytes,
        status: result.document.status,
        uploadedAt: result.document.uploadedAt.toISOString(),
        ...(result.cachedFromDocumentId && { cachedFromDocumentId: result.cachedFromDocumentId }),
      };
    } catch (error) {
      Logger.error("Upload failed", (error as Error).stack, DocumentsController.name);
      throw new InternalServerErrorException(
        `Internal server error during file upload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}