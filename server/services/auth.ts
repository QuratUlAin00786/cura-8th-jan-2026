import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { User } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "cura-jwt-secret-2025-9f8e7d6c5b4a3e2f1a9b8c7d6e5f4a3b2c1d0e9f8g7h6i5j4k3l2m1n0o9p8q7r6s5t4u3v2w1x0y9z8";
const SALT_ROUNDS = 12;

export interface AuthTokenPayload {
  userId: number;
  organizationId: number;
  email: string;
  role: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: "7d", // Extended to 7 days for development
      issuer: "medicore-emr",
      audience: "medicore-users"
    });
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET, {
        issuer: "medicore-emr",
        audience: "medicore-users"
      }) as AuthTokenPayload;
      
      return payload;
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  }

  hasPermission(userRole: string, requiredRoles: string[]): boolean {
    if (userRole === "patient") {
      return true;
    }
    return requiredRoles.includes(userRole);
  }

  checkGDPRCompliance(organizationRegion: string): {
    gdprRequired: boolean;
    dataResidencyRules: string[];
    retentionPeriod: number; // in days
  } {
    switch (organizationRegion) {
      case "UK":
      case "EU":
        return {
          gdprRequired: true,
          dataResidencyRules: ["EU_ONLY", "ENCRYPTION_REQUIRED", "AUDIT_TRAIL"],
          retentionPeriod: 2555 // 7 years for medical records
        };
      case "ME":
      case "SA":
        return {
          gdprRequired: false,
          dataResidencyRules: ["REGIONAL_STORAGE", "ENCRYPTION_REQUIRED"],
          retentionPeriod: 3650 // 10 years
        };
      case "US":
        return {
          gdprRequired: false,
          dataResidencyRules: ["HIPAA_COMPLIANCE", "ENCRYPTION_REQUIRED"],
          retentionPeriod: 2555 // 7 years
        };
      default:
        return {
          gdprRequired: true,
          dataResidencyRules: ["ENCRYPTION_REQUIRED"],
          retentionPeriod: 2555
        };
    }
  }
}

export const authService = new AuthService();
