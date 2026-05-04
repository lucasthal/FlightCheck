interface Props {
  visible: boolean
}

/**
 * Thin non-dismissable status bar shown when the app is operating
 * from cached data or has no network connection.
 */
export function OfflineBanner({ visible }: Props) {
  return (
    <div
      aria-live="polite"
      className={[
        'w-full overflow-hidden transition-all duration-100',
        visible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0',
      ].join(' ')}
    >
      <div className="py-1.5 px-4 bg-amber-500/15 border-b border-amber-500/30">
        <p className="text-sm text-center font-medium text-cockpit-amber">
          Flying offline — showing last synced data
        </p>
      </div>
    </div>
  )
}
