import { callable } from '@/lib/callable'

export const deleteAccount = callable<void, { ok: boolean }>('deleteAccount')
export const exportUserData = callable<void, { url: string; expiresInSeconds: number }>('exportUserData')
