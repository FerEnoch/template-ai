import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  AnalysisProgress,
  MESSAGES,
  REASSURANCE_THRESHOLD_S,
  REASSURANCE_TEXT,
} from "./AnalysisProgress";

afterEach(() => {
  cleanup();
});

describe("AnalysisProgress", () => {
  // ── processing ──

  describe("processing status", () => {
    it("renders determinate progress bar with percentage", () => {
      render(
        <AnalysisProgress status="processing" progress={75} fileName="test.pdf" />,
      );
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "75");
      expect(screen.getByText("75%")).toBeDefined();
    });

    it("does not show rotating messages or timer", () => {
      render(
        <AnalysisProgress status="processing" progress={50} fileName="test.pdf" />,
      );
      expect(screen.queryByTestId("status-message")).toBeNull();
      expect(screen.queryByTestId("elapsed-timer")).toBeNull();
    });
  });

  // ── analyzing ──

  describe("analyzing status", () => {
    it("renders indeterminate scan-line bar, not numeric percentage", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={5}
        />,
      );
      const bar = screen.getByRole("progressbar");
      // Indeterminate: no numeric value
      expect(bar).not.toHaveAttribute("aria-valuenow");
      expect(bar).toHaveAttribute("aria-valuetext", "Procesando");
      // Should NOT show percentage number
      expect(screen.queryByText("100%")).toBeNull();
    });

    it("shows first message on mount", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={1}
          currentMessageIndex={0}
        />,
      );
      expect(screen.getByTestId("status-message")).toHaveTextContent(MESSAGES[0]);
    });

    it("cycles messages when index changes", () => {
      const { rerender } = render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={5}
          currentMessageIndex={2}
        />,
      );
      expect(screen.getByTestId("status-message")).toHaveTextContent(MESSAGES[2]);

      rerender(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={11}
          currentMessageIndex={4}
        />,
      );
      expect(screen.getByTestId("status-message")).toHaveTextContent(MESSAGES[4]);
    });

    it("displays elapsed timer in MM:SS format", () => {
      const { rerender } = render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={5}
        />,
      );
      expect(screen.getByTestId("elapsed-timer")).toHaveTextContent("00:05");

      rerender(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={65}
        />,
      );
      expect(screen.getByTestId("elapsed-timer")).toHaveTextContent("01:05");

      rerender(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={3725}
        />,
      );
      expect(screen.getByTestId("elapsed-timer")).toHaveTextContent("62:05");
    });

    it("shows reassurance text when elapsed >= 30", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={30}
        />,
      );
      const el = screen.getByTestId("reassurance-message");
      expect(el).toHaveTextContent(REASSURANCE_TEXT);
    });

    it("does not show reassurance text when elapsed < 30", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={REASSURANCE_THRESHOLD_S - 1}
        />,
      );
      expect(screen.queryByTestId("reassurance-message")).toBeNull();
    });
  });

  // ── accessibility ──

  describe("accessibility", () => {
    it("announces phase change via aria-live when entering analyzing", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={0}
        />,
      );
      const el = screen.getByTestId("aria-announcement");
      expect(el).toHaveTextContent("Analizando documento con IA");
    });

    it("announces phase change via aria-live on completed", () => {
      render(
        <AnalysisProgress
          status="completed"
          progress={100}
          fileName="doc.pdf"
        />,
      );
      const el = screen.getByTestId("aria-announcement");
      expect(el).toHaveTextContent("Análisis completado");
    });

    it("announces phase change via aria-live on failed", () => {
      render(
        <AnalysisProgress status="failed" progress={0} fileName="doc.pdf" />,
      );
      const el = screen.getByTestId("aria-announcement");
      expect(el).toHaveTextContent("El análisis falló");
    });

    it("rotating messages are aria-hidden", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={5}
          currentMessageIndex={1}
        />,
      );
      const msg = screen.getByTestId("status-message");
      expect(msg).toHaveAttribute("aria-hidden", "true");
    });

    it("aria-live does not fire mid-analyzing (elapsed > 0)", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={10}
        />,
      );
      // When analyzingElapsed > 0, no aria announcement should render
      expect(screen.queryByTestId("aria-announcement")).toBeNull();
    });
  });

  // ── file badge ──

  describe("file badge", () => {
    it("renders file badge with filename and formatted size", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="contrato.pdf"
          fileSize={2_500_000}
          analyzingElapsed={5}
        />,
      );
      expect(screen.getByTestId("file-badge-name")).toHaveTextContent(
        "contrato.pdf",
      );
      expect(screen.getByTestId("file-badge-size")).toHaveTextContent("2.4 MB");
    });

    it("renders file badge with KB formatting for small files", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="small.txt"
          fileSize={500}
          analyzingElapsed={3}
        />,
      );
      expect(screen.getByTestId("file-badge-size")).toHaveTextContent("0.5 KB");
    });

    it("does not render file badge when fileName is missing", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          analyzingElapsed={5}
        />,
      );
      expect(screen.queryByTestId("file-badge-name")).toBeNull();
    });
  });

  // ── edge cases ──

  describe("edge cases", () => {
    it("renders pending state with loader", () => {
      render(
        <AnalysisProgress status="pending" progress={0} />,
      );
      expect(screen.getByText("Preparando análisis...")).toBeDefined();
    });

    it("renders failed state with error message", () => {
      render(
        <AnalysisProgress status="failed" progress={42} fileName="doc.pdf" />,
      );
      expect(screen.getByTestId("failed-message")).toBeDefined();
    });

    it("renders completed state without indeterminate animation", () => {
      render(
        <AnalysisProgress status="completed" progress={100} fileName="doc.pdf" />,
      );
      const bar = screen.getByRole("progressbar");
      // Completed: should be a full bar, not indeterminate
      expect(bar).not.toHaveAttribute("aria-valuetext");
      expect(screen.getByText("Análisis completado exitosamente.")).toBeDefined();
    });

    it("wraps message index safely beyond array length", () => {
      render(
        <AnalysisProgress
          status="analyzing"
          progress={100}
          fileName="doc.pdf"
          analyzingElapsed={5}
          currentMessageIndex={7}
        />,
      );
      // 7 % 5 = 2
      expect(screen.getByTestId("status-message")).toHaveTextContent(MESSAGES[2]);
    });
  });
});
