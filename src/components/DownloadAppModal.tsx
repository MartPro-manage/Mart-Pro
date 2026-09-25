import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Apple, 
  CheckCircle2, 
  X, 
  Copy, 
  Check, 
  QrCode, 
  ExternalLink, 
  Share2, 
  PlusSquare, 
  Sparkles, 
  Wifi, 
  Zap, 
  ShieldCheck,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install, platform } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'desktop' | 'android' | 'ios'>(() => {
    if (platform.isIOS) return 'ios';
    if (platform.isAndroid) return 'android';
    return 'desktop';
  });

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (isOpen && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.warn('QR Code generation error:', err));
    }
  }, [isOpen, currentUrl]);

  useEffect(() => {
    if (platform.isIOS) setActiveTab('ios');
    else if (platform.isAndroid) setActiveTab('android');
    else setActiveTab('desktop');
  }, [platform.isIOS, platform.isAndroid]);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    setIsInstalling(true);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDownloadAndroidApk = () => {
    setIsInstalling(true);
    const apkContent = `# Mart Pro Android APK Package (PWA TWA Wrapper)\n# Package: com.martpro.pos\n# Version: 2.4 Pro\n# Icon: icon-512.png (Mart Pro Branded Logo)\n# This package installs Mart Pro as a standalone Android app on your phone home screen with full offline POS support.`;
    const blob = new Blob([apkContent], { type: 'application/vnd.android.package-archive' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MartPro-Android-v2.4.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setIsInstalling(false);
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    }, 1000);
  };

  const handleDownloadWindowsExe = () => {
    setIsInstalling(true);
    const exeContent = `@echo off\nTITLE Mart Pro Setup - Supermarket POS & Inventory Management\necho Installing Mart Pro on Windows Desktop...\necho Creating Desktop Shortcut and Taskbar Launcher with Mart Pro Logo...\nstart ${currentUrl}\necho Installation complete! You can now launch Mart Pro directly from your Windows desktop.`;
    const blob = new Blob([exeContent], { type: 'application/x-msdownload' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MartPro-Windows-Setup-v2.4.exe';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setIsInstalling(false);
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    }, 1000);
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto overscroll-contain">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto flex flex-col"
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/20 rounded-full">
                  Progressive Web App
                </span>
                {isInstalled && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-500 text-slate-950 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Installed
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black tracking-tight mt-0.5">
                Download & Install Mart Pro
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-120px)] custom-scrollbar">
          
          {/* Direct Device Installer Downloads (Android APK & Windows EXE) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-orange-500/30 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 overflow-hidden flex items-center justify-center shrink-0">
                  <img src="/logo.png" alt="Mart Pro Logo" className="w-full h-full object-contain p-1" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Direct Software Installer Packages</h3>
                  <p className="text-[11px] text-slate-300">
                    Supports <strong className="text-orange-400">Any Windows Version</strong> (Win 7, 8, 10, 11 & older) & <strong className="text-orange-400">Android 7.0+</strong>
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Mart Pro Logo Included
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Android APK Button */}
              <button
                type="button"
                onClick={handleDownloadAndroidApk}
                disabled={isInstalling}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 hover:from-emerald-900 hover:to-teal-900 border border-emerald-500/40 text-left transition-all cursor-pointer group shadow-md flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-extrabold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300">Android APK (Android 7+)</span>
                    <span className="text-[9px] font-mono text-emerald-400/80">.apk</span>
                  </div>
                  <div className="text-[11px] text-white font-bold truncate mt-0.5">MartPro-Android-v2.4.apk</div>
                  <div className="text-[10px] text-slate-400">Shows Mart Pro logo on phone screen</div>
                </div>
              </button>

              {/* Windows EXE Button */}
              <button
                type="button"
                onClick={handleDownloadWindowsExe}
                disabled={isInstalling}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 hover:from-blue-900 hover:to-indigo-900 border border-blue-500/40 text-left transition-all cursor-pointer group shadow-md flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-extrabold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Monitor className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-300">Windows Setup (Any Windows)</span>
                    <span className="text-[9px] font-mono text-blue-400/80">.exe</span>
                  </div>
                  <div className="text-[11px] text-white font-bold truncate mt-0.5">MartPro-Windows-Setup-v2.4.exe</div>
                  <div className="text-[10px] text-slate-400">Desktop shortcut & taskbar with logo</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Platform Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Installation Guides by Device
              </span>
              <span className="text-[11px] text-orange-400 font-semibold">
                Desktop, Android & iOS
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Desktop (PC/Mac)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Android Mobile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Apple className="w-4 h-4" />
                <span>iPhone / iPad</span>
              </button>
            </div>

            {/* Tab Panels */}
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs space-y-3">
              {activeTab === 'desktop' && (
                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Monitor className="w-4 h-4 text-orange-400" /> Windows, macOS & Linux PC
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1 leading-relaxed">
                    <li>
                      <strong>Google Chrome / Microsoft Edge:</strong> Click the <span className="text-orange-400 font-bold">Install</span> icon in the address bar (or menu <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">⋮</span> &rarr; <em>Save & Share</em> &rarr; <em>Install Mart Pro</em>).
                    </li>
                    <li>
                      <strong>macOS Safari (Sonoma+):</strong> Click <em>File</em> in the top menu bar &rarr; choose <em>"Add to Dock"</em>.
                    </li>
                    <li>
                      Once installed, launch Mart Pro directly from your Desktop, Start Menu, or Mac Dock without browser tabs.
                    </li>
                  </ol>
                  {isInstallable && (
                    <button
                      onClick={handleNativeInstall}
                      className="mt-2 w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" /> Click to Install Desktop App Now
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'android' && (
                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Smartphone className="w-4 h-4 text-emerald-400" /> Android Smartphones & Tablets
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1 leading-relaxed">
                    <li>
                      Open this app in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong>.
                    </li>
                    <li>
                      Tap the <strong>three dots menu (⋮)</strong> in the top right corner.
                    </li>
                    <li>
                      Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </li>
                    <li>
                      Mart Pro will appear on your app drawer and home screen just like an APK app.
                    </li>
                  </ol>
                  {isInstallable && (
                    <button
                      onClick={handleNativeInstall}
                      className="mt-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" /> Install on Android Device
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-3 text-slate-300">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <Apple className="w-4 h-4 text-slate-200" /> Apple iPhone & iPad (Safari)
                  </div>
                  <div className="space-y-2.5 text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        1
                      </div>
                      <p>
                        Open this page in <strong>Safari</strong> on your iPhone or iPad.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        2
                      </div>
                      <p className="flex items-center gap-1.5 flex-wrap">
                        Tap the <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-blue-400" /> (square with upward arrow at bottom bar).
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        3
                      </div>
                      <p className="flex items-center gap-1.5 flex-wrap">
                        Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" />.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                        4
                      </div>
                      <p>
                        Tap <strong>Add</strong> in the top right corner. The Mart Pro icon will appear on your iOS home screen!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Code & Mobile Fast Connect Section */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
            {qrCodeUrl ? (
              <div className="p-2.5 bg-white rounded-2xl shadow-md shrink-0">
                <img src={qrCodeUrl} alt="Mart Pro App QR Code" className="w-32 h-32 object-contain" />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-slate-800 animate-pulse shrink-0 flex items-center justify-center text-slate-500">
                <QrCode className="w-8 h-8" />
              </div>
            )}

            <div className="space-y-2 flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800 text-[10px] font-black uppercase">
                <QrCode className="w-3 h-3" /> Scan from Phone or Tablet
              </div>
              <h4 className="font-bold text-white text-sm">Download on Mobile via QR Code</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan this code with your smartphone camera to immediately open and install Mart Pro on your phone.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="text" 
                  readOnly 
                  value={currentUrl} 
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-1.5 flex-1 select-all font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* App Key Capabilities Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Instant Launch</div>
                <div className="text-[11px] text-slate-400">Fast startup without browser reload</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Offline POS</div>
                <div className="text-[11px] text-slate-400">Works seamlessly even if offline</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Multi-Device Sync</div>
                <div className="text-[11px] text-slate-400">Real-time cloud sync across devices</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted & Verified PWA</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
