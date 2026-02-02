import { useEffect, useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Gift, Copy, Check, Users, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ReferralSettings {
  min_funding_amount: number;
  referrer_bonus: number;
  is_enabled: boolean;
}

interface Referral {
  id: string;
  status: 'pending' | 'completed' | 'bonus_paid';
  referrer_bonus: number;
  funding_amount: number | null;
  funding_triggered_at: string | null;
  created_at: string;
  referee?: { full_name: string };
}

interface Profile {
  id: string;
  referral_code: string;
}

export default function Referral() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch referral settings
        const { data: settingsData } = await supabase
          .from('referral_settings')
          .select('min_funding_amount, referrer_bonus, is_enabled')
          .limit(1)
          .single();

        setSettings(settingsData);

        // Fetch user's profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, referral_code')
          .eq('user_id', user.id)
          .single();

        setProfile(profileData);

        // Fetch user's referrals
        if (profileData) {
          const { data: referralsData } = await supabase
            .from('referrals')
            .select('*')
            .eq('referrer_id', profileData.id)
            .order('created_at', { ascending: false });

          // Fetch referee names
          if (referralsData && referralsData.length > 0) {
            const refereeIds = referralsData.map(r => r.referee_id);
            const { data: refereesData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', refereeIds);

            const refereesMap = new Map(refereesData?.map(r => [r.id, r]) || []);
            
            const enrichedReferrals = referralsData.map(r => ({
              ...r,
              referee: refereesMap.get(r.referee_id)
            }));

            setReferrals(enrichedReferrals);
          }
        }
      } catch (error) {
        console.error('Error fetching referral data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleCopyCode = async () => {
    if (!profile?.referral_code) return;

    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleShare = async () => {
    if (!profile?.referral_code) return;

    const shareText = `Join me on Ramadan Data App and get started! Use my referral code: ${profile.referral_code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Ramadan Data App',
          text: shareText,
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      handleCopyCode();
    }
  };

  const getStatusBadge = (referral: Referral) => {
    if (referral.status === 'bonus_paid') {
      return <Badge className="bg-green-500">Paid</Badge>;
    }
    if (referral.funding_triggered_at) {
      return <Badge className="bg-yellow-500">Awaiting Approval</Badge>;
    }
    return <Badge variant="secondary">Pending Funding</Badge>;
  };

  const totalEarnings = referrals
    .filter(r => r.status === 'bonus_paid')
    .reduce((sum, r) => sum + Number(r.referrer_bonus), 0);

  const pendingCount = referrals.filter(r => 
    r.funding_triggered_at && r.status !== 'bonus_paid'
  ).length;

  if (!settings?.is_enabled) {
    return (
      <MobileLayout showNav={false}>
        <div className="safe-area-top flex flex-col">
          <div className="flex items-center gap-4 px-4 py-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">Refer & Earn</h1>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Gift className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Program Paused</h2>
            <p className="text-muted-foreground text-center">
              The referral program is currently unavailable. Check back soon!
            </p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Refer & Earn</h1>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <div className="flex-1 px-4 pb-6 space-y-6">
            {/* Hero Card */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <Gift className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Earn ₦{settings?.referrer_bonus || 50}</h2>
                    <p className="text-primary-foreground/80 text-sm">For each successful referral</p>
                  </div>
                </div>

                <p className="text-sm text-primary-foreground/90 mb-4">
                  Invite friends to join. When they fund their account with at least 
                  <strong> ₦{settings?.min_funding_amount?.toLocaleString() || '1,000'}</strong>, 
                  you'll earn <strong>₦{settings?.referrer_bonus || 50}</strong>!
                </p>

                {/* Referral Code Box */}
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-xs text-primary-foreground/70 mb-1">Your Referral Code</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-wider flex-1">
                      {profile?.referral_code || '---'}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/20 hover:bg-white/30"
                      onClick={handleCopyCode}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full mt-4 bg-white text-primary hover:bg-white/90"
                  onClick={handleShare}
                >
                  Share with Friends
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xl font-bold">{referrals.length}</p>
                  <p className="text-xs text-muted-foreground">Referrals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                  <p className="text-xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <p className="text-xl font-bold">₦{totalEarnings.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Earned</p>
                </CardContent>
              </Card>
            </div>

            {/* Referral List */}
            <div>
              <h3 className="font-semibold mb-3">Your Referrals</h3>
              {referrals.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No referrals yet</p>
                    <p className="text-sm">Share your code to start earning!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {referrals.map((referral) => (
                    <Card key={referral.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {referral.referee?.full_name || 'User'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(referral.created_at).toLocaleDateString()}
                              {referral.funding_amount && (
                                <> • Funded ₦{Number(referral.funding_amount).toLocaleString()}</>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(referral)}
                            {referral.status === 'bonus_paid' && (
                              <p className="text-xs text-green-600 mt-1">
                                +₦{Number(referral.referrer_bonus).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* How it Works */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">How it Works</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                    <p className="text-sm text-muted-foreground">Share your referral code with friends</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                    <p className="text-sm text-muted-foreground">They sign up using your code</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                    <p className="text-sm text-muted-foreground">They fund their account with ₦{settings?.min_funding_amount?.toLocaleString() || '1,000'}+</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</div>
                    <p className="text-sm text-muted-foreground">You receive ₦{settings?.referrer_bonus || 50} after admin approval</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}