import { Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Kafka } from 'kafkajs'
import { readFileSync } from 'fs'
import { chunk } from 'lodash'
import { ConfigService } from '@nestjs/config'
import { TwitterService } from 'src/services/externalServices/twitter.service'

@Controller()
export class AppController {
  constructor (
    private readonly configService: ConfigService,
    private readonly twitterService: TwitterService
  ) {

  }

  @Get('health')
  @HttpCode(200)
  health (): { status: string } {
    return { status: 'OK' }
  }

  @Get('twitter')
  @HttpCode(200)
  twitter (): void {
    // curl -X GET http://localhost:8000/twitter
    void this.twitterService.getUserById('1447889684508540936')
  }

  @Post('produceHighPriority')
  @HttpCode(201)
  // curl -X POST http://localhost:8000/produceHighPriority
  produceHighPriority (): void {
    const highPriorityTopicId = this.configService.getOrThrow<string>('kafka.highPriorityTopicId')
    const testKafka = async (): Promise<void> => {
      const content = readFileSync('wallet.csv')
      const wallets = content.toString().split('\n').filter((wallet) => wallet.length > 0)

      const chunkedWallets = chunk(wallets, 500)

      await this.#produceChunks(highPriorityTopicId, chunkedWallets)
    }

    void testKafka()
  }

  @Post('produce')
  @HttpCode(201)
  // curl -X POST http://localhost:8000/produce
  produce (): void {
    const topicId = this.configService.getOrThrow<string>('kafka.topicId')
    const testKafka = async (): Promise<void> => {
      const content = readFileSync('wallet.csv')
      const wallets = content.toString().split('\n')
      // Remove last empty string
      wallets.pop()

      const chunkedWallets = chunk(wallets, 10000)

      await this.#produceChunks(topicId, chunkedWallets)
    }

    void testKafka()
  }

  @Post('produceEnsTest')
  @HttpCode(201)
  // curl -X POST http://localhost:8000/produceEnsTest
  produceEnsTest (): void {
    const topicId = this.configService.getOrThrow<string>('kafka.ensTopicId')
    const testKafka = async (): Promise<void> => {
      const content = readFileSync('wallet.csv')
      const wallets = content.toString().split('\n')
      // Remove last empty string
      wallets.pop()

      const chunkedWallets = chunk(wallets, 10000)

      await this.#produceChunks(topicId, chunkedWallets)
    }

    void testKafka()
  }

  #produceChunks = async (topicId: string, chunks: string[][]): Promise<void> => {
    const kafka = new Kafka({
      clientId: 'deanon-tool',
      brokers: ['localhost:9092']
    })

    const producer = kafka.producer()

    for (const chunk of chunks) {
      const messages = chunk.map((chunk) => ({
        value: chunk
      }))

      await producer.connect()
      await producer.send({
        topic: topicId,
        messages
      })
    }

    await producer.disconnect()
  }
}
