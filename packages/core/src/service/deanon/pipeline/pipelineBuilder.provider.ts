import { Injectable, Logger } from '@nestjs/common'
import { Pool } from 'pg'
import { EachBatchPayload } from 'kafkajs'

import { Account, DataSource } from 'src/service/deanon/data-sources/types'
import { DbPool } from 'src/db/db.pool'
import { isAddress } from 'ethers/lib/utils'
import { differenceBy } from 'lodash'
import { OpenseaPipeline } from 'src/service/deanon/pipeline/pipelines/opensea.pipeline'

interface CacheResponse {
  wallet_address: string
  next_lookup: Date
  source: string
}

@Injectable()
export class PipelineBuilder {
  readonly #pool: Pool

  readonly #logger = new Logger(PipelineBuilder.name)

  constructor (
    private readonly dbPool: DbPool,
    private readonly openseaPipelineNew: OpenseaPipeline
  ) {
    this.#pool = this.dbPool.pool
  }

  buildPipeline (datasource: DataSource): (payload: EachBatchPayload) => Promise<void> {
    if (datasource.name === 'opensea') {
      return this.openseaPipelineNew.buildPipeline()
    }

    const func = datasource.name === 'twitter'
    this.#logger.log('Building pipeline', { datasource: datasource.name, func })

    return async (payload): Promise<void> => {
      this.#logger.log('Processing batch', payload.batch.messages.length)

      const { batch: { messages }, heartbeat } = payload

      const wallets: string[] = messages.map(message => message.value?.toString().toLowerCase())
        .filter((value): value is string => Boolean(value))
        .filter(isAddress)

      await this.#processBatch(wallets, heartbeat, datasource.name)
    }
  }

  #processBatch = async (wallets: string[], ping: () => Promise<void>, source: string): Promise<void> => {
    const batchSize = 50
    let batchCounter = 0
    const currentBatch: string[] = []
    this.#logger.log('Processing chunk', { length: wallets.length, firstWallet: wallets[0] })

    const processBatch = async (): Promise<void> => {
      if (currentBatch.length > 0) {
        this.#logger.log('Processing batch', { batchCounter })

        await this.#deanon(currentBatch, source)
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
      }
    }

    // Process any remaining items in the batch
    if (currentBatch.length > 0) {
      await processBatch()
    }

    this.#logger.log('Finished processing chunk', { batchCounter })
  }

  #deanon = async (wallets: string[], source: string): Promise<void> => {
    const walletsToDeanon = await this.#checkCache(wallets, source)

    await new Promise((resolve) => {
      resolve(walletsToDeanon)
    })
  }

  #checkCache = async (wallets: string[], source: string): Promise<string[]> => {
    this.#logger.log('checking cache', { length: wallets.length, source })

    const sqlWallets = wallets.map((i: string) => `'${i}'`).join(',')
    const sqlString = `
      SELECT * FROM wallets_cache
      WHERE wallet_address IN (${sqlWallets}) and source = '${source}' and next_lookup <= now()
    `

    const data = await this.#pool.query<CacheResponse>(sqlString)
    const cacheAccounts: Account[] = data.rows.map(({ wallet_address: wallet }) => ({ wallet }))
    const walletsToDeanon = differenceBy(wallets.map((wallet) => ({ wallet })), cacheAccounts, 'wallet')

    return walletsToDeanon.map(({ wallet }) => wallet)
  }
}
