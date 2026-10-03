"use server";

import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import lguConfig from "@/lgu.config.json";

export async function getCurrentUserResident() {
    // Note: Mocking auth for LGU-KIOSK context. In a real app, use auth() or getServerSession()
    // For now, returning a mock resident or fetching the first resident for testing.
    try {
        const resident = await prisma.resident.findFirst({
            include: { user: true }
        });
        return { success: true, data: resident };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to fetch resident profile" };
    }
}

export async function getTransactionTypes() {
    try {
        const types = await prisma.transactionType.findMany({
            where: {
                code: {
                    startsWith: "BUSINESS_PERMIT"
                }
            }
        });
        return { success: true, data: types };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to fetch transaction types" };
    }
}

export async function getBarangaysList() {
    try {
        return { success: true, data: lguConfig.barangays };
    } catch {
        return { success: false, error: "Failed to fetch barangays list" };
    }
}

export async function getTransactionById(id: string) {
    try {
        const tx = await prisma.transaction.findUnique({
            where: { id }
        });
        return { success: true, data: tx };
    } catch {
        return { success: false, error: "Not found" };
    }
}

export async function getAllSuccessfulBusinessPermits() {
    try {
        const txs = await prisma.transaction.findMany({
            where: {
                status: "RELEASED"
            }
        });
        return { success: true, data: txs };
    } catch {
        return { success: false, error: "Failed" };
    }
}

export async function getUserTransactions() {
    try {
        const txs = await prisma.transaction.findMany({
            orderBy: { createdAt: "desc" }
        });
        return { success: true, data: txs };
    } catch {
        return { success: false, error: "Failed" };
    }
}

export async function getSystemSettingAction(key: string) {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key },
            select: { value: true },
        });
        return { success: true, data: setting?.value ?? null };
    } catch (error) {
        console.error("Failed to fetch system setting:", error);
        return { success: false, error: "Failed to fetch system setting" };
    }
}

export async function submitBusinessPermitTransaction(formData: FormData) {
    try {
        const typeId = formData.get("typeId") as string;
        const residentSnapshotRaw = formData.get("residentSnapshot") as string;
        const additionalDataRaw = formData.get("additionalData") as string;
        
        const additionalData = JSON.parse(additionalDataRaw);
        const residentSnapshot = JSON.parse(residentSnapshotRaw);

        // Upload files
        const files: Record<string, string> = {};
        for (const [key, value] of formData.entries()) {
            if (value instanceof File && value.size > 0) {
                const timestamp = Date.now();
                const path = `business-permits/${timestamp}-${value.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const url = await uploadFile(value, path);
                if (url) {
                    files[key] = url;
                }
            }
        }

        const updatedAdditionalData = {
            ...additionalData,
            ...files
        };

        const transaction = await prisma.transaction.create({
            data: {
                userId: "mock-user-id", // Replace with real user id
                typeId: typeId,
                status: "FOR_REQUESTING",
                residentSnapshot: residentSnapshot,
                additionalData: updatedAdditionalData,
                totalAmount: additionalData.totalAmount || 0,
            }
        });

        revalidatePath("/modules/business-permit");
        return { success: true, data: transaction };
    } catch (error) {
        console.error("Submit Business Permit error:", error);
        return { success: false, error: "Failed to submit application" };
    }
}
