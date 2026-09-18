'use client'

import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'
import { accessControl, roles } from './roles.js'

// The same access control the server uses, so the UI can ask whether the signed
// in person may do something before offering it. This only decides what is
// *shown* — every one of these calls is checked again server-side by the admin
// plugin, which is what actually enforces the split.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac: accessControl, roles })],
})
