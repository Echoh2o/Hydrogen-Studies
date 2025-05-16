import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HiMail, HiPhone, HiLocationMarker, HiCheckCircle } from "react-icons/hi";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet";

// Extend the contact schema with validation
const contactSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  message: z.string().min(10, { message: "Message must be at least 10 characters" }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const ContactPage = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent successfully",
        description: "Thank you for contacting us. We'll get back to you soon.",
      });
      setIsSubmitted(true);
    },
    onError: (error) => {
      toast({
        title: "Message could not be sent",
        description: error.message || "There was an error sending your message. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    mutate(data);
  };

  return (
    <>
      <Helmet>
        <title>Contact Us - Hydrogen Studies Research Database</title>
        <meta name="description" content="Contact the Hydrogen Studies team with questions, suggestions, or research submissions. We're here to help with your hydrogen research needs." />
      </Helmet>
      
      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center">Contact Us</h1>
          <p className="text-lg md:text-xl text-center max-w-3xl mx-auto text-white/90">
            Have questions or suggestions? We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
              <p className="text-neutral-600 mb-8">
                We're here to help with any questions about hydrogen research or our database. Whether you're a researcher, healthcare professional, or just interested in the science, we'd love to hear from you.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full w-10 h-10 flex items-center justify-center text-primary mr-4 mt-1">
                    <HiMail size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-800">Email</h3>
                    <p className="text-neutral-600">info@hydrogenstudies.com</p>
                    <p className="text-neutral-600">research@hydrogenstudies.com</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full w-10 h-10 flex items-center justify-center text-primary mr-4 mt-1">
                    <HiPhone size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-800">Phone</h3>
                    <p className="text-neutral-600">+1 (888) 123-4567</p>
                    <p className="text-neutral-600">Mon-Fri, 9:00 AM - 5:00 PM PST</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary/10 rounded-full w-10 h-10 flex items-center justify-center text-primary mr-4 mt-1">
                    <HiLocationMarker size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-800">Address</h3>
                    <p className="text-neutral-600">
                      123 Research Avenue<br />
                      Suite 450<br />
                      San Francisco, CA 94103<br />
                      United States
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardContent className="p-6 md:p-8">
                  {isSubmitted ? (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center text-green-600 mb-4">
                        <HiCheckCircle size={36} />
                      </div>
                      <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                      <p className="text-neutral-600 mb-6 max-w-md">
                        Thank you for contacting us. We've received your message and will respond as soon as possible.
                      </p>
                      <Button onClick={() => setIsSubmitted(false)}>Send Another Message</Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your name" {...field} />
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
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your email address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Your message..." 
                                    className="min-h-[150px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full md:w-auto bg-primary hover:bg-primary-dark"
                            disabled={isPending}
                          >
                            {isPending ? "Sending..." : "Send Message"}
                          </Button>
                        </form>
                      </Form>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 bg-neutral-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-3">How can I submit research for inclusion?</h3>
              <p className="text-neutral-600">
                Researchers can submit published studies for inclusion in our database by emailing the publication details to research@hydrogenstudies.com.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-3">Do you provide research consultation?</h3>
              <p className="text-neutral-600">
                Our team can provide guidance on hydrogen research resources. For specific consultation requests, please contact us directly.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-3">How often is the database updated?</h3>
              <p className="text-neutral-600">
                We update our research database monthly with newly published studies and findings in the field of hydrogen research.
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-3">Can I request specific research topics?</h3>
              <p className="text-neutral-600">
                Yes! We welcome suggestions for research topics or specific studies to include. Please use the contact form to send your requests.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContactPage;
