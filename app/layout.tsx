import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PiRemote",
  description: "Remote Raspberry Pi management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
