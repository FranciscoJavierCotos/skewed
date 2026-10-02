import { shuffle } from "./shared";

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
