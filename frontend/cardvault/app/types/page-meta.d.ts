// Page meta flags read by middleware/auth.global.ts.
declare module '#app' {
  interface PageMeta {
    /** The page can be viewed without signing in. Pages are signed-in only by default. */
    public?: boolean
    /** The page is for signed-out visitors only (login, register). */
    guestOnly?: boolean
    /** The welcome onboarding page: signed-in users who have not chosen interests yet. */
    onboarding?: boolean
  }
}

export {}
