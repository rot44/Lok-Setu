import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Building2,
  User,
  Scale,
  HelpCircle,
  Lock,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import {
  analysisService,
  NoticeAnalysis,
} from "@/services/analysis.service";

type ProcessingStep = "idle" | "uploading" | "analyzing" | "completed" | "ocr_required" | "error";

export const AnalyzeDocument: React.FC = () => {
  const { language, t } = useLanguage();
  const { isAuthenticated, isInitialized } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStep>("idle");
  const [analysis, setAnalysis] = useState<NoticeAnalysis | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatus("idle");
      setAnalysis(null);
      setErrorMessage(null);
      setOcrNotice(null);
      setDocumentId(null);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile || status === "uploading" || status === "analyzing") return;

    setErrorMessage(null);
    setOcrNotice(null);

    try {
      // Step 1: Uploading file
      setStatus("uploading");
      const uploadRes = await analysisService.uploadNotice(selectedFile);
      setDocumentId(uploadRes.documentId);

      // If document was already analyzed in previous upload, return cached analysis immediately
      if (uploadRes.isCached && uploadRes.analysis) {
        setAnalysis(uploadRes.analysis);
        setStatus("completed");
        return;
      }

      // Step 2: Executing grounded analysis
      setStatus("analyzing");
      const execRes = await analysisService.executeAnalysis(uploadRes.documentId, language);

      if (execRes.status === "requires_ocr") {
        setOcrNotice(
          execRes.message ||
            "This document requires OCR processing. Scanned document or photograph detected without readable digital text."
        );
        setStatus("ocr_required");
        return;
      }

      if (execRes.analysis) {
        setAnalysis(execRes.analysis);
        setStatus("completed");
      } else {
        throw new Error("No analysis data returned from the server.");
      }
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to analyze document. Please try again.";
      setErrorMessage(msg);
    }
  };

  const handleRetry = () => {
    if (documentId) {
      setStatus("analyzing");
      setErrorMessage(null);
      analysisService
        .executeAnalysis(documentId, language)
        .then((execRes) => {
          if (execRes.status === "requires_ocr") {
            setOcrNotice(execRes.message || "Document requires OCR processing.");
            setStatus("ocr_required");
          } else if (execRes.analysis) {
            setAnalysis(execRes.analysis);
            setStatus("completed");
          }
        })
        .catch((err) => {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Retry failed.");
        });
    } else {
      handleStartAnalysis();
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStatus("idle");
    setAnalysis(null);
    setDocumentId(null);
    setOcrNotice(null);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-paper-border pb-5 space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-vermilion">
          <FileText className="h-4 w-4" />
          <span>Notice & Document Analyzer</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-neel">
          {t("nav.analyze")}
        </h1>
        <p className="text-sm text-neel-muted max-w-2xl leading-relaxed">
          Upload any official government order, municipal circular, tax notice, or challan to get a plain-language explanation of your rights, appeal windows, and action steps.
        </p>
      </div>

      {/* Auth Banner for Unauthenticated Citizens */}
      {isInitialized && !isAuthenticated && (
        <Card accent="mustard" className="p-4 sm:p-6 bg-mustard-light/20 border-mustard">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-mustard-dark shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif font-bold text-neel text-sm sm:text-base">
                  Citizen Authentication Required
                </h3>
                <p className="text-xs text-neel-muted mt-1">
                  Document analysis enforces citizen ownership and private storage. Please sign in or register to analyze your documents.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link to="/login?redirect=/analyze" className="w-full sm:w-auto">
                <Button variant="primary" size="sm" className="w-full sm:w-auto">
                  Log In
                </Button>
              </Link>
              <Link to="/register" className="w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Register
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Upload Zone (Visible if not analyzed yet) */}
      {status !== "completed" && (
        <Card accent="mustard" className="space-y-6">
          <CardHeader>
            <CardTitle>Upload Document for Plain-Language Breakdown</CardTitle>
            <CardDescription>
              Supported file formats: Digital PDF, Text (.txt), Word DOCX, and JPG/PNG notices (maximum 10MB).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <label className="flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed border-paper-border hover:border-neel rounded-lg bg-paper-light cursor-pointer transition-colors group">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-dark group-hover:bg-neel group-hover:text-white transition-colors mb-4">
                <UploadCloud className="h-7 w-7 text-neel-muted group-hover:text-white" />
              </div>
              <span className="font-serif font-bold text-neel text-base mb-1">
                {selectedFile ? selectedFile.name : "Click to select or drag and drop document"}
              </span>
              <span className="text-xs text-neel-muted">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB ready for analysis`
                  : "Digital PDF, text file, or official circular"}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt"
                onChange={handleFileChange}
                disabled={status === "uploading" || status === "analyzing" || !isAuthenticated}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-paper rounded border border-paper-border text-xs gap-3">
                <div className="flex items-center gap-2 text-neel font-semibold truncate w-full sm:w-auto">
                  <FileText className="h-4 w-4 text-vermilion shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={status === "uploading" || status === "analyzing" || !isAuthenticated}
                    onClick={handleStartAnalysis}
                  >
                    {status === "uploading"
                      ? "Uploading..."
                      : status === "analyzing"
                      ? "Analyzing..."
                      : "Analyze Document"}
                  </Button>
                </div>
              </div>
            )}

            {/* In-Flight Execution Progress */}
            {(status === "uploading" || status === "analyzing") && (
              <div className="p-4 rounded-lg bg-paper-light border border-paper-border space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neel uppercase tracking-wider">
                  <div className="h-2 w-2 rounded-full bg-vermilion animate-ping" />
                  <span>
                    {status === "uploading"
                      ? "Step 1 of 2: Uploading notice to secure storage..."
                      : "Step 2 of 2: Grounding analysis & checking citizen rights..."}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-neel-muted">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-sage-dark" />
                    <span>Validating file magic bytes and document integrity</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        status === "analyzing" ? "text-sage-dark" : "text-paper-border"
                      }`}
                    />
                    <span>Extracting digital clauses & detecting scanned boundaries</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        status === "analyzing" ? "text-vermilion animate-spin" : "text-paper-border"
                      }`}
                    />
                    <span>Cross-referencing official statutes & resolving citations</span>
                  </p>
                </div>
              </div>
            )}

            {/* OCR Required State */}
            {status === "ocr_required" && (
              <div className="p-4 sm:p-5 rounded-lg bg-mustard-light/30 border border-mustard space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-mustard-dark shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-serif font-bold text-neel text-sm">
                      OCR Processing Required: Scanned Document or Image Detected
                    </h4>
                    <p className="text-neel-muted leading-relaxed">
                      {ocrNotice ||
                        "This document appears to be a scanned PDF or photograph without selectable digital text. Optical character recognition (OCR) is required to parse image content, but OCR is currently not configured on this server."}
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Upload Different Document
                  </Button>
                </div>
              </div>
            )}

            {/* Error State */}
            {status === "error" && (
              <div className="p-4 rounded-lg bg-vermilion-light/20 border border-vermilion space-y-3 text-xs">
                <div className="flex items-start gap-2 text-vermilion font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Analysis Error</span>
                </div>
                <p className="text-neel-muted">{errorMessage}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="primary" size="sm" onClick={handleRetry}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Retry Analysis
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Select Another File
                  </Button>
                </div>
              </div>
            )}

            <Alert variant="info" title="Citizen Privacy & Grounding Protection">
              Uploaded notices are processed securely. The notice content is strictly separated from official government statutes. If any deadline or amount is ambiguous in the notice, Lok-Setu flags it rather than making assumptions.
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Completed Structured Results */}
      {status === "completed" && analysis && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-lg border border-paper-border">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-sage-dark" />
              <span className="font-serif font-bold text-neel text-sm sm:text-base">
                {selectedFile?.name || "Official Notice"}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sage text-neel">
                Grounded Analysis
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Analyze Another Document
            </Button>
          </div>

          {/* Plain-Language Summary */}
          <Card accent="vermilion">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-vermilion" />
                  <span>Plain-Language Summary</span>
                </CardTitle>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-paper-dark text-neel">
                  Zero Legalese
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neel leading-relaxed font-serif">
                {analysis.summary}
              </p>
            </CardContent>
          </Card>

          {/* Grid: What Notice Says vs Actions & Deadlines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* What the Notice Explicitly States */}
            <Card accent="neel" className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-neel" />
                  <CardTitle className="text-base">Stated in Notice</CardTitle>
                </div>
                <CardDescription>
                  Factual statements directly extracted from the uploaded document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-neel leading-relaxed">
                  {analysis.noticeFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-neel-muted font-bold shrink-0">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Important Dates & Deadlines */}
            <Card accent="mustard" className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-mustard-dark" />
                  <CardTitle className="text-base">Dates & Deadlines</CardTitle>
                </div>
                <CardDescription>
                  Explicit timeframes, reply windows, or hearing dates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-neel leading-relaxed">
                  {analysis.datesAndDeadlines.map((date, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2 rounded bg-mustard-light/20 border border-mustard/40">
                      <Calendar className="h-3.5 w-3.5 text-mustard-dark shrink-0 mt-0.5" />
                      <span className="font-semibold">{date}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Requested Actions & Penalties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Requested Actions */}
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sage-dark" />
                  <CardTitle className="text-base">Requested Actions</CardTitle>
                </div>
                <CardDescription>
                  Required steps, documents to present, or procedures to complete.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-neel leading-relaxed">
                  {analysis.actionItems.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sage text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Penalties & Consequences */}
            <Card accent="vermilion" className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-vermilion" />
                  <CardTitle className="text-base">Penalties & Consequences</CardTitle>
                </div>
                <CardDescription>
                  Explicitly mentioned fines, late fees, or enforcement actions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-neel leading-relaxed">
                  {analysis.penalties.map((penalty, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2 rounded bg-vermilion-light/20 border border-vermilion/40 text-vermilion-dark font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 text-vermilion shrink-0 mt-0.5" />
                      <span>{penalty}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Rights & Procedural Protections (with Verified Citations) */}
          <Card accent="sage">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-sage-dark" />
                  <CardTitle className="text-base sm:text-lg">
                    Citizen Rights & Procedural Safeguards
                  </CardTitle>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sage text-neel">
                  Statutory Backing
                </span>
              </div>
              <CardDescription>
                Procedural entitlements and safeguards supported by verified official legal sources.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-neel leading-relaxed">
                {analysis.keyRights.map((right, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-sage-dark shrink-0 mt-0.5" />
                    <span>{right}</span>
                  </li>
                ))}
              </ul>

              {/* Verified Source Citations */}
              {analysis.citations && analysis.citations.length > 0 && (
                <div className="pt-4 border-t border-paper-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neel-muted block">
                    Verified Statutory Citations ({analysis.citations.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {analysis.citations.map((cite, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white border border-paper-border text-[11px] text-neel hover:border-vermilion transition-colors"
                      >
                        <Scale className="h-3 w-3 text-vermilion shrink-0" />
                        <span className="font-semibold truncate max-w-[200px]">
                          {cite.title}
                        </span>
                        {cite.clauseNumber && (
                          <span className="text-neel-muted">| {cite.clauseNumber}</span>
                        )}
                        {cite.sourceUrl && (
                          <a
                            href={cite.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-vermilion hover:underline ml-1"
                            title="Open official statutory portal"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real-World Impact Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-neel" />
                  <CardTitle className="text-base">Citizen & Household Impact</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neel leading-relaxed">
                  {analysis.citizenImpact}
                </p>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-neel" />
                  <CardTitle className="text-base">MSME & Business Impact</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neel leading-relaxed">
                  {analysis.businessImpact}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Missing / Ambiguous Information */}
          {analysis.missingInformation && analysis.missingInformation.length > 0 && (
            <Card className="bg-paper-light border-paper-border">
              <CardHeader>
                <div className="flex items-center gap-2 text-neel">
                  <HelpCircle className="h-4 w-4 text-mustard-dark" />
                  <CardTitle className="text-base">Missing or Ambiguous Information</CardTitle>
                </div>
                <CardDescription>
                  Important details that the uploaded notice does not explicitly specify.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-xs text-neel-muted">
                  {analysis.missingInformation.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-mustard-dark font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Mandatory Disclaimer */}
          <div className="p-4 rounded-lg bg-paper border border-paper-border text-center text-xs text-neel-muted space-y-1">
            <p className="font-semibold text-neel">
              🏛️ {analysis.disclaimer}
            </p>
            <p>
              This is an informational analysis of your uploaded document. It does not constitute official legal advice or a binding government ruling.
            </p>
          </div>
        </div>
      )}

      {/* Instructions Grid (Visible when idle) */}
      {status === "idle" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-neel-muted">
          <div className="flex items-start gap-2.5 p-3.5 bg-white border border-paper-border rounded">
            <ShieldCheck className="h-5 w-5 text-vermilion shrink-0" />
            <div>
              <span className="font-bold text-neel block mb-0.5">Zero Legalese</span>
              Translated into clear regional language explanations.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3.5 bg-white border border-paper-border rounded">
            <AlertCircle className="h-5 w-5 text-mustard-dark shrink-0" />
            <div>
              <span className="font-bold text-neel block mb-0.5">Citizen Rights First</span>
              Reveals what authorities cannot mandate without due notice.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3.5 bg-white border border-paper-border rounded">
            <FileText className="h-5 w-5 text-neel shrink-0" />
            <div>
              <span className="font-bold text-neel block mb-0.5">Actionable Timelines</span>
              Lists exact appeal deadlines and procedural next steps.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
