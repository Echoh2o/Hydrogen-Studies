import { useEffect } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy - Hydrogen Studies";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Privacy Policy for Hydrogen Studies. Learn how we collect, use, and protect your personal information."
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <SiteHeader />
      
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-8 shadow-lg bg-white">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                Welcome to Hydrogen Studies ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
              </p>
              <p className="text-gray-700 mb-4">
                Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Personal Information You Provide</h3>
              <p className="text-gray-700 mb-4">
                We collect personal information that you voluntarily provide when you:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Register for an account</li>
                <li>Subscribe to our newsletter</li>
                <li>Contact us through our contact form</li>
                <li>Participate in surveys or research</li>
                <li>Comment on blog posts or studies</li>
              </ul>
              <p className="text-gray-700 mb-4">
                This information may include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Name (first and last)</li>
                <li>Email address</li>
                <li>Username and password</li>
                <li>Professional information (for researchers)</li>
                <li>Any other information you choose to provide</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Information Automatically Collected</h3>
              <p className="text-gray-700 mb-4">
                When you visit our website, we automatically collect certain information about your device and browsing activity:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Referring website</li>
                <li>Pages visited on our site</li>
                <li>Time and date of visit</li>
                <li>Time spent on pages</li>
                <li>Other diagnostic data</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Use of Cookies and Tracking Technologies</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Cookies We Use</h3>
              <p className="text-gray-700 mb-4">
                We use cookies and similar tracking technologies to track activity on our website and hold certain information. Cookies are files with small amounts of data that are sent to your browser from a website and stored on your device.
              </p>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Essential Cookies</h4>
              <p className="text-gray-700 mb-4">
                These cookies are necessary for the website to function properly and cannot be switched off. They include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Session cookies for user authentication</li>
                <li>Security cookies for fraud prevention</li>
                <li>Preference cookies to remember your settings</li>
              </ul>

              <h4 className="text-lg font-semibold text-gray-900 mb-2">Analytics Cookies</h4>
              <p className="text-gray-700 mb-4">
                We use Google Analytics to understand how visitors interact with our website. These cookies collect information in an aggregated form, including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Number of visitors</li>
                <li>Pages visited</li>
                <li>Traffic sources</li>
                <li>User behavior patterns</li>
              </ul>

              <h4 className="text-lg font-semibold text-gray-900 mb-2">Functional Cookies</h4>
              <p className="text-gray-700 mb-4">
                These cookies enable enhanced functionality and personalization, such as:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Remembering your preferences</li>
                <li>Customizing content based on your interests</li>
                <li>Providing personalized recommendations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Third-Party Services</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">OpenAI API</h3>
              <p className="text-gray-700 mb-4">
                We use OpenAI's API services to provide AI-powered features such as:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>AI chat assistant for research queries</li>
                <li>Content generation and summarization</li>
                <li>Study analysis and insights</li>
              </ul>
              <p className="text-gray-700 mb-4">
                When you use these features, your queries and interactions are processed by OpenAI in accordance with their privacy policy. We do not share your personal identification information with OpenAI beyond what is necessary for the service to function.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Google Analytics</h3>
              <p className="text-gray-700 mb-4">
                We use Google Analytics to analyze website traffic and usage patterns. Google Analytics collects information about your use of our website using cookies. This information is transmitted to and stored by Google on servers in the United States. Google uses this information to evaluate your use of our website, compile reports on website activity, and provide other services relating to website activity and internet usage.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Other Third-Party Services</h3>
              <p className="text-gray-700 mb-4">
                We may also use the following third-party services:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>SendGrid for email communications</li>
                <li>PostgreSQL database hosted on Neon for data storage</li>
                <li>Replit for hosting and deployment</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. How We Use Your Information</h2>
              <p className="text-gray-700 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Provide, operate, and maintain our website and services</li>
                <li>Improve, personalize, and expand our website</li>
                <li>Understand and analyze how you use our website</li>
                <li>Develop new products, services, features, and functionality</li>
                <li>Communicate with you, including for customer service and support</li>
                <li>Send you newsletters and updates (with your consent)</li>
                <li>Process your transactions and manage your account</li>
                <li>Find and prevent fraud and respond to security issues</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Storage and Security</h2>
              <p className="text-gray-700 mb-4">
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Secure password hashing using bcrypt</li>
                <li>Regular security audits and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
                <li>Secure hosting infrastructure with regular backups</li>
              </ul>
              <p className="text-gray-700 mb-4">
                However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Privacy Rights</h2>
              <p className="text-gray-700 mb-4">
                Depending on your location, you may have the following rights regarding your personal information:
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Access</h3>
              <p className="text-gray-700 mb-4">
                You have the right to request copies of your personal information we hold.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Rectification</h3>
              <p className="text-gray-700 mb-4">
                You have the right to request that we correct any information you believe is inaccurate or incomplete.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Erasure</h3>
              <p className="text-gray-700 mb-4">
                You have the right to request that we erase your personal data under certain conditions.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Restrict Processing</h3>
              <p className="text-gray-700 mb-4">
                You have the right to request that we restrict the processing of your personal data under certain conditions.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Data Portability</h3>
              <p className="text-gray-700 mb-4">
                You have the right to request that we transfer the data we have collected to another organization or directly to you under certain conditions.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Right to Opt-Out</h3>
              <p className="text-gray-700 mb-4">
                You can opt-out of:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Marketing emails by clicking the unsubscribe link</li>
                <li>Cookies by adjusting your browser settings</li>
                <li>Analytics tracking by using browser extensions or opt-out tools</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-700 mb-4">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-700 mb-4">
                Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. If you are located outside the United States and choose to provide information to us, please note that we transfer the data to the United States and process it there.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top of this Privacy Policy.
              </p>
              <p className="text-gray-700 mb-4">
                You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this Privacy Policy, your rights, or our practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Hydrogen Studies</strong><br />
                  Email: privacy@hydrogenstudies.com<br />
                  Contact Form: <a href="/contact" className="text-blue-600 hover:underline">www.hydrogenstudies.com/contact</a>
                </p>
              </div>
            </section>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}