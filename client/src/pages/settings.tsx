import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/hooks/use-tenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { Settings as SettingsIcon, Globe, Shield, Palette, Save, Check, Upload, X, Link as LinkIcon, User, Plus } from "lucide-react";
import type { Organization } from "@/types";
import GDPRCompliance from "./gdpr-compliance";
import IntegrationsPage from "./integrations";

const regions = [
  { value: "UK", label: "United Kingdom" },
  { value: "EU", label: "European Union" },
  { value: "ME", label: "Middle East" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "US", label: "United States" }
];

const themes = [
  { value: "default", label: "Bluewave" },
  { value: "electric-lilac", label: "Electric Lilac" }, 
  { value: "midnight", label: "Midnight" },
  { value: "steel", label: "Steel" },
  { value: "mist", label: "Mist" },
  { value: "mint-drift", label: "Mint Drift" },
  { value: "green", label: "Medical Green" },
  { value: "purple", label: "Professional Purple" },
  { value: "dark", label: "Dark Mode" }
];

export default function Settings() {
  const { canView, canEdit: canEditPermission } = useRolePermissions();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  
  // Doctor profile editable fields state
  const [doctorProfile, setDoctorProfile] = useState({
    medicalSpecialtyCategory: "",
    subSpecialty: "",
    workingDays: [] as string[],
    workingHours: { start: "", end: "" }
  });
  
  // Get tab from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const defaultTab = user?.role === "patient" ? "my-profile" : "general";
  const [activeTab, setActiveTab] = useState(tabParam || defaultTab);
  
  // Sync activeTab with URL changes (for back/forward navigation and direct URL access)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newTab = params.get('tab') || 'general';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location]);
  
  // Handle tab changes and update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const currentPath = location.split('?')[0];
    setLocation(`${currentPath}?tab=${newTab}`);
  };

  const { data: organization, isLoading, error } = useQuery<Organization>({
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



  const [settings, setSettings] = useState({
    name: "",
    brandName: "",
    region: "UK",
    theme: "default",
    logoUrl: "",
    gdprEnabled: true,
    aiEnabled: true,
    billingEnabled: true
  });

  // Apply theme colors to CSS variables
  const applyTheme = (themeValue: string) => {
    const root = document.documentElement;
    
    switch (themeValue) {
      case 'electric-lilac':
        // Electric Lilac Theme
        root.style.setProperty('--primary', '#7279FB', 'important'); 
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#7279FB', 'important');
        root.style.setProperty('--cura-bluewave', '#7279FB', 'important');
        root.style.setProperty('--cura-electric-lilac', '#7279FB', 'important');
        root.style.setProperty('--cura-mint-drift', '#C073FF', 'important');
        root.style.setProperty('--medical-blue', '#7279FB', 'important');
        break;
      case 'midnight':
        // Midnight Theme
        root.style.setProperty('--primary', '#162B61', 'important'); 
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#162B61', 'important');
        root.style.setProperty('--cura-bluewave', '#162B61', 'important');
        root.style.setProperty('--cura-electric-lilac', '#2A4082', 'important');
        root.style.setProperty('--cura-mint-drift', '#4A6FA5', 'important');
        root.style.setProperty('--medical-blue', '#162B61', 'important');
        break;
      case 'steel':
        // Steel Theme
        root.style.setProperty('--primary', '#9B9EAF', 'important'); 
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#9B9EAF', 'important');
        root.style.setProperty('--cura-bluewave', '#9B9EAF', 'important');
        root.style.setProperty('--cura-electric-lilac', '#B5B8C7', 'important');
        root.style.setProperty('--cura-mint-drift', '#A8ABBA', 'important');
        root.style.setProperty('--medical-blue', '#9B9EAF', 'important');
        break;
      case 'mist':
        // Mist Theme
        root.style.setProperty('--primary', '#E0E1F4', 'important'); 
        root.style.setProperty('--primary-foreground', '#162B61', 'important');
        root.style.setProperty('--ring', '#E0E1F4', 'important');
        root.style.setProperty('--cura-bluewave', '#E0E1F4', 'important');
        root.style.setProperty('--cura-electric-lilac', '#D1D3E8', 'important');
        root.style.setProperty('--cura-mint-drift', '#E8E9F6', 'important');
        root.style.setProperty('--medical-blue', '#E0E1F4', 'important');
        break;
      case 'mint-drift':
        // Mint Drift Theme
        root.style.setProperty('--primary', '#6CFFEB', 'important'); 
        root.style.setProperty('--primary-foreground', '#162B61', 'important');
        root.style.setProperty('--ring', '#6CFFEB', 'important');
        root.style.setProperty('--cura-bluewave', '#6CFFEB', 'important');
        root.style.setProperty('--cura-electric-lilac', '#5CFCE6', 'important');
        root.style.setProperty('--cura-mint-drift', '#6CFFEB', 'important');
        root.style.setProperty('--medical-blue', '#6CFFEB', 'important');
        break;
      case 'green':
        // Medical Green Theme - Force high specificity
        root.style.setProperty('--primary', '#22C55E', 'important'); 
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#22C55E', 'important');
        root.style.setProperty('--cura-bluewave', '#22C55E', 'important');
        root.style.setProperty('--cura-electric-lilac', '#10B981', 'important');
        root.style.setProperty('--cura-mint-drift', '#34D399', 'important');
        root.style.setProperty('--medical-blue', '#22C55E', 'important');
        break;
      case 'purple':
        // Professional Purple Theme
        root.style.setProperty('--primary', '#7C3AED', 'important');
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#7C3AED', 'important');
        root.style.setProperty('--cura-bluewave', '#7C3AED', 'important');
        root.style.setProperty('--cura-electric-lilac', '#A855F7', 'important');
        root.style.setProperty('--cura-mint-drift', '#C084FC', 'important');
        root.style.setProperty('--medical-blue', '#7C3AED', 'important');
        break;
      case 'dark':
        // Dark Mode Theme
        root.style.setProperty('--primary', '#374151', 'important');
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#374151', 'important');
        root.style.setProperty('--cura-bluewave', '#374151', 'important');
        root.style.setProperty('--cura-electric-lilac', '#4B5563', 'important');
        root.style.setProperty('--cura-mint-drift', '#6B7280', 'important');
        root.style.setProperty('--medical-blue', '#374151', 'important');
        break;
      default: // Bluewave (Default)
        root.style.setProperty('--primary', '#4A7DFF', 'important');
        root.style.setProperty('--primary-foreground', '#FFFFFF', 'important');
        root.style.setProperty('--ring', '#4A7DFF', 'important');
        root.style.setProperty('--cura-bluewave', '#4A7DFF', 'important');
        root.style.setProperty('--cura-electric-lilac', '#7279FB', 'important');
        root.style.setProperty('--cura-mint-drift', '#6CFFEB', 'important');
        root.style.setProperty('--medical-blue', '#4A7DFF', 'important');
        break;
    }
    
    // Force a re-render by triggering a style recalculation
    document.body.style.display = 'none';
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';
  };

  // Update settings when organization data is loaded
  useEffect(() => {
    if (organization) {
      const newSettings = {
        name: organization.name || "",
        brandName: organization.brandName || "",
        region: organization.region || "UK",
        theme: organization.settings?.theme?.primaryColor || "default",
        logoUrl: organization.settings?.theme?.logoUrl || "",
        gdprEnabled: organization.settings?.compliance?.gdprEnabled || true,
        aiEnabled: organization.settings?.features?.aiEnabled || true,
        billingEnabled: organization.settings?.features?.billingEnabled || true
      };
      setSettings(newSettings);
      // Apply the theme immediately when data loads
      applyTheme(newSettings.theme);
      setHasChanges(false); // Reset changes flag when fresh data loads
    }
  }, [organization]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      return apiRequest('PATCH', '/api/organization/settings', updatedSettings);
    },
    onSuccess: async (data) => {
      // Force cache invalidation and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/tenant/info"] });
      await queryClient.refetchQueries({ queryKey: ["/api/tenant/info"] });
      
      // Immediately reapply theme after saving
      applyTheme(settings.theme);
      
      setHasChanges(false);
      setShowSaved(true);
      toast({
        title: "Settings saved",
        description: "Organization settings have been updated successfully.",
      });
      // Hide the saved indicator after 3 seconds
      setTimeout(() => setShowSaved(false), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Doctor profile update mutation
  const updateDoctorProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      if (!user?.id) throw new Error("User not found");
      return apiRequest('PATCH', `/api/users/${user.id}`, profileData);
    },
    onSuccess: async () => {
      // Refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating profile",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    // Apply theme immediately when user selects it
    if (field === 'theme') {
      applyTheme(value);
      // Save theme to localStorage for persistence across pages
      localStorage.setItem('cura-theme', value);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 2MB",
          variant: "destructive",
        });
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        handleInputChange('logoUrl', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updatedSettings = {
      name: settings.name,
      brandName: settings.brandName,
      region: settings.region,
      settings: {
        theme: { primaryColor: settings.theme, logoUrl: settings.logoUrl },
        compliance: { gdprEnabled: settings.gdprEnabled },
        features: { 
          aiEnabled: settings.aiEnabled, 
          billingEnabled: settings.billingEnabled 
        }
      }
    };
    
    updateSettingsMutation.mutate(updatedSettings);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
        <Header 
          title="Settings" 
          subtitle="Configure your organization settings and preferences."
        />
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
        <Header 
          title="Settings" 
          subtitle="Configure your organization settings and preferences."
        />
        <div className="w-full flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-neutral-600 dark:text-gray-400 mb-4">
                Settings require administrator access.
              </p>
              <p className="text-sm text-neutral-500 dark:text-gray-500 mb-4">
                Please log in with admin credentials to access organization settings.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-left">
                <p className="font-medium text-blue-900 dark:text-blue-300 mb-2">Admin Login:</p>
                <p className="text-sm text-blue-800 dark:text-blue-400">Email: admin@demo.medicoreemr.com</p>
                <p className="text-sm text-blue-800 dark:text-blue-400">Password: password123</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
      <Header 
        title="Settings" 
        subtitle="Configure your organization settings and preferences."
      />
      
      <div className="w-full flex-1 overflow-auto px-4 lg:px-6 py-6 space-y-6">
        <div className="space-y-6">
          {user?.role === "patient" ? (
            <div className="space-y-6">
              <MyProfileContent user={user} />
            </div>
          ) : user?.role === "doctor" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>My Profile</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={user?.firstName || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={user?.lastName || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={user?.email || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={(user as any)?.username || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input value={user?.role || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input value={user?.department || ""} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Specialization (Medical Specialty)</Label>
                      <Input 
                        value={
                          (user as any)?.medicalSpecialtyCategory 
                            ? (user as any).medicalSpecialtyCategory 
                            : doctorProfile.medicalSpecialtyCategory
                        } 
                        onChange={(e) => setDoctorProfile({ ...doctorProfile, medicalSpecialtyCategory: e.target.value })}
                        disabled={!!(user as any)?.medicalSpecialtyCategory} 
                        className={(user as any)?.medicalSpecialtyCategory ? "bg-gray-100 dark:bg-gray-800" : ""}
                        placeholder="Enter your medical specialty"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sub-Specialty</Label>
                      <Input 
                        value={
                          (user as any)?.subSpecialty 
                            ? (user as any).subSpecialty 
                            : doctorProfile.subSpecialty
                        }
                        onChange={(e) => setDoctorProfile({ ...doctorProfile, subSpecialty: e.target.value })}
                        disabled={!!(user as any)?.subSpecialty} 
                        className={(user as any)?.subSpecialty ? "bg-gray-100 dark:bg-gray-800" : ""}
                        placeholder="Enter your sub-specialty"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Working Days</Label>
                      <Input 
                        value={(user as any)?.workingDays && Array.isArray((user as any).workingDays) && (user as any).workingDays.length > 0 
                          ? (user as any).workingDays.join(", ") 
                          : "Not specified"
                        } 
                        disabled 
                        className="bg-gray-100 dark:bg-gray-800" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Working Hours</Label>
                      <Input 
                        value={(user as any)?.workingHours && typeof (user as any).workingHours === 'object' && ((user as any).workingHours.start || (user as any).workingHours.end)
                          ? `${(user as any).workingHours.start || 'N/A'} - ${(user as any).workingHours.end || 'N/A'}` 
                          : "Not specified"
                        } 
                        disabled 
                        className="bg-gray-100 dark:bg-gray-800" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Input value={(user as any)?.isActive ? "Active" : "Inactive"} disabled className="bg-gray-100 dark:bg-gray-800" />
                    </div>
                    <div className="space-y-2">
                      <Label>Member Since</Label>
                      <Input 
                        value={(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString() : "N/A"} 
                        disabled 
                        className="bg-gray-100 dark:bg-gray-800" 
                      />
                    </div>
                  </div>
                  
                  {(!(user as any)?.medicalSpecialtyCategory || !(user as any)?.subSpecialty) && (
                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={() => {
                          const updates: any = {};
                          if (!(user as any)?.medicalSpecialtyCategory && doctorProfile.medicalSpecialtyCategory) {
                            updates.medicalSpecialtyCategory = doctorProfile.medicalSpecialtyCategory;
                          }
                          if (!(user as any)?.subSpecialty && doctorProfile.subSpecialty) {
                            updates.subSpecialty = doctorProfile.subSpecialty;
                          }
                          if (Object.keys(updates).length > 0) {
                            updateDoctorProfileMutation.mutate(updates);
                          }
                        }}
                        disabled={
                          updateDoctorProfileMutation.isPending ||
                          (!doctorProfile.medicalSpecialtyCategory && !doctorProfile.subSpecialty)
                        }
                        data-testid="button-saveDoctorProfile"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateDoctorProfileMutation.isPending ? "Saving..." : "Save Profile"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger value="gdpr">
                  <Shield className="h-4 w-4 mr-2" />
                  GDPR Compliance
                </TabsTrigger>
                <TabsTrigger value="integrations">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Integrations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6">
              {/* Organization Settings */}
              <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="h-5 w-5" />
                <span>Organization Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    value={settings.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="brandName">Brand Name</Label>
                  <Input
                    id="brandName"
                    value={settings.brandName}
                    onChange={(e) => handleInputChange('brandName', e.target.value)}
                    placeholder="e.g., MediCore EMR"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Regional Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="region">Operating Region</Label>
                <Select 
                  value={settings.region} 
                  onValueChange={(value) => handleInputChange('region', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-neutral-600 dark:text-gray-400">
                  This determines compliance requirements and data residency rules.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Compliance & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>GDPR Compliance</Label>
                  <p className="text-sm text-neutral-600 dark:text-gray-400">
                    Enable enhanced data protection features required for EU/UK operations.
                  </p>
                </div>
                <Switch
                  checked={settings.gdprEnabled}
                  onCheckedChange={(checked) => handleInputChange('gdprEnabled', checked)}
                />
              </div>
              
              {settings.gdprEnabled && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">GDPR Features Enabled</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• Enhanced audit logging</li>
                    <li>• Data encryption at rest and in transit</li>
                    <li>• Right to be forgotten implementation</li>
                    <li>• Data portability features</li>
                    <li>• Consent management</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>AI Insights</Label>
                  <p className="text-sm text-neutral-600 dark:text-gray-400">
                    Enable AI-powered medical insights and recommendations.
                  </p>
                </div>
                <Switch
                  checked={settings.aiEnabled}
                  onCheckedChange={(checked) => handleInputChange('aiEnabled', checked)}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Billing Module</Label>
                  <p className="text-sm text-neutral-600 dark:text-gray-400">
                    Enable billing and payment processing features.
                  </p>
                </div>
                <Switch
                  checked={settings.billingEnabled}
                  onCheckedChange={(checked) => handleInputChange('billingEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Theme & Appearance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="logo">Organization Logo</Label>
                <div className="flex items-start gap-4">
                  {settings.logoUrl && (
                    <div className="relative">
                      <img 
                        src={settings.logoUrl} 
                        alt="Organization Logo" 
                        className="h-20 w-auto object-contain border rounded-lg p-2"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => handleInputChange('logoUrl', '')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-neutral-600 dark:text-gray-400 mt-2">
                      Upload your organization logo (PNG, JPG, max 2MB). This will appear in the sidebar.
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="theme">Color Theme</Label>
                <Select 
                  value={settings.theme} 
                  onValueChange={(value) => handleInputChange('theme', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-neutral-600 dark:text-gray-400">
                  Customize the color scheme for your organization's branding.
                </p>
              </div>
            </CardContent>
          </Card>

              {/* Save Button - Only visible if user has edit permissions */}
              {canEditPermission('settings') && (
                <div className="fixed bottom-6 right-6 z-50">
                  <Button 
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    size="lg"
                    className="shadow-lg"
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <LoadingSpinner className="h-4 w-4 mr-2" />
                        Saving...
                      </>
                    ) : showSaved ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Saved!
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

              <TabsContent value="gdpr">
                <GDPRCompliance />
              </TabsContent>

              <TabsContent value="integrations">
                <IntegrationsPage />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function MyProfileContent({ user }: { user: any }) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  const { data: patientData, isLoading: patientLoading } = useQuery({
    queryKey: ["/api/patients", "my-profile"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Tenant-Subdomain": tenant?.subdomain || "demo",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/patients", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch patient data: ${response.status}`);
      }

      const patients = await response.json();
      console.log("All patients:", patients);
      console.log("Looking for user:", { email: user?.email, id: user?.id });
      
      // Try multiple matching strategies to find patient record
      const myPatient = patients.find((p: any) => 
        p.email === user?.email || // Match by email
        p.userId === user?.id ||   // Match by userId
        p.userId?.toString() === user?.id?.toString() // Match by userId as string
      );
      
      console.log("Found patient:", myPatient);
      return myPatient || null;
    },
    enabled: !!user?.email,
  });

  const updatePatientMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Tenant-Subdomain": tenant?.subdomain || "demo",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/patients/${patientData.id}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to update patient data: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", "my-profile"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (patientData) {
      setFormData({
        firstName: patientData.firstName || "",
        lastName: patientData.lastName || "",
        dateOfBirth: patientData.dateOfBirth || "",
        gender: patientData.genderAtBirth || "",
        phone: patientData.phone || "",
        address: patientData.address?.street || "",
        city: patientData.address?.city || "",
        state: patientData.address?.state || "",
        zipCode: patientData.address?.postcode || "",
        country: patientData.address?.country || "",
        emergencyContactName: patientData.emergencyContact?.name || "",
        emergencyContactPhone: patientData.emergencyContact?.phone || "",
        bloodType: patientData.bloodType || "",
        allergies: patientData.allergies || "",
        insuranceProvider: patientData.insuranceInfo?.provider || "",
        insuranceNumber: patientData.insuranceInfo?.policyNumber || "",
      });
    }
  }, [patientData]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleFieldSave = (field: string) => {
    // Handle emergency contact fields specially
    if (field === "emergencyContactName") {
      updatePatientMutation.mutate({
        emergencyContact: {
          ...(patientData?.emergencyContact ?? {}),
          name: formData.emergencyContactName,
        },
      });
    } else if (field === "emergencyContactPhone") {
      updatePatientMutation.mutate({
        emergencyContact: {
          ...(patientData?.emergencyContact ?? {}),
          phone: formData.emergencyContactPhone,
        },
      });
    } else if (field === "address") {
      updatePatientMutation.mutate({
        address: {
          ...(patientData?.address ?? {}),
          street: formData.address,
        },
      });
    } else if (field === "city") {
      updatePatientMutation.mutate({
        address: {
          ...(patientData?.address ?? {}),
          city: formData.city,
        },
      });
    } else if (field === "state") {
      updatePatientMutation.mutate({
        address: {
          ...(patientData?.address ?? {}),
          state: formData.state,
        },
      });
    } else if (field === "zipCode") {
      updatePatientMutation.mutate({
        address: {
          ...(patientData?.address ?? {}),
          postcode: formData.zipCode,
        },
      });
    } else if (field === "country") {
      updatePatientMutation.mutate({
        address: {
          ...(patientData?.address ?? {}),
          country: formData.country,
        },
      });
    } else if (field === "insuranceProvider") {
      updatePatientMutation.mutate({
        insuranceInfo: {
          ...(patientData?.insuranceInfo ?? {}),
          provider: formData.insuranceProvider,
        },
      });
    } else if (field === "insuranceNumber") {
      updatePatientMutation.mutate({
        insuranceInfo: {
          ...(patientData?.insuranceInfo ?? {}),
          policyNumber: formData.insuranceNumber,
        },
      });
    } else if (field === "gender") {
      // Map UI field 'gender' to database column 'genderAtBirth'
      updatePatientMutation.mutate({ genderAtBirth: formData.gender });
    } else {
      updatePatientMutation.mutate({ [field]: formData[field] });
    }
  };

  const canEdit = (field: string) => {
    // Handle emergency contact fields specially
    if (field === "emergencyContactName") {
      return !patientData?.emergencyContact?.name || patientData.emergencyContact.name === "";
    }
    if (field === "emergencyContactPhone") {
      return !patientData?.emergencyContact?.phone || patientData.emergencyContact.phone === "";
    }
    if (field === "address") {
      return !patientData?.address?.street || patientData.address.street === "";
    }
    if (field === "city") {
      return !patientData?.address?.city || patientData.address.city === "";
    }
    if (field === "state") {
      return !patientData?.address?.state || patientData.address.state === "";
    }
    if (field === "zipCode") {
      return !patientData?.address?.postcode || patientData.address.postcode === "";
    }
    if (field === "country") {
      return !patientData?.address?.country || patientData.address.country === "";
    }
    if (field === "insuranceProvider") {
      return !patientData?.insuranceInfo?.provider || patientData.insuranceInfo.provider === "";
    }
    if (field === "insuranceNumber") {
      return !patientData?.insuranceInfo?.policyNumber || patientData.insuranceInfo.policyNumber === "";
    }
    if (field === "gender") {
      // Check database column 'genderAtBirth'
      return !patientData?.genderAtBirth || patientData.genderAtBirth === "";
    }
    return !patientData?.[field] || patientData[field] === "";
  };

  const renderReadOnlyField = (label: string, field: string, type: string = "text") => {
    return (
      <div className="space-y-2">
        <Label htmlFor={field}>{label}</Label>
        <Input
          id={field}
          type={type}
          value={formData[field] || ""}
          disabled
          className="bg-gray-100 dark:bg-gray-800"
          data-testid={`input-${field}`}
        />
        {formData[field] && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This field is read-only and cannot be edited.
          </p>
        )}
      </div>
    );
  };

  const renderField = (label: string, field: string, type: string = "text") => {
    const isEmpty = canEdit(field);
    const isCurrentlyEditing = isEditing[field];

    return (
      <div className="space-y-2">
        <Label htmlFor={field}>{label}</Label>
        <div className="flex gap-2">
          <Input
            id={field}
            type={type}
            value={formData[field] || ""}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            disabled={!isEmpty && !isCurrentlyEditing}
            className={!isEmpty && !isCurrentlyEditing ? "bg-gray-100 dark:bg-gray-800" : ""}
            data-testid={`input-${field}`}
          />
          {isEmpty && !isCurrentlyEditing && (
            <Button
              size="sm"
              onClick={() => setIsEditing((prev) => ({ ...prev, [field]: true }))}
              data-testid={`button-edit-${field}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {isCurrentlyEditing && (
            <>
              <Button
                size="sm"
                onClick={() => handleFieldSave(field)}
                disabled={updatePatientMutation.isPending}
                data-testid={`button-save-${field}`}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing((prev) => ({ ...prev, [field]: false }));
                  // Handle nested JSONB fields specially
                  if (field === "emergencyContactName") {
                    setFormData((prev: any) => ({ ...prev, emergencyContactName: patientData?.emergencyContact?.name || "" }));
                  } else if (field === "emergencyContactPhone") {
                    setFormData((prev: any) => ({ ...prev, emergencyContactPhone: patientData?.emergencyContact?.phone || "" }));
                  } else if (field === "address") {
                    setFormData((prev: any) => ({ ...prev, address: patientData?.address?.street || "" }));
                  } else if (field === "city") {
                    setFormData((prev: any) => ({ ...prev, city: patientData?.address?.city || "" }));
                  } else if (field === "state") {
                    setFormData((prev: any) => ({ ...prev, state: patientData?.address?.state || "" }));
                  } else if (field === "zipCode") {
                    setFormData((prev: any) => ({ ...prev, zipCode: patientData?.address?.postcode || "" }));
                  } else if (field === "country") {
                    setFormData((prev: any) => ({ ...prev, country: patientData?.address?.country || "" }));
                  } else if (field === "insuranceProvider") {
                    setFormData((prev: any) => ({ ...prev, insuranceProvider: patientData?.insuranceInfo?.provider || "" }));
                  } else if (field === "insuranceNumber") {
                    setFormData((prev: any) => ({ ...prev, insuranceNumber: patientData?.insuranceInfo?.policyNumber || "" }));
                  } else {
                    setFormData((prev: any) => ({ ...prev, [field]: patientData?.[field] || "" }));
                  }
                }}
                data-testid={`button-cancel-${field}`}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
        {!isEmpty && !isCurrentlyEditing && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This field cannot be edited as it already has a value.
          </p>
        )}
      </div>
    );
  };

  const renderSelectField = (label: string, field: string, options: { value: string; label: string }[]) => {
    const isEmpty = canEdit(field);
    const isCurrentlyEditing = isEditing[field];

    return (
      <div className="space-y-2">
        <Label htmlFor={field}>{label}</Label>
        <div className="flex gap-2">
          <Select
            value={formData[field] || ""}
            onValueChange={(value) => handleFieldChange(field, value)}
            disabled={!isEmpty && !isCurrentlyEditing}
          >
            <SelectTrigger
              className={!isEmpty && !isCurrentlyEditing ? "bg-gray-100 dark:bg-gray-800" : ""}
              data-testid={`select-${field}`}
            >
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEmpty && !isCurrentlyEditing && (
            <Button
              size="sm"
              onClick={() => setIsEditing((prev) => ({ ...prev, [field]: true }))}
              data-testid={`button-edit-${field}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {isCurrentlyEditing && (
            <>
              <Button
                size="sm"
                onClick={() => handleFieldSave(field)}
                disabled={updatePatientMutation.isPending}
                data-testid={`button-save-${field}`}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing((prev) => ({ ...prev, [field]: false }));
                  // Handle nested JSONB fields specially
                  if (field === "gender") {
                    setFormData((prev: any) => ({ ...prev, gender: patientData?.genderAtBirth || "" }));
                  } else if (field === "insuranceProvider") {
                    setFormData((prev: any) => ({ ...prev, insuranceProvider: patientData?.insuranceInfo?.provider || "" }));
                  } else {
                    setFormData((prev: any) => ({ ...prev, [field]: patientData?.[field] || "" }));
                  }
                }}
                data-testid={`button-cancel-${field}`}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
        {!isEmpty && !isCurrentlyEditing && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This field cannot be edited as it already has a value.
          </p>
        )}
      </div>
    );
  };

  if (patientLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingSpinner className="h-8 w-8 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!patientData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500 dark:text-gray-400">
            No patient profile found. Please contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField("First Name", "firstName")}
            {renderField("Last Name", "lastName")}
            {renderField("Date of Birth", "dateOfBirth", "date")}
            {renderSelectField("Gender", "gender", [
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
              { value: "Prefer not to say", label: "Prefer not to say" }
            ])}
            {renderField("Phone", "phone", "tel")}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
                data-testid="input-email"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Email cannot be changed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField("Address", "address")}
            {renderField("City", "city")}
            {renderField("State", "state")}
            {renderField("Zip Code", "zipCode")}
            {renderField("Country", "country")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField("Emergency Contact Name", "emergencyContactName")}
            {renderField("Emergency Contact Phone", "emergencyContactPhone", "tel")}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insurance Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderSelectField("Insurance Provider", "insuranceProvider", [
              { value: "NHS (National Health Service)", label: "NHS (National Health Service)" },
              { value: "Bupa", label: "Bupa" },
              { value: "AXA PPP Healthcare", label: "AXA PPP Healthcare" },
              { value: "Vitality Health", label: "Vitality Health" },
              { value: "Aviva Health", label: "Aviva Health" },
              { value: "Simply Health", label: "Simply Health" },
              { value: "WPA", label: "WPA" },
              { value: "Benenden Health", label: "Benenden Health" },
              { value: "Healix Health Services", label: "Healix Health Services" },
              { value: "Sovereign Health Care", label: "Sovereign Health Care" },
              { value: "Exeter Friendly Society", label: "Exeter Friendly Society" },
              { value: "Self-Pay", label: "Self-Pay" },
              { value: "Other", label: "Other" }
            ])}
            {renderField("Insurance Number", "insuranceNumber")}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
