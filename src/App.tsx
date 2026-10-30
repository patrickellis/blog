import { CompareSection } from './components/CompareSection'
import { CountryDrawer } from './components/CountryDrawer'
import { GlobePanel } from './components/globe/GlobePanel'
import { Header } from './components/Header'
import { Insights } from './components/Insights'
import { Methodology } from './components/Methodology'
import { ProfilePanel } from './components/ProfilePanel'
import { RankingsTable } from './components/RankingsTable'

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.05),transparent_50%)]">
      <Header />
      <main className="mx-auto max-w-[1600px] space-y-12 px-4 py-6 sm:px-6 sm:py-8">
        <div id="explore" className="space-y-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Where does your money <span className="bg-gradient-to-r from-cyan-300 to-amber-300 bg-clip-text text-transparent">work hardest?</span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-400">
              Compare take-home pay, capital gains, dividend and wealth taxes, and the real cost of living across the world’s most popular expat destinations —
              whether you’re moving for a salary or relocating your wealth.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
            <ProfilePanel />
            <GlobePanel />
          </div>
          <Insights />
        </div>
        <CompareSection />
        <RankingsTable />
        <Methodology />
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Expat Compass · Indicative estimates only, not tax advice · Inspired by OfferCompare
      </footer>
      <CountryDrawer />
    </div>
  )
}
