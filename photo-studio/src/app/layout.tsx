import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TwinShoot Studio",
  description: "Votre séance photo professionnelle à la demande, avec votre jumelle IA.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf7f2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
