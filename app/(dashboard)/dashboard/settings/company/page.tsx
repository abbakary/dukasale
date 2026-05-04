"use client"

import { useState, useEffect, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Save, Store, Building2, MapPin, Phone, Mail, FileText, Globe, CreditCard, Plus, X, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/lib/stores/auth-store"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useRef } from "react"
import { updateTenantCompanyApi, uploadTenantCompanyLogoApi } from "@/lib/api/admin-companies"
import { getFullImageUrl } from "@/lib/utils"
import { DocumentPreviewDialog } from "@/components/shared/documents/document-preview-dialog"
import { db } from "@/lib/db/dexie"
import {
  transformTransactionToDeliveryNote,
  transformTransactionToInvoice,
  transformTransactionToOrderSlip,
  transformTransactionToPaymentSlip,
  transformTransactionToQuotation,
} from "@/lib/utils/document-transform"

export default function CompanySettingsPage() {
  const { company, token, updateCompany } = useAuthStore()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB')
        return
      }
      
      setIsLoading(true)
      try {
        if (!token) throw new Error("Unauthorized")
        const { logo_url } = await uploadTenantCompanyLogoApi(file, token)
        setSettings(prev => ({ ...prev, logo: logo_url }))
        toast.success('Logo uploaded successfully')
      } catch (error: any) {
        toast.error(error.message || 'Logo upload failed')
      } finally {
        setIsLoading(false)
      }
    }
  }
  
  // Basic company info
  const [settings, setSettings] = useState({
    name: company?.name || "",
    email: company?.email || "",
    phone: company?.phone || "",
    address: company?.address || "",
    taxId: company?.taxId || "",
    website: company?.website || "",
    logo: company?.logo || "",
    // Enhanced fields
    vrnNo: company?.vrn_no || "",
    tinNo: company?.tin_no || "",
    physicalAddress: company?.physical_address || "",
    postalAddress: company?.postal_address || "",
    country: company?.country || "",
    region: company?.region || "",
    city: company?.city || "",
    postalCode: company?.postal_code || "",
    businessLicenseNo: company?.business_license_no || "",
    businessRegistrationNo: company?.business_registration_no || "",
    businessType: company?.business_type || "",
    industry: company?.industry || "",
    yearEstablished: company?.year_established?.toString() || "",
    contactPerson: company?.contact_person || "",
    contactPersonTitle: company?.contact_person_title || "",
    alternativePhone: company?.alternative_phone || "",
    fax: company?.fax || "",
    whatsapp: company?.whatsapp || "",
    facebook: company?.facebook || "",
    twitter: company?.twitter || "",
    instagram: company?.instagram || "",
    linkedin: company?.linkedin || "",
    documentPrefix: company?.document_prefix || "",
    documentHeader: company?.document_header || "",
    documentFooter: company?.document_footer || "",
    authorisedSignatory: company?.authorised_signatory || "",
  })

  // Bank details
  const [bankDetails, setBankDetails] = useState(company?.bank_details?.length ? company.bank_details.map((bank: any) => ({
    bankName: bank.bank_name || '',
    accountName: bank.account_name || '',
    accountNumber: bank.account_number || '',
    branchName: bank.branch_name || '',
    branchCode: bank.branch_code || '',
    swiftCode: bank.swift_code || '',
    iban: bank.iban || '',
    routingNumber: bank.routing_number || '',
    sortCode: bank.sort_code || '',
    bankAddress: bank.bank_address || '',
    mobileMoneyName: bank.mobile_money_name || '',
    mobileMoneyNumber: bank.mobile_money_number || '',
    isPrimary: bank.is_primary || false,
    is_active: bank.is_active !== undefined ? bank.is_active : true,
  })) : [{
    bankName: '',
    accountName: '',
    accountNumber: '',
    branchName: '',
    branchCode: '',
    swiftCode: '',
    iban: '',
    routingNumber: '',
    sortCode: '',
    bankAddress: '',
    mobileMoneyName: '',
    mobileMoneyNumber: '',
    isPrimary: true,
    is_active: true,
  }])

  // Terms & conditions
  const [termsConditions, setTermsConditions] = useState(company?.terms_conditions?.length
    ? company.terms_conditions.map((t: any) => ({
        documentType: t.document_type || "invoice",
        title: t.title || "",
        termsText: t.terms_text || "",
        paymentTerms: t.payment_terms || "",
        deliveryTerms: t.delivery_terms || "",
        warrantyTerms: t.warranty_terms || "",
        returnPolicy: t.return_policy || "",
        latePaymentTerms: t.late_payment_terms || "",
        cancellationPolicy: t.cancellation_policy || "",
        is_active: t.is_active !== undefined ? t.is_active : true,
      }))
    : [
        {
          documentType: 'invoice',
          title: '',
          termsText: '',
          paymentTerms: '',
          deliveryTerms: '',
          warrantyTerms: '',
          returnPolicy: '',
          latePaymentTerms: '',
          cancellationPolicy: '',
          is_active: true,
        },
        {
          documentType: 'quotation',
          title: '',
          termsText: '',
          paymentTerms: '',
          deliveryTerms: '',
          warrantyTerms: '',
          returnPolicy: '',
          latePaymentTerms: '',
          cancellationPolicy: '',
          is_active: true,
        },
      ])

  const transactions = useLiveQuery(async () => {
    if (!company?.id) return []
    return db.transactions.where("companyId").equals(company.id).reverse().limit(1).toArray()
  }, [company?.id], [])

  const customers = useLiveQuery(async () => {
    if (!company?.id) return []
    return db.customers.where("companyId").equals(company.id).toArray()
  }, [company?.id], [])

  const previewDocumentsData = useMemo(() => {
    if (!company) return undefined

    const previewCompany = {
      ...company,
      name: settings.name || company.name,
      email: settings.email || company.email,
      phone: settings.phone || company.phone,
      address: settings.address || company.address,
      logo: settings.logo || company.logo,
      website: settings.website || company.website,
      vrn_no: settings.vrnNo || undefined,
      tin_no: settings.tinNo || undefined,
      physical_address: settings.physicalAddress || undefined,
      postal_address: settings.postalAddress || undefined,
      country: settings.country || undefined,
      region: settings.region || undefined,
      city: settings.city || undefined,
      postal_code: settings.postalCode || undefined,
      business_license_no: settings.businessLicenseNo || undefined,
      business_registration_no: settings.businessRegistrationNo || undefined,
      business_type: settings.businessType || undefined,
      industry: settings.industry || undefined,
      year_established: settings.yearEstablished ? parseInt(settings.yearEstablished, 10) : undefined,
      contact_person: settings.contactPerson || undefined,
      contact_person_title: settings.contactPersonTitle || undefined,
      alternative_phone: settings.alternativePhone || undefined,
      fax: settings.fax || undefined,
      whatsapp: settings.whatsapp || undefined,
      facebook: settings.facebook || undefined,
      twitter: settings.twitter || undefined,
      instagram: settings.instagram || undefined,
      linkedin: settings.linkedin || undefined,
      document_prefix: settings.documentPrefix || undefined,
      document_header: settings.documentHeader || undefined,
      document_footer: settings.documentFooter || undefined,
      authorised_signatory: settings.authorisedSignatory || undefined,
    }

    const now = new Date()
    const sampleItems = [
      { id: "item-1", description: "Sample Product A", quantity: 2, unit: "pcs", unitPrice: 25000, total: 50000, sku: "SKU-A1" },
      { id: "item-2", description: "Sample Product B", quantity: 1, unit: "pcs", unitPrice: 15000, total: 15000, sku: "SKU-B2" },
    ]
    const subtotal = sampleItems.reduce((acc, item) => acc + item.total, 0)
    const taxPercent = 18
    const taxAmount = Number((subtotal * (taxPercent / 100)).toFixed(2))
    const discountAmount = 5000
    const total = subtotal + taxAmount - discountAmount

    const sampleCustomer = {
      id: "preview-customer",
      companyId: company.id,
      name: "Preview Customer Ltd",
      phone: "+255 700 000 000",
      email: "customer@example.com",
      address: "Preview Customer Address",
      creditLimit: 0,
      currentDebt: 0,
      loyaltyPoints: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      business_name: "Preview Customer Ltd",
      contact_person: "John Doe",
      tax_id: "TIN-123456",
      vrn_no: "VRN-123456",
      physical_address: "Preview Customer Physical Address",
    }

    const termsText =
      termsConditions.find((t) => t.documentType === "invoice")?.termsText ||
      settings.documentFooter ||
      "Payment is due within 7 days."

    const latestTransaction = transactions?.[0]
    const relatedCustomer = latestTransaction?.customerId
      ? customers?.find((c) => c.id === latestTransaction.customerId)
      : undefined

    if (latestTransaction) {
      const invoice = transformTransactionToInvoice(latestTransaction, previewCompany as any, relatedCustomer)
      const quotation = transformTransactionToQuotation(latestTransaction, previewCompany as any, relatedCustomer)
      const deliveryNote = transformTransactionToDeliveryNote(latestTransaction, previewCompany as any, relatedCustomer)
      const paymentSlip = transformTransactionToPaymentSlip(latestTransaction, previewCompany as any, relatedCustomer)
      const orderSlip = transformTransactionToOrderSlip(latestTransaction, previewCompany as any, relatedCustomer)
      const quotationTerms = termsConditions.find((t) => t.documentType === "quotation")?.termsText || termsText

      return {
        invoice: {
          ...invoice,
          company: previewCompany,
          notes: settings.documentHeader || invoice.notes,
          terms: termsText,
          documentNumber: `${settings.documentPrefix || ""}${invoice.documentNumber}`,
        },
        quotation: {
          ...quotation,
          company: previewCompany,
          notes: settings.documentHeader || quotation.notes,
          terms: quotationTerms,
          documentNumber: `${settings.documentPrefix || ""}${quotation.documentNumber}`,
        },
        deliveryNote: {
          ...deliveryNote,
          company: previewCompany,
          notes: settings.documentHeader || deliveryNote.notes,
          terms: termsText,
          documentNumber: `${settings.documentPrefix || ""}${deliveryNote.documentNumber}`,
        },
        paymentSlip: {
          ...paymentSlip,
          company: previewCompany,
          notes: settings.documentFooter || paymentSlip.notes,
          receiptNumber: `${settings.documentPrefix || ""}${paymentSlip.receiptNumber}`,
        },
        orderSlip: {
          ...orderSlip,
          company: previewCompany,
          notes: settings.documentHeader || orderSlip.notes,
          terms: termsText,
          documentNumber: `${settings.documentPrefix || ""}${orderSlip.documentNumber}`,
        },
      }
    }

    return {
      invoice: {
        type: "invoice" as const,
        id: "preview-invoice",
        documentNumber: `${settings.documentPrefix || "INV-"}PREVIEW-001`,
        date: now,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        company: previewCompany,
        customer: sampleCustomer,
        items: sampleItems,
        subtotal,
        taxAmount,
        taxPercent,
        discountAmount,
        total,
        paymentMethod: "cash" as const,
        amountPaid: total,
        amountDue: 0,
        accountNumber: "ACC-PREVIEW",
        notes: settings.documentHeader || undefined,
        terms: termsText,
      },
      quotation: {
        type: "quotation" as const,
        id: "preview-quotation",
        documentNumber: `${settings.documentPrefix || "QUO-"}PREVIEW-001`,
        date: now,
        validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        company: previewCompany,
        customer: sampleCustomer,
        items: sampleItems,
        subtotal,
        taxAmount,
        taxPercent,
        discountAmount,
        total,
        notes: settings.documentHeader || undefined,
        terms: termsConditions.find((t) => t.documentType === "quotation")?.termsText || termsText,
      },
      deliveryNote: {
        type: "delivery_note" as const,
        id: "preview-delivery",
        documentNumber: `${settings.documentPrefix || "DN-"}PREVIEW-001`,
        date: now,
        company: previewCompany,
        customer: sampleCustomer,
        items: sampleItems,
        subtotal,
        taxAmount,
        taxPercent,
        discountAmount,
        total,
        deliveryStatus: "complete" as const,
        notes: settings.documentHeader || undefined,
        terms: termsText,
      },
      paymentSlip: {
        id: "preview-payment-slip",
        receiptNumber: `${settings.documentPrefix || "REC-"}PREVIEW-001`,
        date: now,
        company: previewCompany,
        customer: sampleCustomer,
        amount: total,
        paymentMethod: "cash" as const,
        referenceNumber: "REF-PREVIEW",
        notes: settings.documentFooter || "Preview payment slip note",
      },
      orderSlip: {
        type: "order_slip" as const,
        id: "preview-order-slip",
        documentNumber: `${settings.documentPrefix || "ORD-"}PREVIEW-001`,
        date: now,
        company: previewCompany,
        customer: sampleCustomer,
        items: sampleItems,
        subtotal,
        taxAmount,
        taxPercent,
        discountAmount,
        total,
        notes: settings.documentHeader || undefined,
        terms: termsText,
        orderType: "pos_sale" as const,
        servedBy: settings.contactPerson || "Shop Admin",
      },
    }
  }, [company, settings, termsConditions, transactions, customers])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      if (!token) throw new Error('Unauthorized')
      
      // Prepare bank details
      const validBankDetails = bankDetails.filter(bank => bank.bankName.trim()).map(bank => ({
        bank_name: bank.bankName,
        account_name: bank.accountName,
        account_number: bank.accountNumber,
        branch_name: bank.branchName,
        branch_code: bank.branchCode,
        swift_code: bank.swiftCode,
        iban: bank.iban,
        routing_number: bank.routingNumber,
        sort_code: bank.sortCode,
        bank_address: bank.bankAddress,
        mobile_money_name: bank.mobileMoneyName,
        mobile_money_number: bank.mobileMoneyNumber,
        is_primary: bank.isPrimary,
        is_active: bank.is_active,
      }))
      
      // Prepare terms conditions
      const validTermsConditions = termsConditions.filter(tc => 
        tc.title.trim() || tc.termsText.trim() || tc.paymentTerms.trim()
      ).map(tc => ({
        document_type: tc.documentType,
        title: tc.title,
        terms_text: tc.termsText,
        payment_terms: tc.paymentTerms,
        delivery_terms: tc.deliveryTerms,
        warranty_terms: tc.warrantyTerms,
        return_policy: tc.returnPolicy,
        late_payment_terms: tc.latePaymentTerms,
        cancellation_policy: tc.cancellationPolicy,
        is_active: tc.is_active,
      }))

      // Prepare payload
      const payload = {
        name: settings.name,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        tax_id: settings.taxId,
        website: settings.website,
        vrn_no: settings.vrnNo,
        tin_no: settings.tinNo,
        physical_address: settings.physicalAddress,
        postal_address: settings.postalAddress,
        country: settings.country,
        region: settings.region,
        city: settings.city,
        postal_code: settings.postalCode,
        business_license_no: settings.businessLicenseNo,
        business_registration_no: settings.businessRegistrationNo,
        business_type: settings.businessType,
        industry: settings.industry,
        year_established: settings.yearEstablished ? parseInt(settings.yearEstablished) : undefined,
        contact_person: settings.contactPerson,
        contact_person_title: settings.contactPersonTitle,
        alternative_phone: settings.alternativePhone,
        fax: settings.fax,
        whatsapp: settings.whatsapp,
        facebook: settings.facebook,
        twitter: settings.twitter,
        instagram: settings.instagram,
        linkedin: settings.linkedin,
        document_prefix: settings.documentPrefix,
        document_header: settings.documentHeader,
        document_footer: settings.documentFooter,
        authorised_signatory: settings.authorisedSignatory,
        bank_details: validBankDetails,
        terms_conditions: validTermsConditions,
      }

      // Call company update API
      const updatedCompany = await updateTenantCompanyApi(payload, token)
      updateCompany(updatedCompany as any)

      toast.success("Company settings updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update company settings")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Manage your business profile and professional document settings</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        {[
          { step: 1, label: "Basic Info", icon: Store },
          { step: 2, label: "Professional Details", icon: Building2 },
          { step: 3, label: "Banking", icon: CreditCard },
          { step: 4, label: "Documents", icon: FileText },
        ].map(({ step, label, icon: Icon }) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                currentStep >= step
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground/20 text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                currentStep >= step ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {step < 4 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  currentStep > step ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Basic Business Information</CardTitle>
              <CardDescription>This information will appear on your receipts and documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Business Name</Label>
                  <div className="relative">
                    <Store className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      className="pl-9"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Business Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      className="pl-9"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / TIN</Label>
                  <div className="relative">
                    <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="taxId"
                      className="pl-9"
                      value={settings.taxId}
                      onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Physical Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    className="pl-9"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (Optional)</Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    className="pl-9"
                    placeholder="https://example.com"
                    value={settings.website}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-2">
                <div className="relative group">
                  <div className={`h-24 w-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all ${
                    settings.logo ? 'border-primary/50 bg-background' : 'border-muted-foreground/20 bg-muted/30'
                  }`}>
                    {settings.logo ? (
                      <img src={getFullImageUrl(settings.logo)} alt="Logo" className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Building2 className="h-8 w-8 opacity-40" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">No Logo</span>
                      </div>
                    )}
                  </div>
                  {settings.logo && (
                    <button
                      onClick={() => setSettings({ ...settings, logo: '' })}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <h4 className="text-sm font-bold">Business Logo</h4>
                  <p className="text-xs text-muted-foreground">
                    Upload your company logo. This will be displayed on receipts and documents.
                  </p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-2 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Image
                    </Button>
                    {settings.logo && (
                      <Badge variant="outline" className="h-8 bg-green-50 text-green-700 border-green-200">
                        Logo Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(2)} disabled={isLoading}>
                  Next: Professional Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Professional Details */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Professional Company Details</CardTitle>
              <CardDescription>Enhanced information for professional documents and business registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tax & Registration */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Tax & Registration</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vrnNo">VRN No (VAT Registration)</Label>
                    <Input
                      id="vrnNo"
                      placeholder="Optional"
                      value={settings.vrnNo}
                      onChange={(e) => setSettings({ ...settings, vrnNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tinNo">TIN No (Tax ID)</Label>
                    <Input
                      id="tinNo"
                      placeholder="Optional"
                      value={settings.tinNo}
                      onChange={(e) => setSettings({ ...settings, tinNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessLicenseNo">Business License No</Label>
                    <Input
                      id="businessLicenseNo"
                      placeholder="Optional"
                      value={settings.businessLicenseNo}
                      onChange={(e) => setSettings({ ...settings, businessLicenseNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessRegistrationNo">Business Registration No</Label>
                    <Input
                      id="businessRegistrationNo"
                      placeholder="Optional"
                      value={settings.businessRegistrationNo}
                      onChange={(e) => setSettings({ ...settings, businessRegistrationNo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Detailed Address */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Detailed Address</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="physicalAddress">Physical Address</Label>
                    <Textarea
                      id="physicalAddress"
                      placeholder="Physical business location..."
                      value={settings.physicalAddress}
                      onChange={(e) => setSettings({ ...settings, physicalAddress: e.target.value })}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalAddress">Postal Address</Label>
                    <Textarea
                      id="postalAddress"
                      placeholder="Postal address..."
                      value={settings.postalAddress}
                      onChange={(e) => setSettings({ ...settings, postalAddress: e.target.value })}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={settings.city}
                      onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region/State</Label>
                    <Input
                      id="region"
                      value={settings.region}
                      onChange={(e) => setSettings({ ...settings, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={settings.country}
                      onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={settings.postalCode}
                      onChange={(e) => setSettings({ ...settings, postalCode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Business & Contact */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Business & Contact Information</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type</Label>
                    <Input
                      id="businessType"
                      placeholder="e.g., Limited Company, Sole Proprietor"
                      value={settings.businessType}
                      onChange={(e) => setSettings({ ...settings, businessType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Retail, Manufacturing, Services"
                      value={settings.industry}
                      onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearEstablished">Year Established</Label>
                    <Input
                      id="yearEstablished"
                      type="number"
                      placeholder="e.g., 2020"
                      value={settings.yearEstablished}
                      onChange={(e) => setSettings({ ...settings, yearEstablished: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      placeholder="Primary contact person"
                      value={settings.contactPerson}
                      onChange={(e) => setSettings({ ...settings, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPersonTitle">Contact Person Title</Label>
                    <Input
                      id="contactPersonTitle"
                      placeholder="e.g., Manager, Director"
                      value={settings.contactPersonTitle}
                      onChange={(e) => setSettings({ ...settings, contactPersonTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alternativePhone">Alternative Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="alternativePhone"
                        className="pl-9"
                        value={settings.alternativePhone}
                        onChange={(e) => setSettings({ ...settings, alternativePhone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fax">Fax</Label>
                    <Input
                      id="fax"
                      placeholder="Fax number"
                      value={settings.fax}
                      onChange={(e) => setSettings({ ...settings, fax: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="whatsapp"
                        className="pl-9"
                        value={settings.whatsapp}
                        onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Social Media */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Social Media</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      placeholder="Facebook profile/URL"
                      value={settings.facebook}
                      onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      placeholder="Twitter handle/URL"
                      value={settings.twitter}
                      onChange={(e) => setSettings({ ...settings, twitter: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      placeholder="Instagram profile/URL"
                      value={settings.instagram}
                      onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      placeholder="LinkedIn profile/URL"
                      value={settings.linkedin}
                      onChange={(e) => setSettings({ ...settings, linkedin: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(3)}>
                  Next: Banking
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Banking */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>Manage your bank accounts for payment processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankDetails.map((bank, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Bank Account {index + 1}</h4>
                    {bankDetails.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newBanks = bankDetails.filter((_, i) => i !== index);
                          setBankDetails(newBanks);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input
                        placeholder="e.g., National Bank, CRDB"
                        value={bank.bankName}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].bankName = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Name</Label>
                      <Input
                        placeholder="Account holder name"
                        value={bank.accountName}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].accountName = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input
                        placeholder="Bank account number"
                        value={bank.accountNumber}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].accountNumber = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch Name</Label>
                      <Input
                        placeholder="Bank branch"
                        value={bank.branchName}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].branchName = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SWIFT Code</Label>
                      <Input
                        placeholder="International transfers"
                        value={bank.swiftCode}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].swiftCode = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Money (e.g. M-Pesa)</Label>
                      <Input
                        placeholder="Operator name"
                        value={bank.mobileMoneyName}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].mobileMoneyName = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Money Number</Label>
                      <Input
                        placeholder="Number for payments"
                        value={bank.mobileMoneyNumber}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].mobileMoneyNumber = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input
                        placeholder="International bank account"
                        value={bank.iban}
                        onChange={e => {
                          const newBanks = [...bankDetails];
                          newBanks[index].iban = e.target.value;
                          setBankDetails(newBanks);
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Address</Label>
                    <Textarea
                      placeholder="Bank branch address"
                      value={bank.bankAddress}
                      onChange={e => {
                        const newBanks = [...bankDetails];
                        newBanks[index].bankAddress = e.target.value;
                        setBankDetails(newBanks);
                      }}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setBankDetails([...bankDetails, {
                  bankName: '',
                  accountName: '',
                  accountNumber: '',
                  branchName: '',
                  branchCode: '',
                  swiftCode: '',
                  iban: '',
                  routingNumber: '',
                  sortCode: '',
                  bankAddress: '',
                  mobileMoneyName: '',
                  mobileMoneyNumber: '',
                  isPrimary: false,
                  is_active: true,
                }])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Bank Account
              </Button>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(4)}>
                  Next: Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Documents */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Document Settings</CardTitle>
              <CardDescription>Configure how your documents appear to customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="documentPrefix">Document Prefix</Label>
                  <Input
                    id="documentPrefix"
                    placeholder="e.g., INV-, QUO- (for invoice numbers)"
                    value={settings.documentPrefix}
                    onChange={(e) => setSettings({ ...settings, documentPrefix: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorisedSignatory">Authorised Signatory Name</Label>
                  <Input
                    id="authorisedSignatory"
                    placeholder="Name that appears under signature line"
                    value={settings.authorisedSignatory}
                    onChange={(e) => setSettings({ ...settings, authorisedSignatory: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentHeader">Document Header</Label>
                  <Textarea
                    id="documentHeader"
                    placeholder="Header text for documents (appears at top)"
                    value={settings.documentHeader}
                    onChange={(e) => setSettings({ ...settings, documentHeader: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentFooter">Document Footer</Label>
                  <Textarea
                    id="documentFooter"
                    placeholder="Footer text for documents (appears at bottom)"
                    value={settings.documentFooter}
                    onChange={(e) => setSettings({ ...settings, documentFooter: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  {previewDocumentsData && (
                    <DocumentPreviewDialog
                      data={previewDocumentsData}
                      defaultType="invoice"
                      trigger={
                        <Button variant="outline" type="button">
                          <FileText className="mr-2 h-4 w-4" />
                          Preview Documents
                        </Button>
                      }
                    />
                  )}
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save All Settings"}
                    {!isLoading && <Save className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}