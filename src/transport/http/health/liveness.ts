export async function liveness() {
  return {
    status: 'ok',
    service: 'auth-service',
  };
}
