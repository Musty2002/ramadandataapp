import { MobileLayout } from '@/components/layout/MobileLayout';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { ServicesGrid } from '@/components/dashboard/ServicesGrid';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.jpeg';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <img src={logo} alt="Ramadan Data Sub" className="h-10 w-10 rounded-full object-cover" />
          <h1 className="text-lg font-bold text-primary">Ramadan Data Sub</h1>
          <button 
            onClick={() => navigate('/notifications')}
            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>

        {/* Account Card */}
        <AccountCard />

        {/* Services Grid */}
        <ServicesGrid />

        {/* Recent Transactions */}
        <RecentTransactions />
      </div>
    </MobileLayout>
  );
}