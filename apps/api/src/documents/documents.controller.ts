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
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { UPLOAD_DIR } from "../config/ai.js";
import { DocumentsService } from "./documents.service";
import { SmartFileValidator } from "./smart-file.validator";

const multerOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
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
  ): Promise<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    uploadedAt: string;
  }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    try {
      const document = await this.documentsService.upload({
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        filePath: file.path,
      });

      return {
        id: document.id,
        filename: document.filename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        uploadedAt: document.uploadedAt.toISOString(),
      };
    } catch (error) {
      Logger.error("Upload failed", (error as Error).stack, DocumentsController.name);
      throw new InternalServerErrorException(
        `Internal server error during file upload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}