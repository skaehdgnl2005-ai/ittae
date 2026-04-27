import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimeSlotSelection } from "../useTimeSlotSelection";

describe("useTimeSlotSelection", () => {
  it("starts in idle state with no selection", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    expect(result.current.state).toBe("idle");
    expect(result.current.pendingStart).toBeNull();
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("selects a range with two clicks", () => {
    const { result } = renderHook(() => useTimeSlotSelection());

    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    expect(result.current.state).toBe("startSelected");
    expect(result.current.pendingStart).toEqual({ date: "2026-04-25", time: "14:00" });

    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    expect(result.current.state).toBe("idle");
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:30" }]);
  });

  it("auto-swaps if end is before start", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:30" }]);
  });

  it("cancels on re-click of start cell", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    expect(result.current.state).toBe("idle");
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("clicking a different column resets start to new column", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-26", "15:00"));
    expect(result.current.pendingStart).toEqual({ date: "2026-04-26", time: "15:00" });
  });

  it("deselects an entire range when clicking a selected cell", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    // Select 14:00–16:30
    act(() => result.current.handleCellClick("2026-04-25", "14:00"));
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));

    // Click inside that range → deselect it
    act(() => result.current.handleCellClick("2026-04-25", "15:00"));
    expect(result.current.getSelectedRanges("2026-04-25")).toEqual([]);
  });

  it("supports multiple ranges on one date", () => {
    const { result } = renderHook(() => useTimeSlotSelection());
    // Range 1: 12:00–13:30
    act(() => result.current.handleCellClick("2026-04-25", "12:00"));
    act(() => result.current.handleCellClick("2026-04-25", "13:00"));
    // Range 2: 16:00–17:30
    act(() => result.current.handleCellClick("2026-04-25", "16:00"));
    act(() => result.current.handleCellClick("2026-04-25", "17:00"));

    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toHaveLength(2);
  });

  it("initializes from existing TimeSlot data", () => {
    const existing = [
      { id: "t1", sessionId: "vs1", userId: "u1", date: "2026-04-25", startTime: "14:00", endTime: "16:00" },
    ];
    const { result } = renderHook(() => useTimeSlotSelection(existing));
    const ranges = result.current.getSelectedRanges("2026-04-25");
    expect(ranges).toEqual([{ startTime: "14:00", endTime: "16:00" }]);
  });
});
