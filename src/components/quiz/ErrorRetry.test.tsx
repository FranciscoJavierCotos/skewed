import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/quiz-api";
import en from "@/messages/en.json";
import { ErrorRetry, submitErrorMessage } from "./ErrorRetry";

it("a rate-limited submit asks the player to slow down; other failures say the server is unreachable", () => {
  expect(submitErrorMessage(new ApiError("rate limit exceeded", "rate_limited"))).toBe(en.game.rateLimited);
  expect(submitErrorMessage(new ApiError("offline", "network"))).toBe(en.game.submitFailed);
  expect(submitErrorMessage(new ApiError("boom", "server"))).toBe(en.game.submitFailed);
});

it("shows the message with a retry button", async () => {
  const onRetry = vi.fn();
  render(<ErrorRetry message={en.game.rateLimited} onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent(en.game.rateLimited);
  await userEvent.click(screen.getByRole("button", { name: en.game.retry }));
  expect(onRetry).toHaveBeenCalledOnce();
});
