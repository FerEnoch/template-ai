import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCreateEntityHandler } from "./useCreateEntityHandler";
import type { Entity } from "@template-ai/contracts";

const mockEntity: Entity = {
  id: "manual-entity-1",
  label: "VENDEDOR",
  value: "María López",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 10, end: 21 },
  reviewed: false,
  excluded: false,
  userCreated: true,
};

describe("useCreateEntityHandler", () => {
  const addEntity = vi.fn();
  const onSuccess = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    addEntity.mockClear();
    onSuccess.mockClear();
    onError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds entity to wizard state from server response and calls onSuccess when API succeeds", async () => {
    const serverEntity = {
      ...mockEntity,
      id: "server-generated-uuid",
    };
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ entity: serverEntity }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() =>
      useCreateEntityHandler({
        analysisResultId: "analysis-123",
        addEntity,
        onSuccess,
        onError,
      })
    );

    await result.current(mockEntity);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/review/analysis-123/entities",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(mockEntity),
      })
    );
    // Must use the server's entity (different id), not the client's
    expect(addEntity).toHaveBeenCalledWith(serverEntity);
    expect(addEntity).not.toHaveBeenCalledWith(mockEntity);
    expect(onSuccess).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError when API returns 502 with a non-JSON body", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    const { result } = renderHook(() =>
      useCreateEntityHandler({
        analysisResultId: "analysis-123",
        addEntity,
        onSuccess,
        onError,
      })
    );

    await result.current(mockEntity);

    expect(addEntity).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Error del servidor (502)");
  });

  it("does NOT add entity and calls onError when API returns 403", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Manual entity limit reached" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() =>
      useCreateEntityHandler({
        analysisResultId: "analysis-123",
        addEntity,
        onSuccess,
        onError,
      })
    );

    await result.current(mockEntity);

    expect(addEntity).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("Manual entity limit reached");
  });

  it("calls onError when analysisResultId is null", async () => {
    const { result } = renderHook(() =>
      useCreateEntityHandler({
        analysisResultId: null,
        addEntity,
        onSuccess,
        onError,
      })
    );

    await result.current(mockEntity);

    expect(addEntity).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("No se encontró el documento en revisión");
  });
});
