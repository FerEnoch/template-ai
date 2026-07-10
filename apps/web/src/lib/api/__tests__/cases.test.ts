import { describe, expect, it } from "vitest";
import {
  ApiError,
  fallbackMessageForStatus,
  parseErrorResponse,
} from "../cases";

describe("fallbackMessageForStatus", () => {
  it("returns a latency-aware Spanish message for 502", () => {
    expect(fallbackMessageForStatus(502)).toBe(
      "El servidor está procesando tu solicitud. Esto puede tardar hasta 2 minutos. Esperá un momento e intentá nuevamente.",
    );
  });

  it("returns an internal-error Spanish message for 500", () => {
    expect(fallbackMessageForStatus(500)).toBe(
      "Hubo un problema interno en el servidor. Si el problema persiste, contactá a soporte.",
    );
  });
});

describe("parseErrorResponse", () => {
  it("returns the 500 Spanish fallback for a 500 plain-text body", async () => {
    const response = new Response("Internal Server Error", { status: 500 });
    const result = await parseErrorResponse(response);

    expect(result.message).toBe(
      "Hubo un problema interno en el servidor. Si el problema persiste, contactá a soporte.",
    );
    expect(result.errorType).toBeUndefined();
  });

  it("returns the 502 Spanish fallback and the JSON errorType for a 502 JSON body", async () => {
    const response = new Response(
      JSON.stringify({ errorType: "NETWORK_ERROR" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
    const result = await parseErrorResponse(response);

    expect(result.message).toBe(
      "El servidor está procesando tu solicitud. Esto puede tardar hasta 2 minutos. Esperá un momento e intentá nuevamente.",
    );
    expect(result.errorType).toBe("NETWORK_ERROR");
  });

  it("falls back to the latency-aware 502 message for an HTML body", async () => {
    const response = new Response("<html>502 Bad Gateway</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });
    const result = await parseErrorResponse(response);

    expect(result.message).toBe(
      "El servidor está procesando tu solicitud. Esto puede tardar hasta 2 minutos. Esperá un momento e intentá nuevamente.",
    );
    expect(result.errorType).toBeUndefined();
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
