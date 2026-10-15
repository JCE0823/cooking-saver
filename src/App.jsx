import { useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { clearCredentials } from "./api.js";
import { SignIn } from "./components/SignIn.jsx";
import { SearchPage } from "./pages/SearchPage.jsx";
import { RecipesPage } from "./pages/RecipesPage.jsx";

export function App() {
  const [signedIn, setSignedIn] = useState(false);

  function signOut() {
    clearCredentials();
    setSignedIn(false);
  }

  return (
    <BrowserRouter>
      {signedIn ? (
        <div>
          <header>
            <nav aria-label="Main navigation">
              <NavLink to="/" end>Search</NavLink>
              <NavLink to="/recipes">My Recipes</NavLink>
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
      ) : <SignIn onSignedIn={() => setSignedIn(true)} />}
    </BrowserRouter>
  );
}
