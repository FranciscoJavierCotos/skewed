import { parseSessionConfig, toSearchParams } from "./session-config";

const p = (s: string) => new URLSearchParams(s);

it("parses a full exam config", () => {
  expect(parseSessionConfig("exam", p("topics=spark,sql&level=3&length=20&timer=on"))).toEqual({
    mode: "exam", topics: ["spark", "sql"], level: 3, examLength: 20, timerSeconds: 60,
  });
});
it("defaults level=mixed, length=10, timer off", () => {
  expect(parseSessionConfig("practice", p("topics=git"))).toEqual({
    mode: "practice", topics: ["git"], level: "mixed", examLength: 10, timerSeconds: null,
  });
});
it("dedupes topics", () => {
  expect(parseSessionConfig("practice", p("topics=git,git"))?.topics).toEqual(["git"]);
});
it.each(["", "topics=", "topics=python", "topics=sql&level=6", "topics=sql&level=abc", "topics=sql&length=15"])(
  "rejects %s", (q) => expect(parseSessionConfig("exam", p(q))).toBeNull(),
);
it("round-trips", () => {
  const c = parseSessionConfig("exam", p("topics=sql&level=2&length=40&timer=on"))!;
  expect(parseSessionConfig("exam", p(toSearchParams(c)))).toEqual(c);
});
it("survival defaults to level 1 and rejects mixed", () => {
  expect(parseSessionConfig("survival", p("topics=sql"))?.level).toBe(1);
  expect(parseSessionConfig("survival", p("topics=sql&level=4"))?.level).toBe(4);
  expect(parseSessionConfig("survival", p("topics=sql&level=mixed"))).toBeNull();
});
