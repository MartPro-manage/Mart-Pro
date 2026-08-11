import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, Barcode as BarcodeIcon, Check, Upload, SwitchCamera, Sparkles } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessFlash, setScanSuccessFlash] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);
  const qrRegionId = 'html5qr-code-full-region';

  // Sound effect feedback for barcode scan success
  const playBeepSound = () => {
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
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
      setTimeout(() => {
        audioCtx.close().catch(() => {});
      }, 300);
    } catch (e) {
      // AudioContext ignore
    }
  };

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
    Html5QrcodeSupportedFormats.DATA_MATRIX
  ];

  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [useDeviceSelection, setUseDeviceSelection] = useState<boolean>(false);

  // Fetch available cameras
  useEffect(() => {
    if (isOpen) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Look for back / environment camera label
            const backCam = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('0, facing back')
            );
            if (backCam) {
              setSelectedCameraId(backCam.id);
              setUseDeviceSelection(true);
            }
          }
        })
        .catch((err) => {
          console.warn('Could not enumerate cameras:', err);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const newState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState } as any]
      });
      setTorchOn(newState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    setCameraError(null);
    setTorchOn(false);
    setHasTorch(false);

    const startScanner = async () => {
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
          useBarCodeDetectorIfSupported: true
        });
        scannerRef.current = html5QrcodeScanner;

        // Optimized viewport bounding box for both 1D barcodes and 2D codes
        const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(viewfinderWidth * 0.9, 360);
          const height = Math.min(viewfinderHeight * 0.6, 200);
          return { width: Math.max(width, 220), height: Math.max(height, 120) };
        };

        const cameraConfig = (useDeviceSelection && selectedCameraId) 
          ? { deviceId: { exact: selectedCameraId } } 
          : { facingMode: facingMode };

        await html5QrcodeScanner.start(
          cameraConfig,
          {
            fps: 20, // Higher scanning FPS for faster barcode capture
            qrbox: qrboxFunction,
            aspectRatio: 1.3333,
            videoConstraints: {
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              focusMode: 'continuous'
            } as any
          },
          async (decodedText) => {
            if (isMountedRef.current) {
              // Sanitize non-printable control characters often emitted by hardware scanners
              const code = decodedText.replace(/[\x00-\x1F\x7F]/g, '').trim();
              if (!code) return;
              playBeepSound();
              setScanSuccessFlash(true);
              await stopScanner();
              onScanSuccess(code);
              onClose();
            }
          },
          () => {
            // frame parse fail, silent continuous scan
          }
        );

        if (!isMountedRef.current) {
          await stopScanner();
        } else {
          setIsScanning(true);
          
          // Re-enumerate cameras after permission is granted to get real device names (e.g. Back Camera, Front Camera)
          Html5Qrcode.getCameras().then((updatedDevices) => {
            if (updatedDevices && updatedDevices.length > 0 && isMountedRef.current) {
              setCameras(updatedDevices);
            }
          }).catch(() => {});

          // Check if torch track capability is present
          try {
            const capabilities = html5QrcodeScanner.getRunningTrackCapabilities();
            if ((capabilities as any).torch) {
              setHasTorch(true);
            }
          } catch (e) {}
        }
      } catch (err: any) {
        console.warn('Camera scanner initialization error:', err);
        if (isMountedRef.current) {
          setIsScanning(false);
          setCameraError(
            'Live camera stream unavailable or permission requested. You can upload a barcode image photo or enter manually below.'
          );
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, selectedCameraId, facingMode, useDeviceSelection]);

  const stopScanner = async () => {
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
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      // Create temporary decoder instance
      const tempScanner = new Html5Qrcode('temp-qr-scanner-file', {
        formatsToSupport,
        verbose: false
      });
      const decodedText = await tempScanner.scanFile(file, true);
      try {
        await tempScanner.clear();
      } catch (e) {}

      if (decodedText) {
        playBeepSound();
        setScanSuccessFlash(true);
        await stopScanner();
        onScanSuccess(decodedText.trim());
        onClose();
      }
    } catch (err) {
      console.warn('File decode error:', err);
      setCameraError('No barcode detected in the uploaded image. Please ensure the image shows a clear barcode label.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      playBeepSound();
      onScanSuccess(manualBarcode.trim());
      setManualBarcode('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      {/* Hidden container for file scan processing */}
      <div id="temp-qr-scanner-file" className="hidden" />

      <div className={`bg-white border rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5 transition-all ${
        scanSuccessFlash ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-slate-200'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl border border-orange-200 shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                Auto Barcode Scanner
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Auto-Detect
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">Point camera at product barcode or upload image</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Selector Dropdown & Switch Camera Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Back/Front Camera Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const nextMode = facingMode === 'environment' ? 'user' : 'environment';
                setFacingMode(nextMode);
                setUseDeviceSelection(false);
              }}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm text-xs"
              title="Switch between rear back camera and front selfie camera"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              {facingMode === 'environment' ? 'Back Cam (Active)' : 'Front Cam'}
            </button>

            {/* Camera Device Dropdown if multiple hardware devices enumerated */}
            {cameras.length > 0 && (
              <select
                value={useDeviceSelection ? selectedCameraId : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedCameraId(e.target.value);
                    setUseDeviceSelection(true);
                  } else {
                    setUseDeviceSelection(false);
                  }
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:border-orange-500 text-xs max-w-[170px] truncate"
              >
                <option value="">Auto ({facingMode === 'environment' ? 'Back' : 'Front'})</option>
                {cameras.map((cam, idx) => (
                  <option key={cam.id || idx} value={cam.id}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                torchOn ? 'bg-amber-400 text-slate-900 shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> {torchOn ? 'Flash On' : 'Flashlight'}
            </button>
          )}
        </div>

        {/* Camera Region Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-300 min-h-[220px] flex items-center justify-center shadow-inner">
          <div id={qrRegionId} className="w-full" />
          
          {/* Laser overlay animation when scanning */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[80%] h-[140px] border-2 border-dashed border-orange-400/80 rounded-2xl relative overflow-hidden flex items-center justify-center">
                {/* Red Laser beam moving line */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                <span className="absolute bottom-2 text-[10px] font-bold text-orange-300 bg-slate-950/70 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Align Barcode Here
                </span>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-5 text-center space-y-2 max-w-xs text-xs text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
              <p className="font-semibold">{cameraError}</p>
            </div>
          )}
        </div>

        {/* File Image Upload Option */}
        <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">Have a photo of the barcode?</span>
            <span className="text-[11px] text-slate-500 font-medium">Upload image/screenshot to auto-detect</span>
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

        {/* Manual Barcode Input Fallback */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <BarcodeIcon className="w-4 h-4 text-orange-600" /> USB Scanner / Manual Entry
          </label>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Type or scan barcode..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-orange-500 font-medium"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-sm transition-all text-xs cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Check className="w-4 h-4" /> Apply
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

