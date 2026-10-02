import { highlight, langFor } from "./highlight";

it("maps topics to code languages", () => {
  expect([langFor("spark"), langFor("sql"), langFor("git")]).toEqual(["python", "sql", "bash"]);
});

it("highlights with light and dark themes and escapes the source", async () => {
  const html = await highlight("SELECT '<b>' FROM t", "sql");
  expect(html).toContain('class="shiki');
  expect(html).toContain("--shiki-dark");
  expect(html).not.toContain("<b>");
});
