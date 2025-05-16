import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email is required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      await apiRequest("POST", "/api/newsletter/subscribe", { email });
      
      toast({
        title: "Subscription successful!",
        description: "You've been subscribed to our newsletter.",
      });
      
      setEmail("");
    } catch (error) {
      toast({
        title: "Subscription failed",
        description: "Unable to subscribe. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-12 bg-primary-gradient text-white">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="text-3xl font-bold font-heading mb-4">Stay Updated on Hydrogen Research</h2>
        <p className="opacity-90 mb-8">Subscribe to receive notifications about newly published studies and research breakthroughs.</p>
        <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleNewsletterSignup}>
          <Input
            type="email"
            placeholder="Your email address"
            className="flex-grow px-4 py-3 rounded-lg text-neutral-800 focus:outline-none focus:ring-2 focus:ring-secondary h-auto"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button 
            type="submit" 
            className="bg-secondary text-white hover:bg-secondary/90 whitespace-nowrap"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Subscribing..." : "Subscribe Now"}
          </Button>
        </form>
        <p className="text-sm opacity-75 mt-4">We respect your privacy and will never share your information.</p>
      </div>
    </section>
  );
}
