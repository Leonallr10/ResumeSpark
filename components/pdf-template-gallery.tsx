"use client";

import { useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Star, ShieldCheck, ArrowRight, FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";

interface PdfTemplateGalleryProps {
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  onUploadClick?: () => void;
  onUploadFile?: (file: File) => void;
}

export function PdfTemplateGallery({
  selectedTemplateId,
  onSelectTemplate,
  onUploadClick,
  onUploadFile,
}: PdfTemplateGalleryProps) {
  const templates = Object.values(TEMPLATE_REGISTRY);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFilePicked = (file: File) => {
    if (onUploadFile) {
      onUploadFile(file);
    } else if (onUploadClick) {
      onUploadClick();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Hidden file input for direct upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFilePicked(file);
          e.target.value = "";
        }}
      />

      <div className="text-center mb-6">
        <Badge className="bg-primary/10 text-primary border-primary/20 mb-3 px-3 py-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" /> Pure HTML/CSS PDF Templates
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Choose a Curated Resume Template
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
          Pick a template to open the resume editor. You can still switch templates later from the
          gallery tab.
        </p>

        {/* Upload Existing Resume Banner / Option */}
        {(onUploadClick || onUploadFile) && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFilePicked(file);
            }}
            className={`mt-6 max-w-2xl mx-auto p-4 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg ${
              isDragging
                ? "border-primary bg-primary/15 scale-[1.01] shadow-primary/20"
                : "border-primary/30 bg-primary/5 hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="p-2.5 rounded-lg bg-primary/15 border border-primary/30 text-primary shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Already have a resume?
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10 py-0">
                    Any Format
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload your existing PDF, Word DOCX, or image to extract and auto-fill into Classic Traditional or any curated template.
                </p>
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0 gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Resume PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {templates.map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;
          return (
            <motion.div
              key={tpl.id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                onClick={() => onSelectTemplate(tpl.id)}
                className={`cursor-pointer transition-all duration-200 border-2 overflow-hidden flex flex-col h-full ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10 bg-card"
                    : "border-border hover:border-primary/50 bg-card/60"
                }`}
              >
                <div className="h-44 bg-slate-100 dark:bg-slate-900 border-b relative p-3 flex flex-col justify-center items-center overflow-hidden group">
                  {/* Visual mockup representation */}
                  <div className="w-28 h-36 bg-white dark:bg-slate-950 shadow-md rounded-sm p-2 flex flex-col gap-1.5 transition-transform duration-300 group-hover:scale-105 border border-slate-200 dark:border-slate-800">
                    <div className="h-2 w-14 bg-slate-800 dark:bg-slate-300 rounded-sm mx-auto" />
                    <div className="h-1 w-20 bg-slate-400 dark:bg-slate-600 rounded-sm mx-auto mb-1" />
                    <div className="h-1 w-full bg-primary/60 rounded-sm" />
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-5/6 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-4/6 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                    </div>
                    <div className="h-1 w-full bg-primary/60 rounded-sm mt-1" />
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-3/4 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ATS 98+
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h3 className="font-semibold text-sm text-foreground">{tpl.name}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono">{tpl.version}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                      <FileText className="w-3 h-3 text-primary" /> {tpl.fontFamily.split(",")[0].replace(/'/g, "")}
                    </span>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-7 text-xs px-2.5 ${isSelected ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                    >
                      {isSelected ? "Continue editing" : "Use & edit"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
