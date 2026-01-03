import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Copy, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function AddMoney() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Add Money</h1>
        </div>

        <div className="px-4 pb-6">
          {/* Bank Transfer Card */}
          <div className="bg-card rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Bank Transfer</h2>
                <p className="text-sm text-muted-foreground">Transfer to your account</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Bank Name</p>
                    <p className="font-semibold text-foreground">Providus Bank</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard('Providus Bank', 'Bank name')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                    <p className="font-semibold text-foreground text-lg tracking-wide">
                      {profile?.account_number || '----------'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(profile?.account_number || '', 'Account number')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Account Name</p>
                    <p className="font-semibold text-foreground">{profile?.full_name || 'User'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(profile?.full_name || '', 'Account name')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-accent/10 rounded-xl p-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">Note:</span> Transfer any amount to the account above.
              Your wallet will be credited automatically within minutes.
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}