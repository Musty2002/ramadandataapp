import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingWhatsApp } from '@/components/website/FloatingWhatsApp';
import logo from '@/assets/ramadan-logo.jpeg';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'January 22, 2026';
  const email = 'ramadandataapp@gmail.com';

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/website')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-3">
              <img src={logo} alt="Ramadan Data App" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-lg font-bold text-primary">Ramadan Data App</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to Ramadan Data App ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Account Information:</strong> Full name, email address, phone number, and password when you create an account.</li>
              <li><strong>Transaction Data:</strong> Details of purchases including airtime, data bundles, electricity bills, and TV subscriptions.</li>
              <li><strong>Payment Information:</strong> Wallet balance and transaction history (we do not store credit/debit card details).</li>
              <li><strong>Device Information:</strong> Device type, operating system, and unique device identifiers.</li>
              <li><strong>Usage Data:</strong> How you interact with our app, including features used and time spent.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related notifications</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf (payment processors, network providers).</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale, or acquisition.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do not sell, trade, or rent your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These include encryption, secure servers, and regular security assessments. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. Transaction records are retained for a minimum of 7 years for compliance purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Withdraw consent at any time</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Account Deletion</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may request deletion of your account and associated data by visiting our{' '}
              <a href="/delete-account" className="text-primary hover:underline">Account Deletion page</a>{' '}
              or by contacting us at{' '}
              <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>.
              Upon receiving your request, we will delete your account within 30 days, except for data we are required to retain for legal purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-card rounded-xl p-6 border border-border space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <a href={`mailto:${email}`} className="text-foreground hover:text-primary transition-colors">
                  {email}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <a href="tel:+2349068502050" className="text-foreground hover:text-primary transition-colors">
                  +234 906 850 2050
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border bg-card">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ramadan Data App. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <FloatingWhatsApp />
    </div>
  );
}
