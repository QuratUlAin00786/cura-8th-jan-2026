import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApiRequest } from '@/lib/saasQueryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Search, 
  Building2, 
  Plus, 
  Edit, 
  Eye,
  Users,
  Calendar,
  CreditCard,
  Settings,
  Trash2,
  CheckCircle
} from 'lucide-react';

const formatLocalDateTime = (date: Date) => {
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - tzOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

const ensureFutureOrNow = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return '';
  const now = new Date();
  if (parsed < now) {
    return formatLocalDateTime(now);
  }
  return value;
};

const DEFAULT_ROLE_PERMISSIONS = [
  { role: 'Admin', detail: 'Full access to every module and configuration page.' },
  { role: 'Doctor', detail: 'Clinical workflows, scheduling, and patient records.' },
  { role: 'Nurse', detail: 'Patient care tasks, forms, and messaging capabilities.' },
  { role: 'Receptionist', detail: 'Appointment booking/patient lookup with no billing edits.' },
  { role: 'Billing', detail: 'Payments, invoices, and revenue reporting dashboards.' },
];

export default function SaaSCustomers() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [subdomainError, setSubdomainError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    brandName: '',
    subdomain: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    accessLevel: 'full', // full, limited
    billingPackageId: '',
    status: 'trial',
    paymentStatus: 'trial',
    details: '',
    expiresAt: '',
    features: {
      maxUsers: 10,
      maxPatients: 100,
      aiEnabled: true,
      telemedicineEnabled: true,
      billingEnabled: true,
      analyticsEnabled: true,
    }
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [originalCustomerValues, setOriginalCustomerValues] = useState<any>(null);
  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');
  const [viewingCustomer, setViewingCustomer] = useState<any>(null);
  const [isViewCustomerLoading, setIsViewCustomerLoading] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsOverview, setPermissionsOverview] = useState<typeof DEFAULT_ROLE_PERMISSIONS>([]);
  const viewingFeatureConfig = viewingCustomer?.features || {};
  const viewingFeatureFlags = [
    { label: 'AI Features', value: viewingFeatureConfig.aiEnabled },
    { label: 'Telemedicine', value: viewingFeatureConfig.telemedicineEnabled },
    { label: 'Billing Module', value: viewingFeatureConfig.billingEnabled },
    { label: 'Analytics & Reports', value: viewingFeatureConfig.analyticsEnabled },
  ];
  const viewingPackageFeatures = viewingCustomer?.packageFeatures || {};
  const packageFeatureList = [
    `Max users: ${viewingCustomer?.maxUsers ?? viewingPackageFeatures.maxUsers ?? 'N/A'}`,
    `Max patients: ${viewingCustomer?.maxPatients ?? viewingPackageFeatures.maxPatients ?? 'N/A'}`,
    viewingPackageFeatures.aiEnabled ? 'AI Features' : null,
    viewingPackageFeatures.telemedicineEnabled ? 'Telemedicine' : null,
    viewingPackageFeatures.billingEnabled ? 'Billing' : null,
    viewingPackageFeatures.analyticsEnabled ? 'Analytics' : null,
    viewingPackageFeatures.customBranding ? 'Custom Branding' : null,
    viewingPackageFeatures.prioritySupport ? 'Priority Support' : null,
    viewingPackageFeatures.storageGB ? `Storage: ${viewingPackageFeatures.storageGB} GB` : null,
    viewingPackageFeatures.apiCallsPerMonth
      ? `API calls/month: ${viewingPackageFeatures.apiCallsPerMonth}`
      : null,
  ].filter(Boolean) as string[];
  const minExpiresAt = formatLocalDateTime(new Date());
  const formatCurrency = (amount: number, currency: string = 'GBP') =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount);
  const formatDaysActive = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return '—';
    }
    return `${value} day${value === 1 ? '' : 's'}`;
  };
  const handlePermissionsConfirmed = () => {
    setShowPermissionsModal(false);
    setIsSuccessModalOpen(true);
  };
  const isPopupOpen =
    isAddDialogOpen ||
    isSuccessModalOpen ||
    isErrorModalOpen ||
    showUpdateSuccessModal ||
    isDeleteDialogOpen ||
    Boolean(editingCustomer);

  // Fetch all organizations/customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/saas/customers', searchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      
      const response = await saasApiRequest('GET', `/api/saas/customers?${params.toString()}`);
      return response.json();
    },
  });

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    setSearchTerm(trimmed);
    setSearchInput(trimmed);
  };

  // Auto-generate subdomain from organization name
  useEffect(() => {
    if (newCustomer.name) {
      const generatedSubdomain = newCustomer.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      setNewCustomer(prev => ({ ...prev, subdomain: generatedSubdomain }));
      
      // Check if subdomain exists
      if (generatedSubdomain && customers) {
        const exists = customers.some((c: any) => 
          c.subdomain.toLowerCase() === generatedSubdomain.toLowerCase()
        );
        if (exists) {
          setSubdomainError('This title already exists. Please choose a different organization name.');
        } else {
          setSubdomainError('');
        }
      }
    } else {
      setNewCustomer(prev => ({ ...prev, subdomain: '' }));
      setSubdomainError('');
    }
  }, [newCustomer.name, customers]);

  // Check email availability from database (users and organizations tables)
  useEffect(() => {
    const checkEmailAvailability = async () => {
      if (newCustomer.adminEmail) {
        try {
          const response = await saasApiRequest('GET', `/api/saas/customers/check-email?email=${encodeURIComponent(newCustomer.adminEmail)}`);
          const data = await response.json();
          
          if (!data.emailAvailable) {
            setEmailError('Email already exists');
          } else {
            setEmailError('');
          }
        } catch (error) {
          console.error('Error checking email availability:', error);
          setEmailError('');
        }
      } else {
        setEmailError('');
      }
    };

    const timeoutId = setTimeout(checkEmailAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [newCustomer.adminEmail]);

  // Fetch available billing packages
  const { data: billingPackages } = useQuery({
    queryKey: ['/api/saas/packages'],
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await saasApiRequest('POST', '/api/saas/customers', customerData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      setIsAddDialogOpen(false);
      // Clear search filter to show new customer
      setSearchTerm('');
      setSelectedStatus('all');
      setSubdomainError('');
      setEmailError('');
      setNewCustomer({
        name: '', brandName: '', subdomain: '', adminEmail: '', 
        adminFirstName: '', adminLastName: '', accessLevel: 'full', billingPackageId: '',
        status: 'trial', paymentStatus: 'trial',
        details: '', expiresAt: '',
        features: {
          maxUsers: 10, maxPatients: 100, aiEnabled: true, 
          telemedicineEnabled: true, billingEnabled: true, analyticsEnabled: true
        }
      });
      // Show success modal with appropriate message
      const message = data.emailSent === false
        ? 'Organization created successfully but email sending failed.'
        : 'Organization created successfully!';
      setSuccessMessage(message);
      setPermissionsOverview(DEFAULT_ROLE_PERMISSIONS);
      setShowPermissionsModal(true);
    },
    onError: (error: any) => {
      let errMsg = error.message || "Failed to create organization";
      
      // Parse JSON error message if present
      try {
        if (errMsg.startsWith('{') && errMsg.includes('"message"')) {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.message || errMsg;
        }
      } catch (e) {
        // If parsing fails, use the original message
      }
      
      setErrorMessage(errMsg);
      setIsErrorModalOpen(true);
    },
  });

  const handleCreateCustomer = () => {
    const normalizedExpiresAt = newCustomer.expiresAt
      ? ensureFutureOrNow(newCustomer.expiresAt)
      : '';
    createCustomerMutation.mutate({
      ...newCustomer,
      expiresAt: normalizedExpiresAt,
    });
  };

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await saasApiRequest('PATCH', `/api/saas/customers/${customerData.id}`, customerData);
      return response.json();
    },
    onSuccess: () => {
      const current = editingCustomer;
      const orgName = current?.name || 'organization';
      setUpdateSuccessMessage(`your organization ${orgName} has been updated successfully.`);
      setShowUpdateSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      setOriginalCustomerValues(null);
      setEditingCustomer(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  const handleViewCustomerDetails = async (customerId: number) => {
    setViewingCustomer(null);
    setIsViewCustomerLoading(true);

    try {
      const response = await saasApiRequest('GET', `/api/saas/customers/${customerId}`);
      const customerDetails = await response.json();
      const normalizedFeatures = parseFeatureConfig(customerDetails.features);

      setViewingCustomer({
        ...customerDetails,
        features: normalizedFeatures || undefined,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load customer details",
        variant: "destructive",
      });
    } finally {
      setIsViewCustomerLoading(false);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ organizationId, status }: { organizationId: number; status: string }) => {
      console.log('Status mutation called with:', { organizationId, status });
      const response = await saasApiRequest('PATCH', '/api/saas/customers/status', { organizationId, status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      toast({
        title: "Customer Status Updated",
        description: "Customer status changed successfully",
      });
    },
    onError: (error: any) => {
      console.error('Status update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update customer status",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: number) => {
      const response = await saasApiRequest('DELETE', `/api/saas/customers/${customerId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      toast({
        title: "Customer Deleted",
        description: "Customer and all associated data have been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800';
      case 'trial': return 'bg-cyan-100 text-cyan-800';
      case 'pending': return 'bg-purple-100 text-purple-800';
      case 'unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getExpiryAlertBadge = (level?: string) => {
    if (!level || level === 'none') return null;
    const config: Record<string, { text: string; className: string }> = {
      due_7: { text: '7 days to renew', className: 'bg-yellow-100 text-yellow-800' },
      due_1: { text: 'Renew tomorrow', className: 'bg-amber-100 text-amber-800' },
      expired: { text: 'Expired', className: 'bg-red-100 text-red-800' },
    };
    const badge = config[level] || { text: 'Renewal needed', className: 'bg-purple-100 text-purple-800' };
    return (
      <Badge className={badge.className}>
        {badge.text}
      </Badge>
    );
  };

  const normalizeValue = (value: any) => {
    if (value === undefined || value === null || value === '') {
      return 'Not set';
    }
    return value;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'Not set';
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (value?: string) => {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not set';
    return parsed.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseFeatureConfig = (features: any) => {
    if (!features) return null;
    if (typeof features === 'string') {
      try {
        return JSON.parse(features);
      } catch {
        return null;
      }
    }
    return features;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span>Organization Management</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {customers?.length || 0} Total Customers
              </Badge>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setSubdomainError('');
                  setEmailError('');
                  setNewCustomer({
                    name: '', brandName: '', subdomain: '', adminEmail: '', 
                    adminFirstName: '', adminLastName: '', accessLevel: 'full', billingPackageId: '',
                    status: 'trial', paymentStatus: 'trial',
                    details: '', expiresAt: '',
                    features: {
                      maxUsers: 10, maxPatients: 100, aiEnabled: true, 
                      telemedicineEnabled: true, billingEnabled: true, analyticsEnabled: true
                    }
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Organization</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
                  <DialogHeader>
                    <DialogTitle>Add New Customer Organization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Organization Details */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-gray-700">Organization Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Organization Name *</Label>
                          <Input 
                            id="name" 
                            placeholder="e.g., Metro Medical Center" 
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="brandName">Brand Name</Label>
                          <Input 
                            id="brandName" 
                            placeholder="e.g., Metro Health" 
                            value={newCustomer.brandName}
                            onChange={(e) => setNewCustomer({...newCustomer, brandName: e.target.value})}
                          />
                        </div>
                      </div>
                      {newCustomer.subdomain && (
                        <div>
                          <Label>Title</Label>
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                            <code className="text-sm font-medium text-gray-800">
                              {newCustomer.subdomain}
                            </code>
                          </div>
                          {subdomainError && (
                            <p className="text-xs text-red-600 mt-2 font-medium">
                              {subdomainError}
                            </p>
                          )}
                          {!subdomainError && (
                            <p className="text-xs text-green-600 mt-2">
                              ✓ Title is available
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Admin User Details */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-gray-700">Administrator Account</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="adminFirstName">First Name *</Label>
                          <Input 
                            id="adminFirstName" 
                            placeholder="John" 
                            value={newCustomer.adminFirstName}
                            onChange={(e) => setNewCustomer({...newCustomer, adminFirstName: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminLastName">Last Name *</Label>
                          <Input 
                            id="adminLastName" 
                            placeholder="Smith" 
                            value={newCustomer.adminLastName}
                            onChange={(e) => setNewCustomer({...newCustomer, adminLastName: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminEmail">Email *</Label>
                          <Input 
                            id="adminEmail" 
                            type="email" 
                            placeholder="admin@example.com" 
                            value={newCustomer.adminEmail}
                            onChange={(e) => setNewCustomer({...newCustomer, adminEmail: e.target.value})}
                          />
                          {emailError && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              {emailError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subscription Section */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-gray-700">Subscription</h3>
                      
                      <div>
                        <Label>Billing Package</Label>
                        <select 
                          className="w-full px-3 py-2 border rounded"
                          value={newCustomer.billingPackageId}
                          onChange={(e) => setNewCustomer({...newCustomer, billingPackageId: e.target.value})}
                        >
                          <option value="">Select a billing package (optional)</option>
                          {Array.isArray(billingPackages) && billingPackages.map((pkg: any) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} - £{pkg.price}/{pkg.billingCycle}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty for trial customers or manual billing setup
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Subscription Status</Label>
                          <select 
                            className="w-full px-3 py-2 border rounded"
                            value={newCustomer.status}
                            onChange={(e) => setNewCustomer({...newCustomer, status: e.target.value})}
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>

                        <div>
                          <Label>Payment Status</Label>
                          <select 
                            className="w-full px-3 py-2 border rounded"
                            value={newCustomer.paymentStatus}
                            onChange={(e) => setNewCustomer({...newCustomer, paymentStatus: e.target.value})}
                          >
                            <option value="trial">Trial</option>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="failed">Failed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Details</Label>
                          <Input
                            type="text"
                            value={newCustomer.details}
                            onChange={(e) => setNewCustomer({...newCustomer, details: e.target.value})}
                            placeholder="Enter subscription details"
                          />
                        </div>

                        <div>
                          <Label>Expires At</Label>
                          <Input
                            type="datetime-local"
                            value={newCustomer.expiresAt}
                            min={minExpiresAt}
                            onChange={(e) => setNewCustomer({...newCustomer, expiresAt: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Access Level */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-gray-700">Access Level</h3>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="full-access" 
                            name="accessLevel"
                            checked={newCustomer.accessLevel === 'full'}
                            onChange={() => setNewCustomer({...newCustomer, accessLevel: 'full'})}
                          />
                          <Label htmlFor="full-access" className="cursor-pointer">
                            <span className="font-medium">Full Access</span> - Complete access to all EMR features
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="limited-access" 
                            name="accessLevel"
                            checked={newCustomer.accessLevel === 'limited'}
                            onChange={() => setNewCustomer({...newCustomer, accessLevel: 'limited'})}
                          />
                          <Label htmlFor="limited-access" className="cursor-pointer">
                            <span className="font-medium">Limited Access</span> - Restricted feature set with custom controls
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Feature Controls */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-gray-700">Feature Configuration</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="maxUsers">Maximum Users</Label>
                          <Input 
                            id="maxUsers" 
                            type="number" 
                            min="1"
                            value={newCustomer.features.maxUsers}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, maxUsers: parseInt(e.target.value) || 1}
                            })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxPatients">Maximum Patients</Label>
                          <Input 
                            id="maxPatients" 
                            type="number" 
                            min="1"
                            value={newCustomer.features.maxPatients}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, maxPatients: parseInt(e.target.value) || 1}
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="aiEnabled">AI Features</Label>
                          <input 
                            type="checkbox" 
                            id="aiEnabled"
                            checked={newCustomer.features.aiEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, aiEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="telemedicineEnabled">Telemedicine</Label>
                          <input 
                            type="checkbox" 
                            id="telemedicineEnabled"
                            checked={newCustomer.features.telemedicineEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, telemedicineEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="billingEnabled">Billing Module</Label>
                          <input 
                            type="checkbox" 
                            id="billingEnabled"
                            checked={newCustomer.features.billingEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, billingEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="analyticsEnabled">Analytics & Reports</Label>
                          <input 
                            type="checkbox" 
                            id="analyticsEnabled"
                            checked={newCustomer.features.analyticsEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, analyticsEnabled: e.target.checked}
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsAddDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateCustomer}
                        disabled={createCustomerMutation.isPending || !newCustomer.name || !newCustomer.subdomain || !newCustomer.adminEmail || !newCustomer.adminFirstName || !newCustomer.adminLastName || !!subdomainError || !!emailError}
                        className="flex-1"
                      >
                        {createCustomerMutation.isPending ? 'Creating...' : 'Create Organization'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type name, domain, or email and hit Enter"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="pl-10 pr-10"
              />
              {(searchTerm || searchInput) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSearchInput('');
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                  style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleSearch}
              disabled={!searchInput.trim()}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Customers Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Org Pay</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Subscription Start</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead>Days Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.brandName}</div>
                        {customer.adminEmail && (
                          <div className="text-sm text-gray-500">{customer.adminEmail}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {customer.subdomain}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{customer.userCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(customer.computedSubscriptionStatus || customer.subscriptionStatus)}>
                        {customer.computedSubscriptionStatus || customer.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentBadgeColor(customer.organizationPaymentStatus)}>
                        {customer.organizationPaymentStatus || 'trial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.packageName || 'No Package'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(customer.subscriptionStart)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(customer.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(customer.expiresAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{formatDaysActive(customer.daysActive)}</span>
                        {getExpiryAlertBadge(customer.expiryAlertLevel)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {/* View Details Button */}
                        <Dialog
                          onOpenChange={(open) => {
                            if (!open) {
                              setViewingCustomer(null);
                              setIsViewCustomerLoading(false);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCustomerDetails(customer.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader className="flex items-start justify-between gap-4">
                              <DialogTitle>Customer Details - {customer.name}</DialogTitle>
                              <DialogClose asChild>
                                <button
                                  type="button"
                                  className="text-gray-500 rounded hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                  ✕
                                </button>
                              </DialogClose>
                            </DialogHeader>
                            {isViewCustomerLoading ? (
                              <div className="py-12 flex justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-dashed border-blue-300 border-t-blue-600" />
                              </div>
                            ) : viewingCustomer ? (
                              <div className="space-y-6 text-sm text-gray-700">
                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Organization summary
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.name)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Brand</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.brandName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Title</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.subdomain)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Created</p>
                                      <p className="font-semibold text-gray-900">{formatDate(viewingCustomer.createdAt)}</p>
                                    </div>
                                  </div>
                                          <div className="flex flex-wrap gap-2">
                                            {[
                                              { label: viewingCustomer.subscriptionStatus, type: 'status' },
                                              { label: viewingCustomer.organizationPaymentStatus, type: 'payment' },
                                              { label: viewingCustomer.subscriptionPaymentStatus, type: 'payment' },
                                              { label: viewingCustomer.paymentStatus, type: 'payment' },
                                            ]
                                              .filter((entry) => entry.label)
                                              .reduce((acc: { label: string; type: 'status' | 'payment' }[], entry) => {
                                                const normalized = entry.label.toLowerCase();
                                                if (!acc.some((existing) => existing.label.toLowerCase() === normalized)) {
                                                  acc.push(entry);
                                                }
                                                return acc;
                                              }, [])
                                              .map((entry) => {
                                                const normalized = entry.label.toLowerCase();
                                                const badgeClass =
                                                  entry.type === 'status'
                                                    ? getStatusBadgeColor(normalized)
                                                    : getPaymentBadgeColor(normalized);
                                                return (
                                                  <Badge key={`${entry.type}-${normalized}`} className={badgeClass}>
                                                    {entry.label}
                                                  </Badge>
                                                );
                                              })}
                                          </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Subscription & Billing
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Package</p>
                                      <p className="font-semibold text-gray-900">
                                        {viewingCustomer.packageName || `Package ID ${viewingCustomer.packageId || 'N/A'}`}
                                      </p>
                                      {(viewingCustomer.packagePrice || viewingCustomer.packageBillingCycle) && (
                                        <p className="text-xs text-gray-500">
                                          {viewingCustomer.packagePrice
                                            ? formatCurrency(parseFloat(String(viewingCustomer.packagePrice)))
                                            : ""}
                                          {viewingCustomer.packageBillingCycle
                                            ? ` / ${viewingCustomer.packageBillingCycle}`
                                            : ""}
                                        </p>
                                      )}
                                      {viewingCustomer.packageDescription && (
                                        <p className="text-xs text-gray-500">{viewingCustomer.packageDescription}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Payment Status</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.paymentStatus)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Subscription Payment</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.subscriptionPaymentStatus)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Details</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.details)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Subscription Start</p>
                                      <p className="font-semibold text-gray-900">
                                        {formatDateTime(viewingCustomer.subscriptionStart)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Expires At</p>
                                      <p className="font-semibold text-gray-900">{formatDateTime(viewingCustomer.expiresAt)}</p>
                                      <p className="text-xs text-gray-500">Includes 7-day grace period</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Days Active</p>
                                      <p className="font-semibold text-gray-900">
                                        {formatDaysActive(viewingCustomer.daysActive)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Days Left</p>
                                      <p className="font-semibold text-gray-900">
                                        {viewingCustomer.daysLeft ?? "—"}
                                      </p>
                                    </div>
                                    {viewingCustomer.expiryAlertLevel && viewingCustomer.expiryAlertLevel !== 'none' && (
                                      <div>
                                        <p className="text-xs text-gray-500">Expiry Alert</p>
                                        {getExpiryAlertBadge(viewingCustomer.expiryAlertLevel)}
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-gray-500">Last Updated</p>
                                      <p className="font-semibold text-gray-900">{formatDateTime(viewingCustomer.updatedAt)}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-xs text-gray-500">Package features</p>
                                      <div className="flex flex-wrap gap-2">
                                        {packageFeatureList.map((feature) => (
                                          <span
                                            key={feature}
                                            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700"
                                          >
                                            {feature}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Administrator
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">First Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminFirstName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Last Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminLastName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Email</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminEmail)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Access Level</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.accessLevel)}</p>
                                    </div>
                                  </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Feature configuration
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    {viewingFeatureFlags.map((flag) => (
                                      <div key={flag.label}>
                                        <p className="text-xs text-gray-500">{flag.label}</p>
                                        <p className="font-semibold text-gray-900">
                                          {flag.value ? 'Enabled' : 'Disabled'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Maximum Users</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.features?.maxUsers)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Maximum Patients</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.features?.maxPatients)}
                                      </p>
                                    </div>
                                  </div>
                                </section>
                              </div>
                            ) : (
                              <p className="text-center text-sm text-gray-500 py-6">
                                No customer details available right now.
                              </p>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log('🗑️ DELETE button clicked for customer:', customer.id, customer.name);
                            setCustomerToDelete(customer);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Delete customer"
                          className={isPopupOpen ? 'opacity-0 pointer-events-none' : ''}
                          disabled={deleteCustomerMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                        {/* Edit Customer Button */}
                        <Dialog open={editingCustomer?.id === customer.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingCustomer(null);
                            setOriginalCustomerValues(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              const response = await saasApiRequest('GET', `/api/saas/customers/${customer.id}`);
                              const customerDetails = await response.json();
                              
                              setEditingCustomer({
                                id: customerDetails.id,
                                name: customerDetails.name,
                                brandName: customerDetails.brandName,
                                subdomain: customerDetails.subdomain,
                                adminEmail: customerDetails.adminEmail || '',
                                adminFirstName: customerDetails.adminFirstName || '',
                                adminLastName: customerDetails.adminLastName || '',
                                accessLevel: customerDetails.accessLevel || 'full',
                                subscriptionStatus: customerDetails.subscriptionStatus || 'trial',
                                paymentStatus: customerDetails.paymentStatus || 'trial',
                                organizationPaymentStatus: customerDetails.organizationPaymentStatus || 'trial',
                                subscriptionPaymentStatus: customerDetails.subscriptionPaymentStatus || customerDetails.paymentStatus || 'trial',
                                billingPackageId: customerDetails.billingPackageId || '',
                                details: customerDetails.details || '',
                                expiresAt: customerDetails.expiresAt ? new Date(customerDetails.expiresAt).toISOString().slice(0, 16) : '',
                                features: customerDetails.features ? (typeof customerDetails.features === 'string' ? JSON.parse(customerDetails.features) : customerDetails.features) : {
                                  maxUsers: 10,
                                  maxPatients: 100,
                                  aiEnabled: true,
                                  telemedicineEnabled: true,
                                  billingEnabled: true,
                                  analyticsEnabled: true,
                                }
                              });
                              setOriginalCustomerValues({
                                subscriptionStatus: customerDetails.subscriptionStatus || 'trial',
                                paymentStatus: customerDetails.paymentStatus || 'trial',
                                organizationPaymentStatus: customerDetails.organizationPaymentStatus || 'trial',
                                subscriptionPaymentStatus: customerDetails.subscriptionPaymentStatus || customerDetails.paymentStatus || 'trial',
                                billingPackageId: customerDetails.billingPackageId || '',
                                details: customerDetails.details || '',
                                expiresAt: customerDetails.expiresAt ? new Date(customerDetails.expiresAt).toISOString().slice(0, 16) : '',
                              });
                            } catch (error) {
                              console.error('Error fetching customer details:', error);
                              toast({
                                title: "Error",
                                description: "Failed to load customer details",
                                variant: "destructive",
                              });
                            }
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
                          <DialogHeader>
                            <DialogTitle>Edit Organization - {customer.name}</DialogTitle>
                          </DialogHeader>
                          {editingCustomer && (
                            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                                Current values from the database
                              </p>
                              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <dt className="text-[11px] text-gray-500">Organization status</dt>
                                  <dd className="font-semibold">{editingCustomer.subscriptionStatus}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Org payment status</dt>
                                  <dd className="font-semibold">{editingCustomer.organizationPaymentStatus || 'not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Subscription payment</dt>
                                  <dd className="font-semibold">{editingCustomer.subscriptionPaymentStatus || 'not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Details</dt>
                                  <dd className="font-semibold">{editingCustomer.details || 'Not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Expires at</dt>
                                  <dd className="font-semibold">
                                    {editingCustomer.expiresAt ? new Date(editingCustomer.expiresAt).toLocaleString() : 'Not set'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Current max users</dt>
                                  <dd className="font-semibold">{editingCustomer.features?.maxUsers ?? 'Not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Current max patients</dt>
                                  <dd className="font-semibold">{editingCustomer.features?.maxPatients ?? 'Not set'}</dd>
                                </div>
                              </dl>
                            </div>
                          )}
                            {editingCustomer && (
                              <div className="space-y-6">
                                {/* Organization Details */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-sm text-gray-700">Organization Details</h3>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Organization Name</Label>
                                      <Input 
                                        value={editingCustomer.name}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Brand Name</Label>
                                      <Input 
                                        value={editingCustomer.brandName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, brandName: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Title</Label>
                                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                      <code className="text-sm font-medium text-gray-800">
                                        {editingCustomer.subdomain}
                                      </code>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Title cannot be changed after creation</p>
                                  </div>
                                </div>

                                {/* Administrator Account */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-sm text-gray-700">Administrator Account</h3>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <Label>First Name</Label>
                                      <Input 
                                        value={editingCustomer.adminFirstName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminFirstName: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Last Name</Label>
                                      <Input 
                                        value={editingCustomer.adminLastName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminLastName: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Email</Label>
                                      <Input 
                                        type="email"
                                        value={editingCustomer.adminEmail}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminEmail: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Subscription Section */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-sm text-gray-700">Subscription</h3>
                                  
                                  <div>
                                    <Label>Billing Package</Label>
                                    <select 
                                      className="w-full px-3 py-2 border rounded"
                                      value={editingCustomer.billingPackageId || ''}
                                      onChange={(e) => setEditingCustomer({...editingCustomer, billingPackageId: e.target.value})}
                                    >
                                      <option value="">Select a billing package (optional)</option>
                                      {Array.isArray(billingPackages) && billingPackages.map((pkg: any) => (
                                        <option key={pkg.id} value={pkg.id}>
                                          {pkg.name} - £{pkg.price}/{pkg.billingCycle}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Assign or change billing package for this customer
                                    </p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Subscription Status</Label>
                                      <select 
                                        className="w-full px-3 py-2 border rounded"
                                        value={editingCustomer.subscriptionStatus}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, subscriptionStatus: e.target.value})}
                                      >
                                        <option value="trial">Trial</option>
                                        <option value="active">Active</option>
                                        <option value="expired">Expired</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>
                                    </div>

                                    <div>
                                      <Label>Payment Status</Label>
                                      <select 
                                        className="w-full px-3 py-2 border rounded"
                                        value={editingCustomer.paymentStatus}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, paymentStatus: e.target.value})}
                                      >
                                        <option value="trial">Trial</option>
                                        <option value="paid">Paid</option>
                                        <option value="unpaid">Unpaid</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                      </select>
                                    <div className="text-xs text-gray-500 space-y-1 mt-1">
                                      <div>
                                        <span className="font-semibold">Org row:</span>{" "}
                                        {editingCustomer.organizationPaymentStatus || 'trial'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">Subscription row:</span>{" "}
                                        {editingCustomer.subscriptionPaymentStatus || editingCustomer.paymentStatus || 'trial'}
                                      </div>
                                    </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Details</Label>
                                      <Input
                                        type="text"
                                        value={editingCustomer.details}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, details: e.target.value})}
                                        placeholder="Enter subscription details"
                                      />
                                    </div>

                                    <div>
                                      <Label>Expires At</Label>
                                      <Input
                                        type="datetime-local"
                                        value={editingCustomer.expiresAt}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, expiresAt: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Access Level */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-sm text-gray-700">Access Level</h3>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="radio" 
                                        id="edit-full-access" 
                                        name="editAccessLevel"
                                        checked={editingCustomer.accessLevel === 'full'}
                                        onChange={() => setEditingCustomer({...editingCustomer, accessLevel: 'full'})}
                                      />
                                      <Label htmlFor="edit-full-access" className="cursor-pointer">
                                        <span className="font-medium">Full Access</span> - Complete access to all EMR features
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="radio" 
                                        id="edit-limited-access" 
                                        name="editAccessLevel"
                                        checked={editingCustomer.accessLevel === 'limited'}
                                        onChange={() => setEditingCustomer({...editingCustomer, accessLevel: 'limited'})}
                                      />
                                      <Label htmlFor="edit-limited-access" className="cursor-pointer">
                                        <span className="font-medium">Limited Access</span> - Restricted feature set with custom controls
                                      </Label>
                                    </div>
                                  </div>
                                </div>

                                {/* Feature Configuration */}
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-sm text-gray-700">Feature Configuration</h3>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Maximum Users</Label>
                                      <Input 
                                        type="number" 
                                        min="1"
                                        value={editingCustomer.features.maxUsers}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, maxUsers: parseInt(e.target.value) || 1}
                                        })}
                                      />
                                    </div>
                                    <div>
                                      <Label>Maximum Patients</Label>
                                      <Input 
                                        type="number" 
                                        min="1"
                                        value={editingCustomer.features.maxPatients}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, maxPatients: parseInt(e.target.value) || 1}
                                        })}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between">
                                      <Label>AI Features</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.aiEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, aiEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Telemedicine</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.telemedicineEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, telemedicineEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Billing Module</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.billingEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, billingEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Analytics & Reports</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.analyticsEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, analyticsEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex space-x-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => {
                                      setEditingCustomer(null);
                                      setOriginalCustomerValues(null);
                                    }}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => updateCustomerMutation.mutate(editingCustomer)}
                                    disabled={updateCustomerMutation.isPending}
                                    className="flex-1"
                                  >
                                    {updateCustomerMutation.isPending ? 'Updating...' : 'Update Organization'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {customers?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No customers found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="z-[9999] sm:max-w-md">
          <button
            onClick={() => setIsSuccessModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Organization Created Successfully</DialogTitle>
            </DialogHeader>
            <p className="text-center text-gray-600">
              {successMessage}
            </p>
            <Button 
              onClick={() => setIsSuccessModalOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 px-8"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionsModal} onOpenChange={(open) => {
        if (!open) {
          setShowPermissionsModal(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assigned Permissions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Every new organization receives this default role set with predefined module access.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2">
              {permissionsOverview.map((entry) => (
                <li key={entry.role}>
                  <strong>{entry.role}</strong>: {entry.detail}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handlePermissionsConfirmed}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent className="z-[9999]">
          <DialogHeader>
            <DialogTitle>Customer Creation Failed</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-gray-700">
              {errorMessage}
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => setIsErrorModalOpen(false)} variant="destructive">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="z-[9999]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-gray-700">
              Are you sure you want to delete <strong>{customerToDelete?.name}</strong>? This cannot be undone.
            </p>
          </div>
      <div className="flex justify-center gap-3">
        <Button 
          onClick={() => {
            setIsDeleteDialogOpen(false);
            setCustomerToDelete(null);
          }}
          variant="outline"
        >
          Cancel
        </Button>
        <Button 
          onClick={() => {
            console.log('🗑️ User confirmed deletion, calling API...');
            deleteCustomerMutation.mutate(customerToDelete.id);
            setIsDeleteDialogOpen(false);
            setCustomerToDelete(null);
          }}
          variant="destructive"
          disabled={deleteCustomerMutation.isPending}
        >
          {deleteCustomerMutation.isPending ? 'Deleting...' : 'OK'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
  <Dialog
    open={showUpdateSuccessModal}
    onOpenChange={(open) => {
      setShowUpdateSuccessModal(open);
      if (!open) {
        setUpdateSuccessMessage('');
      }
    }}
  >
      <DialogContent className="max-w-sm z-[9999]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <span className="text-emerald-600">Organization updated</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {updateSuccessMessage || 'your organization has been updated successfully.'}
        </p>
      </div>
      <div className="pt-4 flex justify-end">
        <Button onClick={() => setShowUpdateSuccessModal(false)}>OK</Button>
      </div>
    </DialogContent>
  </Dialog>
</div>
  );
}