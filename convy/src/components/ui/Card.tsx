import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`rounded-[24px] border border-white/5 bg-card p-6 backdrop-blur-sm text-text-main shadow-lg ${className}`}
                {...props}
            />
        );
    }
);
Card.displayName = 'Card';
