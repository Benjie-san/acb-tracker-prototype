import type { ColumnDef, FieldDef } from '../types'

export const GROUP_A_FIELDS: FieldDef[] = [
  { key: 'client', label: 'Client', input: 'text' },
  { key: 'flightNumber', label: 'Flight Number', input: 'text' },
  { key: 'flightStatus', label: 'Flight Status', input: 'text', format: 'status' },
  { key: 'etaEst', label: 'ETA (EST)', input: 'date', format: 'date' },
  { key: 'etaStatus', label: 'ETA Status', input: 'text', format: 'status' },
  { key: 'preAlertDate', label: 'Pre-Alert Date', input: 'date', format: 'date' },
  { key: 'etaDate', label: 'ETA Date', input: 'date', format: 'date' },
  { key: 'releaseDate', label: 'Release Date', input: 'date', format: 'date' },
  { key: 'releaseStatus', label: 'Release Status', input: 'text', format: 'status' },
  { key: 'port', label: 'Port', input: 'text' },
  { key: 'nameAddress', label: 'Name / Address', input: 'checkbox' },
  { key: 'lateSecured', label: 'Late / Secured', input: 'checkbox' },
  { key: 'goodsDescription', label: 'Goods Description', input: 'checkbox' },
  { key: 'changeMAWB', label: 'Change MAWB', input: 'checkbox' },
  { key: 'changeCounts', label: 'Change Counts', input: 'checkbox' },
  { key: 'mismatchValues', label: 'Mismatch Values', input: 'checkbox' },
  { key: 'awb', label: 'AWB', input: 'text' },
  { key: 'clvs', label: 'CLVS', input: 'number' },
  { key: 'lvs', label: 'LVS', input: 'number' },
  { key: 'pga', label: 'PGA', input: 'number' },
  { key: 'total', label: 'Total', input: 'number' },
  { key: 'totalFoodItems', label: 'Total Food Items', input: 'number' },
  { key: 'analyst', label: 'Analyst', input: 'text' },
  { key: 'shipmentComments', label: 'Shipment Comments', input: 'textarea' },
]

export const GROUP_B_FIELDS: FieldDef[] = [
  { key: 'cadTransactionNumber', label: 'CAD Transaction Number', input: 'text' },
  { key: 'cadTransNumStatus', label: 'CAD Trans Num Status', input: 'text', format: 'status' },
  { key: 'dutiesLvs', label: 'Duties LVS', input: 'number' },
  { key: 'taxesLvs', label: 'Taxes LVS', input: 'number' },
  { key: 'dutiesPga', label: 'Duties PGA', input: 'number' },
  { key: 'taxesPga', label: 'Taxes PGA', input: 'number' },
  { key: 'invoiceNumber', label: 'Invoice Number', input: 'text' },
  { key: 'billingDate', label: 'Billing Date', input: 'date', format: 'date' },
  { key: 'billingClerk', label: 'Billing Clerk', input: 'text' },
  { key: 'droppedToSftp', label: 'Dropped to SFTP', input: 'checkbox' },
  { key: 'billingComments', label: 'Billing Comments', input: 'textarea' },
]

export const GROUP_C_FIELDS: FieldDef[] = [
  { key: 'activityLogs', label: 'Activity Logs', input: 'textarea' },
]

export const CORE_COLUMNS: ColumnDef[] = GROUP_A_FIELDS.map(({ key, label, format }) => ({
  key,
  label,
  format,
}))

export const BILLING_COLUMNS: ColumnDef[] = [
  { key: 'cadTransactionNumber', label: 'CAD Transaction Number' },
  { key: 'cadTransNumStatus', label: 'CAD Trans Num Status', format: 'status' },
  { key: 'dutiesLvs', label: 'Duties LVS' },
  { key: 'taxesLvs', label: 'Taxes LVS' },
  { key: 'dutiesPga', label: 'Duties PGA' },
  { key: 'taxesPga', label: 'Taxes PGA' },
  { key: 'invoiceNumber', label: 'Invoice Number' },
  { key: 'billingDate', label: 'Billing Date', format: 'date' },
  { key: 'billingClerk', label: 'Billing Clerk' },
  { key: 'droppedToSftp', label: 'Dropped to SFTP' },
  { key: 'billingComments', label: 'Billing Comments' },
]

export const ACTIVITY_COLUMNS: ColumnDef[] = [{ key: 'activityLogs', label: 'Activity Logs' }]

export const LIST_COLUMN_KEYS = [
  'client',
  'preAlertDate',
  'releaseDate',
  'awb',
  'clvs',
  'lvs',
  'pga',
  'total',
  'shipmentComments',
  'analyst',
] as const

export const LIST_COLUMNS: ColumnDef[] = LIST_COLUMN_KEYS.map((key) => {
  const field =
    GROUP_A_FIELDS.find((item) => item.key === key) ||
    GROUP_B_FIELDS.find((item) => item.key === key) ||
    GROUP_C_FIELDS.find((item) => item.key === key)
  return {
    key,
    label: field ? field.label : key,
    format: field ? field.format : undefined,
  }
})

export const buildInitialForm = () => {
  const initial: Record<string, string | boolean> = {}
  ;[...GROUP_A_FIELDS, ...GROUP_B_FIELDS, ...GROUP_C_FIELDS].forEach((field) => {
    initial[field.key] = field.input === 'checkbox' ? false : ''
  })
  return initial
}
