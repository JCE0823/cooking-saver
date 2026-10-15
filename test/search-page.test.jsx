import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPage } from "../src/pages/SearchPage.jsx";
import * as api from "../src/api.js";

const recipe = {
  id: 1,
  name: "Recipe",
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 4,
  notes: "Serve warm.",
  source: "manual",
  ingredients: [{ quantity: "2", name: "tomatoes" }],
  instructions: ["Chop the tomatoes."],
  viewCount: 0
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SearchPage", () => {
  it("opens the only matching recipe automatically", async () => {
    vi.spyOn(api, "searchRecipes").mockResolvedValue([{ id: 3, name: "Tomato Soup" }]);
    vi.spyOn(api, "getRecipe").mockResolvedValue({ ...recipe, id: 3, name: "Tomato Soup", viewCount: 1 });

    render(<SearchPage />);
    await userEvent.type(screen.getByLabelText(/dish name/i), "tomato");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(await screen.findByRole("heading", { name: "Tomato Soup" })).toBeVisible();
    expect(api.getRecipe).toHaveBeenCalledWith(3);
  });

  it("shows multiple matches and opens the chosen recipe", async () => {
    vi.spyOn(api, "searchRecipes").mockResolvedValue([
      { id: 1, name: "Chicken Alfredo" },
      { id: 2, name: "Chicken Curry" }
    ]);
    vi.spyOn(api, "getRecipe").mockResolvedValue({ ...recipe, name: "Chicken Curry", viewCount: 1 });

    render(<SearchPage />);
    await userEvent.type(screen.getByLabelText(/dish name/i), "chicken");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Chicken Curry" }));

    expect(await screen.findByRole("heading", { name: "Chicken Curry" })).toBeVisible();
    expect(screen.getByText(/viewed 1 time/i)).toBeVisible();
  });

  it("does not let an older search overwrite a newer result", async () => {
    let resolveFirst;
    const search = vi.spyOn(api, "searchRecipes").mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    ).mockResolvedValueOnce([
      { id: 2, name: "Newer Soup" },
      { id: 3, name: "Newer Stew" }
    ]);

    render(<SearchPage />);
    const query = screen.getByLabelText(/dish name/i);
    await userEvent.type(query, "old");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    await userEvent.clear(query);
    await userEvent.type(query, "new");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(await screen.findByRole("button", { name: "Newer Soup" })).toBeVisible();
    resolveFirst([{ id: 1, name: "Older Soup" }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByRole("button", { name: "Older Soup" })).not.toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("copies a shared search result", async () => {
    vi.spyOn(api, "searchRecipes").mockResolvedValue([
      { id: 8, name: "Pancakes", source: "starter", scope: "shared", viewCount: 0 }
    ]);
    vi.spyOn(api, "getRecipe").mockResolvedValue({
      ...recipe,
      id: 8,
      name: "Pancakes",
      source: "starter",
      scope: "shared"
    });
    const copy = vi.spyOn(api, "copySharedRecipe").mockResolvedValue({
      ...recipe,
      id: 18,
      name: "Pancakes",
      scope: "personal"
    });

    render(<SearchPage />);
    await userEvent.type(screen.getByLabelText(/dish name/i), "Pancakes");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /save to my recipes/i }));

    expect(copy).toHaveBeenCalledWith(8);
    expect(await screen.findByRole("status")).toHaveTextContent(/saved to my recipes/i);
  });
});
