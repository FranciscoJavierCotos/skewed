import { act, renderHook } from "@testing-library/react";
import { useCountdown } from "./use-countdown";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("counts down and fires onExpire once", () => {
  const onExpire = vi.fn();
  const { result } = renderHook(() => useCountdown(3, "q1", onExpire));
  expect(result.current).toBe(3);
  act(() => vi.advanceTimersByTime(3000));
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(3000));
  expect(onExpire).toHaveBeenCalledTimes(1);
});

it("resets when the key changes", () => {
  const { result, rerender } = renderHook(({ k }) => useCountdown(5, k, vi.fn()), { initialProps: { k: "q1" } });
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current).toBe(2);
  rerender({ k: "q2" });
  expect(result.current).toBe(5);
});

it("fires again for the next key after expiring", () => {
  const onExpire = vi.fn();
  const { rerender } = renderHook(({ k }) => useCountdown(2, k, onExpire), { initialProps: { k: "q1" } });
  act(() => vi.advanceTimersByTime(2000));
  rerender({ k: "q2" });
  act(() => vi.advanceTimersByTime(2000));
  expect(onExpire).toHaveBeenCalledTimes(2);
});

it("is inert when seconds is null", () => {
  const onExpire = vi.fn();
  const { result } = renderHook(() => useCountdown(null, "q1", onExpire));
  act(() => vi.advanceTimersByTime(100000));
  expect(result.current).toBeNull();
  expect(onExpire).not.toHaveBeenCalled();
});
