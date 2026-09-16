import jwt, { Secret, SignOptions, VerifyOptions } from "jsonwebtoken";

import { jwtConfig } from "../config/jwt.js";
import { JwtPayload } from "../modules/auth/auth.types.js";

/**
 * Token signing and verification.
 *
 * `jwt.verify` was called with only a secret. That leaves the ALGORITHM up to
 * the token being verified, which is the classic JWT weakness: a library that
 * accepts whatever the header asks for will happily validate a token the
 * attacker chose the algorithm of. jsonwebtoken v9 already refuses `alg:none`
 * and will not verify an RS256 token against an HMAC secret, so this codebase
 * was not exploitable — but the guarantee then rests on a library default
 * rather than on anything stated here, and it is one dependency bump from
 * changing. Pinning it makes the requirement explicit and permanent.
 *
 * Issuer and audience are set and checked too. On their own they are not a
 * security boundary, but they stop a token minted for something else that
 * happens to share the secret from being accepted here.
 */
const ALGORITHM = "HS256" as const;
const ISSUER = "promise-jewels-api";
const ACCESS_AUDIENCE = "promise-jewels-access";
const REFRESH_AUDIENCE = "promise-jewels-refresh";

function signOptions(expiresIn: string, audience: string): SignOptions {
  return {
    algorithm: ALGORITHM,
    expiresIn,
    issuer: ISSUER,
    audience,
  } as SignOptions;
}

function verifyOptions(audience: string): VerifyOptions {
  return {
    // An array of exactly one: anything presenting a different `alg` is
    // rejected before the signature is even considered.
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience,
  };
}

export const generateAccessToken = (userId: string): string =>
  jwt.sign(
    { userId },
    jwtConfig.accessSecret as Secret,
    signOptions(jwtConfig.accessExpiresIn, ACCESS_AUDIENCE),
  );

export const generateRefreshToken = (userId: string): string =>
  jwt.sign(
    { userId },
    jwtConfig.refreshSecret as Secret,
    signOptions(jwtConfig.refreshExpiresIn, REFRESH_AUDIENCE),
  );

export const verifyAccessToken = (token: string) =>
  jwt.verify(
    token,
    jwtConfig.accessSecret,
    verifyOptions(ACCESS_AUDIENCE),
  ) as JwtPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(
    token,
    jwtConfig.refreshSecret,
    verifyOptions(REFRESH_AUDIENCE),
  ) as JwtPayload;
