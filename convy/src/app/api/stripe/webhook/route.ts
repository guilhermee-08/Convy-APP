import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    console.log("--- [STRIPE WEBHOOK] RECEIVED ---");

    let event: Stripe.Event;

    try {
        const body = await req.text();
        const signature = req.headers.get("stripe-signature");

        if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
            console.error("Missing webhook signature or secret!");
            return NextResponse.json({ error: "Missing signature/secret" }, { status: 400 });
        }

        console.log("Verifying Stripe Signature...");
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log("Signature Verified! Event Type:", event.type);
    } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                console.log(`\n=== CHECKOUT.SESSION.COMPLETED ===`);
                console.log(`Session ID: ${session.id}`);
                console.log(`Customer ID: ${session.customer}`);
                console.log(`Subscription ID: ${session.subscription}`);
                console.log(`Metadata raw:`, session.metadata);

                const userId = session.metadata?.user_id;

                if (!userId) {
                    console.error("No user_id found in session metadata!");
                    break;
                }

                console.log(`Extracted userId from metadata: ${userId}`);

                // PREEMPTIVE CHECK: Verify if profile actually exists
                const { data: existingProfile, error: existingError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .single();

                if (existingError || !existingProfile) {
                    console.error(`🚨 PREEMPTIVE PROFILE CHECK FAILED: No profile found for id = ${userId} in public.profiles prior to update! Error:`, existingError?.message || "Profile missing.");
                } else {
                    console.log(`Preemptive check passed: Profile ${userId} definitively exists in public.profiles. Proceeding with update...`);
                }

                const subscriptionId = session.subscription as string;
                const customerId = session.customer as string;

                const { data, error: patchError, count } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        subscription_status: 'active',
                        is_premium: true
                    })
                    .eq('id', userId)
                    .select();

                console.log(`Supabase Rows updated query count: ${count}`);

                if (patchError) {
                    console.error("Exact Supabase Update Error object:", JSON.stringify(patchError));
                    console.error("Supabase Database Update Error message:", patchError.message);
                    throw new Error(patchError.message);
                }

                if (!data || data.length === 0) {
                    console.error(`🚨 CRITICAL: No profile row was updated for id = ${userId}! Does the profile exist?`);
                } else {
                    console.log(`User ${userId} successfully upgraded to PREMIUM via checkout! Rows returned: ${data.length}`);
                }

                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const status = subscription.status;
                const priceId = subscription.items.data[0].price.id;

                const premiumActive = status === 'active' || status === 'trialing';

                console.log(`Subscription Updated -> Status: ${status} | isPremium: ${premiumActive}`);

                const { error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: status,
                        is_premium: premiumActive,
                        plan_id: priceId
                    })
                    .eq('stripe_subscription_id', subscription.id);

                if (updateError) {
                    console.error("Supabase Database Update Error:", updateError.message);
                    throw new Error(updateError.message);
                }

                console.log(`Stripe Subscription ${subscription.id} successfully synced.`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;

                console.log(`Subscription Deleted -> Removing Premium Access`);

                const { error: cancelError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: subscription.status,
                        is_premium: false
                    })
                    .eq('stripe_subscription_id', subscription.id);

                if (cancelError) {
                    console.error("Supabase Database Update Error:", cancelError.message);
                    throw new Error(cancelError.message);
                }

                console.log(`Stripe Subscription ${subscription.id} securely cancelled.`);
                break;
            }

            default:
                console.log("Unhandled event type:", event.type);
        }

        // Must explicitly return a nominal JSON payload to Stripe to close the HTTP loop and prevent infinite webhook retries
        return NextResponse.json({ received: true }, { status: 200 });

    } catch (err: any) {
        console.error("Error executing Webhook logic:", err.message);
        return NextResponse.json({ error: "Internal Database execution failed." }, { status: 500 });
    }
}
