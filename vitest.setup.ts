import { formatCurrency, formatDate, formatDateTime, formatEnum, humanize } from './shared/utils/format'
import { formatColumnText } from './shared/utils/columnFormat'

Object.assign(globalThis, {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatEnum,
  humanize,
  formatColumnText
})
