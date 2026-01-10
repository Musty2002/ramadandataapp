import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Gift, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Referral() {
  const navigate = useNavigate();

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Refer & Earn</h1>
        </div>

        {/* Coming Soon Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-pulse">
              <Gift className="w-16 h-16 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <Clock className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-3 text-center">
            Coming Soon!
          </h2>
          <p className="text-muted-foreground text-center max-w-xs mb-8">
            Our referral program is being prepared. Soon you'll be able to earn rewards by inviting friends!
          </p>

          <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 text-center">What to expect</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-bold">₦</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Earn ₦200</p>
                  <p className="text-xs text-muted-foreground">For each successful referral</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Friends get ₦100</p>
                  <p className="text-xs text-muted-foreground">Bonus on their first transaction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
