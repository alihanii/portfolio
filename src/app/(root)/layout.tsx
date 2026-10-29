export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ background: "#070505" }}>{children}</body>
    </html>
  );
}
