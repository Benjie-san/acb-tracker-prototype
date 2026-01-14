export type User = {
  id: string
  username: string
  displayName: string
  role: string
}

export type Session = {
  token: string
  user: User
}

export type Route = 'login' | 'dashboard' | 'shipments' | 'shipments-new'
export type Theme = 'light' | 'dark'

export type PresenceEditor = {
  userId: string
  displayName: string
  role: string
  updatedAt?: number
}

export type ColumnDef = {
  key: string
  label: string
  format?: 'date' | 'status'
}

export type FieldInput = 'text' | 'number' | 'date' | 'checkbox' | 'textarea'

export type FieldDef = ColumnDef & {
  input: FieldInput
}

export type AirShipment = {
  _id?: string
  [key: string]: string | number | boolean | null | undefined
}
