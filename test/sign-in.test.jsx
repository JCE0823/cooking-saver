import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.jsx";
import { clearCredentials, listRecipes } from "../src/api.js";

afterEach(() => {
  cleanup();
  clearCredentials();
  vi.restoreAllMocks();
});

describe("sign in", () => {
  it("verifies credentials against the protected recipes endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
    );
    const localStorageSpy = vi.spyOn(window.localStorage, "setItem");
    const sessionStorageSpy = vi.spyOn(window.sessionStorage, "setItem");

    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: /sign in to cooking saver/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/username/i), "student");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/recipes",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Basic ${btoa("student:secret")}` })
      })
    );
    expect(await screen.findByRole("link", { name: /search/i })).toBeInTheDocument();
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });

  it("shows a helpful error for incorrect credentials without using browser storage", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "authentication_required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    const localStorageSpy = vi.spyOn(window.localStorage, "setItem");
    const sessionStorageSpy = vi.spyOn(window.sessionStorage, "setItem");

    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/username/i), "student");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/username or password is incorrect/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();

    await expect(listRecipes()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it("clears credentials and restores the sign-in gate on Sign Out", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
    ));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/username/i), "student");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await user.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(screen.getByRole("heading", { name: /sign in to cooking saver/i })).toBeInTheDocument();
    await listRecipes();
    expect(fetchMock.mock.calls.at(-1)[1].headers.Authorization).toBeUndefined();
  });
});
