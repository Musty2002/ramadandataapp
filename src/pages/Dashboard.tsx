import { MobileLayout } from '@/components/layout/MobileLayout';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { ServicesGrid } from '@/components/dashboard/ServicesGrid';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import logo from '@/assets/logo.jpeg';

export default function Dashboard() {
  return (
    <MobileLayout>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4">
          <img src={logo} alt="Ramadan Data Sub" className="h-10 w-10 rounded-full object-cover" />
          <h1 className="text-lg font-bold text-primary">Ramadan Data Sub</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
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