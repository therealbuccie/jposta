import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@jposta/ui/styles.css";

export const metadata: Metadata = {
  title: "JPosta",
  description: "Modern business email hosting.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
