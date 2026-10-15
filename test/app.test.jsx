import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.jsx";
import * as api from "../src/api.js";

afterEach(() => {
  cleanup();
  delete window.google;
  vi.restoreAllMocks();
});

function installFakeGoogle() {
  window.google = {
    accounts: {
      id: {
        initialize: () => {},
        renderButton: (container) => {
          const button = document.createElement("button");
          button.textContent = "Continue with Google";
          container.append(button);
        }
      }
    }
  };
}

const normalUser = {
  id: 1,
  email: "user@example.com",
  displayName: "Normal User",
  pictureUrl: null,
  role: "user"
};

describe("application shell", () => {
  it("restores an existing session", async () => {
    vi.spyOn(api, "getPublicConfig").mockResolvedValue({ googleClientId: "client-123" });
    vi.spyOn(api, "getSession").mockResolvedValue({ user: normalUser });

    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
    expect(await screen.findByRole("navigation", { name: /main/i })).toBeVisible();
    expect(screen.getByText("Normal User")).toBeVisible();
    expect(screen.getByText(/role: user/i)).toBeVisible();
  });

  it("offers navigation to search and recipe management", async () => {
    vi.spyOn(api, "getPublicConfig").mockResolvedValue({ googleClientId: "client-123" });
    vi.spyOn(api, "getSession").mockResolvedValue({ user: normalUser });

    render(<App />);
    await screen.findByRole("navigation", { name: /main/i });

    expect(screen.getByRole("link", { name: /search/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /my recipes/i })).toHaveAttribute("href", "/recipes");
  });

  it("returns to sign in when a live session expires", async () => {
    installFakeGoogle();
    vi.spyOn(api, "getPublicConfig").mockResolvedValue({ googleClientId: "client-123" });
    vi.spyOn(api, "getSession").mockResolvedValue({ user: normalUser });

    render(<App />);
    await screen.findByRole("navigation", { name: /main/i });
    window.dispatchEvent(new CustomEvent("cooking-saver:unauthorized"));

    expect(await screen.findByRole("heading", { name: /sign in to cooking saver/i })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("signs out through the server before showing sign in", async () => {
    vi.spyOn(api, "getPublicConfig").mockResolvedValue({ googleClientId: "client-123" });
    vi.spyOn(api, "getSession").mockResolvedValue({ user: normalUser });
    const signOut = vi.spyOn(api, "signOut").mockResolvedValue(undefined);

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: /sign in to cooking saver/i })).toBeVisible();
  });
});
