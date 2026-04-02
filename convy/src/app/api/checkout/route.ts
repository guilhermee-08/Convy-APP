import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
    console.log("--- [API CHECKOUT] POST REQUEST INITIATED ---");
    try {
        console.log("Instantiating Supabase SSR Client...");
        const supabase = await createClient();

        console.log("Fetching User Object natively from cookies...");
        const { data: { user }, error } = await supabase.auth.getUser();

        console.log("User retrieved:", !!user, "Error:", error?.message);

        if (error || !user) {
            console.log("User validation failed (cookie missing or invalid) -> 401");
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const priceId = process.env.STRIPE_PRICE_ID || 'price_1T8ZJ0GI6pqLzIwyMR3rna63';

        console.log("----- STRIPE DEBUG LOGS -----");
        console.log("STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
        console.log("Price ID being used:", priceId);
        console.log("User retrieved:", !!user, "| Email:", user?.email);
        console.log("Next App URL:", process.env.NEXT_PUBLIC_APP_URL);
        console.log("-----------------------------");

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            metadata: {
                user_id: user.id
            },
            customer_email: user.email,
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/home`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/paywall`,
        });

        console.log("Stripe Session Created!");

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('------- STRIPE API ERROR TRACE -------');
        console.error('Error Object:', error);
        console.error('Error Message:', error?.message);
        console.error('Error Type:', error?.type);
        console.error('Error Code:', error?.code);
        console.error('Raw Stripe Error:', error?.raw);
        console.error('--------------------------------------');

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                stripe_message: error?.message,
                stripe_type: error?.type,
                stripe_code: error?.code
            },
            { status: 500 }
        );
    }
}
