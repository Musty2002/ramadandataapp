import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle, Share2, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import logo from '@/assets/logo.jpeg';

import mtnLogo from '@/assets/mtn-logo.png';
import airtelLogo from '@/assets/airtel-logo.jpg';
import gloLogo from '@/assets/glo-logo.jpg';
import nineMobileLogo from '@/assets/9mobile-logo.jpg';

const networkLogos: Record<string, string> = {
  'mtn': mtnLogo,
  'MTN': mtnLogo,
  'airtel': airtelLogo,
  'AIRTEL': airtelLogo,
  'glo': gloLogo,
  'GLO': gloLogo,
  '9mobile': nineMobileLogo,
  '9MOBILE': nineMobileLogo,
};

const networkColors: Record<string, string> = {
  'mtn': 'text-yellow-500',
  'MTN': 'text-yellow-500',
  'airtel': 'text-red-500',
  'AIRTEL': 'text-red-500',
  'glo': 'text-green-500',
  'GLO': 'text-green-500',
  '9mobile': 'text-emerald-600',
  '9MOBILE': 'text-emerald-600',
};

interface TransactionReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    date: Date;
    phoneNumber: string;
    network: string;
    amount: number;
    type: 'airtime' | 'data' | 'electricity' | 'tv' | 'exam';
    dataPlan?: string;
    description?: string;
  };
}

export function TransactionReceipt({ open, onClose, transaction }: TransactionReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const generateTransactionId = () => {
    const dateStr = format(transaction.date, 'yyyyMMdd');
    const randomStr = transaction.id?.substring(0, 8).toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RDS-${dateStr}-${randomStr}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTypeLabel = () => {
    switch (transaction.type) {
      case 'airtime': return 'Airtime Top-up';
      case 'data': return 'Data Bundle';
      case 'electricity': return 'Electricity';
      case 'tv': return 'TV Subscription';
      case 'exam': return 'Exam PIN';
      default: return 'Transaction';
    }
  };

  const captureReceipt = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing receipt:', error);
      return null;
    }
  };

  const handleShare = async () => {
    const imageData = await captureReceipt();
    if (!imageData) {
      toast.error('Failed to generate receipt image');
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        const fileName = `receipt-${generateTransactionId()}.png`;
        const base64Data = imageData.replace('data:image/png;base64,', '');
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Transaction Receipt',
          text: `${getTypeLabel()} - ${formatCurrency(transaction.amount)}`,
          url: fileUri.uri,
          dialogTitle: 'Share Receipt',
        });

        toast.success('Receipt shared!');
      } catch (error) {
        console.error('Native share error:', error);
        toast.error('Failed to share receipt');
      }
    } else {
      // Web share
      try {
        const blob = await (await fetch(imageData)).blob();
        const file = new File([blob], `receipt-${generateTransactionId()}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Transaction Receipt',
            text: `${getTypeLabel()} - ${formatCurrency(transaction.amount)}`,
            files: [file],
          });
          toast.success('Receipt shared!');
        } else {
          // Fallback: download
          handleDownload();
        }
      } catch (error) {
        console.error('Web share error:', error);
        handleDownload();
      }
    }
  };

  const handleDownload = async () => {
    const imageData = await captureReceipt();
    if (!imageData) {
      toast.error('Failed to generate receipt image');
      return;
    }

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        const fileName = `receipt-${generateTransactionId()}.png`;
        const base64Data = imageData.replace('data:image/png;base64,', '');
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });

        toast.success('Receipt saved to Documents!');
      } catch (error) {
        console.error('Save error:', error);
        toast.error('Failed to save receipt');
      }
    } else {
      // Web download
      const link = document.createElement('a');
      link.download = `receipt-${generateTransactionId()}.png`;
      link.href = imageData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Receipt downloaded!');
    }
  };

  if (!open) return null;

  const networkLogo = networkLogos[transaction.network];
  const networkColor = networkColors[transaction.network] || 'text-primary';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Receipt content */}
        <div ref={receiptRef} className="bg-white p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Transaction Successful</h2>
            <p className="text-sm text-gray-500">{format(transaction.date, 'PPpp')}</p>
          </div>

          {/* Amount */}
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
            <p className="text-sm text-gray-500 mt-1">{getTypeLabel()}</p>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Transaction ID</span>
              <span className="font-medium text-gray-900 text-sm">{generateTransactionId()}</span>
            </div>
            
            {transaction.type === 'data' || transaction.type === 'airtime' ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Network</span>
                  <div className="flex items-center gap-2">
                    {networkLogo && (
                      <img src={networkLogo} alt={transaction.network} className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className={`font-medium text-sm ${networkColor}`}>
                      {transaction.network.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Phone Number</span>
                  <span className="font-medium text-gray-900 text-sm">{transaction.phoneNumber}</span>
                </div>
                {transaction.dataPlan && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">Data Plan</span>
                    <span className="font-medium text-gray-900 text-sm">{transaction.dataPlan}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Description</span>
                <span className="font-medium text-gray-900 text-sm">{transaction.description || transaction.phoneNumber}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Status</span>
              <span className="font-medium text-green-600 text-sm">Completed</span>
            </div>
          </div>

          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-dashed border-gray-200">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="text-sm font-semibold text-gray-600">RDS Data</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 bg-gray-50 border-t">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button 
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
