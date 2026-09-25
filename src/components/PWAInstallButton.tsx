import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, CheckCircle2, Smartphone, Monitor, Sparkles } from 'lucide-react';
import { DownloadAppModal } from './DownloadAppModal';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'nav' | 'minimal' | 'banner';
  className?: string;
  onOpenModal?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'sidebar', 
  className = '',
  onOpenModal
}) => {
  const { isInstallable, isInstalled, install, platform } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleClick = async () => {
    if (onOpenModal) {
      onOpenModal();
      return;
    }
    // If native prompt is ready and we're on desktop/android, try direct prompt first or open modal
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const res = await install();
        if (res !== 'accepted') {
          setIsModalOpen(true);
        }
      } catch {
        setIsModalOpen(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const renderContent = () => {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleClick}
          title="Download & Install Mart Pro Web App for Desktop or Mobile"
          className={`
            w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer
            bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/10 
            text-orange-400 hover:from-orange-600 hover:to-amber-600 hover:text-white border border-orange-500/30
            shadow-sm hover:shadow-orange-950/30 group
            ${className}
          `}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-6 h-6 rounded-lg bg-orange-500/20 group-hover:bg-white/20 flex items-center justify-center shrink-0 text-orange-400 group-hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div className="text-left min-w-0">
              <div className="truncate font-black">Download Web App</div>
              <div className="text-[10px] text-orange-400/80 group-hover:text-white/80 font-normal truncate">
                Desktop & Mobile PWA
              </div>
            </div>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-orange-500/30 text-orange-300 group-hover:bg-white group-hover:text-orange-600 shrink-0 uppercase tracking-wider">
            {isInstalled ? 'Installed' : 'App'}
          </span>
        </button>
      );
    }

    if (variant === 'nav') {
      return (
        <button
          type="button"
          onClick={handleClick}
          title="Download & Install Mart Pro App on PC or Mobile"
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-xl 
            bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 
            text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer
            ${className}
          `}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download App</span>
        </button>
      );
    }

    // Default minimal
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  };

  return (
    <>
      {renderContent()}
      <DownloadAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
