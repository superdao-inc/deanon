import { Logger } from '@nestjs/common'
import { Kafka, Producer } from 'kafkajs'
import { measure } from 'src/utils'

export class KafkaProducer {
  private readonly logger = new Logger(KafkaProducer.name)
  private readonly producer: Producer
  private isConnected = false

  constructor (client: Kafka, private readonly topic: string) {
    this.producer = client.producer()
  }

  private async connect (): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect()
      this.isConnected = true
    }
  }

  async send (message: any): Promise<void> {
    const input = Array.isArray(message) ? message : [message]
    const messages = input.map((m) => ({ value: JSON.stringify(m) }))

    await this.connect()

    const [metadata, t] = await measure(() =>
      this.producer.send({
        topic: this.topic,
        messages
      })
    )
    this.logger.log('Producer sent message', {
      topic: this.topic,
      metadata,
      time: t
    })
  }
}
