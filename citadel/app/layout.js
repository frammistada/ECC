import { Fraunces, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Citadel",
  description: "An evening reflection, and an honest reply.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <body className="bg-night font-body text-parchment antialiased">
        <div
          aria-hidden="true"
          className="wavy-frame pointer-events-none fixed inset-0 z-50"
        />
        {children}
      </body>
    </html>
  );
}
