import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { type Response } from 'express';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  submitItemsInputSchema,
  type SubmitItemsInput,
} from '../../routes/items/ItemRoutes.js';
import { InjectDep } from '../tokens.js';
import { ApiKeyGuard, BodySchemaGuard, OrgId } from './guards.js';
import { ItemsService } from './itemsService.js';

@Controller('items')
export class ItemsController {
  constructor(
    @Inject(ItemsService) private readonly items: ItemsService,
    @InjectDep('Tracer') private readonly tracer: Dependencies['Tracer'],
  ) {}

  // Nest matches routes without a trailing slash too, like Express did for
  // the old `/async/` path.
  @Post('async')
  @UseGuards(BodySchemaGuard(submitItemsInputSchema), ApiKeyGuard)
  async submit(
    @OrgId() orgId: string,
    @Body() body: SubmitItemsInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { status, processInline } = await this.items.submitItems(orgId, body);
    res.status(status);
    if (processInline) {
      // Runs after the 202 is sent; failures are recorded, not returned.
      res.once('finish', () => {
        processInline().catch((e: unknown) =>
          this.tracer.logActiveSpanFailedIfAny(e),
        );
      });
    }
  }
}
