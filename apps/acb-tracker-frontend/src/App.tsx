import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import * as XLSX from 'xlsx'
import brandLogo from './assets/ACB-BLUE.svg'
import brandLogoDark from './assets/acb-white.png'
import { API_URL } from './config'
import {
  GROUP_A_FIELDS,
  GROUP_B_FIELDS,
  LIST_COLUMNS,
  buildInitialForm,
} from './shipments/fields'
import { useAuthStore } from './stores/authStore'
import { usePresenceStore } from './stores/presenceStore'
import { useShipmentsStore } from './stores/shipmentsStore'
import { useUiStore } from './stores/uiStore'
import type { AirShipment, ColumnDef, FieldDef, PresenceEditor, Route, Session } from './types'
import './App.css'

type FilterRow = {
  id: string
  columnKey: string
  value: string
}

const getRouteFromLocation = (): Route => {
  if (window.location.pathname === '/shipments/new') return 'shipments-new'
  if (window.location.pathname === '/shipments') return 'shipments'
  if (window.location.pathname === '/dashboard') return 'dashboard'
  return 'login'
}

const formatDate = (value: unknown) => {
  if (!value) return '--'
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatValue = (value: unknown, format?: ColumnDef['format']) => {
  if (value === null || value === undefined || value === '') return '--'
  if (format === 'date') return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const statusTone = (value: unknown) => {
  const status = String(value || '').toLowerCase()
  if (status.includes('on time') || status.includes('clear') || status.includes('released')) {
    return 'good'
  }
  if (status.includes('pending') || status.includes('in transit') || status.includes('processing')) {
    return 'warn'
  }
  if (status.includes('hold') || status.includes('delayed') || status.includes('late')) {
    return 'alert'
  }
  return 'neutral'
}

const hasStatusToken = (value: unknown, tokens: string[]) => {
  const text = String(value || '').toLowerCase()
  return tokens.some((token) => text.includes(token))
}

const formatPresenceNames = (editors: PresenceEditor[]) => {
  const names = editors.map((editor) => editor.displayName || 'Unknown')
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

const formatExportValue = (value: unknown, format?: ColumnDef['format']) => {
  if (value === null || value === undefined || value === '') return ''
  if (format === 'date') {
    const date = new Date(value as string)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const defaultBulkValue = (field: FieldDef | undefined) => {
  if (!field) return ''
  if (field.input === 'checkbox') return false
  return ''
}

const toInputDateValue = (value: unknown) => {
  if (!value) return ''
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateTime = (value: unknown) => {
  if (!value) return '--'
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const parseDateValue = (value: unknown) => {
  if (!value) return null
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatUserLabel = (value: unknown) => {
  if (!value) return 'Unknown'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.displayName === 'string' && record.displayName.trim()) {
      return record.displayName
    }
    if (typeof record.username === 'string' && record.username.trim()) {
      return record.username
    }
    if (typeof record._id === 'string') {
      return record._id
    }
  }
  return String(value)
}

const formatLogTimestamp = (date = new Date()) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const normalizeFieldValue = (
  value: string | boolean | undefined,
  field: FieldDef
) => {
  if (field.input === 'checkbox') {
    return value ? 'true' : 'false'
  }
  if (field.input === 'number') {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? raw : String(parsed)
  }
  return String(value ?? '').trim()
}

const getChangedFieldLabels = (
  fields: FieldDef[],
  before: Record<string, string | boolean> | null,
  after: Record<string, string | boolean>
) => {
  if (!before) return []
  const changed: string[] = []
  fields.forEach((field) => {
    const previous = normalizeFieldValue(before[field.key], field)
    const next = normalizeFieldValue(after[field.key], field)
    if (previous !== next) {
      changed.push(field.label)
    }
  })
  return changed
}

const createFilterRow = (columnKey: string): FilterRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  columnKey,
  value: '',
})

const getMonthValue = (value: unknown) => {
  const dateValue = toInputDateValue(value)
  return dateValue ? dateValue.slice(0, 7) : ''
}

const normalizeFilterValue = (value: unknown, field?: FieldDef) => {
  if (value === null || value === undefined) return ''
  if (field?.input === 'checkbox') return value ? 'true' : 'false'
  if (field?.input === 'date') return toInputDateValue(value)
  return String(value)
}

function App() {
  const [route, setRoute] = useState<Route>(() => getRouteFromLocation())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterDraft, setFilterDraft] = useState<FilterRow[]>([])
  const [sortDraftField, setSortDraftField] = useState('createdAt')
  const [sortDraftOrder, setSortDraftOrder] = useState<'asc' | 'desc'>('desc')
  const [monthDraft, setMonthDraft] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['shipment-details'])
  )
  const formRef = useRef<HTMLFormElement>(null)

  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  const {
    shipments,
    shipmentsTotal,
    shipmentsLoading,
    shipmentsError,
    query,
    sortField,
    sortOrder,
    page,
    refreshTick,
    monthFilter,
    filters,
    createForm,
    editingId,
    editingVersion,
    editingSnapshot,
    createError,
    createSuccess,
    isCreating,
    selectedIds,
    isBulkOpen,
    isActivityOpen,
    isFilterOpen,
    bulkFieldKey,
    bulkValue,
    bulkError,
    bulkSuccess,
    isBulkSaving,
    setShipments,
    setShipmentsTotal,
    setShipmentsLoading,
    setShipmentsError,
    setQuery,
    setSortField,
    setSortOrder,
    setPage,
    bumpRefresh,
    setMonthFilter,
    setFilters,
    setCreateForm,
    setEditingId,
    setEditingVersion,
    setEditingSnapshot,
    setCreateError,
    setCreateSuccess,
    setIsCreating,
    setSelectedIds,
    clearSelectedIds,
    setIsBulkOpen,
    setIsActivityOpen,
    setIsFilterOpen,
    setBulkFieldKey,
    setBulkValue,
    setBulkError,
    setBulkSuccess,
    setIsBulkSaving,
    resetCreateForm,
  } = useShipmentsStore()

  const { presenceMap, setPresenceMap, updatePresence, clearPresence } = usePresenceStore()
  const limit = 12

  const navigate = useCallback((path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path)
    } else {
      window.history.pushState({}, '', path)
    }
    setRoute(getRouteFromLocation())
  }, [])

  const handleLogout = useCallback(() => {
    clearSession()
    navigate('/', true)
  }, [clearSession, navigate])

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (route !== 'shipments') {
      setIsBulkOpen(false)
    }
  }, [route, setIsBulkOpen])

  useEffect(() => {
    if (route !== 'shipments') {
      setIsFilterOpen(false)
    }
  }, [route, setIsFilterOpen])

  useEffect(() => {
    if (route !== 'shipments-new') {
      setIsActivityOpen(false)
    }
  }, [route, setIsActivityOpen])

  useEffect(() => {
    if (!session) {
      clearPresence()
      return
    }

    const url = new URL(`${API_URL}/presence/stream`)
    url.searchParams.set('token', session.token)
    const source = new EventSource(url.toString())

    const handleState = (event: MessageEvent) => {
      const payload = JSON.parse(event.data || '{}')
      const next: Record<string, PresenceEditor[]> = {}
      const items = Array.isArray(payload.items) ? payload.items : []
      items.forEach((item: { shipmentId: string; editors: PresenceEditor[] }) => {
        if (item && item.shipmentId) {
          next[String(item.shipmentId)] = Array.isArray(item.editors) ? item.editors : []
        }
      })
      setPresenceMap(next)
    }

    const handleUpdate = (event: MessageEvent) => {
      const payload = JSON.parse(event.data || '{}')
      if (!payload || !payload.shipmentId) return
      const shipmentId = String(payload.shipmentId)
      const editors = Array.isArray(payload.editors) ? payload.editors : []
      updatePresence(shipmentId, editors)
    }

    source.addEventListener('presence:state', handleState)
    source.addEventListener('presence:update', handleUpdate)

    return () => {
      source.close()
    }
  }, [clearPresence, session, setPresenceMap, updatePresence])

  useEffect(() => {
    if (!session || !editingId || route !== 'shipments-new') return
    let isActive = true

    const sendPresence = async (action: 'begin' | 'end') => {
      try {
        await fetch(`${API_URL}/presence/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ shipmentId: editingId }),
        })
      } catch {
        if (!isActive) return
      }
    }

    sendPresence('begin')
    const heartbeat = window.setInterval(() => sendPresence('begin'), 45000)

    return () => {
      isActive = false
      window.clearInterval(heartbeat)
      sendPresence('end')
    }
  }, [editingId, route, session])

  const canCreateShipment = session
    ? ['Admin', 'TL', 'Analyst'].includes(session.user.role)
    : false
  const canEditShipment = session
    ? ['Admin', 'TL', 'Analyst', 'Billing'].includes(session.user.role)
    : false
  const canSeeActivity = session ? session.user.role === 'Admin' || session.user.role === 'TL' : false

  useEffect(() => {
    if (!session && route !== 'login') {
      navigate('/', true)
    }
    if (session && route === 'login') {
      navigate('/dashboard', true)
    }
    if (session && route === 'shipments-new' && !canCreateShipment && !editingId) {
      navigate('/shipments', true)
    }
  }, [canCreateShipment, editingId, navigate, route, session])

  const shipmentColumns = useMemo(() => LIST_COLUMNS, [])

  const bulkFields = useMemo(() => {
    if (!session) return []
    if (session.user.role === 'Billing') {
      return [...GROUP_A_FIELDS, ...GROUP_B_FIELDS]
    }
    if (session.user.role === 'Admin' || session.user.role === 'TL') {
      return [...GROUP_A_FIELDS, ...GROUP_B_FIELDS]
    }
    return []
  }, [session])

  const sortOptions = useMemo(() => {
    const base = [
      { key: 'createdAt', label: 'Created' },
      { key: 'updatedAt', label: 'Updated' },
    ]
    const columnOptions = shipmentColumns.map((column) => ({
      key: column.key,
      label: column.label,
    }))
    const seen = new Set<string>()
    return [...base, ...columnOptions].filter((option) => {
      if (seen.has(option.key)) return false
      seen.add(option.key)
      return true
    })
  }, [shipmentColumns])

  useEffect(() => {
    if (!sortOptions.find((option) => option.key === sortField)) {
      setSortField('createdAt')
    }
  }, [sortField, sortOptions])

  useEffect(() => {
    if (!session || route === 'login' || route === 'shipments-new') return

    let active = true

    const fetchShipments = async () => {
      setShipmentsLoading(true)
      setShipmentsError(null)

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort: sortField,
          order: sortOrder,
        })
        if (query.trim()) {
          params.set('q', query.trim())
        }

        const response = await fetch(`${API_URL}/air-shipments?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        })

        if (response.status === 401) {
          handleLogout()
          if (active) {
            setShipmentsLoading(false)
          }
          return
        }

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message =
            typeof payload?.error === 'string' ? payload.error : 'Failed to load shipments'
          throw new Error(message)
        }

        if (!active) return
        setShipments(payload.items || [])
        setShipmentsTotal(payload.total || 0)
      } catch (err) {
        if (!active) return
        setShipmentsError(err instanceof Error ? err.message : 'Failed to load shipments')
        setShipments([])
        setShipmentsTotal(0)
      } finally {
        if (active) {
          setShipmentsLoading(false)
        }
      }
    }

    fetchShipments()

    return () => {
      active = false
    }
  }, [handleLogout, limit, page, query, refreshTick, route, session, sortField, sortOrder])

  useEffect(() => {
    clearSelectedIds()
  }, [clearSelectedIds, shipments])

  const initials = useMemo(() => {
    if (!session?.user.displayName) return 'U'
    return session.user.displayName
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [session])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Login failed'
        throw new Error(message)
      }

      const nextSession: Session = {
        token: payload.token,
        user: payload.user,
      }

      setSession(nextSession)
      setPassword('')
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditShipment = (item: AirShipment) => {
    if (!item._id || !canEditShipment) return
    const nextForm = buildInitialForm()
    const editableFields = [
      ...GROUP_A_FIELDS,
      ...(session?.user.role === 'Analyst' ? [] : GROUP_B_FIELDS),
    ]
    editableFields.forEach((field) => {
      const value = item[field.key]
      if (field.input === 'checkbox') {
        nextForm[field.key] = Boolean(value)
        return
      }

      if (field.input === 'date') {
        nextForm[field.key] = toInputDateValue(value)
        return
      }

      if (field.input === 'number') {
        nextForm[field.key] = value === null || value === undefined ? '' : String(value)
        return
      }

      nextForm[field.key] = value === null || value === undefined ? '' : String(value)
    })
    nextForm.activityLogs = typeof item.activityLogs === 'string' ? item.activityLogs : ''
    setCreateForm(nextForm)
    setEditingId(String(item._id))
    setEditingVersion(typeof item.version === 'number' ? item.version : Number(item.version))
    setEditingSnapshot({ ...nextForm })
    setCreateError(null)
    setCreateSuccess(null)
    setOpenSections(new Set(['shipment-details']))
    setIsActivityOpen(false)
    navigate('/shipments/new')
  }

  const handleDeleteShipment = async (item: AirShipment) => {
    if (!session || !item._id) return false
    const confirmed = window.confirm('Delete this shipment? This cannot be undone.')
    if (!confirmed) return false

    try {
      const response = await fetch(`${API_URL}/air-shipments/${item._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })

      if (response.status === 401) {
        handleLogout()
        return false
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Failed to delete shipment'
        throw new Error(message)
      }

      bumpRefresh()
      return true
    } catch (err) {
      setShipmentsError(err instanceof Error ? err.message : 'Failed to delete shipment')
      return false
    }
  }

  const handleCreateChange = (key: string, value: string | boolean) => {
    setCreateForm({ ...createForm, [key]: value })
  }

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || isCreating) return
    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    const isEditing = Boolean(editingId)
    const fieldsToSubmit = [
      ...GROUP_A_FIELDS,
      ...(session.user.role === 'Analyst' ? [] : GROUP_B_FIELDS),
    ]
    const payload: Record<string, unknown> = {}
    for (const field of fieldsToSubmit) {
      const value = createForm[field.key]
      if (field.input === 'checkbox') {
        payload[field.key] = Boolean(value)
        continue
      }

      if (field.input === 'number') {
        if (value === '' || value === null || value === undefined) {
          continue
        }
        const numberValue = Number(value)
        if (Number.isNaN(numberValue)) {
          setCreateError(`${field.label} must be a number`)
          setIsCreating(false)
          return
        }
        payload[field.key] = numberValue
        continue
      }

      if (field.input === 'date') {
        if (value) {
          payload[field.key] = value
        }
        continue
      }

      const textValue = String(value || '').trim()
      if (textValue) {
        payload[field.key] = textValue
      }
    }
    const payloadKeys = new Set(Object.keys(payload))

    if (!payloadKeys.size) {
      setCreateError('Enter at least one field before saving.')
      setIsCreating(false)
      return
    }

    if (canSeeActivity) {
      const actorLabel = session.user.displayName || session.user.username || 'User'
      const timestamp = formatLogTimestamp()
      if (isEditing) {
        const activityFields = fieldsToSubmit.filter((field) => payloadKeys.has(field.key))
        const changedLabels = getChangedFieldLabels(activityFields, editingSnapshot, createForm)
        if (changedLabels.length) {
          const existingLogs =
            typeof editingSnapshot?.activityLogs === 'string'
              ? editingSnapshot.activityLogs.trim()
              : ''
          const line = `[${timestamp}] ${actorLabel} updated: ${changedLabels.join(', ')}.`
          payload.activityLogs = existingLogs ? `${existingLogs}\n${line}` : line
        }
      } else {
        payload.activityLogs = `[${timestamp}] ${actorLabel} created shipment.`
      }
    }

    try {
      if (isEditing) {
        if (editingVersion === null || Number.isNaN(editingVersion)) {
          setCreateError('Missing version. Reload the shipment list and try again.')
          setIsCreating(false)
          return
        }
        payload.version = editingVersion
      }

      const response = await fetch(
        isEditing ? `${API_URL}/air-shipments/${editingId}` : `${API_URL}/air-shipments`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      if (response.status === 401) {
        handleLogout()
        setIsCreating(false)
        return
      }

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          typeof result?.error === 'string' ? result.error : 'Failed to create shipment'
        throw new Error(message)
      }

      const item = result?.item
      if (editingId) {
        setCreateSuccess('Shipment updated.')
        if (item && typeof item.version === 'number') {
          setEditingVersion(item.version)
        }
        const nextSnapshot = { ...createForm }
        if (item && typeof item.activityLogs === 'string') {
          nextSnapshot.activityLogs = item.activityLogs
        } else if (typeof payload.activityLogs === 'string') {
          nextSnapshot.activityLogs = payload.activityLogs
        }
        setEditingSnapshot(nextSnapshot)
      } else {
        setCreateSuccess('Shipment created.')
        setCreateForm(buildInitialForm())
        setEditingSnapshot(null)
      }
      bumpRefresh()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create shipment')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenShipments = () => {
    setIsActivityOpen(false)
    navigate('/shipments')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenCreate = () => {
    if (!canCreateShipment) return
    resetCreateForm()
    setOpenSections(new Set(['shipment-details']))
    setIsActivityOpen(false)
    navigate('/shipments/new')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenDashboard = () => {
    setIsActivityOpen(false)
    navigate('/dashboard')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleHeaderEdit = () => {
    if (!editingId) return
    formRef.current?.requestSubmit()
  }

  const handleHeaderDelete = async () => {
    if (!editingId) return
    const ok = await handleDeleteShipment({ _id: editingId } as AirShipment)
    if (ok) {
      handleOpenShipments()
    }
  }

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExportSelected = () => {
    if (!selectedItems.length) return
    const headers = shipmentColumns.map((column) => column.label)
    const rows = selectedItems.map((item) =>
      shipmentColumns.map((column) => formatExportValue(item[column.key], column.format))
    )
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Air Shipments')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `air-shipments_${dateStamp}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const handleOpenBulk = () => {
    if (!bulkFields.length) return
    const firstField = bulkFields[0]
    setBulkFieldKey(firstField.key)
    setBulkValue(defaultBulkValue(firstField))
    setBulkError(null)
    setBulkSuccess(null)
    setIsFilterOpen(false)
    setIsBulkOpen(true)
  }

  const handleCloseBulk = () => {
    setIsBulkOpen(false)
    setBulkError(null)
    setBulkSuccess(null)
  }

  const handleOpenActivity = () => {
    if (!editingId || !canSeeActivity) return
    setIsActivityOpen(true)
  }

  const handleCloseActivity = () => {
    setIsActivityOpen(false)
  }

  const handleOpenFilter = () => {
    const fallbackKey = shipmentColumns[0]?.key || 'client'
    const initialFilters = filters.length
      ? filters.map((filter) => ({ ...filter }))
      : [createFilterRow(fallbackKey)]
    setFilterDraft(initialFilters)
    setSortDraftField(sortField)
    setSortDraftOrder(sortOrder)
    setMonthDraft(monthFilter)
    setIsBulkOpen(false)
    setIsFilterOpen(true)
  }

  const handleCloseFilter = () => {
    setIsFilterOpen(false)
  }

  const handleAddFilterRow = () => {
    const fallbackKey = shipmentColumns[0]?.key || 'client'
    setFilterDraft((prev) => [...prev, createFilterRow(fallbackKey)])
  }

  const handleRemoveFilterRow = (id: string) => {
    setFilterDraft((prev) => prev.filter((row) => row.id !== id))
  }

  const handleUpdateFilterRow = (id: string, patch: Partial<FilterRow>) => {
    setFilterDraft((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }

  const handleApplyFilters = () => {
    const cleaned = filterDraft
      .map((row) => ({
        ...row,
        value: row.value.trim(),
      }))
      .filter((row) => row.columnKey)
    setFilters(cleaned.filter((row) => row.value))
    setSortField(sortDraftField)
    setSortOrder(sortDraftOrder)
    setMonthFilter(monthDraft)
    setPage(1)
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    const fallbackKey = shipmentColumns[0]?.key || 'client'
    setMonthDraft('')
    setMonthFilter('')
    setFilters([])
    setQuery('')
    setFilterDraft([createFilterRow(fallbackKey)])
    setPage(1)
    bumpRefresh()
  }

  const totalPages = Math.max(Math.ceil(shipmentsTotal / limit), 1)
  const canDeleteShipment = session
    ? session.user.role === 'Admin' || session.user.role === 'TL'
    : false
  const canBulkEdit = session
    ? session.user.role === 'Admin' || session.user.role === 'TL' || session.user.role === 'Billing'
    : false
  const canSeeBilling = session
    ? session.user.role === 'Admin' ||
      session.user.role === 'TL' ||
      session.user.role === 'Billing'
    : false
  const pendingBillingCount = canSeeBilling
    ? shipments.filter((item) => !item.invoiceNumber).length
    : null
  const apiLabel = API_URL.replace(/^https?:\/\//, '')
  const showLogin = !session
  const isShipmentsRoute = route === 'shipments' || route === 'shipments-new'
  const showBillingFields =
    session?.user.role === 'Admin' ||
    session?.user.role === 'TL' ||
    session?.user.role === 'Billing'
  const fieldMap = useMemo(
    () =>
      new Map(
        [...GROUP_A_FIELDS, ...GROUP_B_FIELDS].map((field) => [field.key, field])
      ),
    []
  )
  const visibleFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    GROUP_A_FIELDS.forEach((field) => keys.add(field.key))
    if (showBillingFields) {
      GROUP_B_FIELDS.forEach((field) => keys.add(field.key))
    }
    return keys
  }, [showBillingFields])
  const formSections = useMemo(() => {
    const sections = [
      {
        id: 'shipment-details',
        title: 'Shipment details',
        keys: [
          'client',
          'flightNumber',
          'flightStatus',
          'etaEst',
          'etaStatus',
          'preAlertDate',
          'etaDate',
          'releaseDate',
          'releaseStatus',
          'port',
        ],
      },
      {
        id: 'spreadsheet-management',
        title: 'Spreadsheet management',
        keys: [
          'nameAddress',
          'lateSecured',
          'goodsDescription',
          'changeMAWB',
          'changeCounts',
          'mismatchValues',
        ],
      },
      {
        id: 'shipment-breakdown',
        title: 'Shipment breakdown',
        keys: ['awb', 'clvs', 'lvs', 'pga', 'total'],
      },
      {
        id: 'others',
        title: 'Others',
        keys: ['totalFoodItems', 'analyst', 'shipmentComments'],
      },
    ]
    if (showBillingFields) {
      sections.push({
        id: 'billing-details',
        title: 'Billing details',
        keys: [
          'cadTransactionNumber',
          'cadTransNumStatus',
          'dutiesLvs',
          'taxesLvs',
          'dutiesPga',
          'taxesPga',
          'invoiceNumber',
          'billingDate',
          'billingClerk',
          'droppedToSftp',
          'billingComments',
        ],
      })
    }
    return sections
      .map((section) => ({
        ...section,
        fields: section.keys
          .map((key) => fieldMap.get(key))
          .filter((field): field is FieldDef => Boolean(field))
          .filter((field) => visibleFieldKeys.has(field.key)),
      }))
      .filter((section) => section.fields.length)
  }, [fieldMap, showBillingFields, visibleFieldKeys])
  const formTitle = useMemo(() => {
    if (!editingId) return 'New Air Shipment'
    const clientLabel = String(createForm.client || 'Client').trim() || 'Client'
    const awbLabel = String(createForm.awb || 'AWB').trim() || 'AWB'
    return `${clientLabel} - ${awbLabel}`
  }, [createForm.awb, createForm.client, editingId])

  const filterFieldMap = useMemo(
    () =>
      new Map(
        [...GROUP_A_FIELDS, ...GROUP_B_FIELDS].map((field) => [field.key, field])
      ),
    []
  )

  const activeFilters = useMemo(
    () => filters.filter((filter) => filter.value.trim()),
    [filters]
  )

  const monthFilterValue = monthFilter.trim()
  const hasMonthFilter = Boolean(monthFilterValue)
  const activeFilterCount = activeFilters.length + (hasMonthFilter ? 1 : 0)

  const filteredShipments = useMemo(() => {
    if (!activeFilters.length && !hasMonthFilter) return shipments
    return shipments.filter((item) =>
      (!hasMonthFilter ||
        getMonthValue(item.preAlertDate) === monthFilterValue ||
        getMonthValue(item.etaDate) === monthFilterValue ||
        getMonthValue(item.releaseDate) === monthFilterValue) &&
      activeFilters.every((filter) => {
        const field = filterFieldMap.get(filter.columnKey)
        const rawValue = item[filter.columnKey]
        const normalizedValue = normalizeFilterValue(rawValue, field).toLowerCase()
        let filterValue = filter.value.trim().toLowerCase()
        if (!filterValue) return true
        if (field?.input === 'number') {
          const parsed = Number(filter.value)
          if (!Number.isNaN(parsed)) {
            return Number(rawValue) === parsed
          }
        }
        if (field?.input === 'checkbox') {
          if (filterValue === 'yes') filterValue = 'true'
          if (filterValue === 'no') filterValue = 'false'
          return normalizedValue === filterValue
        }
        if (field?.input === 'date') {
          return normalizedValue === filterValue
        }
        return normalizedValue.includes(filterValue)
      })
    )
  }, [activeFilters, filterFieldMap, hasMonthFilter, monthFilterValue, shipments])

  const activeShipment = useMemo(() => {
    if (!editingId) return null
    return shipments.find((item) => String(item._id) === editingId) || null
  }, [editingId, shipments])

  const activityEntries = useMemo(() => {
    if (!activeShipment?.activityLogs) return []
    return String(activeShipment.activityLogs)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }, [activeShipment?.activityLogs])

  const atRiskShipments = useMemo(() => {
    return shipments
      .filter((item) => {
        const statusValues = [item.flightStatus, item.etaStatus, item.releaseStatus]
        const hasAlert = statusValues.some((value) => statusTone(value) === 'alert')
        return hasAlert || Boolean(item.lateSecured)
      })
      .slice(0, 5)
  }, [shipments])

  const upcomingEtas = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 7)
    cutoff.setHours(23, 59, 59, 999)
    return shipments
      .map((item) => {
        const etaValue = item.etaDate || item.etaEst
        const etaDate = parseDateValue(etaValue)
        if (!etaDate) return null
        return { item, etaDate }
      })
      .filter((entry): entry is { item: AirShipment; etaDate: Date } => Boolean(entry))
      .filter((entry) => entry.etaDate >= today && entry.etaDate <= cutoff)
      .sort((a, b) => a.etaDate.getTime() - b.etaDate.getTime())
      .slice(0, 5)
  }, [shipments])

  const recentActivity = useMemo(() => {
    return shipments
      .map((item) => {
        const updatedAt = parseDateValue(item.updatedAt)
        const createdAt = parseDateValue(item.createdAt)
        const date = updatedAt || createdAt
        if (!date) return null
        const isUpdated =
          Boolean(updatedAt) && Boolean(createdAt) && updatedAt!.getTime() !== createdAt!.getTime()
        return { item, date, isUpdated }
      })
      .filter((entry): entry is { item: AirShipment; date: Date; isUpdated: boolean } =>
        Boolean(entry)
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
  }, [shipments])

  const billingQueue = useMemo(() => {
    if (!canSeeBilling) return []
    return shipments.filter((item) => !item.invoiceNumber).slice(0, 5)
  }, [canSeeBilling, shipments])

  const topClients = useMemo(() => {
    const counts = new Map<string, number>()
    shipments.forEach((item) => {
      const name = String(item.client || '').trim()
      if (!name) return
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([client, count]) => ({ client, count }))
      .sort((a, b) => b.count - a.count || a.client.localeCompare(b.client))
      .slice(0, 5)
  }, [shipments])

  const alertsSummary = useMemo(() => {
    const holdCount = shipments.filter((item) =>
      hasStatusToken(item.releaseStatus, ['hold']) ||
      hasStatusToken(item.flightStatus, ['hold']) ||
      hasStatusToken(item.etaStatus, ['hold'])
    ).length
    const lateCount = shipments.filter((item) => {
      if (item.lateSecured) return true
      return (
        hasStatusToken(item.flightStatus, ['late', 'delay']) ||
        hasStatusToken(item.etaStatus, ['late', 'delay'])
      )
    }).length
    const missingDocsCount = shipments.filter(
      (item) => item.nameAddress === false || item.goodsDescription === false
    ).length
    return { holdCount, lateCount, missingDocsCount }
  }, [shipments])

  const rowKeys = useMemo(
    () =>
      filteredShipments.map((item, index) =>
        item._id ? String(item._id) : `row-${index}`
      ),
    [filteredShipments]
  )
  const selectedItems = useMemo(
    () =>
      filteredShipments.filter((item, index) => {
        const key = item._id ? String(item._id) : `row-${index}`
        return selectedIds.has(key)
      }),
    [selectedIds, filteredShipments]
  )
  const selectedIdsForBulk = selectedItems
    .map((item) => (item._id ? String(item._id) : null))
    .filter((id): id is string => Boolean(id))
  const allSelected = rowKeys.length > 0 && rowKeys.every((key) => selectedIds.has(key))
  const selectedCount = rowKeys.filter((key) => selectedIds.has(key)).length

  const gridStyle = useMemo(
    () =>
      ({
        '--grid-columns': shipmentColumns.length,
      }) as CSSProperties,
    [shipmentColumns.length]
  )

  const bulkFieldDef = bulkFields.find((field) => field.key === bulkFieldKey)

  const handleBulkFieldChange = (nextKey: string) => {
    const nextField = bulkFields.find((field) => field.key === nextKey)
    setBulkFieldKey(nextKey)
    setBulkValue(defaultBulkValue(nextField))
    setBulkError(null)
    setBulkSuccess(null)
  }

  const handleBulkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || isBulkSaving) return
    if (!bulkFieldDef) {
      setBulkError('Select a field to update.')
      return
    }
    if (!selectedIdsForBulk.length) {
      setBulkError('Select at least one shipment first.')
      return
    }

    let valueToSend: string | number | boolean
    if (bulkFieldDef.input === 'checkbox') {
      valueToSend = Boolean(bulkValue)
    } else if (bulkFieldDef.input === 'number') {
      const parsed = Number(bulkValue)
      if (Number.isNaN(parsed)) {
        setBulkError(`${bulkFieldDef.label} must be a number.`)
        return
      }
      valueToSend = parsed
    } else if (bulkFieldDef.input === 'date') {
      const dateValue = String(bulkValue || '').trim()
      if (!dateValue) {
        setBulkError(`${bulkFieldDef.label} is required.`)
        return
      }
      valueToSend = dateValue
    } else {
      const textValue = String(bulkValue || '').trim()
      if (!textValue) {
        setBulkError(`${bulkFieldDef.label} is required.`)
        return
      }
      valueToSend = textValue
    }

    const versions = selectedItems.reduce<Record<string, number>>((acc, item) => {
      if (item._id && typeof item.version === 'number') {
        acc[String(item._id)] = item.version
      }
      return acc
    }, {})

    setIsBulkSaving(true)
    setBulkError(null)
    setBulkSuccess(null)

    try {
      const response = await fetch(`${API_URL}/air-shipments/bulk`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          ids: selectedIdsForBulk,
          patch: { [bulkFieldDef.key]: valueToSend },
          versions,
        }),
      })

      if (response.status === 401) {
        handleLogout()
        return
      }

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Bulk update failed.'
        throw new Error(message)
      }

      const results: { status?: string }[] = Array.isArray(payload.results)
        ? payload.results
        : []
      const updatedCount = results.filter((item) => item.status === 'updated').length
      const failedCount = results.length - updatedCount
      setBulkSuccess(
        failedCount
          ? `Updated ${updatedCount} shipments. ${failedCount} need a refresh.`
          : `Updated ${updatedCount} shipments.`
      )
      bumpRefresh()
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed.')
    } finally {
      setIsBulkSaving(false)
    }
  }

  return (
    <div className="app" data-theme={theme}>
      <div className="login-shell">
        {showLogin ? (
          <header className="brand">
            <div className="brand-left">
              <div className="brand-mark" aria-hidden="true">
                <img className="brand-logo brand-logo-light" src={brandLogo} alt="" />
                <img className="brand-logo brand-logo-dark" src={brandLogoDark} alt="" />
              </div>
              <div className="brand-copy">
                <p>Access Customs Brokerage</p>
                <span>Information Tracker</span>
              </div>
            </div>
            <div className="brand-actions">
              <button
                className="theme-toggle"
                type="button"
                onClick={toggleTheme}
                aria-pressed={theme === 'dark'}
              >
                <span className="theme-toggle-indicator" aria-hidden="true" />
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <div className="brand-chip">Prototype</div>
            </div>
          </header>
        ) : null}

        {showLogin ? (
          <div className="content">
            <section className="intro">
              <p className="eyebrow">Single tenant operations</p>
              <h1>Track air shipments with clarity.</h1>
              <p className="lead">
                A focused workspace for analysts, billing, and team leads to keep
                every shipment updated, auditable, and export ready.
              </p>
              <div className="pill-row">
                <span className="pill">Role based fields</span>
                <span className="pill">Bulk updates</span>
                <span className="pill">Excel export</span>
              </div>
              <div className="grid-preview">
                <div className="grid-header">
                  <span>Client</span>
                  <span>Status</span>
                  <span>ETA</span>
                </div>
                <div className="grid-row">
                  <span>Northwind</span>
                  <span className="status good">On time</span>
                  <span>Jan 12</span>
                </div>
                <div className="grid-row">
                  <span>BlueSky</span>
                  <span className="status warn">Pending</span>
                  <span>Jan 14</span>
                </div>
                <div className="grid-row">
                  <span>Delta Cargo</span>
                  <span className="status alert">Hold</span>
                  <span>Jan 15</span>
                </div>
                <div className="grid-footnote">Live view updates across roles.</div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Sign in</h2>
                <p>Use your assigned credentials to access the tracker.</p>
              </div>
              <form className="form" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Username</span>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    placeholder="e.g. analyst"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                {error ? (
                  <div className="form-alert" role="alert" aria-live="polite">
                    {error}
                  </div>
                ) : null}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
                <p className="helper">
                  Server: <span>{apiLabel}</span>
                </p>
              </form>
            </section>
          </div>
        ) : (
          <div
            className={`dashboard ${isShipmentsRoute ? 'is-shipments' : ''} ${
              isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'
            }`}
          >
            <nav
              className={`sidebar ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
              id="sidebar"
            >
              <div className="sidebar-card">
                <div className="sidebar-brand">
                  <div className="brand-mark sidebar-mark" aria-hidden="true">
                    <img className="brand-logo brand-logo-light" src={brandLogo} alt="" />
                    <img className="brand-logo brand-logo-dark" src={brandLogoDark} alt="" />
                  </div>
                  <div className="sidebar-brand-text">
                    <p>Access Customs Brokerage</p>
                    <span>Information Tracker</span>
                  </div>
                </div>
                <button
                  className={`sidebar-link ${route === 'dashboard' ? 'is-active' : ''}`}
                  type="button"
                  onClick={handleOpenDashboard}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                      <path
                        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="sidebar-link-text">Dashboard</span>
                </button>
                <button
                  className={`sidebar-link ${route === 'shipments' ? 'is-active' : ''}`}
                  type="button"
                  onClick={handleOpenShipments}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                      <path
                        d="M3 11l18-6-6 18-3-7-9-5z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 12l4 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="sidebar-link-text">Air Shipments</span>
                </button>
                <p className="sidebar-hint">Role-based columns adapt to your access.</p>
                <div className="sidebar-footer">
                  <button
                    className="theme-toggle"
                    type="button"
                    onClick={toggleTheme}
                    aria-pressed={theme === 'dark'}
                  >
                    <span className="theme-toggle-indicator" aria-hidden="true" />
                    <span>{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                  </button>
                  <button
                    className="sidebar-hide"
                    type="button"
                    onClick={toggleSidebar}
                    aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                  >
                    <span className="sidebar-hide-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" role="img" aria-hidden="true">
                        <path
                          d="M3 6h14M3 10h14M3 14h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span className="sidebar-hide-text">
                      {isSidebarOpen ? 'Hide' : 'Show'}
                    </span>
                  </button>
                </div>
              </div>
            </nav>
            <section className="dashboard-main">
              {route === 'dashboard' ? (
                <>
                  <p className="eyebrow">Dashboard</p>
                  <h1>Shipment overview</h1>
                  <p className="lead">
                    Live shipment activity with role based visibility, bulk edits, and export-ready
                    views.
                  </p>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <p className="stat-label">Active shipments</p>
                      <p className="stat-value">
                        {shipmentsLoading ? '...' : shipmentsTotal.toLocaleString()}
                      </p>
                      <p className="stat-meta">Based on current filters</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Pending billing</p>
                      <p className="stat-value">
                        {shipmentsLoading
                          ? '...'
                          : pendingBillingCount === null
                            ? '--'
                            : pendingBillingCount.toLocaleString()}
                      </p>
                      <p className="stat-meta">
                        {pendingBillingCount === null
                          ? 'Not visible to your role'
                          : 'Missing invoice'}
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Team leads online</p>
                      <p className="stat-value">3</p>
                      <p className="stat-meta">Presence ready</p>
                    </div>
                  </div>
                  <div className="overview-grid">
                    <div className="overview-column">
                      <div className="panel overview-panel">
                        <div className="overview-header">
                          <div>
                            <p className="eyebrow">At risk</p>
                            <h3>At-risk shipments</h3>
                          </div>
                          <span className="overview-count">{atRiskShipments.length}</span>
                        </div>
                        {atRiskShipments.length ? (
                          <div className="overview-list">
                            {atRiskShipments.map((item, index) => {
                              const clientLabel = String(item.client || 'Unknown').trim() || 'Unknown'
                              const awbLabel = String(item.awb || '').trim()
                              const statuses = [
                                { label: 'Release', value: item.releaseStatus },
                                { label: 'ETA', value: item.etaStatus },
                                { label: 'Flight', value: item.flightStatus },
                              ]
                              const alertStatus = statuses.find(
                                (status) => statusTone(status.value) === 'alert' && status.value
                              )
                              const riskLabel = alertStatus
                                ? `${alertStatus.label}: ${formatValue(alertStatus.value)}`
                                : item.lateSecured
                                  ? 'Late / Secured'
                                  : 'At risk'
                              return (
                                <div key={item._id || `risk-${index}`} className="overview-item">
                                  <div>
                                    <p className="overview-title">{clientLabel}</p>
                                    <p className="overview-sub">
                                      {awbLabel ? `AWB ${awbLabel}` : 'Needs attention'}
                                    </p>
                                  </div>
                                  <span className="overview-tag">{riskLabel}</span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="overview-empty">No at-risk shipments on this page.</p>
                        )}
                      </div>

                      <div className="panel overview-panel">
                        <div className="overview-header">
                          <div>
                            <p className="eyebrow">Upcoming</p>
                            <h3>Upcoming ETAs</h3>
                          </div>
                          <span className="overview-count">{upcomingEtas.length}</span>
                        </div>
                        {upcomingEtas.length ? (
                          <div className="overview-list">
                            {upcomingEtas.map((entry, index) => {
                              const clientLabel =
                                String(entry.item.client || 'Unknown').trim() || 'Unknown'
                              const awbLabel = String(entry.item.awb || '').trim()
                              return (
                                <div key={entry.item._id || `eta-${index}`} className="overview-item">
                                  <div>
                                    <p className="overview-title">{clientLabel}</p>
                                    <p className="overview-sub">
                                      {awbLabel ? `AWB ${awbLabel}` : 'ETA scheduled'}
                                    </p>
                                  </div>
                                  <span className="overview-tag">
                                    {formatDate(entry.etaDate.toISOString())}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="overview-empty">No upcoming ETAs in the next 7 days.</p>
                        )}
                      </div>

                      <div className="panel overview-panel">
                        <div className="overview-header">
                          <div>
                            <p className="eyebrow">Activity</p>
                            <h3>Recent updates</h3>
                          </div>
                          <span className="overview-count">{recentActivity.length}</span>
                        </div>
                        {recentActivity.length ? (
                          <div className="overview-list">
                            {recentActivity.map((entry, index) => {
                              const clientLabel =
                                String(entry.item.client || 'Unknown').trim() || 'Unknown'
                              const actor = entry.isUpdated
                                ? formatUserLabel(entry.item.updatedBy)
                                : formatUserLabel(entry.item.createdBy)
                              return (
                                <div
                                  key={entry.item._id || `activity-${index}`}
                                  className="overview-item"
                                >
                                  <div>
                                    <p className="overview-title">{clientLabel}</p>
                                    <p className="overview-sub">
                                      {entry.isUpdated ? 'Updated' : 'Created'} by {actor}
                                    </p>
                                  </div>
                                  <span className="overview-tag">{formatDateTime(entry.date)}</span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="overview-empty">No recent activity to show.</p>
                        )}
                      </div>
                    </div>

                    <div className="overview-column">
                      <div className="panel overview-panel">
                        <div className="overview-header">
                          <div>
                            <p className="eyebrow">Billing</p>
                            <h3>Billing queue</h3>
                          </div>
                          <span className="overview-count">
                            {canSeeBilling ? billingQueue.length : '--'}
                          </span>
                        </div>
                        {!canSeeBilling ? (
                          <p className="overview-empty">Not visible to your role.</p>
                        ) : billingQueue.length ? (
                          <div className="overview-list">
                            {billingQueue.map((item, index) => {
                              const clientLabel =
                                String(item.client || 'Unknown').trim() || 'Unknown'
                              const awbLabel = String(item.awb || '').trim()
                              return (
                                <div key={item._id || `billing-${index}`} className="overview-item">
                                  <div>
                                    <p className="overview-title">{clientLabel}</p>
                                    <p className="overview-sub">
                                      {awbLabel ? `AWB ${awbLabel}` : 'Invoice missing'}
                                    </p>
                                  </div>
                                  <span className="overview-tag">Missing invoice</span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="overview-empty">No pending billing items.</p>
                        )}
                      </div>

                      <div className="panel overview-panel">
                        <div className="overview-header">
                          <div>
                            <p className="eyebrow">Volume</p>
                            <h3>Top clients</h3>
                          </div>
                          <span className="overview-count">{topClients.length}</span>
                        </div>
                        {topClients.length ? (
                          <div className="overview-list">
                            {topClients.map((client) => (
                              <div key={client.client} className="overview-item">
                                <div>
                                  <p className="overview-title">{client.client}</p>
                                  <p className="overview-sub">Shipments this page</p>
                                </div>
                                <span className="overview-tag">{client.count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="overview-empty">No client data yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : route === 'shipments' ? (
                <div className="shipments-view">
                  <div className="panel shipments-panel">
                    <div className="shipments-header">
                      <div>
                        <h2>Air Shipments</h2>
                        <p>Role based columns with optimistic updates.</p>
                      </div>
                      <div className="shipments-actions">
                        <button
                          className="ghost-button filter-button"
                          type="button"
                          onClick={handleOpenFilter}
                        >
                          <span className="icon" aria-hidden="true">
                            <svg viewBox="0 0 20 20" role="img" aria-hidden="true">
                              <path
                                d="M3 5h14M6 10h8M8 15h4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          Sort & Filter
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={bumpRefresh}
                          disabled={shipmentsLoading}
                        >
                          Refresh
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={handleExportSelected}
                          disabled={selectedIdsForBulk.length === 0}
                          title={
                            selectedIdsForBulk.length === 0
                              ? 'Select shipments to enable export'
                              : 'Export selected shipments to Excel'
                          }
                        >
                          Export Excel
                        </button>
                        {canBulkEdit ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={handleOpenBulk}
                            disabled={selectedIdsForBulk.length === 0}
                            title={
                              selectedIdsForBulk.length === 0
                                ? 'Select shipments to enable bulk edit'
                                : 'Bulk edit selected shipments'
                            }
                          >
                            Bulk edit ({selectedIdsForBulk.length})
                          </button>
                        ) : null}
                        {canCreateShipment ? (
                          <button className="primary-button" type="button" onClick={handleOpenCreate}>
                            Add shipment
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="shipments-grid-wrap" style={gridStyle}>
                      <div className="shipments-grid" role="grid">
                        <div className="shipments-grid-row shipments-grid-header" role="row">
                          <div className="shipments-grid-cell is-control" role="columnheader">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(event) => {
                                const next = new Set<string>()
                                if (event.target.checked) {
                                  rowKeys.forEach((key) => next.add(key))
                                }
                                setSelectedIds(next)
                              }}
                              aria-label="Select all shipments on this page"
                            />
                            <span className="control-label">Select</span>
                          </div>
                          {shipmentColumns.map((column) => (
                            <div
                              key={column.key}
                              className="shipments-grid-cell"
                              role="columnheader"
                            >
                              {column.label}
                            </div>
                          ))}
                        </div>
                        {shipmentsLoading ? (
                          <div className="shipments-grid-empty">Loading shipments...</div>
                        ) : shipmentsError ? (
                          <div className="shipments-grid-empty">{shipmentsError}</div>
                        ) : filteredShipments.length === 0 ? (
                          <div className="shipments-grid-empty">
                            {activeFilterCount
                              ? 'No shipments match your filters.'
                              : 'No shipments found.'}
                          </div>
                        ) : (
                          filteredShipments.map((item, index) => {
                            const rowKey = item._id ? String(item._id) : `row-${index}`
                            const isSelected = selectedIds.has(rowKey)
                            const editors = presenceMap[rowKey] || []
                            const visibleEditors = session
                              ? editors.filter((editor) => editor.userId !== session.user.id)
                              : editors
                            const presenceLabel = formatPresenceNames(visibleEditors)
                            const hasPresence = visibleEditors.length > 0
                            return (
                              <div
                                key={rowKey}
                                className={`shipments-grid-row ${isSelected ? 'is-selected' : ''} ${
                                  hasPresence ? 'is-presence' : ''
                                }`}
                                role="row"
                                onClick={() => handleEditShipment(item)}
                              >
                                <div className="shipments-grid-cell is-control" role="gridcell">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => {
                                      const next = new Set(selectedIds)
                                      if (event.target.checked) {
                                        next.add(rowKey)
                                      } else {
                                        next.delete(rowKey)
                                      }
                                      setSelectedIds(next)
                                    }}
                                    aria-label={`Select shipment ${rowKey}`}
                                  />
                                </div>
                                {shipmentColumns.map((column) => {
                                  const value = item[column.key]
                                  if (column.format === 'status' && value) {
                                    const tone = statusTone(value)
                                    return (
                                      <div
                                        key={`${column.key}-${index}`}
                                        className="shipments-grid-cell"
                                        role="gridcell"
                                      >
                                        <span className={`status-chip status-${tone}`}>
                                          {formatValue(value)}
                                        </span>
                                      </div>
                                    )
                                  }

                                  return (
                                    <div
                                      key={`${column.key}-${index}`}
                                      className="shipments-grid-cell"
                                      role="gridcell"
                                    >
                                      {formatValue(value, column.format)}
                                    </div>
                                  )
                                })}
                                {hasPresence ? (
                                  <div className="presence-badge is-float" role="status">
                                    <span className="presence-dot" aria-hidden="true" />
                                    Editing: {presenceLabel}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="shipments-footer">
                      <span>
                        Showing {filteredShipments.length} of{' '}
                        {shipmentsTotal.toLocaleString()} shipments
                        {activeFilterCount
                          ? ` (${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active)`
                          : ''}
                      </span>
                      <span>Selected {selectedCount}</span>
                      <div className="pagination">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setPage(Math.max(page - 1, 1))}
                          disabled={page <= 1 || shipmentsLoading}
                        >
                          Prev
                        </button>
                        <span>
                          Page {page} of {totalPages}
                        </span>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setPage(Math.min(page + 1, totalPages))}
                          disabled={page >= totalPages || shipmentsLoading}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                  {isBulkOpen ? (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal-panel">
                        <div className="modal-header">
                          <div>
                            <p className="eyebrow">Bulk edit</p>
                            <h2>Update selected shipments</h2>
                          </div>
                          <button className="text-button" type="button" onClick={handleCloseBulk}>
                            Close
                          </button>
                        </div>

                        <p className="modal-sub">
                          Selected: {selectedIdsForBulk.length} shipment
                          {selectedIdsForBulk.length === 1 ? '' : 's'}
                        </p>

                        <form className="modal-form" onSubmit={handleBulkSubmit}>
                          <label className="field-block">
                            <span>Field</span>
                            <select
                              value={bulkFieldKey}
                              onChange={(event) => handleBulkFieldChange(event.target.value)}
                            >
                              {bulkFields.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          {bulkFieldDef ? (
                            bulkFieldDef.input === 'textarea' ? (
                              <label className="field-block field-textarea">
                                <span>Value</span>
                                <textarea
                                  rows={3}
                                  value={String(bulkValue)}
                                  onChange={(event) => setBulkValue(event.target.value)}
                                />
                              </label>
                            ) : bulkFieldDef.input === 'checkbox' ? (
                              <label className="field-block">
                                <span>Value</span>
                                <select
                                  value={bulkValue ? 'true' : 'false'}
                                  onChange={(event) => setBulkValue(event.target.value === 'true')}
                                >
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              </label>
                            ) : (
                              <label className="field-block">
                                <span>Value</span>
                                <input
                                  type={
                                    bulkFieldDef.input === 'number'
                                      ? 'number'
                                      : bulkFieldDef.input === 'date'
                                        ? 'date'
                                        : 'text'
                                  }
                                  value={typeof bulkValue === 'string' ? bulkValue : ''}
                                  onChange={(event) => setBulkValue(event.target.value)}
                                />
                              </label>
                            )
                          ) : null}

                          {bulkError ? (
                            <div className="form-alert" role="alert" aria-live="polite">
                              {bulkError}
                            </div>
                          ) : null}
                          {bulkSuccess ? (
                            <div className="form-success" role="status" aria-live="polite">
                              {bulkSuccess}
                            </div>
                          ) : null}

                          <div className="form-actions">
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={isBulkSaving}
                            >
                              {isBulkSaving ? 'Updating...' : 'Apply changes'}
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={handleCloseBulk}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : null}
                  {isFilterOpen ? (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal-panel filter-modal">
                        <div className="modal-header">
                          <div>
                            <p className="eyebrow">Sort and filter</p>
                            <h2>Refine shipments</h2>
                          </div>
                          <button className="text-button" type="button" onClick={handleCloseFilter}>
                            Close
                          </button>
                        </div>

                        <div className="filter-section">
                          <label className="field-block">
                            <span>Sort by</span>
                            <select
                              value={sortDraftField}
                              onChange={(event) => setSortDraftField(event.target.value)}
                            >
                              {sortOptions.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field-block">
                            <span>Order</span>
                            <select
                              value={sortDraftOrder}
                              onChange={(event) =>
                                setSortDraftOrder(event.target.value as 'asc' | 'desc')
                              }
                            >
                              <option value="desc">Newest</option>
                              <option value="asc">Oldest</option>
                            </select>
                          </label>
                          <label className="field-block">
                            <span>Month</span>
                            <div className="filter-month">
                              <input
                                type="month"
                                value={monthDraft}
                                onChange={(event) => setMonthDraft(event.target.value)}
                              />
                              <button
                                className="text-button"
                                type="button"
                                onClick={() => setMonthDraft('')}
                              >
                                All
                              </button>
                            </div>
                          </label>
                        </div>

                        <div className="filter-rows">
                          {filterDraft.length ? (
                            filterDraft.map((row) => {
                              const field = filterFieldMap.get(row.columnKey)
                              const inputType =
                                field?.input === 'number'
                                  ? 'number'
                                  : field?.input === 'date'
                                    ? 'date'
                                    : 'text'
                              return (
                                <div key={row.id} className="filter-row">
                                  <label className="field-block is-compact">
                                    <span className="sr-only">Column</span>
                                    <select
                                      value={row.columnKey}
                                      onChange={(event) =>
                                        handleUpdateFilterRow(row.id, {
                                          columnKey: event.target.value,
                                          value: '',
                                        })
                                      }
                                      aria-label="Filter column"
                                    >
                                      {shipmentColumns.map((column) => (
                                        <option key={column.key} value={column.key}>
                                          {column.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="field-block is-compact">
                                    <span className="sr-only">Value</span>
                                    {field?.input === 'checkbox' ? (
                                      <select
                                        value={row.value}
                                        onChange={(event) =>
                                          handleUpdateFilterRow(row.id, {
                                            value: event.target.value,
                                          })
                                        }
                                        aria-label="Filter value"
                                      >
                                        <option value="">Any</option>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                      </select>
                                    ) : (
                                      <input
                                        type={inputType}
                                        value={row.value}
                                        onChange={(event) =>
                                          handleUpdateFilterRow(row.id, {
                                            value: event.target.value,
                                          })
                                        }
                                        aria-label="Filter value"
                                      />
                                    )}
                                  </label>
                                  <button
                                    className="text-button filter-remove"
                                    type="button"
                                    onClick={() => handleRemoveFilterRow(row.id)}
                                    aria-label="Remove filter"
                                  >
                                    <span className="sr-only">Remove</span>
                                    <span className="icon" aria-hidden="true">
                                      <svg viewBox="0 0 20 20" role="img" aria-hidden="true">
                                        <path
                                          d="M6 6l8 8M14 6l-8 8"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.6"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                    </span>
                                  </button>
                                </div>
                              )
                            })
                          ) : (
                            <p className="filter-empty">No filters added yet.</p>
                          )}
                        </div>

                        <div className="filter-controls">
                          <button className="ghost-button" type="button" onClick={handleAddFilterRow}>
                            Add filter
                          </button>
                          <button className="text-button" type="button" onClick={handleResetFilters}>
                            Reset filters
                          </button>
                        </div>

                        <div className="form-actions">
                          <button className="primary-button" type="button" onClick={handleApplyFilters}>
                            Apply filters
                          </button>
                          <button className="ghost-button" type="button" onClick={handleCloseFilter}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="shipments-view">
                  <div className="panel create-panel">
                    <div className="shipments-header is-detail">
                      <div className="detail-heading">
                        <button
                          className="ghost-button back-button"
                          type="button"
                          onClick={handleOpenShipments}
                          aria-label="Back to list"
                        >
                          <span className="back-caret" aria-hidden="true">
                            {'‹'}
                          </span>
                        </button>
                        <h2 className="detail-title">{formTitle}</h2>
                      </div>
                      <div className="shipments-actions">
                        {editingId && canSeeActivity ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={handleOpenActivity}
                          >
                            Activity log
                          </button>
                        ) : null}
                        {editingId && canEditShipment ? (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={handleHeaderEdit}
                          >
                            Edit
                          </button>
                        ) : null}
                        {editingId && canDeleteShipment ? (
                          <button
                            className="ghost-button danger"
                            type="button"
                            onClick={handleHeaderDelete}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <form ref={formRef} className="create-form" onSubmit={handleCreateSubmit}>
                      <div className="form-accordion">
                        {formSections.map((section) => {
                          const isOpen = openSections.has(section.id)
                          return (
                            <div key={section.id} className="accordion-section">
                              <button
                                className="accordion-header"
                                type="button"
                                onClick={() => toggleSection(section.id)}
                                aria-expanded={isOpen}
                                aria-controls={`section-${section.id}`}
                              >
                                <span>{section.title}</span>
                                <span className="accordion-icon" aria-hidden="true">
                                  {isOpen ? '-' : '+'}
                                </span>
                              </button>
                              {isOpen ? (
                                <div
                                  className="accordion-panel"
                                  id={`section-${section.id}`}
                                >
                                  <div className="form-grid">
                                    {section.fields.map((field) => {
                                      const value = createForm[field.key]
                                      const inputValue =
                                        typeof value === 'string' || typeof value === 'number'
                                          ? String(value)
                                          : ''
                                      if (field.input === 'checkbox') {
                                        return (
                                          <label key={field.key} className="field-check">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(value)}
                                              onChange={(event) =>
                                                handleCreateChange(
                                                  field.key,
                                                  event.target.checked
                                                )
                                              }
                                            />
                                            <span>{field.label}</span>
                                          </label>
                                        )
                                      }

                                      if (field.input === 'textarea') {
                                        return (
                                          <label
                                            key={field.key}
                                            className="field-block field-textarea"
                                          >
                                            <span>{field.label}</span>
                                            <textarea
                                              name={field.key}
                                              rows={3}
                                              value={inputValue}
                                              onChange={(event) =>
                                                handleCreateChange(field.key, event.target.value)
                                              }
                                            />
                                          </label>
                                        )
                                      }

                                      return (
                                        <label key={field.key} className="field-block">
                                          <span>{field.label}</span>
                                          <input
                                            type={
                                              field.input === 'number'
                                                ? 'number'
                                                : field.input === 'date'
                                                  ? 'date'
                                                  : 'text'
                                            }
                                            name={field.key}
                                            value={inputValue}
                                            onChange={(event) =>
                                              handleCreateChange(field.key, event.target.value)
                                            }
                                          />
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>

                      {createError ? (
                        <div className="form-alert" role="alert" aria-live="polite">
                          {createError}
                        </div>
                      ) : null}
                      {createSuccess ? (
                        <div className="form-success" role="status" aria-live="polite">
                          {createSuccess}
                        </div>
                      ) : null}

                      <div className="form-actions">
                        <button className="primary-button" type="submit" disabled={isCreating}>
                          {isCreating
                            ? editingId
                              ? 'Saving...'
                              : 'Creating...'
                            : editingId
                              ? 'Save changes'
                              : 'Save shipment'}
                        </button>
                        <button className="ghost-button" type="button" onClick={handleOpenShipments}>
                          View shipments
                        </button>
                      </div>
                    </form>

                    {isActivityOpen ? (
                      <div className="modal-overlay" role="dialog" aria-modal="true">
                        <div className="modal-panel activity-modal">
                          <div className="modal-header">
                            <div>
                              <p className="eyebrow">Activity log</p>
                              <h2>Shipment history</h2>
                            </div>
                            <button
                              className="text-button"
                              type="button"
                              onClick={handleCloseActivity}
                            >
                              Close
                            </button>
                          </div>

                          <div className="activity-meta">
                            <div>
                              <p className="activity-label">Created</p>
                              <p className="activity-value">
                                {formatUserLabel(activeShipment?.createdBy)} -{' '}
                                {formatDateTime(activeShipment?.createdAt)}
                              </p>
                            </div>
                            <div>
                              <p className="activity-label">Last updated</p>
                              <p className="activity-value">
                                {formatUserLabel(activeShipment?.updatedBy)} -{' '}
                                {formatDateTime(activeShipment?.updatedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="activity-body">
                            {activityEntries.length ? (
                              <ul className="activity-list">
                                {activityEntries.map((entry, index) => (
                                  <li key={`${entry}-${index}`} className="activity-item">
                                    {entry}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="activity-empty">No activity recorded yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            {!isShipmentsRoute ? (
              <aside className="dashboard-side">
                <div className="panel">
                  <div className="panel-header">
                    <h2>Session</h2>
                    <p>Signed in and ready to work.</p>
                  </div>
                  <div className="session-card">
                    <div className="avatar">{initials || 'U'}</div>
                    <div>
                      <p className="session-name">{session.user.displayName}</p>
                      <p className="session-meta">
                        {session.user.role} - {session.user.username}
                      </p>
                    </div>
                  </div>
                  <div className="session-actions">
                    <button className="ghost-button" type="button" onClick={handleOpenShipments}>
                      Air shipments
                    </button>
                    <button className="text-button" type="button" onClick={handleLogout}>
                      Sign out
                    </button>
                  </div>
                </div>
                <div className="panel alerts-panel">
                  <div className="panel-header">
                    <h2>Alerts summary</h2>
                    <p>Priority flags based on this page of shipments.</p>
                  </div>
                  <div className="alerts-list">
                    <div className="alert-item">
                      <span className="alert-label">Holds today</span>
                      <span className="alert-count">{alertsSummary.holdCount}</span>
                    </div>
                    <div className="alert-item">
                      <span className="alert-label">Late / Secured</span>
                      <span className="alert-count">{alertsSummary.lateCount}</span>
                    </div>
                    <div className="alert-item">
                      <span className="alert-label">Missing docs</span>
                      <span className="alert-count">{alertsSummary.missingDocsCount}</span>
                    </div>
                  </div>
                </div>

              </aside>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
