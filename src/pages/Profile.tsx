import { MobileLayout } from '@/components/layout/MobileLayout';
import { 
  User, 
  Settings, 
  HelpCircle, 
  Shield, 
  LogOut, 
  ChevronRight,
  Gift,
  Bell
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const menuItems = [
  { icon: User, label: 'Edit Profile', path: '/profile/edit' },
  { icon: Gift, label: 'Refer & Earn', path: '/referral' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: Shield, label: 'Security', path: '/security' },
  { icon: HelpCircle, label: 'Help & Support', path: '/support' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MobileLayout>
      <div className="safe-area-top px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-16 h-16">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{profile?.full_name || 'User'}</h1>
            <p className="text-sm text-muted-foreground">{profile?.phone}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        {/* Account Number Card */}
        <div className="bg-card rounded-xl p-4 mb-6 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Account Number</p>
          <p className="text-lg font-semibold text-foreground">{profile?.account_number}</p>
        </div>

        {/* Menu Items */}
        <div className="space-y-2 mb-8">
          {menuItems.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full bg-card rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Icon className="w-5 h-5 text-secondary-foreground" />
              </div>
              <span className="flex-1 text-left font-medium text-foreground">{label}</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleSignOut}
          className="w-full bg-destructive/10 rounded-xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <span className="flex-1 text-left font-medium text-destructive">Log Out</span>
        </button>
      </div>
    </MobileLayout>
  );
}