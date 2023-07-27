import { Injectable, Logger } from '@nestjs/common'
import { BasePipeline } from 'src/service/deanon/pipeline/pipelines/base.pipeline'
import { DbPool } from 'src/db/db.pool'
import fetch from 'node-fetch'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import { Counter, Histogram } from 'prom-client'
import { WalletToTwitterProvider } from 'src/service/deanon/pipeline/streams/wallet-to-twitter.stream'
import { WalletXTwitter } from 'src/service/deanon/pipeline/pipelines/types'

@Injectable()
export class OpenseaPipeline extends BasePipeline {
  constructor (
    private readonly dbPool: DbPool,
    @InjectMetric('opensea_response_time') private readonly openseaResponseTime: Histogram<string>,
    @InjectMetric('opensea_messages') private readonly openseaMessages: Counter<string>,
    @InjectMetric('opensea_errors') private readonly openseaErrors: Counter<string>,
    protected readonly walletToTwitterProvider: WalletToTwitterProvider
  ) {
    super(walletToTwitterProvider)

    this.pool = this.dbPool.pool
    this.logger = new Logger(OpenseaPipeline.name)
    this.name = 'opensea'
    this.maxExecutionTimeMs = 10 * 1000
  }

  protected async getSocialsBatch (wallets: string[]): Promise<WalletXTwitter[]> {
    this.openseaMessages.inc(wallets.length)

    try {
      const start = Date.now()

      const openseaRequests = wallets.map(async (wallet) => {
        const url = `https://api.opensea.io/user/${wallet}`
        const data = await fetch(url).then((res) => res.json())

        const { twitter_username: twitterUsername } = data?.account ?? {}

        return { wallet, twitterUsername, source: 'opensea' }
      })
      const settledUsernames = await Promise.allSettled(openseaRequests)

      const end = Date.now()
      this.openseaResponseTime.observe(end - start)

      const twitterUsername = settledUsernames.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return null
        }
      }).filter((value): value is WalletXTwitter => Boolean(value))

      this.logger.log('Opensea getSocialBatch', {
        accounts: wallets.length,
        twitterNamesLength: settledUsernames.length
      })

      return twitterUsername
    } catch (e: unknown) {
      this.logger.error('opensea parse error', e)
      this.openseaErrors.inc()

      return []
    }
  }
}
