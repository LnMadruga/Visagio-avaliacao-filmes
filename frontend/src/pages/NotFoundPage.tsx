import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page state-message">
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/">Voltar para o catálogo</Link>
      </p>
    </div>
  );
}
