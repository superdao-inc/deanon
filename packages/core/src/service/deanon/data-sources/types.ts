export type TwitterNames = Set<string>

export interface AccountTwitterNames {
  [account: string]: TwitterNames
}

export interface DataSource {
  name: string
  maxExecutionTimeMs: number
  init?: () => Promise<void>
  // Changes its argument
  getSocialsBatch: (accounts: Account[]) => Promise<AccountTwitterNames>
}

export interface Twitters {
  [source: string]: TwitterNames
}

export interface Account {
  readonly wallet: string
  domains?: string[]
  twitter?: string | null
  twitters?: Twitters
  source?: string
}

export interface AccountWithTwitter extends Account {
  twitter: string
  twitters: Twitters
  source: string
}
