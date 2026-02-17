import { useEffect, useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageSquare, HelpCircle, Phone, MapPin, Clock, Send } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  phone: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Contact Us - Hydrogen Studies";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Contact Hydrogen Studies for questions, support, or feedback. We're here to help with your hydrogen therapy research needs."
      );
    }
  }, []);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      phone: "",
    },
  });

  const contactMutation = useMutation({
    mutationFn: (data: ContactFormData) => apiRequest("POST", "/api/contact", data),
    onSuccess: () => {
      toast({
        title: "Message sent successfully!",
        description: "We'll get back to you as soon as possible.",
      });
      form.reset();
      setIsSubmitting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    // For now, just show a success message since we don't have a backend endpoint
    // In production, you would send this to your backend
    setTimeout(() => {
      toast({
        title: "Message received!",
        description: "Thank you for contacting us. We'll respond within 24-48 hours.",
      });
      form.reset();
      setIsSubmitting(false);
    }, 1000);
    
    // Uncomment this when you have a backend endpoint:
    // contactMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Have questions about hydrogen therapy research? Need help navigating our database? 
            We're here to help!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Get in Touch</h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-teal-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Email</p>
                    <p className="text-gray-600">info@hydrogenstudies.com</p>
                    <p className="text-sm text-gray-500">For general inquiries</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-5 w-5 text-teal-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Support</p>
                    <p className="text-gray-600">support@hydrogenstudies.com</p>
                    <p className="text-sm text-gray-500">For technical assistance</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <HelpCircle className="h-5 w-5 text-teal-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Research Inquiries</p>
                    <p className="text-gray-600">research@hydrogenstudies.com</p>
                    <p className="text-sm text-gray-500">For research collaboration</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-teal-600 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Response Time</p>
                    <p className="text-gray-600">24-48 hours</p>
                    <p className="text-sm text-gray-500">Monday - Friday</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-teal-50 border-teal-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a href="/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>
                </li>
                <li>
                  <a href="/terms" className="text-teal-600 hover:underline">Terms of Service</a>
                </li>
                <li>
                  <a href="/cookies" className="text-teal-600 hover:underline">Cookie Policy</a>
                </li>
                <li>
                  <a href="/disclaimer" className="text-teal-600 hover:underline">Medical Disclaimer</a>
                </li>
                <li>
                  <a href="/blog" className="text-teal-600 hover:underline">Blog</a>
                </li>
                <li>
                  <a href="/studies" className="text-teal-600 hover:underline">Research Studies</a>
                </li>
              </ul>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Send us a Message</h2>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="John Doe" 
                              {...field}
                              data-testid="input-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="john@example.com" 
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-subject">
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="general">General Inquiry</SelectItem>
                              <SelectItem value="research">Research Question</SelectItem>
                              <SelectItem value="technical">Technical Support</SelectItem>
                              <SelectItem value="collaboration">Collaboration Request</SelectItem>
                              <SelectItem value="feedback">Feedback</SelectItem>
                              <SelectItem value="bug">Report a Bug</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="+1 (555) 123-4567" 
                              {...field}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormDescription>
                            Include for urgent matters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please describe your inquiry in detail..."
                            className="min-h-[150px]"
                            {...field}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide as much detail as possible to help us assist you better
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      * Required fields
                    </p>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="min-w-[150px]"
                      data-testid="button-submit"
                    >
                      {isSubmitting ? (
                        <>Sending...</>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>

            <div className="mt-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> For medical emergencies, please contact your local emergency services immediately. 
                We cannot provide medical advice or diagnosis. Please consult with qualified healthcare professionals 
                for medical concerns.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-12">
          <Card className="p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can you provide medical advice?
                </h3>
                <p className="text-gray-600">
                  No, we cannot provide medical advice. Hydrogen Studies is an educational resource only. 
                  Always consult with qualified healthcare professionals for medical advice, diagnosis, or treatment.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How can I contribute research to your database?
                </h3>
                <p className="text-gray-600">
                  We welcome research contributions! Please contact us at research@hydrogenstudies.com 
                  with details about your study, and our team will review it for inclusion in our database.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Is my personal information secure?
                </h3>
                <p className="text-gray-600">
                  Yes, we take data security seriously. Please review our{" "}
                  <a href="/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>{" "}
                  to learn how we protect and use your information.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How often is the research database updated?
                </h3>
                <p className="text-gray-600">
                  Our research database is continuously updated as new studies become available. 
                  We regularly monitor scientific journals and research institutions for the latest 
                  hydrogen therapy research.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}