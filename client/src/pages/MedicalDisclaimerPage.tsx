import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Heart, UserCheck, Stethoscope } from "lucide-react";

export default function MedicalDisclaimerPage() {
  const title = "Medical Disclaimer - Hydrogen Studies";
  const description =
    "Important medical disclaimer for Hydrogen Studies. This website provides educational information only and is not a substitute for professional medical advice.";
  const url = "https://hydrogenstudies.com/medical-disclaimer";

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
          <div className="flex items-center mb-8">
            <AlertTriangle className="h-10 w-10 text-amber-500 mr-4" />
            <h1 className="text-3xl font-bold text-gray-900">Medical Disclaimer</h1>
          </div>
          
          <div className="prose prose-gray max-w-none">
            <p className="text-sm text-gray-600 mb-6">
              Last Updated: February 21, 2026
            </p>

            <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-8">
              <h2 className="text-xl font-bold text-red-900 mb-3 flex items-center">
                <AlertTriangle className="h-6 w-6 mr-2" />
                IMPORTANT HEALTH INFORMATION NOTICE
              </h2>
              <p className="text-red-800 font-semibold">
                THE INFORMATION PROVIDED ON THIS WEBSITE IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY AND IS NOT INTENDED AS MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT.
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Educational Purpose Only</h2>
              <p className="text-gray-700 mb-4">
                Hydrogen Studies is an educational resource designed to provide information about hydrogen therapy research and scientific studies. All content on this website, including but not limited to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Research study summaries and abstracts</li>
                <li>Blog articles and educational content</li>
                <li>User comments and discussions</li>
                <li>AI-generated insights and recommendations</li>
                <li>Statistical data and research trends</li>
                <li>Links to external research papers</li>
              </ul>
              <p className="text-gray-700 mb-4">
                is provided solely for educational and informational purposes and should not be construed as medical advice, diagnosis, or treatment recommendations.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Stethoscope className="h-6 w-6 mr-2 text-teal-600" />
                Not a Substitute for Professional Medical Advice
              </h2>
              <p className="text-gray-700 mb-4 font-semibold">
                The information on this website is NOT intended to:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Replace the advice of qualified healthcare professionals</li>
                <li>Diagnose, treat, cure, or prevent any disease or health condition</li>
                <li>Provide personalized medical recommendations</li>
                <li>Serve as a basis for making medical decisions</li>
                <li>Replace proper medical examination and consultation</li>
              </ul>
              
              <div className="bg-teal-50 border-l-4 border-teal-400 p-4 my-6">
                <p className="text-gray-700 font-semibold">
                  ALWAYS consult with a qualified healthcare professional before making any decisions about your health, including:
                </p>
                <ul className="list-disc pl-6 mt-2 text-gray-700">
                  <li>Starting, stopping, or changing any treatment or therapy</li>
                  <li>Using hydrogen therapy or any other alternative treatments</li>
                  <li>Making changes to your medications or supplement regimen</li>
                  <li>Addressing specific health concerns or symptoms</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Research Information Limitations</h2>
              <p className="text-gray-700 mb-4">
                Please be aware that:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>
                  <strong>Research is evolving:</strong> Scientific understanding of hydrogen therapy is continuously developing, and information may become outdated or superseded by new findings.
                </li>
                <li>
                  <strong>Study limitations:</strong> Many studies have limitations including small sample sizes, short duration, or specific population groups that may not apply to everyone.
                </li>
                <li>
                  <strong>Preliminary findings:</strong> Some research presented may be preliminary, not peer-reviewed, or require further validation.
                </li>
                <li>
                  <strong>Individual variations:</strong> Results from studies may not apply to all individuals due to genetic, environmental, and health status differences.
                </li>
                <li>
                  <strong>Translation challenges:</strong> Some studies may be translated from other languages, potentially affecting accuracy of interpretation.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <Heart className="h-6 w-6 mr-2 text-red-500" />
                Medical Emergency Warning
              </h2>
              <div className="bg-red-50 border-2 border-red-400 p-6 rounded-lg">
                <p className="text-gray-900 font-bold text-lg mb-3">
                  IF YOU HAVE A MEDICAL EMERGENCY:
                </p>
                <ul className="list-disc pl-6 text-gray-800">
                  <li>Call your local emergency number immediately (911 in the US)</li>
                  <li>Go to the nearest emergency room</li>
                  <li>Contact your healthcare provider immediately</li>
                </ul>
                <p className="text-gray-800 mt-4 font-semibold">
                  Do NOT rely on information from this website in emergency situations.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Specific Health Warnings</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Pregnancy and Nursing</h3>
              <p className="text-gray-700 mb-4">
                If you are pregnant, nursing, or planning to become pregnant, consult your healthcare provider before considering any information or treatments discussed on this website.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Children</h3>
              <p className="text-gray-700 mb-4">
                Information on this website is not intended for pediatric use. Parents and guardians should consult pediatricians or qualified healthcare providers for advice regarding children's health.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Pre-existing Conditions</h3>
              <p className="text-gray-700 mb-4">
                Individuals with pre-existing medical conditions, chronic illnesses, or those taking medications should be especially cautious and must consult their healthcare providers before considering any information presented on this website.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">Drug Interactions</h3>
              <p className="text-gray-700 mb-4">
                Hydrogen therapy or other treatments discussed on this website may interact with medications or other treatments. Always consult your healthcare provider or pharmacist about potential interactions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI-Generated Content Disclaimer</h2>
              <p className="text-gray-700 mb-4">
                This website uses artificial intelligence (AI) to provide certain features including:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Chat assistance and research queries</li>
                <li>Content summarization</li>
                <li>Study insights and analysis</li>
              </ul>
              <p className="text-gray-700 mb-4">
                <strong>Important:</strong> AI-generated content:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>May contain errors or inaccuracies</li>
                <li>Should not be relied upon for medical decisions</li>
                <li>Is not reviewed by medical professionals before display</li>
                <li>Does not constitute professional medical advice</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Healthcare Provider-Patient Relationship</h2>
              <p className="text-gray-700 mb-4">
                Using this website does not create a healthcare provider-patient relationship between you and Hydrogen Studies, its operators, contributors, or any affiliated parties. We are not healthcare providers and cannot:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Diagnose your health conditions</li>
                <li>Recommend specific treatments</li>
                <li>Provide medical consultations</li>
                <li>Prescribe medications or therapies</li>
                <li>Interpret your medical tests or symptoms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">External Links and Third-Party Content</h2>
              <p className="text-gray-700 mb-4">
                This website may contain links to external websites, research papers, and third-party content. We do not:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Endorse or verify the accuracy of external content</li>
                <li>Control or take responsibility for third-party information</li>
                <li>Guarantee that external links are current or functional</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Always evaluate external sources critically and consult healthcare professionals for interpretation.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                TO THE FULLEST EXTENT PERMITTED BY LAW:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>Hydrogen Studies, its operators, contributors, and affiliates shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of this website</li>
                <li>We make no warranties or representations about the accuracy, reliability, completeness, or timeliness of the content</li>
                <li>We disclaim all liability for any harm resulting from your use or misuse of information on this website</li>
                <li>We are not responsible for any health outcomes resulting from actions taken based on website content</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Assumption of Risk</h2>
              <p className="text-gray-700 mb-4">
                By using this website, you acknowledge and agree that:
              </p>
              <ul className="list-disc pl-6 mb-4 text-gray-700">
                <li>You assume full responsibility for any decisions you make regarding your health</li>
                <li>You understand the limitations of the information provided</li>
                <li>You will seek professional medical advice for health concerns</li>
                <li>You will not hold Hydrogen Studies liable for any outcomes</li>
                <li>You have read and understood this medical disclaimer</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <UserCheck className="h-6 w-6 mr-2 text-green-600" />
                Your Responsibility
              </h2>
              <div className="bg-green-50 border-l-4 border-green-400 p-4">
                <p className="text-gray-700 font-semibold mb-2">
                  As a user of this website, you are responsible for:
                </p>
                <ul className="list-disc pl-6 text-gray-700">
                  <li>Consulting qualified healthcare professionals for medical advice</li>
                  <li>Verifying information with reliable medical sources</li>
                  <li>Making informed decisions about your health</li>
                  <li>Understanding that this website is for educational purposes only</li>
                  <li>Not using this website as your sole source of health information</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Disclaimer</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to update or modify this medical disclaimer at any time. Changes will be effective immediately upon posting to the website. Your continued use of the website after any changes indicates your acceptance of the updated disclaimer.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
              <p className="text-gray-700 mb-4">
                If you have questions about this medical disclaimer, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Hydrogen Studies</strong><br />
                  Email: legal@hydrogenstudies.com<br />
                  Contact Form: <a href="/contact" className="text-teal-600 hover:underline">www.hydrogenstudies.com/contact</a><br />
                  <br />
                  <strong className="text-red-600">Note:</strong> We cannot provide medical advice or answer health-related questions. Please consult your healthcare provider for medical concerns.
                </p>
              </div>
            </section>

            <div className="bg-amber-50 border-2 border-amber-400 p-6 rounded-lg">
              <p className="text-gray-900 font-bold text-center text-lg">
                By using this website, you acknowledge that you have read, understood, and agree to this Medical Disclaimer.
              </p>
            </div>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}