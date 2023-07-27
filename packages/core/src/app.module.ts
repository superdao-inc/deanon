import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule, TracerModule } from '@dev/nestjs-common'
import { PrometheusModule } from '@willsoto/nestjs-prometheus'

import { config } from './config/common'
import { AppController } from './app.controller'
import { PipelineModule } from 'src/service/deanon/pipeline/pipeline.module'
import { DeanonModule } from 'src/service/deanon.module'
import { PrometheusController } from 'src/prom/prom.controller'
import { DbModule } from 'src/db/db.module'
import { TwitterModule } from 'src/services/externalServices/twitter.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => config]
    }),
    TracerModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const mode = configService.get<string>('env.NODE_ENV')
        const level = configService.get<string>('env.LOG_LEVEL')

        return { pretty: mode !== 'production', level }
      },
      inject: [ConfigService]
    }),
    TwitterModule,
    DbModule,
    PipelineModule,
    DeanonModule,
    PrometheusModule.register({
      controller: PrometheusController,
      defaultMetrics: {
        enabled: false
      }
    })
  ],
  controllers: [AppController]
})
export class AppModule {}
