import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Barcode as BarcodeIcon, 
  Check, 
  Upload, 
  SwitchCamera, 
  Sparkles, 
  Send, 
  Zap, 
  Flashlight, 
  FlashlightOff, 
  Copy, 
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  Lock,
  Unlock
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Barcode Scanner',
  subtitle = 'Point camera at barcode or upload image'
}) => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [scannedHistory, setScannedHistory] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessFlash, setScanSuccessFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const qrRegionId = 'html5qr-code-full-region';

  // Sound effect feedback for barcode scan success
  const playBeepSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
      setTimeout(() => {
        audioCtx.close().catch(() => {});
      }, 250);
    } catch (e) {
      // AudioContext ignore
    }
  }, []);

  const formatsToSupport = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.AZTEC
  ];

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch (e) {
        // ignore stop errors
      }
    }
    if (isMountedRef.current) {
      setIsScanning(false);
      setTorchOn(false);
      setHasTorch(false);
    }
  }, []);

  // Handle successful scan from live camera or file
  const handleBarcodeDecoded = useCallback((rawCode: string) => {
    if (!rawCode) return;
    const clean = rawCode.replace(/[\r\n\t]/g, '').trim();
    if (!clean) return;

    const now = Date.now();
    // Debounce identical scans within 800ms to avoid jitter, but allow new items immediately
    if (clean === lastScannedCodeRef.current && (now - lastScannedTimeRef.current) < 800) {
      return;
    }

    lastScannedCodeRef.current = clean;
    lastScannedTimeRef.current = now;

    playBeepSound();
    setScanSuccessFlash(true);
    setTimeout(() => {
      if (isMountedRef.current) setScanSuccessFlash(false);
    }, 600);

    setDetectedBarcode(clean);
    setManualBarcode(clean);
    setScannedHistory(prev => [clean, ...prev.filter(c => c !== clean)].slice(0, 5));

    // If auto-send is enabled, immediately dispatch to the target area
    if (autoSendEnabled) {
      onScanSuccess(clean);
    }
  }, [playBeepSound, autoSendEnabled, onScanSuccess]);

  // Request browser camera permission directly with user gesture and discover cameras
  const requestCameraPermissionAndStart = useCallback(async () => {
    setIsRequestingPermission(true);
    setCameraError(null);
    setPermissionDenied(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported on this browser/device.');
      }

      // Explicitly trigger the browser's permission prompt if not yet allowed
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });

      // Immediately release test tracks so Html5Qrcode has exclusive access
      testStream.getTracks().forEach(track => track.stop());

      // Query available video devices
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') || 
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('wide')
        );
        const chosenId = backCam ? backCam.id : devices[0].id;
        setSelectedCameraId(chosenId);
      }

      setPermissionDenied(false);
      return true;
    } catch (err: any) {
      console.warn('Camera permission request error:', err);
      const isDenied = err.name === 'NotAllowedError' || 
                       err.name === 'PermissionDeniedError' ||
                       String(err).toLowerCase().includes('permission') ||
                       String(err).toLowerCase().includes('denied');
      
      setPermissionDenied(isDenied);
      if (isDenied) {
        setCameraError('Camera access was blocked by browser permissions. Please click "Allow Camera Access" or enable camera in your browser address bar.');
      } else {
        setCameraError(`Camera connection error (${err.name || 'Unavailable'}). You can enter the barcode manually or upload a photo.`);
      }
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, []);

  // Multi-tier resilient scanner startup
  const startScanner = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      await stopScanner();

      if (!isMountedRef.current) return;

      const container = document.getElementById(qrRegionId);
      if (!container) return;

      const html5QrcodeScanner = new Html5Qrcode(qrRegionId, {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      scannerRef.current = html5QrcodeScanner;

      // Custom horizontal scanner box tailored for 1D product barcodes and 2D QR
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const width = Math.min(viewfinderWidth * 0.88, 360);
        const height = Math.min(viewfinderHeight * 0.55, 180);
        return { width: Math.max(width, 220), height: Math.max(height, 120) };
      };

      const scanConfig = {
        fps: 20,
        qrbox: qrboxFunction,
        aspectRatio: 1.3333
      };

      let started = false;

      // Tier 1: Try with selected Camera Device ID if available
      if (selectedCameraId) {
        try {
          await html5QrcodeScanner.start(
            selectedCameraId,
            scanConfig,
            (decodedText) => {
              if (isMountedRef.current) handleBarcodeDecoded(decodedText);
            },
            () => {}
          );
          started = true;
        } catch (e) {
          console.warn('Tier 1 camera start failed, falling back to facingMode:', e);
        }
      }

      // Tier 2: Try with environment facingMode
      if (!started) {
        try {
          await html5QrcodeScanner.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => {
              if (isMountedRef.current) handleBarcodeDecoded(decodedText);
            },
            () => {}
          );
          started = true;
        } catch (e) {
          console.warn('Tier 2 environment camera start failed, falling back to user camera:', e);
        }
      }

      // Tier 3: Try with user facingMode / any available camera
      if (!started) {
        try {
          await html5QrcodeScanner.start(
            { facingMode: 'user' },
            scanConfig,
            (decodedText) => {
              if (isMountedRef.current) handleBarcodeDecoded(decodedText);
            },
            () => {}
          );
          started = true;
        } catch (e) {
          console.warn('Tier 3 user camera start failed:', e);
          throw e;
        }
      }

      if (!isMountedRef.current) {
        await stopScanner();
      } else {
        setIsScanning(true);
        setCameraError(null);
        setPermissionDenied(false);

        // Check if torch/flashlight capability exists
        try {
          // @ts-ignore
          const track = html5QrcodeScanner.getRunningTrackCameraCapabilities?.();
          // @ts-ignore
          if (track && track.torchFeature && track.torchFeature().isSupported()) {
            setHasTorch(true);
          }
        } catch (e) {
          // ignore torch detection error
        }
      }
    } catch (err: any) {
      console.warn('Camera scanner initialization error:', err);
      if (isMountedRef.current) {
        setIsScanning(false);
        const isDenied = err?.name === 'NotAllowedError' || 
                         err?.name === 'PermissionDeniedError' ||
                         String(err).toLowerCase().includes('permission') ||
                         String(err).toLowerCase().includes('denied');
        setPermissionDenied(isDenied);
        if (isDenied) {
          setCameraError('Camera access permission was denied. Tap "Allow Camera Access" below to enable camera.');
        } else {
          setCameraError('Live camera stream unavailable. You can retry camera or enter barcode manually.');
        }
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [selectedCameraId, stopScanner, handleBarcodeDecoded, formatsToSupport]);

  // Initial startup when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setDetectedBarcode(null);
      setManualBarcode('');
      setCameraError(null);
      setPermissionDenied(false);
      return;
    }

    const init = async () => {
      // First check or query cameras if list is empty
      if (cameras.length === 0) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('wide')
            );
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          }
        } catch (e) {
          // ignore enumeration error on startup
        }
      }
      startScanner();
    };

    const timer = setTimeout(init, 150);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, selectedCameraId, startScanner, stopScanner]);

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      // @ts-ignore
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Could not toggle torch:', e);
    }
  };

  // Image Upload Scanner
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      const tempScanner = new Html5Qrcode('temp-qr-scanner-file', {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      const decodedText = await tempScanner.scanFile(file, true);
      try {
        await tempScanner.clear();
      } catch (e) {}

      if (decodedText) {
        handleBarcodeDecoded(decodedText.trim());
      }
    } catch (err) {
      console.warn('File decode error:', err);
      setCameraError('No barcode detected in the uploaded image. Please ensure the image shows a clear barcode label.');
    }
  };

  // Send the scanned barcode number to the target area
  const handleSendBarcode = (codeToSend?: string) => {
    const finalCode = (codeToSend || detectedBarcode || manualBarcode || '').trim();
    if (!finalCode) return;

    playBeepSound();
    onScanSuccess(finalCode);

    // Provide visual confirmation and prepare for next item
    setDetectedBarcode(null);
    setManualBarcode('');
    lastScannedCodeRef.current = '';
    
    // Close modal
    onClose();
  };

  // Allow sending via Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Enter') {
        const code = detectedBarcode || manualBarcode;
        if (code && code.trim()) {
          e.preventDefault();
          handleSendBarcode(code.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, detectedBarcode, manualBarcode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto overscroll-contain">
      {/* Hidden container for file scan processing */}
      <div id="temp-qr-scanner-file" className="hidden" />

      <div className={`bg-white border rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-4 transition-all my-auto max-h-[94vh] overflow-y-auto overscroll-contain custom-scrollbar ${
        scanSuccessFlash ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-slate-200'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl border border-orange-200 shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                {title}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Accurate Detector
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Selector and Torch Toolbar */}
        <div className="flex items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          {cameras.length > 1 ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <SwitchCamera className="w-4 h-4 text-orange-600 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none focus:border-orange-500 text-xs w-full truncate"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${cam.id.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-600 font-medium text-xs">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>High-Accuracy 1D & 2D Engine</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  torchOn ? 'bg-amber-400 text-slate-950 shadow-sm' : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                {torchOn ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5" />}
                <span>{torchOn ? 'Flash On' : 'Flash'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={requestCameraPermissionAndStart}
              disabled={isRequestingPermission}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Refresh / Grant Camera Permission"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-orange-600 ${isRequestingPermission ? 'animate-spin' : ''}`} />
              <span>{isRequestingPermission ? 'Requesting...' : 'Reload Cam'}</span>
            </button>
          </div>
        </div>

        {/* Camera Region Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-300 min-h-[220px] flex items-center justify-center shadow-inner">
          <div id={qrRegionId} className="w-full" />
          
          {/* Laser overlay animation when scanning */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[85%] h-[140px] border-2 border-dashed border-orange-400/90 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                {/* Red Laser beam line */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                <span className="absolute bottom-2 text-[10px] font-bold text-orange-200 bg-slate-950/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-orange-500/30">
                  Align Barcode Inside Box
                </span>
              </div>
            </div>
          )}

          {/* Camera Permission / Error Recovery View */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center space-y-3.5 z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg">
                {permissionDenied ? <Lock className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>

              <div className="max-w-xs space-y-1">
                <h4 className="text-sm font-bold text-white">
                  {permissionDenied ? 'Camera Permission Required' : 'Camera Access Notice'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {cameraError}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-1">
                <button
                  type="button"
                  onClick={requestCameraPermissionAndStart}
                  disabled={isRequestingPermission}
                  className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{isRequestingPermission ? 'Prompting...' : 'Allow Camera Access'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SCANNED BARCODE NUMBER DISPLAY & SEND ACTION AREA */}
        {detectedBarcode && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 shadow-md space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Barcode Scanned Successfully!
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                Ready to Send
              </span>
            </div>

            {/* Large High-Contrast Barcode Number */}
            <div className="bg-white border border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 min-w-0">
                <BarcodeIcon className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Scanned Number</span>
                  <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider truncate block select-all">
                    {detectedBarcode}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(detectedBarcode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                title="Copy Barcode"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* SEND BUTTON TO SEND TO BARCODE AREA */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSendBarcode(detectedBarcode)}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Send to Barcode Area</span>
                <span className="text-[10px] font-mono bg-emerald-800/60 px-1.5 py-0.5 rounded font-bold">↵ Enter</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDetectedBarcode(null);
                  setManualBarcode('');
                  lastScannedCodeRef.current = '';
                }}
                className="py-3 px-3.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                title="Scan next item without sending"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rescan</span>
              </button>
            </div>
          </div>
        )}

        {/* Manual Barcode Input & Direct Send Form */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BarcodeIcon className="w-4 h-4 text-orange-600" /> Barcode Number / Manual Entry
            </label>
            <span className="text-[11px] text-slate-500">Press Send to dispatch</span>
          </div>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (manualBarcode.trim()) {
                handleSendBarcode(manualBarcode.trim());
              }
            }} 
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Type or scan barcode number..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-orange-500 focus:bg-white font-bold"
            />
            <button
              type="submit"
              disabled={!manualBarcode.trim()}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black rounded-xl shadow-sm transition-all text-xs cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>

        {/* File Image Upload Option */}
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-800 block">Have a photo or file of barcode?</span>
            <span className="text-[11px] text-slate-500 font-medium">Upload photo to detect barcode number</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" /> Upload Photo
          </button>
        </div>

        {/* Recently Scanned Items History */}
        {scannedHistory.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
              Recently Scanned Barcodes (Click to Send):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {scannedHistory.map((code, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendBarcode(code)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-900 border border-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>{code}</span>
                  <ArrowRight className="w-3 h-3 text-orange-500" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
