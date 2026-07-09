import { describe, expect, it } from "vitest";
import { ApiError, parseErrorResponse } from "../cases";

describe("parseErrorResponse", () => {
  it("returns a Spanish fallback for a 500 plain-text body", async () => {
    const response = new Response("Internal Server Error", { status: 500 });
    const result = await parseErrorResponse(response);

    expect(result.message).toBe(
      "Ocurrió un error inesperado. Intentá nuevamente.",
    );
    expect(result.errorType).toBeUndefined();
  });

  it("returns the JSON errorType and a fallback message for a 502 JSON body", async () => {
    const response = new Response(JSON.stringify({ errorType: "NETWORK_ERROR" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseErrorResponse(response);

    expect(result.message).toBe(
      "Ocurrió un error inesperado. Intentá nuevamente.",
    );
    expect(result.errorType).toBe("NETWORK_ERROR");
  });

  it("returns raw text for a 400 plain-text body", async () => {
    const response = new Response("Bad input", { status: 400 });
    const result = await parseErrorResponse(response);

    expect(result.message).toBe("Bad input");
    expect(result.errorType).toBeUndefined();
  });
});

describe("ApiError", () => {
  it("carries an optional errorType", () => {
    const error = new ApiError("Something failed", 502, "NETWORK_ERROR");
    expect(error.errorType).toBe("NETWORK_ERROR");
  });
});
