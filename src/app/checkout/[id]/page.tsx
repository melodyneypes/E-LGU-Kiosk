"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Building2, 
  Check, 
  CreditCard, 
  Loader2, 
  QrCode, 
  ShieldCheck, 
  Truck, 
  Wallet,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getTransactionForCheckout, 
  saveCheckoutDetails, 
  reconcilePayment, 
  getBarangayNames,
  CheckoutDetails,
  DeliveryAddress
} from "../actions";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("@/components/shared/LocationPicker"),
  { ssr: false }
);

const emptyAddress: DeliveryAddress = {
  barangay: "",
  houseNumber: "",
  street: "",
  sitio: "",
  purok: "",
  municipality: "",
  province: "",
  landmark: "",
};

interface TransactionTypeInfo {
  code: string;
  name: string;
  supportsECopy: boolean;
}

interface TransactionData {
  id: string;
  totalAmount: number;
  type: TransactionTypeInfo;
  fulfillmentType?: "PICK_UP" | "DELIVERY" | "E_COPY" | null;
  deliveryAddress?: unknown;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  residentLat?: number | null;
  residentLng?: number | null;
  fiscalSnapshot?: unknown;
  status: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [barangays, setBarangays] = useState<{ name: string; deliveryFee: number }[]>([]);

  // Form States
  const [fulfillment, setFulfillment] = useState<"PICK_UP" | "DELIVERY">("PICK_UP");
  const [paymentMethod, setPaymentMethod] = useState<"gcash" | "qrph">("gcash");
  const [address, setAddress] = useState<DeliveryAddress>(emptyAddress);
  const [isBrgyDropdownOpen, setIsBrgyDropdownOpen] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedBrgyFee, setSelectedBrgyFee] = useState<number>(0);

  // Status/Flow States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleBackRedirect = React.useCallback((tx: TransactionData) => {
    const code = tx.type?.code || "";
    if (code.startsWith("CEDULA")) {
      router.push("/modules/cedula");
    } else if (code.startsWith("BUILDING")) {
      router.push(`/modules/building-permit`);
    } else if (code.startsWith("BUSINESS")) {
      router.push(`/modules/business-permit`);
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const savedResident = sessionStorage.getItem("active_resident");
    if (!savedResident) {
      router.push("/");
      return;
    }
    const resident = JSON.parse(savedResident);
    const uId = resident.userId || resident.id;
    setUserId(uId);

    // Initial Fetch
    Promise.all([
      getTransactionForCheckout(id, uId),
      getBarangayNames()
    ]).then(([txRes, brgyRes]) => {
      if (txRes.success && txRes.data) {
        setTransaction(txRes.data);
        if (txRes.data.fulfillmentType) {
          const fType = txRes.data.fulfillmentType;
          if (fType === "PICK_UP" || fType === "DELIVERY") {
            setFulfillment(fType);
          }
        }
        if (txRes.data.deliveryAddress) {
          setAddress({
            ...emptyAddress,
            ...(txRes.data.deliveryAddress as Partial<DeliveryAddress>)
          });
        }
        if (txRes.data.deliveryLat && txRes.data.deliveryLng) {
          setCoordinates({
            lat: txRes.data.deliveryLat,
            lng: txRes.data.deliveryLng
          });
        } else if (txRes.data.residentLat && txRes.data.residentLng) {
          setCoordinates({
            lat: txRes.data.residentLat,
            lng: txRes.data.residentLng
          });
        }
        if (txRes.data.status === "PAID") {
          showToast("This transaction is already PAID.", "success");
          setTimeout(() => handleBackRedirect(txRes.data), 1500);
        }
      } else {
        showToast(txRes.error || "Unable to load transaction.", "error");
        router.push("/dashboard");
      }

      if (brgyRes.success && brgyRes.data) {
        setBarangays(brgyRes.data);
        // Find fee if address already has barangay
        if (txRes.success && txRes.data && txRes.data.deliveryAddress) {
          const savedAddr = txRes.data.deliveryAddress as Partial<DeliveryAddress>;
          if (savedAddr.barangay) {
            const found = brgyRes.data.find(b => b.name === savedAddr.barangay);
            if (found) {
              setSelectedBrgyFee(found.deliveryFee);
            }
          }
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      showToast("Error starting checkout session.", "error");
      setLoading(false);
    });
  }, [id, router, handleBackRedirect]);

  // Handle callback checks from redirect
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus && userId && id) {
      if (paymentStatus === "success") {
        showToast("Payment processing successful! Verifying...", "success");
        reconcilePayment(id, userId).then(res => {
          if (res.success && res.paid) {
            showToast("Payment verified successfully!", "success");
            if (transaction) {
              setTimeout(() => handleBackRedirect(transaction), 1500);
            } else {
              getTransactionForCheckout(id, userId).then(txRes => {
                if (txRes.success && txRes.data) {
                  setTimeout(() => handleBackRedirect(txRes.data), 1500);
                }
              });
            }
          } else {
            showToast("Verification pending. Check status shortly.", "warning");
          }
        });
      } else if (paymentStatus === "cancelled") {
        showToast("Payment checkout cancelled.", "warning");
        if (transaction && transaction.type?.code?.startsWith("CEDULA")) {
          setTimeout(() => {
            router.push("/modules/cedula");
          }, 1500);
        }
      }
    }
  }, [searchParams, userId, id, transaction, handleBackRedirect, router]);



  const appliedDeliveryFee = fulfillment === "DELIVERY" ? selectedBrgyFee : 0;
  const baseAmount = transaction ? transaction.totalAmount : 0;
  const totalAmount = baseAmount + appliedDeliveryFee;

  const formattedTotal = useMemo(() => {
    return totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [totalAmount]);

  const updateAddressField = (field: keyof DeliveryAddress, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }));
    if (field === "barangay") {
      const found = barangays.find(b => b.name === value);
      if (found) {
        setSelectedBrgyFee(found.deliveryFee);
      } else {
        setSelectedBrgyFee(0);
      }
    }
  };

  const handleCheckout = async () => {
    if (!userId || !transaction) return;

    if (fulfillment === "DELIVERY" && !address.barangay) {
      setError("Ay, please select your Barangay context for delivery.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const details: CheckoutDetails = {
        fulfillmentType: fulfillment,
        paymentMethod,
        deliveryAddress: address,
        deliveryFee: appliedDeliveryFee,
        totalAmount,
        deliveryLat: coordinates?.lat || null,
        deliveryLng: coordinates?.lng || null,
      };

      // 1. Save checkout choices
      const saveRes = await saveCheckoutDetails(transaction.id, userId, details);
      if (!saveRes.success) {
        throw new Error(saveRes.error || "Failed to persist checkout choices.");
      }

      // 3. Request checkout session from PayMongo API
      const response = await fetch("/api/paymongo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          type: paymentMethod,
          transactionId: transaction.id,
          reference: `${transaction.type?.name || "Municipal Fee"} CheckOut`,
          redirectPath: `/checkout/${transaction.id}`,
          cancelPath: transaction.type?.code?.startsWith("CEDULA") ? "/modules/cedula" : `/checkout/${transaction.id}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error?.[0]?.detail || data?.error || "Failed to initialize secure checkout session.";
        throw new Error(msg);
      }

      const checkoutUrl = data?.data?.attributes?.checkout_url;
      if (!checkoutUrl) {
        throw new Error("PayMongo session checkout URL was not retrieved.");
      }

      // 4. Redirect to secure checkout
      window.location.assign(checkoutUrl);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Failed to proceed to secure checkout.";
      setError(errMsg);
      setIsSubmitting(false);
    }
  };

  if (loading || !transaction) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0d0f14] gap-6">
        <div className="w-16 h-16 border-8 border-slate-800 border-t-theme-primary rounded-full animate-spin"></div>
        <p className="text-theme-primary font-black text-xs uppercase tracking-[0.4em] animate-pulse">Syncing Payment Gateway...</p>
      </div>
    );
  }



  return (
    <div className="h-screen w-full bg-[#0d0f14] text-white font-sans select-none overflow-y-auto">
      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-xl bg-slate-900 text-white border-slate-800">
          <AlertCircle className="w-5 h-5 text-theme-primary" />
          <span className="text-sm font-bold">{toastMessage.message}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 pb-32">
        {/* Header navigation bar */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <button 
            onClick={() => handleBackRedirect(transaction)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Service
          </button>
        </div>

        {/* Welcome branding banner */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-theme-primary flex items-center justify-center shadow-lg shadow-theme-primary/40">
            <CreditCard size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-left">
              TREASURY <span className="text-theme-primary not-italic">CHECKOUT</span>
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider text-left">Secure Municipal Payment Processing Gateway</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          
          {/* Left Column: Assessment Breakdown */}
          <section className="bg-[#11131a] rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden flex flex-col justify-between shadow-2xl lg:self-start">
            <div className="absolute right-4 top-12 h-44 w-44 rotate-12 text-theme-primary/[0.03] pointer-events-none">
              <ShieldCheck className="w-full h-full" />
            </div>

            <div className="space-y-6 relative z-10 text-left">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black italic uppercase tracking-[0.3em] text-theme-primary">
                  <ShieldCheck className="h-4.5 w-4.5" /> Treasury Assessment
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Evaluation complete. Verify the breakdown:</p>
              </div>

              {/* Assessment cost items */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                {(() => {
                  const rawFiscal = transaction.fiscalSnapshot;
                  const snap = ((typeof rawFiscal === "string" ? JSON.parse(rawFiscal) : rawFiscal) as Record<string, unknown>) || {};
                  const items: { label: string; amount: number }[] = [];

                  if (Array.isArray(snap.lineItems) && snap.lineItems.length > 0) {
                    snap.lineItems.forEach((i: unknown) => {
                      const itemObj = i as Record<string, unknown>;
                      const amt = Number(itemObj.amount);
                      if (amt > 0) {
                        items.push({ label: String(itemObj.label || "Fee Item"), amount: amt });
                      }
                    });
                  }

                  if (snap.basicTax !== undefined && Number(snap.basicTax) > 0) {
                    items.push({ label: "Basic Community Tax", amount: Number(snap.basicTax) });
                  }
                  if (snap.additionalTax !== undefined && Number(snap.additionalTax) > 0) {
                    items.push({ label: "Additional Gross Tax", amount: Number(snap.additionalTax) });
                  }
                  if (snap.penaltyCharge !== undefined && Number(snap.penaltyCharge) > 0) {
                    items.push({ label: "Penalty Charge", amount: Number(snap.penaltyCharge) });
                  } else if (snap.penalty !== undefined && Number(snap.penalty) > 0) {
                    items.push({ label: "Penalty Charge", amount: Number(snap.penalty) });
                  }

                  if (items.length === 0) {
                    items.push({
                      label: transaction.type?.name || "Service Processing Fee",
                      amount: Number(snap.baseAmount ?? snap.baseFee ?? baseAmount)
                    });
                  }

                  return items.map((item, idx) => (
                    <div key={idx} className="flex items-end justify-between border-b border-white/5 pb-3">
                      <span className="max-w-[70%] text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {item.label}
                      </span>
                      <span className="text-lg font-black italic text-slate-200">
                        ₱{item.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ));
                })()}

                {fulfillment === "DELIVERY" && (
                  <div className="flex items-end justify-between border-b border-white/5 pb-3">
                    <span className="max-w-[70%] text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      Logistics Delivery Service
                    </span>
                    <span className="text-lg font-black italic text-cyan-400">
                      ₱{appliedDeliveryFee.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total area */}
              <div className="flex items-end justify-between pt-6 border-t-2 border-dashed border-white/10">
                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-[0.3em] text-cyan-400">Total Payable</p>
                  <p className="text-[8px] font-bold uppercase text-slate-500">Payable via secure channel</p>
                </div>
                <p className="text-3xl font-black italic text-cyan-400 leading-none">₱{formattedTotal}</p>
              </div>
            </div>
          </section>

          {/* Right Column: Checkout choices and payment */}
          <section className="bg-[#081225] rounded-[2.5rem] border border-sky-500/20 p-8 shadow-2xl space-y-8 text-left">
            
            {/* Fulfillment Type */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-950/60 border border-sky-800/40 text-cyan-400">
                  <Truck className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-black italic uppercase tracking-tight">Fulfillment Type</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillment("PICK_UP")}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-95 cursor-pointer",
                    fulfillment === "PICK_UP" 
                      ? "border-cyan-400 bg-sky-900/30 text-white shadow-[0_0_15px_rgba(0,210,255,0.2)]" 
                      : "border-white/5 bg-white/5 text-slate-400 hover:border-sky-500/30"
                  )}
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Office Pickup</span>
                  {fulfillment === "PICK_UP" && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950"><Check size={10} className="stroke-[3]" /></span>}
                </button>

                <button
                  type="button"
                  onClick={() => setFulfillment("DELIVERY")}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-95 cursor-pointer",
                    fulfillment === "DELIVERY" 
                      ? "border-cyan-400 bg-sky-900/30 text-white shadow-[0_0_15px_rgba(0,210,255,0.2)]" 
                      : "border-white/5 bg-white/5 text-slate-400 hover:border-sky-500/30"
                  )}
                >
                  <Truck className="h-6 w-6" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Home Delivery</span>
                  {fulfillment === "DELIVERY" && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-theme-primary"><Check size={10} className="text-white" /></span>}
                </button>
              </div>
            </div>

            {/* Delivery address entry if Delivery selected */}
            {fulfillment === "DELIVERY" && (
              <div className="border-t border-white/5 pt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1 text-left relative">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Barangay</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBrgyDropdownOpen(!isBrgyDropdownOpen)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#0d0f14] px-4 text-xs font-bold text-white flex items-center justify-between transition-all hover:bg-white/5 focus:border-theme-primary outline-none cursor-pointer"
                    >
                      <span>{address.barangay || "Select Barangay"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isBrgyDropdownOpen && "rotate-180")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isBrgyDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-[140]" 
                          onClick={() => setIsBrgyDropdownOpen(false)}
                        />
                        <div className="absolute left-0 right-0 mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0d0f14]/95 backdrop-blur-md shadow-2xl z-[150] [scrollbar-width:thin] text-left animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-1.5 space-y-0.5">
                            {barangays.map((b) => (
                              <button
                                key={b.name}
                                type="button"
                                onClick={() => {
                                  updateAddressField("barangay", b.name);
                                  setIsBrgyDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer block",
                                  address.barangay === b.name
                                    ? "bg-theme-primary text-white"
                                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                                )}
                              >
                                {b.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">House / Lot No.</label>
                  <input
                    type="text"
                    value={address.houseNumber}
                    onChange={e => updateAddressField("houseNumber", e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-theme-primary transition-all"
                    placeholder="e.g. Blk 1 Lot 2"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Street Name</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={e => updateAddressField("street", e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-theme-primary transition-all"
                    placeholder="e.g. Rizal St"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sitio</label>
                  <input
                    type="text"
                    value={address.sitio}
                    onChange={e => updateAddressField("sitio", e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-theme-primary transition-all"
                    placeholder="e.g. Centro"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Purok</label>
                  <input
                    type="text"
                    value={address.purok}
                    onChange={e => updateAddressField("purok", e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-theme-primary transition-all"
                    placeholder="e.g. Purok 4"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 text-left">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Landmark / Instructions</label>
                  <input
                    type="text"
                    value={address.landmark}
                    onChange={e => updateAddressField("landmark", e.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-white outline-none focus:border-theme-primary transition-all"
                    placeholder="e.g. Near Barangay Hall"
                  />
                </div>

                <div className="col-span-2 sm:col-span-3 space-y-2 pt-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    Pin Location <span className="text-emerald-500 font-bold">* Required</span>
                  </label>
                  <LocationPicker
                    value={coordinates}
                    onSelect={(lat: number, lng: number) => setCoordinates({ lat, lng })}
                    title="Pin your Delivery Location"
                  />
                  {coordinates && (
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      Pinned: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Payment Method Options */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-950/60 border border-sky-800/40 text-cyan-400">
                  <CreditCard className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-black italic uppercase tracking-tight">Payment Method</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("gcash")}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-95 cursor-pointer",
                    paymentMethod === "gcash" 
                      ? "border-cyan-400 bg-white text-slate-950 shadow-[0_0_15px_rgba(0,210,255,0.3)]" 
                      : "border-white/5 bg-white/5 text-slate-400 hover:border-sky-500/30"
                  )}
                >
                  <Wallet className={cn("h-6 w-6", paymentMethod === "gcash" && "text-[#0038a8]")} />
                  <span className="text-[9px] font-black uppercase tracking-wider">GCash Wallet</span>
                  {paymentMethod === "gcash" && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950"><Check size={8} className="stroke-[3]" /></span>}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("qrph")}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition active:scale-95 cursor-pointer",
                    paymentMethod === "qrph" 
                      ? "border-cyan-400 bg-white text-slate-950 shadow-[0_0_15px_rgba(0,210,255,0.3)]" 
                      : "border-white/5 bg-white/5 text-slate-400 hover:border-sky-500/30"
                  )}
                >
                  <QrCode className={cn("h-6 w-6", paymentMethod === "qrph" && "text-[#0038a8]")} />
                  <span className="text-[9px] font-black uppercase tracking-wider">QRPH Scan</span>
                  {paymentMethod === "qrph" && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950"><Check size={8} className="stroke-[3]" /></span>}
                </button>
              </div>

              {/* Error box */}
              {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-bold text-red-300">
                  {error}
                </p>
              )}

              {/* Action Proceed Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#0038a8] to-[#0070f3] hover:from-[#002b80] hover:to-[#005bb5] text-white border border-cyan-400/30 px-4 text-xs font-black uppercase tracking-widest transition shadow-lg shadow-blue-500/30 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting to PayMongo...
                  </>
                ) : (
                  `Proceed to secure checkout (₱${formattedTotal})`
                )}
              </button>
            </div>

          </section>

        </div>

      </div>
    </div>
  );
}
