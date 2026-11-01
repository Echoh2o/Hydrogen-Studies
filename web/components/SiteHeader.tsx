// Server-rendered header. Plain links (no client JS); account actions live
// on the SPA routes (/login, /register) which Express still serves.
const NAV = [
  { href: "/studies", label: "Studies" },
  { href: "/blog", label: "Blog" },
  { href: "/learn", label: "Learn" },
  { href: "/explore-by-condition", label: "Explore" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="/" className="flex flex-col leading-tight" aria-label="Hydrogen Studies home">
          <span className="text-lg font-bold tracking-wide text-neutral-900">HYDROGEN STUDIES</span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-primary">POWERED BY ECHO WATER</span>
        </a>
        <nav aria-label="Main" className="hidden gap-6 text-sm font-medium text-neutral-700 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-primary">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <a href="/login" className="rounded-md border border-primary px-3 py-1.5 text-primary hover:bg-primary/5">
            Login
          </a>
          <a href="/register" className="hidden rounded-md bg-primary px-3 py-1.5 text-white hover:bg-secondary sm:inline">
            Sign Up
          </a>
        </div>
      </div>
    </header>
  );
}
