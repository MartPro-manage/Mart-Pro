import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, CheckCircle2, AlertCircle, Loader2, X, Send, Sparkles } from 'lucide-react';
import { Sale, Store } from '../types';
import { queueEReceiptEmail } from '../lib/zSender';

interface SendEReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  store: Store;
  defaultEmail?: string;
}

export const SendEReceiptModal: React.FC<SendEReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  store,
  defaultEmail = ''
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Please enter a valid Gmail / Email address.');
      return;
    }

    setSending(true);
    setStatus('idle');
    setErrorMessage('');

    const res = await queueEReceiptEmail({
      toEmail: email,
      sale,
      store
    });

    setSending(false);

    if (res.success) {
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2500);
    } else {
      setStatus('error');
      setErrorMessage(res.error || 'Failed to dispatch email via Z-Sender queue.');
    }
  };

  const receiptNo = sale.receiptNumber || `#${sale.id.slice(-6).toUpperCase()}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-white"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Icon */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                Send Digital E-Receipt
                <Sparkles className="w-4 h-4 text-orange-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Automated Z-Sender dispatch for {receiptNo}
              </p>
            </div>
          </div>

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 text-center space-y-3"
            >
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-white">E-Receipt Scheduled!</h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                Digital invoice has been scheduled in Z-Sender and will be delivered to <strong className="text-orange-400">{email}</strong> in 2 minutes.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Customer Email / Gmail Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. customer@gmail.com"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-orange-500 text-white rounded-xl text-sm outline-none transition-all pl-10"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {status === 'error' && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Store:</span>
                  <span className="font-semibold text-white">{store.name}</span>
                </div>
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Total Amount:</span>
                  <span className="font-bold text-orange-400">{store.currencySymbol || 'Rs.'} {(sale.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-600/20"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Queueing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send E-Receipt
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
