import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hover = false }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm ${
        hover ? 'hover:shadow-md hover:border-slate-300 transition-all duration-200' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

