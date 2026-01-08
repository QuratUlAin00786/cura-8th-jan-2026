import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Users, Calendar, Zap, Check, X, Package, Heart, Brain, Shield, Stethoscope, Phone, FileText, Activity, Pill, UserCheck, TrendingUp, Download, CreditCard, Printer } from "lucide-react";
import { PaymentMethodDialog } from "@/components/payment-method-dialog";
import { getTenantSubdomain } from "@/lib/queryClient";
import InvoiceTemplate from "@/pages/saas/components/InvoiceTemplate";
import type { Subscription } from "@/types";
import type { SaaSPackage } from "@shared/schema";

// Plans are now fetched from database - see dbPackages query below

// Helper function to map package names to icons
const getPackageIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('telehealth') || lowerName.includes('video') || lowerName.includes('phone')) return Phone;
  if (lowerName.includes('ai') || lowerName.includes('brain') || lowerName.includes('clinical')) return Brain;
  if (lowerName.includes('cardio') || lowerName.includes('heart')) return Heart;
  if (lowerName.includes('pharmacy') || lowerName.includes('drug') || lowerName.includes('medication')) return Pill;
  if (lowerName.includes('analytics') || lowerName.includes('reporting') || lowerName.includes('activity')) return Activity;
  if (lowerName.includes('patient') || lowerName.includes('portal')) return UserCheck;
  if (lowerName.includes('security') || lowerName.includes('hipaa') || lowerName.includes('compliance')) return Shield;
  if (lowerName.includes('specialty') || lowerName.includes('stethoscope')) return Stethoscope;
  if (lowerName.includes('document') || lowerName.includes('file')) return FileText;
  return Package; // Default icon
};

// Helper function to convert database features to array of strings
const formatPackageFeatures = (features: any): string[] => {
  if (!features) return [];
  
  const featureList: string[] = [];
  
  if (features.maxUsers) featureList.push(`Up to ${features.maxUsers} users`);
  if (features.maxPatients) featureList.push(`Up to ${features.maxPatients} patients`);
  if (features.aiEnabled) featureList.push('AI-powered insights');
  if (features.telemedicineEnabled) featureList.push('Telemedicine support');
  if (features.billingEnabled) featureList.push('Advanced billing');
  if (features.analyticsEnabled) featureList.push('Analytics & reporting');
  if (features.customBranding) featureList.push('Custom branding');
  if (features.prioritySupport) featureList.push('Priority support');
  if (features.storageGB) featureList.push(`${features.storageGB}GB storage`);
  if (features.apiCallsPerMonth) featureList.push(`${features.apiCallsPerMonth.toLocaleString()} API calls/month`);
  
  return featureList;
};

const getCountdown = (target?: string | Date | null) => {
  if (!target) return { label: "N/A", isDanger: false };
  const parts = parseDateParts(target);
  if (!parts) return { label: "N/A", isDanger: false };
  const due = new Date(parts.year, parts.month, parts.day, parts.hour, parts.minute);
  const diffMs = due.getTime() - Date.now();
  if (diffMs <= 0) {
    return { label: "Expired", isDanger: true };
  }
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  const labelParts = [];
  if (days) labelParts.push(`${days}d`);
  if (hours || days) labelParts.push(`${hours}h`);
  if (minutes || hours || days) labelParts.push(`${minutes}m`);
  labelParts.push(`${seconds}s`);
  return {
    label: labelParts.join(" "),
    isDanger: diffMs <= 24 * 60 * 60 * 1000,
  };
};

const parseDateParts = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getFullYear(),
      month: value.getMonth(),
      day: value.getDate(),
      hour: value.getHours(),
      minute: value.getMinutes(),
    };
  }
  const str = String(value);
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!isoMatch) return null;
  const [, y, mo, d, hh, mm] = isoMatch;
  return {
    year: Number(y),
    month: Number(mo) - 1,
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
  };
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const formatDate = (date?: string | Date | null) => {
  const parts = parseDateParts(date);
  if (!parts) return "Not set";
  return `${parts.day.toString().padStart(2, "0")} ${monthNames[parts.month]} ${parts.year}`;
};

const formatDateTime = (value?: string | Date | null) => {
  const parts = parseDateParts(value);
  if (!parts) return "Not set";
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  const period = parts.hour >= 12 ? "pm" : "am";
  const minute = parts.minute.toString().padStart(2, "0");
  return `${parts.day.toString().padStart(2, "0")} ${monthNames[parts.month]} ${parts.year}, ${hour12}:${minute} ${period}`;
};

export default function Subscription() {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCurrentPlanDialog, setShowCurrentPlanDialog] = useState(false);
  const [currentPlanData, setCurrentPlanData] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'ryft' | 'paypal' | 'stripe'>('ryft');
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleStripeCheckout = async (plan: any) => {
    setIsStripeLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tenant-Subdomain': subdomain
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          amount: plan.price
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received:', data);
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Stripe checkout:', error);
      alert('Failed to connect to payment service. Please try again.');
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handleInvoicePayment = async (payment: any) => {
    setIsStripeLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tenant-Subdomain': subdomain
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          planId: payment.id,
          planName: `Invoice ${payment.invoiceNumber}`,
          amount: parseFloat(payment.amount)
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL received:', data);
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Stripe checkout:', error);
      alert('Failed to connect to payment service. Please try again.');
    } finally {
      setIsStripeLoading(false);
    }
  };
  
  const { data: subscription, isLoading, error } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: dbPackages = [], isLoading: packagesLoading } = useQuery<SaaSPackage[]>({
    queryKey: ["/api/website/packages"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': subdomain
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch("/api/website/packages", {
        credentials: "include",
        headers
      });
      if (!res.ok) throw new Error('Failed to fetch packages');
      return res.json();
    }
  });

  // Fetch billing history
  const { data: billingHistory = [], isLoading: billingLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-history"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': subdomain
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch("/api/billing-history", {
        credentials: "include",
        headers
      });
      if (!res.ok) throw new Error('Failed to fetch billing history');
      return res.json();
    }
  });

  // Split packages into subscription plans (have maxUsers) and add-ons (don't have maxUsers)
  const dbPlans = dbPackages.filter(pkg => pkg.features?.maxUsers);
  const dbAddons = dbPackages.filter(pkg => !pkg.features?.maxUsers);

  // Transform database plans to component format for "Available Plans" section
  const plans = dbPlans.map(pkg => ({
    id: pkg.id.toString(),
    name: pkg.name,
    price: parseFloat(pkg.price),
    userLimit: pkg.features?.maxUsers || 0,
    popular: pkg.name.toLowerCase().includes('professional') || pkg.name.toLowerCase().includes('pro'),
    features: formatPackageFeatures(pkg.features),
    notIncluded: [] as string[] // Database doesn't store not-included features
  }));

  // Transform database add-ons to component format for "Add-on Packages" section
  const packages = dbAddons.map(pkg => ({
    id: pkg.id.toString(),
    name: pkg.name,
    price: parseFloat(pkg.price),
    icon: getPackageIcon(pkg.name),
    description: pkg.description || '',
    features: formatPackageFeatures(pkg.features)
  }));

  const [countdown, setCountdown] = useState<{ label: string; isDanger: boolean }>({
    label: "Loading...",
    isDanger: false,
  });
  const userRole = localStorage.getItem("user_role");
  const isSaasAdmin = userRole === "admin";

  useEffect(() => {
    if (!subscription?.nextBillingAt) {
      setCountdown({ label: "Not scheduled", isDanger: false });
      return;
    }
    const update = () => {
      setCountdown(getCountdown(subscription.nextBillingAt));
    };
    update();
    const timer = setInterval(update, 15 * 1000);
    return () => clearInterval(timer);
  }, [subscription?.nextBillingAt]);

  if (isLoading || packagesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
        <Header 
          title="Subscription" 
          subtitle="Manage your subscription and billing."
        />
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
      <Header 
        title="Subscription" 
        subtitle="Manage your subscription and billing."
      />
      <div className="w-full flex-1 overflow-auto bg-white dark:bg-gray-900 px-4 lg:px-6 py-6">
        <div className="space-y-6">
          {/* Current Subscription */}
          {subscription && (
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <Crown className="h-5 w-5 text-primary" />
                  <span>Current Subscription</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-4 w-4" />
                      <span>Active Plan</span>
                    </div>
                    <p className="text-2xl font-bold capitalize">
                      {subscription.planName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        className={
                          subscription.status === 'active' 
                            ? "bg-green-500 text-white" 
                            : subscription.status === 'trial'
                            ? "bg-blue-500 text-white"
                            : subscription.status === 'expired'
                            ? "bg-red-500 text-white"
                            : "bg-yellow-500 text-white"
                        }
                      >
                        {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                      </Badge>
                      {subscription.paymentStatus && (
                        <Badge 
                          className={
                            subscription.paymentStatus === 'paid' 
                              ? "bg-green-600 text-white" 
                              : subscription.paymentStatus === 'trial'
                              ? "bg-blue-600 text-white"
                              : subscription.paymentStatus === 'unpaid'
                              ? "bg-orange-500 text-white"
                              : subscription.paymentStatus === 'failed'
                              ? "bg-red-600 text-white"
                              : "bg-gray-500 text-white"
                          }
                        >
                          Payment: {subscription.paymentStatus.charAt(0).toUpperCase() + subscription.paymentStatus.slice(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>User Capacity</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {subscription.currentUsers} <span className="text-lg text-muted-foreground">/ {subscription.userLimit}</span>
                    </p>
                    <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all" 
                        style={{ 
                          width: `${Math.min((subscription.currentUsers / subscription.userLimit) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {subscription.status === 'trial' ? 'Trial Period' : 'Billing Cycle'}
                      </span>
                    </div>
                    <p className="text-xl font-bold">
                      {subscription.nextBillingAt 
                        ? formatDateTime(subscription.nextBillingAt)
                        : "—"
                      }
                    </p>
                    {subscription.monthlyPrice && (
                      <p className="text-sm text-muted-foreground">
                        <span className="text-lg font-semibold text-foreground">£{subscription.monthlyPrice}</span>/month
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {subscription && (
            <Card>
              <CardHeader>
                <CardTitle>Current SaaS Subscription Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Created at: {formatDateTime(subscription.createdAt)}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Package</p>
                    <p className="text-lg font-semibold">{subscription.planName || subscription.plan || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold">
                      {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className="text-lg font-semibold">
                      {subscription.paymentStatus || "pending"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                    <p className="text-lg font-semibold">£{subscription.monthlyPrice || "0"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Next billing</p>
                    <p className="text-lg font-semibold">
                      {subscription.nextBillingAt ? formatDateTime(subscription.nextBillingAt) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Countdown</p>
                    <p className={`text-lg font-semibold ${countdown.isDanger ? "text-red-600" : "text-emerald-600"}`}>
                      {countdown.label}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Plans */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Available Plans</h3>
              <p className="text-sm text-muted-foreground">Select a plan that fits your practice needs</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative flex flex-col h-full ${
                    plan.popular 
                      ? "border-primary" 
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-primary text-primary-foreground">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pt-6">
                    <CardTitle className="text-xl mb-4">{plan.name}</CardTitle>
                    <div className="space-y-2">
                      <div>
                        <span className="text-4xl font-bold">
                          £{plan.price}
                        </span>
                        <span className="text-muted-foreground ml-2">/month</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Up to {plan.userLimit} users</span>
                      </div>
                    </div>
                  </CardHeader>
                  
                <CardContent className="space-y-4 flex-1">
                    <div className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                      
                      {plan.notIncluded.map((feature, index) => (
                        <div key={index} className="flex items-start space-x-2 opacity-50">
                          <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-sm line-through">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button 
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={isStripeLoading}
                      onClick={() => {
                        if (subscription?.plan === plan.id) {
                          setCurrentPlanData(plan);
                          setShowCurrentPlanDialog(true);
                        } else {
                          handleStripeCheckout(plan);
                        }
                      }}
                      data-testid={`button-plan-${plan.id}`}
                    >
                      {isStripeLoading ? "Loading..." : (
                        subscription?.plan === plan.id 
                          ? "✓ Current Plan" 
                          : subscription?.status === 'trial' 
                          ? "Start Free Trial"
                          : "Upgrade Now"
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Add-on Packages */}
          {packages.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Add-on Packages</h3>
                <p className="text-sm text-muted-foreground">Extend your capabilities with specialized modules</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => {
                  const IconComponent = pkg.icon;
                  return (
                    <Card key={pkg.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold">£{pkg.price}</span>
                            <span className="text-sm text-muted-foreground">/mo</span>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{pkg.name}</h3>
                          <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          {pkg.features.map((feature, index) => (
                            <div key={index} className="flex items-start space-x-2">
                              <Check className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                        
                        <Button 
                          className="w-full"
                          onClick={() => {
                            console.log('Selected package:', pkg.id);
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Add to Plan
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span>Billing History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : billingHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-semibold mb-2">No billing history yet</h4>
                  <p className="text-sm text-muted-foreground">
                    Billing records will appear here once your subscription becomes active.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {billingHistory.map((payment: any) => (
                        <tr key={payment.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{payment.invoiceNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">
                            {payment.currency} {parseFloat(payment.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge 
                              className={
                                payment.paymentStatus === 'completed' ? 'bg-green-500 text-white' :
                                payment.paymentStatus === 'pending' ? 'bg-yellow-500 text-white' :
                                payment.paymentStatus === 'failed' ? 'bg-red-500 text-white' :
                                ''
                              }
                            >
                              {payment.paymentStatus}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm capitalize">
                            {payment.paymentMethod.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {new Date(payment.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(payment.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  const dueDate = new Date(payment.periodEnd);
                                  dueDate.setDate(dueDate.getDate() + 30);
                                  setSelectedInvoice({
                                    id: payment.id,
                                    invoiceNumber: payment.invoiceNumber,
                                    organizationName: subscription?.plan || 'Organization',
                                    organizationAddress: `${subscription?.plan || 'Healthcare'}\nHealthcare Organization\nUnited Kingdom`,
                                    amount: payment.amount,
                                    currency: payment.currency || 'GBP',
                                    paymentMethod: payment.paymentMethod,
                                    paymentStatus: payment.paymentStatus,
                                    createdAt: payment.paymentDate || payment.periodStart,
                                    dueDate: dueDate.toISOString(),
                                    description: `Monthly subscription payment - ${subscription?.plan || 'Subscription'}`
                                  });
                                  setShowInvoiceDialog(true);
                                }}
                                data-testid={`button-download-invoice-${payment.id}`}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Invoice
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Current Plan Payment Dialog */}
      <Dialog open={showCurrentPlanDialog} onOpenChange={setShowCurrentPlanDialog}>
        <DialogContent className="sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5" />
              Manage {currentPlanData?.name}
            </DialogTitle>
          </DialogHeader>
          
          {currentPlanData && (
            <div className="space-y-6">
              {/* Plan Details */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentPlanData.name}</h3>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">£{currentPlanData.price}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">/month</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4" />
                  <span>Up to {currentPlanData.userLimit} users</span>
                </div>
                
                <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">30-day money-back guarantee</span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <Tabs value={selectedPaymentMethod} onValueChange={(value) => setSelectedPaymentMethod(value as 'ryft' | 'paypal' | 'stripe')} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="ryft">Ryft</TabsTrigger>
                  <TabsTrigger value="paypal">PayPal</TabsTrigger>
                  <TabsTrigger value="stripe">Stripe</TabsTrigger>
                </TabsList>
                
                <TabsContent value="ryft" className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-2">
                    <Shield className="h-4 w-4" />
                    <span>Secured by Ryft</span>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">Secure Payment with Ryft</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      PCI DSS Level 1 certified payment processing with advanced fraud protection and real-time transaction monitoring.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-blue-700 dark:text-blue-300">
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>256-bit SSL encryption</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>FCA regulated</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    data-testid="button-pay-ryft"
                  >
                    Pay £{currentPlanData.price}/month with Ryft
                  </Button>
                </TabsContent>
                
                <TabsContent value="paypal" className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                    <Shield className="h-4 w-4" />
                    <span>Secured by PayPal</span>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">Secure Payment with PayPal</h4>
                    <p className="text-sm text-muted-foreground">
                      Industry-leading security with buyer protection and fraud monitoring for safe online transactions.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>Buyer protection</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>Secure checkout</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    data-testid="button-pay-paypal"
                  >
                    Pay £{currentPlanData.price}/month with PayPal
                  </Button>
                </TabsContent>
                
                <TabsContent value="stripe" className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                    <Shield className="h-4 w-4" />
                    <span>Secured by Stripe</span>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">Secure Payment with Stripe</h4>
                    <p className="text-sm text-muted-foreground">
                      PCI-certified payment platform with advanced security features and real-time fraud detection.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>PCI DSS compliant</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>3D Secure</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    data-testid="button-pay-stripe"
                  >
                    Pay £{currentPlanData.price}/month with Stripe
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Terms */}
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                By proceeding, you agree to our Terms of Service and Privacy Policy. You can cancel your subscription at any time.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Payment Method Dialog */}
      {selectedPlan && (
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          plan={selectedPlan}
        />
      )}

      {/* Invoice Viewer Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>Invoice #{selectedInvoice?.invoiceNumber}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => {
                  if (invoiceRef.current) {
                    const printContent = invoiceRef.current.innerHTML;
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Invoice ${selectedInvoice?.invoiceNumber}</title>
                            <style>
                              body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; }
                              @media print { body { padding: 0; } }
                            </style>
                          </head>
                          <body>${printContent}</body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }
                }} 
                variant="outline" 
                size="sm" 
                className="gap-2"
                data-testid="button-print-invoice"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={() => setShowInvoiceDialog(false)} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceTemplate ref={invoiceRef} invoice={selectedInvoice} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
