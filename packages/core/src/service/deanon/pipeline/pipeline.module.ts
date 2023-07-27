import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PipelineBuilder } from 'src/service/deanon/pipeline/pipelineBuilder.provider'
import { TwitterModule } from 'src/services/externalServices/twitter.module'

import { DbModule } from 'src/db/db.module'

// Pipelines
import { OpenseaPipeline } from 'src/service/deanon/pipeline/pipelines/opensea.pipeline'
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus'
import { exponentialBuckets } from 'prom-client'

@Module({
  imports: [ConfigModule, TwitterModule, DbModule],
  providers: [
    OpenseaPipeline,
    PipelineBuilder,

    makeCounterProvider({ name: 'opensea_messages', help: 'Opensea messages counter', labelNames: ['openase'] }),
    makeCounterProvider({ name: 'opensea_errors', help: 'Opensea errors counter', labelNames: ['opensea'] }),
    makeHistogramProvider({
      name: 'opensea_response_time',
      help: 'Opensea response time for batch in seconds',
      labelNames: ['opensea'],
      buckets: exponentialBuckets(0.05, 1.5, 20)
    })
  ],
  exports: [PipelineBuilder]
})
export class PipelineModule {}
