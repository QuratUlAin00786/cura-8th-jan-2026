import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { authService } from "../services/auth";

export interface TenantRequest extends Request {
  tenant?: {
    id: number;
    name: string;
    subdomain: string;
    region: string;
    settings: any;
  };
  organizationId?: number;
  user?: {
    id: number;
    email: string;
    role: string;
    organizationId: number;
  };
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    // CRITICAL: Skip tenant middleware for SaaS routes - they use separate authentication
    if (req.path.startsWith('/saas/')) {
      console.log(`[TENANT-MIDDLEWARE] ✅ Skipping SaaS route: ${req.path}`);
      return next();
    }
    
    if (req.path.startsWith("/forms/share/")) {
      console.log(`[TENANT-MIDDLEWARE] Skipping tenant lookup for share endpoint: ${req.path}`);
      return next();
    }
    console.log(`[TENANT-MIDDLEWARE] Processing request: ${req.method} ${req.path} ${req.url}`);
    
    // Skip tenant middleware for static assets and development files to prevent DB calls
    const skipPaths = [
      '/assets', '/@vite', '/src', '/node_modules', '/__vite_hmr',
      '/favicon.ico', '/robots.txt', '/sitemap.xml', '/.vite',
      '/public', '/client/public'
    ];
    
    if (skipPaths.some(path => req.path.startsWith(path))) {
      console.log(`[TENANT-MIDDLEWARE] Skipping static path: ${req.path}`);
      return next();
    }

    
    // Path is already stripped by Express mounting at /api, so we process all paths
    console.log(`[TENANT-MIDDLEWARE] Processing API path: ${req.path} (original URL: ${req.originalUrl})`);

    // Extract subdomain from: header (priority), query param (dev mode), or default to demo
    // DO NOT use hostname extraction in Replit environment as it extracts replit subdomain instead of tenant
    let subdomain = req.get("X-Tenant-Subdomain") || req.query.subdomain as string || "demo";
    console.log(`[TENANT-MIDDLEWARE] Detected subdomain: ${subdomain} from header/query`);
    
    let organization = await storage.getOrganizationBySubdomain(subdomain);
    
    // FORCE fallback organization for all environments
    if (!organization) {
      try {
        const { organizations } = await import("@shared/schema");
        const { db } = await import("../db");
        const orgs = await db.select({
          id: organizations.id,
          name: organizations.name,
          subdomain: organizations.subdomain,
          email: organizations.email,
          region: organizations.region,
          brandName: organizations.brandName,
          settings: organizations.settings,
          features: organizations.features,
          accessLevel: organizations.accessLevel,
          subscriptionStatus: organizations.subscriptionStatus,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        }).from(organizations).limit(1);
        organization = orgs[0];
        
        console.log(`FORCE USING fallback organization: ${organization?.name}`);
      } catch (error) {
        console.log("Error fetching fallback organization:", error);
      }
    }
    
    // FORCE create demo org if none exists
    if (!organization) {
      organization = {
        id: 1,
        name: "Halo Healthcare",
        email: "admin@demo.com",
        subdomain: "demo",
        region: "UK",
        brandName: "Cura",
        settings: {},
        features: {
          maxUsers: 50,
          maxPatients: 500,
          aiEnabled: true,
          telemedicineEnabled: true,
          billingEnabled: true,
          analyticsEnabled: true
        },
        accessLevel: "full",
        subscriptionStatus: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log("FORCE CREATED demo organization");
    }

    // Check subscription status (ensure organization exists)
    if (!organization) {
      return res.status(500).json({ error: "Failed to initialize organization" });
    }
    
    const subscription = await storage.getSubscription(organization.id);
    if (subscription && !["trial", "active"].includes(subscription.status)) {
      return res.status(403).json({ error: "Subscription inactive" });
    }

    req.tenant = {
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
      region: organization.region,
      settings: organization.settings || {}
    };
    req.organizationId = organization.id;

    console.log(`[TENANT-MIDDLEWARE] Set organizationId: ${req.organizationId} for path: ${req.path}`);
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function authMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    if (req.path.startsWith("/forms/share/")) {
      console.log(`[AUTH-MIDDLEWARE] Skipping auth for share endpoint: ${req.path}`);
      return next();
    }

    // Skip authentication for file view endpoints (handles their own token validation with FILE_SECRET)
    if (req.path.startsWith('/files/view/') || req.path.startsWith('files/view/') ||
        req.path.startsWith('/imaging-files/view/') || req.path.startsWith('imaging-files/view/') ||
        req.path.startsWith('/imaging/view-prescription/') || req.path.startsWith('imaging/view-prescription/')) {
      return next();
    }

    // Support both Authorization header and query parameter token (for iframe PDF viewing)
    let token = authService.extractTokenFromHeader(req.get("Authorization"));
    
    // If no header token, check query parameter (for iframe compatibility)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = authService.verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Ensure user belongs to the current tenant
    if (req.tenant && payload.organizationId !== req.tenant.id) {
      return res.status(403).json({ error: "Access denied for this organization" });
    }

    // Get user details
    const user = await storage.getUser(payload.userId, payload.organizationId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function requireRole(roles: string[]) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    console.log('[REQUIRE-ROLE] Checking permissions:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      userEmail: req.user?.email,
      requiredRoles: roles,
      hasPermission: req.user ? authService.hasPermission(req.user.role, roles) : false
    });

    if (!req.user) {
      console.log('[REQUIRE-ROLE] ❌ No user found - returning 401');
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!authService.hasPermission(req.user.role, roles)) {
      console.log('[REQUIRE-ROLE] ❌ Permission denied - User role:', req.user.role, 'Required roles:', roles);
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    console.log('[REQUIRE-ROLE] ✅ User is authorized (role:', req.user.role, ')');
    next();
  };
}

export function requireNonPatientRole() {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    console.log('[REQUIRE-NON-PATIENT] Checking permissions:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      userEmail: req.user?.email,
      isPatient: req.user?.role === "patient"
    });

    if (!req.user) {
      console.log('[REQUIRE-NON-PATIENT] ❌ No user found - returning 401');
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role === "patient") {
      console.log('[REQUIRE-NON-PATIENT] ❌ User is patient - returning 403');
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    console.log('[REQUIRE-NON-PATIENT] ✅ User is authorized (role:', req.user.role, ')');
    next();
  };
}

export function gdprComplianceMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return next();
  }

  const compliance = authService.checkGDPRCompliance(req.tenant.region);
  
  // Add GDPR headers
  if (compliance.gdprRequired) {
    res.set({
      "X-GDPR-Compliant": "true",
      "X-Data-Retention": compliance.retentionPeriod.toString(),
      "X-Data-Residency": compliance.dataResidencyRules.join(",")
    });
  }

  // Log data access for audit trail
  if (req.method !== "GET" && req.user) {
    console.log(`[AUDIT] ${req.user.email} ${req.method} ${req.path} - Tenant: ${req.tenant.subdomain}`);
  }

  next();
}

function extractSubdomainFromHost(host: string | undefined): string | null {
  if (!host) return null;
  
  const parts = host.split(".");
  if (parts.length > 2) {
    return parts[0];
  }
  
  return null;
}

export type ModulePermissionAction = 'view' | 'create' | 'edit' | 'delete';

export function requireModulePermission(moduleName: string, action: ModulePermissionAction) {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    console.log(`[REQUIRE-MODULE-PERMISSION] Checking ${action} permission for module ${moduleName}:`, {
      hasUser: !!req.user,
      userRole: req.user?.role,
      userEmail: req.user?.email
    });

    if (!req.user) {
      console.log('[REQUIRE-MODULE-PERMISSION] ❌ No user found - returning 401');
      return res.status(401).json({ error: "Authentication required" });
    }

    // Admin role has ALL permissions to ALL modules
    if (req.user.role === 'admin') {
      console.log('[REQUIRE-MODULE-PERMISSION] ✅ Admin user - full access granted');
      return next();
    }

    try {
      // Fetch role permissions from database
      const role = await storage.getRoleByName(req.user.role, req.user.organizationId);
      
      if (!role) {
        console.log(`[REQUIRE-MODULE-PERMISSION] ❌ Role ${req.user.role} not found`);
        return res.status(403).json({ error: "Role not found" });
      }

      const permissions = role.permissions as any;
      const modulePerms = permissions?.modules?.[moduleName];

      if (!modulePerms) {
        console.log(`[REQUIRE-MODULE-PERMISSION] ❌ No permissions defined for module ${moduleName}`);
        return res.status(403).json({ error: `No access to ${moduleName} module` });
      }

      const hasPermission = modulePerms[action] === true;

      if (!hasPermission) {
        console.log(`[REQUIRE-MODULE-PERMISSION] ❌ User lacks ${action} permission for ${moduleName}`);
        return res.status(403).json({ 
          error: `You do not have ${action} permission for ${moduleName}`,
          requiredPermission: { module: moduleName, action }
        });
      }

      console.log(`[REQUIRE-MODULE-PERMISSION] ✅ User has ${action} permission for ${moduleName}`);
      next();
    } catch (error) {
      console.error('[REQUIRE-MODULE-PERMISSION] Error checking permissions:', error);
      return res.status(500).json({ error: "Error checking permissions" });
    }
  };
}
