"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

type Mode = "idle" | "pending" | "dragging" | "cancelled";

type UseDragSelectOptions = {
  attribute: string;
  onConfirm: (ids: string[]) => void;
  scrollThreshold?: number;
  holdDelay?: number;
};

export function useDragSelect({
  attribute,
  onConfirm,
  scrollThreshold = 5,
  holdDelay = 0,
}: UseDragSelectOptions) {
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const modeRef = useRef<Mode>("idle");
  const originRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const sweptRef = useRef<Set<string>>(new Set());
  const justDraggedRef = useRef(false);
  const containerRef = useRef<Element | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);

  const findIdAtPoint = useCallback(
    (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const target = el.closest(`[${attribute}]`);
      return target?.getAttribute(attribute) ?? null;
    },
    [attribute],
  );

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearHoldTimer();
    modeRef.current = "idle";
    originRef.current = null;
    containerRef.current = null;
    sweptRef.current = new Set();
    setPreviewIds([]);
    setIsDragging(false);
  }, [clearHoldTimer]);

  useEffect(() => {
    return () => clearHoldTimer();
  }, [clearHoldTimer]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      modeRef.current = "pending";
      originRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      containerRef.current = e.currentTarget as Element;
      sweptRef.current = new Set();

      if (holdDelay > 0) {
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          if (modeRef.current !== "pending") return;
          const origin = originRef.current;
          const container = containerRef.current;
          if (!origin || !container) return;
          modeRef.current = "dragging";
          setIsDragging(true);
          try {
            container.setPointerCapture(origin.pointerId);
          } catch {
            // pointer may already be released
          }
          const startId = findIdAtPoint(origin.x, origin.y);
          if (startId) {
            sweptRef.current.add(startId);
            setPreviewIds([startId]);
          }
        }, holdDelay);
      }
    },
    [findIdAtPoint, holdDelay],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;

      if (modeRef.current === "pending") {
        const dx = Math.abs(e.clientX - origin.x);
        const dy = Math.abs(e.clientY - origin.y);

        if (holdDelay > 0) {
          if (dx > scrollThreshold || dy > scrollThreshold) {
            clearHoldTimer();
            modeRef.current = "cancelled";
          }
          return;
        }

        if (dx < scrollThreshold && dy < scrollThreshold) return;
        if (dx > dy) {
          modeRef.current = "dragging";
          setIsDragging(true);
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          const startId = findIdAtPoint(origin.x, origin.y);
          if (startId) {
            sweptRef.current.add(startId);
            setPreviewIds([startId]);
          }
        } else {
          modeRef.current = "cancelled";
          return;
        }
      }

      if (modeRef.current !== "dragging") return;

      const id = findIdAtPoint(e.clientX, e.clientY);
      if (id && !sweptRef.current.has(id)) {
        sweptRef.current.add(id);
        setPreviewIds(Array.from(sweptRef.current));
      }
    },
    [findIdAtPoint, scrollThreshold, holdDelay, clearHoldTimer],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      if (modeRef.current === "dragging") {
        justDraggedRef.current = true;
        if (sweptRef.current.size > 0) onConfirm(Array.from(sweptRef.current));
      }
      reset();
    },
    [onConfirm, reset],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent) => {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      reset();
    },
    [reset],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (justDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      justDraggedRef.current = false;
    }
  }, []);

  const handleNativeTouchMove = useCallback((e: TouchEvent) => {
    if (modeRef.current === "dragging" && e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const bindTarget = useCallback(
    (el: HTMLElement | null) => {
      if (targetElRef.current === el) return;
      if (targetElRef.current) {
        targetElRef.current.removeEventListener("touchmove", handleNativeTouchMove);
      }
      targetElRef.current = el;
      if (el) {
        el.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
      }
    },
    [handleNativeTouchMove],
  );

  useEffect(() => {
    return () => {
      if (targetElRef.current) {
        targetElRef.current.removeEventListener("touchmove", handleNativeTouchMove);
        targetElRef.current = null;
      }
    };
  }, [handleNativeTouchMove]);

  return {
    previewIds,
    isDragging,
    bindTarget,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    },
  };
}
