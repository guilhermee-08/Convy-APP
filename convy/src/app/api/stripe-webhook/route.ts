import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// Disable Next.js body parsing for Stripe Webhook signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
    console.log("webhook received");

    try {
        const payload = await req.text();
        const signature = req.headers.get("stripe-signature") as string;

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                payload,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
        } catch (err) {
            const error = err as Error;
            console.error("Webhook signature verification failed:", error.message);
            return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.user_id;

            if (userId) {
                // Connect to Supabase to upgrade the user
                const { error } = await supabase
                    .from('profiles')
                    .update({ is_premium: true })
                    .eq('id', userId);

                if (error) {
                    console.error("Error upgrading user to premium:", error);
                } else {
                    console.log("user upgraded to premium");
                }
            } else {
                console.error("No user_id found in metadata");
            }
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
