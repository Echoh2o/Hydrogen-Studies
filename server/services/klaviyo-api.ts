/**
 * Klaviyo Integration — Email marketing list management
 *
 * Syncs newsletter signups, user registrations, and study interests
 * to Klaviyo for email marketing automation.
 *
 * Setup:
 * 1. Set KLAVIYO_API_KEY (private API key from Klaviyo Settings → API Keys)
 * 2. Set KLAVIYO_LIST_ID (the list ID for the newsletter)
 * 3. Optionally set KLAVIYO_CUSTOMER_LIST_ID for registered customers
 *
 * Uses Klaviyo API v2023-12-15 (revision header)
 */

const KLAVIYO_API_URL = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-10-15";

function getApiKey(): string | null {
  return process.env.KLAVIYO_API_KEY || null;
}

function getHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("KLAVIYO_API_KEY not configured");

  return {
    "Authorization": `Klaviyo-API-Key ${apiKey}`,
    "Content-Type": "application/json",
    "revision": KLAVIYO_REVISION,
  };
}

/**
 * Subscribe an email to the newsletter list
 */
export async function subscribeToNewsletter(email: string, options: {
  firstName?: string;
  lastName?: string;
  source?: string;
} = {}): Promise<{ success: boolean; profileId?: string; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[Klaviyo] API key not configured, skipping newsletter subscription");
    return { success: false, error: "Klaviyo not configured" };
  }

  const listId = process.env.KLAVIYO_LIST_ID;
  if (!listId) {
    console.warn("[Klaviyo] KLAVIYO_LIST_ID not configured");
    return { success: false, error: "Newsletter list not configured" };
  }

  try {
    // Step 1: Create or update the profile
    const profileResponse = await fetch(`${KLAVIYO_API_URL}/profiles/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: email.toLowerCase().trim(),
            first_name: options.firstName || undefined,
            last_name: options.lastName || undefined,
            properties: {
              source: options.source || "website_newsletter",
              signup_date: new Date().toISOString(),
            },
          },
        },
      }),
    });

    let profileId: string | undefined;

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      profileId = profileData.data?.id;
    } else if (profileResponse.status === 409) {
      // Profile already exists — get the existing ID
      const conflictData = await profileResponse.json();
      profileId = conflictData.errors?.[0]?.meta?.duplicate_profile_id;
    } else {
      const errorText = await profileResponse.text();
      console.error(`[Klaviyo] Profile creation failed: ${profileResponse.status} ${errorText}`);
      return { success: false, error: `Profile creation failed: ${profileResponse.status}` };
    }

    if (!profileId) {
      // Try to look up by email
      const lookupResponse = await fetch(
        `${KLAVIYO_API_URL}/profiles/?filter=equals(email,"${encodeURIComponent(email.toLowerCase().trim())}")`,
        { headers: getHeaders() },
      );
      if (lookupResponse.ok) {
        const lookupData = await lookupResponse.json();
        profileId = lookupData.data?.[0]?.id;
      }
    }

    if (!profileId) {
      return { success: false, error: "Could not find or create profile" };
    }

    // Step 2: Subscribe the profile to the list
    const subscribeResponse = await fetch(`${KLAVIYO_API_URL}/lists/${listId}/relationships/profiles/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: [{
          type: "profile",
          id: profileId,
        }],
      }),
    });

    if (subscribeResponse.ok || subscribeResponse.status === 204) {
      console.log(`[Klaviyo] Subscribed ${email} to newsletter (profile: ${profileId})`);
      return { success: true, profileId };
    }

    const subError = await subscribeResponse.text();
    console.error(`[Klaviyo] Subscribe failed: ${subscribeResponse.status} ${subError}`);
    return { success: false, error: `Subscribe failed: ${subscribeResponse.status}` };

  } catch (error) {
    console.error("[Klaviyo] Newsletter subscription error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Add a registered customer to the customer list (separate from newsletter)
 */
export async function addCustomerProfile(email: string, options: {
  firstName?: string;
  lastName?: string;
  username?: string;
  healthInterests?: string[];
  source?: string;
} = {}): Promise<{ success: boolean; profileId?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false };

  const customerListId = process.env.KLAVIYO_CUSTOMER_LIST_ID;

  try {
    // Create/update profile with customer properties
    const profileResponse = await fetch(`${KLAVIYO_API_URL}/profiles/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: email.toLowerCase().trim(),
            first_name: options.firstName || undefined,
            last_name: options.lastName || undefined,
            properties: {
              source: options.source || "website_registration",
              username: options.username,
              account_type: "customer",
              registration_date: new Date().toISOString(),
              health_interests: options.healthInterests || [],
            },
          },
        },
      }),
    });

    let profileId: string | undefined;

    if (profileResponse.ok) {
      const data = await profileResponse.json();
      profileId = data.data?.id;
    } else if (profileResponse.status === 409) {
      const conflictData = await profileResponse.json();
      profileId = conflictData.errors?.[0]?.meta?.duplicate_profile_id;
    }

    // Add to customer list if configured
    if (profileId && customerListId) {
      await fetch(`${KLAVIYO_API_URL}/lists/${customerListId}/relationships/profiles/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          data: [{ type: "profile", id: profileId }],
        }),
      });
    }

    if (profileId) {
      console.log(`[Klaviyo] Added customer profile: ${email} (profile: ${profileId})`);
    }

    return { success: !!profileId, profileId };
  } catch (error) {
    console.error("[Klaviyo] Customer profile error:", error);
    return { success: false };
  }
}

/**
 * Track a custom event in Klaviyo (for behavioral targeting)
 * e.g., "Viewed Study", "Saved Study", "Read Blog"
 */
export async function trackEvent(email: string, eventName: string, properties: Record<string, any> = {}): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  try {
    const response = await fetch(`${KLAVIYO_API_URL}/events/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: {
              data: {
                type: "metric",
                attributes: { name: eventName },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: { email: email.toLowerCase().trim() },
              },
            },
            properties,
            time: new Date().toISOString(),
          },
        },
      }),
    });

    return response.ok || response.status === 202;
  } catch (error) {
    console.error(`[Klaviyo] Track event error (${eventName}):`, error);
    return false;
  }
}

/**
 * Check if Klaviyo is configured and available
 */
export function isKlaviyoConfigured(): boolean {
  return !!(process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID);
}
