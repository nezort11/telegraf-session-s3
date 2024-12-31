import S3LocalStorage from "s3-localstorage";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Context, MiddlewareFn, MiddlewareObj } from "telegraf";

const SESSION_CONTEXT_PROPERTY = "session" as const;

type SessionKeyFn = (ctx: Context) => string | undefined;
type SerializerFn = (session: object) => string;
type DeserializerFn = (session: string) => any;

const SESSION_CONTENT_TYPE = "application/json" as const;

const defaultGetSessionKey: SessionKeyFn = (ctx) =>
  ctx.from && ctx.chat ? `${ctx.from.id}:${ctx.chat.id}` : undefined;

const defaultSerializer: SerializerFn = (session) =>
  JSON.stringify(session);
const defaultDeserializer: DeserializerFn = (session) =>
  JSON.parse(session);

interface S3SessionOpts {
  contextProperty: string;
  getSessionKey?: SessionKeyFn;
  sessionSerializer?: SerializerFn;
  sessionDeserializer?: DeserializerFn;
  sessionContentType?: string;
  clientOpts?: S3ClientConfig;
}

export class S3Session<TContext extends Context>
  implements MiddlewareObj<TContext>
{
  private s3Storage: S3LocalStorage;
  private contextSessionProperty: string;
  private getSessionKey: SessionKeyFn;
  private sessionSerializer: SerializerFn;
  private sessionDeserializer: DeserializerFn;
  private sessionContentType: string;

  constructor(bucketName: string, opts?: S3SessionOpts) {
    const {
      contextProperty = SESSION_CONTEXT_PROPERTY,
      getSessionKey = defaultGetSessionKey,
      sessionSerializer = defaultSerializer,
      sessionDeserializer = defaultDeserializer,
      sessionContentType = SESSION_CONTENT_TYPE,
      clientOpts,
    } = opts ?? {};
    this.s3Storage = new S3LocalStorage(bucketName, clientOpts);
    this.contextSessionProperty = contextProperty;
    this.getSessionKey = getSessionKey;
    this.sessionSerializer = sessionSerializer;
    this.sessionDeserializer = sessionDeserializer;
    this.sessionContentType = sessionContentType;
  }

  async getSession(key: string) {
    const data = await this.s3Storage.getItem(key);
    return data ? this.sessionDeserializer(data) : undefined;
  }

  async deleteSession(key: string): Promise<void> {
    await this.s3Storage.removeItem(key);
  }

  async saveSession(key: string, session: object) {
    // don't store null/undefined/NaN/0 or empty object {} in storage
    if (!session || Object.keys(session).length === 0) {
      await this.deleteSession(key);
    } else {
      const serializedSession = this.sessionSerializer(session);
      await this.s3Storage.setItem(key, serializedSession, {
        ContentType: this.sessionContentType,
      });
    }
  }

  middleware(): MiddlewareFn<TContext> {
    return async (ctx, next) => {
      const sessionKey = this.getSessionKey(ctx);
      if (!sessionKey) {
        return next();
      }

      let session = await this.getSession(sessionKey);
      // define session provider
      Object.defineProperty(ctx, this.contextSessionProperty, {
        get: () => session,
        set: (newSession) => {
          session = newSession;
        },
      });
      await next();

      // can't efficiently check whether session was modified, so always re-save
      await this.saveSession(sessionKey, session);
    };
  }
}
