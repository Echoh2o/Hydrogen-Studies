export interface NavLink {
  href: string;
  label: string;
}

export const studyLinks: NavLink[] = [
  { href: "/studies", label: "All Studies" },
  { href: "/recent-studies", label: "Recent Studies" },
  { href: "/explore-by-condition", label: "By Health Condition" },
  { href: "/explore-by-body-system", label: "By Body System" },
  { href: "/explore-by-life-stage", label: "By Life Stage" },
  { href: "/explore-by-delivery-method", label: "By Delivery Method" },
  { href: "/explore-by-benefit", label: "By Health Benefit" },
  { href: "/research-analytics", label: "Research Insights" },
];

export const mainLinks: NavLink[] = [
  { href: "/blog", label: "Blog" },
  { href: "/benefits", label: "Benefits" },
  { href: "/research-analytics", label: "Analytics" },
  { href: "/products", label: "Products" },
];
