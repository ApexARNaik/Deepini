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
      <body className="antialiased text-brand-text bg-brand-bg font-sans h-full overflow-hidden flex">
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
