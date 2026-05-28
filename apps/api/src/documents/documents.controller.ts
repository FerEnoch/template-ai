import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentsService } from "./documents.service";

@Controller("documents")
export class DocumentsController {
  public constructor(private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  public async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
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