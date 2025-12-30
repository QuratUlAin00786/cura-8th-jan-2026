import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InventoryItem {
  id: number;
  name: string;
  purchasePrice: string;
  unitOfMeasurement: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierName: string;
  status: string;
  totalAmount: string;
  expectedDeliveryDate?: string;
}

interface PurchaseOrderItem {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: string;
}

interface PurchaseOrderDetail {
  id: number;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  status: string;
  totalAmount: string;
  taxAmount: string;
  discountAmount: string;
  notes?: string | null;
  supplierName: string;
  supplierEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  emailSent: boolean;
  emailSentAt?: string | null;
  itemsOrdered: Array<{
    id: number;
    itemId: number;
    itemName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
}
interface GoodsReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
}

interface ReceiptItem {
  itemId: number;
  itemName: string;
  quantityReceived: number;
  unitPrice: string;
  batchNumber: string;
  expiryDate: string;
  manufacturingDate: string;
}

// Validation schema for goods receipt form
const goodsReceiptSchema = z.object({
  purchaseOrderId: z.number().min(1, "Purchase order is required"),
  receivedDate: z.string().min(1, "Received date is required"),
  notes: z.string().optional(),
});

// Validation schema for adding new items
const addItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required"),
  quantityReceived: z.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.string().min(1, "Unit price is required").regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  batchNumber: z.string().min(1, "Batch number is required"),
  expiryDate: z.string().optional(),
  manufacturingDate: z.string().optional(),
});

type GoodsReceiptFormData = z.infer<typeof goodsReceiptSchema>;
type AddItemFormData = z.infer<typeof addItemSchema>;

export default function GoodsReceiptDialog({ open, onOpenChange, items }: GoodsReceiptDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading: purchaseOrdersLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/inventory/purchase-orders"],
    enabled: true,
  });
  
  // Main form for receipt details
  const form = useForm<GoodsReceiptFormData>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: {
      purchaseOrderId: 0,
      receivedDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });
  
  // Form for adding new items
  const addItemForm = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      itemId: "",
      quantityReceived: 1,
      unitPrice: "",
      batchNumber: "",
      expiryDate: "",
      manufacturingDate: ""
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/inventory/goods-receipts", data);
    },
    onSuccess: () => {
      setSuccessMessage("Goods receipt created successfully");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/reports/value"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/reports/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goods receipt",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    form.reset();
    addItemForm.reset();
    setReceiptItems([]);
  };

  const addItem = (data: AddItemFormData) => {
    const selectedItem = items.find(item => item.id === parseInt(data.itemId));
    if (!selectedItem) return;

    const receiptItem: ReceiptItem = {
      itemId: parseInt(data.itemId),
      itemName: selectedItem.name,
      quantityReceived: data.quantityReceived,
      unitPrice: data.unitPrice,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate || "",
      manufacturingDate: data.manufacturingDate || ""
    };

    setReceiptItems([...receiptItems, receiptItem]);
    addItemForm.reset();
  };

  const removeItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    return receiptItems.reduce((sum, item) => sum + (item.quantityReceived * parseFloat(item.unitPrice)), 0).toFixed(2);
  };

  const purchaseOrderId = form.watch("purchaseOrderId");
  const selectedPO = purchaseOrders.find((po) => po.id === purchaseOrderId);

  const {
    data: purchaseOrderItems = [],
    isFetching: purchaseOrderItemsLoading,
  } = useQuery<PurchaseOrderItem[]>({
    queryKey: ["inventory", "purchase-order-items", purchaseOrderId],
    enabled: Boolean(purchaseOrderId),
    queryFn: async ({ queryKey }) => {
      const [, , id] = queryKey;
      const response = await apiRequest(
        "GET",
        `/api/inventory/purchase-orders/${id}/items`,
      );
      return response.json();
    },
  });

  const {
    data: purchaseOrderDetail,
    isFetching: purchaseOrderDetailLoading,
  } = useQuery<PurchaseOrderDetail | null>({
    queryKey: ["/api/inventory/purchase-orders", purchaseOrderId],
    enabled: Boolean(purchaseOrderId),
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      const response = await apiRequest(
        "GET",
        `/api/inventory/purchase-orders/${id}`,
      );
      return response.json();
    },
    retry: 3,
    initialData: null,
  });

  const computedPurchaseOrderMeta = purchaseOrderDetail || {
    id: selectedPO?.id || 0,
    poNumber: selectedPO?.poNumber || "PO -",
    orderDate: selectedPO?.orderDate || new Date().toISOString(),
    expectedDeliveryDate: selectedPO?.expectedDeliveryDate || null,
    status: selectedPO?.status || "draft",
    totalAmount: selectedPO?.totalAmount || "0.00",
    taxAmount: "0.00",
    discountAmount: "0.00",
    notes: selectedPO?.notes || "",
    supplierName: selectedPO?.supplierName || "",
    supplierEmail: selectedPO?.supplierEmail || "",
    createdAt: selectedPO?.orderDate || new Date().toISOString(),
    updatedAt: selectedPO?.orderDate || new Date().toISOString(),
    emailSent: false,
    emailSentAt: null,
    itemsOrdered: [],
  };

  const displayedPurchaseOrderItems =
    purchaseOrderDetail?.itemsOrdered.length
      ? purchaseOrderDetail.itemsOrdered
      : purchaseOrderItems.map((item) => ({
          id: item.id,
          itemId: item.itemId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: (item.quantity * parseFloat(item.unitPrice || "0")).toFixed(
            2,
          ),
        }));

  const { setValue, getValues } = form;
  useEffect(() => {
    if (!open) return;
    if (!purchaseOrders.length) return;
    const currentId = getValues("purchaseOrderId");
    const hasSelected = purchaseOrders.some((po) => po.id === currentId);
    if (!hasSelected) {
      setValue("purchaseOrderId", purchaseOrders[0].id);
      setReceiptItems([]);
    }
  }, [open, purchaseOrders, getValues, setValue, setReceiptItems]);

  useEffect(() => {
    if (!purchaseOrderItems.length) return;
    if (receiptItems.length > 0) return;
    const newItems = purchaseOrderItems.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      quantityReceived: item.quantity,
      unitPrice: item.unitPrice,
      batchNumber: "",
      expiryDate: "",
      manufacturingDate: "",
    }));
    if (newItems.length) {
      setReceiptItems(newItems);
    }
  }, [purchaseOrderItems, receiptItems.length]);

  const handleSubmit = (data: GoodsReceiptFormData) => {
    if (receiptItems.length === 0) {
      form.setError("root", {
        type: "manual",
        message: "Please add at least one item to the receipt"
      });
      return;
    }

    // Map receipt items to backend expected format
    const mappedItems = receiptItems.map(item => ({
      itemId: item.itemId,
      quantityReceived: item.quantityReceived,
      batchNumber: item.batchNumber || undefined,
      expiryDate: item.expiryDate || undefined
    }));

    createReceiptMutation.mutate({
      purchaseOrderId: data.purchaseOrderId,
      receivedDate: data.receivedDate,
      notes: data.notes,
      items: mappedItems
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-5xl max-h-[700px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Goods Receipt</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="purchaseOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order</FormLabel>
                      <FormControl>
                        <Popover open={purchaseOrderOpen} onOpenChange={setPurchaseOrderOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={purchaseOrderOpen}
                              className="w-full justify-between text-left"
                              data-testid="select-purchase-order"
                            >
                              <span className="truncate">
                                {selectedPO ? selectedPO.poNumber : "Select purchase order..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="max-h-[200px] overflow-y-auto">
                              <Command>
                                <CommandInput placeholder="Search purchase orders..." />
                                <CommandEmpty>No purchase order found.</CommandEmpty>
                                <CommandGroup>
                                  {purchaseOrders.map((po) => (
                                    <CommandItem
                                      key={po.id}
                                      value={po.poNumber}
                                      onSelect={() => {
                                        field.onChange(po.id);
                                        setPurchaseOrderOpen(false);
                                        setReceiptItems([]);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === po.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{po.poNumber}</span>
                                        <span className="text-sm text-gray-500 truncate">
                                          {po.supplierName} — £{po.totalAmount}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receivedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received Date</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-received-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="textarea-notes"
                        placeholder="Additional notes about this goods receipt..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-sm bg-white/90">
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase">
                  Purchase Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-lg font-semibold text-gray-900">
                  {selectedPO?.poNumber || "Select a purchase order"}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {selectedPO?.supplierName || "Supplier will populate here"}
                </p>
                <Badge variant="secondary" className="text-xs capitalize">
                  {selectedPO?.status?.replace("_", " ") || "status pending"}
                </Badge>
                {selectedPO?.expectedDeliveryDate && (
                  <p className="text-xs text-gray-500">
                    Expected delivery: {format(new Date(selectedPO.expectedDeliveryDate), "MMM dd, yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase">
                  Items overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Items found</span>
                  <span>{purchaseOrderItems.length || receiptItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total value</span>
                  <span>£{calculateTotalAmount()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Received date</span>
                  <span>{form.getValues("receivedDate")}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardHeader>
                <CardTitle className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase">
                  Sync status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-gray-500">
                <p>
                  {purchaseOrderItemsLoading ? "Pulling PO items..." : "Auto-fetch ready"}
                </p>
                <p>Use the add-item grid to include extras outside the PO.</p>
              </CardContent>
            </Card>
          </div>

        {selectedPO && (
          <Card className="border shadow-sm bg-white">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xs font-semibold tracking-[0.3em] text-gray-500 uppercase">
                Purchase Order Details
              </CardTitle>
              <p className="text-sm text-gray-600">
                {computedPurchaseOrderMeta.status.replace("_", " ")} · Created on{" "}
                {format(new Date(computedPurchaseOrderMeta.orderDate), "PPP")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-gray-600">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">PO Number</p>
                  <p className="font-semibold text-gray-900">{computedPurchaseOrderMeta.poNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Supplier</p>
                  <p className="font-medium">{computedPurchaseOrderMeta.supplierName}</p>
                  <p className="text-xs text-gray-500">
                    {computedPurchaseOrderMeta.supplierEmail || "No email"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Expected Delivery</p>
                  <p className="font-semibold">
                    {computedPurchaseOrderMeta.expectedDeliveryDate
                      ? format(new Date(computedPurchaseOrderMeta.expectedDeliveryDate), "PPP")
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Status</p>
                  <p className="font-semibold text-emerald-600">{computedPurchaseOrderMeta.status}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm text-gray-600">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Total Amount</p>
                  <p className="font-semibold text-lg">£{parseFloat(computedPurchaseOrderMeta.totalAmount || "0").toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Tax / Discount</p>
                  <p className="text-sm text-gray-500">
                    Tax: £{parseFloat(computedPurchaseOrderMeta.taxAmount || "0").toFixed(2)} · Discount: £{parseFloat(computedPurchaseOrderMeta.discountAmount || "0").toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Notes</p>
                <p className="text-sm text-gray-600">
                  {computedPurchaseOrderMeta.notes || "No additional notes were added."}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">
                  Items in Purchase Order
                </p>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPurchaseOrderItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-4 text-sm text-gray-500"
                          >
                            {purchaseOrderDetailLoading || purchaseOrderItemsLoading
                              ? "Loading purchase order items..."
                              : "No items were found for this purchase order."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedPurchaseOrderItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              £{parseFloat(item.unitPrice || "0").toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              £{parseFloat(item.totalPrice || "0").toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

          <Form {...addItemForm}>
            <div className="border rounded-lg bg-slate-50 p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <h6 className="text-sm font-semibold text-gray-700">Add extra items</h6>
                <span className="text-xs text-gray-500">Optional</span>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <FormField
                    control={addItemForm.control}
                    name="itemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger data-testid="select-item">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((item) => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addItemForm.control}
                    name="quantityReceived"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            data-testid="input-quantity"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addItemForm.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            data-testid="input-unit-price"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addItemForm.control}
                    name="batchNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch #</FormLabel>
                        <FormControl>
                          <Input data-testid="input-batch-number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3 items-end">
                  <FormField
                    control={addItemForm.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-expiry-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addItemForm.control}
                    name="manufacturingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mfg Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            data-testid="input-manufacturing-date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={addItemForm.handleSubmit(addItem)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Form>

          {form.formState.errors.root && (
            <div className="text-xs text-red-600" data-testid="error-form-root">
              {form.formState.errors.root.message}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
            <Button
              onClick={() => form.handleSubmit(handleSubmit)()}
              disabled={createReceiptMutation.isPending}
            >
              {createReceiptMutation.isPending ? "Processing..." : "Create Goods Receipt"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-600">Success</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold text-gray-900">{successMessage}</p>
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
    </Dialog>
  );
}