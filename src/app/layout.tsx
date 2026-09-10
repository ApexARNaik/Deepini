import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { PasswordGate } from "@/components/PasswordGate";
import { AppShell } from "@/components/AppShell";
import { NetworkProvider } from "@/components/NetworkProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Deepini - Personal Component Archive",
  description: "A visual map of your components, storage, and projects",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deepini",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} dark h-full`}>
      <body className="antialiased text-brand-text bg-brand-bg font-sans h-full w-full overflow-hidden flex flex-col">
        <NetworkProvider>
          <PasswordGate>
            <AppShell>
              {children}
            </AppShell>
          </PasswordGate>
        </NetworkProvider>
      </body>
    </html>
  );
}
