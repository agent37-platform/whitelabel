import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { branding } from "@/config/branding";

export const metadata: Metadata = {
  title: branding.appName,
  description: `${branding.appName} — managed AI agents`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
