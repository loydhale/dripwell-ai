import { destroySession } from '@/lib/auth';
import { apiRoute, json } from '@/lib/http';

export const POST = apiRoute(async () => { await destroySession(); return json({ ok: true }); }, { mutation: true });
