import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApiRequest } from '@/lib/saasQueryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2,
  Crown,
  Users,
  Database,
  Zap,
  Shield
} from 'lucide-react';

export default function SaaSPackages() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch packages
  const { data: packages, isLoading } = useQuery({
    queryKey: ['/api/saas/packages'],
  });

  const createPackageMutation = useMutation({
    mutationFn: async (packageData: any) => {
      const response = await saasApiRequest('POST', '/api/saas/packages', packageData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/packages'] });
      setIsCreateModalOpen(false);
      setSuccessMessage("New package created successfully");
      setShowSuccessModal(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create package",
        variant: "destructive",
      });
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, ...packageData }: any) => {
      const response = await saasApiRequest('PUT', `/api/saas/packages/${id}`, packageData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/packages'] });
      setEditingPackage(null);
      setSuccessMessage("Package updated successfully");
      setShowSuccessModal(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update package",
        variant: "destructive",
      });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const response = await saasApiRequest('DELETE', `/api/saas/packages/${packageId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/packages'] });
      setSuccessMessage("Package deleted successfully");
      setShowSuccessModal(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete package",
        variant: "destructive",
      });
    },
  });

  const PackageForm = ({ package: pkg, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState({
      name: pkg?.name || '',
      description: pkg?.description || '',
      price: pkg?.price || '',
      billingCycle: pkg?.billingCycle || 'monthly',
      features: {
        maxUsers: pkg?.features?.maxUsers || 10,
        maxPatients: pkg?.features?.maxPatients || 100,
        aiEnabled: pkg?.features?.aiEnabled || false,
        telemedicineEnabled: pkg?.features?.telemedicineEnabled || false,
        billingEnabled: pkg?.features?.billingEnabled || false,
        analyticsEnabled: pkg?.features?.analyticsEnabled || false,
        customBranding: pkg?.features?.customBranding || false,
        prioritySupport: pkg?.features?.prioritySupport || false,
        storageGB: pkg?.features?.storageGB || 1,
        apiCallsPerMonth: pkg?.features?.apiCallsPerMonth || 1000,
      },
      isActive: pkg?.isActive ?? true,
      showOnWebsite: pkg?.showOnWebsite ?? false,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Package Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Professional Plan"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Price (£)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="29.99"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Package description..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billingCycle">Billing Cycle</Label>
            <select
              id="billingCycle"
              value={formData.billingCycle}
              onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <span className="text-sm">{formData.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>

        {/* Website Integration */}
        <div className="space-y-2">
          <Label htmlFor="website">Website Integration</Label>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              checked={formData.showOnWebsite}
              onCheckedChange={(checked) => setFormData({ ...formData, showOnWebsite: checked })}
            />
            <span className="text-sm">{formData.showOnWebsite ? 'Live on Website' : 'Hidden from Website'}</span>
          </div>
          <p className="text-sm text-gray-500">
            When enabled, this package will appear in the website's pricing section for customer sign-up.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <h4 className="font-medium">Package Features</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max Users</Label>
              <Input
                id="maxUsers"
                type="number"
                value={formData.features.maxUsers}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, maxUsers: parseInt(e.target.value) }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPatients">Max Patients</Label>
              <Input
                id="maxPatients"
                type="number"
                value={formData.features.maxPatients}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, maxPatients: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storageGB">Storage (GB)</Label>
              <Input
                id="storageGB"
                type="number"
                value={formData.features.storageGB}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, storageGB: parseInt(e.target.value) }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiCalls">API Calls/Month</Label>
              <Input
                id="apiCalls"
                type="number"
                value={formData.features.apiCallsPerMonth}
                onChange={(e) => setFormData({
                  ...formData,
                  features: { ...formData.features, apiCallsPerMonth: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>

          {/* Feature toggles */}
          <div className="grid grid-cols-2 gap-4">
            {Object.entries({
              aiEnabled: 'AI Features',
              telemedicineEnabled: 'Telemedicine',
              billingEnabled: 'Billing Module',
              analyticsEnabled: 'Analytics',
              customBranding: 'Custom Branding',
              prioritySupport: 'Priority Support',
            }).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Switch
                  checked={formData.features[key as keyof typeof formData.features] as boolean}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    features: { ...formData.features, [key]: checked }
                  })}
                />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {pkg ? 'Update Package' : 'Create Package'}
          </Button>
        </div>
      </form>
    );
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
              <Package className="h-5 w-5 text-blue-600" />
              <span>Package Management</span>
            </CardTitle>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Package</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Package</DialogTitle>
                </DialogHeader>
                <PackageForm
                  onSubmit={(data: any) => createPackageMutation.mutate(data)}
                  onCancel={() => setIsCreateModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages?.map((pkg: any) => (
              <Card key={pkg.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Crown className="h-5 w-5 text-yellow-600" />
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant={pkg.isActive ? "default" : "secondary"}>
                        {pkg.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {pkg.showOnWebsite && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Live on Website
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-2xl font-bold">
                    £{pkg.price}
                    <span className="text-sm font-normal text-gray-500">
                      /{pkg.billingCycle}
                    </span>
                  </p>
                  {pkg.description && (
                    <p className="text-sm text-gray-600">{pkg.description}</p>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>Users</span>
                      </span>
                      <span>{pkg.features.maxUsers}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center space-x-1">
                        <Database className="h-4 w-4" />
                        <span>Storage</span>
                      </span>
                      <span>{pkg.features.storageGB} GB</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center space-x-1">
                        <Zap className="h-4 w-4" />
                        <span>API Calls</span>
                      </span>
                      <span>
                        {(pkg.features?.apiCallsPerMonth ?? 0).toLocaleString()}/mo
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {pkg.features.aiEnabled && (
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <Shield className="h-3 w-3" />
                        <span>AI Features</span>
                      </div>
                    )}
                    {pkg.features.telemedicineEnabled && (
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <Shield className="h-3 w-3" />
                        <span>Telemedicine</span>
                      </div>
                    )}
                    {pkg.features.prioritySupport && (
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <Shield className="h-3 w-3" />
                        <span>Priority Support</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPackage(pkg)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Package</DialogTitle>
                        </DialogHeader>
                        <PackageForm
                          package={editingPackage}
                          onSubmit={(data: any) => updatePackageMutation.mutate({ id: editingPackage.id, ...data })}
                          onCancel={() => setEditingPackage(null)}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deletePackageMutation.mutate(pkg.id)}
                      disabled={deletePackageMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {packages?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No packages created yet. Create your first package to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-600">Success</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-700">{successMessage}</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessMessage("");
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}