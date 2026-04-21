import { Fragment } from "react";
import { Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbItemDef {
  /** Display label */
  label: string;
  /** Link target. Omit on the last item (current page). */
  href?: string;
}

interface AdminBreadcrumbsProps {
  /** Items after "Admin" — e.g. `[{ label: "Studies", href: "/admin/studies" }, { label: "Edit" }]` */
  items: BreadcrumbItemDef[];
  className?: string;
}

/**
 * Consistent breadcrumb for admin detail/edit pages. Always prepends "Admin"
 * linking to /admin so users can get home in one click.
 *
 * Usage:
 *   <AdminBreadcrumbs items={[
 *     { label: "Studies", href: "/admin/studies" },
 *     { label: "Edit" },
 *   ]} />
 */
export function AdminBreadcrumbs({ items, className }: AdminBreadcrumbsProps) {
  const full: BreadcrumbItemDef[] = [
    { label: "Admin", href: "/admin" },
    ...items,
  ];

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {full.map((item, i) => {
          const isLast = i === full.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
