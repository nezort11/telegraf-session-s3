import S3LocalStorage from "s3-localstorage";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Context, MiddlewareFn, MiddlewareObj } from "telegraf";

const SESSION_CONTEXT_PROPERTY = "session";

const getSessionKey = (ctx: Context) => {
  if (ctx.from && ctx.chat) {
    return `${ctx.from.id}:${ctx.chat.id}`;
  }
};

const sessionSerializer = (session: object) => {
  return JSON.stringify(session);
};

interface S3SessionOpts {
  contextProperty: string;
  getSessionKey?: typeof getSessionKey;
  sessionSerializer?: typeof sessionSerializer;
  clientOpts?: S3ClientConfig;
}

export class S3Session<TContext extends Context>
  implements MiddlewareObj<TContext>
{
  private s3Storage: S3LocalStorage;
  private contextSessionProperty: string;
  private getSessionKey: typeof getSessionKey;
  private sessionSerializer: typeof sessionSerializer;

  constructor(bucketName: string, opts?: S3SessionOpts) {
    this.s3Storage = new S3LocalStorage(bucketName, opts?.clientOpts);
    this.contextSessionProperty =
      opts?.contextProperty ?? SESSION_CONTEXT_PROPERTY;
    this.getSessionKey = opts?.getSessionKey ?? getSessionKey;
    this.sessionSerializer = opts?.sessionSerializer ?? sessionSerializer;
  }

  async getSession(key: string): Promise<any> {
    return this.s3Storage.getItem(key);
  }

  async clearSession(key: string): Promise<void> {
    await this.s3Storage.removeItem(key);
  }

  async saveSession(key: string, session: object): Promise<void> {
    // if changes session to null or etc. then clear the session
    if (!session || Object.keys(session).length === 0) {
      await this.clearSession(key);
    } else {
      const serializedSession = this.sessionSerializer(session);
      await this.s3Storage.setItem(key, serializedSession);
    }
  }

  middleware(): MiddlewareFn<TContext> {
    return async (ctx, next) => {
      const sessionKey = this.getSessionKey(ctx);
      if (!sessionKey) {
        return next();
      }

      const session = await this.getSession(sessionKey);
      // define session provider
      Object.defineProperty(ctx, this.contextSessionProperty, {
        get: () => session,
        set: (newSession) => {
          // shallow copy new session
          Object.assign(session, newSession);
        },
      });
      await next();

      await this.saveSession(sessionKey, session);
    };
  }
}
