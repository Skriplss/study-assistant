/** Email allowed to view the feedback inbox. */
export const ADMIN_EMAIL = 'sabitov04@gmail.com'

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
