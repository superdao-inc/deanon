import { Module } from '@nestjs/common'
import { TwitterService } from 'src/services/externalServices/twitter.service'
import { makeHistogramProvider } from '@willsoto/nestjs-prometheus'
import { exponentialBuckets } from 'prom-client'

@Module({
  providers: [
    TwitterService,
    makeHistogramProvider({
      name: 'twitter_response_time',
      help: 'Twitter response time',
      labelNames: ['twitter_api'],
      buckets: exponentialBuckets(0.05, 1.3, 15)
    })
  ],
  exports: [TwitterService]
})
export class TwitterModule {}
