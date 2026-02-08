import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FloatingWhatsApp } from '@/components/website/FloatingWhatsApp';
import logo from '@/assets/logo.jpeg';

export default function TermsOfService() {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By downloading, installing, or using the Ramadan Data App ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App. These Terms constitute a legal agreement between you and Ramadan Data App.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Ramadan Data App provides a mobile platform for the following services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Purchase of mobile data bundles for MTN, Airtel, Glo, and 9mobile networks</li>
              <li>Airtime top-up for all Nigerian mobile networks</li>
              <li>Electricity bill payments (prepaid and postpaid meters)</li>
              <li>Cable TV subscription renewals (DSTV, GOtv, StarTimes)</li>
              <li>Exam result-checker PIN purchases (WAEC, NECO, NABTEB)</li>
              <li>Wallet funding via dedicated virtual bank accounts</li>
              <li>Referral rewards program</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must create an account to use our services. You agree to provide accurate, complete information and keep it updated. You are responsible for maintaining the confidentiality of your account credentials, PIN, and biometric settings. You must be at least 13 years old to create an account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Wallet & Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your wallet is funded via bank transfers to your dedicated virtual account. Funds are credited automatically. All transactions are deducted from your wallet balance. Wallet balances are non-transferable except through our peer transfer feature (when available). Refunds for failed transactions are automatically credited back to your wallet.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Transaction Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We process transactions through third-party service providers. While we strive for instant delivery, processing times may vary. We are not liable for delays caused by third-party providers, network issues, or incorrect details provided by you. Always verify recipient details (phone numbers, meter numbers, smart card numbers) before confirming transactions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Referral Program</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may earn referral bonuses by inviting others to join using your referral code. Bonuses are credited after the referred user meets the minimum funding requirement. We reserve the right to modify or suspend the referral program at any time. Abuse of the referral system (e.g., self-referrals, fake accounts) may result in account suspension.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Prohibited Activities</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Using the App for fraudulent, illegal, or unauthorized purposes</li>
              <li>Attempting to reverse-engineer, hack, or compromise the App</li>
              <li>Creating multiple accounts to exploit promotions or referral bonuses</li>
              <li>Using automated tools or bots to interact with the App</li>
              <li>Providing false or misleading information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ramadan Data App is provided "as is" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid for the specific transaction in question. We are not responsible for losses due to incorrect details provided by you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Account Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your account for violation of these Terms, suspected fraud, or at our discretion. You may request account deletion at any time through our{' '}
              <a href="/delete-account" className="text-primary hover:underline">Account Deletion page</a>.
              Any remaining wallet balance at the time of termination will be handled in accordance with applicable regulations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Significant changes will be communicated via in-app notifications. Continued use of the App after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through the appropriate Nigerian courts or through mutual mediation.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions about these Terms of Service, please contact us:
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

      <FloatingWhatsApp />
    </div>
  );
}
