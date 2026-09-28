import { Link, Route, Routes } from "react-router-dom";
import { CatalogPage } from "./pages/CatalogPage";
import { MovieDetailPage } from "./pages/MovieDetailPage";
import { MovieFormPage } from "./pages/MovieFormPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-header__brand">
          Visagio
          <span className="app-header__brand-subtitle">Catálogo de filmes</span>
        </Link>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/filmes/novo" element={<MovieFormPage />} />
          <Route path="/filmes/:id" element={<MovieDetailPage />} />
          <Route path="/filmes/:id/editar" element={<MovieFormPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
