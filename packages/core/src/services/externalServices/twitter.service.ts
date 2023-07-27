import { Injectable } from '@nestjs/common'
import { InjectMetric } from '@willsoto/nestjs-prometheus'

import fetch from 'node-fetch'
import { random } from 'lodash'
import { Histogram } from 'prom-client'
import { ConfigService } from '@nestjs/config'

export interface User {
  id: string
  location: string
  public_metrics: {
    followers_count: number
  }
  profile_image_url: string
  username: string
  name: string
  description: string
}

@Injectable()
export class TwitterService {
  private readonly bearerTokens = [
    'your_twitter_bearer_token'
  ]

  constructor (
    private readonly configService: ConfigService,
    @InjectMetric('twitter_response_time') private readonly twitterResponseTime: Histogram<string>
  ) {
    this.bearerTokens = [this.configService.getOrThrow<string>('twitter.apiKey')]
  }

  async getUserById (id: string): Promise<User | undefined> {
    const i = random(0, this.bearerTokens.length - 1)
    const token = this.bearerTokens[i]
    const response = await fetch(
      `https://api.twitter.com/2/users/${id}?user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,url,username,verified,withheld`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        timeout: 30000
      }
    )
    const data: { data: User } = await response.json()

    if (data.data == null) {
      throw new Error(JSON.stringify(data))
    }

    return data.data
  }

  async getUsersByUsername (usernames: string[]): Promise<User[]> {
    const i = random(0, this.bearerTokens.length - 1)
    const start = Date.now()

    const token = this.bearerTokens[i]
    const response = await fetch(
      `https://api.twitter.com/2/users/by/?usernames=${usernames.join(
        ','
      )}&user.fields=location,profile_image_url,public_metrics,description`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        timeout: 30000
      }
    )
    const data: { data: User[] } = await response.json()

    const end = Date.now()
    const responseTimeSeconds = (end - start) / 1000
    this.twitterResponseTime.observe(responseTimeSeconds)

    if (data.data == null) {
      throw new Error(`getUsersByUsername: Twitter API error. ${JSON.stringify(data)}`)
    }
    return data.data
  }
}
