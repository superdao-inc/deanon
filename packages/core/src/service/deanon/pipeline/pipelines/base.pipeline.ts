import { Injectable, Logger } from '@nestjs/common'

import { Pool } from 'pg'
import { differenceBy } from 'lodash'
import { EachBatchPayload } from 'kafkajs'

import { Account } from 'src/service/deanon/data-sources/types'
import { isAddress } from 'ethers/lib/utils'
import { WalletToTwitterProvider } from 'src/service/deanon/pipeline/streams/wallet-to-twitter.stream'
import { WalletXTwitter } from 'src/service/deanon/pipeline/pipelines/types'
import { TwitterResponseEmpty, TwitterResponseEnriched } from 'src/service/deanon/pipeline/streams/types'

interface CacheResponse {
  wallet_address: string
  next_lookup: Date
  source: string
}

const pause = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms))

@Injectable()
export abstract class BasePipeline {
  protected logger: Logger

  protected pool: Pool

  name: string

  maxExecutionTimeMs: number

  protected abstract getSocialsBatch (wallets: string[]): Promise<WalletXTwitter[]>

  protected constructor (
    protected readonly twitterProvider: WalletToTwitterProvider) {
  }

  buildPipeline (): (payload: EachBatchPayload) => Promise<void> {
    this.logger.log('Building pipeline', { datasource: this.name })

    return async (payload): Promise<void> => {
      this.logger.log('Processing batch', payload.batch.messages.length)

      const { batch: { messages }, heartbeat } = payload

      const wallets: string[] = messages.map(message => message.value?.toString().toLowerCase())
        .filter((value): value is string => Boolean(value))
        .filter(isAddress)

      await this.#processBatch(wallets, heartbeat)
    }
  }

  #processBatch = async (wallets: string[], ping: () => Promise<void>): Promise<void> => {
    const batchSize = 50
    let batchCounter = 0
    const currentBatch: string[] = []
    this.logger.log('Processing chunk', { length: wallets.length, firstWallet: wallets[0] })

    const processBatch = async (): Promise<void> => {
      if (currentBatch.length > 0) {
        this.logger.log('Processing batch', { batchCounter })

        await this.#deanon(currentBatch)
        currentBatch.length = 0
        batchCounter += 1

        // Ping the heartbeat to prevent the consumer from timing out
        await ping()
      }
    }

    for await (const data of wallets) {
      currentBatch.push(data)

      if (currentBatch.length === batchSize) {
        await processBatch()
        await pause(2000) // await 2 seconds to avoid rate limit
      }
    }

    // Process any remaining items in the batch
    if (currentBatch.length > 0) {
      await processBatch()
    }

    this.logger.log('Finished processing chunk', { batchCounter })
  }

  #deanon = async (wallets: string[]): Promise<void> => {
    const walletsToDeanon = await this.#checkCache(wallets)
    const walletsWithTwitter = await this.getSocialsBatch(walletsToDeanon)
    const twitterInfo = await this.twitterProvider.getTwitter(walletsWithTwitter as any)

    try {
      await this.#writeToDB(twitterInfo)
      await this.#writeToCache(twitterInfo)
    } catch (error) {
      this.logger.error('Error writing to DB', { error })
    }
  }

  #checkCache = async (wallets: string[]): Promise<string[]> => {
    const source = this.name
    this.logger.log('checking cache', { length: wallets.length, source })

    const sqlWallets = wallets.map((i: string) => `'${i.toLowerCase()}'`).join(',')
    const sqlString = `
      SELECT * FROM wallets_cache
      WHERE wallet_address IN (${sqlWallets}) and source = '${source}' and next_lookup >= now()
    `
    const data = await this.pool.query<CacheResponse>(sqlString)
    const cacheAccounts: Account[] = data.rows.map(({ wallet_address: wallet }) => ({ wallet }))
    const walletsToDeanon = differenceBy(wallets.map((wallet) => ({ wallet })), cacheAccounts, 'wallet')

    return walletsToDeanon.map(({ wallet }) => wallet)
  }

  #writeToCache = async (data: Array<TwitterResponseEmpty | TwitterResponseEnriched>): Promise<void> => {
    this.logger.log('write to cache')

    const values = data.map((item) => {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return `('${item.wallet_address.toLowerCase()}', now() + interval '2 weeks', '${item.source}', now())`
    })

    if (values.length === 0) return

    await this.pool.query(`
      INSERT INTO wallets_cache (wallet_address, next_lookup, source, updated_at)
      VALUES ${values.join(', ')}
      ON CONFLICT (wallet_address, source) DO UPDATE SET next_lookup = now() + interval '2 weeks'
    `)
  }

  #writeToDB = async (data: Array<TwitterResponseEmpty | TwitterResponseEnriched>): Promise<void> => {
    this.logger.log('write to db')

    const enriched = data.filter((item): item is TwitterResponseEnriched => 'twitter_id' in item)

    if (enriched.length === 0) return

    const valuesAsSchema = enriched.map((item) => {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return `('${item.wallet_address.toLowerCase()}', ${item.twitter_id}, '${item.twitter_url}', '${item.twitter_avatar_url}', '${item.twitter_username}', ${item.twitter_followers_count}, '${item.source}', '${item.twitter_location}', '${item.twitter_name}', '${item.twitter_bio}')`
    })

    const sqlString = `
      INSERT INTO wallets_meta (wallet_address, twitter_id, twitter_url, twitter_avatar_url, twitter_username, twitter_followers_count, source, twitter_location, twitter_name, twitter_bio)
      VALUES ${valuesAsSchema.join(', ')}
      ON CONFLICT (wallet_address, twitter_id) DO UPDATE SET
        twitter_url = EXCLUDED.twitter_url,
        twitter_avatar_url = EXCLUDED.twitter_avatar_url,
        twitter_username = EXCLUDED.twitter_username,
        twitter_followers_count = EXCLUDED.twitter_followers_count,
        source = EXCLUDED.source,
        twitter_location = EXCLUDED.twitter_location,
        twitter_name = EXCLUDED.twitter_name,
        twitter_bio = EXCLUDED.twitter_bio
    `

    await this.pool.query(sqlString)
  }
}
