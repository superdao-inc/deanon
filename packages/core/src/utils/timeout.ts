import { transform } from 'csv'

export const filterStream = (cond: (chunk: unknown) => boolean): ReturnType<typeof transform> =>
  transform({ parallel: 1 }, (chunk) => {
    return cond(chunk) ? chunk : null
  })
