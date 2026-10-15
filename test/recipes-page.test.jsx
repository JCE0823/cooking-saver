import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipesPage } from "../src/pages/RecipesPage.jsx";
import * as api from "../src/api.js";

const summary = {
  id: 7,
  name: "Tomato Soup",
  source: "manual",
  scope: "personal",
  viewCount: 3
};

const recipe = {
  ...summary,
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  notes: "Serve hot.",
  ingredients: [{ quantity: "2", name: "tomatoes" }],
  instructions: ["Simmer everything."]
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RecipesPage", () => {
  it("shows saved recipe summaries", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([summary]);

    render(<RecipesPage />);

    expect(await screen.findByRole("heading", { name: "Tomato Soup" })).toBeVisible();
    expect(screen.getByText(/source: manual/i)).toBeVisible();
    expect(screen.getByText(/scope: personal/i)).toBeVisible();
    expect(screen.getByText(/viewed 3 times/i)).toBeVisible();
  });

  it("keeps card action text short while naming the recipe for assistive technology", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([
      { ...summary, name: "Chocolate Chip Cookies" }
    ]);

    render(<RecipesPage />);

    const edit = await screen.findByRole("button", { name: "Edit Chocolate Chip Cookies" });
    const remove = screen.getByRole("button", { name: "Delete Chocolate Chip Cookies" });
    expect(edit).toHaveTextContent(/^Edit$/);
    expect(remove).toHaveTextContent(/^Delete$/);
  });

  it("edits a saved recipe", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([summary]);
    vi.spyOn(api, "getRecipe").mockResolvedValue(recipe);
    const update = vi.spyOn(api, "updateRecipe").mockResolvedValue({ ...recipe, servings: 6 });

    render(<RecipesPage />);
    await userEvent.click(await screen.findByRole("button", { name: /edit tomato soup/i }));
    await userEvent.clear(await screen.findByLabelText(/servings/i));
    await userEvent.type(screen.getByLabelText(/servings/i), "6");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(update).toHaveBeenCalledWith(recipe.id, expect.objectContaining({ servings: 6 }));
  });

  it("requires confirmation before deleting", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([summary]);
    const remove = vi.spyOn(api, "deleteRecipe").mockResolvedValue();

    render(<RecipesPage />);
    await userEvent.click(await screen.findByRole("button", { name: /delete tomato soup/i }));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    expect(remove).toHaveBeenCalledWith(summary.id);
  });

  it("creates a manual recipe from the add action", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([]);
    const create = vi.spyOn(api, "createRecipe").mockResolvedValue({ ...recipe, source: "manual" });

    render(<RecipesPage />);
    await userEvent.click(await screen.findByRole("button", { name: /add recipe/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Tomato Soup");
    await userEvent.type(screen.getByLabelText(/ingredient 1 quantity/i), "2");
    await userEvent.type(screen.getByLabelText(/ingredient 1 name/i), "tomatoes");
    await userEvent.type(screen.getByLabelText(/step 1 instruction/i), "Simmer everything.");
    await userEvent.click(screen.getByRole("button", { name: /save recipe/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Tomato Soup", source: "manual" }));
  });

  it("acknowledges a successful save even when refreshing the list fails", async () => {
    vi.spyOn(api, "listRecipes")
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("refresh down"));
    vi.spyOn(api, "createRecipe").mockResolvedValue({ ...recipe, source: "manual" });

    render(<RecipesPage />);
    await userEvent.click(await screen.findByRole("button", { name: /add recipe/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Tomato Soup");
    await userEvent.type(screen.getByLabelText(/ingredient 1 quantity/i), "2");
    await userEvent.type(screen.getByLabelText(/ingredient 1 name/i), "tomatoes");
    await userEvent.type(screen.getByLabelText(/step 1 instruction/i), "Simmer everything.");
    await userEvent.click(screen.getByRole("button", { name: /save recipe/i }));

    expect(await screen.findByText("Recipe saved.")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t load your recipes/i);
    expect(screen.getByRole("button", { name: /retry loading recipes/i })).toBeVisible();
  });

  it("keeps a recipe visible and offers retry when deletion fails", async () => {
    vi.spyOn(api, "listRecipes").mockResolvedValue([summary]);
    vi.spyOn(api, "deleteRecipe").mockRejectedValue(new Error("network down"));

    render(<RecipesPage />);
    await userEvent.click(await screen.findByRole("button", { name: /delete tomato soup/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t delete/i);
    expect(screen.getByRole("heading", { name: "Tomato Soup" })).toBeVisible();
    expect(screen.getByRole("button", { name: /retry delete/i })).toBeVisible();
  });

  it("shows a safe service-unavailable message instead of the API error", async () => {
    vi.spyOn(api, "listRecipes").mockRejectedValue(Object.assign(
      new Error("Request failed: database_unavailable"),
      { code: "database_unavailable", status: 503 }
    ));

    render(<RecipesPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/temporarily unavailable/i);
    expect(alert).not.toHaveTextContent(/database_unavailable|request failed/i);
  });
});
