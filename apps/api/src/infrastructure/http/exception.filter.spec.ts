import { describe, expect, it, vi, beforeEach } from "vitest";
import { HttpException, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { HttpExceptionFilter } from "./exception.filter";

describe("HttpExceptionFilter", () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  function createMockHost() {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const mockResponse = { status };
    const mockRequest = {};

    return {
      json,
      status,
      mockResponse,
      mockRequest,
      host: {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as unknown as import("@nestjs/common").ArgumentsHost,
    };
  }

  it("should transform HttpException with string message to { error: message }", () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException("Analysis result not found", 404);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: "Analysis result not found" });
  });

  it("should transform 403 HttpException to { error: message }", () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException("Forbidden resource", 403);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "Forbidden resource" });
  });

  it("should handle HttpException with object response by extracting message field", () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException({ message: "Validation failed" }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "Validation failed" });
  });

  it("should handle HttpException with array message by joining", () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      { message: ["email must be valid", "name is required"] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "email must be valid, name is required" });
  });

  it("should return 500 with user-safe message for non-HttpException errors", () => {
    const { host, status, json } = createMockHost();
    const exception = new Error("Something broke");

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: "Unexpected error occurred. Please try again.",
    });
  });

  it("should map ECONNREFUSED to 503 Service Unavailable", () => {
    const { host, status, json } = createMockHost();
    const exception = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: "Service temporarily unavailable. Please try again.",
    });
  });

  it("should map AbortError to 504 Gateway Timeout", () => {
    const { host, status, json } = createMockHost();
    const exception = new Error("The operation was aborted");
    exception.name = "AbortError";

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith({
      error: "Request timed out. Please try again.",
    });
  });

  it("should handle ServiceUnavailableException with custom object body (health check pattern)", () => {
    const { host, status, json } = createMockHost();
    // Health controller uses: throw new ServiceUnavailableException({ status: "not_ready" })
    const exception = new ServiceUnavailableException({ status: "not_ready" });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ error: "not_ready" });
  });

  it("should handle HttpException with error field when message is absent", () => {
    const { host, status, json } = createMockHost();
    // Some NestJS exceptions produce { statusCode, error } without a message field
    const exception = new HttpException({ statusCode: 401, error: "Unauthorized" }, 401);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });
});