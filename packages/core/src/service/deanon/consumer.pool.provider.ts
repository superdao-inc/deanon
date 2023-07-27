import { Inject, Injectable, Logger } from '@nestjs/common'
import { Kafka } from 'kafkajs'

import { ConfigService } from '@nestjs/config'
import { KafkaClient } from '../transports/kafka.providers'
import { KafkaConsumer } from '../transports/kafka.consumer'
import { PipelineBuilder } from 'src/service/deanon/pipeline/pipelineBuilder.provider'
import { OpenseaDataSource } from 'src/service/deanon/data-sources/opensea.data-source'

@Injectable()
export class DeanonConsumerPool {
  readonly #logger = new Logger(DeanonConsumerPool.name)

  private readonly openseaTransport: KafkaConsumer

  constructor (
  @Inject(KafkaClient) client: Kafka,
    private readonly pipelineBuilder: PipelineBuilder,
    private readonly configService: ConfigService,
    private readonly opensea: OpenseaDataSource
  ) {
    const topicId = this.configService.getOrThrow<string>('kafka.topicId')
    const highPriorityTopicId = this.configService.getOrThrow<string>('kafka.highPriorityTopicId')

    const openseaPipeline = this.pipelineBuilder.buildPipeline(this.opensea)
    this.openseaTransport = new KafkaConsumer(client, topicId, 'opensea', opensea.maxExecutionTimeMs, highPriorityTopicId, openseaPipeline)
  }

  async init (): Promise<void> {
    await Promise.all([this.openseaTransport.run()])
    this.#logger.log('Deanon pool initialized')
  }
}
