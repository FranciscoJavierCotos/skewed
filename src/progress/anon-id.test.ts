import { getAnonId } from "./anon-id";

beforeEach(() => localStorage.clear());
it("is stable across calls", () => expect(getAnonId(localStorage)).toBe(getAnonId(localStorage)));
it("is a uuid", () => expect(getAnonId(localStorage)).toMatch(/^[0-9a-f-]{36}$/));
it("replaces a malformed stored value", () => {
  localStorage.setItem("skewed:v1:anon_id", "garbage");
  expect(getAnonId(localStorage)).toMatch(/^[0-9a-f-]{36}$/);
});
it("works without storage", () => expect(getAnonId(null)).toMatch(/^[0-9a-f-]{36}$/));
