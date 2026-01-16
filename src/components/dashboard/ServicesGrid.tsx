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
  { icon: Wifi, label: 'Data', path: '/data' },
  { icon: Phone, label: 'Airtime', path: '/airtime' },
  { icon: CreditCard, label: 'Exam Pins', path: '/exam-pins' },
  { icon: Zap, label: 'Electricity', path: '/electricity' },
  { icon: Tv, label: 'TV Sub', path: '/tv' },
  { icon: Banknote, label: 'Airtime to Cash', path: '/airtime-to-cash' },
  { icon: Fingerprint, label: 'BVN/NIN', path: '/bvn-nin' },
  { icon: Gift, label: 'Refer & Earn', path: '/referral' },
];

export function ServicesGrid() {
  const navigate = useNavigate();

  return (
    <div className="mx-4 my-6 p-5 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg">
      <h3 className="text-sm font-semibold text-primary-foreground/80 mb-4">Services</h3>
      <div className="grid grid-cols-4 gap-4">
        {services.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-white/30 group-active:scale-95">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-white/90 font-medium text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
