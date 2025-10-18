import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Rift Rewind | Your Season, Your Story",
  description: "AI-powered League of Legends year-end recap. Get personalized insights, champion personality analysis, and shareable stats powered by AWS Bedrock and Claude AI.",
  keywords: ["League of Legends", "LoL", "Riot Games", "AWS Bedrock", "AI recap", "champion mastery", "match history", "gaming stats"],
  authors: [{ name: "Jose Angel Rodriguez" }],
  creator: "Jose Angel Rodriguez",
  icons: {
    icon: "/Rift-rewind-logo.png",
    apple: "/Rift-rewind-logo.png",
  },
  openGraph: {
    title: "Rift Rewind | Your Season, Your Story",
    description: "AI-powered League of Legends year-end recap with personalized insights and champion analysis.",
    url: "https://rift-recap.vercel.app/",
    siteName: "Rift Rewind",
    images: [
      {
        url: "/Rift-rewind-logo.jpg",
        width: 1200,
        height: 630,
        alt: "Rift Rewind Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rift Rewind | Your Season, Your Story",
    description: "AI-powered League of Legends year-end recap with personalized insights.",
    images: ["/Rift-rewind-logo.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
