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

export async function saveToken(refreshToken: string): Promise<void> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.setCredentials({
    username: 'session',
    password: refreshToken,
    server: SERVER,
  })
  localStorage.setItem(HAS_CREDS_KEY, '1')
}

export async function getToken(): Promise<string | null> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to FlightCheck',
      title: 'FlightCheck',
    })
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    return creds.password
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
