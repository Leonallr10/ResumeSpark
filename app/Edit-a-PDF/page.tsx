import { PdfTemplateLoader } from "@/components/pdf-template-loader";

export const metadata = {
  title: "PDF Template Editor | ResumeSpark",
  description:
    "Interactive pure HTML/CSS PDF Resume Editor with instant preview, AI suggestions, and ATS optimization.",
};

export default function EditPdfPage() {
  return <PdfTemplateLoader />;
}
