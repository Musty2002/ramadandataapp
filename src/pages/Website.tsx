import { Link } from 'react-router-dom';
import { Smartphone, Wifi, Zap, Tv, ArrowRight, Shield, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/ramadan-logo.jpeg';

export default function Website() {
  const services = [
    {
      icon: Wifi,
      title: 'Data Bundles',
      description: 'Get affordable data plans for MTN, Airtel, Glo, and 9mobile at discounted rates.',
    },
    {
      icon: Smartphone,
      title: 'Airtime Top-up',
      description: 'Instant airtime recharge for all Nigerian networks with instant delivery.',
    },
    {
      icon: Zap,
      title: 'Electricity Bills',
      description: 'Pay your PHCN/electricity bills for all distribution companies nationwide.',
    },
    {
      icon: Tv,
      title: 'TV Subscriptions',
      description: 'Renew your DStv, GOtv, and Startimes subscriptions instantly.',
    },
  ];

  const features = [
    {
      icon: Shield,
      title: 'Secure Transactions',
      description: 'Your payments are protected with bank-level security.',
    },
    {
      icon: Clock,
      title: 'Instant Delivery',
      description: 'Get your services delivered within seconds.',
    },
    {
      icon: Users,
      title: 'Referral Bonuses',
      description: 'Earn rewards when you refer friends and family.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Ramadan Data App" className="h-10 w-10 rounded-full object-cover" />
              <span className="text-xl font-bold text-primary">Ramadan Data App</span>
            </div>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Affordable Data & <span className="text-primary">Bill Payments</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Buy data bundles, airtime, pay electricity bills, and TV subscriptions at the best rates in Nigeria. Fast, secure, and reliable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto">
                Start Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Our Services</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to stay connected and manage your bills in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <div
                key={service.title}
                className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="text-muted-foreground text-sm">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Why Choose Us?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We provide the best experience for all your digital payments.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join thousands of Nigerians who trust Ramadan Data App for their daily digital needs.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary">
              Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Ramadan Data App" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-semibold text-foreground">Ramadan Data App</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ramadan Data App. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
