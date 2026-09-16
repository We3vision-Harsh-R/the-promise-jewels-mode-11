import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => {
  return bcrypt.compare(password, hashedPassword);
};

export const hashValue = async (value: string) => {
  return bcrypt.hash(value, env.BCRYPT_SALT_ROUNDS);
};