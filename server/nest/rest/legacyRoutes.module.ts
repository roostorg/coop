import path from 'path';
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import express, { type Express } from 'express';

import { type Dependencies } from '../../iocContainer/index.js';
import controllers from '../../routes/index.js';
import { createBodySchemaValidator } from '../../utils/bodySchemaValidation.js';
import { InjectDeps } from '../tokens.js';

/**
 * Serves the REST controllers that are not Nest controllers yet as an Express
 * router under /api/v1. Nest calls onModuleInit after mapping its own routes
 * and before adding its not-found and error handlers, so these routes sit in
 * between and their errors reach CoopExceptionFilter.
 */
@Module({})
export class LegacyRoutesModule implements OnModuleInit {
  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
    @InjectDeps() private readonly deps: Dependencies,
  ) {}

  onModuleInit() {
    const router = express.Router();
    Object.values(controllers).forEach((controller) => {
      controller.routes.forEach((it) => {
        const handler = it.handler(this.deps);
        const handlers = Array.isArray(handler) ? handler : [handler];
        const middlewares = it.bodySchema
          ? [createBodySchemaValidator(it.bodySchema), ...handlers]
          : handlers;
        router[it.method](
          path.posix.join(controller.pathPrefix, it.path),
          ...middlewares,
        );
      });
    });
    this.adapterHost.httpAdapter.getInstance<Express>().use('/api/v1', router);
  }
}
