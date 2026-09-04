import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Ceramica Lead Generator",
  description: "Internal lead-generation platform for Ceramica Dental Lab",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Nav />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
      </body>
    </html>
  );
}
