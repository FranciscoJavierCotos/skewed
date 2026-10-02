import { fetchSurvivalQuestion, RECYCLE_WINDOW } from "./survival-fetch";
import { makeQuestion } from "./test-helpers";

it("returns a question from the current level when available", async () => {
  const get = vi.fn().mockResolvedValue([makeQuestion("x")]);
  expect((await fetchSurvivalQuestion(get, ["sql"], 2, ["a"]))?.id).toBe("x");
  expect(get).toHaveBeenCalledWith({ topics: ["sql"], level: 2, exclude: ["a"], limit: 1 });
});

it("falls through to higher levels when a level is exhausted", async () => {
  const get = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([makeQuestion("l4")]);
  expect((await fetchSurvivalQuestion(get, ["sql"], 3, []))?.id).toBe("l4");
  expect(get.mock.calls[1][0].level).toBe(4);
});

it("at level 5 recycles excluding only the most recent ids", async () => {
  const seen = Array.from({ length: 30 }, (_, i) => `s${i}`);
  const get = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([makeQuestion("old")]);
  expect((await fetchSurvivalQuestion(get, ["sql"], 5, seen))?.id).toBe("old");
  expect(get.mock.calls[1][0].exclude).toEqual(seen.slice(-RECYCLE_WINDOW));
});

it("returns null when nothing exists at all", async () => {
  expect(await fetchSurvivalQuestion(vi.fn().mockResolvedValue([]), ["git"], 5, [])).toBeNull();
});

it("skips the recycle query when it would repeat the level-5 query", async () => {
  const get = vi.fn().mockResolvedValue([]);
  expect(await fetchSurvivalQuestion(get, ["sql"], 5, ["a", "b"])).toBeNull();
  expect(get).toHaveBeenCalledTimes(1);
});
