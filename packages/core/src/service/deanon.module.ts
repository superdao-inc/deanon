import { ConfigModule } from '@nestjs/config'
import { Logger, Module, OnModuleInit } from '@nestjs/common'

import { PipelineModule } from 'src/service/deanon/pipeline/pipeline.module'
import { KafkaClientProvider } from 'src/service/transports/kafka.providers'
import { OpenseaDataSource } from 'src/service/deanon/data-sources/opensea.data-source'

import { DeanonConsumerPool } from 'src/service/deanon/consumer.pool.provider'
import { EnsResolver } from 'src/service/ens/ens.resolver'
import { EnsPipeline } from 'src/service/ens/ens.pipeline'
import { DbModule } from 'src/db/db.module'

@Module({
  imports: [ConfigModule, PipelineModule, DbModule],
  providers: [
    KafkaClientProvider,

    // Ens resolver
    EnsPipeline,
    EnsResolver,

    // Deanon
    DeanonConsumerPool,
    OpenseaDataSource
  ],
  exports: [KafkaClientProvider]
})
export class DeanonModule implements OnModuleInit {
  readonly #logger = new Logger(DeanonModule.name)

  constructor (private readonly pool: DeanonConsumerPool, private readonly ensResolver: EnsResolver) {}

  async onModuleInit (): Promise<void> {
    this.#logger.log('Deanon module init')
    await Promise.all([this.pool.init(), this.ensResolver.init()])
  }
}
