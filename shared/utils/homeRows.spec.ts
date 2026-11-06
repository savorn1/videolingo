import { describe, expect, it } from 'vitest'
import { describeHomeRow, homeRowProblem, homeRowValue, type HomeRowForm } from './homeRows'

const form = (f: Partial<HomeRowForm> = {}): HomeRowForm => ({
  title: 'អាប់ដេតថ្មី',
  source: 'LATEST',
  category: 'CULTIVATION',
  genre: '',
  maxItems: 12,
  active: true,
  ...f
})

describe('homeRowProblem', () => {
  it('passes a complete row', () => {
    expect(homeRowProblem(form())).toBeNull()
    expect(homeRowProblem(form({ source: 'GENRE', genre: 'យុទ្ធភពបុរាណ' }))).toBeNull()
  })
  it('needs a heading of up to 80 characters', () => {
    expect(homeRowProblem(form({ title: '  ' }))).toMatch(/heading/)
    expect(homeRowProblem(form({ title: 'x'.repeat(81) }))).toMatch(/80/)
  })
  it('needs a genre for a genre row', () => {
    expect(homeRowProblem(form({ source: 'GENRE', genre: ' ' }))).toMatch(/genre/)
  })
  it('shows 4 to 30 series', () => {
    expect(homeRowProblem(form({ maxItems: 3 }))).toMatch(/4 to 30/)
    expect(homeRowProblem(form({ maxItems: 31 }))).toMatch(/4 to 30/)
  })
})

describe('homeRowValue', () => {
  it('sends the category, the genre or nothing', () => {
    expect(homeRowValue(form({ source: 'CATEGORY', category: 'ROMANCE', genre: 'x' }))).toBe('ROMANCE')
    expect(homeRowValue(form({ source: 'GENRE', genre: ' យុទ្ធភព ' }))).toBe('យុទ្ធភព')
    expect(homeRowValue(form({ source: 'POPULAR', genre: 'x' }))).toBeNull()
  })
})

describe('describeHomeRow', () => {
  it('says what the row shows', () => {
    expect(describeHomeRow({ source: 'CATEGORY', value: 'ROMANCE', maxItems: 30 })).toBe('Romance · up to 30')
    expect(describeHomeRow({ source: 'LATEST', value: null, maxItems: 12 })).toBe('Newest updates · up to 12')
    expect(describeHomeRow({ source: 'GENRE', value: 'យុទ្ធភព', maxItems: 8 })).toBe('Genre “យុទ្ធភព” · up to 8')
  })
})
