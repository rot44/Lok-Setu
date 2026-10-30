import React, { useState } from "react";
import { UploadCloud, FileText, AlertCircle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

export const AnalyzeDocument: React.FC = () => {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
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

      {/* Upload Box */}
      <Card accent="mustard" className="space-y-6">
        <CardHeader>
          <CardTitle>Upload Document for Plain-Language Breakdown</CardTitle>
          <CardDescription>
            Supported file formats: PDF, DOCX, JPG, and PNG (maximum 10MB per file).
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
                : "PDF, Word DOCX, or clear smartphone photograph"}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {selectedFile && (
            <div className="flex items-center justify-between p-3.5 bg-paper rounded border border-paper-border text-xs">
              <div className="flex items-center gap-2 text-neel font-semibold truncate">
                <FileText className="h-4 w-4 text-vermilion shrink-0" />
                <span className="truncate">{selectedFile.name}</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => alert("Document upload & analysis pipeline will process this document.")}
              >
                Analyze Document
              </Button>
            </div>
          )}

          <Alert variant="info" title="Citizen Privacy & Grounding Protection">
            Uploaded notices are securely processed using Gemini 3.8 Flash without storing sensitive personal data. If any information in the notice is ambiguous, Lok-Setu explicitly flags it instead of making assumptions.
          </Alert>
        </CardContent>
      </Card>

      {/* Instructions Grid */}
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
    </div>
  );
};
