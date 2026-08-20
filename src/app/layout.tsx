import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { PasswordGate } from "@/components/PasswordGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Deepini - Personal Component Archive",
  description: "A visual map of your components, storage, and projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased text-brand-text bg-brand-bg font-sans">
        <PasswordGate>
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
