import { 
  Wifi, 
  Phone, 
  Zap, 
  Tv, 
  CreditCard,
  Gift,
  Banknote,
  Fingerprint
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const services = [
  { icon: Wifi, label: 'Data', path: '/data', color: 'bg-purple-100 text-purple-600' },
  { icon: Phone, label: 'Airtime', path: '/airtime', color: 'bg-green-100 text-green-600' },
  { icon: CreditCard, label: 'Data Card', path: '/data-card', color: 'bg-blue-100 text-blue-600' },
  { icon: Zap, label: 'Electricity', path: '/electricity', color: 'bg-yellow-100 text-yellow-600' },
  { icon: Tv, label: 'TV Sub', path: '/tv', color: 'bg-red-100 text-red-600' },
  { icon: Banknote, label: 'Airtime to Cash', path: '/airtime-to-cash', color: 'bg-indigo-100 text-indigo-600' },
  { icon: Fingerprint, label: 'BVN/NIN', path: '/bvn-nin', color: 'bg-orange-100 text-orange-600' },
  { icon: Gift, label: 'Refer & Earn', path: '/referral', color: 'bg-pink-100 text-pink-600' },
];

export function ServicesGrid() {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Services</h3>
      <div className="grid grid-cols-4 gap-4">
        {services.map(({ icon: Icon, label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center transition-transform group-hover:scale-105`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs text-foreground font-medium text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}