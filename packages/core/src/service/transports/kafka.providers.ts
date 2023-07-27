import { ConfigService } from '@nestjs/config'
import { Kafka } from 'kafkajs'

export const KafkaClient = Symbol('KafkaClient')

const SASL_MECHANISM = 'scram-sha-256'

export const KafkaClientProvider = {
  provide: KafkaClient,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const ssl = configService.getOrThrow<boolean>('env.isDev')
      ? undefined
      : {
          rejectUnauthorized: false
        }
    const sasl = configService.getOrThrow<boolean>('env.isDev')
      ? undefined
      : {
          mechanism: SASL_MECHANISM as any,
          username: configService.getOrThrow<string>('kafka.username'),
          password: configService.getOrThrow<string>('kafka.password')
        }

    return new Kafka({
      clientId: 'deanon-tool',
      brokers: [`${configService.getOrThrow<string>('kafka.host')}:${configService.getOrThrow<string>('kafka.port')}`],
      ssl,
      sasl
    })
  }
}
