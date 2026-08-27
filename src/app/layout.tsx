import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora, DM_Sans, Roboto } from "next/font/google";
import "./globals.css";
import { SITE_TITLE } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Identidade "estúdio de TV" das páginas do lead (cadastro/sala):
// Sora = display dos títulos; DM Sans = corpo. Admin segue no Geist.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
});

// Tema "player" (vermelho/branco com leitura de vídeo): Roboto é a fonte
// que dá a cara de player de vídeo. Usada só sob .hw-theme.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Nome da instalação (env NEXT_PUBLIC_SITE_TITLE) — nada hardcoded.
  title: SITE_TITLE,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${dmSans.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
