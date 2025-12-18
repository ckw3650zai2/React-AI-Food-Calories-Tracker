
import React from 'react';

interface CircularProgressProps {
  value: number;
  max: number;
  color: string;
  label: string;
  subLabel: string;
  size?: number;
  strokeWidth?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ 
  value, 
  max, 
  color, 
  label, 
  subLabel, 
  size = 120, 
  strokeWidth = 10 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(Math.max(value / max, 0), 1);
  const dashoffset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center justify-between py-10 px-4 rounded-[3.5rem] min-h-[320px] transition-all hover:scale-[1.02] duration-300 border border-white/40 shadow-sm" style={{ backgroundColor: `${color}08` }}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeOpacity={0.1}
          />
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-black text-gray-900 leading-none">{Math.round(value)}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5">{subLabel}</span>
        </div>
      </div>
      
      <div className="text-center mt-6">
        <span className="block text-xl font-black tracking-tight mb-1" style={{ color }}>{label}</span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Goal: {max}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{subLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default CircularProgress;
