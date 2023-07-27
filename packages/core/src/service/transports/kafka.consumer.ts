import assert from 'node:assert'
import { Logger } from '@nestjs/common'
import { Admin, Consumer, EachBatchHandler, EachMessageHandler, Kafka } from 'kafkajs'

type SourceNames = 'opensea' | 'elastic' | 'ens'

export class KafkaConsumer {
  readonly #logger = new Logger(KafkaConsumer.name)

  readonly #topicId: string
  readonly #highPriorityTopicId?: string

  readonly #consumer: Consumer
  readonly #admin: Admin

  readonly #eachBatch: EachBatchHandler | undefined
  readonly #eachMessage: EachMessageHandler | undefined

  constructor (
    client: Kafka,
    topicId: string,
    groupId: SourceNames | string,
    maxExecutionTime: number,
    highPriorityTopicId?: string,
    eachBatch?: EachBatchHandler,
    eachMessage?: EachMessageHandler
  ) {
    assert(eachBatch ?? eachMessage, 'Either eachBatch or eachMessage must be defined')

    this.#topicId = topicId
    this.#highPriorityTopicId = highPriorityTopicId

    this.#consumer = client.consumer({ groupId, sessionTimeout: maxExecutionTime, maxBytes: 500000 })
    this.#admin = client.admin()

    this.#eachBatch = eachBatch
    this.#eachMessage = eachMessage
  }

  async manage (): Promise<void> {
    if (this.#highPriorityTopicId == null) return

    const highPriorityTopicOffset = await this.#admin.fetchTopicOffsets(this.#highPriorityTopicId)
    const isLowPriorityTopicPaused = this.#consumer.paused().map(({ topic }) => topic).includes(this.#topicId)

    this.#logger.log('highPriorityTopicOffset', JSON.stringify(highPriorityTopicOffset, null, 2))

    const hasMessages = highPriorityTopicOffset[0].offset !== highPriorityTopicOffset[0].high

    if (hasMessages && !isLowPriorityTopicPaused) {
      // pause low priority topic
      this.#logger.log('Pausing low priority topic', { topic: this.#topicId })
      await this.#consumer.pause([{ topic: this.#topicId }])
    } else if (!hasMessages && isLowPriorityTopicPaused) {
      // resume low priority topic
      this.#logger.log('Resuming low priority topic', { topic: this.#topicId })
      await this.#consumer.resume([{ topic: this.#topicId }])
    }
  }

  async run (): Promise<void> {
    try {
      const topics = [this.#topicId]
      if (this.#highPriorityTopicId != null) topics.push(this.#highPriorityTopicId)

      await this.#consumer.connect()
      await this.#consumer.subscribe({ topics, fromBeginning: true })

      const { END_BATCH_PROCESS } = this.#consumer.events

      this.#consumer.on(END_BATCH_PROCESS, async ({ payload: { topic, batchSize, offsetLag } }) => {
        this.#logger.log('Batch processed', { topic, batchSize, offsetLag })
        await this.manage()
      })

      if (this.#eachBatch != null) {
        await this.#consumer.run({
          eachBatch: async (args) => {
            await this.#eachBatch?.(args)
            await this.manage()
          }
        })
      } else if (this.#eachMessage != null) {
        await this.#consumer.run({
          eachMessage: async (args) => {
            await this.#eachMessage?.(args)
            await this.manage()
          }
        })
      }

      this.#logger.log('Consumer run succeeded', { topic: this.#topicId, highPriorityTopicId: this.#highPriorityTopicId })
    } catch (e) {
      this.#logger.error('Cannot run consumer', { topic: this.#topicId, error: e })
    }
  }
}
