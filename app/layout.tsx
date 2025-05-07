import type React from "react"
import "@/utils/r3f-patch"
import "./globals.css"
import { Press_Start_2P, VT323 } from "next/font/google"

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
  title: "JEET ZOMBIES",
  description: "HOLY SHIT! thats alotta jeets!",
  metadataBase: new URL('https://jeetzombies.xyz'),
  openGraph: {
    title: "JEET ZOMBIES",
    description: "HOLY SHIT! thats alotta jeets!",
    url: 'https://jeetzombies.xyz',
    images: [
      {
        url: '/jeetzombies.jpg', // Relative to metadataBase
        width: 1200, // Optional: Specify image width
        height: 630, // Optional: Specify image height
        alt: 'JEET ZOMBIES Social Share Image',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "JEET ZOMBIES",
    description: "HOLY SHIT! thats alotta jeets!",
    images: ['/jeetzombies.jpg'], // Relative to metadataBase, or absolute URL
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
        {children}
      </body>
    </html>
  )
}
