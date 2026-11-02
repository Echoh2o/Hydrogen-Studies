import { SiteHeader } from "@web/components/SiteHeader";
import { SiteFooter } from "@web/components/SiteFooter";

export const metadata = { title: { absolute: "Page Not Found | Hydrogen Studies" }, robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-4 text-3xl font-bold text-neutral-900">Page not found</h1>
        <p className="mb-6 text-neutral-700">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <p className="space-x-4">
          <a href="/studies" className="text-primary underline">Browse all studies</a>
          <a href="/blog" className="text-primary underline">Read the blog</a>
          <a href="/explore-by-condition" className="text-primary underline">Explore by condition</a>
        </p>
      </main>
      <SiteFooter conditions={[]} pageType="404" slug="not-found" />
    </>
  );
}
