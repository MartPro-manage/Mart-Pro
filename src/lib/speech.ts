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

// Format text for clear, natural human pronunciation
export const formatTextForSpeech = (text: string): string => {
  return text
    .replace(/\bRs\.?\s*(\d+)\.00\b/gi, '$1 rupees')
    .replace(/\bRs\.?\s*(\d+)\.(\d{1,2})\b/gi, '$1 point $2 rupees')
    .replace(/\bRs\.?\s*(\d+)\b/gi, '$1 rupees')
    .replace(/\bRs\.?\b/gi, 'rupees')
    .replace(/\bPKR\b/gi, 'rupees')
    .replace(/#/g, 'number ')
    .replace(/\bQty:?\s*/gi, 'Quantity ')
    .replace(/\bBC:?\s*/gi, 'Barcode ')
    .replace(/\bPOS\b/g, 'P O S')
    .replace(/\b(\d+)\s*pcs\b/gi, '$1 pieces')
    .replace(/\b(\d+)\s*kg\b/gi, '$1 kilograms')
    .replace(/•/g, ' ')
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
    if (name.includes('samantha') || name.includes('ava') || name.includes('karen') || name.includes('daniel') || name.includes('serena') || name.includes('jenny') || name.includes('guy') || name.includes('aria') || name.includes('zira')) score += 25;
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
): boolean => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this browser environment.');
    return false;
  }

  try {
    // Chrome freeze safeguard: resume if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Cancel any previous utterance to avoid overlaps and queue delays
    window.speechSynthesis.cancel();

    const formatted = formatTextForSpeech(text);
    if (!formatted) return false;

    // A brief 40ms timeout ensures Chrome has cleared previous utterances completely before starting new one
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(formatted);
        utterance.rate = options.rate ?? 0.88; 
        utterance.pitch = options.pitch ?? 1.0;
        utterance.volume = options.volume ?? 1.0;
        utterance.lang = 'en-US';

        const preferredVoice = getBestAvailableVoice();
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        }

        window.speechSynthesis.speak(utterance);
      } catch (innerErr) {
        console.warn('Speech utterance execution error:', innerErr);
      }
    }, 40);

    return true;
  } catch (err) {
    console.error('Error triggering voice speech synthesis:', err);
    return false;
  }
};

/**
 * Specifically format and speak customer change announcement with exact rupees and paisas
 */
export const speakCustomerChange = (
  totalBill: number,
  cashReceived: number,
  changeToReturn: number
) => {
  const round2 = (num: number) => Math.round(num * 100) / 100;
  const billVal = round2(totalBill);
  const receivedVal = round2(cashReceived);
  const changeVal = round2(changeToReturn);

  const formatAmountWords = (val: number) => {
    const whole = Math.floor(val);
    const fraction = Math.round((val - whole) * 100);
    if (fraction > 0) {
      return `${whole} rupees and ${fraction} paisa`;
    }
    return `${whole} rupees`;
  };

  if (changeVal > 0) {
    const speech = `Total bill is ${formatAmountWords(billVal)}. Cash received is ${formatAmountWords(receivedVal)}. Please give ${formatAmountWords(changeVal)} change to the customer.`;
    return speakMessage(speech, { rate: 0.88 });
  } else {
    const speech = `Total bill is ${formatAmountWords(billVal)}. Exact cash received. No change required.`;
    return speakMessage(speech, { rate: 0.88 });
  }
};


