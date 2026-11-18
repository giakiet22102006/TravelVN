export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-nunito-sans bg-admin-bg text-admin-text min-h-screen">
      {children}
    </div>
  );
}
