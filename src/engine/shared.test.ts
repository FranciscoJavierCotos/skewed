import { shuffle, survivalLevel } from "./shared";

describe("survivalLevel", () => {
  it.each([[0, 1], [4, 1], [5, 2], [9, 2], [10, 3], [20, 5], [99, 5]])("streak %i -> level %i", (s, l) => {
    expect(survivalLevel(s)).toBe(l);
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating input", () => {
    const input = [1, 2, 3, 4];
    const out = shuffle(input, () => 0);
    expect(out.sort()).toEqual([1, 2, 3, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
  it("is deterministic for a given rng", () => {
    const seeded = () => { const seq = [0.9, 0.1, 0.5]; let i = 0; return () => seq[i++ % seq.length]; };
    expect(shuffle(["a", "b", "c", "d"], seeded())).toEqual(shuffle(["a", "b", "c", "d"], seeded()));
  });
});
