import { useEffect } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CookiePolicyPage() {
  useEffect(() => {
    document.title = "Cookie Policy - Hydrogen Studies";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Cookie Policy for Hydrogen Studies. Learn about how we use cookies and how to manage your preferences."
      );
    }
  }, []);

  const handleManageCookies = () => {
    // Trigger cookie consent dialog
    const event = new CustomEvent('showCookieSettings');
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <SiteHeader />
      
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-8 shadow-lg bg-white">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
              <p className="text-gray-700">
                This Cookie Policy explains how Hydrogen Studies ("we," "us," or "our") uses cookies and similar tracking technologies on our website. By using our website, you consent to the use of cookies in accordance with this policy.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. What Are Cookies?</h2>
              <p className="text-gray-700 mb-4">
                Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and provide information to the owners of the site.
              </p>
              <p className="text-gray-700 mb-4">
                Cookies can be "persistent" or "session" cookies:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><strong>Persistent cookies:</strong> These remain on your device for a set period of time specified in the cookie. They are activated each time you visit the website that created that particular cookie.</li>
                <li><strong>Session cookies:</strong> These are temporary and expire when you close your browser or when the session times out.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Cookies</h2>
              <p className="text-gray-700 mb-4">
                We use cookies for the following purposes:
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Essential Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services, such as:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Logging into your account</li>
                <li>Setting your privacy preferences</li>
                <li>Filling in forms</li>
                <li>Maintaining security and preventing fraud</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Performance and Analytics Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site. The information collected is aggregated and anonymous.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.3 Functionality Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third-party providers whose services we have added to our pages. If you do not allow these cookies, some or all of these services may not function properly.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.4 Targeting/Marketing Cookies</h3>
              <p className="text-gray-700 mb-4">
                We currently do not use targeting or marketing cookies. If we decide to use them in the future, we will update this policy and request your consent where required.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Types of Cookies We Use</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cookie Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">sessionId</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Maintains user session state</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Session</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">auth-token</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Authentication and security</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">7 days</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">cookie-consent</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Stores your cookie preferences</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">user-preferences</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Functional</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Remembers your settings and preferences</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">_ga</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Analytics</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Google Analytics - distinguishes users</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">2 years</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">_gid</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Analytics</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Google Analytics - distinguishes users</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">24 hours</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">_gat</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Analytics</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Google Analytics - throttle request rate</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">1 minute</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Third-Party Cookies</h2>
              <p className="text-gray-700 mb-4">
                Some cookies on our website are placed by third-party services that appear on our pages. We do not control these cookies and cannot access them. These third parties may use cookies to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Measure website performance (Google Analytics)</li>
                <li>Provide functionality (OpenAI for AI features)</li>
                <li>Ensure secure authentication (session management)</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Third-party providers we use include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><strong>Google Analytics:</strong> For website analytics and performance monitoring</li>
                <li><strong>OpenAI:</strong> For AI-powered features and chat functionality</li>
                <li><strong>Replit:</strong> For hosting and deployment services</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Your Cookie Choices</h2>
              <p className="text-gray-700 mb-4">
                You have several options for managing cookies:
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Browser Settings</h3>
              <p className="text-gray-700 mb-4">
                Most web browsers allow you to control cookies through their settings preferences. You can set your browser to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Notify you when you receive a cookie</li>
                <li>Block first-party cookies</li>
                <li>Block third-party cookies</li>
                <li>Block all cookies</li>
                <li>Delete all cookies when you close your browser</li>
              </ul>
              
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                <p className="text-gray-700">
                  <strong>Note:</strong> If you block all cookies, some features of our website may not function properly, and you may not be able to use all of our services.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 Cookie Management on Our Website</h3>
              <p className="text-gray-700 mb-4">
                You can manage your cookie preferences directly on our website:
              </p>
              <Button 
                onClick={handleManageCookies}
                className="mb-4"
                data-testid="button-manage-cookies"
              >
                Manage Cookie Preferences
              </Button>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.3 Browser-Specific Instructions</h3>
              <p className="text-gray-700 mb-4">
                Here are links to cookie management instructions for popular browsers:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mozilla Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Microsoft Edge</a></li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.4 Opt-Out Options</h3>
              <p className="text-gray-700 mb-4">
                You can opt out of specific third-party cookies:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>
                  <strong>Google Analytics:</strong> Install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Analytics Opt-out Browser Add-on</a>
                </li>
                <li>
                  <strong>General opt-out:</strong> Visit the <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Digital Advertising Alliance's opt-out page</a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Do Not Track Signals</h2>
              <p className="text-gray-700 mb-4">
                Some browsers include a "Do Not Track" (DNT) feature that signals to websites that you do not want to have your online activity tracked. Currently, our website does not respond to DNT signals, but we respect your cookie preferences as set through our cookie consent tool and your browser settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cookies and Personal Data</h2>
              <p className="text-gray-700 mb-4">
                Some cookies we use may collect personal data about you. For more information about how we handle personal data, please refer to our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
              </p>
              <p className="text-gray-700 mb-4">
                Where cookies collect personal data, we ensure that:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>We have a lawful basis for processing this data</li>
                <li>The data is kept secure</li>
                <li>The data is only used for the stated purposes</li>
                <li>The data is retained only as long as necessary</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies Used in Emails</h2>
              <p className="text-gray-700 mb-4">
                We may use technologies like clear GIFs in our emails to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Track whether emails have been opened</li>
                <li>Identify which links have been clicked</li>
                <li>Determine the effectiveness of our email campaigns</li>
              </ul>
              <p className="text-gray-700 mb-4">
                You can opt out of email tracking by:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Unsubscribing from our emails using the link at the bottom of each email</li>
                <li>Configuring your email client to block images by default</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Updates to This Cookie Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. When we make changes, we will:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Update the "Last Updated" date at the top of this policy</li>
                <li>Notify you of material changes through our website or by email</li>
                <li>Request your consent again where required by law</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions or concerns about our use of cookies, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Hydrogen Studies</strong><br />
                  Email: privacy@hydrogenstudies.com<br />
                  Contact Form: <a href="/contact" className="text-blue-600 hover:underline">www.hydrogenstudies.com/contact</a><br />
                  <br />
                  For cookie-specific inquiries, please include "Cookie Policy" in your subject line.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Additional Resources</h2>
              <p className="text-gray-700 mb-4">
                For more information about cookies and online privacy:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><a href="https://www.allaboutcookies.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">All About Cookies</a> - Independent information about cookies</li>
                <li><a href="https://www.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Network Advertising Initiative</a> - Information about online advertising</li>
                <li><a href="https://youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Your Online Choices</a> - EU guide to online behavioral advertising</li>
              </ul>
            </section>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}