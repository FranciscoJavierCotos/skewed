import { render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";

it("links to home, play and about", () => {
  render(<SiteHeader />);
  const nav = screen.getByRole("navigation");
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /skewed/i })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: /^play$/i })).toHaveAttribute("href", "/play");
  expect(screen.getByRole("link", { name: /^about$/i })).toHaveAttribute("href", "/about");
});
