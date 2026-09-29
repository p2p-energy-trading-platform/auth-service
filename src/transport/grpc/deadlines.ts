import type { HandlerContext } from '@connectrpc/connect';

export function remainingDeadlineMs(context: HandlerContext): number | undefined {
  return context.timeoutMs();
}
