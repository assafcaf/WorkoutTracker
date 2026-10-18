import type { PushSubscriptionRequest } from '../../contract'
import type { D1Database } from '../d1'
import type { Env } from '../env'

export async function subscribe(_db: D1Database, _user: string, _request: PushSubscriptionRequest): Promise<void> {}

export async function unsubscribe(_db: D1Database, _user: string, _endpoint: string): Promise<void> {}

export async function pushToUser(
  _env: Env,
  _user: string,
  _message: unknown,
  _options: { fetch?: typeof fetch } = {},
): Promise<void> {}
