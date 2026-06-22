import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/queries";
import { PHProvider } from "./providers";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Essential Space",
  description: "Premium digital canvas for capturing, archiving, and categorizing drag-and-drop assets",
  icons: {
    icon: "/essential_space_logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const theme = user?.theme || user?.selectedTheme || "light-gold";

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`} data-theme={theme}>
      <body className="antialiased bg-background text-foreground font-sans">
        <PHProvider>{children}</PHProvider>
      </body>
    </html>
  );
}

