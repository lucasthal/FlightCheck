# FlightCheck Data Map

**Last reviewed:** 2026-07-13 · Review on any new SDK/provider or data field.

| Data | Where it lives | Processor | Purpose | Retention |
|---|---|---|---|---|
| Email address | Supabase Auth | Supabase, Inc. (US) | Authentication, account communication | Until account deletion |
| Account ID (UUID) | Supabase Auth + RevenueCat app user ID | Supabase, RevenueCat (US) | Account linkage, subscription entitlement | Until account deletion |
| Display name (optional) | Supabase Auth user_metadata | Supabase | Addressing the user in-app | Until account deletion |
| Preferences (theme, palette, text size, toggles) | Supabase `user_preferences` + device localStorage | Supabase | Cross-device sync | Until account deletion |
| Checklist notes / custom items / favorites / profiles | Supabase tables | Supabase | Core product function | Until account deletion |
| Subscription/trial status + Apple receipt info | RevenueCat | RevenueCat, Inc. (US) | Entitlement management | Per RevenueCat DPA |
| Payment details | Apple / Stripe only | Apple, Stripe | Purchase processing | Never touches our systems |
| Face ID sign-in token | Device Keychain only | — (on device) | Biometric re-auth | Until sign-out/app deletion |

**Not collected:** location, health/biometric data (Face ID token stays on device), contacts/photos, advertising IDs, analytics/telemetry, crash reports linked to identity.

**Transfers (EU/UK):** Supabase and RevenueCat DPAs incorporate SCCs; DPF participation recorded when DPAs are countersigned (see checklist in the EU launch plan).

**Erasure path:** in-app Settings → Delete account → Supabase edge function `delete-account` removes auth user + rows; RevenueCat data deletion via dashboard/API on request.

**Deferred decision (revisit 2026-Q4):** EU/UK GDPR representative — knowingly deferred at launch; reassess once EU traction is visible.
