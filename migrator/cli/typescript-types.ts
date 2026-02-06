import {
  type MigrationParams,
  type RunnableMigration,
  type UmzugStorage,
} from 'umzug';

export type Bind1<
  F extends (arg0: A0, ...args: never[]) => unknown,
  A0,
> = F extends (arg0: A0, ...args: infer Args) => infer R
  ? (...args: Args) => R
  : never;

/**
 * Every database for which we want to support migrations must provide a config
 * object for itself that satisfies this type.
 *
 * NB: file extensions in the options below should be given with no leading dot.
 *
 * NB: "scripts" refers collectively to migrations or seed files.
 */
export type DatabaseConfig<
  SupportedScriptFormat extends string = string,
  ContextType = unknown,
  StorageType extends UmzugStorage = UmzugStorage,
> = {
  /**
   * The file type (i.e., extension) to use for a new script when a file type
   * isn't specified explicitly.
   */
  readonly defaultScriptFormat: SupportedScriptFormat;

  /**
   * A list of supported file extensions for this db's scripts (no leading dot).
   */
  readonly supportedScriptFormats: readonly SupportedScriptFormat[];

  /**
   * The directory in which the migrator will look for this db's scripts and
   * into which it'll create new scripts.
   */
  readonly scriptsDirectory: string;

  /**
   * Which environments does this db support?
   */
  readonly supportedEnvironments: readonly string[];

  /**
   * A reference to the database client/connection that is passed to the Umzug
   * storage object. Used in the case of a custom UmzugStorage implementation
   * to ensure we close all connections to the database.
   */
  storageDbClient?: unknown;

  /**
   * Creates this db to with an initial state and then closes any open
   * connections/resources.
   */
  prepareDbAndDisconnect(): Promise<void>;

  /**
   * Deletes this db and then closes any open connections/resources.
   */
  dropDbAndDisconnect(): Promise<void>;

  /**
   * Returns an object capable of recording that a script has been run, listing
   * the scripts that have run, and removing the record of a script (if it's
   * rolled back).
   */
  createStorage(): UmzugStorage<ContextType>;

  /**
   * Takes the name and path of a script and turns it into a runnable object
   * that has an `up` and (optionally) `down` method. `up` and `down` will be
   * called with the context object (see below) and should actually update the
   * database.
   */
  resolveScript(
    params: MigrationParams<ContextType> & { path: string },
  ): RunnableMigration<ContextType>;

  /**
   * Returns a "context" object, which is simply an object that'll be passed to
   * all scripts. Often this context object is an instance of the db driver
   * connected to the database.
   */
  createContext(): ContextType | Promise<ContextType>;

  /**
   * A function that destroys the context object and cleans up associated
   * resources. This is called after all the migrations have been run with the
   * context. If the context has an open db connection, that connection should
   * be closed so the process can exit.
   */
  destroyContext(context: ContextType): Promise<void>;

  /**
   * A function that destroys the storage object and cleans up associated
   * resources. This is called after all the migrations have been run with the
   * storage. If the storage has an open db connection, that connection should
   * be closed so the process can exit.
   */
  destroyStorage?(context: StorageType): Promise<void>;

  /**
   * Given the path of the new script file that is being created, returns a
   * string that will be that file's initial contents. This template can include
   * helper/boilerplate code, like common imports.
   */
  getTemplate?(filePath: string): string;
};
