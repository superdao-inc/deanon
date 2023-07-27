import { Injectable } from '@nestjs/common'
import { Pool } from 'pg'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class DbPool {
  pool: Pool

  constructor (
    private readonly config: ConfigService
  ) {
    const dbName = this.config.get<string>('DB_NAME')
    const dbUser = this.config.get<string>('DB_USER')
    const dbPassword = this.config.get<string>('DB_PASSWORD')
    const dbHost = this.config.get<string>('DB_HOST')
    const postgresConn = this.config.get<string>('POSTGRES_CONN')

    this.pool = new Pool({
      connectionString: postgresConn,
      host: dbHost,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      min: 5
    })
  }
}
