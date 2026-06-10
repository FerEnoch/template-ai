import { useState, useCallback, useEffect, type RefObject } from "react";

export interface TextSelection {
  text: string;
  sourceSpan: {
    start: number;
    end: number;
  };
  context: string;
}

/**
 * Hook to manage text selection mode for manual entity creation.
 * Computes character offsets against the original extractedText string
 * using Range API with text node traversal to handle multi-byte characters correctly.
 */
export function useTextSelection(
  articleRef: RefObject<HTMLElement>,
  extractedText: string | null
) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const startSelection = useCallback(() => {
    setIsSelecting(true);
    setSelection(null);
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelection = useCallback(() => {
    if (!isSelecting || !articleRef.current || !extractedText) {
      return;
    }

    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.rangeCount === 0) {
      return;
    }

    const range = windowSelection.getRangeAt(0);
    if (range.collapsed) {
      return; // No text selected
    }

    // Verify selection is within the article element
    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    // Compute character offsets by walking text nodes
    const { start, end } = computeOffsets(
      articleRef.current,
      range.startContainer,
      range.startOffset,
      range.endContainer,
      range.endOffset
    );

    if (start === null || end === null || start >= end) {
      return;
    }

    const selectedText = extractedText.slice(start, end);
    const contextStart = Math.max(0, start - 100);
    const contextEnd = Math.min(extractedText.length, end + 100);
    const context = extractedText.slice(contextStart, contextEnd);

    setSelection({
      text: selectedText,
      sourceSpan: { start, end },
      context,
    });

    setIsSelecting(false);
  }, [isSelecting, articleRef, extractedText]);

  // Add mouseup listener when in selection mode
  useEffect(() => {
    if (!isSelecting) {
      return;
    }

    const handleMouseUp = () => {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        handleSelection();
      }, 10);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting, handleSelection]);

  return {
    isSelecting,
    startSelection,
    cancelSelection,
    selection,
    clearSelection: () => setSelection(null),
  };
}

/**
 * Computes character offsets in the extractedText string by walking
 * through text nodes in document order and accumulating character counts.
 */
function computeOffsets(
  container: HTMLElement,
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number
): { start: number | null; end: number | null } {
  let charCount = 0;
  let start: number | null = null;
  let end: number | null = null;

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node = walker.nextNode();
  while (node) {
    const textContent = node.textContent || "";

    if (node === startContainer) {
      start = charCount + startOffset;
    }

    if (node === endContainer) {
      end = charCount + endOffset;
      break; // Found both, we're done
    }

    charCount += textContent.length;
    node = walker.nextNode();
  }

  return { start, end };
}
