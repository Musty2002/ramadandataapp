import { MobileLayout } from '@/components/layout/MobileLayout';
import { 
  Wifi, 
  Phone, 
  Zap, 
  Tv, 
  CreditCard,
  Gift,
  Banknote,
  Fingerprint,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const services = [
  { 
    icon: Wifi, 
    label: 'Data', 
    description: 'Buy data bundles',
    path: '/data', 
    color: 'bg-purple-100 text-purple-600' 
  },
  { 
    icon: Phone, 
    label: 'Airtime', 
    description: 'Recharge your line',
    path: '/airtime', 
    color: 'bg-green-100 text-green-600' 
  },
  { 
    icon: CreditCard, 
    label: 'Data Card', 
    description: 'Purchase data cards',
    path: '/data-card', 
    color: 'bg-blue-100 text-blue-600' 
  },
  { 
    icon: Zap, 
    label: 'Electricity', 
    description: 'Pay electricity bills',
    path: '/electricity', 
    color: 'bg-yellow-100 text-yellow-600' 
  },
  { 
    icon: Tv, 
    label: 'TV Subscription', 
    description: 'DSTV, GOTV, Startimes',
    path: '/tv', 
    color: 'bg-red-100 text-red-600' 
  },
  { 
    icon: Banknote, 
    label: 'Airtime to Cash', 
    description: 'Convert airtime to cash',
    path: '/airtime-to-cash', 
    color: 'bg-indigo-100 text-indigo-600' 
  },
  { 
    icon: Fingerprint, 
    label: 'BVN/NIN', 
    description: 'Verify your identity',
    path: '/bvn-nin', 
    color: 'bg-orange-100 text-orange-600' 
  },
  { 
    icon: Gift, 
    label: 'Refer & Earn', 
    description: 'Earn ₦200 per referral',
    path: '/referral', 
    color: 'bg-pink-100 text-pink-600' 
  },
];

export default function Services() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="safe-area-top px-4 py-6">
        <h1 className="text-xl font-bold text-foreground mb-6">All Services</h1>

        <div className="space-y-3">
          {services.map(({ icon: Icon, label, description, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full bg-card rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}