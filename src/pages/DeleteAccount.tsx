import { useState } from 'react';
import { ArrowLeft, Mail, Send, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/ramadan-logo.jpeg';
import { z } from 'zod';

const deleteRequestSchema = z.object({
  email: z.string().trim().email({ message: 'Please enter a valid email address' }),
  reason: z.string().trim().min(10, { message: 'Please provide at least 10 characters explaining your reason' }).max(1000, { message: 'Reason must be less than 1000 characters' }),
});

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; reason?: string }>({});

  const supportEmail = 'ramadandataapp@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const result = deleteRequestSchema.safeParse({ email, reason });
    if (!result.success) {
      const fieldErrors: { email?: string; reason?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'reason') fieldErrors.reason = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSending(true);

    // Construct mailto link
    const subject = encodeURIComponent('Account Deletion Request - Ramadan Data App');
    const body = encodeURIComponent(
      `Account Deletion Request\n\n` +
      `Email: ${email}\n\n` +
      `Reason for deletion:\n${reason}\n\n` +
      `---\n` +
      `This request was submitted through the Ramadan Data App account deletion page.`
    );

    // Open email client
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

    toast({
      title: 'Email Client Opened',
      description: 'Please send the email to complete your deletion request.',
    });

    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Delete Your Account</h1>
          <p className="text-muted-foreground">
            We're sorry to see you go. Please fill out the form below to request account deletion.
          </p>
        </div>

        {/* Warning Card */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-destructive mb-2">Before you proceed, please note:</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>All your data will be permanently deleted</li>
            <li>Your wallet balance will be forfeited</li>
            <li>Transaction history will be removed (after legal retention period)</li>
            <li>This action cannot be undone</li>
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the email address associated with your account
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Deletion</Label>
            <Textarea
              id="reason"
              placeholder="Please tell us why you want to delete your account..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              className={errors.reason ? 'border-destructive' : ''}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Your feedback helps us improve our service
            </p>
          </div>

          <Button
            type="submit"
            variant="destructive"
            className="w-full"
            disabled={sending}
          >
            {sending ? (
              'Opening Email...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Deletion Request
              </>
            )}
          </Button>
        </form>

        {/* Alternative Contact */}
        <div className="mt-8 p-6 bg-card rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-3">Or Contact Us Directly</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You can also send an email directly to request account deletion:
          </p>
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent('Account Deletion Request')}`}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Mail className="h-5 w-5" />
            {supportEmail}
          </a>
        </div>

        {/* Processing Info */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Account deletion requests are typically processed within <strong>30 days</strong>.
            <br />
            You will receive a confirmation email once your account has been deleted.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border bg-card">
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <a href="/privacy-policy" className="text-sm text-primary hover:underline">
            Privacy Policy
          </a>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ramadan Data App. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
