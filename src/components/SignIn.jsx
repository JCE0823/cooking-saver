import { useState } from "react";
import { verifyCredentials } from "../api.js";

export function SignIn({ onSignedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      await verifyCredentials(username, password);
      onSignedIn();
    } catch (requestError) {
      setStatus("idle");
      setError(requestError.status === 401
        ? "The username or password is incorrect."
        : "We couldn’t sign you in right now. Please try again.");
      return;
    }

    setStatus("idle");
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-heading">
        <h1 id="sign-in-heading">Sign in to Cooking Saver</h1>
        <p>Use your shared Cooking Saver account to continue.</p>
        <form onSubmit={submit}>
          <label htmlFor="sign-in-username">Username</label>
          <input
            id="sign-in-username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="sign-in-password">Password</label>
          <input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
