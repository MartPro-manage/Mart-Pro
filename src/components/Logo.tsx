import React, { useState } from 'react';
import martProLogoSrc from '../assets/images/mart_pro_logo_1791265968495.jpg';
import martProIconSrc from '../assets/images/mart_pro_icon_1791265986365.jpg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  lightMode?: boolean;
  variant?: 'full' | 'icon' | 'badge';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  showSubtitle = true,
  lightMode = false,
  variant = 'full'
}) => {
  const [imgSrc, setImgSrc] = useState<string>(martProIconSrc);
  const [hasError, setHasError] = useState(false);

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl'
  };

  const subTextSizes = {
    sm: 'text-[7.5px] tracking-wider',
    md: 'text-[9.5px] tracking-wider',
    lg: 'text-[11px] tracking-wider',
    xl: 'text-xs tracking-wider'
  };

  const handleImageError = () => {
    if (imgSrc !== '/favicon.png' && imgSrc !== '/logo.png') {
      setImgSrc('/favicon.png');
    } else {
      setHasError(true);
    }
  };

  if (variant === 'icon') {
    return (
      <div className={`relative ${iconSizes[size]} ${className} flex items-center justify-center rounded-xl overflow-hidden shadow-xs border border-orange-200/60 bg-white`}>
        {!hasError ? (
          <img 
            src={imgSrc} 
            alt="Mart Pro Icon" 
            className="w-full h-full object-contain p-0.5" 
            loading="eager"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-black text-sm">
            🛒
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Mart Pro Cart Icon with grocery items */}
      <div className={`${iconSizes[size]} shrink-0 relative flex items-center justify-center overflow-hidden rounded-xl shadow-xs border border-orange-200/60 bg-white`}>
        {!hasError ? (
          <img 
            src={imgSrc} 
            alt="Mart Pro" 
            className="w-full h-full object-contain p-0.5"
            loading="eager"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-black text-sm">
            🛒
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center leading-none select-none">
        <div className={`font-black italic ${textSizes[size]} tracking-tight flex items-baseline`}>
          <span className={lightMode ? "text-slate-900" : "text-slate-900"}>Mart</span>
          <span className="text-orange-600 ml-1 font-black">Pro</span>
        </div>
        {showSubtitle && (
          <div className={`flex items-center gap-1 font-extrabold text-slate-500 uppercase mt-0.5 ${subTextSizes[size]}`}>
            <span className="w-2.5 h-0.5 bg-orange-500 rounded-full inline-block" />
            <span>Supermarket Management Software</span>
            <span className="w-2.5 h-0.5 bg-orange-500 rounded-full inline-block" />
          </div>
        )}
      </div>
    </div>
  );
};

export { martProLogoSrc, martProIconSrc };

