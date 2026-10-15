import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPage } from "../src/pages/SearchPage.jsx";
import * as api from "../src/api.js";

const aiPreview = {
  name: "Ethiopian Lentil Stew",
  prepMinutes: 15,
  cookMinutes: 35,
  servings: 4,
  notes: "Serve with crusty bread.",
  source: "ai",
  ingredients: [{ quantity: "1 cup", name: "brown lentils" }],
  instructions: ["Simmer the lentils until tender."]
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function searchFor(query) {
  await userEvent.type(screen.getByLabelText(/dish name/i), query);
  await userEvent.click(screen.getByRole("button", { name: /search/i }));
}

describe("AI recipe generation flow", () => {
  it("lets the user edit an AI preview before saving it", async () => {
    vi.spyOn(api, "searchRecipes").mockResolvedValue([]);
    vi.spyOn(api, "generateRecipe").mockResolvedValue(aiPreview);
    const save = vi.spyOn(api, "createRecipe").mockResolvedValue({ ...aiPreview, id: 9 });

    render(<SearchPage />);
    await searchFor("Ethiopian lentil stew");
    await userEvent.click(screen.getByRole("button", { name: /generate recipe/i }));

    expect(await screen.findByText(/review this ai-generated recipe/i)).toBeVisible();
    await userEvent.clear(screen.getByLabelText(/notes/i));
    await userEvent.type(screen.getByLabelText(/notes/i), "Add lemon before serving.");
    expect(save).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /save recipe/i }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      notes: "Add lemon before serving.",
      source: "ai"
    }));
  });

  it("does not show a stale generation result after a different search starts", async () => {
    let resolveGeneration;
    vi.spyOn(api, "searchRecipes").mockResolvedValue([]);
    vi.spyOn(api, "generateRecipe").mockImplementation(
      () => new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );

    render(<SearchPage />);
    await searchFor("Ethiopian lentil stew");
    await userEvent.click(screen.getByRole("button", { name: /generate recipe/i }));
    expect(screen.getByText(/generating a recipe preview/i)).toBeVisible();

    await userEvent.clear(screen.getByLabelText(/dish name/i));
    await userEvent.type(screen.getByLabelText(/dish name/i), "Tomato soup");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(await screen.findByText(/no saved recipes matched “tomato soup”/i)).toBeVisible();

    resolveGeneration(aiPreview);
    await waitFor(() => {
      expect(screen.queryByText(/review this ai-generated recipe/i)).not.toBeInTheDocument();
    });
  });

  it("shows server validation errors beside fields when saving a preview", async () => {
    vi.spyOn(api, "searchRecipes").mockResolvedValue([]);
    vi.spyOn(api, "generateRecipe").mockResolvedValue(aiPreview);
    const saveError = Object.assign(new Error("Request failed: validation_failed"), {
      fields: {
        name: ["Name is already used."],
        "ingredients.0.name": ["Ingredient name is required."]
      }
    });
    vi.spyOn(api, "createRecipe").mockRejectedValue(saveError);

    render(<SearchPage />);
    await searchFor("Ethiopian lentil stew");
    await userEvent.click(screen.getByRole("button", { name: /generate recipe/i }));
    await screen.findByText(/review this ai-generated recipe/i);
    await userEvent.click(screen.getByRole("button", { name: /save recipe/i }));

    expect(await screen.findByRole("heading", { name: /please correct the following errors/i })).toBeVisible();
    expect(screen.getByLabelText(/^name$/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Name is already used.")).toBeVisible();
    expect(screen.getByText("Ingredient name is required.")).toBeVisible();

    await userEvent.clear(screen.getByLabelText(/^name$/i));
    expect(screen.queryByText("Name is already used.")).not.toBeInTheDocument();
  });
});
