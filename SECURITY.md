# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in FlightCheck (the iOS app, web app, or backend), please report it privately:

**Email:** support@flightcheckapp.com — subject line starting with `[SECURITY]`

Please include: a description of the issue, steps to reproduce, and the app version (Settings → bottom of the screen) or URL affected.

What to expect:
- Acknowledgment within 48 hours
- An assessment and remediation plan within 14 days for confirmed issues
- Credit in release notes if you'd like it (tell us how to name you)

Please do not open public GitHub issues for security reports, and give us a reasonable window to fix confirmed issues before public disclosure.

## Scope

- FlightCheck iOS app (App Store / TestFlight builds)
- FlightCheck web app and support site
- Supabase edge functions and database policies belonging to this project

Out of scope: vulnerabilities in Apple, Supabase, RevenueCat, or Stripe platforms themselves (report to those vendors), and issues requiring physical access to an unlocked device.

## Supported Versions

The latest App Store release and the release immediately before it receive security fixes. Older builds should update via the App Store.
