import { create } from 'zustand'
import type { AirShipment } from '../types'
import { buildInitialForm } from '../shipments/fields'

type ShipmentsState = {
  shipments: AirShipment[]
  shipmentsTotal: number
  shipmentsLoading: boolean
  shipmentsError: string | null
  searchInput: string
  query: string
  sortField: string
  sortOrder: 'asc' | 'desc'
  page: number
  refreshTick: number
  monthFilter: string
  filters: { id: string; columnKey: string; value: string }[]
  createForm: Record<string, string | boolean>
  editingId: string | null
  editingVersion: number | null
  editingSnapshot: Record<string, string | boolean> | null
  createError: string | null
  createSuccess: string | null
  isCreating: boolean
  selectedIds: Set<string>
  isBulkOpen: boolean
  isActivityOpen: boolean
  isFilterOpen: boolean
  bulkFieldKey: string
  bulkValue: string | boolean
  bulkError: string | null
  bulkSuccess: string | null
  isBulkSaving: boolean
}

type ShipmentsActions = {
  setShipments: (shipments: AirShipment[]) => void
  setShipmentsTotal: (total: number) => void
  setShipmentsLoading: (loading: boolean) => void
  setShipmentsError: (error: string | null) => void
  setSearchInput: (value: string) => void
  setQuery: (value: string) => void
  setSortField: (value: string) => void
  setSortOrder: (value: 'asc' | 'desc') => void
  setPage: (value: number) => void
  bumpRefresh: () => void
  setMonthFilter: (value: string) => void
  setFilters: (value: { id: string; columnKey: string; value: string }[]) => void
  clearFilters: () => void
  setCreateForm: (form: Record<string, string | boolean>) => void
  setEditingId: (value: string | null) => void
  setEditingVersion: (value: number | null) => void
  setEditingSnapshot: (value: Record<string, string | boolean> | null) => void
  setCreateError: (value: string | null) => void
  setCreateSuccess: (value: string | null) => void
  setIsCreating: (value: boolean) => void
  resetCreateForm: () => void
  setSelectedIds: (value: Set<string>) => void
  clearSelectedIds: () => void
  setIsBulkOpen: (value: boolean) => void
  setIsActivityOpen: (value: boolean) => void
  setIsFilterOpen: (value: boolean) => void
  setBulkFieldKey: (value: string) => void
  setBulkValue: (value: string | boolean) => void
  setBulkError: (value: string | null) => void
  setBulkSuccess: (value: string | null) => void
  setIsBulkSaving: (value: boolean) => void
}

export const useShipmentsStore = create<ShipmentsState & ShipmentsActions>((set) => ({
  shipments: [],
  shipmentsTotal: 0,
  shipmentsLoading: false,
  shipmentsError: null,
  searchInput: '',
  query: '',
  sortField: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  refreshTick: 0,
  monthFilter: '',
  filters: [],
  createForm: buildInitialForm(),
  editingId: null,
  editingVersion: null,
  editingSnapshot: null,
  createError: null,
  createSuccess: null,
  isCreating: false,
  selectedIds: new Set(),
  isBulkOpen: false,
  isActivityOpen: false,
  isFilterOpen: false,
  bulkFieldKey: '',
  bulkValue: '',
  bulkError: null,
  bulkSuccess: null,
  isBulkSaving: false,
  setShipments: (shipments) => set({ shipments }),
  setShipmentsTotal: (shipmentsTotal) => set({ shipmentsTotal }),
  setShipmentsLoading: (shipmentsLoading) => set({ shipmentsLoading }),
  setShipmentsError: (shipmentsError) => set({ shipmentsError }),
  setSearchInput: (searchInput) => set({ searchInput }),
  setQuery: (query) => set({ query }),
  setSortField: (sortField) => set({ sortField }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setPage: (page) => set({ page }),
  bumpRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  setMonthFilter: (monthFilter) => set({ monthFilter }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: [] }),
  setCreateForm: (createForm) => set({ createForm }),
  setEditingId: (editingId) => set({ editingId }),
  setEditingVersion: (editingVersion) => set({ editingVersion }),
  setEditingSnapshot: (editingSnapshot) => set({ editingSnapshot }),
  setCreateError: (createError) => set({ createError }),
  setCreateSuccess: (createSuccess) => set({ createSuccess }),
  setIsCreating: (isCreating) => set({ isCreating }),
  resetCreateForm: () =>
    set({
      createForm: buildInitialForm(),
      editingId: null,
      editingVersion: null,
      editingSnapshot: null,
      createError: null,
      createSuccess: null,
    }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  clearSelectedIds: () => set({ selectedIds: new Set() }),
  setIsBulkOpen: (isBulkOpen) => set({ isBulkOpen }),
  setIsActivityOpen: (isActivityOpen) => set({ isActivityOpen }),
  setIsFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
  setBulkFieldKey: (bulkFieldKey) => set({ bulkFieldKey }),
  setBulkValue: (bulkValue) => set({ bulkValue }),
  setBulkError: (bulkError) => set({ bulkError }),
  setBulkSuccess: (bulkSuccess) => set({ bulkSuccess }),
  setIsBulkSaving: (isBulkSaving) => set({ isBulkSaving }),
}))
