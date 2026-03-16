import { Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import JsonLd, { generateBreadcrumbSchema } from "@/components/seo/JsonLd";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation with JSON-LD structured data.
 * Renders both visible breadcrumbs and BreadcrumbList schema for SEO.
 */
export default function PageBreadcrumb({ items, className }: PageBreadcrumbProps) {
  const schemaItems = items.map((item) => ({
    name: item.label,
    url: item.href
      ? `https://hydrogenstudies.com${item.href}`
      : "https://hydrogenstudies.com",
  }));

  return (
    <>
      <JsonLd type="BreadcrumbList" data={generateBreadcrumbSchema(schemaItems)} />
      <Breadcrumb className={className}>
        <BreadcrumbList>
          {items.map((item, index) => (
            <span key={index} className="inline-flex items-center gap-1.5">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === items.length - 1 ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || "/"}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
