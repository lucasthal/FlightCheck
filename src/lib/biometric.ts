import { Capacitor } from '@capacitor/core'

const SERVER = 'com.flightcheck.app'
const HAS_CREDS_KEY = 'flightcheck-biometric-creds'

export function hasSavedCredentials(): boolean {
  return localStorage.getItem(HAS_CREDS_KEY) === '1'
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER,
  })
  localStorage.setItem(HAS_CREDS_KEY, '1')
}

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to FlightCheck',
      title: 'FlightCheck',
    })
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    return { email: creds.username, password: creds.password }
  } catch {
    return null
  }
}

export async function deleteCredentials(): Promise<void> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    // credentials may not exist yet — safe to ignore
  }
  localStorage.removeItem(HAS_CREDS_KEY)
}
