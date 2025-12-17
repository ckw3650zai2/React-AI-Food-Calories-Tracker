
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
    <div className="flex flex-col items-center justify-center py-10 px-6 bg-opacity-10 rounded-[2.5rem] min-h-[280px] transition-transform hover:scale-[1.02] duration-300" style={{ backgroundColor: `${color}15` }}>
      <div className="relative flex items-center justify-center mb-6" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeOpacity={0.15}
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
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{subLabel}</span>
        </div>
      </div>
      <div className="text-center">
        <span className="block text-lg font-black tracking-tight mb-1" style={{ color }}>{label}</span>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Goal: {max} {subLabel}</span>
      </div>
    </div>
  );
};

export default CircularProgress;
