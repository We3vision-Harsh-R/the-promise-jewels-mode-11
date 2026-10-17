import { useEffect } from "react";

// Replaces the browser's blue selection box with a soft brass highlight that
// sweeps in from the left as text is selected. Browsers cannot animate their
// own ::selection, so the native highlight is made transparent (only while this
// is running — see .has-selection-fx in globals.css) and thin rectangles are
// drawn over the selected lines instead. They ignore the pointer, sit over the
// text with a multiply blend so it stays readable, and are reused while a drag
// extends the selection so only the newly covered part animates in.

const MIN_WIDTH = 1;

function lineRects(range) {
  const rects = [...range.getClientRects()].filter((r) => r.width > MIN_WIDTH && r.height > 2);

  // A range reports the boxes of containing elements as well as the text's own
  // (and split-text headings report every word); keep only the innermost boxes.
  const leaves = rects.filter(
    (a, i) =>
      !rects.some(
        (b, j) =>
          j !== i &&
          a.left <= b.left + 0.5 &&
          a.right >= b.right - 0.5 &&
          a.top <= b.top + 0.5 &&
          a.bottom >= b.bottom - 0.5 &&
          (a.width > b.width || a.height > b.height),
      ),
  );

  // Join pieces on the same line (words, spans) into one continuous strip.
  leaves.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];

  for (const r of leaves) {
    const last = lines[lines.length - 1];

    if (last && Math.abs(last.top - r.top) < 4 && r.left - last.right < 16) {
      last.left = Math.min(last.left, r.left);
      last.right = Math.max(last.right, r.right);
      last.bottom = Math.max(last.bottom, r.bottom);
      last.top = Math.min(last.top, r.top);
    } else {
      lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }

  return lines.map((l) => ({ left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top }));
}

export default function SelectionHighlight() {
  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)").matches) return undefined;

    const layer = document.createElement("div");
    layer.className = "selection-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);

    let frame = 0;

    function clear() {
      layer.replaceChildren();
      document.documentElement.classList.remove("has-selection-fx");
    }

    function draw() {
      frame = 0;
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        clear();
        return;
      }

      const range = selection.getRangeAt(0);
      const host = range.commonAncestorContainer;
      const element = host.nodeType === 1 ? host : host.parentElement;

      if (!element?.closest(".web-theme") || element.closest("input, textarea")) {
        clear();
        return;
      }

      document.documentElement.classList.add("has-selection-fx");

      const rects = lineRects(range);
      const x = window.scrollX;
      const y = window.scrollY;
      const nodes = layer.children;

      rects.forEach((rect, index) => {
        let node = nodes[index];
        const fresh = !node;

        if (fresh) {
          node = document.createElement("span");
          node.className = "selection-fx-rect";
          node.style.animationDelay = `${Math.min(index, 8) * 28}ms`;
          layer.appendChild(node);
        }

        node.style.transform = `translate(${rect.left + x}px, ${rect.top + y}px)`;
        node.style.width = `${rect.width}px`;
        node.style.height = `${rect.height}px`;
      });

      while (layer.children.length > rects.length) layer.lastElementChild.remove();
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      clear();
      layer.remove();
    };
  }, []);

  return null;
}
