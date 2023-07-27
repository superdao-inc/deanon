import { keyBy, partition } from 'lodash'
import { Injectable, Logger } from '@nestjs/common'
import { TwitterService } from 'src/services/externalServices/twitter.service'
import { transform, transformer } from 'csv'
import { WalletXTwitter } from 'src/service/deanon/pipeline/pipelines/types'
import { TwitterResponseEmpty, TwitterResponseEnriched } from 'src/service/deanon/pipeline/streams/types'

interface Options {
  twitterService: TwitterService
}

interface WalletTwitterDTO {
  wallet: string
  domains: string[]
  source: string
  twitterUsername: string
}

@Injectable()
export class WalletToTwitterStreamProvider {
  private readonly logger = new Logger('WalletToTwitterStreamProvider')

  constructor (
    private readonly twitterService: TwitterService) {}

  create (): transformer.Transformer {
    return WalletToTwitterStream({ twitterService: this.twitterService }, this.logger)
  }
}

@Injectable()
export class WalletToTwitterProvider {
  readonly #logger = new Logger('WalletToTwitterStreamProvider')

  constructor (
    private readonly twitterService: TwitterService) {}

  async getTwitter (walletTwitterDTOs: WalletXTwitter[]): Promise<Array<TwitterResponseEmpty | TwitterResponseEnriched>> {
    const [validTwitters, invalidTwitters] = partition(walletTwitterDTOs, account => /^[A-Za-z0-9_]{1,15}$/.test(account.twitterUsername))
    if (invalidTwitters.length > 0) {
      this.#logger.log('Found invalid twitters')
      this.#logger.log(invalidTwitters)
    }
    this.#logger.log('call twitter api', new Date(), 'account:', validTwitters.length)

    console.log('validTwitters', validTwitters)

    const twitterUsernames = validTwitters.map(account => account.twitterUsername).filter(Boolean)
    const users = validTwitters.length > 0 ? await this.twitterService.getUsersByUsername(twitterUsernames) : []

    const enriched = walletTwitterDTOs.map(account => {
      const twitter = account.twitterUsername?.toLowerCase()
      const user = users.find(user => user.username?.toLowerCase() === twitter)

      const empty: TwitterResponseEmpty = {
        wallet_address: account.wallet,
        source: account.source,
        twitter_username: ''
      }

      if (twitter == null) return empty
      if (user == null) return empty

      const username: string = user.username ?? ''

      return {
        wallet_address: account.wallet,
        source: account.source,
        twitter_id: user.id,
        twitter_url: `https://twitter.com/${username}`,
        twitter_name: user.name,
        twitter_location: user.location?.trim() ?? '',
        twitter_avatar_url: user.profile_image_url,
        twitter_username: user.username,
        twitter_followers_count: String(user.public_metrics.followers_count),
        twitter_bio: user.description.trim().replace(/\n|\r|\n\r/g, ' ')
      }
    })

    console.log('Twitter API data', enriched)

    this.#logger.log('found twitters', { numberOfUsers: users.length })

    return enriched
  }
}

export const WalletToTwitterStream = (options: Options, logger: Logger): transformer.Transformer => transform<WalletTwitterDTO[]>({ parallel: 1 }, async (walletTwitterDTOs, callback) => {
  const { twitterService } = options

  const [validTwitters, invalidTwitters] = partition(walletTwitterDTOs, account => /^[A-Za-z0-9_]{1,15}$/.test(account.twitterUsername))
  if (invalidTwitters.length > 0) {
    logger.log('Found invalid twitters')
    logger.log(invalidTwitters)
  }
  logger.log('call twitter api', new Date(), 'account:', validTwitters.length)

  const users = validTwitters.length > 0 ? await twitterService.getUsersByUsername(validTwitters.map(account => account.twitterUsername)) : []
  const keyedUsers = keyBy(users, user => user.username.toLowerCase())

  const enriched = validTwitters.map(acc => {
    const twitter = acc.twitterUsername.toLowerCase()

    if (!(twitter in keyedUsers)) {
      return {
        wallet_address: acc.wallet,
        source: acc.source,
        twitter_username: twitter
      }
    }

    const user = keyedUsers[twitter]
    const username: string = user.username

    return {
      wallet_address: acc.wallet,
      source: acc.source,
      twitter_id: user.id,
      twitter_url: `https://twitter.com/${username}`,
      twitter_name: user.name,
      twitter_location: user.location?.trim() ?? '',
      twitter_avatar_url: user.profile_image_url,
      twitter_username: user.username,
      twitter_followers_count: String(user.public_metrics.followers_count),
      twitter_bio: user.description.trim().replace(/\n|\r|\n\r/g, ' ')
    }
  })

  logger.log('found twitters', users.length)

  callback(null, ...enriched)
})
