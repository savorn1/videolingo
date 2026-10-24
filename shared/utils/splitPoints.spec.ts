import { describe, expect, it } from 'vitest'
import {
  cutMarkers,
  cutsAtPauses,
  labelFromSpeech,
  labelRowsAt,
  partsAsList,
  rowsFromList,
  splitRequestSegments,
  rowsFromCutPoints,
  rowsNearLength,
  rowsOverLimit,
  segmentSpeech,
  sentenceBreaks,
  snapCutsToBreaks,
  snapRangeToBreaks,
  splitLongRows,
  tightenToSpeech
} from './splitPoints'
import { splitEvenlyRows } from './videoEdit'

describe('rowsFromCutPoints', () => {
  it('cuts the whole video at the times, in order', () => {
    expect(rowsFromCutPoints(10_000, [6000, 2500])).toEqual({
      rows: [
        { startMsSeconds: 0, endMsSeconds: 2.5 },
        { startMsSeconds: 2.5, endMsSeconds: 6 },
        { startMsSeconds: 6, endMsSeconds: null }
      ],
      skipped: 0,
      tooMany: false
    })
  })

  it('skips times outside the video, repeated, or too close to the cut before or the end', () => {
    const { rows, skipped } = rowsFromCutPoints(10_000, [0, 200, 3000, 3000, 3300, 9800, 12_000])
    expect(rows.map((r) => r.startMsSeconds)).toEqual([0, 3])
    expect(skipped).toBe(6)
  })

  it('gives no rows when nothing usable is left or there would be too many parts', () => {
    expect(rowsFromCutPoints(10_000, [100]).rows).toEqual([])
    const many = rowsFromCutPoints(
      60_000,
      Array.from({ length: 25 }, (_, i) => (i + 1) * 2000)
    )
    expect(many).toMatchObject({ rows: [], tooMany: true })
  })
})

describe('sentenceBreaks', () => {
  it('lists the quiet between sentences, overlapping ones counting as speech', () => {
    const cues = [
      { startMs: 4500, endMs: 6000 },
      { startMs: 0, endMs: 2000 },
      { startMs: 1500, endMs: 4000 },
      { startMs: 6000, endMs: 8000 }
    ]
    expect(sentenceBreaks(cues)).toEqual([
      { fromMs: 4000, toMs: 4500 },
      { fromMs: 6000, toMs: 6000 }
    ])
  })
})

describe('snapCutsToBreaks', () => {
  const breaks = [
    { fromMs: 2000, toMs: 2300 },
    { fromMs: 4000, toMs: 4500 },
    { fromMs: 6000, toMs: 6500 }
  ]

  it('moves a cut in a sentence to the middle of the nearest break', () => {
    const { rows, moved, unmoved } = snapCutsToBreaks(splitEvenlyRows(10_000, 2), breaks, 10_000)
    expect(rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 4.25 },
      { startMsSeconds: 4.25, endMsSeconds: null }
    ])
    expect([moved, unmoved]).toEqual([1, 0])
  })

  it('leaves cuts already in a break, and counts those with no break near enough', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 2.1 },
      { startMsSeconds: 2.1, endMsSeconds: 9 },
      { startMsSeconds: 9, endMsSeconds: null }
    ]
    const out = snapCutsToBreaks(rows, breaks, 10_000, 1000)
    expect(out.rows).toEqual(rows)
    expect([out.moved, out.unmoved]).toEqual([0, 1])
  })

  it('tries the next break when the nearest would leave a part too short', () => {
    const rows = [
      { startMsSeconds: 1.9, endMsSeconds: 3 },
      { startMsSeconds: 3, endMsSeconds: null }
    ]
    // 2.15 s would leave the first part 0.25 s long, so the cut goes to 4.25 s.
    expect(snapCutsToBreaks(rows, breaks, 10_000).rows[0]!.endMsSeconds).toBe(4.25)
  })

  it('ignores gaps between rows that do not touch', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 3 },
      { startMsSeconds: 5, endMsSeconds: null }
    ]
    expect(snapCutsToBreaks(rows, breaks, 10_000)).toEqual({ rows, moved: 0, unmoved: 0 })
  })
})

const BREAKS = [
  { fromMs: 2000, toMs: 2300 },
  { fromMs: 4000, toMs: 4500 },
  { fromMs: 6000, toMs: 6500 }
]

describe('rowsNearLength', () => {
  it('cuts about every target length, at the nearest sentence break', () => {
    expect(rowsNearLength(10_000, 2000, BREAKS).rows.map((r) => r.startMsSeconds)).toEqual([0, 2.15, 4.25, 6.25, 8.25])
    // A break more than a quarter of the target away isn't used: 3 s is cut at the mark.
    expect(rowsNearLength(10_000, 3000, BREAKS).rows.map((r) => r.startMsSeconds)).toEqual([0, 3, 6.25])
  })

  it('cuts at the mark when no break is near, and lets a short last bit join the one before', () => {
    expect(rowsNearLength(10_000, 4500, []).rows.map((r) => r.startMsSeconds)).toEqual([0, 4.5])
  })

  it('refuses a target as long as the video, or one making too many parts', () => {
    expect(rowsNearLength(10_000, 10_000, BREAKS).rows).toEqual([])
    expect(rowsNearLength(60_000, 1000, [])).toEqual({ rows: [], tooMany: true })
  })
})

describe('cutsAtPauses', () => {
  it('cuts in the middle of each pause long enough, keeping only the longest when there are too many', () => {
    expect(
      cutsAtPauses(
        [
          { startMs: 5000, endMs: 7000 },
          { startMs: 1000, endMs: 1500 },
          { startMs: 9000, endMs: 12_000 }
        ],
        1000
      )
    ).toEqual([6000, 10_500])
    const many = Array.from({ length: 30 }, (_, i) => ({ startMs: i * 10_000, endMs: i * 10_000 + 1000 + i }))
    const cuts = cutsAtPauses(many, 1000)
    expect(cuts).toHaveLength(19)
    expect(cuts[0]).toBe(110_506)
  })
})

describe('segmentSpeech', () => {
  const cues = [
    { startMs: 0, endMs: 2000, text: 'Hello and welcome.' },
    { startMs: 2300, endMs: 4000, text: ' Let me find my notes. ' },
    { startMs: 4500, endMs: 6000, text: 'Okay.' }
  ]
  it('joins what is said in the range and shortens it', () => {
    expect(segmentSpeech(cues, 1000, 4200)).toBe('Hello and welcome. Let me find my notes.')
    expect(segmentSpeech(cues, 0, 10_000, 20)).toBe('Hello and welcome.…')
    expect(segmentSpeech(cues, 6000, 9000)).toBe('')
  })
})

describe('rowsOverLimit and splitLongRows', () => {
  const rows = [
    { startMsSeconds: 0, endMsSeconds: 50 },
    { startMsSeconds: 50, endMsSeconds: null }
  ]
  it('finds the rows longer than the limit', () => {
    expect(rowsOverLimit(rows, 60_000, 200_000)).toEqual([1])
  })
  it('cuts each long row into the fewest equal parts that fit', () => {
    expect(splitLongRows(rows, 60_000, 200_000).rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 50 },
      { startMsSeconds: 50, endMsSeconds: 100 },
      { startMsSeconds: 100, endMsSeconds: 150 },
      { startMsSeconds: 150, endMsSeconds: null }
    ])
    expect(splitLongRows(rows, 1000, 200_000)).toEqual({ rows: [], tooMany: true })
  })
})

describe('tightenToSpeech', () => {
  const cues = [
    { startMs: 1000, endMs: 2000 },
    { startMs: 4500, endMs: 6000 }
  ]
  it('pulls the edges in to the speech, keeping some quiet', () => {
    const { rows, changed } = tightenToSpeech(
      [
        { startMsSeconds: 0, endMsSeconds: 3 },
        { startMsSeconds: 3, endMsSeconds: null }
      ],
      cues,
      10_000
    )
    expect(rows).toEqual([
      { startMsSeconds: 0.75, endMsSeconds: 2.25 },
      { startMsSeconds: 4.25, endMsSeconds: 6.25 }
    ])
    expect(changed).toBe(2)
  })
  it('leaves a part with no speech, or one that would get too short', () => {
    const rows = [
      { startMsSeconds: 7, endMsSeconds: 9 },
      { startMsSeconds: 1.9, endMsSeconds: 2.2 }
    ]
    expect(tightenToSpeech(rows, cues, 10_000)).toEqual({ rows, changed: 0 })
  })
})

describe('cutMarkers', () => {
  it('marks where parts start, and where one ends before a gap, skipping marked times', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 3 },
      { startMsSeconds: 3, endMsSeconds: 5 },
      { startMsSeconds: 6, endMsSeconds: null }
    ]
    expect(cutMarkers(rows, [{ atMs: 6050 }], 10_000)).toEqual([
      { atMs: 3000, label: 'Part 2' },
      { atMs: 5000, label: 'Part 2 ends' }
    ])
  })
})

describe('snapRangeToBreaks', () => {
  it('moves edges inside a sentence to the nearest break', () => {
    expect(snapRangeToBreaks([1500, 5000], BREAKS, 10_000)).toEqual({ range: [2150, 4250], moved: 2 })
  })
  it('leaves edges at the ends or in a break, and keeps the range long enough', () => {
    expect(snapRangeToBreaks([0, 10_000], BREAKS, 10_000)).toEqual({ range: [0, 10_000], moved: 0 })
    expect(snapRangeToBreaks([4100, 5000], BREAKS, 10_000, 600)).toEqual({ range: [4100, 5000], moved: 0 })
    // 4.25 s would leave 0.15 s, so the end goes on to 6.25 s.
    expect(snapRangeToBreaks([4100, 5000], BREAKS, 10_000)).toEqual({ range: [4100, 6250], moved: 1 })
  })
})

describe('labelRowsAt', () => {
  it('names each row after the mark it starts at', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 5 },
      { startMsSeconds: 5, endMsSeconds: null }
    ]
    expect(
      labelRowsAt(rows, [
        { atMs: 0, label: ' Greetings ' },
        { atMs: 7000, label: 'Later' }
      ])
    ).toEqual([{ startMsSeconds: 0, endMsSeconds: 5, label: 'Greetings' }, rows[1]])
  })
})

describe('splitRequestSegments', () => {
  it('sends a name and shape only when set', () => {
    expect(
      splitRequestSegments([
        { startMsSeconds: 0, endMsSeconds: 2.5, label: ' Intro ', aspect: 9 / 16 },
        { startMsSeconds: 2.5, endMsSeconds: null, label: '  ', aspect: null }
      ])
    ).toEqual([
      { startMs: 0, endMs: 2500, label: 'Intro', aspect: 9 / 16 },
      { startMs: 2500, endMs: null }
    ])
  })
})

describe('names and shapes survive the helpers', () => {
  it('splitting a long row keeps the shape on every piece and the name on the first', () => {
    const { rows } = splitLongRows([{ startMsSeconds: 0, endMsSeconds: null, label: 'Talk', aspect: 1 }], 60_000, 120_000)
    expect(rows.map((r) => [r.label, r.aspect])).toEqual([
      ['Talk', 1],
      [undefined, 1]
    ])
  })
})

describe('a pasted list, the parts as a list, and names from the speech', () => {
  it('cuts at a pasted list and names each part after its line', () => {
    const { rows, found, lines, skipped, tooMany } = rowsFromList('Chapters\n0:00 Welcome\n0:20 Greetings\n0:20.2 Too close\n1:10 Numbers', 90_000)
    expect(rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 20, label: 'Welcome' },
      { startMsSeconds: 20, endMsSeconds: 70, label: 'Greetings' },
      { startMsSeconds: 70, endMsSeconds: null, label: 'Numbers' }
    ])
    expect({ found, lines, skipped, tooMany }).toEqual({ found: 4, lines: 1, skipped: 1, tooMany: false })
    // Without 0:00 the first part keeps no name; a list past the end gives nothing to split.
    expect(rowsFromList('0:30 Middle', 60_000).rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 30 },
      { startMsSeconds: 30, endMsSeconds: null, label: 'Middle' }
    ])
    expect(rowsFromList('2:00 Later', 60_000).rows).toEqual([])
  })
  it('writes the parts as a list in row order, with hours for a long video', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 75.5, label: ' Welcome ' },
      { startMsSeconds: 75.5, endMsSeconds: null }
    ]
    expect(partsAsList(rows, 120_000)).toBe('0:00 Welcome\n1:15 Part 2')
    expect(partsAsList(rows, 4_000_000)).toBe('0:00:00 Welcome\n0:01:15 Part 2')
  })
  it('names a part from the first words it says', () => {
    expect(labelFromSpeech('so today we will learn the numbers from one to ten')).toBe('So today we will learn the')
    expect(labelFromSpeech('Hello! Welcome back to the class.')).toBe('Hello')
    expect(labelFromSpeech('Count with me, one, two…')).toBe('Count with me, one, two')
    expect(labelFromSpeech('   ')).toBe('')
  })
})
