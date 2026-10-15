import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleSignIn } from "../src/components/GoogleSignIn.jsx";
import * as api from "../src/api.js";

afterEach(() => {
  cleanup();
  delete window.google;
  vi.restoreAllMocks();
});

function installFakeGoogle() {
  let callback;
  window.google = {
    accounts: {
      id: {
        initialize: (options) => {
          callback = options.callback;
        },
        renderButton: (container) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Continue with Google";
          button.addEventListener("click", () => callback({ credential: "fake-google-credential" }));
          container.append(button);
        }
      }
    }
  };
}

describe("Google sign in", () => {
  it("sends the Google credential to the server without storing it", async () => {
    installFakeGoogle();
    const signIn = vi.spyOn(api, "signInWithGoogle").mockResolvedValue({
      user: {
        id: 2,
        email: "user@example.com",
        displayName: "Normal User",
        pictureUrl: null,
        role: "user"
      }
    });

    render(<GoogleSignIn googleClientId="client-123" onSignedIn={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("fake-google-credential");
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("shows a stable retry message when Google sign in fails", async () => {
    installFakeGoogle();
    vi.spyOn(api, "signInWithGoogle").mockRejectedValue(new Error("offline"));

    render(<GoogleSignIn googleClientId="client-123" onSignedIn={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/google sign-in failed/i);
    expect(screen.getByText(/refresh the page to retry/i)).toBeVisible();
  });
});
