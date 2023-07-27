import { Module } from '@nestjs/common'
import { DbPool } from 'src/db/db.pool'

@Module({
  providers: [DbPool],
  exports: [DbPool]
})
export class DbModule {}
