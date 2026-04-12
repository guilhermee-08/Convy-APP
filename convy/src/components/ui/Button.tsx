import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`inline-flex items-center justify-center rounded-xl text-[15px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none w-full py-4 px-6 active:scale-[0.98] ${variant === 'primary'
                        ? 'bg-primary text-white shadow-[0_4px_14px_rgba(124,58,237,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-primary-hover hover:shadow-[0_6px_20px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]'
                        : 'bg-white/5 border border-white/5 text-white hover:bg-white/10 transition-colors duration-200'
                    } ${className}`}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
