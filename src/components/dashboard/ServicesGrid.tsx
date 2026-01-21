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
  { icon: Wifi, label: 'Data', path: '/data', comingSoon: false },
  { icon: Phone, label: 'Airtime', path: '/airtime', comingSoon: false },
  { icon: CreditCard, label: 'Exam Pins', path: '/exam-pins', comingSoon: false },
  { icon: Zap, label: 'Electricity', path: '/electricity', comingSoon: false },
  { icon: Tv, label: 'TV Sub', path: '/tv', comingSoon: false },
  { icon: Banknote, label: 'Airtime to Cash', path: '/airtime-to-cash', comingSoon: true },
  { icon: Fingerprint, label: 'BVN/NIN', path: '/bvn-nin', comingSoon: false },
  { icon: Gift, label: 'Refer & Earn', path: '/referral', comingSoon: false },
];

export function ServicesGrid() {
  const navigate = useNavigate();

  const handleServiceClick = (path: string, comingSoon: boolean) => {
    if (comingSoon) {
      return; // Don't navigate for coming soon items
    }
    navigate(path);
  };

  return (
    <div className="mx-4 my-6 p-5 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg">
      <h3 className="text-sm font-semibold text-primary-foreground/80 mb-4">Services</h3>
      <div className="grid grid-cols-4 gap-4">
        {services.map(({ icon: Icon, label, path, comingSoon }) => (
          <button
            key={path}
            onClick={() => handleServiceClick(path, comingSoon)}
            className={`flex flex-col items-center gap-2 group relative ${comingSoon ? 'opacity-60' : ''}`}
          >
            <div className={`w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all ${
              comingSoon ? '' : 'group-hover:scale-110 group-hover:bg-white/30 group-active:scale-95'
            }`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-white/90 font-medium text-center leading-tight">{label}</span>
            {comingSoon && (
              <span className="absolute -top-1 -right-1 text-[8px] bg-white text-primary px-1.5 py-0.5 rounded-full font-semibold">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
