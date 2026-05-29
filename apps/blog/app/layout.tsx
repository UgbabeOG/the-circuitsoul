import React from 'react';
import '@circuitsoul/ui/src/styles.css';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
