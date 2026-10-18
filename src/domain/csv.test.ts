import { describe, expect, it } from 'vitest'
import { headerIndex, parseCsv, withBom, writeCsv } from './csv'

describe('parseCsv', () => {
  it('reads plain rows of fields', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('drops a leading BOM', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('splits rows on CRLF, LF and CR alike', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
    expect(parseCsv('a,b\r1,2\r3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('keeps commas, line breaks and a doubled quote inside a quoted field', () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
      ['say "hi"', 'z'],
    ])
  })

  it('adds no row for a trailing empty line', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('answers no rows for empty text', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('keeps empty fields', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']])
  })

  it('uses ; as the delimiter when the header has more ; than ,', () => {
    expect(parseCsv('Date;Workout Name;Weight\n2026-03-02;Push, heavy;82,5')).toEqual([
      ['Date', 'Workout Name', 'Weight'],
      ['2026-03-02', 'Push, heavy', '82,5'],
    ])
  })

  it('does not count ; inside quotes when sniffing the delimiter', () => {
    expect(parseCsv('a,"b;c;d",e\n1,2,3')).toEqual([['a', 'b;c;d', 'e'], ['1', '2', '3']])
  })

  it('sniffs ; after a BOM', () => {
    expect(parseCsv('﻿a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('writeCsv', () => {
  it('ends every row in CRLF', () => {
    expect(writeCsv([['a', 'b'], ['1', '2']])).toBe('a,b\r\n1,2\r\n')
  })

  it('quotes fields holding a comma, a quote, CR or LF, doubling quotes', () => {
    expect(writeCsv([['x, y', 'say "hi"', 'a\nb', 'c\rd', 'plain']])).toBe(
      '"x, y","say ""hi""","a\nb","c\rd",plain\r\n',
    )
  })

  it('round-trips through parseCsv, Hebrew text included', () => {
    const rows = [
      ['שם', 'הערה', 'n'],
      ['סקוואט, כבד', 'אמר "וואו"\nשורה שנייה', ''],
      ['', '', ''],
    ]
    expect(parseCsv(writeCsv(rows))).toEqual(rows)
  })
})

describe('withBom', () => {
  it('prefixes the BOM once', () => {
    expect(withBom('a,b')).toBe('﻿a,b')
  })

  it('does not double a BOM already there', () => {
    expect(withBom(withBom('a,b'))).toBe('﻿a,b')
  })

  it('is read back by parseCsv without the BOM', () => {
    expect(parseCsv(withBom(writeCsv([['a'], ['1']])))).toEqual([['a'], ['1']])
  })
})

describe('headerIndex', () => {
  it('matches case-insensitively and ignoring surrounding spaces, in any order', () => {
    const idx = headerIndex([' REPS ', 'Date', ' weight'], ['Date', 'Weight', 'Reps'])
    expect(idx.Date).toBe(1)
    expect(idx.Weight).toBe(2)
    expect(idx.Reps).toBe(0)
  })

  it('throws naming a missing required column', () => {
    expect(() => headerIndex(['Date', 'Reps'], ['Date', 'Weight'])).toThrow(/Weight/)
  })

  it('leaves a missing optional column out without throwing', () => {
    const idx = headerIndex(['Date', 'RPE'], ['Date'], ['RPE', 'Notes'])
    expect(idx.RPE).toBe(1)
    expect(idx.Notes).toBeUndefined()
    expect('Notes' in idx).toBe(false)
  })
})
