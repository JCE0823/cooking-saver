import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import * as api from "./api.js";
import { GoogleSignIn } from "./components/GoogleSignIn.jsx";
import { SearchPage } from "./pages/SearchPage.jsx";
import { RecipesPage } from "./pages/RecipesPage.jsx";

export function App() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      setStatus("loading");
      setError("");
      try {
        const config = await api.getPublicConfig();
        if (!active) return;
        setGoogleClientId(config.googleClientId);

        const session = await api.getSession();
        if (!active) return;
        setUser(session?.user ?? null);
        setStatus(session?.user ? "signedIn" : "signedOut");
      } catch (requestError) {
        if (!active) return;
        setUser(null);
        if (requestError.status === 401) {
          setStatus("signedOut");
        } else {
          setStatus("error");
          setError("We couldn’t check your session right now. Please try again.");
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, [retryToken]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setStatus("signedOut");
      setError("Your session expired. Sign in again.");
    }

    window.addEventListener("cooking-saver:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("cooking-saver:unauthorized", handleUnauthorized);
  }, []);

  async function signOut() {
    setError("");
    try {
      await api.signOut();
      setUser(null);
      setStatus("signedOut");
    } catch {
      setError("We couldn’t sign you out right now. Please try again.");
    }
  }

  if (status === "loading") {
    return <p role="status" className="app-status">Checking your session…</p>;
  }

  if (status === "error") {
    return (
      <main className="sign-in-page">
        <section className="sign-in-card" aria-labelledby="session-error-heading">
          <h1 id="session-error-heading">Cooking Saver</h1>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRetryToken((token) => token + 1)}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      {status === "signedIn" && user ? (
        <div>
          <header>
            <nav aria-label="Main navigation">
              <NavLink to="/" end>Search</NavLink>
              <NavLink to="/recipes">My Recipes</NavLink>
              <span className="signed-in-user">
                {user.pictureUrl ? (
                  <img
                    src={user.pictureUrl}
                    alt={`${user.displayName} profile picture`}
                    className="profile-image"
                  />
                ) : null}
                <span>{user.displayName}</span>
                <span className="user-role">Role: {user.role}</span>
              </span>
              <button type="button" onClick={signOut}>Sign Out</button>
            </nav>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
            </Routes>
          </main>
        </div>
      ) : (
        <>
          {error ? <p role="alert" className="session-message">{error}</p> : null}
          <GoogleSignIn
            googleClientId={googleClientId}
            onSignedIn={(signedInUser) => {
              setError("");
              setUser(signedInUser);
              setStatus("signedIn");
            }}
          />
        </>
      )}
    </BrowserRouter>
  );
}
