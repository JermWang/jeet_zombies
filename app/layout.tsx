import type React from "react"
import "@/utils/r3f-patch"
import "./globals.css"
import { Press_Start_2P, VT323 } from "next/font/google"
import SolanaProviders from "@/components/SolanaProviders"
import NavBar from "@/components/NavBar"

// Define fonts
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
})

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
})

export const metadata = {
  title: "JEET SURVIVAL",
  description: "HOLY SHIT! thats alotta jeets!",
  metadataBase: new URL('https://jeetsurvival.fun'),
  openGraph: {
    title: "JEET SURVIVAL",
    description: "HOLY SHIT! thats alotta jeets!",
    url: 'https://jeetsurvival.fun',
    images: [
      {
        url: '/jeetsurvival.jpg', // Relative to metadataBase
        width: 1200, // Optional: Specify image width
        height: 630, // Optional: Specify image height
        alt: 'JEET SURVIVAL Social Share Image',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "JEET SURVIVAL",
    description: "HOLY SHIT! thats alotta jeets!",
    images: ['/jeetsurvival.jpg'], // Relative to metadataBase, or absolute URL
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${pressStart.variable} ${vt323.variable} bg-black text-white antialiased`}>
        <SolanaProviders>
          <NavBar />
          {children}
        </SolanaProviders>
      </body>
    </html>
  )
}
