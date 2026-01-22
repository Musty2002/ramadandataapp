import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          email: email 
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Edit Profile</h1>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={profile?.phone || ''}
              disabled
              className="mt-1 bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">Phone number cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={profile?.account_number || ''}
              disabled
              className="mt-1 bg-muted"
            />
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="w-full mt-8"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </MobileLayout>
  );
}
