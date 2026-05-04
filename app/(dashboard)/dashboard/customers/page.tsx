'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  Users,
  CreditCard,
  Star,
  Phone,
  Mail,
  Bell,
  MapPin,
  Clock,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel, FieldGroup, FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db/dexie';
import { createTenantResource, updateTenantResource, remindCustomerDebt } from '@/lib/api/tenant';
import { syncTenantDataFromApi } from '@/lib/services/sync-from-api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Customer } from '@/lib/types';

const priceLevelColors: Record<string, string> = {
  regular: 'bg-muted text-muted-foreground',
  wholesale: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  vip: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

export default function CustomersPage() {
  const { company, token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    vrnNo: '',
    region: '',
    city: '',
    creditLimit: 500,
    priceLevel: 'regular' as 'regular' | 'wholesale' | 'vip',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const customers = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      return db.customers.where('companyId').equals(company.id).toArray();
    },
    [company?.id],
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const filteredCustomers = (customers || []).filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || customer.priceLevel === levelFilter;
    return matchesSearch && matchesLevel && customer.isActive;
  });

  const stats = {
    total: customers?.filter(c => c.isActive).length || 0,
    withDebt: customers?.filter(c => c.currentDebt > 0 && c.isActive).length || 0,
    totalDebt: customers?.reduce((sum, c) => sum + (c.currentDebt || 0), 0) || 0,
    vipCount: customers?.filter(c => c.priceLevel === 'vip' && c.isActive).length || 0,
  };

  const handleAddCustomer = async () => {
    const errors: Record<string, string> = {};
    if (!newCustomer.name.trim()) errors.name = 'Name is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!token) {
      toast.error('Session expired. Please login again.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createTenantResource(
        'customers',
        {
          name: newCustomer.name,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          address: newCustomer.address || null,
          tax_id: newCustomer.taxId || null,
          vrn_no: newCustomer.vrnNo || null,
          region: newCustomer.region || null,
          city: newCustomer.city || null,
          price_level: newCustomer.priceLevel,
          credit_limit: newCustomer.creditLimit,
          current_debt: 0,
          is_active: true,
        },
        token
      );
      await syncTenantDataFromApi(token);

      toast.success('Customer added successfully');
      setAddDialogOpen(false);
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
        address: '',
        taxId: '',
        vrnNo: '',
        region: '',
        city: '',
        creditLimit: 500,
        priceLevel: 'regular',
      });
      setFormErrors({});
    } catch (error) {
      toast.error('Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer || !token) return;
    
    const errors: Record<string, string> = {};
    if (!selectedCustomer.name.trim()) errors.name = 'Name is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTenantResource(
        'customers',
        selectedCustomer.id,
        {
          name: selectedCustomer.name,
          phone: selectedCustomer.phone || null,
          email: selectedCustomer.email || null,
          address: selectedCustomer.address || null, // Changed from physical_address to address
          tax_id: selectedCustomer.taxId || null,
          vrn_no: selectedCustomer.vrnNo || null,
          region: selectedCustomer.region || null,
          city: selectedCustomer.city || null,
          credit_limit: selectedCustomer.creditLimit,
          price_level: selectedCustomer.priceLevel,
        },
        token
      );
      await syncTenantDataFromApi(token);
      toast.success('Customer updated successfully');
      setEditDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      toast.error('Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemindDebt = async (customer: Customer) => {
    if (!token) return;
    
    if (customer.currentDebt <= 0) {
      toast.error('Customer has no outstanding debt');
      return;
    }
    
    if (!customer.phone) {
      toast.error('Customer has no phone number recorded');
      return;
    }

    const promise = remindCustomerDebt(customer.id, token);

    toast.promise(promise, {
      loading: 'Sending SMS reminder...',
      success: 'Reminder sent successfully',
      error: (err) => err instanceof Error ? err.message : 'Failed to send reminder',
    });
  };

  const handleDelete = async () => {
    if (customerToDelete && token) {
      await updateTenantResource('customers', customerToDelete, { is_active: false }, token);
      await syncTenantDataFromApi(token);
      toast.success('Customer deleted successfully');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Debit Customers</CardTitle>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withDebt}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {company?.currencySymbol}{stats.totalDebt.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">VIP Customers</CardTitle>
            <Star className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vipCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>{filteredCustomers.length} customers found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 size-4" />
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Account Status</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {customer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.address && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{customer.address}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="size-3 text-muted-foreground" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="size-3 text-muted-foreground" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={priceLevelColors[customer.priceLevel || 'regular']}>
                          {customer.priceLevel || 'regular'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {company?.currencySymbol}{customer.creditLimit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-sm font-medium ${customer.currentDebt > 0 ? 'text-red-600' : customer.currentDebt < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {customer.currentDebt > 0 ? 'Debit' : customer.currentDebt < 0 ? 'Credit' : 'Balanced'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {company?.currencySymbol}{Math.abs(customer.currentDebt).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{customer.loyaltyPoints}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setDetailsDialogOpen(true);
                              }}
                            >
                              <Eye className="mr-2 size-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomer({
                                  ...customer,
                                  address: customer.address ?? (customer as any).physical_address,
                                  taxId: customer.taxId ?? (customer as any).tax_id,
                                  vrnNo: customer.vrnNo ?? (customer as any).vrn_no,
                                  priceLevel: customer.priceLevel ?? (customer as any).price_level,
                                  creditLimit: customer.creditLimit ?? (customer as any).credit_limit,
                                });
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            {customer.currentDebt > 0 && (
                              <DropdownMenuItem
                                onClick={() => handleRemindDebt(customer)}
                              >
                                <Bell className="mr-2 size-4" />
                                Send Reminder
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setCustomerToDelete(customer.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">Add Customer</DialogTitle>
            <DialogDescription>Add a new customer to your database</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <FieldGroup className="space-y-5">
              <Field>
                <FieldLabel className="text-slate-700 font-bold">Name *</FieldLabel>
                <Input
                  placeholder="Customer name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className={cn(
                    "h-11 border-slate-200 focus:border-primary focus:ring-primary/20",
                    formErrors.name && "border-red-500"
                  )}
                />
                {formErrors.name && <FieldError className="text-xs mt-1">{formErrors.name}</FieldError>}
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Phone</FieldLabel>
                  <Input
                    placeholder="Phone number"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Email</FieldLabel>
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel className="text-slate-600 font-semibold">Physical Address</FieldLabel>
                <Input
                  placeholder="Physical address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="h-10 border-slate-200"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">TIN (Tax ID)</FieldLabel>
                  <Input
                    placeholder="TIN number"
                    value={newCustomer.taxId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, taxId: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">VRN No.</FieldLabel>
                  <Input
                    placeholder="VRN number"
                    value={newCustomer.vrnNo}
                    onChange={(e) => setNewCustomer({ ...newCustomer, vrnNo: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Region</FieldLabel>
                  <Input
                    placeholder="Region"
                    value={newCustomer.region}
                    onChange={(e) => setNewCustomer({ ...newCustomer, region: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">City</FieldLabel>
                  <Input
                    placeholder="City"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Credit Limit</FieldLabel>
                  <Input
                    type="number"
                    value={newCustomer.creditLimit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: Number(e.target.value) })}
                    className="h-10 border-slate-200"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Price Level</FieldLabel>
                  <Select
                    value={newCustomer.priceLevel}
                    onValueChange={(v) => setNewCustomer({ ...newCustomer, priceLevel: v as 'regular' | 'wholesale' | 'vip' })}
                  >
                    <SelectTrigger className="h-10 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="h-10 font-medium">
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} className="h-10 font-bold px-8">
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">Edit Customer</DialogTitle>
            <DialogDescription>Update customer information</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedCustomer && (
              <FieldGroup className="space-y-5">
                <Field>
                  <FieldLabel className="text-slate-700 font-bold">Name *</FieldLabel>
                  <Input
                    placeholder="Customer name"
                    value={selectedCustomer.name}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })}
                    className={cn(
                      "h-11 border-slate-200 focus:border-primary focus:ring-primary/20",
                      formErrors.name && "border-red-500"
                    )}
                  />
                  {formErrors.name && <FieldError className="text-xs mt-1">{formErrors.name}</FieldError>}
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">Phone</FieldLabel>
                    <Input
                      placeholder="Phone number"
                      value={selectedCustomer.phone || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">Email</FieldLabel>
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={selectedCustomer.email || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel className="text-slate-600 font-semibold">Physical Address</FieldLabel>
                  <Input
                    placeholder="Physical address"
                    value={selectedCustomer.address || ''}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                    className="h-10 border-slate-200"
                  />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">TIN (Tax ID)</FieldLabel>
                    <Input
                      placeholder="TIN number"
                      value={selectedCustomer.taxId || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, taxId: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">VRN No.</FieldLabel>
                    <Input
                      placeholder="VRN number"
                      value={selectedCustomer.vrnNo || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, vrnNo: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">Region</FieldLabel>
                    <Input
                      placeholder="Region"
                      value={selectedCustomer.region || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, region: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">City</FieldLabel>
                    <Input
                      placeholder="City"
                      value={selectedCustomer.city || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, city: e.target.value })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">Credit Limit</FieldLabel>
                    <Input
                      type="number"
                      value={selectedCustomer.creditLimit}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, creditLimit: Number(e.target.value) })}
                      className="h-10 border-slate-200"
                    />
                  </Field>
                  <Field>
                    <FieldLabel className="text-slate-600 font-semibold">Price Level</FieldLabel>
                    <Select
                      value={selectedCustomer.priceLevel || 'regular'}
                      onValueChange={(v) => setSelectedCustomer({ ...selectedCustomer, priceLevel: v as 'regular' | 'wholesale' | 'vip' })}
                    >
                      <SelectTrigger className="h-10 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="wholesale">Wholesale</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="h-10 font-medium">
              Cancel
            </Button>
            <Button onClick={handleEditCustomer} disabled={isSubmitting} className="h-10 font-bold px-8">
              {isSubmitting ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                  {selectedCustomer?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-bold">{selectedCustomer?.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={priceLevelColors[selectedCustomer?.priceLevel || 'regular']}>
                    {selectedCustomer?.priceLevel || 'regular'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">• Joined {selectedCustomer?.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-50 border-none shadow-none">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Account Balance</p>
                  <p className={cn(
                    "text-2xl font-black",
                    (selectedCustomer?.currentDebt || 0) > 0 ? "text-red-600" : (selectedCustomer?.currentDebt || 0) < 0 ? "text-green-600" : "text-slate-900"
                  )}>
                    {company?.currencySymbol}{Math.abs(selectedCustomer?.currentDebt || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">
                    {(selectedCustomer?.currentDebt || 0) > 0 ? "Outstanding Debt" : (selectedCustomer?.currentDebt || 0) < 0 ? "Account Credit" : "Balanced"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-50 border-none shadow-none">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Credit Limit</p>
                  <p className="text-2xl font-black text-slate-900">
                    {company?.currencySymbol}{(selectedCustomer?.creditLimit || 0).toLocaleString()}
                  </p>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(100, ((selectedCustomer?.currentDebt || 0) / (selectedCustomer?.creditLimit || 1)) * 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-50 border-none shadow-none">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Loyalty Points</p>
                  <div className="flex items-center gap-2">
                    <Star className="size-5 text-warning fill-warning" />
                    <p className="text-2xl font-black text-slate-900">
                      {(selectedCustomer?.loyaltyPoints || 0).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                  <Phone className="size-4 text-primary" />
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="size-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Email Address</p>
                      <p className="text-sm font-medium text-slate-700">{selectedCustomer?.email || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="size-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</p>
                      <p className="text-sm font-medium text-slate-700">{selectedCustomer?.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="size-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Physical Address</p>
                      <p className="text-sm font-medium text-slate-700">{selectedCustomer?.address || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                  <FileText className="size-4 text-primary" />
                  Tax & Business Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">TIN Number</p>
                    <p className="text-sm font-medium text-slate-700">{selectedCustomer?.taxId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">VRN Number</p>
                    <p className="text-sm font-medium text-slate-700">{selectedCustomer?.vrnNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Region</p>
                    <p className="text-sm font-medium text-slate-700">{selectedCustomer?.region || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">City</p>
                    <p className="text-sm font-medium text-slate-700">{selectedCustomer?.city || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Clock className="size-3" />
                Last updated {selectedCustomer?.updatedAt ? new Date(selectedCustomer.updatedAt).toLocaleDateString() : ''}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                  Close
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    setEditDialogOpen(true);
                  }}
                >
                  <Edit className="mr-2 size-4" />
                  Edit Customer
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
