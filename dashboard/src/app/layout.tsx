import type { Metadata, Viewport } from "next";
import { Saira, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWARegister } from "@/components/PWARegister";

// Display técnico condensado — títulos, KPIs, eyebrows
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Mono para lecturas numéricas (se leen como en un tablero)
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Body limpio
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Centinelas · Telemetría",
  description:
    "Panel de operaciones de la maleta de conectividad móvil (ESP32 · Starlink · EcoFlow).",
  applicationName: "Suspensiones · Telemetría",
  appleWebApp: { capable: true, title: "SC Telemetría", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  width: "device-width",
  initialScale: 1,
};

// Evita el flash de tema: aplica data-theme antes del primer paint.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        <PWARegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
