import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashOtpCode = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const verifyOtpCode = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
