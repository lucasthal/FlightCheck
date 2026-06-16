interface Props {
  isRestore: boolean
  onSignIn: () => void
}

export function WelcomeScreen({ isRestore, onSignIn }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M 3.5 13 Q 5.5 15 8.5 18 Q 9.5 18 14.5 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path transform="translate(17.5 8) rotate(-50)" d="M2.5 0 L1.2 -0.45 L1.2 -2.2 L-0.2 -2.2 L-0.2 -0.45 L-2 -0.45 L-2.5 0 L-2 0.45 L-0.2 0.45 L-0.2 2.2 L1.2 2.2 L1.2 0.45 Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
            Flight<span className="text-cockpit-amber">Check</span>
          </h1>
        </div>

        <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit">
          {/* Success icon */}
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-7 h-7 text-green-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-cockpit-text-primary mb-2 text-center">
            {isRestore ? 'Subscription Restored' : 'Welcome to FlightCheck'}
          </h2>
          <p className="text-sm text-cockpit-text-secondary mb-6 text-center">
            {isRestore
              ? 'Your subscription has been restored successfully.'
              : 'Your subscription is now active.'}
            {' '}Sign in to sync your checklists, favorites, and preferences across all your devices.
          </p>

          <button
            onClick={onSignIn}
            className="w-full py-3 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
              hover:bg-amber-400 transition-colors"
          >
            Sign In or Create Account
          </button>

        </div>

        <p className="text-center text-xs text-cockpit-text-dim mt-4">
          An account enables cross-device sync of your checklists, favorites, and preferences.
        </p>
      </div>
    </div>
  )
}
