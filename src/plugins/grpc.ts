import fp from 'fastify-plugin';

import { GrpcServer } from '../transport/grpc/server.js';
import { UserRepository } from '../features/users/repository.js';
import { SessionRepository } from '../features/sessions/repository.js';
import { PasswordHasher } from '../infrastructure/crypto/password-hasher.js';
import { RegisterUseCase } from '../features/authentication/register.js';
import { LoginUseCase } from '../features/authentication/login.js';
import { LogoutUseCase } from '../features/authentication/logout.js';
import { LogoutAllUseCase } from '../features/authentication/logout-all.js';
import { AuthorizationRepository } from '../features/authorization/repository.js';
import { GetUseCase } from '../features/authorization/get-user.js';
import { CheckPermissionUseCase } from '../features/authorization/check-permission.js';
import { GetProfileUseCase } from '../features/users/get-profile.js';
import { UpdateProfileUseCase } from '../features/users/update-profile.js';
import { ChangePasswordUseCase } from '../features/authentication/change-password.js';
import { RequestPasswordResetUseCase } from '../features/authentication/request-password-reset.js';
import { RequestEmailChangeUseCase } from '../features/authentication/request-email-change.js';
import { ResetPasswordUseCase } from '../features/authentication/reset-password.js';
import { VerifyEmailChangeUseCase } from '../features/authentication/verify-email-change.js';
import { RedisTemporaryTokenStore } from '../infrastructure/redis/temporary-token-store.js';
import { MailtrapEmailProvider } from '../infrastructure/email/mailtrap-provider.js';
import { RefreshUseCase } from '../features/authentication/refresh.js';
import { OTPRepository } from '../infrastructure/redis/otp-repository.js';
import { VerifyEmailUseCase } from '../features/authentication/verify-email.js';
import { ResendOtpUseCase } from '../features/authentication/resend-otp.js';
import { LoginAttemptRepository } from '../infrastructure/redis/login-attempt-repository.js';

export default fp(async (fastify) => {
  const userRepository = new UserRepository(fastify.db);
  const authorizationRepository = new AuthorizationRepository(fastify.db);
  const sessionRepository = new SessionRepository(fastify.db, fastify.redis);
  const loginAttemptRepository = new LoginAttemptRepository(fastify.redis);
  const passwordHasher = new PasswordHasher();
  const otpRepository = new OTPRepository(fastify.redis);

  const emailProvider = new MailtrapEmailProvider({
    apiKey: fastify.config.MAILTRAP_API_KEY,
    fromEmail: fastify.config.MAILTRAP_FROM_EMAIL,
    fromName: fastify.config.MAILTRAP_FROM_NAME,
  });

  const registerUseCase = new RegisterUseCase(
    userRepository,
    passwordHasher,
    emailProvider,
    otpRepository,
  );

  const loginUseCase = new LoginUseCase(
    userRepository,
    passwordHasher,
    fastify.jwtSigner,
    sessionRepository,
    loginAttemptRepository,
    fastify.config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    fastify.config.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  );

  const refreshUseCase = new RefreshUseCase(
    userRepository,
    fastify.jwtSigner,
    sessionRepository,
    fastify.config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    fastify.config.AUTH_REFRESH_TOKEN_TTL_SECONDS,
  );

  const logoutUseCase = new LogoutUseCase(sessionRepository);
  const logoutAllUseCase = new LogoutAllUseCase(sessionRepository);
  const getProfileUseCase = new GetProfileUseCase(userRepository);
  const updateProfileUseCase = new UpdateProfileUseCase(userRepository);
  const changePasswordUseCase = new ChangePasswordUseCase(
    userRepository,
    passwordHasher,
    sessionRepository,
  );

  const temporaryTokenStore = new RedisTemporaryTokenStore(fastify.redis);

  const requestPasswordResetUseCase = new RequestPasswordResetUseCase(
    userRepository,
    temporaryTokenStore,
    emailProvider,
    fastify.config.PASSWORD_RESET_TOKEN_TTL_SECONDS,
    fastify.config.PASSWORD_RESET_URL,
  );

  const requestEmailChangeUseCase = new RequestEmailChangeUseCase(
    userRepository,
    temporaryTokenStore,
    emailProvider,
    fastify.config.EMAIL_CHANGE_TOKEN_TTL_SECONDS,
    fastify.config.EMAIL_CHANGE_URL,
  );

  const resetPasswordUseCase = new ResetPasswordUseCase(
    userRepository,
    passwordHasher,
    temporaryTokenStore,
    sessionRepository,
  );

  const getUserUseCase = new GetUseCase(userRepository);
  const checkPermissionUseCase = new CheckPermissionUseCase(authorizationRepository);
  const verifyEmailChangeUseCase = new VerifyEmailChangeUseCase(
    userRepository,
    temporaryTokenStore,
  );

  const verifyEmailUseCase = new VerifyEmailUseCase(userRepository, otpRepository);
  const resendOtpUseCase = new ResendOtpUseCase(userRepository, emailProvider, otpRepository);

  const grpcServer = new GrpcServer({
    config: fastify.config,
    registerUseCase,
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
    logoutAllUseCase,
    getProfileUseCase,
    updateProfileUseCase,
    changePasswordUseCase,
    requestPasswordResetUseCase,
    requestEmailChangeUseCase,
    resetPasswordUseCase,
    getUserUseCase,
    checkPermissionUseCase,
    verifyEmailChangeUseCase,
    verifyEmailUseCase,
    resendOtpUseCase,
  });

  fastify.decorate('grpcServer', grpcServer);

  fastify.addHook('onClose', async () => {
    await grpcServer.stop();
  });
});
