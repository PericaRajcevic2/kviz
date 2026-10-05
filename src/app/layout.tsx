import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Balkan na sluh — Kviz balkanske muzike",
  description:
    "Jedna sekunda. Poznat zvuk. Znaš li pjesmu? Pogodi balkanske hitove u dnevnom izazovu ili igraj svoj miks.",
  openGraph: {
    title: "Balkan na sluh",
    description:
      "Prepoznaj balkanski hit iz samo jedne sekunde. Pet pjesama, jedan dnevni izazov.",
    locale: "hr_HR",
    type: "website",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5ef",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bs">
      <body>{children}</body>
    </html>
  );
}
