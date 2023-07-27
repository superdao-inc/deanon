import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import express from 'express'
import { Observable } from 'rxjs'

@Injectable()
export class PromGuard implements CanActivate {
  constructor (private readonly configService: ConfigService) {}

  canActivate (context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<express.Request>()
    const port = request.socket.localPort

    return port === this.configService.get<number>('metrics.port')
  }
}
