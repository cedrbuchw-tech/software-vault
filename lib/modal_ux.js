"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Close a dialog only when both the press and the release land on the backdrop.
 * A plain onClick also fires when a text drag started inside the dialog ends
 * on the overlay. Spread the result onto the overlay element.
 */
export function useBackdropClose(onClose) {
  const startedOnBackdrop = useRef(false);

  const start = (e) => {
    // currentTarget is the overlay; target is whatever was actually pressed
    startedOnBackdrop.current = e.target === e.currentTarget;
  };

  const finish = (e) => {
    const clean = startedOnBackdrop.current && e.target === e.currentTarget;
    startedOnBackdrop.current = false;
    if (clean && onClose) onClose();
  };

  return {
    onMouseDown: start,
    onTouchStart: start,
    onClick: finish,
  };
}

/**
 * Stop the page behind a dialog from scrolling. iOS Safari ignores
 * `overflow: hidden`, so the body is also pinned and the scroll position
 * restored on close.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const scrollY = window.scrollY || window.pageYOffset || 0;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}


/**
 * Render a dialog straight into <body>. Any ancestor with a transform, filter
 * or backdrop-filter becomes the containing block for `position: fixed`, and
 * party mode animates a filter on the page root.
 */
export function Portal({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/** Panel styles that let a tall dialog scroll on its own, phone included. */
export const scrollPanel = {
  maxHeight: "min(86vh, 900px)",
  overflowY: "auto",
  // keep the scroll inside the dialog instead of handing it to the page
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
};
