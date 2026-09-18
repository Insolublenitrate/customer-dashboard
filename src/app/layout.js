import { Inter } from 'next/font/google'
import './globals.css'
import NavBar from './components/NavBar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'Customer Account Dashboard',
  description: 'Facility, project and communications tracker for a multi-site customer account.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#08090c',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
