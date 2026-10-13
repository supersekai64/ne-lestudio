import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le Studio — Nouvelle Énergie",
  description: "Créez vos visuels Nouvelle Énergie pour les réseaux sociaux. Choisissez un modèle, personnalisez-le et partagez vos idées.",
  robots: { index: false, follow: false, noimageindex: true, nosnippet: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
