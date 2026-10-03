"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, Check, CreditCard, Loader2, QrCode, ShieldCheck, Truck, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import lguConfig from "@/lgu.config.json";

const DEFAULT_BARANGAYS = lguConfig.barangays;

export type PaymentMethod = "gcash" | "qrph" | "dob";
export type FulfillmentMethod = "PICK_UP" | "DELIVERY";

export interface DeliveryAddress {
  barangay: string;
  houseNumber: string;
  street: string;
  sitio: string;
  purok: string;
  municipality: string;
  province: string;
  landmark: string;
}

export interface CheckoutDetails {
  fulfillmentType: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  deliveryAddress: DeliveryAddress;
  deliveryFee: number;
  totalAmount: number;
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  transactionId: string;
  deliveryFee?: number;
  initialFulfillment?: FulfillmentMethod;
  initialAddress?: Partial<DeliveryAddress>;
  onBeforeCheckout: (details: CheckoutDetails) => Promise<boolean>;
  referenceName?: string;
  redirectPath?: string;
}

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

export default function PaymentModal({
  open,
  onOpenChange,
  amount,
  transactionId,
  deliveryFee = 50,
  initialFulfillment = "PICK_UP",
  initialAddress,
  onBeforeCheckout,
  referenceName,
  redirectPath,
}: PaymentModalProps) {
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>(initialFulfillment);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gcash");
  const [address, setAddress] = useState<DeliveryAddress>({ ...emptyAddress, ...initialAddress });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFulfillment(initialFulfillment);
    setAddress({ ...emptyAddress, ...initialAddress });
    setError("");
  }, [open, initialFulfillment, initialAddress]);

  const appliedDeliveryFee = fulfillment === "DELIVERY" ? deliveryFee : 0;
  const totalAmount = amount + appliedDeliveryFee;
  const formattedTotal = useMemo(
    () => totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [totalAmount],
  );

  const updateAddress = (field: keyof DeliveryAddress, value: string) => {
    setAddress(current => ({ ...current, [field]: value }));
  };

  const handleCheckout = async () => {
    if (fulfillment === "DELIVERY" && !address.barangay) {
      setError("Barangay is required for home delivery.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const details: CheckoutDetails = {
        fulfillmentType: fulfillment,
        paymentMethod,
        deliveryAddress: address,
        deliveryFee: appliedDeliveryFee,
        totalAmount,
      };
      if (!(await onBeforeCheckout(details))) return;

      const response = await fetch("/api/paymongo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalAmount,
          type: paymentMethod,
          transactionId,
          reference: referenceName || "Municipal Service Payment",
          redirectPath: redirectPath || "/modules/building-permit",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.[0]?.detail || data?.error || "Failed to initialize payment.";
        throw new Error(typeof message === "string" ? message : "Failed to initialize payment.");
      }

      const checkoutUrl = data?.data?.attributes?.checkout_url;
      if (!checkoutUrl) throw new Error("Secure checkout URL was not returned.");
      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start secure checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[2rem] border-white/10 bg-[#090c11] p-5 text-white shadow-2xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="sr-only">Treasury Protocol Payment</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="relative overflow-hidden rounded-[2rem] bg-[#040e24] border border-sky-500/20 p-7 lg:self-start">
            <CreditCard className="absolute right-4 top-12 h-40 w-40 rotate-12 text-white/[0.07]" />
            <div className="relative space-y-7">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black italic uppercase tracking-[0.35em] text-cyan-400">
                  <ShieldCheck className="h-4 w-4" /> Treasury Protocol
                </p>
                <p className="mt-3 text-sm font-semibold italic text-slate-400">Evaluation complete. Secure your issuance.</p>
              </div>

              <FeeRow label="Building Permit Fee" amount={amount} />
              <FeeRow label="Other Applicable Municipal Charges" amount={0} />
              {fulfillment === "DELIVERY" && <FeeRow label="Delivery Service" amount={appliedDeliveryFee} accent />}

              <div className="flex items-end justify-between border-t border-white/10 pt-7">
                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-[0.3em] text-cyan-400">Total Amount</p>
                  <p className="text-[8px] font-bold uppercase text-white/20">Payable via channel</p>
                </div>
                <p className="text-2xl font-black italic">₱{formattedTotal}</p>
              </div>
            </div>
          </section>

          <section className="space-y-8 rounded-[2rem] border border-white/10 bg-[#081225] p-6 sm:p-8">
            <div className="space-y-5">
              <SectionTitle icon={Truck} title="Deployment Strategy" />
              <div className="grid grid-cols-1 gap-4">
                <ChoiceCard active={fulfillment === "PICK_UP"} onClick={() => setFulfillment("PICK_UP")} icon={Building2} label="Office Pickup" />
              </div>
            </div>

            <div className="space-y-5 border-t border-white/10 pt-6">
              <SectionTitle icon={CreditCard} title="Payment" />
              <div className="grid grid-cols-1 gap-3">
                <ChoiceCard active={paymentMethod === "qrph"} onClick={() => setPaymentMethod("qrph")} icon={QrCode} label="QRPH Scan" description="Maya, BPI, GCash" light />
              </div>

              {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-300">{error}</p>}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0038a8] to-[#0070f3] hover:from-[#002b80] hover:to-[#005bb5] border border-cyan-400/30 shadow-[0_0_20px_rgba(0,163,255,0.25)] px-4 text-[10px] font-black italic uppercase tracking-widest text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : `Proceed to secure ${paymentMethod.toUpperCase()} checkout (₱${formattedTotal})`}
              </button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeeRow({ label, amount, accent = false }: { label: string; amount: number; accent?: boolean }) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 pb-4">
      <span className={cn("max-w-[65%] text-[9px] font-black italic uppercase tracking-widest text-slate-500", accent && "text-cyan-400")}>{label}</span>
      <span className={cn("text-xl font-black italic", accent && "text-cyan-400")}>₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-950/80 border border-sky-800/40 text-cyan-400"><Icon className="h-5 w-5" /></span><h3 className="text-xl font-black italic uppercase tracking-tighter">{title}</h3></div>;
}

function ChoiceCard({ active, onClick, icon: Icon, label, description, light = false }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; description?: string; light?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border-2 p-4 text-center transition active:scale-95", active ? (light ? "border-cyan-400 bg-white text-slate-950 shadow-[0_0_20px_rgba(0,210,255,0.3)]" : "border-[#0038a8] bg-[#0038a8] text-white shadow-lg shadow-blue-500/30") : "border-white/10 bg-white/5 text-slate-300 hover:border-sky-500/40")}>
      <Icon className={cn("h-7 w-7", active && light && "text-[#0038a8]")} />
      <div><span className="block text-[9px] font-black italic uppercase tracking-wider">{label}</span>{description && <span className="mt-1 block text-[7px] font-bold uppercase opacity-60">{description}</span>}</div>
      {active && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0d1015] bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(0,210,255,0.8)]"><Check className="h-3 w-3 stroke-[3]" /></span>}
    </button>
  );
}

function AddressField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label className="ml-1 text-[9px] font-black italic uppercase tracking-widest text-slate-400">{label}</Label><Input value={value} onChange={event => onChange(event.target.value)} className="h-11 rounded-xl border-white/10 bg-black/20 text-sm font-bold italic text-white" /></div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="space-y-2">
      <Label className="ml-1 text-[9px] font-black italic uppercase tracking-widest text-slate-400">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-bold italic text-white outline-none">
          <SelectValue placeholder="Select barangay" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map(option => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
