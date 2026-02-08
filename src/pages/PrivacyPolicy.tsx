import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingWhatsApp } from '@/components/website/FloatingWhatsApp';
import logo from '@/assets/logo.jpeg';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'February 8, 2026';
  const email = 'ramadandataapp@gmail.com';

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
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
              Welcome to Ramadan Data App ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services, including but not limited to data bundles, airtime top-up, electricity bill payments, cable TV subscriptions, exam result-checker PINs, wallet funding, peer-to-peer transfers, and referral programs.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information that you provide directly to us and information generated automatically when you use our services:
            </p>

            <h3 className="text-lg font-semibold text-foreground mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Account Information:</strong> Full name, email address, phone number, and password when you create an account.</li>
              <li><strong>Profile Information:</strong> Profile picture/avatar that you optionally upload.</li>
              <li><strong>Transaction Data:</strong> Details of purchases including airtime recharges, data bundles, electricity token purchases, cable TV subscriptions (DSTV, GOtv, StarTimes), and exam result-checker PINs (WAEC, NECO, NABTEB).</li>
              <li><strong>Payment Information:</strong> Wallet balance, virtual bank account details (created through our payment partner), and transaction history. We do not store credit/debit card details directly.</li>
              <li><strong>Service-Specific Data:</strong> Meter numbers, smart card/IUC numbers, and phone numbers you enter to complete bill payments and recharges.</li>
              <li><strong>Referral Information:</strong> Referral codes shared and used, and information about your referral network.</li>
              <li><strong>Identity Verification:</strong> BVN/NIN information if you choose to use our identity verification service (when available).</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Device Information:</strong> Device type, operating system version, device model, unique device identifiers, and app version.</li>
              <li><strong>Usage Data:</strong> Features used, screens visited, time spent, interaction patterns, and performance metrics.</li>
              <li><strong>Network Information:</strong> Network status (online/offline), connectivity type, and carrier information for service optimization.</li>
              <li><strong>Push Notification Tokens:</strong> Device tokens required to deliver transaction alerts, promotional messages, and service notifications.</li>
              <li><strong>Clipboard Data:</strong> We access clipboard only when you explicitly tap "Copy" for account numbers, referral codes, or exam PINs. We never read clipboard in the background.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide, maintain, and improve our services including data, airtime, electricity, TV, and exam PIN purchases</li>
              <li>Process transactions, verify meters/smart cards, and send related notifications</li>
              <li>Create and manage your virtual bank account for wallet funding</li>
              <li>Process referral bonuses and manage the referral program</li>
              <li>Authenticate your identity via PIN, password, or biometric verification</li>
              <li>Deliver push notifications about transaction statuses, promotions, and account activity</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Detect, prevent, and address technical issues, fraud, and unauthorized access</li>
              <li>Improve app performance and user experience across different devices</li>
              <li>Comply with legal obligations and regulatory requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Authentication & Security Measures</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement multiple layers of security to protect your account:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Password Authentication:</strong> Your password is securely hashed and never stored in plaintext.</li>
              <li><strong>4-Digit PIN:</strong> A locally stored PIN for quick login and transaction authorization. Your PIN is encrypted and stored only on your device.</li>
              <li><strong>Biometric Authentication:</strong> Optional fingerprint or face recognition for login and transaction authorization, processed entirely on your device using your device's secure enclave.</li>
              <li><strong>App Lock:</strong> Automatic screen lock when the app is backgrounded, requiring PIN or biometric re-authentication.</li>
              <li><strong>OTP Verification:</strong> One-time passwords sent via email for password resets.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Biometric data is processed locally on your device and is never transmitted to or stored on our servers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Payment Processors:</strong> Virtual account providers (e.g., PaymentPoint/Monnify) to facilitate wallet funding via bank transfers.</li>
              <li><strong>VTU Service Providers:</strong> Third-party API providers (for data, airtime, electricity, cable TV, and exam PINs) who require minimal transaction details to fulfill your orders.</li>
              <li><strong>Network Operators:</strong> MTN, Airtel, Glo, and 9mobile for airtime and data delivery.</li>
              <li><strong>Utility Companies:</strong> Electricity distribution companies and TV service providers for bill payment processing.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or to protect our rights, safety, and property.</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale, or acquisition of company assets.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do not sell, trade, or rent your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Push Notifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use push notifications to inform you about transaction statuses (successful, failed, or pending), wallet credit alerts, referral bonuses, promotional offers, and important account updates. You can manage your notification preferences in your device settings at any time. We store your device push token securely to deliver these notifications.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Storage & Local Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              For optimal app performance and offline functionality, we store certain data locally on your device, including cached profile data, wallet balance, recent transaction history, and authentication tokens. This data is stored using your device's secure storage mechanisms. Our servers are secured with industry-standard encryption, access controls, and regular security assessments. However, no method of electronic transmission or storage is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. Transaction records are retained for a minimum of 7 years for compliance purposes. Locally stored data (PIN, biometric preferences, cached data) is removed when you uninstall the app or explicitly clear app data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete information via the Edit Profile feature</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Withdraw consent for push notifications at any time via device settings</li>
              <li>Disable biometric authentication through the Security settings</li>
              <li>Data portability — request your data in a structured, machine-readable format</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Account Deletion</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may request deletion of your account and associated data by visiting our{' '}
              <a href="/delete-account" className="text-primary hover:underline">Account Deletion page</a>{' '}
              or by contacting us at{' '}
              <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>.
              Upon receiving your request, we will process your deletion within 30 days. This includes removing your profile data, wallet information, virtual account details, referral history, and push notification tokens. Transaction records required for legal compliance will be anonymized and retained for the required period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our app integrates with third-party services to provide functionality. These services have their own privacy policies that govern how they handle your data. We encourage you to review their policies. Key third-party services include payment gateway providers for virtual account creation and funding, VTU API providers for airtime, data, and utility services, and cloud infrastructure providers for secure data hosting.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately and we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices, services, or legal requirements. We will notify you of significant changes through in-app notifications or by updating the "Last updated" date. Continued use of the app after changes constitutes your acceptance of the revised policy. You are advised to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, our data practices, or wish to exercise your data rights, please contact us:
            </p>
            <div className="bg-card rounded-xl p-6 border border-border space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                <a href={`mailto:${email}`} className="text-foreground hover:text-primary transition-colors break-all">
                  {email}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary flex-shrink-0" />
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
