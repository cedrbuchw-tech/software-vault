"use client";
import { useEffect, useRef } from "react";

/**
 * Close a dialog only on a real click on the backdrop.
 *
 * A plain `onClick={onClose}` on the overlay also fires when a drag ENDS there —
 * so selecting text inside the dialog and releasing the mouse slightly outside
 * it would throw the dialog away, losing whatever had been typed. This tracks
 * where the press started and only closes when both the press and the release
 * happened on the backdrop itself.
 *
 * Spread the result onto the overlay element:
 *   <div {...useBackdropClose(onClose)} style={overlay}>
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
 * Stop the page behind a dialog from scrolling.
 *
 * `overflow: hidden` alone is ignored by iOS Safari, which happily scrolls the
 * body anyway, so the page is also pinned in place and the scroll position is
 * restored on close — otherwise closing a dialog would jump you to the top.
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
