import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Heart, Users, Droplet } from "lucide-react";

const browseOptions = [
  {
    title: "Health Benefits",
    description:
      "Explore research by specific health benefits like improved cognitive function, reduced inflammation, enhanced athletic performance, and more.",
    icon: <Heart className="h-8 w-8 text-primary" />,
    href: "/benefits",
    color: "bg-red-50",
  },
  {
    title: "Demographics",
    description:
      "Find studies focused on specific groups such as athletes, elderly, children, those with specific conditions, and more.",
    icon: <Users className="h-8 w-8 text-primary" />,
    href: "/demographics",
    color: "bg-blue-50",
  },
  {
    title: "Mechanisms of Action",
    description:
      "Understand how hydrogen works in the body through various pathways such as antioxidant effects, cell signaling, gene expression, and more.",
    icon: <Brain className="h-8 w-8 text-primary" />,
    href: "/mechanisms",
    color: "bg-green-50",
  },
  {
    title: "Delivery Methods",
    description:
      "Compare research using different hydrogen delivery methods including hydrogen water, gas inhalation, saline injection, and our Echo Flask.",
    icon: <Droplet className="h-8 w-8 text-primary" />,
    href: "/delivery-methods",
    color: "bg-purple-50",
  },
];

export default function BrowseOptionsSection() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Explore Hydrogen Research Your Way
          </h2>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Discover hydrogen studies organized by what matters most to you -
            from health benefits to delivery methods
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {browseOptions.map((option, index) => (
            <Card
              key={index}
              className="border-none shadow-md hover:shadow-lg transition-shadow duration-300"
            >
              <CardHeader className={`${option.color} rounded-t-lg`}>
                <div className="flex justify-center py-4">{option.icon}</div>
              </CardHeader>
              <CardContent className="pt-6">
                <CardTitle className="text-xl mb-2">{option.title}</CardTitle>
                <CardDescription className="text-sm text-neutral-600 mb-4">
                  {option.description}
                </CardDescription>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={option.href}>Explore Now</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
