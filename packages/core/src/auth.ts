import jwt from 'jsonwebtoken';

export interface TokenPayload {
  /** Unique identifier for the AI company / bot operator. */
  botId: string;
  /** Remaining page credits on this token. */
  credits: number;
  /** Domains the token holder is authorised to access. */
  allowedDomains: string[];
  /** Unix timestamp (seconds) when the token expires. Set by the signer. */
  exp: number;
}

// jwt.sign() injects standard claims (iat, exp) alongside our payload.
// We intersect with jwt.JwtPayload so TypeScript knows about those fields
// when we decode.
type RawJwtPayload = TokenPayload & jwt.JwtPayload;

const ALGORITHM = 'HS256' as const;
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export class AuthService {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret || secret.trim().length === 0) {
      throw new Error('AuthService: secret must be a non-empty string');
    }
    this.secret = secret;
  }

  /**
   * Issue a signed JWT for a bot operator.
   *
   * @param botId   - Unique identifier for the AI company.
   * @param credits - Number of page credits granted.
   * @param domains - Domains the token is valid for.
   * @returns Signed HS256 JWT string, valid for 1 hour.
   */
  generateToken(botId: string, credits: number, domains: string[]): string {
    const payload: Omit<TokenPayload, 'exp'> = {
      botId,
      credits,
      allowedDomains: domains,
    };

    return jwt.sign(payload, this.secret, {
      algorithm: ALGORITHM,
      expiresIn: TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Verify and decode a JWT.
   *
   * @param token - The JWT string to verify.
   * @returns The decoded {@link TokenPayload} if valid, or `null` if the token
   *          is expired, has an invalid signature, or is malformed.
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [ALGORITHM],
      }) as RawJwtPayload;

      return {
        botId: decoded.botId,
        credits: decoded.credits,
        allowedDomains: decoded.allowedDomains,
        exp: decoded.exp as number,
      };
    } catch {
      // Covers: TokenExpiredError, JsonWebTokenError (bad sig, malformed), etc.
      return null;
    }
  }
}
