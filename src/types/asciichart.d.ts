declare module 'asciichart' {
  interface PlotConfig {
    height?: number
    min?: number
    max?: number
    offset?: number
    padding?: string
    colors?: string[]
    format?: (value: number, index: number) => string
    symbols?: string[]
  }

  function plot(series: number[] | number[][], cfg?: PlotConfig): string

  const black: string
  const red: string
  const green: string
  const yellow: string
  const blue: string
  const magenta: string
  const cyan: string
  const lightgray: string
  const default_: string
  const darkgray: string
  const lightred: string
  const lightgreen: string
  const lightyellow: string
  const lightblue: string
  const lightmagenta: string
  const lightcyan: string
  const white: string
  const reset: string

  export {
    plot,
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    lightgray,
    default_ as default,
    darkgray,
    lightred,
    lightgreen,
    lightyellow,
    lightblue,
    lightmagenta,
    lightcyan,
    white,
    reset,
  }
}
