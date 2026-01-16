import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeft, Check, Loader2, BookOpen, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ExamPin {
  id: string;
  name: string;
  code: string;
  service_id: number;
  price: number;
}

export default function ExamPins() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [examPins, setExamPins] = useState<ExamPin[]>([]);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchasedPins, setPurchasedPins] = useState<{ pin: string; serial: string }[]>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchExamPins();
    fetchBalance();
  }, []);

  const fetchExamPins = async () => {
    const { data, error } = await supabase
      .from('exam_pins')
      .select('*')
      .eq('is_active', true)
      .order('price');

    if (!error && data) {
      setExamPins(data);
    }
  };

  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setBalance(Number(data.balance));
    }
  };

  const handlePurchase = async () => {
    if (!selectedExam) {
      toast({
        variant: 'destructive',
        title: 'Missing Selection',
        description: 'Please select an exam type',
      });
      return;
    }

    const exam = examPins.find(e => e.code === selectedExam);
    if (!exam) return;

    const totalPrice = exam.price * quantity;
    if (totalPrice > balance) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Balance',
        description: 'Please fund your wallet',
      });
      return;
    }

    setIsPurchasing(true);
    setPurchasedPins([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-exam-pin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exam_code: selectedExam,
            quantity,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.pins?.length > 0) {
        setPurchasedPins(data.pins);
        toast({
          title: 'Purchase Successful!',
          description: `${data.pins.length} PIN(s) purchased`,
        });
        fetchBalance();
      } else {
        toast({
          variant: 'destructive',
          title: 'Purchase Failed',
          description: data.error || 'Failed to purchase PIN',
        });
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: 'An error occurred. Please try again.',
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'PIN copied to clipboard',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const getExamColor = (code: string) => {
    const colors: Record<string, string> = {
      waec: 'from-green-500 to-green-600',
      neco: 'from-blue-500 to-blue-600',
      nabteb: 'from-purple-500 to-purple-600',
    };
    return colors[code] || 'from-gray-500 to-gray-600';
  };

  const selectedExamData = examPins.find(e => e.code === selectedExam);
  const totalPrice = selectedExamData ? selectedExamData.price * quantity : 0;

  return (
    <MobileLayout showNav={false}>
      <div className="safe-area-top">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Exam Pins</h1>
        </div>

        {/* Balance Card */}
        <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-primary to-primary/80 rounded-xl">
          <p className="text-sm text-primary-foreground/80">Available Balance</p>
          <p className="text-2xl font-bold text-primary-foreground">{formatPrice(balance)}</p>
        </div>

        <div className="px-4 pb-6">
          {/* Purchased Pins Display */}
          {purchasedPins.length > 0 && (
            <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-success" />
                <span className="text-sm font-medium text-success">Purchase Successful!</span>
              </div>
              <div className="space-y-3">
                {purchasedPins.map((pin, index) => (
                  <div key={index} className="p-3 bg-background rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">PIN #{index + 1}</p>
                        <p className="font-mono font-bold text-foreground">{pin.pin || 'N/A'}</p>
                        {pin.serial && (
                          <p className="text-xs text-muted-foreground mt-1">Serial: {pin.serial}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(pin.pin)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => {
                  setPurchasedPins([]);
                  setSelectedExam(null);
                  setQuantity(1);
                }}
              >
                Buy More
              </Button>
            </div>
          )}

          {purchasedPins.length === 0 && (
            <>
              {/* Exam Selection */}
              <div className="mb-6">
                <Label className="mb-3 block">Select Exam</Label>
                <div className="space-y-3">
                  {examPins.map((exam) => (
                    <button
                      key={exam.code}
                      onClick={() => setSelectedExam(exam.code)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        selectedExam === exam.code
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getExamColor(exam.code)} flex items-center justify-center`}>
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold text-foreground">{exam.name}</p>
                        <p className="text-sm text-primary font-bold">{formatPrice(exam.price)}</p>
                      </div>
                      {selectedExam === exam.code && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selection */}
              {selectedExam && (
                <div className="mb-6">
                  <Label className="mb-3 block">Quantity</Label>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </Button>
                    <span className="text-2xl font-bold min-w-[3rem] text-center">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      disabled={quantity >= 10}
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Maximum 10 pins per purchase</p>
                </div>
              )}

              {/* Total and Purchase */}
              {selectedExam && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total</span>
                      <span className="text-xl font-bold text-foreground">{formatPrice(totalPrice)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePurchase}
                    disabled={isPurchasing || totalPrice > balance}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      `Buy ${quantity} PIN${quantity > 1 ? 's' : ''}`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Info */}
          <div className="mt-6 bg-accent/10 rounded-xl p-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">How it works:</span> Purchase result checker PINs instantly.
              Your PIN(s) will be displayed immediately after purchase. Make sure to copy and save them.
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
