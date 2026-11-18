import Link from "next/link";
import { SearchX } from "lucide-react";

export default function SlugNotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-sm text-center">
        <SearchX className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Simulador não encontrado</h1>
        <p className="mt-2 text-sm text-slate-500">
          Confira se o link está correto ou peça um novo link para o seu consultor de energia solar.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-slate-700 underline">
          Ir para a página inicial
        </Link>
      </div>
    </main>
  );
}
