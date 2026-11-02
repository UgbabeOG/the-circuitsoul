import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'glow-cyan' | 'glow-emerald';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50",
          size === 'sm' && "px-3 py-1.5 text-xs",
          size === 'md' && "px-4 py-2 text-sm",
          size === 'lg' && "px-6 py-3 text-base",
          variant === 'primary' && "bg-cyan-500 text-slate-950 hover:bg-cyan-400 focus:ring-cyan-500",
          variant === 'secondary' && "bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-slate-500",
          variant === 'outline' && "border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800/50",
          variant === 'glow-cyan' && "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(0,210,255,0.1)] hover:bg-cyan-500/20 hover:border-cyan-500/50",
          variant === 'glow-emerald' && "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.1)] hover:bg-emerald-500/20 hover:border-emerald-500/50",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
