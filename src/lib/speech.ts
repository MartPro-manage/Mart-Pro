// Speech Synthesis Utility for POS Audio Greetings and Feedback

let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
    } catch {
      // ignore
    }
  };

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Format text for more natural human pronunciation
const formatTextForSpeech = (text: string): string => {
  return text
    .replace(/\bRs\.?\s*(\d+(\.\d+)?)/gi, '$1 rupees')
    .replace(/\bRs\.?\b/gi, 'rupees')
    .replace(/\bQty:?\s*/gi, 'Quantity ')
    .replace(/\bBC:?\s*/gi, 'Barcode ')
    .replace(/\bPOS\b/g, 'P O S')
    .replace(/\b(\d+)\s*pcs\b/gi, '$1 pieces')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getBestAvailableVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    voices = window.speechSynthesis.getVoices() || [];
    cachedVoices = voices;
  }

  if (!voices || voices.length === 0) return null;

  // Prioritize high-quality, natural neural voices
  const voiceScore = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();

    if (lang.startsWith('en')) score += 50;
    if (lang.startsWith('en-us') || lang.startsWith('en-gb') || lang.startsWith('en-in')) score += 20;

    // High quality voice indicators
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 40;
    if (name.includes('google')) score += 30;
    if (name.includes('samantha') || name.includes('ava') || name.includes('karen') || name.includes('daniel') || name.includes('serena') || name.includes('jenny') || name.includes('guy') || name.includes('aria')) score += 25;
    if (name.includes('enhanced') || name.includes('premium')) score += 20;
    if (v.default) score += 5;

    return score;
  };

  const sorted = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a));
  return sorted[0] || null;
};

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export const speakMessage = (
  text: string = 'Thank you for your purchase!',
  options: SpeakOptions = {}
) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this browser environment.');
    return false;
  }

  try {
    // Cancel any previous utterance to avoid overlaps and queue delays
    window.speechSynthesis.cancel();

    const formatted = formatTextForSpeech(text);
    if (!formatted) return false;

    const utterance = new SpeechSynthesisUtterance(formatted);
    // Slower, smooth and clear natural speed
    utterance.rate = options.rate ?? 0.85; 
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
    utterance.lang = 'en-US';

    const preferredVoice = getBestAvailableVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Error triggering voice speech synthesis:', err);
    return false;
  }
};

