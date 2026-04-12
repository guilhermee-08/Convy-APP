import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={`rounded-[24px] bg-[#181D29] border border-white/5 border-t-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] p-6 text-white ${className}`}
                {...props}
            />
        );
    }
);
Card.displayName = 'Card';
