import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const error = this.extractMessage(exceptionResponse);

      // Log 5xx server errors with full stack; log 4xx client errors at warn level
      if (status >= 500) {
        this.logger.error(
          `HTTP ${status} ${request.method} ${request.url} — ${error}`,
          (exception as Error).stack,
        );
      } else {
        this.logger.warn(
          `HTTP ${status} ${request.method} ${request.url} — ${error}`,
        );
      }

      response.status(status).json({ error });
      return;
    }

    // Non-HttpException — classify into an appropriate status + user-safe message.
    // Internal details (stack, error codes) are logged but never sent to the client.
    const { status, message } = this.classifyError(exception);

    this.logger.error(
      `HTTP ${status} ${request.method} ${request.url} — ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({ error: message });
  }

  /**
   * Map a non-HttpException to an HTTP status and a user-safe message.
   *
   * Known infrastructure failures (DB down, request aborted) get specific
   * status codes so the frontend can react appropriately. Everything else
   * falls back to 500 with a generic message — the real detail is in the
   * server logs, not the response body.
   */
  private classifyError(exception: unknown): {
    status: HttpStatus;
    message: string;
  } {
    const err = exception as { code?: string; message?: string; name?: string };

    // Database / Redis connection failures → 503
    if (
      err?.code === "ECONNREFUSED" ||
      err?.code === "ETIMEDOUT" ||
      err?.code === "ENOTFOUND" ||
      err?.code === "57P01" || // PG: admin_shutdown
      err?.code === "57P02" || // PG: crash_shutdown
      err?.code === "08006"    // PG: connection_failure
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: "Service temporarily unavailable. Please try again.",
      };
    }

    // Request aborted / timed out → 504
    if (
      err?.code === "ECONNRESET" ||
      err?.code === "ABORT_ERR" ||
      err?.name === "AbortError"
    ) {
      return {
        status: HttpStatus.GATEWAY_TIMEOUT,
        message: "Request timed out. Please try again.",
      };
    }

    // Truly unexpected error → 500
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Unexpected error occurred. Please try again.",
    };
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