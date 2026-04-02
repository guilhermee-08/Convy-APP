import { supabase } from "@/lib/supabase";

export async function ensureProfileExists(user: any) {
    if (!user || !user.id) return null;

    let targetProfile = null;
    const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (existingProfile) {
        console.log("Profile found");
        targetProfile = existingProfile;
    } else {
        const newProfile = {
            id: user.id,
            email: user.email,
            onboarding_completed: false,
            xp: 0,
            is_premium: false,
            practice_count_today: 0,
            last_practice_date: null
        };

        const { data: insertedProfile, error } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();

        if (error) {
            console.error("Error creating profile:", error);
        } else {
            console.log("Profile created");
            targetProfile = insertedProfile;
        }
    }

    // Securely sync pending onboarding if any exist in the browser context
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem('pendingOnboarding');
        if (stored) {
            try {
                const answers = JSON.parse(stored);
                if (Object.keys(answers).length > 0) {
                    await supabase.from('profiles').update({
                        ...answers,
                        onboarding_completed: true
                    }).eq('id', user.id);

                    localStorage.removeItem('pendingOnboarding');

                    // Keep the returned object synchronized locally
                    if (targetProfile) {
                        targetProfile = { ...targetProfile, ...answers, onboarding_completed: true };
                    }
                }
            } catch (e) {
                console.error("Failed to parse pending onboarding", e);
            }
        }
    }

    return targetProfile;
}
