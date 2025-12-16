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
    <div className="flex flex-col items-center justify-center p-2 bg-opacity-10 rounded-xl" style={{ backgroundColor: `${color}10` }}>
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
            strokeOpacity={0.2}
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
          <span className="text-xl font-bold text-gray-800">{Math.round(value)}</span>
          <span className="text-xs text-gray-500">{subLabel}</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <span className="block text-sm font-semibold" style={{ color }}>{label}</span>
        <span className="text-xs text-gray-500">Goal: {max} {subLabel}</span>
      </div>
    </div>
  );
};

export default CircularProgress;