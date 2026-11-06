import { describe, expect, it } from 'vitest'
import {
  biggestDropOff,
  coinGrantProblems,
  coinProblems,
  continuePercents,
  finishPercent,
  likePercent,
  orderProduct,
  playerTime,
  priceProblems,
  retentionLabel,
  ruengflixUrl
} from './ruengflix'

describe('viewer arithmetic', () => {
  it('finishPercent and likePercent are whole percents, null without data', () => {
    expect(finishPercent(0, 0)).toBeNull()
    expect(finishPercent(3, 2)).toBe(67)
    expect(finishPercent(2, 5)).toBe(100)
    expect(likePercent(0, 0)).toBeNull()
    expect(likePercent(3, 1)).toBe(75)
  })

  it('continuePercents compares each finish with the next start', () => {
    const eps = [
      { starts: 100, completes: 80 },
      { starts: 60, completes: 50 },
      { starts: 45, completes: 0 },
      { starts: 10, completes: 5 }
    ]
    expect(continuePercents(eps)).toEqual([75, 90, null])
    expect(biggestDropOff(eps)).toBe(1)
    expect(biggestDropOff([{ starts: 1, completes: 1 }])).toBeNull()
  })
})

describe('ruengflixUrl', () => {
  it('builds series and episode links, or null without an address', () => {
    expect(ruengflixUrl('https://ruengflix.example/', 7)).toBe('https://ruengflix.example/detail/7')
    expect(ruengflixUrl('https://ruengflix.example', 7, 3)).toBe('https://ruengflix.example/watch/7/3')
    expect(ruengflixUrl('  ', 7)).toBeNull()
  })
})

describe('playerTime', () => {
  it('formats like a player clock', () => {
    expect(playerTime(65)).toBe('1:05')
    expect(playerTime(3665)).toBe('1:01:05')
  })
})

describe('priceProblems', () => {
  const ok = { seriesUnlockPrice: 0.49, vip1Month: 1.99, vip3Months: 4.99, vip6Months: 8.99, vip12Months: 14.99 }

  it('accepts the defaults', () => {
    expect(priceProblems(ok)).toEqual([])
  })

  it('needs every price, in range, with two decimals', () => {
    expect(priceProblems({ ...ok, seriesUnlockPrice: null, vip1Month: -1, vip3Months: 4.999 })).toEqual([
      'Unlock one series: enter a price.',
      'VIP · 1 month: must be from $0 to $1,000.',
      'VIP · 3 months: use at most two decimals.'
    ])
  })

  it('flags a yearly plan dearer per month than the monthly one', () => {
    expect(priceProblems({ ...ok, vip12Months: 30 })).toEqual(['The 12-month plan costs more per month than the 1-month plan.'])
  })
})

describe('coinProblems', () => {
  const empty = {
    coinPack100: null,
    coinPack300: null,
    coinPack1000: null,
    episodeUnlockCoins: null,
    dailyCheckInCoins: null,
    firstTopUpBonusPercent: null,
    previewSeconds: null,
    adUnlocksPerDay: null
  }
  it('allows leaving everything to the defaults', () => {
    expect(coinProblems(empty)).toEqual([])
  })
  it('lets the bonus and preview be turned off with 0, within their limits', () => {
    expect(coinProblems({ ...empty, firstTopUpBonusPercent: 0, previewSeconds: 0 })).toEqual([])
    expect(coinProblems({ ...empty, firstTopUpBonusPercent: 250, previewSeconds: -1 })).toEqual([
      'First top-up bonus: a whole number from 0 to 200.',
      'Free preview: a whole number from 0 to 180.'
    ])
  })
  it('ad unlocks a day: 0 turns them off, up to 20', () => {
    expect(coinProblems({ ...empty, adUnlocksPerDay: 0 })).toEqual([])
    expect(coinProblems({ ...empty, adUnlocksPerDay: 21 })).toEqual(['Ad unlocks a day: a whole number from 0 to 20.'])
  })
  it('refuses free packs and fractional coins', () => {
    expect(coinProblems({ ...empty, coinPack100: 0, episodeUnlockCoins: 2.5 })).toEqual([
      '100 coins: must be from $0.01 to $1,000.',
      'Unlock one VIP episode: a whole number from 1 to 10,000.'
    ])
  })
})

describe('orderProduct gifts and promos', () => {
  it('labels gifts and promotion coins', () => {
    expect(orderProduct({ kind: 'COINS', coins: 300, months: null, seriesTitle: null, promoCoins: 90, gift: true })).toBe('Gift: 300 coins +90 promo')
    expect(orderProduct({ kind: 'VIP', coins: null, months: 1, seriesTitle: null })).toBe('VIP · 1 month')
  })
})

describe('orderProduct and retentionLabel', () => {
  it('names what was bought', () => {
    expect(orderProduct({ kind: 'COINS', coins: 1000, months: null, seriesTitle: null })).toBe('1,000 coins')
    expect(orderProduct({ kind: 'COINS', coins: 300, months: null, seriesTitle: null, bonusCoins: 150 })).toBe('300 coins +150 bonus')
    expect(orderProduct({ kind: 'VIP', coins: null, months: 1, seriesTitle: null })).toBe('VIP · 1 month')
    expect(orderProduct({ kind: 'SERIES', coins: null, months: null, seriesTitle: 'Summer love' })).toBe('Series: Summer love')
  })
  it('shows a dash before there is a cohort', () => {
    expect(retentionLabel(null)).toBe('—')
    expect(retentionLabel(0.256)).toBe('26%')
  })
})

describe('coinGrantProblems', () => {
  it('needs a non-zero whole amount within limits and a reason', () => {
    expect(coinGrantProblems(50, 'Paid but not delivered')).toEqual([])
    expect(coinGrantProblems(-20, 'Duplicate')).toEqual([])
    expect(coinGrantProblems(0, 'x')).toEqual(['Coins: a whole number from -10,000 to 10,000, not 0.', 'Reason: 3 to 200 characters.'])
    expect(coinGrantProblems(20000, 'Too many')).toHaveLength(1)
    expect(coinGrantProblems(null, 'ok reason')).toHaveLength(1)
  })
})
