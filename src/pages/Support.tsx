import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, MessageCircle, Phone, Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const supportOptions = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Support',
    description: 'Chat with us on WhatsApp',
    action: () => window.open('https://wa.me/2349061813118', '_blank'),
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Phone,
    title: 'Call Us',
    description: '09061813118',
    action: () => window.open('tel:09061813118', '_blank'),
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'support@rdsdata.ng',
    action: () => window.open('mailto:support@rdsdata.ng', '_blank'),
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
];

const faqs = [
  {
    question: 'How do I fund my wallet?',
    answer: 'You can fund your wallet via bank transfer to your dedicated virtual account number shown on your dashboard.',
  },
  {
    question: 'How long does data purchase take?',
    answer: 'Data purchases are instant. If you experience any delay, please contact support.',
  },
  {
    question: 'What if my transaction fails?',
    answer: 'Failed transactions are automatically refunded within 24 hours. If not, contact support.',
  },
  {
    question: 'How do I reset my transaction PIN?',
    answer: 'Go to Profile > Security > Transaction PIN and disable/re-enable to set a new PIN.',
  },
];

export default function Support() {
  const navigate = useNavigate();

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
          <h1 className="text-xl font-bold">Help & Support</h1>
        </div>

        {/* Contact Options */}
        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Contact Us</h2>
          {supportOptions.map(({ icon: Icon, title, description, action, color, bgColor }) => (
            <button
              key={title}
              onClick={action}
              className="w-full bg-card rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map(({ question, answer }) => (
              <div key={question} className="bg-card rounded-xl p-4 shadow-sm">
                <p className="font-medium mb-2">{question}</p>
                <p className="text-sm text-muted-foreground">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
