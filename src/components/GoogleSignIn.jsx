import { useEffect, useRef, useState } from "react";
import * as api from "../api.js";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let googleScriptPromise;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise.then(() => {
    if (!window.google?.accounts?.id) {
      throw new Error("Google Identity Services did not load.");
    }
  });
}

export function GoogleSignIn({ googleClientId, onSignedIn }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    setError("");
    setStatus("loading");

    loadGoogleIdentityScript()
      .then(() => {
        if (!active || !buttonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setStatus("loading");
            setError("");
            try {
              const { user } = await api.signInWithGoogle(credential);
              if (active) {
                onSignedIn(user);
                setStatus("ready");
              }
            } catch {
              if (active) {
                setStatus("error");
                setError("Google sign-in failed. Please try again.");
              }
            }
          }
        });
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill"
        });
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setStatus("error");
          setError("Google sign-in is unavailable right now. Please try again.");
        }
      });

    return () => {
      active = false;
      buttonRef.current?.replaceChildren();
    };
  }, [googleClientId, onSignedIn]);

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-heading">
        <h1 id="sign-in-heading">Sign in to Cooking Saver</h1>
        <p>Use your Google account to continue.</p>
        {error ? <p role="alert">{error}</p> : null}
        <div
          ref={buttonRef}
          className="google-sign-in"
          aria-busy={status === "loading"}
        />
        {status === "error" ? <p>Refresh the page to retry Google sign-in.</p> : null}
      </section>
    </main>
  );
}
