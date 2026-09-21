import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSpanishWebinarPage = (await headers()).get("x-current-path") === "/webinar-es";

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${dmSans.variable} ${roboto.variable} h-full antialiased`}
    >
      {isSpanishWebinarPage && (
        <Script
          id="google-tag-manager"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KBSNDJDD');`,
          }}
        />
      )}
      <body className="min-h-full flex flex-col">
        {isSpanishWebinarPage && (
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-KBSNDJDD"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {children}
      </body>
    </html>
  );
}
