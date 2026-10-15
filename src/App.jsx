import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { SearchPage } from "./pages/SearchPage.jsx";
import { RecipesPage } from "./pages/RecipesPage.jsx";

export function App() {
  return (
    <BrowserRouter>
      <div>
        <header>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>Search</NavLink>
            <NavLink to="/recipes">My Recipes</NavLink>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
