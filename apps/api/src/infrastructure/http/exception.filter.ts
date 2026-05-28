import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const error = this.extractMessage(exceptionResponse);
      response.status(status).json({ error });
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error",
      });
    }
  }

  /**
   * Extracts a human-readable error message from an HttpException response.
   *
   * NestJS exception responses can be:
   * - A plain string: "Not Found" → "Not Found"
   * - An object with `message`: { statusCode: 400, message: "Validation failed" } → "Validation failed"
   * - An object with `message` as array: { statusCode: 400, message: ["a", "b"] } → "a, b"
   * - An object without `message`: { statusCode: 503, status: "not_ready" } → "not_ready"
   *
   * For objects without `message`, we try the `error` field first, then fall back
   * to stringifying any remaining non-statusCode fields.
   */
  private extractMessage(response: string | object): string {
    if (typeof response === "string") {
      return response;
    }

    if (typeof response === "object" && response !== null) {
      const obj = response as Record<string, unknown>;

      // Standard NestJS: { statusCode, message } or { statusCode, error, message }
      if ("message" in obj) {
        const message = obj.message;
        if (Array.isArray(message)) {
          return message.join(", ");
        }
        if (typeof message === "string") {
          return message;
        }
      }

      // Some exceptions use { statusCode, error } without message
      if ("error" in obj && typeof obj.error === "string") {
        return obj.error;
      }

      // Custom exception bodies like { status: "not_ready" } — extract the
      // first non-statusCode string field as the error message
      const meaningfulKeys = Object.keys(obj).filter((k) => k !== "statusCode");
      for (const key of meaningfulKeys) {
        if (typeof obj[key] === "string") {
          return obj[key] as string;
        }
      }
    }

    return "Internal server error";
  }
}