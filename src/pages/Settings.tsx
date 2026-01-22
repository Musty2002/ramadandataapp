import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Moon, Sun, Bell, Globe, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [notifications, setNotifications] = useState(
    localStorage.getItem('notifications_enabled') !== 'false'
  );

  const handleDarkModeToggle = (enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setDarkMode(enabled);
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
    setNotifications(enabled);
    toast({
      title: enabled ? 'Notifications Enabled' : 'Notifications Disabled',
      description: enabled 
        ? 'You will receive push notifications'
        : 'Push notifications have been turned off',
    });
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
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Settings Options */}
        <div className="space-y-4">
          {/* Appearance */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
                </div>
              </div>
              <Switch 
                checked={darkMode} 
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive transaction alerts</p>
                </div>
              </div>
              <Switch 
                checked={notifications} 
                onCheckedChange={handleNotificationsToggle}
              />
            </div>
          </div>

          {/* Language */}
          <button className="w-full bg-card rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">Language</p>
              <p className="text-sm text-muted-foreground">English</p>
            </div>
          </button>

          {/* About */}
          <button className="w-full bg-card rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">About</p>
              <p className="text-sm text-muted-foreground">Version 1.0.0</p>
            </div>
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
