import { Inject, Injectable, Logger } from '@nestjs/common'
import { KafkaClient } from 'src/service/transports/kafka.providers'
import { Kafka } from 'kafkajs'
import { ConfigService } from '@nestjs/config'
import { KafkaConsumer } from 'src/service/transports/kafka.consumer'
import { EnsPipeline } from 'src/service/ens/ens.pipeline'

@Injectable()
export class EnsResolver {
  readonly #logger = new Logger(EnsResolver.name)

  private readonly ensResolverTransport: KafkaConsumer

  constructor (
  @Inject(KafkaClient) client: Kafka,
    private readonly configService: ConfigService,
    private readonly ensPipelineBuilder: EnsPipeline
  ) {
    const ensTopicId = this.configService.getOrThrow<string>('kafka.ensTopicId')
    this.#logger.log('Ens Topic Id', ensTopicId)

    const pipeline = this.ensPipelineBuilder.buildPipeline()
    this.ensResolverTransport = new KafkaConsumer(client, ensTopicId, 'ens-resolver', 10000, undefined, pipeline)
  }

  async init (): Promise<void> {
    await this.ensResolverTransport.run()

    this.#logger.log('Ens Resolver initialized')
  }
}
