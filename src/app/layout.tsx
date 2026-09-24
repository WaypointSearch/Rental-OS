import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import { LANG_COOKIE } from '@/lib/i18n/config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Rental OS | Sun Ocean Realty',
  description: 'Rental lead operations, assignment and agent CRM for Sun Ocean Realty.',
  themeColor: '#06111f',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get(LANG_COOKIE)?.value === 'es' ? 'es' : 'en'
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  )
}
