import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  ShoppingBag,
  CreditCard,
  Banknote,
  Shield,
  Receipt,
  Trash2,
  Eye,
  X,
  User,
  Phone,
  FileText,
} from "lucide-react";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  salePrice: string;
  currentStock: number;
  prescriptionRequired: boolean;
}

interface CartItem {
  itemId: number;
  itemName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  maxStock: number;
  prescriptionRequired: boolean;
}

interface Sale {
  id: number;
  saleNumber: string;
  invoiceNumber: string;
  saleType: string;
  customerName: string | null;
  totalAmount: string;
  paymentStatus: string;
  status: string;
  saleDate: string;
}

interface Payment {
  method: 'cash' | 'card' | 'insurance' | 'credit_note';
  amount: number;
  cardLast4?: string;
  cardType?: string;
  authorizationCode?: string;
  insuranceProviderId?: number;
  claimNumber?: string;
}

interface SaleItem {
  id: number;
  itemId: number;
  itemName: string;
  batchId: number;
  batchNumber: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  discountPercent: string;
}

interface SalePayment {
  id: number;
  paymentMethod: string;
  amount: string;
  status: string;
}

interface SaleDetails extends Sale {
  subtotalAmount: string;
  taxAmount: string;
  discountAmount: string;
  items?: SaleItem[];
  payments?: SalePayment[];
}

interface SaleCreatePayload {
  saleType: 'walk_in' | 'prescription';
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: number;
  items: Array<{
    itemId: number;
    quantity: number;
    discountPercent?: number;
  }>;
  payments: Array<{
    method: 'cash' | 'card' | 'insurance' | 'credit_note';
    amount: number;
    cardLast4?: string;
    cardType?: string;
    authorizationCode?: string;
    insuranceProviderId?: number;
    claimNumber?: string;
  }>;
  discountType?: 'percentage' | 'fixed';
  discountAmount?: number;
  notes?: string;
}

export default function PharmacySales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showPOSDialog, setShowPOSDialog] = useState(false);
  const [showSaleDetailsDialog, setShowSaleDetailsDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleType, setSaleType] = useState<'walk_in' | 'prescription'>('walk_in');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountAmount, setDiscountAmount] = useState(0);
  
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const showFeedback = (type: "success" | "error", title: string, message: string, details?: string) => {
    setFeedbackModal({ isOpen: true, type, title, message, details });
  };

  const closeFeedback = () => {
    setFeedbackModal(prev => ({ ...prev, isOpen: false }));
  };

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/items'],
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['/api/inventory/sales'],
  });

  const { data: saleDetails } = useQuery<SaleDetails>({
    queryKey: ['/api/inventory/sales', selectedSale?.id],
    enabled: !!selectedSale?.id,
    queryFn: async ({ queryKey }) => {
      const [, saleId] = queryKey;
      const response = await apiRequest("GET", `/api/inventory/sales/${saleId}`);
      return response.json();
    },
  });

  const handleSaleTypeChange = (newType: 'walk_in' | 'prescription') => {
    if (newType === 'walk_in' && cart.some(c => c.prescriptionRequired)) {
      toast({
        title: "Cannot change to Walk-in",
        description: "Cart contains prescription-only items. Remove them first or keep as Prescription sale.",
        variant: "destructive"
      });
      return;
    }
    setSaleType(newType);
  };

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: SaleCreatePayload) => {
      const response = await apiRequest('POST', '/api/inventory/sales', saleData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      resetPOS();
      setShowPOSDialog(false);
      showFeedback(
        "success",
        "Sale Completed",
        "Your sale has been processed successfully.",
        data?.saleNumber ? `Sale #${data.saleNumber}` : undefined
      );
    },
    onError: (error: Error) => {
      showFeedback(
        "error",
        "Sale Failed",
        "There was an error processing your sale.",
        error.message
      );
    },
  });

  const voidSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/inventory/sales/${saleId}/void`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      setShowSaleDetailsDialog(false);
      showFeedback(
        "success",
        "Sale Voided",
        "The sale has been voided successfully and stock has been restored."
      );
    },
    onError: (error: Error) => {
      showFeedback(
        "error",
        "Void Failed",
        "There was an error voiding the sale.",
        error.message
      );
    },
  });

  const resetPOS = () => {
    setCart([]);
    setSaleType('walk_in');
    setCustomerName('');
    setCustomerPhone('');
    setSearchQuery('');
    setPayments([]);
    setNotes('');
    setDiscountType('percentage');
    setDiscountAmount(0);
  };

  const filteredItems = items.filter(item =>
    item.currentStock > 0 &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addToCart = (item: InventoryItem) => {
    if (item.prescriptionRequired && saleType === 'walk_in') {
      toast({ 
        title: "Prescription Required", 
        description: `${item.name} requires a prescription. Please change sale type to Prescription.`,
        variant: "destructive" 
      });
      return;
    }

    const existingItem = cart.find(c => c.itemId === item.id);
    if (existingItem) {
      if (existingItem.quantity < item.currentStock) {
        setCart(cart.map(c =>
          c.itemId === item.id
            ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice * (1 - c.discountPercent / 100) }
            : c
        ));
      } else {
        toast({ title: "Insufficient stock", variant: "destructive" });
      }
    } else {
      const unitPrice = parseFloat(item.salePrice);
      setCart([...cart, {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        quantity: 1,
        unitPrice,
        discountPercent: 0,
        lineTotal: unitPrice,
        maxStock: item.currentStock,
        prescriptionRequired: item.prescriptionRequired,
      }]);
    }
    setSearchQuery('');
  };

  const updateCartItem = (itemId: number, field: 'quantity' | 'discountPercent', value: number) => {
    setCart(cart.map(c => {
      if (c.itemId !== itemId) return c;
      const updated = { ...c, [field]: value };
      if (field === 'quantity' && value > c.maxStock) {
        toast({ title: "Insufficient stock", variant: "destructive" });
        return c;
      }
      updated.lineTotal = updated.quantity * updated.unitPrice * (1 - updated.discountPercent / 100);
      return updated;
    }));
  };

  const removeFromCart = (itemId: number) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  const subtotal = cart.reduce((sum, c) => sum + c.lineTotal, 0);
  const orderDiscount = discountType === 'percentage' 
    ? subtotal * (discountAmount / 100) 
    : discountAmount;
  const total = subtotal - orderDiscount;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const amountDue = Math.max(0, total - totalPaid);
  const changeGiven = Math.max(0, totalPaid - total);

  const addPayment = (method: Payment['method']) => {
    setPayments([...payments, { method, amount: amountDue }]);
  };

  const updatePayment = (index: number, amount: number) => {
    setPayments(payments.map((p, i) => i === index ? { ...p, amount } : p));
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    if (totalPaid < total) {
      toast({ title: "Payment incomplete", variant: "destructive" });
      return;
    }

    createSaleMutation.mutate({
      saleType,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      items: cart.map(c => ({
        itemId: c.itemId,
        quantity: c.quantity,
        discountPercent: c.discountPercent,
      })),
      payments,
      discountType: discountAmount > 0 ? discountType : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      notes: notes || undefined,
    });
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'insurance': return <Shield className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Completed</Badge>;
      case 'voided':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Voided</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pharmacy Sales</h2>
          <p className="text-muted-foreground">Point of sale for prescription and walk-in sales</p>
        </div>
        <Button onClick={() => setShowPOSDialog(true)} data-testid="button-new-sale">
          <Plus className="h-4 w-4 mr-2" />
          New Sale
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Recent Sales
          </CardTitle>
          <CardDescription>View and manage pharmacy sales transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sales...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sales recorded yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                    <TableCell className="font-mono text-sm">{sale.saleNumber}</TableCell>
                    <TableCell className="font-mono text-sm">{sale.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sale.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'}
                      </Badge>
                    </TableCell>
                    <TableCell>{sale.customerName || 'Walk-in Customer'}</TableCell>
                    <TableCell className="font-medium">${parseFloat(sale.totalAmount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={sale.paymentStatus === 'paid' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}>
                        {sale.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(sale.status)}</TableCell>
                    <TableCell>{format(new Date(sale.saleDate), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowSaleDetailsDialog(true);
                        }}
                        data-testid={`button-view-sale-${sale.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPOSDialog} onOpenChange={setShowPOSDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Point of Sale
            </DialogTitle>
            <DialogDescription>Create a new pharmacy sale</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sale Type</Label>
                  <Select value={saleType} onValueChange={(v) => handleSaleTypeChange(v as 'walk_in' | 'prescription')}>
                    <SelectTrigger data-testid="select-sale-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in" data-testid="select-item-walk-in">Walk-in</SelectItem>
                      <SelectItem value="prescription" data-testid="select-item-prescription">Prescription</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Customer Name
                  </Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Optional"
                    data-testid="input-customer-name"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone
                  </Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Optional"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>

              <div>
                <Label>Search Items</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="pl-10"
                    data-testid="input-search-items"
                  />
                </div>
                {searchQuery && (
                  <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                      <div className="p-3 text-muted-foreground text-center">No items found</div>
                    ) : (
                      filteredItems.slice(0, 10).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 hover-elevate cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                          onClick={() => addToCart(item)}
                          data-testid={`item-search-result-${item.id}`}
                        >
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              SKU: {item.sku} | Stock: {item.currentStock}
                            </div>
                          </div>
                          <div className="font-medium">${parseFloat(item.salePrice).toFixed(2)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Cart Items</Label>
                <div className="border rounded-md">
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Cart is empty. Search and add items above.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-20">Disc%</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map((item) => (
                          <TableRow key={item.itemId} data-testid={`cart-item-${item.itemId}`}>
                            <TableCell>
                              <div className="font-medium">{item.itemName}</div>
                              <div className="text-xs text-muted-foreground">
                                ${item.unitPrice.toFixed(2)} each
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={item.maxStock}
                                value={item.quantity}
                                onChange={(e) => updateCartItem(item.itemId, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-16 h-8"
                                data-testid={`input-cart-qty-${item.itemId}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={item.discountPercent}
                                onChange={(e) => updateCartItem(item.itemId, 'discountPercent', parseFloat(e.target.value) || 0)}
                                className="w-16 h-8"
                                data-testid={`input-cart-disc-${item.itemId}`}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${item.lineTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.itemId)}
                                className="h-8 w-8"
                                data-testid={`button-remove-cart-${item.itemId}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1">Discount</span>
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8"
                      data-testid="input-order-discount"
                    />
                    <span className="w-20 text-right">-${orderDiscount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => addPayment('cash')} data-testid="button-add-cash">
                      <Banknote className="h-4 w-4 mr-1" /> Cash
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addPayment('card')} data-testid="button-add-card">
                      <CreditCard className="h-4 w-4 mr-1" /> Card
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => addPayment('insurance')} data-testid="button-add-insurance">
                      <Shield className="h-4 w-4 mr-1" /> Insurance
                    </Button>
                  </div>

                  {payments.map((payment, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      {getPaymentIcon(payment.method)}
                      <span className="capitalize flex-1">{payment.method}</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) => updatePayment(index, parseFloat(e.target.value) || 0)}
                        className="w-24 h-8"
                        data-testid={`input-payment-amount-${index}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePayment(index)}
                        className="h-8 w-8"
                        data-testid={`button-remove-payment-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Separator />
                  <div className="flex justify-between">
                    <span>Amount Paid</span>
                    <span>${totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Amount Due</span>
                    <span className={amountDue > 0 ? 'text-red-500' : 'text-green-500'}>
                      ${amountDue.toFixed(2)}
                    </span>
                  </div>
                  {changeGiven > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Change</span>
                      <span>${changeGiven.toFixed(2)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div>
                <Label className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional sale notes..."
                  rows={2}
                  data-testid="textarea-sale-notes"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetPOS}
                  data-testid="button-clear-sale"
                >
                  Clear
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCompleteSale}
                  disabled={cart.length === 0 || totalPaid < total || createSaleMutation.isPending}
                  data-testid="button-complete-sale"
                >
                  {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaleDetailsDialog} onOpenChange={setShowSaleDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              {selectedSale?.saleNumber} - {selectedSale?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {saleDetails ? (
            <div className="space-y-4" data-testid="sale-details-content">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p data-testid="text-sale-customer">{saleDetails.customerName || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p data-testid="text-sale-date">{format(new Date(saleDetails.saleDate), 'PPpp')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <Badge variant="outline" data-testid="badge-sale-type">
                    {saleDetails.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  {getStatusBadge(saleDetails.status)}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <Table data-testid="table-sale-items">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleDetails.items?.map((item) => (
                      <TableRow key={item.id} data-testid={`row-sale-item-${item.id}`}>
                        <TableCell>{item.itemName}</TableCell>
                        <TableCell className="font-mono text-sm">{item.batchNumber || '-'}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${parseFloat(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${parseFloat(item.totalPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Payments</Label>
                  <div className="space-y-2 mt-2" data-testid="sale-payments-list">
                    {saleDetails.payments?.map((payment, index) => (
                      <div key={index} className="flex items-center gap-2" data-testid={`payment-item-${index}`}>
                        {getPaymentIcon(payment.paymentMethod)}
                        <span className="capitalize">{payment.paymentMethod}</span>
                        <span className="ml-auto font-medium">${parseFloat(payment.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span data-testid="text-sale-subtotal">${parseFloat(saleDetails.subtotalAmount || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span data-testid="text-sale-tax">${parseFloat(saleDetails.taxAmount || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span data-testid="text-sale-discount">-${parseFloat(saleDetails.discountAmount || '0').toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span data-testid="text-sale-total">${parseFloat(saleDetails.totalAmount || '0').toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {saleDetails.status !== 'voided' && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt('Please enter a reason for voiding this sale:');
                      if (reason && reason.length >= 5) {
                        voidSaleMutation.mutate({ saleId: selectedSale!.id, reason });
                      } else if (reason) {
                        toast({ title: "Void reason must be at least 5 characters", variant: "destructive" });
                      }
                    }}
                    disabled={voidSaleMutation.isPending}
                    data-testid="button-void-sale"
                  >
                    {voidSaleMutation.isPending ? 'Voiding...' : 'Void Sale'}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedback}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        details={feedbackModal.details}
      />
    </div>
  );
}
