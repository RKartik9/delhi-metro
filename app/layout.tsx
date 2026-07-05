import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delhi Metro 3D",
  description:
    "Interactive 3D visualization of the Delhi Metro network — explore lines, stations, and trains in a live digital twin.",
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: some browser extensions inject attributes on
          <body> before hydration, which would otherwise trigger a mismatch. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
