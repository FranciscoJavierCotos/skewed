import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupForm } from "./SetupForm";

it("starts practice with the default topics and mixed level", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("practice", "topics=spark%2Csql&level=mixed");
});

it("starts an exam with chosen topics, level, length and timer", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  await userEvent.click(screen.getByRole("radio", { name: /exam/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /git/i }));
  await userEvent.selectOptions(screen.getByLabelText(/^level/i), "3");
  await userEvent.selectOptions(screen.getByLabelText(/questions/i), "20");
  await userEvent.click(screen.getByRole("checkbox", { name: /timer/i }));
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("exam", "topics=spark%2Csql%2Cgit&level=3&length=20&timer=on");
});

it("only shows exam length and timer in exam mode", async () => {
  render(<SetupForm onStart={vi.fn()} />);
  expect(screen.queryByLabelText(/questions/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /timer/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: /exam/i }));
  expect(screen.getByLabelText(/questions/i)).toBeInTheDocument();
});

it("keeps topics in canonical order regardless of click order", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  for (const t of ["spark", "sql", "git", "sql"]) await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(t, "i") }));
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("practice", "topics=sql%2Cgit&level=mixed");
});

it("survival offers levels 1-5 without Mixed and disables start with no topics", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  await userEvent.click(screen.getByRole("radio", { name: /survival/i }));
  expect(screen.getByLabelText(/^level/i)).toHaveValue("1");
  expect(screen.queryByRole("option", { name: /mixed/i })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/^level/i), "3");
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("survival", "topics=spark%2Csql&level=3");
  for (const t of ["spark", "sql"]) await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(t, "i") }));
  expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
});
