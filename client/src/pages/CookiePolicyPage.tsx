import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openPrivacyChoices } from "@/lib/consent";

export default function CookiePolicyPage() {
  const title = "Cookie Policy - Hydrogen Studies";
  const description =
    "Cookie Policy for Hydrogen Studies. Learn about how we use cookies and how to manage your preferences.";
  const url = "https://hydrogenstudies.com/cookies";

  // Opens the privacy-choices panel (components/ui/cookie-consent.tsx).
  const handleManageCookies = () => openPrivacyChoices();

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <link rel="canonical" href={url} />
      </Helmet>
      <SiteHeader />
      
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-8 shadow-lg bg-white">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              Last Updated: September 23, 2026
            </p>

            <div className="bg-teal-50 border-l-4 border-teal-400 p-4 mb-8">
              <p className="text-gray-700">
                This Cookie Policy explains how Hydrogen Studies ("we," "us," or "our") uses cookies and similar technologies on our website, and the choices you have. In short: we use analytics to see which pages are useful, we run no ads, and you can turn analytics off at any time with the <strong>Privacy choices</strong> link in the site footer.
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

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Analytics</h3>
              <p className="text-gray-700 mb-4">
                We use two analytics tools to count visits, see which pages are most and least useful, and learn where visitors come from:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>
                  <strong>Google Analytics 4 (GA4) with Google Consent Mode.</strong> GA4 sets its cookies (<code>_ga</code>, <code>_ga_&lt;ID&gt;</code>) only when analytics storage is allowed. When it is not allowed, GA4 still receives basic measurement signals (for example, that a page was viewed) without reading or writing cookies on your device, and Google uses them for aggregated, modeled reports. Google Analytics 4 does not log or store IP addresses. We do not use Google&apos;s advertising features: ad storage, ad user data and ad personalization are always off.
                </li>
                <li>
                  <strong>Ahrefs Web Analytics.</strong> A cookieless tool that counts page views and referrers without setting cookies or storing an identifier on your device.
                </li>
              </ul>

              <h4 className="text-lg font-semibold text-gray-900 mb-2">Where we ask first</h4>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>
                  <strong>European Economic Area, United Kingdom and Switzerland:</strong> analytics cookies are off by default. We show a banner and set them only if you choose <em>Accept</em>.
                </li>
                <li>
                  <strong>Everywhere else:</strong> analytics cookies are on by default. You can turn them off at any time with <em>Privacy choices</em> in the site footer or the button in section 5.2.
                </li>
              </ul>
              <p className="text-gray-700 mb-4">
                We decide whether to show the banner from the country our network provider (Cloudflare) associates with your IP address. We use it only for that decision and do not store it. Google applies the same regional default using its own location detection.
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
                      <td className="px-4 py-4 text-sm text-gray-700">hydrogen.sid</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Keeps your session and sign-in secure</td>
                      <td className="px-4 py-4 text-sm text-gray-700">24 hours (renewed while active)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-sm text-gray-700">csrf-token</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Protects forms and account actions from cross-site request forgery</td>
                      <td className="px-4 py-4 text-sm text-gray-700">24 hours</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-sm text-gray-700">hs_cookie_consent, hs_cookie_preferences</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Essential (browser storage)</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Remembers your privacy choice</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Until you clear site data</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-sm text-gray-700">_ga</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Analytics (GA4)</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Distinguishes visitors. Set only when analytics storage is allowed</td>
                      <td className="px-4 py-4 text-sm text-gray-700">2 years</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 text-sm text-gray-700">_ga_&lt;ID&gt;</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">Analytics (GA4)</td>
                      <td className="px-4 py-4 text-sm text-gray-700">Keeps GA4 session state. Set only when analytics storage is allowed</td>
                      <td className="px-4 py-4 text-sm text-gray-700">2 years</td>
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
                <li>Measure website traffic and performance (Google Analytics, Ahrefs)</li>
                <li>Monitor application errors (Sentry)</li>
                <li>Ensure secure authentication (session management)</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Third-party providers we use include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><strong>Google Analytics 4:</strong> Website analytics, run with Google Consent Mode (cookies only when analytics storage is allowed; see section 2.2)</li>
                <li><strong>Ahrefs Web Analytics:</strong> Cookieless traffic analytics (not loaded if you opt out or send Global Privacy Control)</li>
                <li><strong>Sentry:</strong> Application error monitoring</li>
                <li><strong>Klaviyo:</strong> Newsletter and email engagement</li>
                <li><strong>Shopify:</strong> Product commerce and checkout</li>
                <li><strong>Railway:</strong> Application hosting and database</li>
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
                You can change your choice at any time, wherever you are, with <em>Privacy choices</em> in the site footer or this button:
              </p>
              <Button 
                onClick={handleManageCookies}
                className="mb-4"
                data-testid="button-manage-cookies"
              >
                Open Privacy Choices
              </Button>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.3 Browser-Specific Instructions</h3>
              <p className="text-gray-700 mb-4">
                Here are links to cookie management instructions for popular browsers:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Google Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Mozilla Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Microsoft Edge</a></li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.4 Opt-Out Options</h3>
              <p className="text-gray-700 mb-4">
                You can opt out of specific third-party cookies:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>
                  <strong>Privacy choices:</strong> Turn Analytics off (or choose <em>Reject</em> in the banner). Google Analytics stops using cookies right away and we delete the GA cookies it set on this site; it continues only in its cookieless mode described in section 2.2. Ahrefs Web Analytics stops loading from your next page view.
                </li>
                <li>
                  <strong>Global Privacy Control:</strong> If your browser sends a GPC signal, we treat it as an opt-out (see section 6).
                </li>
                <li>
                  <strong>Google Analytics:</strong> Install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Google Analytics Opt-out Browser Add-on</a>
                </li>
                <li>
                  <strong>General opt-out:</strong> Visit the <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Digital Advertising Alliance's opt-out page</a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Global Privacy Control and Do Not Track</h2>
              <p className="text-gray-700 mb-4">
                We honor <a href="https://globalprivacycontrol.org/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Global Privacy Control</a> (GPC). If your browser sends it, analytics cookies stay off, Google Analytics runs only in its cookieless mode, Ahrefs Web Analytics is not loaded, and we do not show the consent banner. GPC takes priority over an earlier <em>Accept</em>.
              </p>
              <p className="text-gray-700 mb-4">
                We do not respond to the older &quot;Do Not Track&quot; (DNT) header, which has no agreed meaning. Your choices in <em>Privacy choices</em> and your browser settings still apply.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Cookies and Personal Data</h2>
              <p className="text-gray-700 mb-4">
                Some cookies we use may collect personal data about you. For more information about how we handle personal data, please refer to our <a href="/privacy" className="text-teal-600 hover:underline">Privacy Policy</a>.
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
                  Contact Form: <a href="/contact" className="text-teal-600 hover:underline">www.hydrogenstudies.com/contact</a><br />
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
                <li><a href="https://www.allaboutcookies.org/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">All About Cookies</a> - Independent information about cookies</li>
                <li><a href="https://www.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Network Advertising Initiative</a> - Information about online advertising</li>
                <li><a href="https://youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Your Online Choices</a> - EU guide to online behavioral advertising</li>
              </ul>
            </section>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}