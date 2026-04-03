import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        console.log('[Stripe Portal] Auth result — user:', user?.id, '| email:', user?.email, '| error:', error?.message);

        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized: ' + (error?.message || 'no user') }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL as string,
            process.env.SUPABASE_SERVICE_ROLE_KEY as string
        );

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        console.log('[Stripe Portal] Profile query — profile:', JSON.stringify(profile), '| error:', profileError?.message);

        if (profileError) {
            return NextResponse.json(
                { error: 'Erro ao buscar perfil: ' + profileError.message },
                { status: 500 }
            );
        }

        if (!profile?.stripe_customer_id) {
            return NextResponse.json(
                { error: 'Nenhum stripe_customer_id encontrado para esta conta.' },
                { status: 400 }
            );
        }

        console.log('[Stripe Portal] Creating session for customer:', profile.stripe_customer_id);

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
        });

        console.log('[Stripe Portal] Session created:', portalSession.url?.substring(0, 60));

        return NextResponse.json({ url: portalSession.url });
    } catch (err: any) {
        console.error('[Stripe Portal] CATCH error:', err.message, err.type, err.code);
        return NextResponse.json(
            { error: err.message || 'Erro desconhecido ao abrir portal.' },
            { status: 500 }
        );
    }
}
