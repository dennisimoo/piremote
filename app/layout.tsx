import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BlackBox",
  description: "Remote Raspberry Pi management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css"
        />
      </head>
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
