import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Memecoin Screener",
  description:
    "Discovery-, Screening- und Risk-System für Solana-Memecoins mit Push-Alerts. Kein Prediktor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface/70 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              <span className="text-accent">◎</span> Memecoin Screener
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-foreground transition-colors">
                Screener
              </Link>
              <Link href="/watchlist" className="hover:text-foreground transition-colors">
                Watchlist
              </Link>
              <Link href="/alerts" className="hover:text-foreground transition-colors">
                Alerts
              </Link>
            </nav>
            <span className="ml-auto hidden sm:block text-xs text-muted">
              Solana · DexScreener + RugCheck
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted leading-relaxed">
            Kein Prediktor: Dieses Tool sagt keine Gewinner voraus. Es filtert schneller und wirft
            offensichtlichen Müll raus. Ein grüner Safety-Score bedeutet nur „kein sofortiges
            Rug-Signal aus den verfügbaren Daten erkennbar" — niemals „sicher". Keine
            Anlageberatung.
          </div>
        </footer>
      </body>
    </html>
  );
}
