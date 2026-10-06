"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";

interface FaceVerificationProps {
  residentName?: string;
  referenceImageUrl?: string | null;
  authSource?: string | null;
  facialRecognition?: unknown;
  onSuccess: () => void;
  onCancel: () => void;
}

type FacialRecognitionObject =
  | {
      mode?: "reference_image" | "embedding" | "liveness";
      referenceImageUrl?: string;
      selfieUrl?: string;
      descriptor?: number[];
      embedding?: number[];
      model?: string;
      verifiedAt?: string;
    }
  | string
  | null
  | undefined;

const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
const MATCH_THRESHOLD = 0.5;

function isFaceRecognitionObject(
  input: unknown
): input is {
  mode?: "reference_image" | "embedding" | "liveness";
  referenceImageUrl?: string;
  selfieUrl?: string;
  descriptor?: number[];
  embedding?: number[];
  model?: string;
  verifiedAt?: string;
} {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function getRecognitionObject(input: unknown): Exclude<FacialRecognitionObject, string | null | undefined> | null {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as FacialRecognitionObject;
      return isFaceRecognitionObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (isFaceRecognitionObject(input)) return input;
  return null;
}

function toFloat32Array(values: number[]) {
  return new Float32Array(values);
}


function preprocessImage(
  source: HTMLVideoElement | HTMLImageElement,
  filter: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  // Downscale the processing frame to a low-res size (320x240) to minimize CPU load on low-end kiosks
  canvas.width = 320;
  canvas.height = 240;
  
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.filter = filter;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

async function detectReferenceFace(img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, attemptIndex: number = 0) {
  // Use a smaller 320 inputSize configuration to decrease CPU workload on low-end kiosk processors
  const option = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 });

  // If already a canvas, just run detection
  if (img instanceof HTMLCanvasElement) {
    return await faceapi.detectSingleFace(img, option).withFaceLandmarks(true).withFaceDescriptor();
  }

  const attempt = attemptIndex % 3;

  if (attempt === 0) {
    // 0. Always prioritize the Kiosk camera optimization preset (anti-glare + anti-scanline)
    try {
      const canvas = preprocessImage(img, "brightness(0.6) contrast(1.7) saturate(1.1) blur(0.6px)");
      const processedDetection = await faceapi.detectSingleFace(canvas, option).withFaceLandmarks(true).withFaceDescriptor();
      if (processedDetection) return processedDetection;
    } catch (e) {
      console.error("Kiosk camera preprocessing failed:", e);
    }
  } else if (attempt === 1) {
    // 1. Fallback to raw frame detection
    const rawDetection = await faceapi.detectSingleFace(img, option).withFaceLandmarks(true).withFaceDescriptor();
    if (rawDetection) return rawDetection;
  } else {
    // 2. Fallback to backlight preset (if backlit)
    try {
      const canvasBacklight = preprocessImage(img, "brightness(1.25) contrast(1.3)");
      const backlightDetection = await faceapi.detectSingleFace(canvasBacklight, option).withFaceLandmarks(true).withFaceDescriptor();
      if (backlightDetection) return backlightDetection;
    } catch (e) {
      console.error("Backlight preprocessing failed:", e);
    }
  }

  return null;
}

export default function FaceVerification({
  residentName,
  referenceImageUrl,
  authSource,
  facialRecognition,
  onSuccess,
  onCancel,
}: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [referenceReady, setReferenceReady] = useState(false);
  const [referenceLabel, setReferenceLabel] = useState<string>("Resident");
  const [liveDescriptor, setLiveDescriptor] = useState<Float32Array | null>(null);
  const [referenceDescriptor, setReferenceDescriptor] = useState<Float32Array | null>(null);
  const [matchState, setMatchState] = useState<"idle" | "matched" | "mismatch">("idle");
  const autoVerifyRef = useRef(false);
  const livenessPassed = true;

  const recognition = useMemo(() => getRecognitionObject(facialRecognition), [facialRecognition]);

  useEffect(() => {
    let cancelled = false;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported. Please ensure you are using a secure connection (HTTPS or localhost).");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setCameraReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not access camera. Please check permissions."
          );
        }
      }
    }

    void setupCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (!cancelled) setModelsReady(true);
      } catch {
        if (!cancelled) {
          setError("Face verification models could not be loaded.");
          setModelsReady(false);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modelsReady) return;

    let cancelled = false;

    async function loadReferenceDescriptor() {
      try {
        const savedDescriptor = recognition?.descriptor || recognition?.embedding || null;
        if (savedDescriptor && savedDescriptor.length > 0) {
          setReferenceDescriptor(toFloat32Array(savedDescriptor));
          setReferenceLabel(residentName || "Resident");
          setReferenceReady(true);
          return;
        }

        const targetUrl = referenceImageUrl || recognition?.referenceImageUrl || recognition?.selfieUrl;
        if (targetUrl) {
          try {
            const img = await faceapi.fetchImage(targetUrl);
            const detected = await detectReferenceFace(img);
            if (detected && !cancelled) {
              setReferenceDescriptor(detected.descriptor);
              setReferenceLabel(residentName || "Resident");
              setReferenceReady(true);
              return;
            }
          } catch (fetchErr) {
            console.error("Could not extract face descriptor from image:", fetchErr);
          }
        }

        if (!cancelled) {
          setError("No facial embedding/descriptor is available for this resident in the database. Please re-enroll their face.");
          setReferenceReady(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to prepare face reference.");
          setReferenceReady(false);
        }
      }
    }

    void loadReferenceDescriptor();
    return () => {
      cancelled = true;
    };
  }, [modelsReady, recognition, referenceImageUrl, residentName]);

  useEffect(() => {
    if (!cameraReady || !modelsReady || !referenceReady) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attemptIndex = 0;

    const detectLiveFace = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        if (!cancelled) timeoutId = setTimeout(detectLiveFace, 250);
        return;
      }

      try {
        const result = await detectReferenceFace(video, attemptIndex);

        if (!cancelled) {
          setLiveDescriptor(result?.descriptor || null);
          setMatchState("idle");
          autoVerifyRef.current = false;
          if (!result) {
            setError(null);
            attemptIndex++;
          } else {
            attemptIndex = 0;
          }
        }
      } catch {
        if (!cancelled) {
          setLiveDescriptor(null);
          attemptIndex++;
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(detectLiveFace, 250);
        }
      }
    };

    void detectLiveFace();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [cameraReady, modelsReady, referenceReady, livenessPassed]);

  const handleVerify = useCallback(() => {
    if (!modelsReady) {
      setError("Face verification models are not ready yet.");
      return;
    }

    if (!referenceReady || !referenceDescriptor) {
      setError("No saved face reference is available for this resident.");
      return;
    }

    if (!liveDescriptor) {
      setError("Please position your face inside the frame first.");
      return;
    }

    if (referenceDescriptor.length !== liveDescriptor.length) {
      setMatchState("mismatch");
      setError(
        `Face descriptor length mismatch (${liveDescriptor.length} live vs ${referenceDescriptor.length} saved). Please re-enroll this resident's facialRecognition data.`
      );
      return;
    }

    const matcher = new faceapi.FaceMatcher(
      [new faceapi.LabeledFaceDescriptors(referenceLabel, [referenceDescriptor])],
      MATCH_THRESHOLD
    );
    const bestMatch = matcher.findBestMatch(liveDescriptor);

    if (bestMatch.label === "unknown") {
      setMatchState("mismatch");
      setError("Face does not match the saved resident record.");
      return;
    }

    setMatchState("matched");
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      onSuccess();
    }, 900);
  }, [liveDescriptor, modelsReady, onSuccess, referenceDescriptor, referenceLabel, referenceReady]);

  useEffect(() => {
    if (!modelsReady || !referenceReady || !referenceDescriptor || !liveDescriptor || verifying || !livenessPassed) return;
    if (autoVerifyRef.current) return;

    autoVerifyRef.current = true;
    void handleVerify();
  }, [handleVerify, liveDescriptor, modelsReady, referenceDescriptor, referenceReady, verifying, livenessPassed]);

  const faceStatus = !modelsReady
    ? "Loading biometric models..."
    : !referenceReady
      ? "Preparing saved face reference..."
      : matchState === "matched"
        ? "Face matched against the saved record."
        : matchState === "mismatch"
          ? "Face does not match the saved resident record."
          : liveDescriptor
            ? "Face detected. Verifying..."
            : "Align your face within the circle to continue.";

  return (
    <div className="flex flex-col items-center py-8">
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          {authSource === "embedding" ? "Database face embedding" : "Database reference photo"}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-white">{residentName || "Face Identity Check"}</h3>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          We compare your live face against the saved resident biometric record in the database.
        </p>
      </div>

      <div className="relative mb-6 h-64 w-64 overflow-hidden rounded-full border-4 border-theme-secondary bg-black shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover -scale-x-100"
        />
        <div className="absolute inset-0 border-[20px] border-transparent border-t-theme-secondary/30 animate-pulse" />

        {/* Badge inside video */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-sm border border-white/10">
          🟢 Ready
        </div>

        {verifying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {referenceImageUrl ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImageUrl} alt="Resident reference" className="h-full w-full object-cover" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Reference image loaded</p>
            <p className="text-xs text-white/50">Saved profile photo or embedding is used as the database reference.</p>
          </div>
        </div>
      ) : null}

      <p className="mb-2 max-w-sm text-center text-white/60">{faceStatus}</p>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <div className="flex w-full gap-4">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-white/5 py-3 font-semibold text-white/60 transition-colors hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={handleVerify}
          disabled={verifying || !liveDescriptor || !referenceReady || !modelsReady || !livenessPassed}
          className="flex-[2] rounded-xl bg-theme-secondary py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {verifying ? "Auto-verifying..." : "Verify Identity"}
        </button>
      </div>
    </div>
  );
}
