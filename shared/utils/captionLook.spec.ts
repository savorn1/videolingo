import { describe, expect, it } from 'vitest'
import { captionLookFor, captionLookProblem, captionSampleStyle } from './captionLook'

describe('captionLook', () => {
  it('starts from the style chosen', () => {
    expect(captionLookFor('BOX')).toMatchObject({ box: true, color: '#ffffff' })
    expect(captionLookFor('YELLOW')).toMatchObject({ box: false, color: '#ffff00' })
    expect(captionLookFor('CLASSIC').box).toBe(false)
  })
  it('checks the colours and the box opacity', () => {
    expect(captionLookProblem(null)).toBeNull()
    expect(captionLookProblem(captionLookFor('BOX'))).toBeNull()
    expect(captionLookProblem({ ...captionLookFor('BOX'), edgeColor: 'black' })).toMatch(/colours/)
    expect(captionLookProblem({ ...captionLookFor('BOX'), boxOpacity: 1.5 })).toMatch(/opacity/)
  })
  it('draws a sample with a box or an outline', () => {
    expect(captionSampleStyle({ ...captionLookFor('BOX'), boxOpacity: 0.5 }, 14)).toMatchObject({ backgroundColor: '#00000080', fontWeight: '700' })
    expect(captionSampleStyle({ ...captionLookFor('CLASSIC'), bold: false }, 14)).toMatchObject({ fontWeight: '400', fontSize: '14px' })
    expect(captionSampleStyle(captionLookFor('CLASSIC'), 14).textShadow).toContain('#000000')
  })
})
