import { Capacitor } from '@capacitor/core'

let Haptics: typeof import('@capacitor/haptics').Haptics | null = null

if (Capacitor.isNativePlatform()) {
  import('@capacitor/haptics').then(m => { Haptics = m.Haptics })
}

export async function tapFeedback() {
  if (!Haptics) return
  const { ImpactStyle } = await import('@capacitor/haptics')
  await Haptics.impact({ style: ImpactStyle.Light })
}
