import './globals.css'
import NavBar from './components/NavBar'

export const metadata = {
  title: 'Customer Account Dashboard',
  description: 'Facility, project and communications tracker for a multi-site customer account.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
