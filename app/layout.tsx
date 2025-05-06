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
  title: "Zombie Survival Game",
  description: "A survival game built with Next.js and React Three Fiber",
  generator: 'v0.dev'
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
