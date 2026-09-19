"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, Star, ShieldCheck, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";

interface PdfTemplateGalleryProps {
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
}

export function PdfTemplateGallery({
  selectedTemplateId,
  onSelectTemplate,
}: PdfTemplateGalleryProps) {
  const templates = Object.values(TEMPLATE_REGISTRY);

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 mb-3 px-3 py-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" /> Pure HTML/CSS PDF Templates
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Choose a Curated Resume Template
        </h2>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto text-sm">
          Select from ATS-optimized templates modeled directly after academic LaTeX standards and modern tech formats. Instant re-rendering with zero compile latency.
        </p>
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
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10 bg-card"
                    : "border-border hover:border-emerald-500/50 bg-card/60"
                }`}
              >
                <div className="h-44 bg-slate-100 dark:bg-slate-900 border-b relative p-3 flex flex-col justify-center items-center overflow-hidden group">
                  {/* Visual mockup representation */}
                  <div className="w-28 h-36 bg-white dark:bg-slate-950 shadow-md rounded-sm p-2 flex flex-col gap-1.5 transition-transform duration-300 group-hover:scale-105 border border-slate-200 dark:border-slate-800">
                    <div className="h-2 w-14 bg-slate-800 dark:bg-slate-300 rounded-sm mx-auto" />
                    <div className="h-1 w-20 bg-slate-400 dark:bg-slate-600 rounded-sm mx-auto mb-1" />
                    <div className="h-1 w-full bg-emerald-500/60 rounded-sm" />
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-5/6 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-4/6 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                    </div>
                    <div className="h-1 w-full bg-emerald-500/60 rounded-sm mt-1" />
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-300 dark:bg-slate-700 rounded-sm" />
                      <div className="h-1 w-3/4 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow">
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
                      <FileText className="w-3 h-3 text-emerald-500" /> {tpl.fontFamily.split(",")[0].replace(/'/g, "")}
                    </span>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-7 text-xs px-2.5 ${isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    >
                      {isSelected ? "Active" : "Select"}
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
