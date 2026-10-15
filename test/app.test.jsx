import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "../src/App.jsx";

afterEach(() => cleanup());

describe("application shell", () => {
  it("offers navigation to search and recipe management", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /search/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /my recipes/i })).toHaveAttribute("href", "/recipes");
  });
});
