import { hrtime } from 'node:process'

const NS_PER_SEC = 1e9

function formatDiff (time: ReturnType<typeof hrtime>): number {
  return Math.trunc((time[0] * NS_PER_SEC + time[1]) / 1e6)
}

export const measure = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t1 = hrtime()
  const result = await fn()
  const diff = hrtime(t1)
  return [result, formatDiff(diff)]
}

export function measureStart (): () => number {
  let prev = hrtime()

  return () => {
    prev = hrtime(prev)
    return formatDiff(prev)
  }
}
