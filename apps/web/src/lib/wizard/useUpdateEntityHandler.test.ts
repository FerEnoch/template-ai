import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUpdateEntityHandler } from "./useUpdateEntityHandler";
import type { Entity } from "@template-ai/contracts";

const mockEntity: Entity = {
  id: "entity-1",
  label: "VENDEDOR",
  value: "María López",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 10, end: 21 },
  reviewed: false,
  excluded: false,
  userCreated: false,
};

const updatedEntity: Entity = {
  ...mockEntity,
  reviewed: true,
  value: "María López Updated",
};

describe("useUpdateEntityHandler", () => {
  const updateEntity = vi.fn();
  const onError = vi.fn();
  const getEntityById = vi.fn();

  beforeEach(() => {
    updateEntity.mockClear();
    onError.mockClear();
    getEntityById.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("optimistically updates entity and keeps change when API succeeds", async () => {
    getEntityById.mockReturnValue(mockEntity);
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() =>
      useUpdateEntityHandler({
        analysisResultId: "analysis-123",
        getEntityById,
        updateEntity,
        onError,
      })
    );

    await result.current(updatedEntity);

    expect(getEntityById).toHaveBeenCalledWith("entity-1");
    expect(updateEntity).toHaveBeenNthCalledWith(1, updatedEntity);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/review/analysis-123/entities/entity-1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reviewed: true,
          value: "María López Updated",
          excluded: false,
        }),
      })
    );
    // No rollback
    expect(updateEntity).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rolls back and calls onError when API returns 500", async () => {
    getEntityById.mockReturnValue(mockEntity);
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "DB unavailable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() =>
      useUpdateEntityHandler({
        analysisResultId: "analysis-123",
        getEntityById,
        updateEntity,
        onError,
      })
    );

    await result.current(updatedEntity);

    expect(updateEntity).toHaveBeenNthCalledWith(1, updatedEntity);
    expect(updateEntity).toHaveBeenNthCalledWith(2, mockEntity);
    expect(onError).toHaveBeenCalledWith("DB unavailable");
  });

  it("rolls back and calls onError when API returns non-JSON error", async () => {
    getEntityById.mockReturnValue(mockEntity);
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );

    const { result } = renderHook(() =>
      useUpdateEntityHandler({
        analysisResultId: "analysis-123",
        getEntityById,
        updateEntity,
        onError,
      })
    );

    await result.current(updatedEntity);

    expect(updateEntity).toHaveBeenNthCalledWith(1, updatedEntity);
    expect(updateEntity).toHaveBeenNthCalledWith(2, mockEntity);
    expect(onError).toHaveBeenCalledWith("Error del servidor (502)");
  });

  it("calls onError when analysisResultId is null", async () => {
    getEntityById.mockReturnValue(mockEntity);

    const { result } = renderHook(() =>
      useUpdateEntityHandler({
        analysisResultId: null,
        getEntityById,
        updateEntity,
        onError,
      })
    );

    await result.current(updatedEntity);

    expect(updateEntity).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("No se encontró el documento en revisión");
  });
});
