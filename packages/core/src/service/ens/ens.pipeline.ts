import { Injectable, Logger } from '@nestjs/common'
import { DbPool } from 'src/db/db.pool'
import { Pool } from 'pg'
import { EachBatchPayload } from 'kafkajs'
import { PromisePool } from '@supercharge/promise-pool'
import { ethers } from 'ethers'
import { ConfigService } from '@nestjs/config'
import { isAddress } from 'ethers/lib/utils'

interface Ens {
  address: string
  ens_name: string
}
type MaybeEns = Omit<Ens, 'ens_name'> & { ens_name?: string }
type NotEns = Omit<Ens, 'ens_name'> & { ens_name: undefined }

@Injectable()
export class EnsPipeline {
  readonly #logger = new Logger(EnsPipeline.name)

  readonly #pool: Pool

  readonly #provider: ethers.providers.JsonRpcProvider

  constructor (
    private readonly configService: ConfigService,
    private readonly dbPool: DbPool
  ) {
    this.#pool = this.dbPool.pool

    const nodeUrl = this.configService.getOrThrow('eth.nodeUrl')
    this.#provider = new ethers.providers.JsonRpcProvider(nodeUrl, 1)
  }

  public buildPipeline (): (payload: EachBatchPayload) => Promise<void> {
    return async (payload): Promise<void> => {
      this.#logger.log('Processing batch', payload.batch.messages.length)

      const { batch: { messages }, heartbeat } = payload

      const wallets: string[] = messages.map(message => message.value?.toString().toLowerCase())
        .filter((value): value is string => Boolean(value))
        .filter(isAddress)

      await this.#processChunk(wallets, heartbeat)
    }
  }

  #processChunk = async (wallets: string[], ping: () => Promise<void>): Promise<void> => {
    const batchSize = 50
    let batchCounter = 0
    const currentBatch: string[] = []
    this.#logger.log('Processing chunk', { length: wallets.length, firstWallet: wallets[0] })

    const processBatch = async (): Promise<void> => {
      if (currentBatch.length > 0) {
        this.#logger.log('Processing batch', batchCounter)

        await this.#resolveEnsNames(currentBatch)
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

    this.#logger.log('Finished processing chunk', batchCounter)
  }

  #resolveEnsNames = async (accounts: string[]): Promise<void> => {
    const concurrentRequests = 50
    const map = new Map<string, string | undefined>(accounts.map((account: string) => [account, undefined]))

    const { errors } = await PromisePool.withConcurrency(concurrentRequests)
      .for(accounts)
      .process(async (account: string) => {
        // Using reverse resolution to get the domain name –
        // https://docs.ens.domains/dapp-developer-guide/resolving-names#reverse-resolution
        const ensName = await this.#provider.lookupAddress(account)
        if (ensName == null) return

        const forwardResolution = await this.#provider.resolveName(ensName)
        if (forwardResolution == null || forwardResolution.toLowerCase() !== account.toLowerCase()) return

        map.set(account, ensName)
      })

    if (errors.length > 0) {
      this.#logger.error('Error while resolving ENS names', { errors })
    }

    const arr: MaybeEns[] = Array.from(map.entries()).map(([address, ens]) => {
      return { address, ens_name: ens }
    })
    const noEns: NotEns[] = arr.filter((item): item is NotEns => item.ens_name === undefined)
    const withEns: Ens[] = arr.filter((item): item is Ens => item.ens_name !== undefined)

    await Promise.all([this.#writeToDb(withEns), this.#invalidate(withEns, noEns)])
  }

  #invalidate = async (withEns: Ens[], noEns: NotEns[]): Promise<void> => {
    if (noEns.length === 0 && withEns.length === 0) {
      this.#logger.log('Nothing to invalidate')
      return
    }

    this.#logger.log('Invalidating rows', noEns.length)

    try {
      // Invalidate all rows that previously had another ENS name, but now have a different one
      const addressesWithAnotherEnsToInvalidate = withEns
        .map((item) => `('${item.address}', '${item.ens_name}')`)
        .join(', ')
      const invalidatePreviousQuery = `
        UPDATE wallets_ens
        SET valid_to = NOW()
        FROM (VALUES ${addressesWithAnotherEnsToInvalidate}) AS input_pairs(address, ens_name)
        WHERE wallets_ens.address = input_pairs.address AND wallets_ens.ens_name <> input_pairs.ens_name;
      `

      if (addressesWithAnotherEnsToInvalidate.length !== 0) {
        await this.#pool.query(invalidatePreviousQuery)
      }

      // Invalidate all rows that previously had an ENS name but now don't
      const addressesToInvalidate = noEns
        .map((item) => `'${item.address}'`)
        .join(', ')
      const query = `
        UPDATE wallets_ens SET valid_to = NOW() 
        WHERE address IN (${addressesToInvalidate})
      `

      if (addressesToInvalidate.length !== 0) {
        await this.#pool.query(query)
      }
    } catch (e) {
      this.#logger.error('Error while invalidating row', e)
    }
  }

  #writeToDb = async (arr: Ens[]): Promise<void> => {
    if (arr.length === 0) {
      this.#logger.log('Nothing to write to DB')
      return
    }

    this.#logger.log('Writing to DB', arr.length)

    try {
      const valuesToWrite = arr
        .map((item) => `('${item.address}', '${item.ens_name}')`)
        .join(', ')
      // update in case if the record is not already valid
      const insertQuery = `
        INSERT INTO wallets_ens (address, ens_name) VALUES ${valuesToWrite} 
        ON CONFLICT (address, ens_name) DO UPDATE SET valid_to = null
        WHERE wallets_ens.valid_to IS NOT NULL
      `

      await this.#pool.query(insertQuery)
    } catch (e) {
      this.#logger.error('Error while writing to DB', e)
    }
  }
}
