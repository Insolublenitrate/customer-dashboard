import './globals.css'

export const metadata = {
  title: 'Manufacturing Leads Dashboard',
  description: 'Premium dashboard for tracking CNC manufacturing customer leads.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
