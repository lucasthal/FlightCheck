import { Capacitor } from '@capacitor/core'

const SERVER = 'com.flightcheck.app'
const HAS_CREDS_KEY = 'flightcheck-biometric-creds'
const DEBUG_KEY = 'flightcheck-biometric-debug'

function debugLog(step: string, detail: string) {
  const prev = localStorage.getItem(DEBUG_KEY) ?? ''
  const ts = new Date().toLocaleTimeString()
  const entry = `[${ts}] ${step}: ${detail}`
  localStorage.setItem(DEBUG_KEY, (prev ? prev + '\n' : '') + entry)
}

export function getBiometricDebugLog(): string {
  return localStorage.getItem(DEBUG_KEY) ?? ''
}

export function clearBiometricDebugLog(): void {
  localStorage.removeItem(DEBUG_KEY)
}

export function hasSavedCredentials(): boolean {
  return localStorage.getItem(HAS_CREDS_KEY) === '1'
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

export async function saveToken(refreshToken: string): Promise<void> {
  debugLog('saveToken', `saving token (${refreshToken.substring(0, 8)}...)`)
  localStorage.setItem(HAS_CREDS_KEY, '1')
  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
  try {
    await NativeBiometric.setCredentials({
      username: 'session',
      password: refreshToken,
      server: SERVER,
    })
    debugLog('saveToken', 'SUCCESS')
  } catch (err) {
    debugLog('saveToken', `FAILED: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

export async function getToken(): Promise<string | null> {
  try {
    debugLog('getToken', 'starting verifyIdentity...')
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to FlightCheck',
      title: 'FlightCheck',
    })
    debugLog('getToken', 'verifyIdentity OK, getting credentials...')
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    const token = creds.password
    debugLog('getToken', token ? `got token (${token.substring(0, 8)}...)` : 'NO TOKEN in creds')
    return token || null
  } catch (err) {
    debugLog('getToken', `FAILED: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export async function deleteCredentials(): Promise<void> {
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    // credentials may not exist yet — safe to ignore
  }
  localStorage.removeItem(HAS_CREDS_KEY)
}
