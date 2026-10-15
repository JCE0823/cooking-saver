import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.jsx";
import { clearCredentials } from "../src/api.js";

afterEach(() => {
  cleanup();
  clearCredentials();
  vi.restoreAllMocks();
});

describe("application shell", () => {
  it("offers navigation to search and recipe management", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    render(<App />);

    return (async () => {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/username/i), "student");
      await user.type(screen.getByLabelText(/password/i), "secret");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      expect(screen.getByRole("link", { name: /search/i })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: /my recipes/i })).toHaveAttribute("href", "/recipes");
    })();
  });
});
