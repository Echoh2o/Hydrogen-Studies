import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";

export default function TermsOfServicePage() {
  const title = "Terms of Service - Hydrogen Studies";
  const description =
    "Terms of Service for Hydrogen Studies. Read our user agreement, content policies, and legal terms.";
  const url = "https://hydrogenstudies.com/terms";

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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              Effective Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
              <p className="text-gray-700 mb-4">
                By accessing or using Hydrogen Studies (the "Service"), operated by Hydrogen Studies ("we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, then you may not access the Service.
              </p>
              <p className="text-gray-700 mb-4">
                These Terms apply to all visitors, users, and others who access or use the Service, including researchers, healthcare professionals, students, and general public users.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Use of Our Service</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Eligibility</h3>
              <p className="text-gray-700 mb-4">
                You must be at least 13 years old to use our Service. By using the Service, you represent and warrant that you are at least 13 years of age.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Registration</h3>
              <p className="text-gray-700 mb-4">
                To access certain features of the Service, you may be required to register for an account. When you register for an account, you agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and accept all risks of unauthorized access</li>
                <li>Notify us immediately if you discover or suspect any security breaches</li>
                <li>Take responsibility for all activities that occur under your account</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Prohibited Uses</h3>
              <p className="text-gray-700 mb-4">
                You agree not to use the Service:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
                <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
                <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
                <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
                <li>To submit false or misleading information</li>
                <li>To upload or transmit viruses or any other type of malicious code</li>
                <li>To interfere with or circumvent the security features of the Service</li>
                <li>To scrape, spider, or crawl any part of the Service without our express written permission</li>
                <li>To use the Service in any manner that could disable, overburden, damage, or impair the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Content</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Our Content</h3>
              <p className="text-gray-700 mb-4">
                The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of Hydrogen Studies and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">User Content</h3>
              <p className="text-gray-700 mb-4">
                Our Service may allow you to post, link, store, share, and otherwise make available certain information, text, graphics, or other material ("Content"). You are responsible for Content that you post to the Service, including its legality, reliability, and appropriateness.
              </p>
              <p className="text-gray-700 mb-4">
                By posting Content to the Service, you grant us the right and license to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Use, modify, publicly perform, publicly display, reproduce, and distribute such Content</li>
                <li>Allow other users to access, view, and share your Content</li>
                <li>Use your Content for the improvement of our Service</li>
              </ul>
              <p className="text-gray-700 mb-4">
                You retain your rights to any Content you submit, post, or display on or through the Service. You are responsible for protecting those rights.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Content Standards</h3>
              <p className="text-gray-700 mb-4">
                All Content must comply with applicable federal, state, local, and international laws and regulations. Content must not:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Contain any material that is defamatory, obscene, indecent, abusive, offensive, harassing, violent, hateful, inflammatory, or otherwise objectionable</li>
                <li>Promote sexually explicit or pornographic material, violence, or discrimination</li>
                <li>Infringe any patent, trademark, trade secret, copyright, or other intellectual property rights</li>
                <li>Violate the legal rights (including the rights of publicity and privacy) of others</li>
                <li>Contain any material that could give rise to any civil or criminal liability</li>
                <li>Be likely to deceive any person</li>
                <li>Promote any illegal activity</li>
                <li>Cause annoyance, inconvenience, or needless anxiety</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Medical and Health Information Disclaimer</h2>
              <p className="text-gray-700 mb-4 font-semibold">
                THE INFORMATION PROVIDED ON THIS WEBSITE IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY AND IS NOT INTENDED AS MEDICAL ADVICE.
              </p>
              <p className="text-gray-700 mb-4">
                The content on Hydrogen Studies, including but not limited to research studies, articles, blog posts, and user comments:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Is not intended to be a substitute for professional medical advice, diagnosis, or treatment</li>
                <li>Should not be relied upon for specific medical advice</li>
                <li>May not be complete, accurate, or up-to-date</li>
                <li>Is based on research that may have limitations or may not be applicable to all individuals</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read on this website.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Intellectual Property Rights</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Our Intellectual Property</h3>
              <p className="text-gray-700 mb-4">
                The Service and its entire contents, features, and functionality (including but not limited to all information, software, text, displays, images, video, and audio, and the design, selection, and arrangement thereof) are owned by Hydrogen Studies, its licensors, or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Your License to Use Our Service</h3>
              <p className="text-gray-700 mb-4">
                Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use. This license does not include:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Any resale or commercial use of the Service or its contents</li>
                <li>Any collection and use of any product listings, descriptions, or prices</li>
                <li>Any derivative use of the Service or its contents</li>
                <li>Any downloading or copying of information for the benefit of another party</li>
                <li>Any use of data mining, robots, or similar data gathering and extraction tools</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Trademarks</h3>
              <p className="text-gray-700 mb-4">
                "Hydrogen Studies" and our logos are trademarks of Hydrogen Studies. You may not use our trademarks without our prior written permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Third-Party Services and Content</h2>
              <p className="text-gray-700 mb-4">
                Our Service may contain links to third-party websites or services that are not owned or controlled by Hydrogen Studies. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services.
              </p>
              <p className="text-gray-700 mb-4">
                We strongly advise you to read the terms and conditions and privacy policies of any third-party websites or services that you visit.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Privacy</h2>
              <p className="text-gray-700 mb-4">
                Your use of our Service is also governed by our Privacy Policy. Please review our Privacy Policy, which also governs the Site and informs users of our data collection practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disclaimers and Limitation of Liability</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Disclaimers</h3>
              <p className="text-gray-700 mb-4">
                THE INFORMATION ON THIS WEBSITE IS PROVIDED ON AN "AS-IS" AND "AS AVAILABLE" BASIS. YOU AGREE THAT YOUR USE OF THE SERVICE WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICE AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-gray-700 mb-4">
                We make no warranties or representations about the accuracy or completeness of the Service's content or the content of any websites linked to this Service and we will assume no liability or responsibility for any:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Errors, mistakes, or inaccuracies of content and materials</li>
                <li>Personal injury or property damage resulting from your access to and use of the Service</li>
                <li>Unauthorized access to or use of our secure servers and/or any personal information stored therein</li>
                <li>Interruption or cessation of transmission to or from the Service</li>
                <li>Bugs, viruses, trojan horses, or the like which may be transmitted through the Service</li>
                <li>Errors or omissions in any content and materials</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h3>
              <p className="text-gray-700 mb-4">
                IN NO EVENT WILL HYDROGEN STUDIES, ITS AFFILIATES, OR THEIR LICENSORS, SERVICE PROVIDERS, EMPLOYEES, AGENTS, OFFICERS, OR DIRECTORS BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE, OR INABILITY TO USE, THE SERVICE, ANY WEBSITES LINKED TO IT, ANY CONTENT ON THE SERVICE OR SUCH OTHER WEBSITES, INCLUDING ANY DIRECT, INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO, PERSONAL INJURY, PAIN AND SUFFERING, EMOTIONAL DISTRESS, LOSS OF REVENUE, LOSS OF PROFITS, LOSS OF BUSINESS OR ANTICIPATED SAVINGS, LOSS OF USE, LOSS OF GOODWILL, LOSS OF DATA, AND WHETHER CAUSED BY TORT (INCLUDING NEGLIGENCE), BREACH OF CONTRACT, OR OTHERWISE, EVEN IF FORESEEABLE.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Indemnification</h2>
              <p className="text-gray-700 mb-4">
                You agree to defend, indemnify, and hold harmless Hydrogen Studies and its licensees and licensors, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses (including but not limited to attorney's fees) resulting from or arising out of:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Your use and access of the Service</li>
                <li>Your violation of any term of these Terms</li>
                <li>Your violation of any third-party right, including without limitation any copyright, property, or privacy right</li>
                <li>Any claim that your Content caused damage to a third party</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Termination</h2>
              <p className="text-gray-700 mb-4">
                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
              </p>
              <p className="text-gray-700 mb-4">
                If you wish to terminate your account, you may simply discontinue using the Service or contact us to request account deletion.
              </p>
              <p className="text-gray-700 mb-4">
                All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Governing Law and Dispute Resolution</h2>
              <p className="text-gray-700 mb-4">
                These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
              </p>
              <p className="text-gray-700 mb-4">
                Any dispute arising from or relating to the subject matter of these Terms shall be finally settled by arbitration, using the English language in accordance with the Arbitration Rules and Procedures of the American Arbitration Association.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to These Terms</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.
              </p>
              <p className="text-gray-700 mb-4">
                By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact Information</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Hydrogen Studies</strong><br />
                  Email: legal@hydrogenstudies.com<br />
                  Contact Form: <a href="/contact" className="text-teal-600 hover:underline">www.hydrogenstudies.com/contact</a>
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