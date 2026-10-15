import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedRecipesPage } from "../src/pages/SharedRecipesPage.jsx";
import * as api from "../src/api.js";

const summary = {
  id: 7,
  name: "Tomato Soup",
  source: "manual",
  scope: "shared",
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

describe("SharedRecipesPage", () => {
  it("uses shared recipe APIs and shows scope", async () => {
    vi.spyOn(api, "listSharedRecipes").mockResolvedValue([summary]);
    vi.spyOn(api, "listRecipes");

    render(<SharedRecipesPage canManage />);

    expect(await screen.findByRole("heading", { name: "Tomato Soup" })).toBeVisible();
    expect(screen.getByText(/scope: shared/i)).toBeVisible();
    expect(api.listRecipes).not.toHaveBeenCalled();
  });

  it("creates, edits, and deletes shared recipes", async () => {
    vi.spyOn(api, "listSharedRecipes").mockResolvedValue([recipe]);
    const create = vi.spyOn(api, "createSharedRecipe").mockResolvedValue(recipe);
    const update = vi.spyOn(api, "updateSharedRecipe").mockResolvedValue({ ...recipe, servings: 6 });
    const remove = vi.spyOn(api, "deleteSharedRecipe").mockResolvedValue();

    render(<SharedRecipesPage canManage />);
    await userEvent.click(await screen.findByRole("button", { name: /add shared recipe/i }));
    await userEvent.type(screen.getByLabelText(/^name$/i), "Tomato Soup");
    await userEvent.type(screen.getByLabelText(/ingredient 1 quantity/i), "2");
    await userEvent.type(screen.getByLabelText(/ingredient 1 name/i), "tomatoes");
    await userEvent.type(screen.getByLabelText(/step 1 instruction/i), "Simmer everything.");
    await userEvent.click(screen.getByRole("button", { name: /save shared recipe/i }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Tomato Soup" }));

    await userEvent.click(await screen.findByRole("button", { name: /edit tomato soup/i }));
    await userEvent.clear(await screen.findByLabelText(/servings/i));
    await userEvent.type(screen.getByLabelText(/servings/i), "6");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(update).toHaveBeenCalledWith(summary.id, expect.objectContaining({ servings: 6 }));

    await userEvent.click(await screen.findByRole("button", { name: /delete tomato soup/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(remove).toHaveBeenCalledWith(summary.id);
  });

  it("hides owner controls when the viewer is not an owner", async () => {
    vi.spyOn(api, "listSharedRecipes").mockResolvedValue([summary]);

    render(<SharedRecipesPage canManage={false} />);

    await screen.findByRole("heading", { name: "Tomato Soup" });
    expect(screen.queryByRole("button", { name: /add shared recipe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit tomato soup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete tomato soup/i })).not.toBeInTheDocument();
  });
});
