import dotenv from 'dotenv'
import assert from 'node:assert'
import http from 'node:http'
import express from 'express'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { ExpressAdapter } from '@nestjs/platform-express'
import { CustomLogger } from '@dev/nestjs-common'

import { AppModule } from './app.module'
import { config } from './config/common'

dotenv.config()

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string
    }
  }
}

async function bootstrap (): Promise<void> {
  const logger = new CustomLogger('App', config.env.isDev)
  logger.level = config.env.logLevel

  const server = express()
  const adapter = new ExpressAdapter(server)

  const app = await NestFactory.create(AppModule, adapter, { logger })
  app.enableShutdownHooks(['SIGINT', 'SIGTERM'])

  const configService = app.get(ConfigService)
  const env = configService.getOrThrow<string>('appEnv')
  const isDev = configService.getOrThrow<boolean>('env.isDev')
  const isProd = configService.getOrThrow<boolean>('env.isProd')
  const port = configService.get<string>('app.port')
  assert(env && port)

  logger.log(`Starting server in ${env} mode`)

  await app.listen(port)

  if (isDev) {
    const logger = app.get(CustomLogger)
    logger.log(`Server listening at http://localhost:${port}`)
  }

  if (isProd) {
    http.createServer(server).listen(configService.get<number>('metrics.port'))
    logger.log(`Metrics on http://localhost:${configService.getOrThrow<number>('metrics.port')}`)
  }
}
void bootstrap()
