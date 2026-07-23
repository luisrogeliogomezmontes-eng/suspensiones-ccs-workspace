import type { Metadata, Viewport } from "next";
import { Saira, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const saira = Saira({ variable: "--font-saira", subsets: ["latin"], weight: ["500", "600", "700"] });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Producción · Centinelas",
  description: "Tablero de fabricación (comandas), tiempos por etapa y disponibilidad de inventario.",
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${saira.variable} ${jetbrains.variable} ${inter.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">
        <Nav />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-5 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
