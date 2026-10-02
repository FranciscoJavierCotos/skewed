import en from "@/messages/en.json";

it("loads UI messages", () => {
  expect(en.app.name).toBe("Skewed");
});
