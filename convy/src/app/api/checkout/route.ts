import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST() {
    try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (!authSession?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [
                {
                    price: 'price_1T8ZJ0GI6pqLzIwyMR3rna63',
                    quantity: 1,
                },
            ],
            metadata: {
                user_id: authSession.user.id
            },
            customer_email: authSession.user.email,
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/home`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/paywall`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
