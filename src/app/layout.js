import "./globals.css";

export const metadata = {
  title: "Groq Chat Prototype",
  description: "Chat UI prototype with Groq usage metrics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
