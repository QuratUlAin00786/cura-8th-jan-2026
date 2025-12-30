import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  PoundSterling, 
  Clock,
  Download,
  Filter,
  Activity,
  FileText,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { isDoctorLike } from "@/lib/role-utils";
import { useRolePermissions } from "@/hooks/use-role-permissions";

function getTenantSubdomain(): string {
  return localStorage.getItem('user_subdomain') || 'demo';
}

interface AnalyticsData {
  overview: {
    totalPatients: number;
    newPatients: number;
    totalAppointments: number;
    completedAppointments: number;
    revenue: number;
    averageWaitTime: number;
    patientSatisfaction: number;
    noShowRate: number;
    patientsThisMonth?: number;
    topDoctor?: {
      name: string;
      appointmentCount: number;
    };
    totalRevenue?: number;
    outstandingDues?: number;
    labTestsCount?: number;
    noShowCount?: number;
    cancelledCount?: number;
    topLabTest?: {
      name: string;
      count: number;
    };
    topPaymentMode?: {
      mode: string;
      count: number;
    };
    averageAge?: number;
    maleCount?: number;
    femaleCount?: number;
  };
  trends: {
    patientGrowth: Array<{
      month: string;
      total: number;
      new: number;
    }>;
    appointmentVolume: Array<{
      date: string;
      scheduled: number;
      completed: number;
      cancelled: number;
      noShow: number;
    }>;
    revenue: Array<{
      month: string;
      amount: number;
      target: number;
    }>;
  };
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { canView } = useRolePermissions();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: '30',
    department: 'all',
    provider: 'all',
    patientType: 'all'
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['/api/analytics', user?.id, isDoctorLike(user?.role)],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const url = isDoctorLike(user?.role) && user?.id 
        ? `/api/analytics?doctorId=${user.id}` 
        : '/api/analytics';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': getTenantSubdomain()
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    enabled: !!user
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const handleExport = () => {
    const exportData = {
      overview: analytics.overview,
      trends: analytics.trends,
      generatedAt: new Date().toISOString(),
      dateRange: `${filters.dateRange} days`,
      filters: filters
    };

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Patients', analytics.overview.totalPatients],
      ['New Patients', analytics.overview.newPatients],
      ['Total Appointments', analytics.overview.totalAppointments],
      ['Completed Appointments', analytics.overview.completedAppointments],
      ['Revenue', formatCurrency(analytics.overview.revenue)],
      ['Average Wait Time', `${analytics.overview.averageWaitTime}min`],
      ['Patient Satisfaction', `${analytics.overview.patientSatisfaction}%`],
      ['No Show Rate', `${analytics.overview.noShowRate}%`]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Safe data access with fallbacks
  const analytics = analyticsData as AnalyticsData || {
    overview: {
      totalPatients: 0,
      newPatients: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      revenue: 0,
      averageWaitTime: 0,
      patientSatisfaction: 0,
      noShowRate: 0
    },
    trends: {
      patientGrowth: [],
      appointmentVolume: [],
      revenue: []
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
      <Header title="Analytics Dashboard" subtitle="Comprehensive insights into practice performance" />
      
      <div className="w-full px-4 lg:px-6 py-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
          <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filter Analytics</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dateRange">Date Range</Label>
                  <Select value={filters.dateRange} onValueChange={(value) => setFilters({...filters, dateRange: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 3 months</SelectItem>
                      <SelectItem value="180">Last 6 months</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={filters.department} onValueChange={(value) => setFilters({...filters, department: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="cardiology">Cardiology</SelectItem>
                      <SelectItem value="general">General Practice</SelectItem>
                      <SelectItem value="orthopedics">Orthopedics</SelectItem>
                      <SelectItem value="pediatrics">Pediatrics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={filters.provider} onValueChange={(value) => setFilters({...filters, provider: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      <SelectItem value="dr-smith">Dr. Smith</SelectItem>
                      <SelectItem value="dr-jones">Dr. Jones</SelectItem>
                      <SelectItem value="dr-williams">Dr. Williams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="patientType">Patient Type</Label>
                  <Select value={filters.patientType} onValueChange={(value) => setFilters({...filters, patientType: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Patients</SelectItem>
                      <SelectItem value="new">New Patients</SelectItem>
                      <SelectItem value="returning">Returning Patients</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setIsFilterOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setIsFilterOpen(false)}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Patients</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalPatients.toLocaleString()}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{analytics.overview.newPatients} this month
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Appointments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.totalAppointments.toLocaleString()}</p>
                <p className="text-xs text-blue-600 flex items-center mt-1">
                  {analytics.overview.totalAppointments > 0 ? 
                    Math.round((analytics.overview.completedAppointments / analytics.overview.totalAppointments) * 100) : 0}% completion rate
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(analytics.overview.revenue)}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +5.2% vs last month
                </p>
              </div>
              <PoundSterling className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Wait Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.overview.averageWaitTime}min</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  -2min vs last month
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className={`grid w-full ${isDoctorLike(user?.role) ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            {isDoctorLike(user?.role) ? (
              <>
                <TabsTrigger value="overview">Overview ({user?.firstName} {user?.lastName})</TabsTrigger>
                <TabsTrigger value="patients">Patients ({user?.firstName} {user?.lastName})</TabsTrigger>
                <TabsTrigger value="appointments">My Appointments ({user?.firstName} {user?.lastName})</TabsTrigger>
                <TabsTrigger value="clinical">Clinic ({user?.firstName} {user?.lastName})</TabsTrigger>
                <TabsTrigger value="financial">Financial ({user?.firstName} {user?.lastName})</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="patients">Patients</TabsTrigger>
                <TabsTrigger value="clinical">Clinical</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Compact Analytics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Patients This Month */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Patients</div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Patients (Month)</div>
                  <div className="text-2xl font-bold text-blue-600">{analytics.overview.patientsThisMonth || 0}</div>
                  <div className="text-xs text-gray-500">New registrations</div>
                </Card>
              </div>

              {/* Top Doctor */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Doctors </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Top Doctor</div>
                  <div className="text-sm font-semibold text-green-600 truncate">{analytics.overview.topDoctor?.name || 'No data'}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{analytics.overview.topDoctor?.appointmentCount || 0}</div>
                  <div className="text-xs text-gray-500">Appointments</div>
                </Card>
              </div>

              {/* Total Revenue */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Billing </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(analytics.overview.totalRevenue || 0)}</div>
                  <div className="text-xs text-gray-500">All payments</div>
                </Card>
              </div>

              {/* Outstanding Dues */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Billing </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Outstanding</div>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(analytics.overview.outstandingDues || 0)}</div>
                  <div className="text-xs text-gray-500">Unpaid invoices</div>
                </Card>
              </div>

              {/* Total Lab Tests */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Lab Tests </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Lab Tests (7d)</div>
                  <div className="text-2xl font-bold text-purple-600">{analytics.overview.labTestsCount || 0}</div>
                  <div className="text-xs text-gray-500">Total ordered</div>
                </Card>
              </div>

              {/* Appointments Today */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Appointments </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Appointments</div>
                  <div className="text-2xl font-bold text-blue-600">{analytics.overview.totalAppointments || 0}</div>
                  <div className="text-xs text-gray-500">{analytics.overview.completedAppointments || 0} completed</div>
                </Card>
              </div>

              {/* No-Shows */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Appointments </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">No-Shows</div>
                  <div className="text-2xl font-bold text-red-600">{analytics.overview.noShowCount || 0}</div>
                  <div className="text-xs text-gray-500">{analytics.overview.noShowRate || 0}% rate</div>
                </Card>
              </div>

              {/* Cancellations */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Appointments </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-yellow-600">{analytics.overview.cancelledCount || 0}</div>
                  <div className="text-xs text-gray-500">Appointments</div>
                </Card>
              </div>

              {/* Most Frequent Test */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Lab Tests </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Top Lab Test</div>
                  <div className="text-sm font-semibold text-purple-600 truncate">{analytics.overview.topLabTest?.name || 'No data'}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{analytics.overview.topLabTest?.count || 0}</div>
                  <div className="text-xs text-gray-500">Orders</div>
                </Card>
              </div>

              {/* Payment Mode */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Billing </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Top Payment</div>
                  <div className="text-sm font-semibold text-green-600 truncate">{analytics.overview.topPaymentMode?.mode || 'No data'}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{analytics.overview.topPaymentMode?.count || 0}</div>
                  <div className="text-xs text-gray-500">Transactions</div>
                </Card>
              </div>

              {/* Age Distribution */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Patients </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Age</div>
                  <div className="text-2xl font-bold text-blue-600">{analytics.overview.averageAge || 0}</div>
                  <div className="text-xs text-gray-500">Years</div>
                </Card>
              </div>

              {/* Gender Ratio */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Patients </div>
                <Card className="p-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Gender Ratio</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    M:{analytics.overview.maleCount || 0} F:{analytics.overview.femaleCount || 0}
                  </div>
                  <div className="text-xs text-gray-500">Patients</div>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Patient Growth */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Growth Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.trends.patientGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.8} />
                    <Area type="monotone" dataKey="new" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.8} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Appointment Volume */}
            <Card>
              <CardHeader>
                <CardTitle>Appointment Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.trends.appointmentVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'MMM d')} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" />
                    <Bar dataKey="cancelled" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="noShow" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Patient Satisfaction */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {analytics.overview.patientSatisfaction}/5.0
                  </div>
                  <div className="text-sm text-gray-600">Average Rating</div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-16">No Shows:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${analytics.overview.noShowRate}%` }}></div>
                      </div>
                      <span className="text-sm text-red-600">{analytics.overview.noShowRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="patients" className="space-y-4 lg:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">
            {/* Patient Growth Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Growth Trend</CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Track the growth of total and new patients over time from the patients database
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.trends.patientGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.8} name="Total Patients" />
                    <Area type="monotone" dataKey="new" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.8} name="New Patients" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Appointment Volume */}
            <Card>
              <CardHeader>
                <CardTitle>Appointment Volume</CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  View appointment trends showing scheduled, completed, cancelled, and no-show appointments from the appointments table
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.trends.appointmentVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'MMM d')} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                    <Bar dataKey="cancelled" stackId="a" fill="#f59e0b" name="Cancelled" />
                    <Bar dataKey="noShow" stackId="a" fill="#ef4444" name="No Show" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-6">
            {/* Patient Demographics */}
            <Card>
              <CardHeader>
                <CardTitle>Age Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analyticsData?.patientAnalytics?.demographics?.ageDistribution || {}).map(([key, value]) => ({
                        name: key,
                        value: value as number
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(analyticsData?.patientAnalytics?.demographics?.ageDistribution || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gender Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={Object.entries(analyticsData?.patientAnalytics?.demographics?.genderDistribution || {}).map(([key, value]) => ({
                    gender: key,
                    count: value as number
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="gender" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Top Conditions */}
            <Card>
              <CardHeader>
                <CardTitle>Most Common Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData?.patientAnalytics?.topConditions?.map((condition: any, index: number) => (
                    <div key={condition.condition} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium">{condition.condition}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{condition.count}</div>
                        <div className="text-sm text-gray-500">
                          {analyticsData?.patientAnalytics?.totalPatients > 0 
                            ? Math.round((condition.count / analyticsData.patientAnalytics.totalPatients) * 100) 
                            : 0}% of patients
                        </div>
                      </div>
                    </div>
                  )) || []}
                </div>
              </CardContent>
            </Card>

            {/* Appointment Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Appointment Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Appointments</span>
                    <span className="font-bold text-lg">{analyticsData?.patientAnalytics?.appointmentStats?.total || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-bold text-green-600">{analyticsData?.patientAnalytics?.appointmentStats?.completed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Cancelled</span>
                    <span className="font-bold text-yellow-600">{analyticsData?.patientAnalytics?.appointmentStats?.cancelled || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">No Shows</span>
                    <span className="font-bold text-red-600">{analyticsData?.patientAnalytics?.appointmentStats?.noShow || 0}</span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Completion Rate</span>
                      <span className="font-bold text-blue-600">{analyticsData?.patientAnalytics?.appointmentStats?.completionRate || 0}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Patient Summary</CardTitle>
              </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {analyticsData?.patientAnalytics?.totalPatients || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Patients</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {analyticsData?.patientAnalytics?.newPatients || 0}
                  </div>
                  <div className="text-sm text-gray-600">New Patients (30 days)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analyticsData?.patientAnalytics?.appointmentStats?.completionRate || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Completion Rate</div>
                </div>
              </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isDoctorLike(user?.role) && (
            <TabsContent value="appointments" className="space-y-4 lg:space-y-6">
              {/* My Appointments Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Appointments</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {analyticsData?.overview?.totalAppointments || 0}
                        </p>
                      </div>
                      <Calendar className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                        <p className="text-3xl font-bold text-green-600">
                          {analyticsData?.overview?.completedAppointments || 0}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No-Shows</p>
                        <p className="text-3xl font-bold text-orange-600">
                          {analyticsData?.overview?.noShowCount || 0}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cancelled</p>
                        <p className="text-3xl font-bold text-red-600">
                          {analyticsData?.overview?.cancelledCount || 0}
                        </p>
                      </div>
                      <FileText className="h-8 w-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Appointment Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>My Appointment Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData?.trends?.appointmentVolume || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="scheduled" fill="#0ea5e9" name="Scheduled" />
                      <Bar dataKey="completed" fill="#10b981" name="Completed" />
                      <Bar dataKey="cancelled" fill="#ef4444" name="Cancelled" />
                      <Bar dataKey="noShow" fill="#f59e0b" name="No-Show" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="clinical" className="space-y-4 lg:space-y-6">
            {/* Clinical Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Consultations</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {analyticsData?.clinicalAnalytics?.overview?.totalConsultations || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Prescriptions</p>
                    <p className="text-3xl font-bold text-green-600">
                      {analyticsData?.clinicalAnalytics?.overview?.activePrescriptions || 0}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Medical Records</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {analyticsData?.clinicalAnalytics?.overview?.totalMedicalRecords || 0}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Critical AI Insights</p>
                    <p className="text-3xl font-bold text-red-600">
                      {analyticsData?.clinicalAnalytics?.overview?.criticalInsights || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                </CardContent>
              </Card>
            </div>

            {/* Clinical Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Top Medications */}
            <Card>
              <CardHeader>
                <CardTitle>Top Prescribed Medications</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData?.clinicalAnalytics?.medications?.topMedications || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="medication" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Consultation Types */}
            <Card>
              <CardHeader>
                <CardTitle>Consultation Types Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analyticsData?.clinicalAnalytics?.consultationTypes || {}).map(([type, count]) => ({
                        name: type.charAt(0).toUpperCase() + type.slice(1),
                        value: count as number
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* AI Insights Severity */}
            <Card>
              <CardHeader>
                <CardTitle>AI Insights by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(analyticsData?.clinicalAnalytics?.aiInsights?.severityDistribution || {}).map(([severity, count]) => ({
                    severity: severity.charAt(0).toUpperCase() + severity.slice(1),
                    count: count as number
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Clinical Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity (7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="font-medium">Consultations</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      {analyticsData?.clinicalAnalytics?.recentActivity?.consultations || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 text-green-600 mr-2" />
                      <span className="font-medium">Prescriptions</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {analyticsData?.clinicalAnalytics?.recentActivity?.prescriptions || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="font-medium">AI Insights</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">
                      {analyticsData?.clinicalAnalytics?.recentActivity?.insights || 0}
                    </span>
                  </div>
                </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
            <CardHeader>
              <CardTitle>Clinical Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {analyticsData?.clinicalAnalytics?.overview?.consultationCompletionRate || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Consultation Completion Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {analyticsData?.clinicalAnalytics?.overview?.prescriptionActiveRate || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Active Prescription Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analyticsData?.clinicalAnalytics?.medications?.totalTypes || 0}
                  </div>
                  <div className="text-sm text-gray-600">Medication Types</div>
                </div>
              </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4 lg:space-y-6">
            <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analytics.trends.revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} />
                  <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}