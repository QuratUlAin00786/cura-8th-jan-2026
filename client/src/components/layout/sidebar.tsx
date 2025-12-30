import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Brain,
  CreditCard,
  UserCog,
  Settings,
  Heart,
  Crown,
  FileText,
  Pill,
  FlaskConical,
  Stethoscope,
  FileImage,
  Receipt,
  BarChart3,
  Zap,
  Globe,
  MessageSquare,
  Link as LinkIcon,
  Video,
  Smartphone,
  Mic,
  Calculator,
  Package,
  Menu,
  X,
  Shield,
  Bot,
  Activity,
  Thermometer,
  BookOpen,
  PoundSterling,
} from "lucide-react";
import { useTenant } from "@/hooks/use-tenant";
import { getActiveSubdomain } from "@/lib/subdomain-utils";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions, UserRole } from "@/hooks/use-role-permissions";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarContent, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@/types";

const ALL_NAVIGATION = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" },
  { name: "Patients", href: "/patients", icon: Users, module: "patients" },
  {
    name: "Appointments",
    href: "/appointments",
    icon: Calendar,
    module: "appointments",
  },
  {
    name: "Prescriptions",
    href: "/prescriptions",
    icon: Pill,
    module: "prescriptions",
  },
  {
    name: "Lab Results",
    href: "/lab-results",
    icon: FlaskConical,
    module: "lab_results",
  },
  {
    name: "Imaging",
    href: "/imaging",
    icon: FileImage,
    module: "medical_imaging",
  },
  { name: "Forms", href: "/forms", icon: FileText, module: "forms" },
  {
    name: "Messaging",
    href: "/messaging",
    icon: MessageSquare,
    module: "messaging",
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    module: "analytics",
  },
  { name: "Automation", href: "/automation", icon: Zap, module: "automation" },
  {
    name: "Patient Portal",
    href: "/patient-portal",
    icon: Globe,
    module: "patient_portal",
  },
  {
    name: "Clinical Decision Support",
    href: "/clinical-decision-support",
    icon: Brain,
    module: "ai_insights",
  },
  {
    name: "Symptom Checker",
    href: "/symptom-checker",
    icon: Thermometer,
    module: "ai_insights",
  },
  {
    name: "Telemedicine",
    href: "/telemedicine",
    icon: Video,
    module: "telemedicine",
  },
  {
    name: "Voice Documentation",
    href: "/voice-documentation",
    icon: Mic,
    module: "voice_documentation",
  },
  {
    name: "Financial Intelligence",
    href: "/financial-intelligence",
    icon: Calculator,
    module: "billing",
  },
  { name: "Billing", href: "/billing", icon: PoundSterling, module: "billing" },
  {
    name: "QuickBooks",
    href: "/quickbooks",
    icon: Calculator,
    module: "billing",
  },
  { name: "Inventory", href: "/inventory", icon: Package, module: "inventory" },
];

const ADMIN_NAVIGATION = [
  {
    name: "User Management",
    href: "/users",
    icon: UserCog,
    module: "user_management",
  },
  {
    name: "Shift Management",
    href: "/shifts",
    icon: Calendar,
    module: "shift_management",
  },
  {
    name: "Subscription/Packages",
    href: "/subscription",
    icon: Crown,
    module: "subscription",
  },
  { name: "Settings", href: "/settings", icon: Settings, module: "settings" },
  { name: "User Manual", href: "/user-manual", icon: BookOpen, module: "settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { tenant } = useTenant();
  const { user, logout } = useAuth();
  const { canAccess, getUserRole, isLoading } = useRolePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Fetch organization data with React Query to automatically update when settings change
  const { data: organizationData } = useQuery<Organization>({
    queryKey: ["/api/tenant/info"],
    queryFn: async () => {
      const response = await fetch('/api/tenant/info', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    retry: false,
  });

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Filter navigation based on user role permissions
  const currentRole = getUserRole();

  // Items to hide from Patient role users
  const patientHiddenItems = [
    "Financial Intelligence",
    "QuickBooks",
  ];

  // Items to show ONLY to Patient role users (hide from all other roles)
  const patientOnlyItems = ["Patient Portal"];

  // Items to hide from all users
  const hiddenItems = ["Automation"];

  const roleSpecificHidden: Record<UserRole, string[]> = {
    doctor: ["User Management", "Subscription/Packages", "Settings", "User Manual"],
    nurse: ["User Management", "Subscription/Packages", "Settings", "User Manual"],
    patient: ["Shift Management", "User Management", "Subscription/Packages", "Settings", "User Manual"],
  };

  const restrictedRoleModules = new Set([
    "Dashboard",
    "Patients",
    "Appointments",
    "Prescriptions",
    "Lab Results",
    "Imaging",
    "Forms",
    "Messaging",
    "Analytics",
    "Patient Portal",
    "Clinical Decision Support",
    "Symptom Checker",
    "Telemedicine",
    "Voice Documentation",
    "Billing",
    "Inventory",
  ]);

  const filteredNavigation = ALL_NAVIGATION.filter((item) => {
    // Hide specific items from all users
    if (hiddenItems.includes(item.name)) {
      return false;
    }

    // While permissions are loading, show all items (except role-specific restrictions)
    // This prevents the sidebar from being empty while fetching permissions from database
    if (!isLoading) {
      // First check role permissions from database
      if (!canAccess(item.module)) return false;
    }

    // Ensure certain modules honor DB permissions for doctor/nurse/patient roles even while loading
    if (
      (currentRole === "doctor" ||
        currentRole === "nurse" ||
        currentRole === "patient") &&
      restrictedRoleModules.has(item.name)
    ) {
      if (isLoading) {
        return false;
      }
      if (!canAccess(item.module)) {
        return false;
      }
    }

    // Hide specific items from Patient role users
    if (currentRole === "patient" && patientHiddenItems.includes(item.name)) {
      return false;
    }

    // Show patient-only items ONLY to patients (hide from admin, doctor, nurse, etc.)
    if (currentRole !== "patient" && patientOnlyItems.includes(item.name)) {
      return false;
    }

    // Role-specific navigation restrictions
    if (currentRole && roleSpecificHidden[currentRole] && roleSpecificHidden[currentRole].includes(item.name)) {
      return false;
    }

    return true;
  });

  const filteredAdminNavigation = ADMIN_NAVIGATION.filter((item) => {
    // Role-specific navigation restrictions
    if (currentRole && roleSpecificHidden[currentRole] && roleSpecificHidden[currentRole].includes(item.name)) {
      return false;
    }

    // While permissions are loading, show items (will be filtered after load)
    if (!isLoading) {
      return canAccess(item.module);
    }
    return true;
  });

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMobileMenu}
            className="bg-white shadow-lg"
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white dark:bg-card shadow-lg flex flex-col h-screen transition-transform duration-300 ease-in-out",
          // Desktop
          "lg:w-64 lg:relative lg:translate-x-0 lg:z-30",
          // Mobile
          "fixed w-64 lg:w-64 z-50",
          isMobile && !isMobileMenuOpen && "-translate-x-full",
          isMobile && isMobileMenuOpen && "translate-x-0",
        )}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-neutral-100 dark:border-border">
          <div className="flex flex-col items-center text-center">
            <img
              src={organizationData?.settings?.theme?.logoUrl || tenant?.settings?.theme?.logoUrl || "/cura-logo-chatbot.png"}
              alt={organizationData?.name || tenant?.name || "Cura"}
              className="h-30 w-auto mb-2"
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="sidebar-nav">
            {filteredNavigation.map((item) => {
              // Prefix href with subdomain - use tenant subdomain or fallback to active subdomain from URL
              const subdomain = tenant?.subdomain || getActiveSubdomain();
              const prefixedHref = `/${subdomain}${item.href}`;
              const isActive =
                location === prefixedHref || location === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={prefixedHref}
                  className={cn("sidebar-nav-item", isActive && "active")}
                  onClick={isMobile ? closeMobileMenu : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Admin Section */}
          {filteredAdminNavigation.length > 0 && (
            <>
              <div className="pt-4 mt-4">
                <Separator />
              </div>
              <div className="pt-4">
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 px-3">
                  ADMINISTRATION
                </p>
                <div className="sidebar-nav">
                  {filteredAdminNavigation.map((item) => {
                    // Prefix href with subdomain - use tenant subdomain or fallback to active subdomain from URL
                    const subdomain = tenant?.subdomain || getActiveSubdomain();
                    const prefixedHref = `/${subdomain}${item.href}`;
                    const isActive =
                      location === prefixedHref || location === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={prefixedHref}
                        className={cn("sidebar-nav-item", isActive && "active")}
                        onClick={isMobile ? closeMobileMenu : undefined}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-neutral-100 dark:border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-neutral-500 dark:text-muted-foreground uppercase tracking-wide">
              Theme
            </span>
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg p-2 -m-2 transition-colors">
                <Avatar>
                  <AvatarContent
                    className="text-white font-semibold"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {user ? getInitials(user.firstName, user.lastName) : "U"}
                  </AvatarContent>
                  <AvatarFallback>
                    {user ? getInitials(user.firstName, user.lastName) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">
                    {user
                      ? `${user.firstName} ${user.lastName}`
                      : "Unknown User"}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-muted-foreground truncate">
                    {user?.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : "User"}
                  </p>
                </div>
                <SettingsIcon className="h-4 w-4 text-neutral-600" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user
                      ? `${user.firstName} ${user.lastName}`
                      : "Unknown User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "user@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`/${tenant?.subdomain || getActiveSubdomain()}/settings`}
                  className="flex items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/${tenant?.subdomain || getActiveSubdomain()}/account-settings`}
                  className="flex items-center"
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  window.location.href = "/auth/login";
                }}
                className="text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
