import { describe, it, expect } from "vitest";
import type { Template } from "@template-ai/contracts";
import { HttpResponse } from "msw";
import { handlers } from "./handlers.js";

// ---------------------------------------------------------------------------
// Test helpers — invoke MSW handler resolvers directly without network
// ---------------------------------------------------------------------------

/**
 * Create a mock Request object for testing MSW handler resolvers.
 */
function makeRequest(
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Request {
  const { headers: headerObj, ...rest } = options;
  return new Request(url, {
    ...rest,
    headers: headerObj ? new Headers(headerObj) : undefined,
  });
}

/**
 * Find and invoke an MSW handler by method + URL pattern, returning the
 * raw Response. This tests handler logic without requiring `setupServer`.
 */
async function invokeHandler(
  method: string,
  url: string,
  options?: { headers?: Record<string, string>; body?: unknown }
): Promise<Response> {
  const headerInit: Record<string, string> = { ...options?.headers };
  let body: string | undefined;
  if (options?.body) {
    body = JSON.stringify(options.body);
    headerInit["Content-Type"] = "application/json";
  }

  const request = makeRequest(url, {
    method,
    headers: headerInit,
    body,
  });

  // Find matching handler
  for (const handler of handlers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = (handler as any).info;
    if (!info) continue;
    if (info.method && info.method.toUpperCase() !== method.toUpperCase()) continue;

    const pattern: string = info.path;
    if (!pattern) continue;

    // Convert MSW URL pattern /api/analysis/:id → regex
    const urlObj = new URL(url);
    const paramNames: string[] = [];
    const paramRegexStr = pattern.replace(/:([^/]+)/g, (_: string, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const paramRegex = new RegExp(`^${paramRegexStr}/??$`);
    const paramMatch = urlObj.pathname.match(paramRegex);
    if (!paramMatch) continue;

    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = paramMatch[i + 1];
    });

    // Invoke the handler resolver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolverResult = await (handler as any).resolver({
      request,
      params,
      cookies: {},
    });

    if (
      resolverResult instanceof HttpResponse ||
      resolverResult instanceof Response
    ) {
      return resolverResult;
    }

    // passthrough or null = no match from this handler
    continue;
  }

  throw new Error(`No handler matched ${method} ${url}`);
}

describe("MSW Handlers (unit)", () => {
  describe("GET /api/templates", () => {
    it("returns an array of templates with correct shape", async () => {
      const response = await invokeHandler("GET", "http://localhost/api/templates");
      expect(response.status).toBe(200);

      const templates: Template[] = await response.json();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(3);

      const t = templates[0];
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("documentId");
      expect(t).toHaveProperty("entities");
      expect(t).toHaveProperty("category");
      expect(t).toHaveProperty("createdAt");
      expect(t).toHaveProperty("status");
    });
  });

  describe("Error: POST /api/documents/upload with x-mock-error: upload-500", () => {
    it("returns 500", async () => {
      const response = await invokeHandler(
        "POST",
        "http://localhost/api/documents/upload",
        { headers: { "x-mock-error": "upload-500" } }
      );
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toHaveProperty("error");
    });
  });

  describe("Error: GET /api/analysis/:id with x-mock-error: analysis-failed", () => {
    it("returns status: failed", async () => {
      const response = await invokeHandler(
        "GET",
        "http://localhost/api/analysis/test-doc-id",
        { headers: { "x-mock-error": "analysis-failed" } }
      );
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe("failed");
    });
  });

  describe("Error: POST /api/templates with x-mock-error: save-409", () => {
    it("returns 409 conflict", async () => {
      const response = await invokeHandler(
        "POST",
        "http://localhost/api/templates",
        {
          headers: { "x-mock-error": "save-409" },
          body: {
            name: "Test Template",
            description: "Test",
            documentId: "550e8400-e29b-41d4-a716-446655440000",
            entities: [],
            category: "Test",
            status: "draft",
          },
        }
      );
      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body).toHaveProperty("error");
    });
  });

  describe("POST /api/review/:documentId/entities/:entityId", () => {
    it("accepts excluded field and updates the entity", async () => {
      const entityId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const documentId = "550e8400-e29b-41d4-a716-446655440000";

      const response = await invokeHandler(
        "POST",
        `http://localhost/api/review/${documentId}/entities/${entityId}`,
        {
          body: {
            value: "Updated Name",
            excluded: true,
            reviewed: true,
          },
        }
      );
      expect(response.status).toBe(200);

      const entity = await response.json();
      expect(entity.excluded).toBe(true);
      expect(entity.reviewed).toBe(true);
      expect(entity.value).toBe("Updated Name");
      expect(entity.id).toBe(entityId);
    });

    it("returns 404 for a non-existent entity", async () => {
      const response = await invokeHandler(
        "POST",
        "http://localhost/api/review/test-doc/entities/non-existent-id",
        { body: { reviewed: true } }
      );
      expect(response.status).toBe(404);
    });
  });
});