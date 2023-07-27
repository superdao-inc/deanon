import fetch from 'node-fetch'
import { fromPairs } from 'lodash'
import { URLSearchParams } from 'node:url'
import { Injectable, Logger } from '@nestjs/common'

import { Account, AccountTwitterNames, DataSource } from './types'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import { Counter, Histogram } from 'prom-client'
import { ConfigService } from '@nestjs/config'

interface ScrapeResult {
  [url: string]: string
}

interface ScrapeListResponse {
  data: ScrapeResult
  errors?: ScrapeResult
}

@Injectable()
export class OpenseaDataSource implements DataSource {
  readonly #logger = new Logger(OpenseaDataSource.name)

  readonly #scraperUrl: string

  name: string = 'opensea'
  public maxExecutionTimeMs = 300 * 1000

  constructor (
    private readonly configService: ConfigService,
    @InjectMetric('opensea_response_time') private readonly openseaResponseTime: Histogram<string>,
    @InjectMetric('opensea_messages') private readonly openseaMessages: Counter<string>,
    @InjectMetric('opensea_errors') private readonly openseaErrors: Counter<string>
  ) {
    this.#scraperUrl = this.configService.getOrThrow<string>('scraper.url')
  }

  async getSocialsBatch (accounts: Account[]): Promise<AccountTwitterNames> {
    this.openseaMessages.inc(accounts.length)

    const accountsWithTwitter: AccountTwitterNames = {}
    const accountMap = fromPairs(accounts.map((account) => [`https://opensea.io/${account.wallet}`, account.wallet]))
    const params = new URLSearchParams(Object.keys(accountMap).map((url) => ['url', url] as [string, string]))
    params.append('xpath', '//script[contains(text(), "window.__wired__")]')

    try {
      const start = Date.now()

      const requestUrl = `${this.#scraperUrl}/scrape/list?${params.toString()}`
      const request = await fetch(requestUrl, { timeout: this.maxExecutionTimeMs })
      const response = (await request.json()) as ScrapeListResponse

      const end = Date.now()
      const responseTimeSeconds = (end - start) / 1000
      this.openseaResponseTime.observe(responseTimeSeconds)

      if (response.data == null) {
        throw new Error('opensea error: ' + JSON.stringify(response))
      }
      const data = response.data

      let i = 0
      const errors = Object.keys(response?.errors ?? {}).length
      for (const url in data) {
        const match = /"connectedTwitterUsername":"(.+?)"/s.exec(data[url])
        const twitterId = match?.[1]
        if (twitterId != null) {
          i++
          accountsWithTwitter[accountMap[url]] = new Set<string>([twitterId])
        }
      }
      this.#logger.debug(`twitter ${i}; data ${Object.keys(data).length}; errors ${errors}; all ${accounts.length}`)

      if (errors) {
        this.openseaErrors.inc(errors)
        this.#logger.error('opensea errors', response?.errors)
      }
    } catch (e: unknown) {
      this.#logger.error('opensea parse error', e)
      return {}
    }

    this.#logger.log('Opensea getSocialBatch', {
      accounts: accounts.length,
      twitterNamesLength: Object.keys(accountsWithTwitter).length
    })

    return accountsWithTwitter
  }
}
