import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Calendar, Brain, CreditCard, Settings, UserCog, Crown, BarChart3, Plus, UserPlus, ClipboardPlus, Pill, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AppointmentCalendar from "../calendar/appointment-calendar";
import { AiInsightsPanel } from "../dashboard/ai-insights-panel";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Helper function to get the correct tenant subdomain
function getTenantSubdomain(): string {
  // PRIORITY 1: Check for user's stored subdomain (from their organization)
  const storedSubdomain = localStorage.getItem('user_subdomain');
  if (storedSubdomain) {
    return storedSubdomain;
  }
  
  // PRIORITY 2: Check for subdomain query parameter (for development)
  const urlParams = new URLSearchParams(window.location.search);
  const subdomainParam = urlParams.get('subdomain');
  if (subdomainParam) {
    return subdomainParam;
  }
  
  const hostname = window.location.hostname;
  
  // PRIORITY 3: For development/replit environments, use 'demo'
  if (hostname.includes('.replit.app') || hostname.includes('localhost') || hostname.includes('replit.dev') || hostname.includes('127.0.0.1')) {
    return 'demo';
  }
  
  // PRIORITY 4: For production environments, extract subdomain from hostname
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0] || 'demo';
  }
  
  // PRIORITY 5: Fallback to 'demo'
  return 'demo';
}

// Recent Patients List Component
function RecentPatientsList() {
  const [patients, setPatients] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchPatients() {
      try {
        setIsLoading(true);
        setError(null);
        
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'X-Tenant-Subdomain': getTenantSubdomain(),
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/patients', {
          headers,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch patients: ${response.status}`);
        }
        
        const data = await response.json();
        setPatients(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patients');
        setPatients([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPatients();
  }, []);

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Loading patients...</div>;
  }

  if (error || patients.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
      No recent patients available
    </div>;
  }

  // Get the 5 most recent patients (sorted by creation date)
  const recentPatients = patients
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {recentPatients.map((patient: any) => (
        <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
          <div className="flex-1">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Patient ID: {patient.patientId || patient.id}
            </div>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : "Recent"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const rolesQuery = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/roles");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const roles = rolesQuery.data ?? [];

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      await apiRequest("DELETE", `/api/roles/${roleId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role deleted",
        description: "Role removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  const handleDeleteRole = (roleId: number, displayName: string) => {
    if (user?.role !== "admin") {
      toast({
        title: "Permission denied",
        description: "Only admins can delete roles.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm(`Delete "${displayName}"? This cannot be undone.`)) {
      return;
    }

    deleteRoleMutation.mutate(roleId);
  };
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain()
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          ...headers,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    retry: false,
    staleTime: 0,
  });

  // Fetch all patients from the patients table to get total count
  const { data: allPatients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients/all"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain()
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fetch all patients without isActive filter
      const response = await fetch('/api/patients', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    retry: false,
    staleTime: 0,
  });

  // Fetch active patients from the patients table to get active count
  const { data: activePatients, isLoading: activePatientsLoading } = useQuery({
    queryKey: ["/api/patients/active"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain()
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fetch only active patients (is_active = true)
      const response = await fetch('/api/patients?isActive=true', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    retry: false,
    staleTime: 0,
  });

  // Fetch subscription data if user is admin
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["/api/subscriptions/current"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain()
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/subscriptions/current', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    retry: false,
    staleTime: 0,
    enabled: user?.role === 'admin' // Only fetch if user is admin
  });

  const subdomain = getTenantSubdomain();

  const dashboardCards = [
    {
      title: "Total Patients",
      value: patientsLoading ? "--" : (Array.isArray(allPatients) ? allPatients.length.toString() : "0"),
      description: patientsLoading || activePatientsLoading ? "Loading..." : `${Array.isArray(allPatients) ? allPatients.length : 0} total patients • ${Array.isArray(activePatients) ? activePatients.length : 0} active patients`,
      icon: Users,
      href: `/${subdomain}/patients`,
      color: "text-blue-500"
    },
    {
      title: "Today's Appointments", 
      value: isLoading ? "--" : (stats?.todayAppointments?.toString() || "0"),
      description: isLoading ? "Loading..." : `${stats?.todayAppointments || 0} scheduled today`,
      icon: Calendar,
      href: `/${subdomain}/appointments`,
      color: "text-green-500"
    },
    {
      title: "AI Suggestions",
      value: isLoading ? "--" : (stats?.aiSuggestions?.toString() || "0"), 
      description: isLoading ? "Loading..." : `${stats?.aiSuggestions || 0} active insights`,
      icon: Brain,
      href: `/${subdomain}/clinical-decision-support?tab=insights`,
      color: "text-purple-500"
    },
    {
      title: "Revenue (MTD)",
      value: isLoading ? "--" : "£0",
      description: isLoading ? "Loading..." : "Month to date revenue",
      icon: CreditCard,
      href: `/${subdomain}/billing`,
      color: "text-yellow-500"
    }
  ];
  
  const quickActions = [
    { title: "Add New Patient", description: "", icon: UserPlus, href: `/${subdomain}/patients` },
    { title: "Schedule Appointment", description: "", icon: Calendar, href: `/${subdomain}/appointments` },
    { title: "Create Prescription", description: "", icon: Pill, href: `/${subdomain}/prescriptions` },
    { title: "Medical Records", description: "", icon: ClipboardPlus, href: `/${subdomain}/patients` },
    { title: "Clinical Decision Support", description: "", icon: Brain, href: `/${subdomain}/clinical-decision-support` }
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation(card.href)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:!text-gray-300">{card.title}</CardTitle>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:!text-gray-100">{card.value}</div>
              <p className="text-xs text-gray-500 dark:!text-gray-400">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area with Calendar and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* First Row - Appointment Calendar */}
        <div className="lg:col-span-2">
          <AppointmentCalendar onNewAppointment={() => setLocation("/appointments")} />
        </div>

        {/* Right Column - Quick Actions, AI Insights, and Subscription */}
        <div className="space-y-4 lg:row-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.title}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
          
          {/* AI Patient Insights */}
          <AiInsightsPanel />
          
          {/* Subscription Info */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                  Subscription Plan
                  <Crown className="h-5 w-5 text-yellow-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionLoading ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Loading subscription...
                  </div>
                ) : subscription ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                        {subscription.plan || subscription.planName}
                      </div>
                      <Badge variant={subscription.status === 'active' ? 'default' : subscription.status === 'trial' ? 'secondary' : 'destructive'} className="mt-1">
                        {subscription.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Users:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {subscription.currentUsers} / {subscription.userLimit}
                        </span>
                      </div>
                      
                      {subscription.monthlyPrice && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Monthly:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            £{subscription.monthlyPrice}
                          </span>
                        </div>
                      )}
                      
                      {subscription.nextBillingAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Next billing:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {new Date(subscription.nextBillingAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      {subscription.trialEndsAt && subscription.status === 'trial' && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Trial ends:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {new Date(subscription.trialEndsAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No subscription found
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Second Row - Recent Patients List (same width as appointments) */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Patients</CardTitle>
              <Link href={`/${getTenantSubdomain()}/patients`}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <RecentPatientsList />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Roles preview */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">System Roles</CardTitle>
          <Link href="/user-management?tab=roles">
            <Button size="sm" variant="ghost" className="gap-1">
              View Roles
              <Users className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {rolesQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading roles...</div>
          ) : (
            roles.slice(0, 4).map((role: any) => (
              <div key={role.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                <div>
                  <p className="font-semibold text-gray-900">{role.displayName}</p>
                  <p className="text-xs text-gray-500">{role.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={role.isSystem ? "secondary" : "default"}>
                    {role.isSystem ? "System" : "Custom"}
                  </Badge>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteRole(role.id, role.displayName)}
                      data-testid={`admin-delete-role-${role.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}