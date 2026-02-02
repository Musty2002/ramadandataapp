import { Smartphone, Download, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.jpeg';

export default function DownloadApp() {
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.ramadandataapp.app';
  // Uncomment when iOS app is available
  // const appStoreUrl = 'https://apps.apple.com/app/ramadan-data-app/id...';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={logo} 
            alt="Ramadan Data App" 
            className="w-24 h-24 rounded-2xl shadow-lg"
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Download Our Mobile App
          </h1>
          <p className="text-muted-foreground text-lg">
            For a secure and seamless experience, please use our mobile app
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Shield className="w-6 h-6" />
            <span className="font-semibold">Enhanced Security</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Our mobile app provides additional security features to protect your account and transactions.
          </p>
          
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-foreground">Biometric authentication</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-foreground">PIN-protected transactions</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-foreground">Secure encrypted storage</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-foreground">Push notifications for transactions</span>
            </div>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full gap-3 h-14 text-base"
            onClick={() => window.open(playStoreUrl, '_blank')}
          >
            <Smartphone className="w-5 h-5" />
            Download for Android
          </Button>
          
          {/* iOS Button - Uncomment when available
          <Button 
            size="lg" 
            variant="outline"
            className="w-full gap-3 h-14 text-base"
            onClick={() => window.open(appStoreUrl, '_blank')}
          >
            <Download className="w-5 h-5" />
            Download for iOS
          </Button>
          */}
        </div>

        {/* Alternative */}
        <p className="text-xs text-muted-foreground">
          Web access is restricted for security purposes. <br />
          All features are available on the mobile app.
        </p>
      </div>
    </div>
  );
}
