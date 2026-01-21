import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, Wallet, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Stats {
  totalUsers: number;
  totalTransactions: number;
  totalBalance: number;
  failedTransactions: number;
  todayTransactions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTransactions: 0,
    totalBalance: 0,
    failedTransactions: 0,
    todayTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch total users
        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Fetch total transactions
        const { count: transactionsCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true });

        // Fetch failed transactions
        const { count: failedCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed');

        // Fetch today's transactions
        const today = new Date().toISOString().split('T')[0];
        const { count: todayCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today);

        // Fetch total wallet balance (sum)
        const { data: wallets } = await supabase
          .from('wallets')
          .select('balance');
        
        const totalBalance = wallets?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;

        setStats({
          totalUsers: usersCount || 0,
          totalTransactions: transactionsCount || 0,
          totalBalance,
          failedTransactions: failedCount || 0,
          todayTransactions: todayCount || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Balance',
      value: `₦${stats.totalBalance.toLocaleString()}`,
      icon: Wallet,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Transactions',
      value: stats.totalTransactions,
      icon: Receipt,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: "Today's Transactions",
      value: stats.todayTransactions,
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Failed Transactions',
      value: stats.failedTransactions,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your platform</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
