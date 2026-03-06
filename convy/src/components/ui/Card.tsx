import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`rounded-2xl border border-border bg-card/80 backdrop-blur-sm text-text-main shadow-xl ${className}`}
                {...props}
            />
        );
    }
);
Card.displayName = 'Card';
