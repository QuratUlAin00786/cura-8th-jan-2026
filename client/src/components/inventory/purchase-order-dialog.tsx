import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check } from "lucide-react";
import SimpleAddItem from "./simple-add-item";

interface InventoryItem {
  id: number;
  name: string;
  purchasePrice: string;
  unitOfMeasurement: string;
}

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
}

interface POItem {
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export default function PurchaseOrderDialog({ open, onOpenChange, items }: PurchaseOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [createdPONumber, setCreatedPONumber] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    supplierId: 1, // Default supplier
    expectedDeliveryDate: "",
    notes: "",
    taxAmount: "0.00",
    discountAmount: "0.00"
  });
  
  const [poItems, setPOItems] = useState<POItem[]>([]);
  const [newItem, setNewItem] = useState({
    itemId: "",
    quantity: 1,
    unitPrice: ""
  });

  // TEMPORARY: Auto-add Paracetamol item when dialog opens to bypass button issue
  useEffect(() => {
    if (open && items.length > 0 && poItems.length === 0) {
      const paracetamolItem = items.find(item => item.name.toLowerCase().includes('paracetamol'));
      if (paracetamolItem) {
        const autoItem = {
          itemId: paracetamolItem.id,
          itemName: paracetamolItem.name,
          quantity: 100,
          unitPrice: "2",
          totalPrice: "200.00"
        };
        console.log("AUTO-ADDING PARACETAMOL ITEM:", autoItem);
        setPOItems([autoItem]);
        setNewItem({ itemId: paracetamolItem.id.toString(), quantity: 100, unitPrice: "2" });
      }
    }
  }, [open, items, poItems.length]);

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/inventory/purchase-orders", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      const poNumber = data?.purchaseOrder?.poNumber;
      setCreatedPONumber(poNumber || null);
      setSuccessMessage(
        poNumber
          ? `Purchase order ${poNumber} created successfully`
          : "Purchase order created successfully",
      );
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/purchase-orders"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      supplierId: 1,
      expectedDeliveryDate: "",
      notes: "",
      taxAmount: "0.00",
      discountAmount: "0.00"
    });
    setPOItems([]);
    setNewItem({
      itemId: "",
      quantity: 1,
      unitPrice: ""
    });
  };

  const addItem = () => {
    console.log("Add item called with:", newItem);
    console.log("Current poItems before add:", poItems);
    
    if (!newItem.itemId || !newItem.unitPrice) {
      toast({
        title: "Error",
        description: "Please select an item and enter unit price",
        variant: "destructive",
      });
      return;
    }

    const selectedItem = items.find(item => item.id === parseInt(newItem.itemId));
    if (!selectedItem) {
      console.log("Selected item not found for ID:", newItem.itemId);
      return;
    }

    const totalPrice = (newItem.quantity * parseFloat(newItem.unitPrice)).toFixed(2);

    const poItem: POItem = {
      itemId: parseInt(newItem.itemId),
      itemName: selectedItem.name,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      totalPrice
    };

    console.log("Adding poItem:", poItem);
    const newPOItems = [...poItems, poItem];
    setPOItems(newPOItems);
    console.log("New poItems array:", newPOItems);
    
    setNewItem({
      itemId: "",
      quantity: 1,
      unitPrice: ""
    });
  };

  const removeItem = (index: number) => {
    setPOItems(poItems.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    const subtotal = poItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    const tax = parseFloat(formData.taxAmount);
    const discount = parseFloat(formData.discountAmount);
    return (subtotal + tax - discount).toFixed(2);
  };

  const handleSubmit = () => {
    console.log("Handle submit called, poItems.length:", poItems.length);
    console.log("poItems:", poItems);
    
    if (poItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = calculateTotalAmount();

    createPOMutation.mutate({
      ...formData,
      totalAmount,
      items: poItems
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={formData.supplierId.toString()} onValueChange={(value) => setFormData({...formData, supplierId: parseInt(value)})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Halo Pharmacy</SelectItem>
                  <SelectItem value="2">MedSupply Co.</SelectItem>
                  <SelectItem value="3">Healthcare Solutions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
              <Input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
              />
            </div>
          </div>

          {/* Quick Add Item */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <h3 className="mb-3 text-base font-medium text-gray-900 dark:text-gray-100">Quick Add Item</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label htmlFor="item" className="text-sm">Item</Label>
                <Select value={newItem.itemId} onValueChange={(value) => setNewItem({...newItem, itemId: value})}>
                  <SelectTrigger className="bg-white dark:bg-gray-900">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(item => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="quantity" className="text-sm">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              
              <div>
                <Label htmlFor="unitPrice" className="text-sm">Unit Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.unitPrice}
                  onChange={(e) => setNewItem({...newItem, unitPrice: e.target.value})}
                  className="bg-white dark:bg-gray-900"
                />
              </div>
              
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  console.log("DIRECT BUTTON CLICKED!");
                  
                  if (!newItem.itemId || !newItem.unitPrice) {
                    console.log("Missing required fields");
                    toast({
                      title: "Error",
                      description: "Please select an item and enter unit price",
                      variant: "destructive",
                    });
                    return;
                  }

                  const selectedItem = items.find(item => item.id === parseInt(newItem.itemId));
                  if (!selectedItem) {
                    console.log("Selected item not found");
                    return;
                  }

                  const totalPrice = (newItem.quantity * parseFloat(newItem.unitPrice)).toFixed(2);
                  const itemToAdd = {
                    itemId: parseInt(newItem.itemId),
                    itemName: selectedItem.name,
                    quantity: newItem.quantity,
                    unitPrice: newItem.unitPrice,
                    totalPrice
                  };

                  console.log("Adding item directly:", itemToAdd);
                  setPOItems(prev => [...prev, itemToAdd]);
                  
                  // Reset form
                  setNewItem({ itemId: "", quantity: 1, unitPrice: "" });
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item NOW
              </Button>
            </div>
          </div>

          {/* Items Table */}
          {poItems.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Purchase Order Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>£{item.unitPrice}</TableCell>
                      <TableCell>£{item.totalPrice}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Financial Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Tax Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.taxAmount}
                onChange={(e) => setFormData({...formData, taxAmount: e.target.value})}
              />
            </div>
            <div>
              <Label>Discount Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.discountAmount}
                onChange={(e) => setFormData({...formData, discountAmount: e.target.value})}
              />
            </div>
            <div>
              <Label>Total Amount</Label>
              <Input value={`£${calculateTotalAmount()}`} disabled />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional notes or special instructions"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createPOMutation.isPending}>
              {createPOMutation.isPending ? "Creating..." : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-600">Success</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold text-gray-900">
              {createdPONumber
                ? `Purchase order ${createdPONumber} created successfully`
                : "Purchase order created successfully"}
            </p>
            <p className="text-sm text-gray-500">{successMessage}</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessMessage("");
                setCreatedPONumber(null);
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