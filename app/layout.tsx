import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deribet",
  description: "Claim your $LUCK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
