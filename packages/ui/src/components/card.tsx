import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: 'blue' | 'green' | 'none';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glowColor = 'none', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          "glass-card rounded-xl p-6",
          glowColor === 'blue' && "border-cyan-500/20 hover:border-cyan-500/40 shadow-[0_0_15px_rgba(0,210,255,0.05)]",
          glowColor === 'green' && "border-emerald-500/20 hover:border-emerald-500/40 shadow-[0_0_15px_rgba(0,255,102,0.05)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
