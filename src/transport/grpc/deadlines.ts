import * as grpc from '@grpc/grpc-js';

export function remainingDeadlineMs(deadline: grpc.Deadline): number {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : Number(deadline);

  return Math.max(0, deadlineMs - Date.now());
}
