import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { DataProvider } from "@/lib/DataProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Rubik was originally commissioned with first-class Hebrew glyph coverage, so
// Latin and Hebrew text share one consistent typeface instead of Hebrew silently
// falling back to a system font while English uses the custom one.
const rubik = Rubik({ subsets: ["latin", "hebrew"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CinemaScope IL — Movie showtimes across Israel",
  description:
    "Find movie showtimes near you across Israeli cinema chains — Cinema City, Yes Planet, Rav-Hen, Lev Cinemas, Hot Cinema and more. Compare price, language, and format in one search.",
};

const NO_FLASH_SCRIPT = `
try {
  var locale = window.localStorage.getItem('cinemascope.locale') || 'he';
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
} catch (e) {}
`;

// This layout itself fetches nothing — DataProvider fetches the dataset
// client-side, once per tab session, from /api/dataset. That keeps a plain
// full-page reload cheap (no server-side re-serialization of the whole
// dataset through the React tree on every request).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className={`${rubik.variable} flex min-h-screen flex-col font-sans`}>
        <LanguageProvider>
          <DataProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </DataProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
