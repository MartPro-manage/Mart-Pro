import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Video, 
  VideoOff, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Play,
  Settings
} from 'lucide-react';
import { speakMessage } from '../lib/speech';

interface HardwarePermissionsBarProps {
  voiceEnabled: boolean;
  onToggleVoice: (enabled: boolean) => void;
  cameraScannerEnabled?: boolean;
  onToggleCameraScanner?: (enabled: boolean) => void;
}

export const HardwarePermissionsBar: React.FC<HardwarePermissionsBarProps> = ({
  voiceEnabled,
  onToggleVoice,
  cameraScannerEnabled = true,
  onToggleCameraScanner
}) => {
  const [cameraState, setCameraState] = useState<'granted' | 'denied' | 'prompt' | 'active' | 'inactive'>('prompt');
  const [micState, setMicState] = useState<'granted' | 'denied' | 'prompt' | 'active' | 'inactive'>('prompt');
  const [activeCamStream, setActiveCamStream] = useState<MediaStream | null>(null);
  const [activeMicStream, setActiveMicStream] = useState<MediaStream | null>(null);
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null);

  // Query browser permissions if supported
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as any }).then((status) => {
        setCameraState(status.state as any);
        status.onchange = () => setCameraState(status.state as any);
      }).catch(() => {});

      navigator.permissions.query({ name: 'microphone' as any }).then((status) => {
        setMicState(status.state as any);
        status.onchange = () => setMicState(status.state as any);
      }).catch(() => {});
    }
  }, []);

  const requestCameraPermission = async () => {
    try {
      setPermissionMsg('Requesting Camera Access...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setActiveCamStream(stream);
      setCameraState('granted');
      setPermissionMsg('Camera permission ALLOWED! Barcode scanner is ready.');
      setTimeout(() => setPermissionMsg(null), 4000);
    } catch (err: any) {
      console.warn('Camera permission denied or error:', err);
      setCameraState('denied');
      setPermissionMsg('Camera permission DISALLOWED / BLOCKED by browser settings.');
      setTimeout(() => setPermissionMsg(null), 5000);
    }
  };

  const stopCameraAccess = () => {
    if (activeCamStream) {
      activeCamStream.getTracks().forEach(track => track.stop());
      setActiveCamStream(null);
    }
    setCameraState('denied');
    setPermissionMsg('Camera access DISALLOWED / DISABLED for POS session.');
    setTimeout(() => setPermissionMsg(null), 4000);
  };

  const requestMicPermission = async () => {
    try {
      setPermissionMsg('Requesting Microphone Access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveMicStream(stream);
      setMicState('granted');
      setPermissionMsg('Microphone permission ALLOWED!');
      setTimeout(() => setPermissionMsg(null), 4000);
    } catch (err: any) {
      console.warn('Microphone permission denied or error:', err);
      setMicState('denied');
      setPermissionMsg('Microphone permission DISALLOWED / BLOCKED by browser settings.');
      setTimeout(() => setPermissionMsg(null), 5000);
    }
  };

  const stopMicAccess = () => {
    if (activeMicStream) {
      activeMicStream.getTracks().forEach(track => track.stop());
      setActiveMicStream(null);
    }
    setMicState('denied');
    setPermissionMsg('Microphone access DISALLOWED / DISABLED.');
    setTimeout(() => setPermissionMsg(null), 4000);
  };

  const handleTestVoice = () => {
    speakMessage('Thank you for your purchase!');
    setPermissionMsg('🔊 Speaking: "Thank you for your purchase!"');
    setTimeout(() => setPermissionMsg(null), 4000);
  };

  return (
    <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-md space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold tracking-wide uppercase text-slate-200">
              Hardware Permissions & Checkout Audio Voice Controls
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Manage Camera barcode scanning, Microphone access, and Voice Greetings
            </p>
          </div>
        </div>

        {/* Audio Voice Greeting Toggle & Test */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleCameraScanner && (
            <button
              type="button"
              onClick={() => onToggleCameraScanner(!cameraScannerEnabled)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                cameraScannerEnabled
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              }`}
              title="Enable or disable the built-in on-screen camera barcode scanner"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Scanner: {cameraScannerEnabled ? 'ENABLED' : 'DISABLED'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTestVoice}
            className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Test voice greeting"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Test Voice
          </button>

          <button
            type="button"
            onClick={() => onToggleVoice(!voiceEnabled)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
              voiceEnabled 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Voice Greeting: {voiceEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Permission Status Feedback Alert */}
      {permissionMsg && (
        <div className="px-3 py-2 bg-slate-800 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{permissionMsg}</span>
        </div>
      )}

      {/* Hardware Camera & External Scanner Permission Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Built-in Camera Scanner Status */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${cameraScannerEnabled && cameraState === 'granted' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                Camera Scanner
                {cameraScannerEnabled ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">SHOWN</span>
                ) : (
                  <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-mono font-bold">HIDDEN</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {cameraScannerEnabled ? 'On-screen scan button active' : 'Disabled for this account'}
              </div>
            </div>
          </div>

          {onToggleCameraScanner && (
            <button
              type="button"
              onClick={() => onToggleCameraScanner(!cameraScannerEnabled)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                cameraScannerEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              }`}
            >
              {cameraScannerEnabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>

        {/* External Hardware Barcode Scanner Status */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                External Scanner
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">HANDS-FREE</span>
              </div>
              <div className="text-[10px] text-slate-400">USB / Bluetooth auto-scan & add</div>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="External Scanner Listener Active" />
        </div>

        {/* Microphone Permission Control */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${micState === 'granted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                Voice Audio
                {voiceEnabled ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">READY</span>
                ) : (
                  <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.2 rounded font-mono font-bold">MUTED</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Thank you voice greeting</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleVoice(!voiceEnabled)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                voiceEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              {voiceEnabled ? 'Mute' : 'Unmute'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
