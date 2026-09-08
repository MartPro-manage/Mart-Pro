import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  lightMode?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  showSubtitle = true,
  lightMode = false
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl'
  };

  const subTextSizes = {
    sm: 'text-[8px] tracking-widest',
    md: 'text-[10px] tracking-widest',
    lg: 'text-[11px] tracking-widest',
    xl: 'text-xs tracking-widest'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Mart Pro Shopping Cart + M SVG Logo */}
      <div className={`${iconSizes[size]} shrink-0 relative flex items-center justify-center`}>
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
          {/* Shopping Cart Wheels */}
          <circle cx="85" cy="165" r="14" fill={lightMode ? "#1e293b" : "#0f172a"} />
          <circle cx="145" cy="165" r="14" fill={lightMode ? "#1e293b" : "#0f172a"} />
          <circle cx="85" cy="165" r="6" fill="#ffffff" />
          <circle cx="145" cy="165" r="6" fill="#ffffff" />

          {/* Cart Frame Handle & Base (Dark) */}
          <path 
            d="M 35 55 L 60 55 L 85 130 L 155 130 L 165 110 L 80 110" 
            stroke={lightMode ? "#1e293b" : "#0f172a"} 
            strokeWidth="14" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Bold 'M' Cart Content (Vibrant Orange) */}
          <path 
            d="M 80 110 L 95 35 L 120 90 L 145 35 L 160 110 Z" 
            fill="#f97316" 
          />

          {/* Dynamic Front Accent Lines */}
          <path 
            d="M 125 102 L 168 102 C 172 102 175 99 174 95 L 168 70 L 120 70" 
            fill="#ea580c" 
            opacity="0.9"
          />
        </svg>
      </div>

      <div className="flex flex-col justify-center leading-none">
        <div className={`font-black ${textSizes[size]} tracking-tight flex items-center`}>
          <span className={lightMode ? "text-slate-900" : "text-white"}>MART</span>
          <span className="text-orange-500 ml-1">PRO</span>
        </div>
        {showSubtitle && (
          <span className={`font-bold uppercase text-slate-500 mt-0.5 ${subTextSizes[size]}`}>
            MANAGE <span className="text-orange-500">•</span> TRACK <span className="text-orange-500">•</span> GROW
          </span>
        )}
      </div>
    </div>
  );
};
