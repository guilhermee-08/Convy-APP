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
                className={`inline-flex items-center justify-center rounded-xl text-base font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none w-full py-4 px-6 ${variant === 'primary'
                        ? 'bg-primary text-white shadow-md hover:bg-primary-hover hover:-translate-y-0.5'
                        : 'bg-transparent border border-white/10 text-white hover:bg-white/5 hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5'
                    } ${className}`}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
