import { describe, expect, it } from 'vitest'
import { customVariables, templateVariables } from './notifications'

describe('templateVariables', () => {
  it('lists variables once, in order, across texts', () => {
    expect(templateVariables('Hi {{ username }}', 'New: {{course}} on {{date}} — {{course}}')).toEqual(['username', 'course', 'date'])
  })

  it('ignores malformed placeholders', () => {
    expect(templateVariables('{{ 1abc }} {{}} {single} {{ok_1}}')).toEqual(['ok_1'])
    expect(templateVariables(null, undefined)).toEqual([])
  })
})

describe('customVariables', () => {
  it('excludes the built-ins', () => {
    expect(customVariables('Hi {{username}}, {{course}} is live at {{appUrl}}')).toEqual(['course'])
  })
})
