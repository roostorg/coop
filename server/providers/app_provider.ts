import AppServiceProvider from '@adonisjs/core/providers/app_provider';

/**
 * AdonisJS' app provider without its `ready()` hook. Outside production
 * (`NODE_ENV` is unset in the image), that hook writes
 * `.adonisjs/server/routes.{d.ts,json}` into the app root on every boot, for
 * the assembler dev server, which Coop doesn't use. Writing there fails on a
 * read-only root filesystem and dirties the checkout during tests.
 */
export default class CoopAppServiceProvider extends AppServiceProvider {
  override async ready() {}
}
