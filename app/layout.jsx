import "./global.css";

export const metadata = {
  title: "SoftwareVault",
  description: "A compact vault of curated tools for apps, games, utilities, media, and developers.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "shortcut icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/favicon.svg" }
  ],
  openGraph: {
    title: "SoftwareVault",
    description: "A compact vault of curated tools for apps, games, utilities, media, and developers.",
    type: "website",
    images: ["/favicon.svg"]
  },
  twitter: {
    card: "summary",
    title: "SoftwareVault",
    description: "A compact vault of curated tools for apps, games, utilities, media, and developers.",
    images: ["/favicon.svg"]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}