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
                className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variant === 'primary'
                        ? 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5'
                        : 'bg-card border border-border text-text-main hover:border-primary/50 hover:bg-border/50 transition-all duration-200 hover:-translate-y-0.5'
                    } h-12 px-6 ${className}`}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
