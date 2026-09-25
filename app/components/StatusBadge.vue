<template>
  <UBadge :color="meta.color" variant="subtle" class="gap-1">
    <UIcon :name="meta.icon" class="w-3 h-3" :class="{ 'animate-spin': status === 'RUNNING' }" />
    {{ label }}
  </UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

type StatusColor = 'success' | 'error' | 'neutral' | 'warning' | 'info' | 'secondary' | 'cancelled'

// Generic status set — extend as new statuses show up (e.g. lease/booking
// states like ACTIVE, VACANT, OCCUPIED, MAINTENANCE).
const STATUS_META: Record<string, { color: StatusColor; icon: string }> = {
  PENDING: { color: 'warning', icon: 'i-lucide-clock' },
  // RMA/StockTransfer initial state — same "awaiting action" meaning as
  // PENDING, just a different verb. Without this it fell through to the
  // neutral/help-circle default, which reads as "unknown status" rather
  // than "awaiting approval."
  REQUESTED: { color: 'warning', icon: 'i-lucide-clock' },
  PROCESSING: { color: 'info', icon: 'i-lucide-loader-circle' },
  // Processing job lifecycle (useProcessingJobs' JobStatus) — FAILED and
  // CANCELLED are shared with the entries below.
  QUEUED: { color: 'neutral', icon: 'i-lucide-hourglass' },
  RUNNING: { color: 'info', icon: 'i-lucide-loader-circle' },
  SUCCEEDED: { color: 'success', icon: 'i-lucide-check-circle' },
  SUCCESS: { color: 'success', icon: 'i-lucide-check-circle' },
  COMPLETED: { color: 'success', icon: 'i-lucide-check-circle' },
  // RMA's terminal successful outcome (useRmaRequests' RmaStatus) — was
  // falling through to the neutral/help-circle default, making a resolved
  // RMA look no different from a broken/unrecognized status.
  RESOLVED: { color: 'success', icon: 'i-lucide-check-circle' },
  PAID: { color: 'success', icon: 'i-lucide-badge-check' },
  APPROVED: { color: 'success', icon: 'i-lucide-check-circle' },
  ACTIVE: { color: 'success', icon: 'i-lucide-check-circle' },
  FAILED: { color: 'error', icon: 'i-lucide-x-circle' },
  REJECTED: { color: 'error', icon: 'i-lucide-x-circle' },
  EXPIRED: { color: 'error', icon: 'i-lucide-triangle-alert' },
  // Distinct from CANCELLED/VOIDED below — "reversed" is a different outcome
  // than "never settled," and looked identical (both neutral gray) before.
  REFUNDED: { color: 'secondary', icon: 'i-lucide-undo-2' },
  REVERSED: { color: 'secondary', icon: 'i-lucide-undo-2' },
  CANCELLED: { color: 'cancelled', icon: 'i-lucide-ban' },
  VOIDED: { color: 'cancelled', icon: 'i-lucide-ban' },
  DRAFT: { color: 'neutral', icon: 'i-lucide-pencil' },
  // Subtitle review workflow (useSubtitles' ReviewStatus) — DRAFT/APPROVED
  // already covered above.
  IN_REVIEW: { color: 'info', icon: 'i-lucide-eye' },
  CHANGES_REQUESTED: { color: 'warning', icon: 'i-lucide-message-square-warning' },
  UP: { color: 'success', icon: 'i-lucide-check-circle' },
  DOWN: { color: 'error', icon: 'i-lucide-x-circle' },
  DISABLED: { color: 'neutral', icon: 'i-lucide-power-off' },
  // Shared order-approval workflow (PurchaseOrder/SalesOrder/PurchaseRequest
  // Status) — SUBMITTED is "awaiting internal approval," same bucket as
  // PENDING/REQUESTED but with its own icon since something was actually
  // filed, not just created.
  SUBMITTED: { color: 'warning', icon: 'i-lucide-file-check' },
  // Sent to an external party (supplier/customer) and now out of our hands —
  // Rfq/PurchaseOrder/Quotation Status. Distinct bucket from SUBMITTED:
  // 'info' (active/in-flight) rather than 'warning' (needs our attention).
  SENT: { color: 'info', icon: 'i-lucide-send' },
  // SalesOrder confirmed and ready to fulfill — same "gate passed" meaning
  // as APPROVED above, just this domain's verb for it.
  CONFIRMED: { color: 'success', icon: 'i-lucide-check-circle' },
  // Quotation's positive terminal outcome — REJECTED already covered above.
  ACCEPTED: { color: 'success', icon: 'i-lucide-check-circle' },
  // Delivery workflow (useDeliveries' DeliveryStatus) — icons match this
  // status's own action button on the deliveries page (Pick/Pack/Ship) so
  // the badge and the button that produced it read as the same verb.
  PICKED: { color: 'info', icon: 'i-lucide-package-search' },
  PACKED: { color: 'info', icon: 'i-lucide-box' },
  // Shared by DeliveryStatus and StockTransferStatus — goods in transit.
  SHIPPED: { color: 'info', icon: 'i-lucide-truck' },
  // Terminal success for SalesOrder/Delivery — matches the "Confirm
  // delivery" button's icon on the deliveries page.
  DELIVERED: { color: 'success', icon: 'i-lucide-check-check' },
  // Terminal success for PurchaseOrder/StockTransfer — goods received.
  RECEIVED: { color: 'success', icon: 'i-lucide-package-check' },
  // "Partially" states reuse PARTIALLY_PAID's icon below for a consistent
  // "in-between" visual across every partial-fulfillment status in the app.
  PARTIALLY_RECEIVED: { color: 'info', icon: 'i-lucide-circle-dot' },
  PARTIALLY_DELIVERED: { color: 'info', icon: 'i-lucide-circle-dot' },
  // Unit occupancy status (useUnits' OccupancyStatus). AVAILABLE is shared
  // with ParkingSpotStatus.
  AVAILABLE: { color: 'success', icon: 'i-lucide-check-circle' },
  VACANT: { color: 'success', icon: 'i-lucide-check-circle' },
  OCCUPIED: { color: 'info', icon: 'i-lucide-door-closed' },
  RESERVED: { color: 'warning', icon: 'i-lucide-bookmark' },
  UNAVAILABLE: { color: 'cancelled', icon: 'i-lucide-ban' },
  MAINTENANCE: { color: 'warning', icon: 'i-lucide-wrench' },
  // Unit sale status (useUnits' SaleStatus) — RESERVED/SOLD already covered.
  NOT_FOR_SALE: { color: 'neutral', icon: 'i-lucide-circle-slash' },
  FOR_SALE: { color: 'success', icon: 'i-lucide-tag' },
  SOLD: { color: 'secondary', icon: 'i-lucide-tag' },
  // Tenant status (useTenants' TenantStatus) — ACTIVE already covered above.
  INACTIVE: { color: 'neutral', icon: 'i-lucide-power-off' },
  BLACKLISTED: { color: 'error', icon: 'i-lucide-ban' },
  // Lease status (useLeases' LeaseStatus) — ACTIVE already covered above.
  PENDING_APPROVAL: { color: 'warning', icon: 'i-lucide-clock' },
  TERMINATED: { color: 'cancelled', icon: 'i-lucide-ban' },
  // Financial period status (useFinancialPeriods' FinancialPeriodStatus).
  OPEN: { color: 'success', icon: 'i-lucide-lock-open' },
  CLOSED: { color: 'neutral', icon: 'i-lucide-lock' },
  // Journal entry status (useJournalEntries' JournalEntryStatus) — DRAFT
  // already covered above. Distinct key from VOIDED: this backend's enum
  // literal is VOID, not VOIDED.
  POSTED: { color: 'success', icon: 'i-lucide-check-circle' },
  VOID: { color: 'cancelled', icon: 'i-lucide-ban' },
  // Invoice status (useInvoices' InvoiceStatus) — PAID/CANCELLED already
  // covered above; distinct from PENDING so a partially-settled invoice
  // doesn't look identical to a fully outstanding one.
  PARTIALLY_PAID: { color: 'info', icon: 'i-lucide-circle-dot' },
  // Zero payment received yet — same "awaiting settlement" meaning as
  // PENDING, its own key since InvoicePaymentStatus doesn't reuse PENDING.
  UNPAID: { color: 'warning', icon: 'i-lucide-clock' },
  // Maintenance status (useMaintenance' MaintenanceStatus) — OPEN/COMPLETED/
  // CANCELLED already covered above.
  ASSIGNED: { color: 'info', icon: 'i-lucide-user-check' },
  IN_PROGRESS: { color: 'warning', icon: 'i-lucide-loader-circle' },
  // Lead status (useLeads' LeadStatus) — the whole pipeline from a fresh
  // contact through to a closed deal (formerly split across a separate Lead
  // and Opportunity; merged into one flow this session). QUALIFIED was
  // 'success' green before the merge — reassigned to 'info' once WON needed
  // that slot for real, so the actual best outcome isn't out-shone by an
  // early-funnel stage. Colors intentionally never repeat across the 7
  // stages, so status alone is enough to place a lead in the funnel at a
  // glance. LOST/CONTACTED/CONVERTED are shared with other domains (see
  // their own notes below/elsewhere) — deliberately left untouched.
  NEW: { color: 'neutral', icon: 'i-lucide-sparkle' },
  CONTACTED: { color: 'warning', icon: 'i-lucide-phone' },
  QUALIFIED: { color: 'info', icon: 'i-lucide-circle-check' },
  NEEDS_ANALYSIS: { color: 'secondary', icon: 'i-lucide-search' },
  QUOTATION: { color: 'warning', icon: 'i-lucide-file-text' },
  // 'error' here signals "hottest, highest-stakes stage" (most CRM UIs
  // highlight late-stage deals for urgency), not a bad outcome — LOST
  // already owns the actual negative-outcome color below.
  NEGOTIATION: { color: 'error', icon: 'i-lucide-handshake' },
  WON: { color: 'success', icon: 'i-lucide-trophy' },
  LOST: { color: 'cancelled', icon: 'i-lucide-ban' },
  CONVERTED: { color: 'secondary', icon: 'i-lucide-arrow-right-circle' },
  // Sale listing status (useSaleListings' SaleListingStatus) — ACTIVE/SOLD
  // already covered above (ACTIVE/SOLD).
  WITHDRAWN: { color: 'neutral', icon: 'i-lucide-archive' },
  // Synthetic label used by UnitOwner's `current` boolean (units page ownership
  // history), not a backend enum value.
  CURRENT: { color: 'success', icon: 'i-lucide-badge-check' },
  // Move-in/move-out InspectionCondition.
  EXCELLENT: { color: 'success', icon: 'i-lucide-sparkles' },
  GOOD: { color: 'success', icon: 'i-lucide-thumbs-up' },
  FAIR: { color: 'warning', icon: 'i-lucide-alert-triangle' },
  POOR: { color: 'error', icon: 'i-lucide-thumbs-down' },
  // Deposit settlement status (useMoveOut' SettlementStatus) — PENDING already
  // covered above.
  SETTLED: { color: 'success', icon: 'i-lucide-badge-check' },
  // Building status (useBuildings' BuildingStatus) — ACTIVE/INACTIVE already
  // covered above.
  UNDER_CONSTRUCTION: { color: 'warning', icon: 'i-lucide-hard-hat' },
  RENOVATION: { color: 'warning', icon: 'i-lucide-hammer' },
  // Plot availability/reservation/sale status (usePlots) — AVAILABLE/
  // NOT_FOR_SALE/RESERVED/EXPIRED/CANCELLED already covered above.
  HOLD: { color: 'warning', icon: 'i-lucide-pause-circle' },
  BLOCKED: { color: 'error', icon: 'i-lucide-lock' },
  NONE: { color: 'neutral', icon: 'i-lucide-circle-dashed' },
  NOT_SOLD: { color: 'neutral', icon: 'i-lucide-circle-dashed' },
  CONTRACTED: { color: 'info', icon: 'i-lucide-file-signature' },
  FULLY_PAID: { color: 'success', icon: 'i-lucide-badge-check' },
  TRANSFERRED: { color: 'secondary', icon: 'i-lucide-file-check' },
  // Plot lifecycle *stage* (usePlots' PLOT_STAGES — the named combination of
  // availability+reservation+sale status, not a raw field value). AVAILABLE/
  // HOLD/RESERVED/FULLY_PAID/TRANSFERRED reuse a raw field's own value as
  // their stage key and are already covered above; only UNDER_CONTRACT has
  // no single-field equivalent and needs its own entry.
  UNDER_CONTRACT: { color: 'info', icon: 'i-lucide-file-signature' },
  // Product status (useProducts' ProductStatus) — ACTIVE/INACTIVE already
  // covered above; DISCONTINUED is permanent, unlike the reversible INACTIVE.
  DISCONTINUED: { color: 'cancelled', icon: 'i-lucide-ban' },
  // RfqSupplier status (useRfqs' RfqSupplierStatus) — PENDING already covered
  // above.
  QUOTED: { color: 'info', icon: 'i-lucide-file-check' },
  // GoodsReceipt status (useGoodsReceipts' GoodsReceiptStatus) — COMPLETED
  // already covered above.
  // Shared by GoodsReceipt status and SerialNumber status (a unit reserved by
  // a receipt line whose quality check hasn't been recorded) — same meaning in
  // both, so one entry covers them.
  PENDING_QC: { color: 'warning', icon: 'i-lucide-clock' },
  // GoodsReceiptLine quality check outcome (useGoodsReceipts'
  // QualityCheckStatus) — PENDING/FAILED already covered above.
  PASSED: { color: 'success', icon: 'i-lucide-check-circle' },
  // SerialNumber status (useSerialNumbers' SerialNumberStatus) — one row per
  // individually-tracked unit. PENDING_QC is covered just above; without these
  // five the serial-numbers page rendered nearly every row with the neutral
  // help-circle default, i.e. as an unrecognised status.
  IN_STOCK: { color: 'success', icon: 'i-lucide-package-check' },
  // In flight on a stock transfer — not sellable until received, so 'info'
  // rather than 'success'.
  IN_TRANSIT: { color: 'info', icon: 'i-lucide-truck' },
  // Terminal — shipped out on a delivery. Neutral rather than success: the
  // unit leaving is the normal outcome, not an achievement to highlight.
  ISSUED: { color: 'neutral', icon: 'i-lucide-package-open' },
  // Terminal — written off by an approved adjustment (damaged/lost/expired).
  ADJUSTED_OUT: { color: 'cancelled', icon: 'i-lucide-package-minus' },
  // Terminal — failed quality check on arrival, never entered stock. 'error'
  // rather than 'cancelled' since this is a rejection, not a withdrawal.
  QC_REJECTED: { color: 'error', icon: 'i-lucide-package-x' },
  // ManufacturingOrder materials reserved, queued to start — 'info' rather
  // than 'success' since production hasn't actually begun yet.
  RELEASED: { color: 'info', icon: 'i-lucide-rocket' },
  // StockCount's terminal state once its variance has been turned into an
  // (unapproved) adjustment — reuses ADJUSTMENT's icon below for the same
  // "reconcile/balance" meaning.
  RECONCILED: { color: 'success', icon: 'i-lucide-scale' },
  // Machine's normal healthy state (useMachines' MachineStatus) —
  // DOWN/MAINTENANCE already covered above (error/warning respectively).
  OPERATIONAL: { color: 'success', icon: 'i-lucide-check-circle' },
  // Account nature (useAccounts' AccountType) — the five fundamental
  // accounting classifications, each given a distinct color so a chart of
  // accounts reads at a glance.
  ASSET: { color: 'info', icon: 'i-lucide-landmark' },
  LIABILITY: { color: 'warning', icon: 'i-lucide-scale' },
  EQUITY: { color: 'secondary', icon: 'i-lucide-pie-chart' },
  REVENUE: { color: 'success', icon: 'i-lucide-trending-up' },
  EXPENSE: { color: 'error', icon: 'i-lucide-trending-down' },
  // BankAccount type (useBankAccounts' BankAccountType).
  CASH: { color: 'success', icon: 'i-lucide-banknote' },
  BANK: { color: 'info', icon: 'i-lucide-landmark' },
  // TaxRate type (useTaxRates' TaxType) — OTHER falls back to DEFAULT_META.
  VAT: { color: 'info', icon: 'i-lucide-percent' },
  WITHHOLDING: { color: 'warning', icon: 'i-lucide-percent' },
  // StockMovement type (useStockMovements' StockMovementType).
  RECEIPT: { color: 'success', icon: 'i-lucide-arrow-down-to-line' },
  ISSUE: { color: 'error', icon: 'i-lucide-arrow-up-from-line' },
  TRANSFER_OUT: { color: 'warning', icon: 'i-lucide-arrow-right' },
  TRANSFER_IN: { color: 'info', icon: 'i-lucide-arrow-left' },
  ADJUSTMENT: { color: 'secondary', icon: 'i-lucide-scale' },
  // Manufacturing-driven movements — same in/out direction as RECEIPT/ISSUE
  // above, with their own icon so they don't read as identical to a plain
  // purchase receipt or manual issue.
  MATERIAL_CONSUMPTION: { color: 'error', icon: 'i-lucide-cog' },
  PRODUCTION_OUTPUT: { color: 'success', icon: 'i-lucide-package-plus' },
  // Payment direction (usePayments'/useSupplierPayments'/usePaymentReports'
  // *Type) — PAYMENT is money in, REFUND is money out, mirroring how this
  // app already colors amounts by sign elsewhere (positive = success,
  // negative = error) on the payments pages themselves. REFUND here reuses
  // REFUNDED's icon above — same "money going back" meaning.
  PAYMENT: { color: 'success', icon: 'i-lucide-banknote' },
  REFUND: { color: 'error', icon: 'i-lucide-undo-2' }
}

const DEFAULT_META: { color: StatusColor; icon: string } = {
  color: 'neutral',
  icon: 'i-lucide-help-circle'
}

const meta = computed(() => STATUS_META[props.status] ?? DEFAULT_META)
const label = computed(() => formatEnum(props.status))
</script>
