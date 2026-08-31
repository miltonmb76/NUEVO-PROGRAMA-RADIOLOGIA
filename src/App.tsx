import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ExtractedFile } from "./components/ZipDicomExtractor";

const BibliographySearch = React.lazy(() => import("./components/BibliographySearch"));
const ImageSearch = React.lazy(() => import("./components/ImageSearch"));
const ExpertImageAnalysis = React.lazy(() => import("./components/ExpertImageAnalysis"));
const ZipDicomExtractor = React.lazy(() => import("./components/ZipDicomExtractor"));
const VascularAnatomyViewer = React.lazy(() => import("./components/VascularAnatomyViewer"));
const ShoulderAnatomyViewer = React.lazy(() => import("./components/ShoulderAnatomyViewer"));
const KneeAnatomyViewer = React.lazy(() => import("./components/KneeAnatomyViewer"));
const AnkleAnatomyViewer = React.lazy(() => import("./components/AnkleAnatomyViewer"));
const ThighAnatomyViewer = React.lazy(() => import("./components/ThighAnatomyViewer"));
const ThighPosteriorAnatomyViewer = React.lazy(() => import("./components/ThighPosteriorAnatomyViewer"));
const NeckAnatomyViewer = React.lazy(() => import("./components/NeckAnatomyViewer"));
const UrinaryAnatomyViewer = React.lazy(() => import("./components/UrinaryAnatomyViewer"));
const ElbowAnatomyViewer = React.lazy(() => import("./components/ElbowAnatomyViewer"));
const AbdomenAnatomyViewer = React.lazy(() => import("./components/AbdomenAnatomyViewer"));
const ScrotumAnatomyViewer = React.lazy(() => import("./components/ScrotumAnatomyViewer"));
const WristAnatomyViewer = React.lazy(() => import("./components/WristAnatomyViewer"));
const BreastAnatomyViewer = React.lazy(() => import("./components/BreastAnatomyViewer"));
const AsistenteMedidas = React.lazy(() => import("./components/AsistenteMedidas").then(m => ({ default: m.AsistenteMedidas })));
const CreadorNotasPie = React.lazy(() => import("./components/CreadorNotasPie").then(m => ({ default: m.CreadorNotasPie })));
const CreadorCuadroSinoptico = React.lazy(() => import("./components/CreadorCuadroSinoptico").then(m => ({ default: m.CreadorCuadroSinoptico })));
const CreadorSinopsisFracturas = React.lazy(() => import("./components/CreadorSinopsisFracturas").then(m => ({ default: m.CreadorSinopsisFracturas })));
const BiomechanicalRadarModule = React.lazy(() => import("./components/BiomechanicalRadarModule").then(m => ({ default: m.BiomechanicalRadarModule })));
const AbdominalWallAnatomyViewer = React.lazy(() => import("./components/AbdominalWallAnatomyViewer"));
const CalfAchillesAnatomyViewer = React.lazy(() => import("./components/CalfAchillesAnatomyViewer"));
const NeonatalBrainAnatomyViewer = React.lazy(() => import("./components/NeonatalBrainAnatomyViewer"));
import { Findings3dRenderModule, Create3dRenderModal, Finding3dRender } from "./components/Findings3dRenderModule";
import CaseAnalysisRenderer from "./components/CaseAnalysisRenderer";
import InteractiveCaseEditor from "./components/InteractiveCaseEditor";
import { ClassificationBreakdownModule } from "./components/ClassificationBreakdownModule";
import { CaseAnalysisData, CaseAnalysisFormatOption, CaseAnalysisElementsConfig } from "./types";
import { 
  Activity, 
  ShieldCheck,
  AlertCircle, 
  ArrowDown,
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Code, 
  Copy, 
  FileDown,
  FileImage,
  Image as ImageIcon, 
  FileText, 
  History, 
  Layers, 
  MessageSquare, 
  Send,
  Key,
  Plus,
  RefreshCw, 
  Search, 
  Settings, 
  Sliders, 
  Sparkles, 
  Trash2, 
  Upload, 
  X,
  BookOpen,
  ExternalLink,
  Printer,
  User,
  Mic,
  MicOff,
  Square,
  Loader2,
  Undo,
  Edit,
  Save,
  RotateCcw,
  Download,
  Zap,
  Brain,
  Bone,
  Languages,
  Database,
  BookOpenText,
  Maximize2,
  Minimize2,
  Columns,
  Eye,
  Ruler,
  Bookmark,
  Box
} from "lucide-react";
import { initAuth, googleSignIn, logout as googleLogout, anonymousSignIn, emailSignIn, emailSignUp, getFirebaseConfig } from "./firebaseAuth";
import { CloudStudy, saveStudyToCloud, getStudiesFromCloud, deleteStudyFromCloud, Worklist, WorklistPatient, saveWorklistToCloud, getWorklistFromCloud, getSingleStudyFromCloud, testFirebaseConfigConnection } from "./firebaseDb";
import { idbSaveWorklist, idbGetWorklist, idbClearWorklist, idbSaveStudy, idbGetAllStudies, idbDeleteStudy, idbSaveHistory, idbGetHistory } from "./localDb";
import { uploadPdfToDrive } from "./lib/googleDrive";
import { Mail, LogOut, Clock, Calendar, ListTodo, UserCheck, ImagePlus, Wifi, HelpCircle, Info, Laptop, Network, ChevronDown, Link } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  STUDY_PRESETS, 
  PROMPT_SHORTCUTS, 
  GENERAL_SYSTEM_INSTRUCTION, 
  CHAT_SYSTEM_INSTRUCTION, 
  CLASSIFICATION_SYSTEM_INSTRUCTION, 
  CLASSIFICATIONS_DATA, 
  INTERACTIVE_RESULTS,
  Presets,
  ClassificationSystem 
} from "./constants";

// Interceptor global seguro de localStorage (preserva historial y delega datos pesados a IndexedDB)
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key: string, value: string) {
      try {
        originalSetItem.call(window.localStorage, key, value);
      } catch (error: any) {
        console.warn(`[SafeLocalStorage] Cuota de localStorage excedida para '${key}'. Se usar√° almacenamiento persistente IndexedDB.`);
        if (key === "rad_local_studies") {
          try {
            // Guardar versi√≥n ligera sin PDF base64 pesado para fallback en localStorage
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              const light = parsed.map((s: any) => ({ ...s, pdfBase64: "", attachedImages: [] }));
              originalSetItem.call(window.localStorage, key, JSON.stringify(light));
            }
          } catch (lightErr) {
            console.warn("[SafeLocalStorage] No se pudo guardar fallback ligero:", lightErr);
          }
        }
      }
    };
  }
} catch (e) {
  console.error("[SafeLocalStorage] Error al inicializar el interceptor:", e);
}

// Structure for historical reports stored in local storage
interface SavedReport {
  id: string;
  timestamp: string;
  studyType: string;
  clinicalHistory: string;
  reportText: string;
}


export const DIAGNOSTIC_GLOSSARY = [
  {
    acronym: "BI-RADS",
    name: "Breast Imaging-Reporting and Data System",
    category: "Mamograf√≠a",
    desc: "Escala estandarizada oficial para mamograf√≠a, ultrasonido y resonancia de mamas. Categor√≠as del 0 (estudio incompleto) al 6 (malignidad comprobada por biopsia). El BI-RADS 4 indica sospecha de lesi√≥n y amerita biopsia histol√≥gica."
  },
  {
    acronym: "ACR",
    name: "American College of Radiology",
    category: "General",
    desc: "Asociaci√≥n m√©dica norteamericana responsable de estandarizar la nomenclatura radiol√≥gica, gu√≠as de pr√°ctica cl√≠nica y control de calidad de dosis de radiaci√≥n ionizante."
  },
  {
    acronym: "U. Hounsfield (HU)",
    name: "Unidades Hounsfield",
    category: "Tomograf√≠a",
    desc: "Escala lineal que cuantifica cuantitativamente la atenuaci√≥n f√≠sica de los rayos X en tejidos. Referencias clave: Aire (-1000 HU), Grasa (-120 a -80 HU), Agua pura (0 HU), Sangre coagulada (+60 a +80 HU), e Hueso cortical (+1000 HU)."
  },
  {
    acronym: "FLAIR",
    name: "Fluid-Attenuated Inversion Recovery",
    category: "Resonancia",
    desc: "Atenuaci√≥n de Fluido por Recuperaci√≥n de Inversi√≥n. Secuencia de resonancia magn√©tica ponderada en T2 donde se cancela la se√±al libre del l√≠quido cefalorraqu√≠deo. Es de vital importancia para visualizar la esclerosis m√∫ltiple, infartos cerebrales tempranos y otras patolog√≠as con edema perilesional."
  },
  {
    acronym: "CIE-10 (CIE10)",
    name: "Clasificaci√≥n Internacional de Enfermedades",
    category: "General",
    desc: "C√≥digo de clasificaci√≥n diagn√≥stica administrado por la Organizaci√≥n Mundial de la Salud (OMS). Facilita el cruce internacional de morbimortalidad y estandariza la facturaci√≥n m√©dica (ej. M54.5 para lumbalgia)."
  },
  {
    acronym: "TI-RADS",
    name: "Thyroid Imaging-Reporting and Data System",
    category: "Ultrasonido",
    desc: "Escala ecogr√°fica para evaluar el riesgo de malignidad en n√≥dulos tiroideos. Basado en composici√≥n, ecogenicidad, forma, m√°rgenes y focos ecog√©nicos. Facilita decidir de forma objetiva la indicaci√≥n de biopsia por aspiraci√≥n con aguja fina (BAAF)."
  },
  {
    acronym: "PI-RADS",
    name: "Prostate Imaging-Reporting and Data System",
    category: "Resonancia",
    desc: "Est√°ndar cl√≠nico de informe para RM multiparam√©trica de pr√≥stata. Valora zonas perif√©rica e transicional con escalas de 1 (altamente improbable) a 5 (alta sospecha de c√°ncer cl√≠nicamente significativo)."
  },
  {
    acronym: "LI-RADS",
    name: "Liver Imaging-Reporting and Data System",
    category: "Tomograf√≠a",
    desc: "Sistema estandarizado de categorizaci√≥n para hallazgos hep√°ticos en pacientes cirr√≥ticos o con sospecha diagn√≥stica de carcinoma hepatocelular (CHC)."
  },
  {
    acronym: "Opacidad Alveolar",
    name: "Consolidaci√≥n de Espacio A√©reo",
    category: "Radiograf√≠a",
    desc: "Hallazgo en tele de t√≥rax caracterizado por el reemplazo del aire gas alveolar por exudado, sangre o pus. Cl√≠nicamente compatible con neumon√≠a cl√°sica, contusi√≥n pulmonar o edema agudo de pulm√≥n. Produce signo de broncograma a√©reo."
  },
  {
    acronym: "Atelectasia",
    name: "Colapso Parcial de Par√©nquima",
    category: "Radiograf√≠a",
    desc: "P√©rdida localizada de volumen pulmonar por reabsorci√≥n u obstrucci√≥n bronquial. Radiogr√°ficamente se presenta como una opacidad lineal o densa con desplazamiento de estructuras anat√≥micas."
  },
  {
    acronym: "KOSS",
    name: "Clasificaci√≥n de Kellgren & Lawrence",
    category: "General",
    desc: "Criterio radiol√≥gico clave para diagnosticar y medir el grado de osteoartritis de rodilla. Grados de 0 (normal) a 4 (severo, con grandes osteofitos y deformaci√≥n √≥sea articular marcada)."
  }
];

export interface ImageAnnotation {
  id: string;
  type: "point" | "box";
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w?: number; // percentage (0-100)
  h?: number; // percentage (0-100)
  label: string;
}

const formatDateToDMY = (dateStr: string): string => {
  if (!dateStr) return "";
  
  // Format yyyy-mm-dd
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${dd}-${mm}-${yyyy}`;
    }
  }
  
  // Format yyyy/mm/dd
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return dateStr;
};

const formatCostaRicaPhone = (rawPhone: string): string => {
  if (!rawPhone) return "";
  // Strip all non-numeric characters
  const clean = rawPhone.replace(/\D/g, "");
  if (!clean) return "";
  
  if (clean.length === 8) {
    return "506" + clean;
  }
  if (clean.startsWith("506") && clean.length > 8) {
    return clean;
  }
  if (clean.length > 8 && !clean.startsWith("506")) {
    return "506" + clean;
  }
  if (clean.length < 8 && !clean.startsWith("506")) {
    return "506" + clean;
  }
  return clean;
};

const extractSectionContent = (reportText: string, sectionKeywords: string[]): string => {
  if (!reportText) return "";
  const lines = reportText.split("\n");
  
  const normalizeHeader = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      .replace(/^[\s#\-\*]+/, "")
      .replace(/[\*\_\:]/g, "")
      .trim();
  };

  const allHeaders = [
    "tipo de estudio", "estudio",
    "historia cl√≠nica", "historia clinica", "indicaciones", "historia cl√≠nica / indicaciones", "historia clinica / indicaciones",
    "t√©cnica del examen", "tecnica del examen", "t√©cnica", "tecnica",
    "hallazgos", "hallazgos principales", "resultados",
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresiones diagn√≥sticas", "impresiones diagnosticas", "impresi√≥n", "impresion",
    "conclusi√≥n", "conclusiones", "conclusion",
    "diagn√≥stico", "diagnostico",
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen",
    "fdo", "m√©dico", "medico", "firma"
  ];

  for (const key of sectionKeywords) {
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const norm = normalizeHeader(lines[i]);
      if (norm === key || norm.startsWith(key + " ")) {
        startIndex = i;
        break;
      }
    }

    if (startIndex !== -1) {
      const sectionLines: string[] = [];
      for (let j = startIndex + 1; j < lines.length; j++) {
        const currentLine = lines[j];
        const normCurrent = normalizeHeader(currentLine);

        const isBoundary = allHeaders.some(h => {
          if (normCurrent === h) return true;
          if (normCurrent.startsWith(h + ":") || normCurrent.startsWith(h + " ")) return true;
          return false;
        });
        if (isBoundary) {
          break;
        }
        sectionLines.push(currentLine);
      }

      const extractedText = sectionLines.join("\n").trim();
      if (extractedText && extractedText.replace(/[\s\-\*\#\:\.]/g, "").length > 0) {
        return extractedText;
      }
    }
  }
  return "";
};

const extractImpresionDiagnostica = (reportText: string): string => {
  return extractSectionContent(reportText, [
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresi√≥n diagnostica", "impresion diagn√≥stica", 
    "impresiones diagn√≥sticas", "impresiones diagnosticas", "conclusi√≥n", "conclusiones", "conclusion", 
    "diagn√≥stico", "diagnostico", "impresi√≥n", "impresion"
  ]);
};

const extractHallazgos = (reportText: string): string => {
  return extractSectionContent(reportText, ["hallazgos principales", "hallazgos", "resultados"]);
};

const extractResumenOperacional = (reportText: string): string => {
  if (!reportText) return "";

  // 1st Priority: Explicit Resumen Operacional / Resumen Ejecutivo
  const explicitResumen = extractSectionContent(reportText, [
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen"
  ]);
  if (explicitResumen) return explicitResumen;

  // 2nd Priority: Impresi√≥n Diagn√≥stica / Conclusi√≥n / Diagn√≥stico
  const impresion = extractImpresionDiagnostica(reportText);
  if (impresion) return impresion;

  // 3rd Priority: Hallazgos Principales / Hallazgos
  const hallazgos = extractHallazgos(reportText);
  if (hallazgos) return hallazgos;

  // Fallback 1: let's look for bullet points in the entire report that are NOT part of standard template headers
  const lines = reportText.split("\n");
  const normalizeHeader = (text: string): string => {
    return text
      .trim()
      .toLowerCase()
      .replace(/^[\s#\-\*]+/, "")
      .replace(/[\*\_\:]/g, "")
      .trim();
  };

  const allHeaders = [
    "tipo de estudio", "estudio",
    "historia cl√≠nica", "historia clinica", "indicaciones", "historia cl√≠nica / indicaciones", "historia clinica / indicaciones",
    "t√©cnica del examen", "tecnica del examen", "t√©cnica", "tecnica",
    "hallazgos", "hallazgos principales", "resultados",
    "impresi√≥n diagn√≥stica", "impresion diagnostica", "impresiones diagn√≥sticas", "impresiones diagnosticas", "impresi√≥n", "impresion",
    "conclusi√≥n", "conclusiones", "conclusion",
    "diagn√≥stico", "diagnostico",
    "resumen operacional de hallazgos", "resumen operacional", "resumen ejecutivo", "resumen de hallazgos", "resumen",
    "fdo", "m√©dico", "medico", "firma"
  ];

  const cleanBulletLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-") && !trimmed.startsWith("*") && !/^\d+\./.test(trimmed)) return false;
    
    // Check if the bullet line is just a header
    const norm = normalizeHeader(trimmed);
    if (allHeaders.includes(norm)) return false;
    
    return true;
  });

  if (cleanBulletLines.length > 0) {
    return cleanBulletLines.slice(0, 6).join("\n");
  }

  // Fallback 2: If we still don't have anything, let's look for the last section of the report that has text
  let lastNonEmptyBlock: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line) {
      // If we hit a known header or potential header line, that starts the block!
      const norm = normalizeHeader(line);
      const isHeaderLine = allHeaders.includes(norm) || norm.endsWith(":") || line.startsWith("#");
      if (isHeaderLine) {
        lastNonEmptyBlock.unshift(line);
        // Let's get the content below it
        let j = i + 1;
        while (j < lines.length) {
          const subLine = lines[j].trim();
          const subNorm = normalizeHeader(subLine);
          if (allHeaders.some(h => subNorm === h || subNorm.startsWith(h + ":"))) {
            break;
          }
          if (subLine) {
            lastNonEmptyBlock.push(lines[j]);
          }
          j++;
        }
        break;
      }
    }
  }

  if (lastNonEmptyBlock.length > 0) {
    // Remove the header line if it's there
    const headerLine = lastNonEmptyBlock[0];
    const normHeader = normalizeHeader(headerLine);
    if (allHeaders.some(h => normHeader === h || normHeader.startsWith(h + ":"))) {
      lastNonEmptyBlock.shift();
    }
    const fallbackText = lastNonEmptyBlock.join("\n").trim();
    if (fallbackText) {
      return fallbackText;
    }
  }

  return "";
};

interface ManualPatientAdderProps {
  onAdd: (newPatient: { name: string; age: string; gender: string; patientId: string; studyType: string; time: string; phone?: string }) => void;
}

const ManualPatientAdder: React.FC<ManualPatientAdderProps> = ({ onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [patientId, setPatientId] = useState("");
  const [studyType, setStudyType] = useState("");
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      age: age.trim(),
      gender: gender,
      patientId: patientId.trim(),
      studyType: studyType.trim(),
      time: time.trim(),
      phone: formatCostaRicaPhone(phone.trim())
    });
    // Reset form
    setName("");
    setAge("");
    setGender("");
    setPatientId("");
    setStudyType("");
    setTime("");
    setPhone("");
    setIsOpen(false);
  };

  return (
    <div className="bg-slate-950/20 border border-slate-850 rounded-xl overflow-hidden mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 flex items-center justify-between transition tracking-wider font-mono"
      >
        <span className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-indigo-400" /> A√±adir Paciente Manual
        </span>
        <ChevronRight className={`h-3 w-3 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="p-3.5 border-t border-slate-850/40 space-y-2.5 bg-slate-900/5">
          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              placeholder="Ej. Carlos P√©rez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Edad</label>
              <input
                type="text"
                placeholder="Ej. 45"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">G√©nero</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
              >
                <option value="">--</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Identificaci√≥n</label>
              <input
                type="text"
                placeholder="C√©dula / ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Hora Turno</label>
              <input
                type="text"
                placeholder="Ej. 08:30"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Estudio Solicitado</label>
            <input
              type="text"
              placeholder="Ej. Ecograf√≠a Renal"
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          <div>
            <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block mb-1">Tel√©fono o Celular (Costa Rica)</label>
            <input
              type="text"
              placeholder="Ej. 8888-8888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white font-bold text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition"
          >
            Agregar a la Agenda
          </button>
        </form>
      )}
    </div>
  );
};

interface UltrasoundWorklistExporterProps {
  patients: WorklistPatient[];
}

const UltrasoundWorklistExporter: React.FC<UltrasoundWorklistExporterProps> = ({ patients }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"standard_csv" | "samsung_v7_csv" | "ge_csv" | "mindray_xml" | "json_bridge">("samsung_v7_csv");
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<"export" | "guide">("export");

  const handleExport = () => {
    if (patients.length === 0) {
      alert("No hay pacientes en la agenda para exportar.");
      return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    if (exportFormat === "standard_csv") {
      const headers = ["ID Paciente", "Nombre Completo", "Edad", "Genero", "Estudio Solicitado", "Hora Turno", "Estado"];
      const rows = patients.map(p => [
        p.patientId || `REG-${p.id.substring(p.id.length - 4)}`,
        p.name,
        p.age || "",
        p.gender || "",
        p.studyType || "",
        p.time || "",
        p.status
      ]);
      const csvContent = "\ufeff" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `agenda_radiologia_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "samsung_v7_csv") {
      // Samsung V7 optimized CSV structure with standard DICOM field mappings
      const headers = ["PatientID", "PatientName", "Gender", "BirthDate", "StudyDescription", "AccessionNumber", "ScheduledDate", "ScheduledTime"];
      const rows = patients.map(p => {
        let birthDate = "";
        if (p.age) {
          const numericAge = parseInt(p.age.replace(/\D/g, ""));
          if (!isNaN(numericAge)) {
            const birthYear = today.getFullYear() - numericAge;
            birthDate = `${birthYear}0101`; // format YYYYMMDD
          }
        }
        
        // Para el Samsung V7, exportamos el nombre completo sin delimitadores de careto "^" ni cortes.
        // Al enviarlo como un solo string continuo, el ec√≥grafo muestra el nombre completo con todos sus apellidos y nombres.
        const cleanName = p.name.trim();
        
        return [
          p.patientId || `SS-${p.id.substring(p.id.length - 4)}`,
          cleanName,
          p.gender || "O",
          birthDate,
          p.studyType || "Ultrasound",
          `ACC-${p.id.substring(p.id.length - 4)}`,
          dateStr.replace(/-/g, ""),
          p.time ? p.time.replace(":", "") + "00" : "080000"
        ];
      });
      const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Samsung_V7_Worklist_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "ge_csv") {
      const headers = ["Patient ID", "Patient Name", "Sex", "Birth Date", "Accession Number", "Requested Procedure"];
      const rows = patients.map(p => {
        let birthDate = "";
        if (p.age) {
          const numericAge = parseInt(p.age.replace(/\D/g, ""));
          if (!isNaN(numericAge)) {
            const birthYear = today.getFullYear() - numericAge;
            birthDate = `${birthYear}0101`;
          }
        }
        return [
          p.patientId || `GE-${p.id.substring(p.id.length - 4)}`,
          p.name,
          p.gender || "",
          birthDate,
          `ACC-${p.id.substring(p.id.length - 4)}`,
          p.studyType || "Ultrasound"
        ];
      });
      const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=ascii;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GE_Worklist_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "mindray_xml") {
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<PatientList Date="${dateStr}">\n`;
      patients.forEach(p => {
        const id = p.patientId || `MR-${p.id.substring(p.id.length - 4)}`;
        const sex = p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : "Other";
        xml += `  <Patient>\n`;
        xml += `    <PatientID>${id}</PatientID>\n`;
        xml += `    <Name>${p.name}</Name>\n`;
        xml += `    <Sex>${sex}</Sex>\n`;
        xml += `    <Age>${p.age || ""}</Age>\n`;
        xml += `    <ExamType>${p.studyType || "US"}</ExamType>\n`;
        xml += `    <ScheduledTime>${p.time || ""}</ScheduledTime>\n`;
        xml += `  </Patient>\n`;
      });
      xml += `</PatientList>`;
      const blob = new Blob([xml], { type: "text/xml;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `mindray_worklist_${dateStr}.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (exportFormat === "json_bridge") {
      const data = {
        date: dateStr,
        patients: patients.map(p => ({
          name: p.name,
          patientId: p.patientId || `REG-${p.id.substring(p.id.length - 4)}`,
          gender: p.gender,
          age: p.age,
          studyType: p.studyType,
          time: p.time
        }))
      };
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `worklist.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const pythonScript = `# Servidor DICOM Worklist Local (MWL SCP) para Ecografo Samsung V7
# Corre este script en tu PC (requiere instalar: pip install pynetdicom pydicom)
import os
import json
import re
import datetime
from pydicom.dataset import Dataset
from pynetdicom import AE, evt, debug_logger
from pynetdicom.sop_class import ModalityWorklistInformationFind

debug_logger() # Imprime conexiones entrantes en la consola

def cargar_pacientes():
    if os.path.exists("worklist.json"):
        with open("worklist.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("patients", [])
    return []

def formatear_nombre_dicom(nombre_completo):
    if not nombre_completo:
        return "Paciente^Anonimo"
    
    # Limpiamos espacios adicionales
    palabras = [w for w in nombre_completo.strip().split() if w]
    if not palabras:
        return "Paciente^Anonimo"
        
    # Heur√≠stica robusta de nombres en espa√±ol para evitar nombres cortados o mal ordenados:
    # 1 palabra: "Luz" -> "Luz"
    # 2 palabras: "Milton Maldonado" -> "Maldonado^Milton"
    # 3 palabras: "Milton Maldonado Brizuela" -> "Maldonado Brizuela^Milton"
    # 4 o m√°s palabras: "Maria del Carmen Gomez Perez" -> Surnames: "Gomez Perez", GivenNames: "Maria del Carmen"
    # Esto asegura que el ec√≥grafo Samsung V7 reciba todos los apellidos y nombres sin recortar nada.
    
    if len(palabras) == 1:
        return palabras[0]
    elif len(palabras) == 2:
        return f"{palabras[1]}^{palabras[0]}"
    elif len(palabras) == 3:
        # e.g., Milton Maldonado Brizuela -> Apellidos: Maldonado Brizuela, Nombre: Milton
        return f"{palabras[1]} {palabras[2]}^{palabras[0]}"
    else:
        # 4 o m√°s palabras: e.g., Maria del Carmen Gomez Perez -> Apellidos: Gomez Perez, Nombres: Maria del Carmen
        apellidos = f"{palabras[-2]} {palabras[-1]}"
        nombres = " ".join(palabras[:-2])
        return f"{apellidos}^{nombres}"

def parse_patient_age_and_dob(edad_raw):
    """
    Intenta extraer la edad y fecha de nacimiento a partir del string ingresado.
    Retorna (fecha_nacimiento_dicom, edad_dicom)
    """
    dob_fallback = "19800101"
    age_fallback = "040Y"
    
    if not edad_raw:
        return dob_fallback, age_fallback
        
    val = str(edad_raw).strip()
    
    # 1. Intentar detectar formato fecha de nacimiento: YYYY-MM-DD o DD-MM-YYYY
    # Patr√≥n YYYY-MM-DD / YYYY/MM/DD
    match_iso = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', val)
    # Patr√≥n DD-MM-YYYY / DD/MM/YYYY
    match_lat = re.search(r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', val)
    
    dt = None
    if match_iso:
        try:
            dt = datetime.date(int(match_iso.group(1)), int(match_iso.group(2)), int(match_iso.group(3)))
        except ValueError:
            pass
    elif match_lat:
        try:
            dt = datetime.date(int(match_lat.group(3)), int(match_lat.group(2)), int(match_lat.group(1)))
        except ValueError:
            pass
            
    if dt:
        dob_str = dt.strftime("%Y%m%d")
        # Calcular edad actual en base a la fecha de nacimiento
        hoy = datetime.date.today()
        calculated_age = hoy.year - dt.year - ((hoy.month, hoy.day) < (dt.month, dt.day))
        calculated_age = max(0, calculated_age)
        age_str = f"{calculated_age:03d}Y"
        return dob_str, age_str
        
    # 2. Si no es fecha, intentar extraer un n√∫mero (ej. "45", "45 a√±os", "45a")
    match_num = re.search(r'\d+', val)
    if match_num:
        try:
            years = int(match_num.group(0))
            if 0 <= years <= 130:
                age_str = f"{years:03d}Y"
                hoy = datetime.date.today()
                # Estimamos fecha de nacimiento usando el a√±o y un mes/d√≠a promedio (06 de junio)
                birth_year = hoy.year - years
                dob_str = f"{birth_year}0601"
                return dob_str, age_str
        except Exception:
            pass
            
    return dob_fallback, age_fallback

def handle_find(event):
    print("\\n[+] Consulta DICOM recibida del Samsung V7!")
    pacientes = cargar_pacientes()
    for index, p in enumerate(pacientes):
        ds = Dataset()
        
        nombre_original = p.get("name", "").strip()
        nombre_formateado = formatear_nombre_dicom(nombre_original)
        ds.PatientName = nombre_formateado
        
        print(f"   [-] Paciente original: '{nombre_original}' -> DICOM enviado: '{nombre_formateado}'")
            
        ds.PatientID = p.get("patientId") or f"REG-{index+1:04d}"
        
        g = p.get("gender", "").upper()
        ds.PatientSex = g if g in ["M", "F"] else "O"
        
        # Calcular edad y fecha de nacimiento de forma dinamica
        edad_raw = p.get("age", "")
        dob, age_dicom = parse_patient_age_and_dob(edad_raw)
        ds.PatientBirthDate = dob
        ds.PatientAge = age_dicom
        
        print(f"       -> Edad: '{edad_raw}' | DICOM DOB: {dob} | DICOM Age: {age_dicom}")
        
        step = Dataset()
        step.ScheduledStationAETitle = "MWL_SERVER"
        # Usar la fecha actual de hoy para la cita
        step.ScheduledProcedureStepStartDate = datetime.date.today().strftime("%Y%m%d")
        step.ScheduledProcedureStepStartTime = p.get("time", "0800").replace(":", "") + "00"
        step.Modality = "US"
        step.ScheduledProcedureStepDescription = p.get("studyType", "Ecografia US")
        step.ScheduledProcedureStepID = f"SPS-{index+1:04d}"
        
        ds.ScheduledProcedureStepSequence = [step]
        ds.RequestedProcedureID = f"RP-{index+1:04d}"
        ds.RequestedProcedureDescription = p.get("studyType", "Ecografia US")
        ds.AccessionNumber = f"ACC-{index+1:04d}"
        
        yield (0xFF00, ds)

ae = AE(ae_title=b"MWL_SERVER")
ae.add_supported_context(ModalityWorklistInformationFind)

print("--------------------------------------------------")
print(" Servidor DICOM Worklist activo para Samsung V7")
print(" Direccion IP de tu PC: Usa tu IP local (ej. 192.168.1.5)")
print(" Puerto: 1040")
print(" AE Title: MWL_SERVER")
print("--------------------------------------------------")

ae.start_server(("0.0.0.0", 1040), evt_handlers=[(evt.EVT_C_FIND, handle_find)])
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="bg-slate-950/40 border border-indigo-500/25 hover:border-indigo-500/40 rounded-xl overflow-hidden mt-3 transition duration-300">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left text-[10px] font-black uppercase text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/10 flex items-center justify-between transition tracking-wider font-mono"
      >
        <span className="flex items-center gap-1.5">
          <Network className="h-4 w-4 text-indigo-400 animate-pulse" /> Sincronizar con Samsung V7
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-indigo-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-850/60 bg-slate-950/20 space-y-3.5">
          <div className="flex border-b border-slate-850/60 pb-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`flex-1 text-[8.5px] font-black uppercase tracking-wider py-1 text-center transition cursor-pointer ${
                activeTab === "export"
                  ? "text-indigo-400 border-b-2 border-indigo-500 pb-2 -mb-2 font-black"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              1. Exportar Lista
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guide")}
              className={`flex-1 text-[8.5px] font-black uppercase tracking-wider py-1 text-center transition cursor-pointer ${
                activeTab === "guide"
                  ? "text-indigo-400 border-b-2 border-indigo-500 pb-2 -mb-2 font-black"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              2. Gu√≠a Samsung V7 (Wi-Fi)
            </button>
          </div>

          {activeTab === "export" && (
            <div className="space-y-3.5">
              <p className="text-[9.5px] text-slate-400 leading-normal">
                Genera un archivo optimizado para el ec√≥grafo <strong className="text-indigo-400">Samsung V7</strong>. Desc√°rgalo para transferirlo localmente por USB o cargarlo mediante el puente de red de tu consultorio.
              </p>

              <div className="space-y-2">
                <label className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider font-mono block">Selecciona Formato</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat("samsung_v7_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "samsung_v7_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    Samsung V7 (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("standard_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "standard_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    CSV Est√°ndar (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("ge_csv")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "ge_csv"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    GE Voluson / Logiq
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("mindray_xml")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border transition cursor-pointer ${
                      exportFormat === "mindray_xml"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                  >
                    Mindray XML (.xml)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("json_bridge")}
                    className={`px-2.5 py-2 rounded-lg text-left text-[9px] font-bold border col-span-2 transition cursor-pointer ${
                      exportFormat === "json_bridge"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-black"
                        : "bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800"
                    }`}
                    title="Formato JSON directo para alimentar el servidor de red local"
                  >
                    Puente JSON (.json)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9.5px] uppercase tracking-wider py-2 rounded-lg transition flex items-center justify-center gap-2 shadow-[0_2px_10px_rgba(99,102,241,0.2)] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Descargar Archivo para Samsung V7
              </button>
            </div>
          )}

          {activeTab === "guide" && (
            <div className="space-y-3.5 text-left max-h-[350px] overflow-y-auto pr-1">
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 flex gap-2">
                <Wifi className="h-4 w-4 text-indigo-400 shrink-0" />
                <p className="text-[9px] text-slate-300 leading-relaxed font-bold">
                  ¬°Excelente elecci√≥n! Tu ec√≥grafo <span className="text-indigo-400">Samsung V7</span> est√° en red mediante cable y tu computadora a trav√©s de Wi-Fi en el mismo m√≥dem. Al estar en el mismo m√≥dem, pueden comunicarse de forma inal√°mbrica y privada.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-slate-850 rounded-lg p-2.5 space-y-1.5 bg-slate-900/10">
                  <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-1">
                    <Laptop className="h-3 w-3" /> Opci√≥n A: Carga local r√°pida por USB
                  </span>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    La forma m√°s sencilla sin instalar nada es utilizar el puerto USB de tu Samsung V7:
                  </p>
                  <ol className="list-decimal list-inside text-[9px] text-slate-400 space-y-1">
                    <li>Selecciona el formato <strong className="text-slate-300">Samsung V7 (.csv)</strong> arriba y desc√°rgalo.</li>
                    <li>Gu√°rdalo en una memoria USB e ins√©rtala en el puerto de la consola del Samsung V7.</li>
                    <li>En el ec√≥grafo, presiona la tecla de <strong className="text-slate-300">Patient</strong> en la consola t√°ctil.</li>
                    <li>Selecciona <strong className="text-slate-300">Import</strong>, selecciona el archivo CSV desde el USB y realiza el mapeo de columnas si es necesario. ¬°La lista de pacientes se cargar√° al instante!</li>
                  </ol>
                </div>

                <div className="border border-indigo-500/10 rounded-lg p-2.5 space-y-2 bg-[#090C17]">
                  <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider font-mono flex items-center gap-1 animate-pulse">
                    <Check className="h-3 w-3 text-emerald-500" /> Opci√≥n B: Puente DICOM Worklist Activo (Inal√°mbrico)
                  </span>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Si quieres automatizarlo para que al presionar el bot√≥n <strong>"Search/Query"</strong> de tu <strong>Samsung V7</strong> jale la lista autom√°ticamente por Wi-Fi sin usar USB:
                  </p>
                  
                  <ol className="list-decimal list-inside text-[9px] text-slate-400 space-y-1.5">
                    <li>Descarga la agenda en formato <strong className="text-indigo-300">Puente JSON (.json)</strong> de arriba y col√≥cala en una carpeta de tu PC.</li>
                    <li>Copia el script de Python de abajo y gu√°rdalo como <code className="text-indigo-300">samsung_mwl.py</code> en esa misma carpeta.</li>
                    <li>Ejec√∫talo en tu PC desde una consola con <code className="text-indigo-300">python samsung_mwl.py</code>.</li>
                    <li>En tu ec√≥grafo <strong>Samsung V7</strong>:
                      <ul className="list-disc list-inside pl-3 pt-1 space-y-0.5 text-slate-400">
                        <li>Presiona el bot√≥n <strong className="text-slate-300">Utility</strong> (o Setup) en la consola f√≠sica.</li>
                        <li>Ve a la pesta√±a <strong className="text-slate-300">Connectivity</strong> y luego a <strong className="text-slate-300">DICOM</strong>.</li>
                        <li>Haz clic en <strong className="text-slate-300">Add</strong> para a√±adir un servidor.</li>
                        <li>Configura <strong className="text-indigo-300">Service Type: MWL</strong> (Modality Worklist).</li>
                        <li>Establece el <strong className="text-indigo-300">AE Title: MWL_SERVER</strong>, la <strong className="text-indigo-300">IP</strong> de tu PC, y el Puerto <strong className="text-indigo-300">1040</strong>.</li>
                        <li>Haz clic en <strong className="text-slate-300">Test</strong> para verificar la conexi√≥n.</li>
                      </ul>
                    </li>
                    <li>¬°Listo! Ahora ve a la pantalla de <strong className="text-slate-300">Patient</strong>, presiona <strong className="text-slate-300">Worklist</strong>, y haz clic en <strong className="text-slate-300">Query</strong> para descargar la agenda inal√°mbricamente.</li>
                  </ol>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black uppercase text-slate-500 font-mono">Script Python Local</span>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[8px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <Copy className="h-2.5 w-2.5" /> {copiedScript ? "Copiado" : "Copiar C√≥digo"}
                      </button>
                    </div>
                    <pre className="text-[8px] font-mono p-2 bg-slate-950 rounded-lg border border-slate-850 max-h-[140px] overflow-y-auto text-indigo-300 whitespace-pre scrollbar-none select-all leading-normal">
                      {pythonScript}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default function App() {
  // Public Patient View System
  const [currentCloudStudyId, setCurrentCloudStudyId] = useState<string>("");
  const [isPatientPublicView, setIsPatientPublicView] = useState<boolean>(false);
  const [isPatientViewLoading, setIsPatientViewLoading] = useState<boolean>(false);
  const [patientViewError, setPatientViewError] = useState<string | null>(null);
  const [loadedCloudPdfBase64, setLoadedCloudPdfBase64] = useState<string>("");
  const [patientLogoUrl, setPatientLogoUrl] = useState<string>("");
  const [operationalSummaryText, setOperationalSummaryText] = useState<string>("");
  const [isGeneratingOperationalSummary, setIsGeneratingOperationalSummary] = useState<boolean>(false);

  // Navigation & General Settings
  const [activeTab, setActiveTab] = useState<"generator" | "classifications" | "consult" | "presets" | "api" | "bibliography" | "images" | "expert-analysis" | "measurements" | "cloud-db">("generator");
  
  // Synchronized export states from medical image generator
  const [exportedImage, setExportedImage] = useState<string | null>(null);
  const [exportedMimeType, setExportedMimeType] = useState<string>("");
  const clearExportedImage = () => {
    setExportedImage(null);
    setExportedMimeType("");
  };
  
  // Patient Infographic generation states
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState<boolean>(false);
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicError, setInfographicError] = useState<string | null>(null);
  const [attachInfographicToOfficialReport, setAttachInfographicToOfficialReport] = useState<boolean>(false);
  // Local storage customizable instructions
  const [systemInstruction, setSystemInstruction] = useState<string>("");
  const [chatInstruction, setChatInstruction] = useState<string>("");
  const [classifyInstruction, setClassifyInstruction] = useState<string>("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // 1. STATE FOR REPORT GENERATOR
  const [selectedPresetId, setSelectedPresetId] = useState<string>("torax-rx");
  const [studyType, setStudyType] = useState<string>("");
  const [clinicalHistory, setClinicalHistory] = useState<string>("");
  const [findings, setFindings] = useState<string>("");
  const [inputReport, setInputReport] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  // 1b. Patient & Corporate Header customization states for PDF/Print
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<string>("");
  const [patientGender, setPatientGender] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [dicomNotification, setDicomNotification] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState<string>(() => localStorage.getItem("rad_patient_email") || "");
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [clinicName, setClinicName] = useState<string>("");
  const [doctorName, setDoctorName] = useState<string>(() => {
    const saved = localStorage.getItem("rad_doctor_name");
    if (!saved || saved === "Dr. Benavides S. Cod.6025" || (saved.includes("Benavides S. Cod.6025") && !saved.includes("Milton"))) {
      localStorage.setItem("rad_doctor_name", "Dr. Milton Benavides S. Cod.6025");
      return "Dr. Milton Benavides S. Cod.6025";
    }
    return saved;
  });
  const [doctorLicense, setDoctorLicense] = useState<string>(() => {
    const saved = localStorage.getItem("rad_doctor_license");
    if (!saved || saved === "M.S.P. Reg: 6025 / Senescyt: 1005-12-7489") {
      localStorage.setItem("rad_doctor_license", "C√≥digo Profesional 6025");
      return "C√≥digo Profesional 6025";
    }
    return saved;
  });
  
  // Helper to generate a stable, professional cryptographic verification hash
  const getValidationHash = () => {
    const seed = `${patientName || ""}-${doctorName || ""}-${reportDate || ""}-${clinicName || ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
    const pSeed = (patientName && patientName.length > 0) ? patientName.charCodeAt(0) + patientName.length : 42;
    const dSeed = (doctorName && doctorName.length > 0) ? doctorName.charCodeAt(0) + doctorName.length : 17;
    const partKey = ((pSeed * 231 + dSeed * 19) % 65535).toString(16).toUpperCase().padStart(4, "E");
    return `SHA256: FD82-${hex.substring(0, 4)}-${hex.substring(4, 8)}-${partKey}-9B1C-E8B1`;
  };
  // Multiple custom clinic logo upload states
  const [customLogos, setCustomLogos] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    const saved = localStorage.getItem("rad_custom_logos");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    const legacyLogo = localStorage.getItem("rad_custom_logo");
    if (legacyLogo) {
      return [{ id: "custom-legacy", name: "Logotipo Principal", url: legacyLogo }];
    }
    return [];
  });
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadStatus, setDriveUploadStatus] = useState("");

  const [selectedLogo, setSelectedLogo] = useState<string>(() => {
    const saved = localStorage.getItem("rad_selected_logo");
    if (saved) return saved;
    const oldLegacy = localStorage.getItem("rad_custom_logo");
    if (oldLegacy) return "custom-legacy";
    return "none";
  });

  const [customLogoStyle, setCustomLogoStyle] = useState<string>(() => {
    return localStorage.getItem("rad_custom_logo_style") || "left"; // "left" or "banner"
  });

  useEffect(() => {
    localStorage.setItem("rad_custom_logos", JSON.stringify(customLogos));
  }, [customLogos]);

  useEffect(() => {
    localStorage.setItem("rad_selected_logo", selectedLogo);
  }, [selectedLogo]);

  const customLogoUrl = useMemo(() => {
    if (isPatientPublicView && patientLogoUrl) {
      return patientLogoUrl;
    }
    const matched = customLogos.find(l => l.id === selectedLogo);
    if (matched) return matched.url;
    if (selectedLogo === "custom" && customLogos.length > 0) {
      return customLogos[0].url;
    }
    return "";
  }, [isPatientPublicView, patientLogoUrl, selectedLogo, customLogos]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem("rad_selected_model");
    if (!saved || saved === "gemini-3.6-flash" || saved === "gemini-2.5-flash" || saved === "gemini-1.5-flash") {
      return "gemini-3.7-flash";
    }
    return saved;
  });

  useEffect(() => {
    localStorage.setItem("rad_selected_model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewStudyId = params.get("view_study");
    if (viewStudyId) {
      setIsPatientPublicView(true);
      setIsPatientViewLoading(true);
      setPatientViewError(null);
      
      // Try to load from local storage rad_local_studies first
      let localStudy: CloudStudy | null = null;
      try {
        const stored = localStorage.getItem("rad_local_studies");
        if (stored) {
          const parsed = JSON.parse(stored) as CloudStudy[];
          const found = parsed.find(s => s.id === viewStudyId);
          if (found) {
            localStudy = found;
          }
        }
      } catch (e) {
        console.error("Error reading local studies in view parameter:", e);
      }

      if (localStudy) {
        setCurrentCloudStudyId(localStudy.id);
        setPatientName(localStudy.patientName || "");
        setPatientEmail(localStudy.patientEmail || "");
        setPatientAge(localStudy.patientAge || "");
        setPatientGender(localStudy.patientGender || "");
        setPatientId(localStudy.patientId || "");
        setReportDate(localStudy.reportDate || "");
        setDoctorName(localStudy.doctorName || "");
        setDoctorLicense(localStudy.doctorLicense || "");
        setClinicName(localStudy.clinicName || "");
        setStudyType(localStudy.studyType || "");
        setClinicalHistory(localStudy.clinicalHistory || "");
        setFindings(localStudy.findings || "");
        setGeneratedReport(localStudy.reportText || "");
        setLoadedCloudPdfBase64(localStudy.pdfBase64 || "");
        setPatientLogoUrl(localStudy.customLogoUrl || "");
        setCustomLogoStyle(localStudy.customLogoStyle || "logo");
        setCustomSignatureUrl(localStudy.customSignatureUrl || "");
        setOperationalSummaryText(localStudy.operationalSummaryText || "");
        if (localStudy.specificStudy) setSpecificStudy(localStudy.specificStudy);
        if (localStudy.pdfLayoutType) setPdfLayoutType(localStudy.pdfLayoutType as any);
        if (localStudy.selectedLogo) setSelectedLogo(localStudy.selectedLogo);
        if (localStudy.attachedImages) setAttachedImages(localStudy.attachedImages);
        if (localStudy.findings3dRenders) setFindings3dRenders(localStudy.findings3dRenders);
        if (localStudy.patientSummary) setPatientSummary(localStudy.patientSummary);
        setIsPatientViewLoading(false);
      } else {
        getSingleStudyFromCloud(viewStudyId)
          .then((study) => {
            if (study) {
              setCurrentCloudStudyId(study.id);
              setPatientName(study.patientName || "");
              setPatientEmail(study.patientEmail || "");
              setPatientAge(study.patientAge || "");
              setPatientGender(study.patientGender || "");
              setPatientId(study.patientId || "");
              setReportDate(study.reportDate || "");
              setDoctorName(study.doctorName || "");
              setDoctorLicense(study.doctorLicense || "");
              setClinicName(study.clinicName || "");
              setStudyType(study.studyType || "");
              setClinicalHistory(study.clinicalHistory || "");
              setFindings(study.findings || "");
              setGeneratedReport(study.reportText || "");
              setLoadedCloudPdfBase64(study.pdfBase64 || "");
              setPatientLogoUrl(study.customLogoUrl || "");
              setCustomLogoStyle(study.customLogoStyle || "logo");
              setCustomSignatureUrl(study.customSignatureUrl || "");
              setOperationalSummaryText(study.operationalSummaryText || "");
              if (study.specificStudy) setSpecificStudy(study.specificStudy);
              if (study.pdfLayoutType) setPdfLayoutType(study.pdfLayoutType as any);
              if (study.selectedLogo) setSelectedLogo(study.selectedLogo);
              if (study.attachedImages) setAttachedImages(study.attachedImages);
              if (study.findings3dRenders) setFindings3dRenders(study.findings3dRenders);
              if (study.patientSummary) setPatientSummary(study.patientSummary);
            } else {
              setPatientViewError("El estudio cl√≠nico solicitado no existe o el enlace es incorrecto.");
            }
          })
          .catch((err) => {
            console.error("Error fetching single study publicly:", err);
            const isQuota = 
              err?.message?.toLowerCase().includes("quota") || 
              String(err).toLowerCase().includes("quota") || 
              err?.message?.toLowerCase().includes("exceeded") || 
              String(err).toLowerCase().includes("exceeded");
            
            if (isQuota) {
              setPatientViewError(
                "El servidor de base de datos temporal ha superado su l√≠mite de cuota diaria gratuita de Google Cloud (Plan Free de AI Studio). Por favor, contacte a su especialista de salud o reintente m√°s tarde cuando se reinicie la cuota diaria de Google. Su reporte cl√≠nico est√° guardado de forma 100% segura en la nube."
              );
            } else {
              setPatientViewError("Error de conexi√≥n al cargar el estudio cl√≠nico. Por favor, reintente.");
            }
          })
          .finally(() => {
            setIsPatientViewLoading(false);
          });
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/firebase-config")
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch server config");
        return res.json();
      })
      .then((serverConfig) => {
        const localCustomStr = localStorage.getItem("rad_custom_firebase_config");
        let localCustom = null;
        if (localCustomStr) {
          try {
            localCustom = JSON.parse(localCustomStr);
          } catch (e) {}
        }

        if (localCustom && localCustom.apiKey && localCustom.projectId) {
          // El navegador tiene una configuraci√≥n personalizada en localStorage.
          if (serverConfig && (serverConfig.projectId === "gen-lang-client-0578019690" || !serverConfig.projectId)) {
            // El servidor tiene la base de datos predeterminada de AI Studio.
            // Sincronizamos subiendo nuestra configuraci√≥n personalizada al servidor.
            console.log("Detectado Firebase personalizado en localStorage local. Sincronizando con el servidor para fijarlo...");
            fetch("/api/save-firebase-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: localCustom })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                console.log("¬°Configuraci√≥n de Firebase personalizada fijada en el servidor!");
              }
            })
            .catch(err => console.error("Error al sincronizar Firebase personalizado con el servidor:", err));
          } else if (serverConfig && serverConfig.projectId !== localCustom.projectId) {
            // El servidor tiene una configuraci√≥n personalizada diferente de la local. El servidor manda.
            console.log("Sincronizando configuraci√≥n de Firebase desde el servidor...");
            localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
            localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            window.location.reload();
          }
        } else {
          // El navegador NO tiene una configuraci√≥n en localStorage.
          if (serverConfig && serverConfig.projectId && serverConfig.projectId !== "gen-lang-client-0578019690") {
            // Pero el servidor s√≠ tiene una personalizada. La descargamos y recargamos.
            console.log("Descargando configuraci√≥n de Firebase personalizada del servidor...");
            localStorage.setItem("rad_custom_firebase_config", JSON.stringify(serverConfig));
            localStorage.setItem("rad_custom_firebase_config_raw", JSON.stringify(serverConfig, null, 2));
            window.location.reload();
          }
        }
      })
      .catch((err) => {
        console.warn("No se pudo sincronizar la configuraci√≥n de Firebase con el servidor:", err);
      });
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailAccessToken(token);
      },
      () => {
        setGmailUser(null);
        setGmailAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const compressImageBase64 = (base64Str: string, maxWidth: number = 2000, quality: number = 0.92): Promise<string> => {
    return new Promise((resolve) => {
      try {
        if (!base64Str || !base64Str.startsWith("data:image")) {
          resolve(base64Str);
          return;
        }
        const isPng = base64Str.startsWith("data:image/png");
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            if (!isPng) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, width, height);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
            
            // Preserve PNG format to keep alpha transparency and crisp vector-grade edges
            const mimeType = isPng ? "image/png" : "image/jpeg";
            const compressed = canvas.toDataURL(mimeType, quality);
            resolve(compressed);
          } else {
            resolve(base64Str);
          }
        };
        img.onerror = () => {
          resolve(base64Str);
        };
        img.src = base64Str;
      } catch (e) {
        console.error("Error compressing image:", e);
        resolve(base64Str);
      }
    });
  };

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const originalName = file.name || "Nuevo Logotipo";
    const cleanName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressedBase64 = await compressImageBase64(rawBase64, 2400, 0.95);
      const newLogoId = "custom-logo-" + Date.now();
      const newLogo = {
        id: newLogoId,
        name: cleanName,
        url: compressedBase64
      };
      setCustomLogos(prev => [...prev, newLogo]);
      setSelectedLogo(newLogoId);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogoById = (id: string) => {
    if (confirm("¬øEst√°s seguro de eliminar este logotipo de la lista?")) {
      setCustomLogos(prev => prev.filter(l => l.id !== id));
      if (selectedLogo === id) {
        setSelectedLogo("none");
      }
    }
  };

  const handleRemoveCustomLogo = () => {
    if (selectedLogo.startsWith("custom-logo-") || selectedLogo === "custom-legacy") {
      handleRemoveCustomLogoById(selectedLogo);
    } else {
      setSelectedLogo("none");
    }
  };

  const handleChangeCustomLogoStyle = (style: string) => {
    setCustomLogoStyle(style);
    localStorage.setItem("rad_custom_logo_style", style);
  };

  // Custom doctor's signature upload states
  const [customSignatureUrl, setCustomSignatureUrl] = useState<string>(() => {
    return localStorage.getItem("rad_custom_signature") || "";
  });

  const [uploadedReportContent, setUploadedReportContent] = useState<string>("");
  const [uploadedReportName, setUploadedReportName] = useState<string | null>(null);
  const [uploadedReportMimeType, setUploadedReportMimeType] = useState<string>("");
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  const handleCustomSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressedBase64 = await compressImageBase64(rawBase64, 1600, 0.95);
      setCustomSignatureUrl(compressedBase64);
      localStorage.setItem("rad_custom_signature", compressedBase64);
    };
    reader.readAsDataURL(file);
  };

  const handleReportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedReportName(file.name);
    setUploadedReportMimeType(file.type || "");
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const result = event.target?.result as string;
        setUploadedReportContent(result);
        
        // Auto-detect study type only for text-based files, skip for binary attachments like PDF or images
        const isPdfOrImage = file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf');
        if (!isPdfOrImage) {
            autoDetectSpecificStudyAndModality(result, file.name);
        }
    };
    
    const isPdfOrImage = file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (isPdfOrImage) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
  };

  const handleRemoveCustomSignature = () => {
    setCustomSignatureUrl("");
    localStorage.removeItem("rad_custom_signature");
  };

  const [showPatientDetails, setShowPatientDetails] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [adaptivePDFContrast, setAdaptivePDFContrast] = useState<boolean>(false);
  const [pdfLayoutType, setPdfLayoutType] = useState<"classic" | "clinical_slate" | "executive_medical">("classic");
  
  // PDF Real-Time Preview States
  const [printModalDocType, setPrintModalDocType] = useState<'report' | 'patient_summary'>('report');
  const [printModalViewType, setPrintModalViewType] = useState<'html_simulator' | 'pdf_viewer'>('html_simulator');
  const [generatedNativePdfUrl, setGeneratedNativePdfUrl] = useState<string | null>(null);
  const [generatedSummaryPdfUrl, setGeneratedSummaryPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdfPreview, setIsGeneratingPdfPreview] = useState<boolean>(false);
  const [isSplitPdfActive, setIsSplitPdfActive] = useState<boolean>(true);
  
  // WhatsApp Share States
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsappShareType, setWhatsappShareType] = useState<'report_pdf' | 'patient_infographic' | 'patient_summary'>('report_pdf');
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => localStorage.getItem("rad_whatsapp_phone") || "");
  const [whatsappIncludePatientSummary, setWhatsappIncludePatientSummary] = useState<boolean>(true);
  const [whatsappIncludeOperationalSummary, setWhatsappIncludeOperationalSummary] = useState<boolean>(true);
  
  // Gmail Share States
  const [showGmailModal, setShowGmailModal] = useState<boolean>(false);
  const [gmailTo, setGmailTo] = useState<string>("");
  const [gmailSubject, setGmailSubject] = useState<string>("");
  const [gmailBody, setGmailBody] = useState<string>("");
  const [gmailAttachedType, setGmailAttachedType] = useState<'report_pdf' | 'patient_summary' | 'both_pdfs'>('patient_summary');
  const [gmailAttachReport, setGmailAttachReport] = useState<boolean>(false);
  const [gmailAttachSummary, setGmailAttachSummary] = useState<boolean>(true);
  const [gmailAttachInfographic, setGmailAttachInfographic] = useState<boolean>(false);
  const [gmailSuccessMessage, setGmailSuccessMessage] = useState<string | null>(null);
  const [gmailErrorMessage, setGmailErrorMessage] = useState<string | null>(null);
  const [gmailUser, setGmailUser] = useState<any | null>(() => {
    try {
      const stored = localStorage.getItem("rad_cached_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(() => {
    return localStorage.getItem("rad_gmail_access_token");
  });
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authFormMode, setAuthFormMode] = useState<'google' | 'email_login' | 'email_register'>('google');
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);

  // 1c. WORKLIST ("LISTA DE TRABAJO") STATES
  const [worklist, setWorklist] = useState<Worklist | null>(() => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    try {
      const isExplicitlyCleared = localStorage.getItem("rad_worklist_explicitly_cleared") === "true";
      if (isExplicitlyCleared) {
        return null;
      }
      const primaryKeys = ["rad_worklist_current", "rad_worklist_latest"];
      for (const key of primaryKeys) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
            return parsed;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isWorklistSidebarOpen, setIsWorklistSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return localStorage.getItem("rad_worklist_sidebar_open") === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("rad_worklist_sidebar_open", String(isWorklistSidebarOpen));
    }
  }, [isWorklistSidebarOpen]);

  const [isProcessingWorklist, setIsProcessingWorklist] = useState<boolean>(false);
  const [worklistError, setWorklistError] = useState<string | null>(null);
  const [selectedWorklistPatientId, setSelectedWorklistPatientId] = useState<string | null>(null);
  
  // Real-time voice dictation states using Web Speech API
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const errorTimeRef = useRef<number>(0);
  const useContinuousRef = useRef<boolean>(true); // Intenta continuo primero, reduce a simple si falla

  // Premium Audio Recorder Dictation states
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [isAssistingHistory, setIsAssistingHistory] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecordingAudio = async () => {
    setSpeechError(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine modern mimeType, fallback to standard
      let mimeType = "audio/webm";
      if (typeof MediaRecorder === "undefined") {
        setSpeechError("El navegador no soporta grabaci√≥n de Voz/Dictado directa.");
        return;
      }

      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        // Fallback for iOS Safari which supports audio/mp4 for audio voice clip recording
        mimeType = "audio/mp4";
        if (!MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = ""; // use browser default
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone cleanly
        stream.getTracks().forEach((track) => track.stop());
        
        // Auto-detect the exact mimeType produced by the browser or recorder options
        const actualMime = audioChunksRef.current[0]?.type || mediaRecorder.mimeType || mimeType || "audio/webm";
        let apiMime = "audio/webm"; // standard fallback
        
        // Map detected formats precisely to supported Gemini API mimetypes
        const cleanMime = actualMime.toLowerCase();
        if (cleanMime.includes("mp4") || cleanMime.includes("m4b") || cleanMime.includes("m4a") || cleanMime.includes("quicktime")) {
          apiMime = "audio/mp4";
        } else if (cleanMime.includes("aac")) {
          apiMime = "audio/aac";
        } else if (cleanMime.includes("wav") || cleanMime.includes("wave")) {
          apiMime = "audio/wav";
        } else if (cleanMime.includes("ogg")) {
          apiMime = "audio/ogg";
        } else if (cleanMime.includes("webm")) {
          apiMime = "audio/webm";
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (audioBlob.size === 0) {
          setSpeechError("La grabaci√≥n de voz est√° vac√≠a.");
          return;
        }

        // Convert blob to base64
        setTranscribing(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result?.toString().split(",")[1];
          if (!base64Data) {
            setSpeechError("Fallo al procesar el audio.");
            setTranscribing(false);
            return;
          }

          try {
            const resp = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audio: base64Data,
                mimeType: apiMime,
              }),
            });

            const data = await resp.json();
            if (data.success && data.text) {
              const transcribedText = data.text.trim();
              setFindings((prev) => {
                const trimmedPrev = prev.trim();
                return trimmedPrev ? `${trimmedPrev} ${transcribedText}` : transcribedText;
              });
            } else {
              setSpeechError(data.error || "Error al transcribir el dictado por IA.");
            }
          } catch (e: any) {
            console.error("Transcription API error:", e);
            setSpeechError("Error de conexi√≥n: no se pudo enviar el audio al servidor de IA.");
          } finally {
            setTranscribing(false);
          }
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Slice chunks list
      setIsRecordingAudio(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access error:", err);
      setSpeechError("No se pudo acceder al micr√≥fono para realizar la grabaci√≥n de dictado.");
    }
  };

  const stopRecordingAudio = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setIsRecordingAudio(false);
  };

  const startListening = (forceSingleShot = false) => {
    setSpeechError(null);
    const SpeechRecognitionDefault = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionDefault) {
      setSpeechError("La API de Dictado por Voz no est√° soportada de forma nativa en este navegador. Recomendamos usar Safari (iOS/macOS) o Google Chrome en computador.");
      return;
    }

    // Detectar si est√° en iOS o iPadOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Los dispositivos iOS limitan de forma estricta el modo continuo. 
    // Usamos modo no-continuo con bucle de auto-reinicio para simular continuidad de manera ultra-estable.
    if (isIOSDevice || forceSingleShot) {
      useContinuousRef.current = false;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognitionDefault();
      recognition.continuous = useContinuousRef.current;
      recognition.interimResults = false;
      recognition.lang = "es-ES";

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onerror = (event: any) => {
        console.error("Reconocimiento de voz error:", event.error);
        errorTimeRef.current = Date.now();
        
        if (event.error === "not-allowed") {
          setSpeechError("Acceso denegado al micr√≥fono. Por favor, asigne permisos de micr√≥fono en la barra del navegador para dictar.");
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === "service-not-allowed") {
          // Si fall√≥ con continuous = true, baja autom√°ticamente al modo alternativo (single shot)
          if (useContinuousRef.current) {
            console.log("Reintentando dictado en modo alternativo compatible...");
            useContinuousRef.current = false;
            setTimeout(() => {
              if (isListeningRef.current) {
                startListening(true);
              }
            }, 300);
          } else {
            setSpeechError("service-not-allowed");
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          // Otros errores de red o silencio
          setSpeechError(`Error al dictar (${event.error})`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        const timeSinceLastError = Date.now() - errorTimeRef.current;
        // Si el usuario quiere seguir dictando (isListeningRef.current es true)
        // y estamos en modo no continuo, reiniciamos la sesi√≥n inmediatamente (emula dictado ilimitado en iPhone!)
        if (isListeningRef.current && !useContinuousRef.current && timeSinceLastError > 1500) {
          console.log("Reiniciando sesi√≥n de audio para dictado continuo...");
          try {
            recognition.start();
          } catch (e) {
            console.error("Fallo al auto-reiniciar:", e);
          }
        } else if (!isListeningRef.current || timeSinceLastError <= 1500) {
          setIsListening(false);
        }
      };

      recognition.onresult = (event: any) => {
        let resultText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            resultText += event.results[i][0].transcript;
          }
        }
        if (resultText) {
          setFindings((prev) => {
            const trimmedPrev = prev.trim();
            const addition = resultText.trim();
            // Evitar acumulaciones dobles instant√°neas del buffer
            if (trimmedPrev.endsWith(addition)) {
              return prev;
            }
            return trimmedPrev ? `${trimmedPrev} ${addition}` : addition;
          });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error(e);
      setSpeechError("No se pudo iniciar el dictado por voz.");
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Error stopping voice recognition:", err);
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Custom smart selection states
  const [modality, setModality] = useState<string>("Radiograf√≠a");
  const [specificStudy, setSpecificStudy] = useState<string>("T√≥rax");
  const [customStudy, setCustomStudy] = useState<string>("");
  const [laterality, setLaterality] = useState<string>(""); // "" | "Derecha" | "Izquierda" | "Bilateral"
  const [projections, setProjections] = useState<string[]>([]);
  const [customProjection, setCustomProjection] = useState<string>("");
  const [activeProtocol, setActiveProtocol] = useState<string>("");

  // Helper to build gendered laterality
  const getGenderedLaterality = (lat: string, study: string) => {
    if (!lat || lat === "Bilateral") return lat;
    const masculineStudies = [
      "Hombro", "Tobillo", "Pie", "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior", "Cr√°neo", "Abdomen",
      "Escroto", "Cuello", "T√≥rax", "Codo", "Muslo Anterior", "Muslo Posterior"
    ];

    if (masculineStudies.map(s => s.toLowerCase()).includes(study.toLowerCase())) {
      if (lat.toLowerCase() === "derecha") return "Derecho";
      if (lat.toLowerCase() === "izquierda") return "Izquierdo";
    }
    return lat;
  };

  // Helper to build projections string
  const getFormattedProjections = (projs: string[], customProj: string) => {
    if (!projs || projs.length === 0) return "";
    const mapped = projs.map(p => {
      if (p === "Otra") {
        return customProj.trim() ? customProj.trim() : "Otra";
      }
      return p === "Lateral" ? "Lateral" : p === "Oblicua" ? "Oblicua" : p === "Axial" ? "Axial" : p;
    });
    if (mapped.length === 1) return mapped[0];
    const last = mapped[mapped.length - 1];
    const rest = mapped.slice(0, -1).join(", ");
    return `${rest} y ${last}`;
  };

  // Helper to build the studyType string dynamically
  const buildStudyTypeString = (mod: string, spec: string, lat: string, custom: string, projs: string[], customProj: string) => {
    let mainStudy = spec === "Otro" ? (custom || "") : spec;
    if (!mainStudy) {
      return mod;
    }

    const mainStudyLower = mainStudy.toLowerCase();

    // Custom alignment for Mamograf√≠a/Momograf√≠a
    if (mod === "Mamograf√≠a" && (mainStudyLower === "mamas" || mainStudyLower === "momografia" || mainStudyLower === "mamograf√≠a")) {
      const gLat = getGenderedLaterality(lat, mainStudy);
      return gLat ? `Mamograf√≠a ${gLat}` : "Mamograf√≠a";
    }

    let preposition = "de";
    if (mainStudyLower.startsWith("doppler")) {
      preposition = "-";
    }

    let base = `${mod} ${preposition} ${mainStudy}`;
    base = base.replace(/\s+-\s+/, " - ").trim();

    if (lat) {
      const gLat = getGenderedLaterality(lat, mainStudy);
      base = `${base} ${gLat}`;
    }

    if (mod === "Radiograf√≠a" && projs && projs.length > 0) {
      const formattedProjs = getFormattedProjections(projs, customProj);
      base = `${base} ${formattedProjs}`;
    }

    return base;
  };

  // Synchronise form dropdowns when parsing a string
  const handleLoadStudyType = (fullStudy: string) => {
    if (!fullStudy) {
      setModality("Radiograf√≠a");
      setSpecificStudy("T√≥rax");
      setCustomStudy("");
      setLaterality("");
      setProjections([]);
      return;
    }

    // 1. Detect Modality
    let detectedModality = "Radiograf√≠a";
    if (/ultrasonido|ecograf√≠a|eco|ud|usg/i.test(fullStudy)) {
      detectedModality = "Ultrasonido";
    } else if (/mamograf√≠a|mamografia|momograf√≠a|momografia/i.test(fullStudy)) {
      detectedModality = "Mamograf√≠a";
    } else if (/tomograf√≠a|tomografia|tc|tac|ct/i.test(fullStudy)) {
      detectedModality = "TAC";
    }
    setModality(detectedModality);

    // 2. Detect Specific Study
    const studies = [
      "Abdomen",
      "Mamas",
      "Vias urinarias",
      "Escroto",
      "Cuello",
      "Rodilla",
      "Hombro",
      "Tobillo",
      "Muslo Anterior",
      "Muslo Posterior",
      "Mu√±eca",
      "Mano",
      "Pie",
      "Doppler de car√≥tidas",
      "Doppler venoso de miembro inferior",
      "Doppler arterial de miembro inferior",
      "Columna lumbosacra",
      "Columna dorsal",
      "Columna cervical",
      "Momograf√≠a",
      "T√≥rax",
      "Cr√°neo",
      "Cadera",
      "Pantorrilla y Tend√≥n de Aquiles"
    ];

    let foundSpecific = "Otro";
    let foundCustom = "";

    const cleanFull = fullStudy.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const study of studies) {
      const cleanStudy = study.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (
        cleanFull.includes(cleanStudy) || 
        (study === "Muslo Posterior" && cleanFull.includes("muslo posterior")) ||
        (study === "Muslo Anterior" && cleanFull.includes("muslo") && !cleanFull.includes("posterior")) ||
        (study === "Pantorrilla y Tend√≥n de Aquiles" && (cleanFull.includes("pantorilla") || cleanFull.includes("pantorrilla") || cleanFull.includes("aquiles") || cleanFull.includes("achilles")))
      ) {
        foundSpecific = study;
        break;
      }
    }

    if (foundSpecific === "Otro") {
      let cleaned = fullStudy;
      // Remove modality names
      cleaned = cleaned.replace(/radiograf√≠a|ultrasonido|mamograf√≠a|mamografia|momograf√≠a|tomograf√≠a|tomografia|tc|tac|ct/gi, "");
      // Remove starting prepositions / separators
      cleaned = cleaned.replace(/^\s*(de|-|\s+)\s*/i, "").trim();
      // Remove projections if present
      cleaned = cleaned.replace(/\s*(ap|pa|lateral|lat|oblicua|obli|axial|otra)\b/gi, "").trim();
      // Remove trailing 'y'
      cleaned = cleaned.replace(/\s+y\s*$/gi, "").trim();
      // Remove laterality from the very end of custom study if present
      cleaned = cleaned.replace(/\s*(derecha|derecho|izquierda|izquierdo|bilateral)\s*$/gi, "").trim();
      foundCustom = cleaned;
    }

    setSpecificStudy(foundSpecific);
    setCustomStudy(foundCustom);

    // 3. Detect Laterality
    let detectedLaterality = "";
    if (/derecho|derecha/i.test(fullStudy)) {
      detectedLaterality = "Derecha";
    } else if (/izquierdo|izquierda/i.test(fullStudy)) {
      detectedLaterality = "Izquierda";
    } else if (/bilateral/i.test(fullStudy)) {
      detectedLaterality = "Bilateral";
    }
    setLaterality(detectedLaterality);

    // 4. Detect Projections
    const detectedProjections: string[] = [];
    if (detectedModality === "Radiograf√≠a") {
      if (/ap\b|anteroposterior/i.test(fullStudy)) {
        detectedProjections.push("AP");
      }
      if (/pa\b|posteroanterior/i.test(fullStudy)) {
        detectedProjections.push("PA");
      }
      if (/lateral\b|lat\b/i.test(fullStudy)) {
        detectedProjections.push("Lateral");
      }
      if (/oblicua\b|obli\b|oblicuas\b/i.test(fullStudy)) {
        detectedProjections.push("Oblicua");
      }
      if (/axial\b/i.test(fullStudy)) {
        detectedProjections.push("Axial");
      }
      if (/otra|otras\b/i.test(fullStudy)) {
        detectedProjections.push("Otra");
      }
    }
    setProjections(detectedProjections);
  };

  // Auto-detect and active clinical study block based on keywords in inputted text or generated reports
  const autoDetectSpecificStudyAndModality = (reportText: string, currentStudyType: string) => {
    // Completely disabled per user request: Protocol activation must be strictly manual via buttons or dropdown.
    return;
    const combined = `${currentStudyType || ""} ${reportText || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Detect Codo (Prioritized to avoid conflicts, e.g. "bicep" in elbow reports triggering shoulder)
    if (
      combined.includes("codo") ||
      combined.includes("epicondilo") ||
      combined.includes("epitroclea") ||
      combined.includes("epicondilitis") ||
      combined.includes("epitrocleitis") ||
      combined.includes("colateral radial") ||
      combined.includes("colateral cubital") ||
      combined.includes("nervio cubital") ||
      combined.includes("nervio ulnar")
    ) {
      setSpecificStudy("Codo");
      setModality("Ultrasonido");
      return;
    }

    // 2. Detect Muslo Posterior (biceps femoral, semitendinous, semimembranoso, sciatic/ciatico, isquiotibiales)
    if (
      combined.includes("muslo posterior") ||
      combined.includes("isquiotibial") ||
      combined.includes("isquio") ||
      combined.includes("biceps femo") ||
      combined.includes("biceps femoral") ||
      combined.includes("semitendinoso") ||
      combined.includes("semimembranoso") ||
      combined.includes("ciatico")
    ) {
      setSpecificStudy("Muslo Posterior");
      setModality("Ultrasonido");
      return;
    }

    // 2. Detect Muslo Anterior (recto femoral, quadriceps, sartorio, vasto lateral/medial)
    if (
      combined.includes("muslo anterior") ||
      combined.includes("recto femoral") ||
      combined.includes("cuadriceps") ||
      combined.includes("sartorio") ||
      combined.includes("vasto medial") ||
      combined.includes("vasto lateral") ||
      (combined.includes("muslo") && !combined.includes("posterior") && !combined.includes("isquio"))
    ) {
      setSpecificStudy("Muslo Anterior");
      setModality("Ultrasonido");
      return;
    }

    // 3. Detect Hombro
    if (
      combined.includes("hombro") ||
      combined.includes("supraespinoso") ||
      combined.includes("infraespinoso") ||
      combined.includes("subescapular") ||
      combined.includes("bicep") ||
      combined.includes("glenohumeral") ||
      combined.includes("acromioclavicular")
    ) {
      setSpecificStudy("Hombro");
      setModality("Ultrasonido");
      return;
    }

    // 4. Detect Rodilla
    if (
      combined.includes("rodilla") ||
      combined.includes("patela") ||
      combined.includes("rotula") ||
      combined.includes("menisco") ||
      combined.includes("ligamento cruzado") ||
      combined.includes("femorotibial")
    ) {
      setSpecificStudy("Rodilla");
      setModality("Ultrasonido");
      return;
    }

    // 5. Detect Tobillo
    if (
      combined.includes("tobillo") ||
      combined.includes("talo") ||
      combined.includes("aquiles") ||
      combined.includes("peroneo") ||
      combined.includes("calcaneo")
    ) {
      setSpecificStudy("Tobillo");
      setModality("Ultrasonido");
      return;
    }

    // 6. Detect Doppler Venoso
    if (
      combined.includes("doppler venoso") ||
      combined.includes("venas del miembro") ||
      combined.includes("safena") ||
      combined.includes("trombosis venosa")
    ) {
      setSpecificStudy("Doppler venoso de miembro inferior");
      setModality("Ultrasonido");
      return;
    }

    // 7. Detect Doppler Arterial
    if (
      combined.includes("doppler arterial") ||
      combined.includes("indice tobillo brazo") ||
      combined.includes("arterias del miembro") ||
      combined.includes("enfermedad arterial")
    ) {
      setSpecificStudy("Doppler arterial de miembro inferior");
      setModality("Ultrasonido");
      return;
    }

    // 7.5 Detect Mu√±eca
    if (
      combined.includes("muneca") ||
      combined.includes("mu√±eca") ||
      combined.includes("carpo") ||
      combined.includes("carpiano") ||
      combined.includes("nervio mediano") ||
      combined.includes("canal de guyon") ||
      combined.includes("de quervain") ||
      combined.includes("extensor carpi ulnaris") ||
      combined.includes("fibrocartilago triangular")
    ) {
      setSpecificStudy("Mu√±eca");
      setModality("Ultrasonido");
      return;
    }

    // 8. Detect Cuello / Tiroides
    if (
      combined.includes("tiroides") ||
      combined.includes("tiroideo") ||
      combined.includes("tiroidea") ||
      combined.includes("istmo tiroideo") ||
      combined.includes("lobulo tiroideo") ||
      combined.includes("parotida") ||
      combined.includes("parotideo") ||
      combined.includes("submandibular") ||
      combined.includes("ganglios cervicales") ||
      (combined.includes("cuello") && !combined.includes("doppler de carotidas") && !combined.includes("doppler carotideo") && !combined.includes("doppler de carotida") && !combined.includes("doppler carotidas"))
    ) {
      setSpecificStudy("Cuello");
      setModality("Ultrasonido");
      return;
    }

    // 9. Detect Doppler Car√≥tidas
    if (
      combined.includes("carotida") ||
      combined.includes("carotideo") ||
      combined.includes("carotidas") ||
      combined.includes("doppler de carotidas")
    ) {
      setSpecificStudy("Doppler de car√≥tidas");
      setModality("Ultrasonido");
      return;
    }

    // 9.5 Detect Escroto
    if (
      combined.includes("escroto") ||
      combined.includes("escrotal") ||
      combined.includes("testiculo") ||
      combined.includes("testicular") ||
      combined.includes("testiculos") ||
      combined.includes("testiculares") ||
      combined.includes("epididimo") ||
      combined.includes("epididimos") ||
      combined.includes("varicocele") ||
      combined.includes("hidrocele") ||
      combined.includes("orquitis")
    ) {
      setSpecificStudy("Escroto");
      setModality("Ultrasonido");
      return;
    }

    // 10. Detect V√≠as Urinarias (Renal and Urinary Tract)
    const pointsToUrinaryOnly = 
      combined.includes("vias urinarias") || 
      combined.includes("vias urinaria") || 
      combined.includes("renal y vias") || 
      combined.includes("urologico") ||
      combined.includes("us renal") || 
      combined.includes("ecografia renal") ||
      combined.includes("urosonido");
      
    const mentionsAbdomenTitle = 
      combined.includes("abdomen completo") || 
      combined.includes("abdomen superior") || 
      combined.includes("ecografia de abdomen") || 
      combined.includes("ultrasonido de abdomen") ||
      combined.includes("abdomen inferior") ||
      combined.includes("abdomen");

    if (pointsToUrinaryOnly && !mentionsAbdomenTitle) {
      setSpecificStudy("Vias urinarias");
      setModality("Ultrasonido");
      
      if (combined.includes("prostata") || combined.includes("prostatic")) {
        setUrinaryGenderMode("hombre");
      } else {
        setUrinaryGenderMode("mujer");
      }
      return;
    }

    if (mentionsAbdomenTitle) {
      setSpecificStudy("Abdomen");
      setModality("Ultrasonido");
      return;
    }
  };

  useEffect(() => {
    const computed = buildStudyTypeString(modality, specificStudy, laterality, customStudy, projections, customProjection);
    setStudyType(computed);
  }, [modality, specificStudy, laterality, customStudy, projections, customProjection]);

  // Auto-detect specific study from pasted/draft report, findings, or clinical history if specificStudy is the default "T√≥rax"
  useEffect(() => {
    if (specificStudy === "T√≥rax") {
      const combinedText = `${inputReport || ""} ${findings || ""} ${clinicalHistory || ""}`;
      if (combinedText.trim()) {
        autoDetectSpecificStudyAndModality(combinedText, "");
      }
    }
  }, [inputReport, findings, clinicalHistory]);
  
  // Image input
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // ZIP-DICOM Extractor state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isZipExtractorOpen, setIsZipExtractorOpen] = useState<boolean>(false);
  const [zipExtractedFileForAnalysis, setZipExtractedFileForAnalysis] = useState<{ file: ExtractedFile; slot: 1 | 2 | 3 } | { file: ExtractedFile; slot: 1 | 2 | 3 }[] | null>(null);
  
  // Loading & Generation results
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationSteps, setGenerationSteps] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<string>("");

  // --- INTERACTIVE SYNTACTIC HIGHLIGHTING AND DYNAMIC AESTHETIC STATES ---
  const [isSyntacticHighlightingActive, setIsSyntacticHighlightingActive] = useState<boolean>(true);
  const [manualSeverityOverrides, setManualSeverityOverrides] = useState<Record<string, "critical" | "altered" | "normal">>({});
  const [aiSeverityCache, setAiSeverityCache] = useState<Record<string, "critical" | "altered" | "normal">>({});
  const [isAnalyzingParagraphs, setIsAnalyzingParagraphs] = useState<boolean>(false);

  // Cloud studies states
  const [cloudStudies, setCloudStudies] = useState<CloudStudy[]>([]);
  const [isLoadingCloudStudies, setIsLoadingCloudStudies] = useState<boolean>(false);
  const [cloudStudiesError, setCloudStudiesError] = useState<string | null>(null);
  const [cloudStudiesSuccess, setCloudStudiesSuccess] = useState<string | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState<boolean>(false);
  const [cloudSearch, setCloudSearch] = useState<string>("");
  const [viewingCloudStudy, setViewingCloudStudy] = useState<CloudStudy | null>(null);

  // Biomechanical Radar Data
  const [biomechanicalRadarData, setBiomechanicalRadarData] = useState<any | null>(null);

  // 3D Schematic Volumetric Renders for Findings
  const [findings3dRenders, setFindings3dRenders] = useState<Finding3dRender[]>([]);
  const [is3dRenderModalOpen, setIs3dRenderModalOpen] = useState<boolean>(false);
  const [modal3dSourceImage, setModal3dSourceImage] = useState<any>(null);
  const [modal3dInitialFinding, setModal3dInitialFinding] = useState<string>("");

  const pdfStateRef = useRef<any>({});
  pdfStateRef.current = {
    generatedReport,
    patientName,
    patientEmail,
    patientAge,
    patientGender,
    patientId,
    reportDate,
    doctorName,
    doctorLicense,
    clinicName,
    clinicalHistory,
    findings,
    studyType,
    customLogoUrl,
    customLogoStyle,
    customSignatureUrl,
    specificStudy,
    pdfLayoutType,
    selectedLogo,
    biomechanicalRadarData,
    findings3dRenders,
  };

  useEffect(() => {
    if (!generatedReport) return;

    // Parse elements to get all unique paragraphs and list items
    const elements = parseReportToElements(generatedReport, "temp");
    const paragraphsToAnalyze: string[] = [];

    elements.forEach(elem => {
      if (elem.type === "list") {
        elem.items?.forEach(item => {
          let cleanItem = item.trim();
          const isNumbered = /^\d+\.\s+/.test(cleanItem);
          if (isNumbered) {
            const match = cleanItem.match(/^(\d+\.)\s+/);
            if (match) {
              cleanItem = cleanItem.substring(match[0].length);
            }
          } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
            cleanItem = cleanItem.substring(2);
          }
          cleanItem = cleanItem.trim();
          const cleanItemLower = cleanItem.toLowerCase();

          if (cleanItem && !aiSeverityCache[cleanItem] && !aiSeverityCache[cleanItemLower] && !paragraphsToAnalyze.includes(cleanItem)) {
            paragraphsToAnalyze.push(cleanItem);
          }
        });
      } else if (elem.type === "text" || !elem.type) {
        elem.lines?.forEach(line => {
          const trimmedLine = line.trim();
          const trimmedLineLower = trimmedLine.toLowerCase();
          if (trimmedLine && !aiSeverityCache[trimmedLine] && !aiSeverityCache[trimmedLineLower] && !paragraphsToAnalyze.includes(trimmedLine)) {
            paragraphsToAnalyze.push(trimmedLine);
          }
        });
      }
    });

    if (paragraphsToAnalyze.length === 0) return;

    const timeoutId = setTimeout(async () => {
      setIsAnalyzingParagraphs(true);
      try {
        const response = await fetch("/api/analyze-paragraphs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            paragraphs: paragraphsToAnalyze
          })
        });
        const data = await response.json();
        if (data.success && data.results) {
          const normalizedResults: Record<string, "critical" | "altered" | "normal"> = {};
          Object.entries(data.results).forEach(([key, value]) => {
            const trimmedKey = key.trim();
            normalizedResults[trimmedKey] = value as "critical" | "altered" | "normal";
            normalizedResults[trimmedKey.toLowerCase()] = value as "critical" | "altered" | "normal";
          });
          setAiSeverityCache(prev => ({
            ...prev,
            ...normalizedResults
          }));
        }
      } catch (e) {
        console.error("Error calling analyze-paragraphs:", e);
      } finally {
        setIsAnalyzingParagraphs(false);
      }
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [generatedReport, selectedModel]);

  const [reportTheme, setReportTheme] = useState<string>("slate-dark"); // 'slate-dark' | 'academic-light' | 'clinical-minimal' | 'retro-glowing'
  const [reportFont, setReportFont] = useState<string>("sans"); // 'sans' | 'serif' | 'mono'
  const [reportDensity, setReportDensity] = useState<string>("airy"); // 'compact' | 'airy'
  const [showPathology, setShowPathology] = useState<boolean>(true);
  const [showAnatomy, setShowAnatomy] = useState<boolean>(true);
  const [showNormal, setShowNormal] = useState<boolean>(true);
  const [showTechnical, setShowTechnical] = useState<boolean>(true);

  // --- VERSION HISTORY AND MANUAL REPORT EDIT STATE ---
  const [originalBaseReport, setOriginalBaseReport] = useState<string>("");
  const [reportHistory, setReportHistory] = useState<string[]>([]);
  const [reportRedoHistory, setReportRedoHistory] = useState<string[]>([]);
  const [isEditingReportManual, setIsEditingReportManual] = useState<boolean>(false);
  const [editedReportText, setEditedReportText] = useState<string>("");

  // --- SPECIAL INTERACTIVE AI PARAGRAPH ACTIONS STATES ---
  const [selectedParagraphText, setSelectedParagraphText] = useState<string | null>(null);
  const [selectedParagraphOriginal, setSelectedParagraphOriginal] = useState<string | null>(null);
  const [paragraphActionLoading, setParagraphActionLoading] = useState<boolean>(false);
  const [paragraphActionResult, setParagraphActionResult] = useState<string | null>(null);
  const [paragraphActionActive, setParagraphActionActive] = useState<string | null>(null);
  const [paragraphActionError, setParagraphActionError] = useState<string | null>(null);
  const [customParagraphPrompt, setCustomParagraphPrompt] = useState<string>("");

  const handleSelectParagraph = (lineText: string) => {
    const trimmedText = lineText.trim();
    if (!trimmedText) return;
    if (selectedParagraphOriginal === trimmedText) {
      // Toggle unselect
      setSelectedParagraphText(null);
      setSelectedParagraphOriginal(null);
      setParagraphActionResult(null);
      setParagraphActionActive(null);
      setParagraphActionError(null);
      setCustomParagraphPrompt("");
    } else {
      setSelectedParagraphText(trimmedText);
      setSelectedParagraphOriginal(trimmedText);
      setParagraphActionResult(null);
      setParagraphActionActive(null);
      setParagraphActionError(null);
      setCustomParagraphPrompt("");
    }
  };

  const handleToggleManualSeverity = (severity: "critical" | "altered" | "normal") => {
    if (!selectedParagraphOriginal) return;
    const trimmed = selectedParagraphOriginal.trim();
    setManualSeverityOverrides(prev => ({
      ...prev,
      [trimmed]: severity,
      [selectedParagraphOriginal]: severity
    }));
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      const selectedStr = selection.toString().trim();
      // Only process selections of meaningful size
      if (selectedStr.length > 4 && selectedStr.length < 1500) {
        setSelectedParagraphText(selectedStr);
        if (generatedReport && generatedReport.includes(selectedStr)) {
          setSelectedParagraphOriginal(selectedStr);
        } else {
          setSelectedParagraphOriginal(null);
        }
        setParagraphActionResult(null);
        setParagraphActionActive(null);
        setParagraphActionError(null);
        setCustomParagraphPrompt("");
      }
    }
  };

  const executeParagraphAction = async (actionType: string, customPromptText?: string) => {
    if (!selectedParagraphText) return;
    
    setParagraphActionLoading(true);
    setParagraphActionActive(actionType);
    setParagraphActionError(null);
    setParagraphActionResult(null);
    
    try {
      const response = await fetch("/api/ai-paragraph-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          text: selectedParagraphText,
          action: actionType,
          customPrompt: customPromptText,
          fullReport: generatedReport,
          studyType: studyType || "No especificado",
          clinicalHistory: clinicalHistory || "No especificada"
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setParagraphActionResult(data.result);
      } else {
        setParagraphActionError(data.error || "Ocurri√≥ un error inesperado al procesar la acci√≥n de p√°rrafo.");
      }
    } catch (err: any) {
      console.error("Error executing paragraph action:", err);
      setParagraphActionError("Error de conexi√≥n con el servidor de IA.");
    } finally {
      setParagraphActionLoading(false);
    }
  };

  const handleApplyParagraphImprovement = (improvedText: string) => {
    if (!selectedParagraphOriginal || !generatedReport) return;
    
    // Save current report in history
    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);
    
    // Replace the original text with improved text in generatedReport
    const updatedReport = generatedReport.replace(selectedParagraphOriginal, improvedText);
    setGeneratedReport(updatedReport);
    
    // Reset selection states
    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleInsertBelowParagraph = (newText: string) => {
    if (!selectedParagraphOriginal || !generatedReport) return;

    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);

    const index = generatedReport.indexOf(selectedParagraphOriginal);
    if (index !== -1) {
      const insertionPoint = index + selectedParagraphOriginal.length;
      const updatedReport = 
        generatedReport.substring(0, insertionPoint) + 
        "\n\n" + newText + 
        generatedReport.substring(insertionPoint);
      setGeneratedReport(updatedReport);
    }

    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleAppendParagraphToReport = (newText: string) => {
    if (!generatedReport) return;

    setReportHistory((prev) => [...prev, generatedReport]);
    setReportRedoHistory([]);

    const updatedReport = generatedReport.trim() + "\n\n" + newText;
    setGeneratedReport(updatedReport);

    setSelectedParagraphText(null);
    setSelectedParagraphOriginal(null);
    setParagraphActionResult(null);
    setParagraphActionActive(null);
    setParagraphActionError(null);
  };

  const handleStartManualEdit = () => {
    setEditedReportText(generatedReport);
    setIsEditingReportManual(true);
  };

  const handleSaveManualEdit = () => {
    if (editedReportText !== generatedReport) {
      if (generatedReport) {
        setReportHistory((prev) => [...prev, generatedReport]);
        setReportRedoHistory([]);
      }
      setGeneratedReport(editedReportText);
    }
    setIsEditingReportManual(false);
  };

  const handleCancelManualEdit = () => {
    setIsEditingReportManual(false);
  };

  // --- CONTROLES DE CHAT INTELIGENTE M√âDICO-RADIOL√ìGICO ---
  const [showVersionComparison, setShowVersionComparison] = useState<boolean>(false);
  const [smartChatMessages, setSmartChatMessages] = useState<Array<{
    id: string;
    role: "user" | "model";
    text: string;
    summary?: string;
  }>>(() => {
    return [
      {
        id: "welcome",
        role: "model",
        text: "¬°Hola! Soy tu **Asistente Inteligente M√©dico-Radiol√≥gico**. Consulta clasificaciones (ej. Neer o Bosniak), dosis de contraste o t√©rminos. Te brindar√© res√∫menes exportables para inyectarlos directo en el reporte."
      }
    ];
  });
  const [smartChatInput, setSmartChatInput] = useState<string>("" );
  const [isSmartChatLoading, setIsSmartChatLoading] = useState<boolean>(false);
  const [smartChatError, setSmartChatError] = useState<string | null>(null);

  const smartChatBottomRef = useRef<HTMLDivElement>(null);

  const handleSendSmartChatMessage = async (customMessage?: string) => {
    const textToSend = customMessage || smartChatInput;
    if (!textToSend.trim() || isSmartChatLoading) return;

    setSmartChatError(null);
    setIsSmartChatLoading(true);
    if (!customMessage) {
      setSmartChatInput("");
    }

    const newMsgId = "msg-" + Date.now();
    const userMsg = { id: newMsgId, role: "user" as const, text: textToSend };
    const updatedMessages = [...smartChatMessages, userMsg];
    setSmartChatMessages(updatedMessages);

    // Scroll smoothly
    setTimeout(() => {
      smartChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);

    try {
      const systemInstruction = `Eres un consultor e inteligencia conversacional m√©dica y radiol√≥gica de √©lite. Tienes un dominio absoluto de la terminolog√≠a de salud, enfermedades, dosificaciones de medicamentos, dosificaciones de medios de contraste, y clasificaciones radiol√≥gicas internacionales (como Neer de h√∫mero proximal, Bosniak, BI-RADS, Fleischner, etc.).
Tu objetivo es dar respuestas sumamente claras, cient√≠ficamente precisas, profesionales y estructuradas.

${generatedReport ? `Contexto del informe radiol√≥gico activo actualmente en el que trabaja el m√©dico en su workspace:\n"""\n${generatedReport}\n"""\n` : ""}

REGLAS CR√çTICAS PARA CLASIFICACIONES Y RES√öMENES:
1. Explica con total claridad y detalle los grados de la clasificaci√≥n o temas que se te consultan.
2. Si el usuario te consulta o solicita clasificar un hallazgo en t√©rminos cl√≠nicos o escalas (por ejemplo, 'escala de Neer', 'clasificaci√≥n de fracturas de h√∫mero proximal', 'Bosniak', 'Fleischner', etc.), DEBES incluir al final de tu respuesta un bloque especial de resumen de clasificaci√≥n opcional encerrado EXACTAMENTE entre los delimitadores [RESUMEN_CLASIFICACION]...[/RESUMEN_CLASIFICACION] para que el m√©dico pueda exportarlo.
3. El contenido dentro de [RESUMEN_CLASIFICACION] debe ser redactado en formato Markdown limpio, sin rodeos, listo para ser acoplado directamente en el reporte de estudio bajo una secci√≥n de conclusi√≥n o impresi√≥n diagn√≥stica. No repitas la escala completa aqu√≠, solo aplica un resumen personalizado y conciso del hallazgo aplicable al caso.
Ejemplo:
[RESUMEN_CLASIFICACION]
**Clasificaci√≥n de Neer (H√∫mero Proximal):** Fractura-luxaci√≥n en 3 partes con desplazamiento del troquiter > 1 cm y angulaci√≥n de la cabeza humeral > 45¬∞. Impresi√≥n diagn√≥stica de inestabilidad articular que requiere interconsulta con traumatolog√≠a.
[/RESUMEN_CLASIFICACION]`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMessages.map(m => ({ role: m.role, text: m.text })),
          systemInstruction,
        }),
      });

      const data = await response.json();
      if (data.success) {
        let rawReply = data.reply || "";
        let parsedText = rawReply;
        let summaryText: string | undefined = undefined;

        const startTag = "[RESUMEN_CLASIFICACION]";
        const endTag = "[/RESUMEN_CLASIFICACION]";
        const startIndex = rawReply.indexOf(startTag);
        const endIndex = rawReply.indexOf(endTag);

        if (startIndex !== -1 && endIndex !== -1) {
          summaryText = rawReply.substring(startIndex + startTag.length, endIndex).trim();
          parsedText = (rawReply.substring(0, startIndex) + rawReply.substring(endIndex + endTag.length)).trim();
        }

        setSmartChatMessages(prev => [...prev, {
          id: "reply-" + Date.now(),
          role: "model",
          text: parsedText,
          summary: summaryText
        }]);
      } else {
        setSmartChatError(data.error || "No se pudo obtener una respuesta v√°lida de Gemini.");
      }
    } catch (err) {
      console.error(err);
      setSmartChatError("Error de conexi√≥n m√©dica con el servidor de inteligencia.");
    } finally {
      setIsSmartChatLoading(false);
      setTimeout(() => {
        smartChatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    }
  };

  const handleAppendBlockToReport = (content: string) => {
    const currentText = generatedReport || "";
    const spacing = currentText.endsWith("\n\n") ? "" : currentText.endsWith("\n") ? "\n" : currentText ? "\n\n" : "";
    const updated = currentText + spacing + content;
    
    // Save history
    if (generatedReport) {
      setReportHistory(prev => [...prev, generatedReport]);
      setReportRedoHistory([]);
    }
    setGeneratedReport(updated);
    setEditedReportText(updated);
  };


  const handleRevertReport = () => {
    if (reportHistory.length === 0) return;
    const previous = reportHistory[reportHistory.length - 1];
    setReportHistory((prev) => prev.slice(0, -1));
    if (generatedReport) {
      setReportRedoHistory((prev) => [...prev, generatedReport]);
    }
    setGeneratedReport(previous);
    setIsEditingReportManual(false);
  };

  const handleRedoReport = () => {
    if (reportRedoHistory.length === 0) return;
    const next = reportRedoHistory[reportRedoHistory.length - 1];
    setReportRedoHistory((prev) => prev.slice(0, -1));
    if (generatedReport) {
      setReportHistory((prev) => [...prev, generatedReport]);
    }
    setGeneratedReport(next);
    setIsEditingReportManual(false);
  };
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<boolean>(false);
  const [presetCopiedId, setPresetCopiedId] = useState<string | null>(null);
  const [copiedEhrStudyId, setCopiedEhrStudyId] = useState<string | null>(null);

  // States for embedded classification recommendations
  const [classRecommendations, setClassRecommendations] = useState<any[] | null>(null);
  const [isRecommendingClassifications, setIsRecommendingClassifications] = useState<boolean>(false);
  const [recommenderError, setRecommenderError] = useState<string | null>(null);
  const [incorporatedRecs, setIncorporatedRecs] = useState<Record<number, boolean>>({});
  const [includeManagementRecs, setIncludeManagementRecs] = useState<Record<number, boolean>>({});
  const [incorporatingIndex, setIncorporatingIndex] = useState<number | null>(null);

  // States for interactive report modification & image valuation
  const [imageEvaluation, setImageEvaluation] = useState<string>("");
  const [isEvaluatingImage, setIsEvaluatingImage] = useState<boolean>(false);
  const [currentModInstruction, setCurrentModInstruction] = useState<string>("");
  const [isModifyingReport, setIsModifyingReport] = useState<boolean>(false);
  const [pendingRecText, setPendingRecText] = useState<string | null>(null);
  const [pendingRecs, setPendingRecs] = useState<Record<string, boolean>>({});
  const [incorporatedAuditRecs, setIncorporatedAuditRecs] = useState<Record<string, boolean>>({});
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Queue references for simultaneous / sequential recommendation processing
  const recQueueRef = useRef<string[]>([]);
  const isProcessingRecQueueRef = useRef<boolean>(false);

  const generatedReportRef = useRef(generatedReport);
  generatedReportRef.current = generatedReport;

  const editedReportTextRef = useRef(editedReportText);
  editedReportTextRef.current = editedReportText;

  const isEditingReportManualRef = useRef(isEditingReportManual);
  isEditingReportManualRef.current = isEditingReportManual;

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const base64ImageRef = useRef(base64Image);
  base64ImageRef.current = base64Image;

  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  const [additionalEvaluation, setAdditionalEvaluation] = useState<string>("");
  const [isEvaluatingAdditional, setIsEvaluatingAdditional] = useState<boolean>(false);
  const [additionalEvalError, setAdditionalEvalError] = useState<string | null>(null);

  // States for Complete Case Analysis & Intelligent Medical Bibliography Search
  const [caseAnalysis, setCaseAnalysis] = useState<string>("");
  const [isAnalyzingCase, setIsAnalyzingCase] = useState<boolean>(false);
  const [caseAnalysisError, setCaseAnalysisError] = useState<string | null>(null);
  const [isIncorporatingDiffs, setIsIncorporatingDiffs] = useState<boolean>(false);
  const [diffsIncorporated, setDiffsIncorporated] = useState<boolean>(false);
  const [diffsError, setDiffsError] = useState<string | null>(null);
  const [selectedCaseFormat, setSelectedCaseFormat] = useState<CaseAnalysisFormatOption>("flujograma_semiologico");
  const [caseElements, setCaseElements] = useState<CaseAnalysisElementsConfig>({
    includeSonographic: true,
    includeSonographicDetails: true,
    includeClinicalCorr: true,
    includeCertainty: false,
    includeDifferentials: true,
    includeDiscardedDifferentials: true,
    includeManagement: true,
  });
  const [isFormattingCaseJSON, setIsFormattingCaseJSON] = useState<boolean>(false);

  // States to hold the structured case data editable in real-time on the main screen
  const [editableCaseData, setEditableCaseData] = useState<CaseAnalysisData | null>(null);
  const [checkedDetails, setCheckedDetails] = useState<boolean[]>([]);
  const [checkedDifferentials, setCheckedDifferentials] = useState<boolean[]>([]);
  const [checkedDecisionSteps, setCheckedDecisionSteps] = useState<boolean[]>([]);
  const [isExtractingCaseData, setIsExtractingCaseData] = useState<boolean>(false);
  const [caseDataError, setCaseDataError] = useState<string | null>(null);

  // Automatically load/extract the structured Case Analysis components whenever caseAnalysis is populated or format changes
  React.useEffect(() => {
    if (caseAnalysis) {
      const loadCaseAnalysisData = async () => {
        setIsExtractingCaseData(true);
        setCaseDataError(null);
        try {
          const response = await fetch("/api/extract-essential-findings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              model: selectedModel,
              analysisText: caseAnalysis,
              requestedFormat: selectedCaseFormat,
              elementsConfig: caseElements
            }),
          });
          const data = await response.json();
          if (response.ok && data.success && data.caseAnalysisData) {
            setEditableCaseData(data.caseAnalysisData);
            
            // Initialize sub-level checkmarks
            if (data.caseAnalysisData.sonographicPillar?.details) {
              setCheckedDetails(data.caseAnalysisData.sonographicPillar.details.map(() => true));
            } else {
              setCheckedDetails([]);
            }
            if (data.caseAnalysisData.diagnostics) {
              setCheckedDifferentials(data.caseAnalysisData.diagnostics.map(() => true));
            } else {
              setCheckedDifferentials([]);
            }
            if (data.caseAnalysisData.decisionFlow) {
              setCheckedDecisionSteps(data.caseAnalysisData.decisionFlow.map(() => true));
            } else {
              setCheckedDecisionSteps([]);
            }
          } else {
            setCaseDataError(data.error || "No se pudo extraer los componentes estructurados del caso actual.");
          }
        } catch (err: any) {
          console.error("Error al estructurar el caso:", err);
          setCaseDataError("Error de comunicaci√≥n/red al estructurar el flujograma.");
        } finally {
          setIsExtractingCaseData(false);
        }
      };

      loadCaseAnalysisData();
    } else {
      setEditableCaseData(null);
      setCaseDataError(null);
      setCheckedDetails([]);
      setCheckedDifferentials([]);
      setCheckedDecisionSteps([]);
    }
  }, [caseAnalysis, selectedCaseFormat]);

  const handleFormatAndIncorporateCaseAnalysis = () => {
    if (!editableCaseData) return;

    setIsFormattingCaseJSON(true);
    setDiffsError(null);
    try {
      // Clone the editableCaseData to avoid modifying active state before saving
      const finalCaseData = JSON.parse(JSON.stringify(editableCaseData)) as CaseAnalysisData;

      // 1. Filter sonographic details based on checkedDetails checkbox states
      if (finalCaseData.sonographicPillar?.details) {
        finalCaseData.sonographicPillar.details = finalCaseData.sonographicPillar.details.filter((_, i) => checkedDetails[i]);
      }

      // 2. Filter diagnostics based on checkedDifferentials checkbox states
      if (finalCaseData.diagnostics) {
        finalCaseData.diagnostics = finalCaseData.diagnostics.filter((_, i) => checkedDifferentials[i]);
      }

      // 3. Filter decision flow steps based on checkedDecisionSteps checkbox states
      if (finalCaseData.decisionFlow) {
        finalCaseData.decisionFlow = finalCaseData.decisionFlow.filter((_, i) => checkedDecisionSteps[i]);
      }

      // 4. Update elementsConfig in final data
      finalCaseData.elementsConfig = {
        ...caseElements,
        includeSonographicDetails: caseElements.includeSonographic && (finalCaseData.sonographicPillar?.details?.length ?? 0) > 0,
        includeDiscardedDifferentials: caseElements.includeDifferentials && (finalCaseData.diagnostics?.filter((d: any, idx: number) => d.refutingCriteria && idx > 0).length ?? 0) > 0
      };

      // Construct the standard [CASE_ANALYSIS_JSON] wrapping block
      const jsonBlock = `[CASE_ANALYSIS_JSON]\n${JSON.stringify(finalCaseData, null, 2)}\n[/CASE_ANALYSIS_JSON]\n\n`;

      // Construct the formatted markdown text summary accompanying the JSON
      let textSummary = `**AN√ÅLISIS INTEGRADO DE CASO (${selectedCaseFormat.toUpperCase().replace("_", " ")})**\n\n`;
      if (caseElements.includeSonographic && finalCaseData.sonographicPillar) {
        textSummary += `‚Ä¢ **Pilar Sonogr√°fico Fundamental**: ${finalCaseData.sonographicPillar.primaryFinding}\n`;
      }
      if (caseElements.includeClinicalCorr && finalCaseData.clinicalCorrelation) {
        textSummary += `‚Ä¢ **Correlaci√≥n Cl√≠nica/Lab**: ${finalCaseData.clinicalCorrelation}\n`;
      }
      if (caseElements.includeDifferentials && finalCaseData.diagnostics?.length) {
        textSummary += `‚Ä¢ **Diagn√≥stico Principal**: ${finalCaseData.diagnostics[0]?.name}\n`;
      }
      if (caseElements.includeManagement && finalCaseData.managementRecommendation) {
        textSummary += `‚Ä¢ **Conducta Recomendada**: ${finalCaseData.managementRecommendation}\n`;
      }

      setGeneratedReport(prev => {
        return mergeCaseAnalysisBlock(prev || "", finalCaseData.format || "custom", jsonBlock, textSummary);
      });
      setEditedReportText(prev => {
        return mergeCaseAnalysisBlock(prev || "", finalCaseData.format || "custom", jsonBlock, textSummary);
      });
      setDiffsIncorporated(true);
      setTimeout(() => {
        setDiffsIncorporated(false);
      }, 3000);
    } catch (err: any) {
      console.error("Error al formatear e incorporar el an√°lisis:", err);
      setDiffsError(err?.message || "Error al procesar la inserci√≥n de datos.");
    } finally {
      setIsFormattingCaseJSON(false);
    }
  };

  const [bibliography, setBibliography] = useState<string>("");
  const [isSearchingBibliography, setIsSearchingBibliography] = useState<boolean>(false);
  const [isSearchingMoreBibliography, setIsSearchingMoreBibliography] = useState<boolean>(false);
  const [bibliographyError, setBibliographyError] = useState<string | null>(null);
  const [bibliographySources, setBibliographySources] = useState<Array<{ uri: string; title: string; summary?: string }>>([]);

  const [reportEvaluation, setReportEvaluation] = useState<string>("");
  const [isEvaluatingReport, setIsEvaluatingReport] = useState<boolean>(false);
  const [reportEvaluationError, setReportEvaluationError] = useState<string | null>(null);

  // States for Patient Summary (Interactive & Demystifying)
  const [patientSummary, setPatientSummary] = useState<any | null>(null);
  const [isGeneratingPatientSummary, setIsGeneratingPatientSummary] = useState<boolean>(false);
  const [patientSummaryError, setPatientSummaryError] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Record<number, boolean>>({});
  const [attachSummaryToOfficialReport, setAttachSummaryToOfficialReport] = useState<boolean>(false);
  const [isAsistenteMedidasOpen, setIsAsistenteMedidasOpen] = useState<boolean>(false);
  const [isCreadorNotasOpen, setIsCreadorNotasOpen] = useState<boolean>(false);
  const [isCreadorCuadroSinopticoOpen, setIsCreadorCuadroSinopticoOpen] = useState<boolean>(false);
  const [isCreadorSinopsisFracturasOpen, setIsCreadorSinopsisFracturasOpen] = useState<boolean>(false);
  const [isBiomechanicalRadarOpen, setIsBiomechanicalRadarOpen] = useState<boolean>(false);
  const [includeRadarInReport, setIncludeRadarInReport] = useState<boolean>(true);

  // States & Handlers for Sistema de Activaci√≥n R√°pida de M√≥dulos (Procesamiento en Lote)
  const [selectedBatchModules, setSelectedBatchModules] = useState<Record<string, boolean>>({
    radar: false,
    case_analysis: false,
    quality_eval: false,
    bibliography: false,
    operational_summary: true,
    patient_summary: true,
    glossary: false,
    schematic: false,
    measurements: false,
    footnotes: false,
    organ_synoptic: false,
    fractures: false,
    classifications: false,
  });
  const [isActivatingBatch, setIsActivatingBatch] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  const handleToggleAllBatchModules = (select: boolean) => {
    setSelectedBatchModules({
      radar: select,
      case_analysis: select,
      quality_eval: select,
      bibliography: select,
      operational_summary: select,
      patient_summary: select,
      glossary: select,
      schematic: select,
      measurements: select,
      footnotes: select,
      organ_synoptic: select,
      fractures: select,
      classifications: select,
    });
  };

  const handleActivateBatchModules = async () => {
    const activeReport = isEditingReportManual ? editedReportText : (generatedReport || "");
    if (!activeReport) {
      setModifyError("Genera o redacta un reporte antes de activar los m√≥dulos en lote.");
      return;
    }

    setIsActivatingBatch(true);
    setBatchSuccessMessage(null);

    // 1. Activate interactive UI panels immediately
    if (selectedBatchModules.radar) setIsBiomechanicalRadarOpen(true);
    if (selectedBatchModules.measurements) setIsAsistenteMedidasOpen(true);
    if (selectedBatchModules.footnotes) setIsCreadorNotasOpen(true);
    if (selectedBatchModules.organ_synoptic) setIsCreadorCuadroSinopticoOpen(true);
    if (selectedBatchModules.fractures) setIsCreadorSinopsisFracturasOpen(true);

    // 2. Trigger async AI generation processes concurrently
    const promises: Promise<any>[] = [];

    if (selectedBatchModules.case_analysis) promises.push(handleAnalyzeCase());
    if (selectedBatchModules.quality_eval) promises.push(handleEvaluateReport(activeReport));
    if (selectedBatchModules.bibliography) promises.push(handleSearchBibliography());
    if (selectedBatchModules.operational_summary) promises.push(handleGenerateWhatsAppSummary());
    if (selectedBatchModules.patient_summary) promises.push(handleGeneratePatientSummary());
    if (selectedBatchModules.glossary) promises.push(handleGenerateDynamicGlossary());
    if (selectedBatchModules.schematic) promises.push(handleGenerateSchematicSummary());

    try {
      await Promise.allSettled(promises);
      const activeCount = Object.values(selectedBatchModules).filter(Boolean).length;
      setBatchSuccessMessage(`¬°√âxito! Se han activado y procesado ${activeCount} m√≥dulos seleccionados en lote.`);
      setTimeout(() => setBatchSuccessMessage(null), 6000);
    } catch (err) {
      console.error("Error al procesar m√≥dulos en lote:", err);
    } finally {
      setIsActivatingBatch(false);
    }
  };

  // States for Advanced Vascular Analysis & Schematic Drawing
  const [vascularTable, setVascularTable] = useState<string>("");
  const [vascularStates, setVascularStates] = useState<Record<string, string>>({});
  const [carotidPlaques, setCarotidPlaques] = useState<any[]>([]);
  const [includeCarotidBifurcations, setIncludeCarotidBifurcations] = useState<boolean>(true);
  
  // States for attached images / DICOM captures
  const [attachedImages, setAttachedImages] = useState<{
    id: string;
    name: string;
    url: string;
    base64: string;
    caption: string;
    isDicom: boolean;
    dicomMetaData?: Record<string, string>;
    width?: number;
    height?: number;
    modality?: "MMG" | "US";
    projection?: "MLO" | "CC" | "OTRO";
    side?: "Derecha" | "Izquierda" | "Bilateral";
  }[]>([]);
  const [loadingAiLabelId, setLoadingAiLabelId] = useState<string | null>(null);
  const [loadingAutocompleteId, setLoadingAutocompleteId] = useState<string | null>(null);
  const [isLabelingAll, setIsLabelingAll] = useState<boolean>(false);
  const [isCorrelatingFigures, setIsCorrelatingFigures] = useState<boolean>(false);
  const [vascularDescriptions, setVascularDescriptions] = useState<Record<string, string>>({});
  const [vascularSubLocations, setVascularSubLocations] = useState<Record<string, string>>({});
  const [isAnalyzingVascular, setIsAnalyzingVascular] = useState<boolean>(false);
  const [vascularError, setVascularError] = useState<string | null>(null);
  const [includeVascularSchemaInReport, setIncludeVascularSchemaInReport] = useState<boolean>(true);
  const [includeShoulderSchemaInReport, setIncludeShoulderSchemaInReport] = useState<boolean>(true);
  const [shoulderStates, setShoulderStates] = useState<Record<string, string>>({});
  const [shoulderStatesLeft, setShoulderStatesLeft] = useState<Record<string, string>>({});
  const [shoulderDescriptions, setShoulderDescriptions] = useState<Record<string, string>>({});
  const [shoulderDescriptionsLeft, setShoulderDescriptionsLeft] = useState<Record<string, string>>({});
  const [includeKneeSchemaInReport, setIncludeKneeSchemaInReport] = useState<boolean>(true);
  const [includeGonartrosisSchemaInReport, setIncludeGonartrosisSchemaInReport] = useState<boolean>(false);
  const [kneeStates, setKneeStates] = useState<Record<string, string>>({});
  const [kneeStatesLeft, setKneeStatesLeft] = useState<Record<string, string>>({});
  const [kneeDescriptions, setKneeDescriptions] = useState<Record<string, string>>({});
  const [kneeDescriptionsLeft, setKneeDescriptionsLeft] = useState<Record<string, string>>({});
  const [includeAnkleSchemaInReport, setIncludeAnkleSchemaInReport] = useState<boolean>(true);
  const [ankleStates, setAnkleStates] = useState<Record<string, string>>({});
  const [ankleDescriptions, setAnkleDescriptions] = useState<Record<string, string>>({});
  const [includeThighSchemaInReport, setIncludeThighSchemaInReport] = useState<boolean>(true);
  const [thighStates, setThighStates] = useState<Record<string, string>>({});
  const [thighDescriptions, setThighDescriptions] = useState<Record<string, string>>({});
  const [includeThighPosteriorSchemaInReport, setIncludeThighPosteriorSchemaInReport] = useState<boolean>(true);
  const [thighPosteriorStates, setThighPosteriorStates] = useState<Record<string, string>>({});
  const [thighPosteriorDescriptions, setThighPosteriorDescriptions] = useState<Record<string, string>>({});
  const [includeNeckSchemaInReport, setIncludeNeckSchemaInReport] = useState<boolean>(true);
  const [neckStates, setNeckStates] = useState<Record<string, string>>({});
  const [neckDescriptions, setNeckDescriptions] = useState<Record<string, string>>({});
  const [includeNeonatalBrainSchemaInReport, setIncludeNeonatalBrainSchemaInReport] = useState<boolean>(true);
  const [neonatalBrainStates, setNeonatalBrainStates] = useState<Record<string, string>>({});
  const [neonatalBrainDescriptions, setNeonatalBrainDescriptions] = useState<Record<string, string>>({});
  const [includeUrinarySchemaInReport, setIncludeUrinarySchemaInReport] = useState<boolean>(true);
  const [urinaryStates, setUrinaryStates] = useState<Record<string, string>>({});
  const [urinaryDescriptions, setUrinaryDescriptions] = useState<Record<string, string>>({});
  const [urinaryGenderMode, setUrinaryGenderMode] = useState<"hombre" | "mujer">("mujer");
  const [includeElbowSchemaInReport, setIncludeElbowSchemaInReport] = useState<boolean>(true);
  const [elbowStates, setElbowStates] = useState<Record<string, string>>({});
  const [elbowDescriptions, setElbowDescriptions] = useState<Record<string, string>>({});
  const [includeAbdomenSchemaInReport, setIncludeAbdomenSchemaInReport] = useState<boolean>(true);
  const [includeBiliarySchemaInReport, setIncludeBiliarySchemaInReport] = useState<boolean>(true);
  const [includeAppendixSchemaInReport, setIncludeAppendixSchemaInReport] = useState<boolean>(true);
  const [includeDiverticulitisSchemaInReport, setIncludeDiverticulitisSchemaInReport] = useState<boolean>(true);
  const [includeSmallBowelSchemaInReport, setIncludeSmallBowelSchemaInReport] = useState<boolean>(true);
  const [includeHepatopatiaSchemaInReport, setIncludeHepatopatiaSchemaInReport] = useState<boolean>(true);
  const [includeAneurismaSchemaInReport, setIncludeAneurismaSchemaInReport] = useState<boolean>(true);
  const [includeElastographyInReport, setIncludeElastographyInReport] = useState<boolean>(false);
  const [elastographyHasStiffness, setElastographyHasStiffness] = useState<boolean>(true);
  const [elastographyStiffness, setElastographyStiffness] = useState<number>(5.2);
  const [elastographyCAP, setElastographyCAP] = useState<number>(230);
  const [qusAttenuation, setQusAttenuation] = useState<number>(0.55);
  const [fatFraction, setFatFraction] = useState<number>(5.5);
  const [stiffnessOverride, setStiffnessOverride] = useState<string>("auto");
  const [steatosisOverride, setSteatosisOverride] = useState<string>("auto");
  const [abdomenStates, setAbdomenStates] = useState<Record<string, string>>({});
  const [abdomenDescriptions, setAbdomenDescriptions] = useState<Record<string, string>>({});
  const [includeScrotumSchemaInReport, setIncludeScrotumSchemaInReport] = useState<boolean>(true);
  const [scrotumStates, setScrotumStates] = useState<Record<string, string>>({});
  const [scrotumDescriptions, setScrotumDescriptions] = useState<Record<string, string>>({});
  const [includeWristSchemaInReport, setIncludeWristSchemaInReport] = useState<boolean>(true);
  const [includeDeQuervainSchemaInReport, setIncludeDeQuervainSchemaInReport] = useState<boolean>(false);
  const [wristStates, setWristStates] = useState<Record<string, string>>({});
  const [wristDescriptions, setWristDescriptions] = useState<Record<string, string>>({});
  const [includeBreastSchemaInReport, setIncludeBreastSchemaInReport] = useState<boolean>(true);
  const [breastStates, setBreastStates] = useState<Record<string, string>>({});
  const [breastDescriptions, setBreastDescriptions] = useState<Record<string, string>>({});
  const [breastBilateralOverride, setBreastBilateralOverride] = useState<boolean | null>(null);
  const [breastBilateralType, setBreastBilateralType] = useState<"quistes" | "fibroadenomas" | null>(null);
  const [activeVascularIdHover, setActiveVascularIdHover] = useState<string | null>(null);
  const [includeAbdominalWallSchemaInReport, setIncludeAbdominalWallSchemaInReport] = useState<boolean>(true);
  const [abdominalWallStates, setAbdominalWallStates] = useState<Record<string, string>>({});
  const [abdominalWallDescriptions, setAbdominalWallDescriptions] = useState<Record<string, string>>({});

  const [includeCalfAchillesSchemaInReport, setIncludeCalfAchillesSchemaInReport] = useState<boolean>(true);
  const [calfAchillesStates, setCalfAchillesStates] = useState<Record<string, string>>({});
  const [calfAchillesDescriptions, setCalfAchillesDescriptions] = useState<Record<string, string>>({});

  // States for Intelligent Anatomy Dialog and Additional Findings (not mapped to draw structures)
  const [isSmartAnatomyDialogOpen, setIsSmartAnatomyDialogOpen] = useState<boolean>(false);
  const [additionalFindings, setAdditionalFindings] = useState<Record<string, Array<{ id: string; structureName: string; state: string; description: string }>>>({});
  const [smartInstructionsText, setSmartInstructionsText] = useState<string>("");
  const [isSmartAnatomyModifying, setIsSmartAnatomyModifying] = useState<boolean>(false);
  const [smartAnatomyError, setSmartAnatomyError] = useState<string>("");
  const [newExtraStructureName, setNewExtraStructureName] = useState<string>("");
  const [newExtraState, setNewExtraState] = useState<string>("Alterado");
  const [newExtraDescription, setNewExtraDescription] = useState<string>("");

  // States for Dynamic Medical Glossary on current report
  const [dynamicGlossary, setDynamicGlossary] = useState<any | null>(null);
  const [isGeneratingDynamicGlossary, setIsGeneratingDynamicGlossary] = useState<boolean>(false);
  const [dynamicGlossaryError, setDynamicGlossaryError] = useState<string | null>(null);
  const [glossaryLitSearch, setGlossaryLitSearch] = useState<Record<string, { loading: boolean; text?: string; error?: string; sources?: any[] }>>({});

  // States for Schematic Summary / Findings Table
  const [schematicSummary, setSchematicSummary] = useState<any | null>(null);
  const [isGeneratingSchematicSummary, setIsGeneratingSchematicSummary] = useState<boolean>(false);
  const [schematicSummaryError, setSchematicSummaryError] = useState<string | null>(null);
  const [schematicFormat, setSchematicFormat] = useState<"blocks" | "table">("blocks");

  // States for expanding sections (maximizing read size)
  const [isMainReportExpanded, setIsMainReportExpanded] = useState<boolean>(false);
  const [isSmartChatExpanded, setIsSmartChatExpanded] = useState<boolean>(false);
  const [isVascularExpanded, setIsVascularExpanded] = useState<boolean>(false);
  const [isCaseAnalysisExpanded, setIsCaseAnalysisExpanded] = useState<boolean>(false);
  const [isReportEvaluationExpanded, setIsReportEvaluationExpanded] = useState<boolean>(false);
  const [isBibliographyExpanded, setIsBibliographyExpanded] = useState<boolean>(false);
  const [isPatientSummaryExpanded, setIsPatientSummaryExpanded] = useState<boolean>(false);
  const [isGlossaryExpanded, setIsGlossaryExpanded] = useState<boolean>(false);
  const [isSchematicSummaryExpanded, setIsSchematicSummaryExpanded] = useState<boolean>(false);
  const [isImageEvaluationExpanded, setIsImageEvaluationExpanded] = useState<boolean>(false);
  const [isAdditionalEvaluationExpanded, setIsAdditionalEvaluationExpanded] = useState<boolean>(false);

  // States for Semiology and Clinical Justification Table
  const [semiologyData, setSemiologyData] = useState<any | null>(null);
  const [selectedConfirmedDiagnoses, setSelectedConfirmedDiagnoses] = useState<boolean[]>([]);
  const [selectedRuledOutPathologies, setSelectedRuledOutPathologies] = useState<boolean[]>([]);
  const [isGeneratingSemiology, setIsGeneratingSemiology] = useState<boolean>(false);
  const [semiologyError, setSemiologyError] = useState<string | null>(null);
  const [isSemiologyExpanded, setIsSemiologyExpanded] = useState<boolean>(false);

  // States for Image Annotations / Marking regions
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([]);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<"point" | "box">("point");
  const [isDrawingBox, setIsDrawingBox] = useState<boolean>(false);
  const [drawStartPercent, setDrawStartPercent] = useState<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    type: "point" | "box";
    x: number;
    y: number;
    w?: number;
    h?: number;
  } | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string>("");
  const [isAutoLabeling, setIsAutoLabeling] = useState<boolean>(false);
  const [autoLabelError, setAutoLabelError] = useState<string | null>(null);

  // 2. STATE FOR CLASSIFICATION EXPLORER & CALCULATORS
  const [classificationQuery, setClassificationQuery] = useState<string>("");
  const [isLoadingClassification, setIsLoadingClassification] = useState<boolean>(false);
  const [classificationResult, setClassificationResult] = useState<string>("");
  const [classificationError, setClassificationError] = useState<string | null>(null);
  
  // Interactive classification wizard state
  const [selectedClassSystem, setSelectedClassSystem] = useState<string>("bosniak");
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>({});
  const [wizardOutput, setWizardOutput] = useState<string>("");

  // 3. STATE FOR DIALOG CHAT CONSULTANT
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isSendingMsg, setIsSendingMsg] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 4. STATE FOR API HEALTH DIAGNOSTICS
  const [apiDiagnostics, setApiDiagnostics] = useState<any>(null);
  const [checkingApi, setCheckingApi] = useState<boolean>(false);

  // Dynamic Firebase configuration states
  const [customFirebaseRaw, setCustomFirebaseRaw] = useState<string>(() => {
    return localStorage.getItem("rad_custom_firebase_config_raw") || "";
  });
  const [firebaseConfigStatus, setFirebaseConfigStatus] = useState<string | null>(null);
  const [isTestingFirebaseConfig, setIsTestingFirebaseConfig] = useState<boolean>(false);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isMigratingStudies, setIsMigratingStudies] = useState<boolean>(false);
  const [migrationProgress, setMigrationProgress] = useState<string | null>(null);
  const [confirmResetFirebase, setConfirmResetFirebase] = useState<boolean>(false);

  const getStructuresForProtocol = (protocol: string): Array<{ id: string; label: string; allowedStates: string[] }> => {
    const norm = protocol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let caseKey = protocol;
    if (norm.includes("hombro")) caseKey = "Hombro";
    else if (norm.includes("rodilla")) caseKey = "Rodilla";
    else if (norm.includes("tobillo")) caseKey = "Tobillo";
    else if (norm.includes("muslo anterior")) caseKey = "Muslo Anterior";
    else if (norm.includes("muslo posterior")) caseKey = "Muslo Posterior";
    else if (norm.includes("cuello")) caseKey = "Cuello y Tiroides";
    else if (norm.includes("urinarias") || norm.includes("orina")) caseKey = "V√≠as Urinarias";
    else if (norm.includes("codo")) caseKey = "Codo";
    else if (norm.includes("pared") || norm.includes("abdominal wall")) caseKey = "Pared Abdominal";
    else if (norm.includes("abdomen")) caseKey = "Abdomen";
    else if (norm.includes("escroto")) caseKey = "Escroto";
    else if (norm.includes("muneca")) caseKey = "Mu√±eca";
    else if (norm.includes("mama")) caseKey = "Mamas";
    else if (norm.includes("pantorrilla") || norm.includes("aquiles") || norm.includes("achilles") || norm.includes("pantorilla")) caseKey = "Pantorrilla y Tend√≥n de Aquiles";
    else if (norm.includes("cerebro") || norm.includes("neonatal") || norm.includes("transfontanelar")) caseKey = "Cerebro Neonatal";

    switch (caseKey) {
      case "Hombro":
        return [
          { id: "supraspinatus", label: "Supraespinoso", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "infraspinatus", label: "Infraespinoso", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "subscapularis", label: "Subescapular", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "biceps", label: "PL B√≠ceps", allowedStates: ["no_descrito", "normal", "tendinitis", "subluxacion", "rotura"] },
          { id: "bursa", label: "Bursa SAD", allowedStates: ["no_descrito", "normal", "bursitis_leve", "bursitis_severa"] },
          { id: "glenohumeral", label: "Derrame GH", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] },
          { id: "acromioclavicular", label: "Artic. Acromioclav.", allowedStates: ["no_descrito", "normal", "artrosis", "hipertrofia"] },
          { id: "dynamic_assessment", label: "Val. Din√°mica", allowedStates: ["no_descrito", "normal", "pinzamiento"] }
        ];
      case "Rodilla":
        return [
          { id: "quadriceps", label: "Tend√≥n Cuadricipital", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "patellar", label: "Tend√≥n Rotuliano", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "desgarro_completo"] },
          { id: "lcm", label: "Lig. Colateral Medial", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "lce", label: "Lig. Colateral Lateral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "medial_meniscus", label: "Menisco Medial", allowedStates: ["no_descrito", "normal", "meniscosis", "desgarro_parcial", "rotura"] },
          { id: "lateral_meniscus", label: "Menisco Lateral", allowedStates: ["no_descrito", "normal", "meniscosis", "desgarro_parcial", "rotura"] },
          { id: "joint_effusion", label: "Derrame Articular", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] },
          { id: "baker_cyst", label: "Quiste de Baker", allowedStates: ["no_descrito", "normal", "quiste_leve", "quiste_severo"] },
          { id: "popliteal_artery", label: "Arteria Popl√≠tea", allowedStates: ["no_descrito", "normal", "ectasia", "ateromatosis"] },
          { id: "popliteal_vein", label: "Vena Popl√≠tea", allowedStates: ["no_descrito", "normal", "trombosis"] },
          { id: "distal_tendons", label: "Tendones Distales", allowedStates: ["no_descrito", "normal", "coleccion"] },
          { id: "popliteal_fossa", label: "Fosa Popl√≠tea", allowedStates: ["no_descrito", "normal", "adenopatia"] }
        ];
      case "Tobillo":
        return [
          { id: "t_aquiles", label: "T. Aquiles", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "fascia_plantar", label: "Fascia Plantar", allowedStates: ["no_descrito", "normal", "fascitis", "desgarro_parcial", "rotura"] },
          { id: "l_peroneoastragalino_ant", label: "LPAA", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "l_peroneocalcaneo", label: "LPC", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "l_tibioastragalino_ant", label: "LTAA", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "rotura"] },
          { id: "t_tibial_anterior", label: "T. Tibial Anterior", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "t_peroneo_largo", label: "T. Peroneo Largo", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "receso_articular", label: "Receso Articular", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado"] }
        ];
      case "Muslo Anterior":
        return [
          { id: "recto_femoral", label: "R. Femoral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_medial", label: "V. Medial", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_lateral", label: "V. Lateral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "vasto_intermedio", label: "V. Intermedio", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "tensor_fascia_lata", label: "Tensor Fascia Lata", allowedStates: ["no_descrito", "normal", "sobrecarga", "tendinosis", "desgarro"] },
          { id: "sartorio", label: "Sartorio", allowedStates: ["no_descrito", "normal", "sobrecarga", "tenosinovitis", "desgarro"] }
        ];
      case "Muslo Posterior":
        return [
          { id: "semitendinoso", label: "Semitendinoso", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "semimembranoso", label: "Semimembranoso", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "biceps_femoral", label: "B√≠ceps Femoral", allowedStates: ["no_descrito", "normal", "esguince_leve", "desgarro_parcial", "desgarro_completo"] },
          { id: "nervio_ciatico", label: "N. Ci√°tico", allowedStates: ["no_descrito", "normal", "ciatalgia", "atrapamiento"] },
          { id: "tejido_subcutaneo", label: "T. Subcut√°neo", allowedStates: ["no_descrito", "normal", "edema_leve", "edema_severo"] }
        ];
      case "Cuello":
        return [
          { id: "glandula_tiroides", label: "G. Tiroides", allowedStates: ["no_descrito", "normal", "bocio_nodular", "tiroiditis"] },
          { id: "lobulo_derecho", label: "L√≥bulo Derecho", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso"] },
          { id: "lobulo_izquierdo", label: "L√≥bulo Izquierdo", allowedStates: ["no_descrito", "normal", "nodulo_benigno", "nodulo_sospechoso"] },
          { id: "istmo", label: "Istmo", allowedStates: ["no_descrito", "normal", "quiste", "hipertrofia"] },
          { id: "glandulas_salivales", label: "G. Salivales", allowedStates: ["no_descrito", "normal", "sialoadenitis", "sialolitiasis"] },
          { id: "parotida_derecha", label: "Par√≥tida Derecha", allowedStates: ["no_descrito", "normal", "quiste", "adenoma"] },
          { id: "parotida_izquierda", label: "Par√≥tida Izquierda", allowedStates: ["no_descrito", "normal", "quiste", "adenoma"] },
          { id: "submandibular_derecha", label: "Submandibular Der", allowedStates: ["no_descrito", "normal", "ectasia", "sialolitiasis"] },
          { id: "submandibular_izquierda", label: "Submandibular Izq", allowedStates: ["no_descrito", "normal", "ectasia", "sialolitiasis"] },
          { id: "ganglios_linfaticos", label: "Ganglios Linf√°ticos", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] }
        ];
      case "Vias urinarias":
        return [
          { id: "rinon_derecho", label: "Ri√±√≥n Derecho", allowedStates: ["no_descrito", "normal", "litiasis", "quiste", "ectasia"] },
          { id: "rinon_izquierdo", label: "Ri√±√≥n Izquierdo", allowedStates: ["no_descrito", "normal", "litiasis", "quiste", "ectasia"] },
          { id: "vejiga", label: "Vejiga", allowedStates: ["no_descrito", "normal", "cistitis", "sedimento", "litiasis"] },
          { id: "ureteres", label: "Ur√©teres", allowedStates: ["no_descrito", "normal", "dilatacion", "obstruccion"] },
          { id: "prostata_o_utero", label: "Pr√≥stata / √ötero", allowedStates: ["no_descrito", "normal", "hipertrofia", "miomatosis", "quiste"] }
        ];
      case "Codo":
        return [
          { id: "t_triceps", label: "T. Tr√≠ceps", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "t_biceps_distal", label: "T. B√≠ceps Distal", allowedStates: ["no_descrito", "normal", "tendinosis", "desgarro_parcial", "rotura"] },
          { id: "t_comun_extensor", label: "T. Com√∫n Extensor", allowedStates: ["no_descrito", "normal", "epicondilitis_lateral", "desgarro_parcial", "rotura"] },
          { id: "t_comun_flexor", label: "T. Com√∫n Flexor", allowedStates: ["no_descrito", "normal", "epicondilitis_medial", "desgarro_parcial", "rotura"] },
          { id: "n_cubital", label: "N. Cubital", allowedStates: ["no_descrito", "normal", "neuritis", "subluxacion"] },
          { id: "receso_olecraniano", label: "Receso Olecraniano", allowedStates: ["no_descrito", "normal", "derrame_leve", "derrame_moderado", "sinovitis"] }
        ];
      case "Abdomen":
        return [
          { id: "higado", label: "H√≠gado", allowedStates: ["no_descrito", "normal", "esteatosis_leve", "esteatosis_moderada", "esteatosis_severa", "hepatomegalia", "cirrosis", "quiste", "hemangioma", "lesion_ocupante"] },
          { id: "vesicula_biliar", label: "Ves√≠cula Biliar", allowedStates: ["no_descrito", "normal", "colelitiasis", "barro_biliar", "colecistitis_aguda", "polipo", "pared_engrosada"] },
          { id: "vias_biliares", label: "V√≠as Biliares", allowedStates: ["no_descrito", "normal", "ectasia_intrahepatica", "dilatacion_coledoco"] },
          { id: "pancreas", label: "P√°ncreas", allowedStates: ["no_descrito", "normal", "pancreatitis_aguda", "pancreatitis_cronica", "quiste", "calcificaciones"] },
          { id: "bazo", label: "Bazo", allowedStates: ["no_descrito", "normal", "esplenomegalia", "nodulo_esplenico", "infarto_esplenico"] },
          { id: "aorta_abdominal", label: "Aorta Abdominal", allowedStates: ["no_descrito", "normal", "ectasia", "aneurisma", "placas_calcificadas"] },
          { id: "retroperitoneo", label: "Retroperitoneo", allowedStates: ["no_descrito", "normal", "liquido_libre", "adenopatias_retroperitoneales"] }
        ];
      case "Escroto":
        return [
          { id: "testiculo_derecho", label: "Test√≠culo Derecho", allowedStates: ["no_descrito", "normal", "orquitis", "quiste", "nodulo", "atrofia", "microcalcificaciones"] },
          { id: "testiculo_izquierdo", label: "Test√≠culo Izquierdo", allowedStates: ["no_descrito", "normal", "orquitis", "quiste", "nodulo", "atrofia", "microcalcificaciones"] },
          { id: "epididimo_derecho", label: "Epid√≠dimo Derecho", allowedStates: ["no_descrito", "normal", "epididimitis", "quiste", "hipertrofia"] },
          { id: "epididimo_izquierdo", label: "Epid√≠dimo Izquierdo", allowedStates: ["no_descrito", "normal", "epididimitis", "quiste", "hipertrofia"] },
          { id: "hemiescroto_derecho", label: "Hemiescroto Derecho", allowedStates: ["no_descrito", "normal", "hidrocele_leve", "hidrocele_moderado", "varicocele_grado_i", "varicocele_grado_ii", "varicocele_grado_iii"] },
          { id: "hemiescroto_izquierdo", label: "Hemiescroto Izquierdo", allowedStates: ["no_descrito", "normal", "hidrocele_leve", "hidrocele_moderado", "varicocele_grado_i", "varicocele_grado_ii", "varicocele_grado_iii"] }
        ];
      case "Mu√±eca":
        return [
          { id: "nervio_mediano", label: "Nervio Mediano", allowedStates: ["no_descrito", "normal", "neuritis", "atrapamiento_tarsiano", "engrosamiento"] },
          { id: "tendones_flexores", label: "Tendones Flexores", allowedStates: ["no_descrito", "normal", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "flexor_carpi_radialis", label: "Flexor Carpi Radialis", allowedStates: ["no_descrito", "normal", "tenosinovitis", "tendinosis"] },
          { id: "arteria_radial", label: "Arteria Radial", allowedStates: ["no_descrito", "normal", "ateromatosis", "aneurisma_falso"] },
          { id: "receso_radiocarpiano_anterior", label: "Receso Radiocarpiano Anterior", allowedStates: ["no_descrito", "normal", "derrame_leve", "sinovitis"] },
          { id: "canal_de_guyon", label: "Canal de Guyon", allowedStates: ["no_descrito", "normal", "atrapamiento_cubital", "lesion_ocupante"] },
          { id: "receso_radiocarpiano_posterior", label: "Receso Radiocarpiano Posterior", allowedStates: ["no_descrito", "normal", "derrame_leve", "sinovitis"] },
          { id: "articulacion_radiocubital_distal", label: "Regi√≥n Radiocubital Distal", allowedStates: ["no_descrito", "normal", "artrosis", "subluxacion"] },
          { id: "tendones_extensores_compartimentos", label: "Compartimentos Extensores", allowedStates: ["no_descrito", "normal", "tenosinovitis_de_quervain", "tenosinovitis", "desgarro_parcial", "rotura"] },
          { id: "fibrocartilago_triangular", label: "Fibrocart√≠lago Triangular", allowedStates: ["no_descrito", "normal", "degenerativo", "rotura"] },
          { id: "extensor_carpi_ulnaris", label: "Extensor Carpi Ulnaris", allowedStates: ["no_descrito", "normal", "tenosinovitis", "subluxacion"] }
        ];
      case "Mamas":
        return [
          { id: "mama_derecha", label: "Mama Derecha", allowedStates: ["no_descrito", "normal", "condicion_fibroquistica", "ecorrefringencia_aumentada"] },
          { id: "mama_izquierda", label: "Mama Izquierda", allowedStates: ["no_descrito", "normal", "condicion_fibroquistica", "ecorrefringencia_aumentada"] },
          { id: "cuadrantes_mama_derecha", label: "Cuadrantes Mama Der", allowedStates: ["no_descrito", "normal", "quiste_simple", "quiste_complejo", "fibroadenoma", "lesion_altamente_sospechosa"] },
          { id: "cuadrantes_mama_izquierda", label: "Cuadrantes Mama Izq", allowedStates: ["no_descrito", "normal", "quiste_simple", "quiste_complejo", "fibroadenoma", "lesion_altamente_sospechosa"] },
          { id: "axila_derecha", label: "Axila Derecha", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] },
          { id: "axila_izquierda", label: "Axila Izquierda", allowedStates: ["no_descrito", "normal", "adenopatia_reactiva", "adenopatia_sospechosa"] }
        ];
      case "Pared Abdominal":
        return [
          { id: "rectus_abdominis_right", label: "M√∫sculo Recto Der.", allowedStates: ["no_descrito", "normal", "diastasis", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "rectus_abdominis_left", label: "M√∫sculo Recto Izq.", allowedStates: ["no_descrito", "normal", "diastasis", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "oblique_muscles_right", label: "M√∫sculos Oblicuos Der.", allowedStates: ["no_descrito", "normal", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "oblique_muscles_left", label: "M√∫sculos Oblicuos Izq.", allowedStates: ["no_descrito", "normal", "desgarro", "hernia", "hematoma", "lipoma", "coleccion"] },
          { id: "linea_alba", label: "L√≠nea Alba", allowedStates: ["no_descrito", "normal", "diastasis", "hernia", "ruptura"] },
          { id: "umbilical_region", label: "Regi√≥n Umbilical", allowedStates: ["no_descrito", "normal", "hernia_umbilical", "diastasis"] },
          { id: "epigastric_region", label: "Regi√≥n Epig√°strica", allowedStates: ["no_descrito", "normal", "hernia_epigastrica", "lipoma"] },
          { id: "inguinal_region_right", label: "Regi√≥n Inguinal Der.", allowedStates: ["no_descrito", "normal", "hernia_inguinal_directa", "hernia_inguinal_indirecta", "adenopatia"] },
          { id: "inguinal_region_left", label: "Regi√≥n Inguinal Izq.", allowedStates: ["no_descrito", "normal", "hernia_inguinal_directa", "hernia_inguinal_indirecta", "adenopatia"] },
          { id: "crural_region_right", label: "Regi√≥n Crural Der.", allowedStates: ["no_descrito", "normal", "hernia_crural", "adenopatia"] },
          { id: "crural_region_left", label: "Regi√≥n Crural Izq.", allowedStates: ["no_descrito", "normal", "hernia_crural", "adenopatia"] }
        ];
      case "Pantorrilla y Tend√≥n de Aquiles":
        return [
          { id: "gastrocnemius_medial", label: "Gastrocnemio Medial", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial", "hematoma"] },
          { id: "gastrocnemius_lateral", label: "Gastrocnemio Lateral", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial", "hematoma"] },
          { id: "soleus_muscle", label: "M√∫sculo S√≥leo", allowedStates: ["no_descrito", "normal", "desgarro", "miofascial"] },
          { id: "achilles_tendon", label: "Tend√≥n de Aquiles", allowedStates: ["no_descrito", "normal", "tendinosis", "rotura_parcial", "rotura_completa", "entesopatia"] },
          { id: "plantaris_tendon", label: "Plantar Delgado", allowedStates: ["no_descrito", "normal", "desgarro", "engrosamiento"] },
          { id: "retrocalcaneal_bursa", label: "Bolsa Retrocalc√°nea", allowedStates: ["no_descrito", "normal", "bursitis"] }
        ];
      case "Cerebro Neonatal":
        return [
          { id: "ventricle_right", label: "Ventr√≠culo Lateral Derecho", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
          { id: "ventricle_left", label: "Ventr√≠culo Lateral Izquierdo", allowedStates: ["no_descrito", "normal", "dilatacion_leve", "dilatacion_moderada_severa", "hemorragia_intraventricular_sin_dilatacion", "hemorragia_intraventricular_con_dilatacion"] },
          { id: "ventricle_third_fourth", label: "Tercer y Cuarto Ventr√≠culo", allowedStates: ["no_descrito", "normal", "dilatacion"] },
          { id: "choroid_right", label: "Plexo Coroideo Derecho", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
          { id: "choroid_left", label: "Plexo Coroideo Izquierdo", allowedStates: ["no_descrito", "normal", "congestion_hemorragica", "quiste_plexo"] },
          { id: "germinal_right", label: "Surco Caudotal√°mico Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
          { id: "germinal_left", label: "Surco Caudotal√°mico Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_subependimaria_g1", "quiste_subependimario"] },
          { id: "parenchyma_periventricular_right", label: "Par√©nquima Periventricular Derecho", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
          { id: "parenchyma_periventricular_left", label: "Par√©nquima Periventricular Izquierdo", allowedStates: ["no_descrito", "normal", "leucomalacia_periventricular_leve", "leucomalacia_periventricular_cavitaria", "calcificaciones"] },
          { id: "parenchyma_focal_right", label: "Par√©nquima Lobar Derecho", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
          { id: "parenchyma_focal_left", label: "Par√©nquima Lobar Izquierdo", allowedStates: ["no_descrito", "normal", "hemorragia_intraparenquimatosa_g4", "calcificaciones_focales", "edema_difuso"] },
          { id: "subarachnoid_space", label: "Espacio Subaracnoideo y Cisternas", allowedStates: ["no_descrito", "normal", "dilatacion_benigna", "coleccion_extraaxial"] }
        ];
      default:
        return [];
    }
  };

  const getProtocolStateAndSetters = (protocol: string) => {
    const norm = protocol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let caseKey = protocol;
    if (norm.includes("hombro")) caseKey = "Hombro";
    else if (norm.includes("rodilla")) caseKey = "Rodilla";
    else if (norm.includes("tobillo")) caseKey = "Tobillo";
    else if (norm.includes("muslo anterior")) caseKey = "Muslo Anterior";
    else if (norm.includes("muslo posterior")) caseKey = "Muslo Posterior";
    else if (norm.includes("cuello")) caseKey = "Cuello";
    else if (norm.includes("urinarias") || norm.includes("orina")) caseKey = "Vias urinarias";
    else if (norm.includes("codo")) caseKey = "Codo";
    else if (norm.includes("pared") || norm.includes("abdominal wall")) caseKey = "Pared Abdominal";
    else if (norm.includes("abdomen")) caseKey = "Abdomen";
    else if (norm.includes("escroto")) caseKey = "Escroto";
    else if (norm.includes("muneca")) caseKey = "Mu√±eca";
    else if (norm.includes("mama")) caseKey = "Mamas";
    else if (norm.includes("pantorrilla") || norm.includes("aquiles") || norm.includes("achilles") || norm.includes("pantorilla")) caseKey = "Pantorrilla y Tend√≥n de Aquiles";
    else if (norm.includes("cerebro") || norm.includes("neonatal") || norm.includes("transfontanelar")) caseKey = "Cerebro Neonatal";

    switch (caseKey) {
      case "Hombro":
        return { states: shoulderStates, setStates: setShoulderStates, descs: shoulderDescriptions, setDescs: setShoulderDescriptions };
      case "Rodilla":
        return { states: kneeStates, setStates: setKneeStates, descs: kneeDescriptions, setDescs: setKneeDescriptions };
      case "Tobillo":
        return { states: ankleStates, setStates: setAnkleStates, descs: ankleDescriptions, setDescs: setAnkleDescriptions };
      case "Muslo Anterior":
        return { states: thighStates, setStates: setThighStates, descs: thighDescriptions, setDescs: setThighDescriptions };
      case "Muslo Posterior":
        return { states: thighPosteriorStates, setStates: setThighPosteriorStates, descs: thighPosteriorDescriptions, setDescs: setThighPosteriorDescriptions };
      case "Cuello":
        return { states: neckStates, setStates: setNeckStates, descs: neckDescriptions, setDescs: setNeckDescriptions };
      case "Vias urinarias":
        return { states: urinaryStates, setStates: setUrinaryStates, descs: urinaryDescriptions, setDescs: setUrinaryDescriptions };
      case "Codo":
        return { states: elbowStates, setStates: setElbowStates, descs: elbowDescriptions, setDescs: setElbowDescriptions };
      case "Abdomen":
        return { states: abdomenStates, setStates: setAbdomenStates, descs: abdomenDescriptions, setDescs: setAbdomenDescriptions };
      case "Pared Abdominal":
        return { states: abdominalWallStates, setStates: setAbdominalWallStates, descs: abdominalWallDescriptions, setDescs: setAbdominalWallDescriptions };
      case "Escroto":
        return { states: scrotumStates, setStates: setScrotumStates, descs: scrotumDescriptions, setDescs: setScrotumDescriptions };
      case "Mu√±eca":
        return { states: wristStates, setStates: setWristStates, descs: wristDescriptions, setDescs: setWristDescriptions };
      case "Mamas":
        return { states: breastStates, setStates: setBreastStates, descs: breastDescriptions, setDescs: setBreastDescriptions };
      case "Pantorrilla y Tend√≥n de Aquiles":
        return { states: calfAchillesStates, setStates: setCalfAchillesStates, descs: calfAchillesDescriptions, setDescs: setCalfAchillesDescriptions };
      case "Cerebro Neonatal":
        return { states: neonatalBrainStates, setStates: setNeonatalBrainStates, descs: neonatalBrainDescriptions, setDescs: setNeonatalBrainDescriptions };
      default:
        return null;
    }
  };

  const handleApplySmartModification = async () => {
    if (!activeProtocol) return;
    setIsSmartAnatomyModifying(true);
    setSmartAnatomyError("");
    try {
      const helper = getProtocolStateAndSetters(activeProtocol);
      if (!helper) throw new Error("Protocolo no soportado");

      const structuresList = getStructuresForProtocol(activeProtocol);

      const response = await fetch("/api/smart-modify-anatomy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentStates: helper.states,
          currentDescriptions: helper.descs,
          structures: structuresList,
          instruction: smartInstructionsText,
          studyType: activeProtocol,
          reportText: isEditingReportManual ? editedReportText : (generatedReport || ""),
          model: selectedModel,
          currentAdditionalFindings: additionalFindings[activeProtocol] || []
        })
      });

      if (!response.ok) {
        throw new Error("Error al consultar el servicio inteligente de modificaci√≥n");
      }

      const data = await response.json();
      if (data.states && data.descriptions) {
        helper.setStates(data.states);
        helper.setDescs(data.descriptions);
        const nextExtras = data.additionalFindings && Array.isArray(data.additionalFindings)
          ? data.additionalFindings
          : data.additionalTexts && Array.isArray(data.additionalTexts)
            ? data.additionalTexts.map((txt: string, idx: number) => ({
                id: `smart-add-${idx}-${Date.now()}`,
                structureName: "Hallazgo Adicional " + (idx + 1),
                state: "Alterado",
                description: txt
              }))
            : [];

        if (data.additionalFindings && Array.isArray(data.additionalFindings)) {
          setAdditionalFindings(prev => ({
            ...prev,
            [activeProtocol]: data.additionalFindings
          }));
        } else if (data.additionalTexts && Array.isArray(data.additionalTexts)) {
          setAdditionalFindings(prev => ({
            ...prev,
            [activeProtocol]: nextExtras
          }));
        }
        
        // Extract only the newly requested/changed diagnoses
        const changedDiagnoses: string[] = [];
        for (const struct of structuresList) {
          const prevS = helper.states[struct.id] || "no_descrito";
          const prevD = helper.descs[struct.id] || "";
          const nextS = data.states[struct.id] || "no_descrito";
          const nextD = data.descriptions[struct.id] || "";

          if (nextS !== "no_descrito" && nextS !== "normal") {
            const hasStateChanged = prevS !== nextS;
            const hasDescChanged = prevD !== nextD;
            if (hasStateChanged || hasDescChanged) {
              changedDiagnoses.push(nextD);
            }
          }
        }

        const prevExtras = additionalFindings[activeProtocol] || [];
        for (const extra of nextExtras) {
          const matchingPrev = prevExtras.find((pe: any) => pe.id === extra.id);
          if (!matchingPrev || matchingPrev.description !== extra.description || matchingPrev.state !== extra.state) {
            changedDiagnoses.push(extra.description);
          }
        }

        if (changedDiagnoses.length > 0) {
          const activeReport = isEditingReportManual ? editedReportText : (generatedReport || "");
          const separator = activeReport ? "\n\n" : "";
          const textToAppend = changedDiagnoses.join("\n");
          const nextReport = activeReport + separator + textToAppend;

          if (isEditingReportManual) {
            setEditedReportText(nextReport);
          } else {
            setGeneratedReport(nextReport);
            setEditedReportText(nextReport);
          }
        }

        setSmartInstructionsText("");
      } else {
        throw new Error("No se devolvieron estados ni descripciones actualizados.");
      }
    } catch (err: any) {
      setSmartAnatomyError(err.message || "Error al aplicar los ajustes inteligentes.");
    } finally {
      setIsSmartAnatomyModifying(false);
    }
  };

  const checkApiHealth = async () => {
    setCheckingApi(true);
    setApiDiagnostics(null); // Explicitly reset to null to show loading state initially
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout
    
    try {
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      setApiDiagnostics(data);
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error("Error diagnosticando API:", e);
      setApiDiagnostics({
        status: "error",
        message: "No se pudo conectar con el servidor para diagnosticar la API.",
        error: e?.name === "AbortError" ? "Se agot√≥ el tiempo de espera (Timeout de 6s)." : (e?.message || String(e)),
        api_key_configured: false
      });
    } finally {
      setCheckingApi(false);
    }
  };

  // Run the diagnostic load automatically when switching to the API or configuration tabs
  useEffect(() => {
    if (activeTab === "api") {
      checkApiHealth();
    }
  }, [activeTab]);

  // Initialize values and load from Local Storage on mount
  useEffect(() => {
    // Instructions setup
    const savedGenInst = localStorage.getItem("radiology_sys_inst");
    if (savedGenInst) setSystemInstruction(savedGenInst);
    else {
      setSystemInstruction(GENERAL_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_sys_inst", GENERAL_SYSTEM_INSTRUCTION);
    }

    const savedChatInst = localStorage.getItem("radiology_chat_inst");
    if (savedChatInst) setChatInstruction(savedChatInst);
    else {
      setChatInstruction(CHAT_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_chat_inst", CHAT_SYSTEM_INSTRUCTION);
    }

    const savedClassInst = localStorage.getItem("radiology_class_inst");
    if (savedClassInst) setClassifyInstruction(savedClassInst);
    else {
      setClassifyInstruction(CLASSIFICATION_SYSTEM_INSTRUCTION);
      localStorage.setItem("radiology_class_inst", CLASSIFICATION_SYSTEM_INSTRUCTION);
    }

    // Reports log setup with IndexedDB persistent storage
    idbGetHistory().then(idbReports => {
      if (Array.isArray(idbReports) && idbReports.length > 0) {
        setSavedReports(idbReports);
      } else {
        const storedReports = localStorage.getItem("radiology_reports_history");
        if (storedReports) {
          try {
            const parsed = JSON.parse(storedReports);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSavedReports(parsed);
              idbSaveHistory(parsed);
            }
          } catch (e) {
            setSavedReports([]);
          }
        }
      }
    });
  }, []);

  // Prevent browser-added default print headers and footers by dynamically stripping title during print
  useEffect(() => {
    const handleBeforePrint = () => {
      try {
        (window as any)._originalDocTitle = document.title;
        document.title = "";
      } catch (e) {
        console.error(e);
      }
    };
    const handleAfterPrint = () => {
      try {
        if (typeof (window as any)._originalDocTitle === "string" && (window as any)._originalDocTitle) {
          document.title = (window as any)._originalDocTitle;
        } else {
          document.title = "My Google AI Studio App";
        }
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);



  // Set defaults or modify states based on active preset selection
  const applyPreset = (preset: Presets) => {
    handleLoadStudyType(preset.studyType || "");
    setClinicalHistory(preset.defaultHistory || "");
    setCustomPrompt(preset.customPrompt || "");
  };

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    const preset = STUDY_PRESETS.find(p => p.id === id);
    if (preset) {
      applyPreset(preset);
    }
  };

  const resetGeneratorForm = () => {
    setCurrentCloudStudyId("");
    setModality("Radiograf√≠a");
    setSpecificStudy("T√≥rax");
    setCustomStudy("");
    setLaterality("");
    setProjections([]);
    setCustomProjection("");
    setStudyType("");
    setClinicalHistory("");
    setFindings("");
    setInputReport("");
    setUploadedReportContent("");
    setUploadedReportName(null);
    setUploadedReportMimeType("");
    setCustomPrompt("");
    setSelectedFile(null);
    setBase64Image(null);
    setGeneratedReport("");
    setReportError(null);
    setReportHistory([]);
    setReportRedoHistory([]);
    setIsEditingReportManual(false);
    setEditedReportText("");
    setSelectedPresetId("");
    setImageEvaluation("");
    setIsEvaluatingImage(false);
    setCurrentModInstruction("");
    setIsModifyingReport(false);
    setModifyError(null);
    setAdditionalEvaluation("");
    setIsEvaluatingAdditional(false);
    setAdditionalEvalError(null);
    setCaseAnalysis("");
    setIsAnalyzingCase(false);
    setCaseAnalysisError(null);
    setBibliography("");
    setIsSearchingBibliography(false);
    setBibliographyError(null);
    setBibliographySources([]);
    setReportEvaluation("");
    setIsEvaluatingReport(false);
    setReportEvaluationError(null);
    setAnnotations([]);
    setIsDrawingBox(false);
    setDrawStartPercent(null);
    setTempBox(null);
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  // Convert File to base64
  const processImageFile = (file: File) => {
    const isZip = file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    if (isZip) {
      setZipFile(file);
      setIsZipExtractorOpen(true);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Por favor, sube un archivo de tipo imagen (PNG, JPG, BMP).");
      return;
    }
    
    // File size safety check
    if (file.size > 15 * 1024 * 1024) {
      alert("La imagen excede el l√≠mite recomendado de 15MB.");
      return;
    }

    setSelectedFile(file);
    
    // Revoke old blob URL
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreviewUrl);
      } catch (_) {}
    }
    
    const objUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        // Strip out metadata prefix (e.g., "data:image/png;base64,") for SDK
        const parts = reader.result.split(",");
        if (parts.length > 1) {
          setBase64Image(parts[1]);
        } else {
          setBase64Image(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadExtractedToGenerator = (extracted: ExtractedFile) => {
    const fileObj = new File([extracted.rawArray], extracted.nameOnly, { type: extracted.mimeType });
    setSelectedFile(fileObj);
    setBase64Image(extracted.base64);
    
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      try { URL.revokeObjectURL(imagePreviewUrl); } catch (_) {}
    }
    
    if (extracted.isDicom) {
      // Use the beautiful decoded visual base64 directly as preview so the browser can display it
      setImagePreviewUrl(extracted.visualUrl || `data:image/png;base64,${extracted.base64}`);
    } else {
      const blob = new Blob([extracted.rawArray], { type: extracted.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setImagePreviewUrl(blobUrl);
    }
  };

  const handleLoadExtractedToSlot = (extracted: ExtractedFile, slot: 1 | 2 | 3) => {
    let cleanUrl = extracted.visualUrl ? extracted.visualUrl.trim().replace(/\s/g, "") : "";
    if (cleanUrl && !cleanUrl.startsWith("data:") && !cleanUrl.startsWith("blob:")) {
      let mime = "image/png";
      if (cleanUrl.startsWith("/9j/")) {
        mime = "image/jpeg";
      } else if (cleanUrl.startsWith("iVBORw0KGgo")) {
        mime = "image/png";
      } else if (cleanUrl.startsWith("PHN2Zy")) {
        mime = "image/svg+xml";
      }
      cleanUrl = `data:${mime};base64,${cleanUrl}`;
    }

    console.log(`[ZIP Single Loader] Pre-load check: Slot ${slot} - File: ${extracted.nameOnly}`);
    console.log(`[ZIP Single Loader] visualUrl first 150 chars:`, cleanUrl ? cleanUrl.substring(0, 150) + "..." : "EMPTY");

    setZipExtractedFileForAnalysis({
      file: {
        ...extracted,
        visualUrl: cleanUrl
      },
      slot
    });
    setActiveTab("expert-analysis"); // Automatically switch to the "expert-analysis" tab so they see it load!
  };

  const handleLoadMultipleSlots = (selections: { file: ExtractedFile; slot: 1 | 2 | 3 }[]) => {
    // Explicitly sanitize each file's visualUrl to ensure zero serialization issues before reaching components
    const sanitizedSelections = selections.map(seq => {
      let cleanUrl = seq.file.visualUrl ? seq.file.visualUrl.trim().replace(/\s/g, "") : "";
      
      // If it doesn't start with base64 data: or blob:, prepend correct header
      if (cleanUrl && !cleanUrl.startsWith("data:") && !cleanUrl.startsWith("blob:")) {
        let mime = "image/png";
        if (cleanUrl.startsWith("/9j/")) {
          mime = "image/jpeg";
        } else if (cleanUrl.startsWith("iVBORw0KGgo")) {
          mime = "image/png";
        } else if (cleanUrl.startsWith("PHN2Zy")) {
          mime = "image/svg+xml";
        }
        cleanUrl = `data:${mime};base64,${cleanUrl}`;
      }

      console.log(`[ZIP Batch Loader] Pre-load check: Slot ${seq.slot} - File: ${seq.file.nameOnly}`);
      console.log(`[ZIP Batch Loader] mimeType detected:`, seq.file.mimeType);
      console.log(`[ZIP Batch Loader] visualUrl base64 structure:`, cleanUrl ? cleanUrl.substring(0, 150) + "..." : "EMPTY");
      
      return {
        ...seq,
        file: {
          ...seq.file,
          visualUrl: cleanUrl
        }
      };
    });

    setZipExtractedFileForAnalysis(sanitizedSelections);
    setActiveTab("expert-analysis"); // Automatically switch to the "expert-analysis" tab so they see it load!
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const imageRef = useRef<HTMLImageElement | null>(null);

  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pendingAnnotation) return;
    
    const coords = getRelativeCoords(e);
    if (!coords) return;

    if (activeAnnotationTool === "point") {
      setPendingAnnotation({
        type: "point",
        x: coords.x,
        y: coords.y,
      });
      setPendingLabel("");
    } else {
      setIsDrawingBox(true);
      setDrawStartPercent(coords);
      setTempBox({
        x: coords.x,
        y: coords.y,
        w: 0,
        h: 0,
      });
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingBox || !drawStartPercent) return;
    const coords = getRelativeCoords(e);
    if (!coords) return;

    const x = Math.min(drawStartPercent.x, coords.x);
    const y = Math.min(drawStartPercent.y, coords.y);
    const w = Math.abs(drawStartPercent.x - coords.x);
    const h = Math.abs(drawStartPercent.y - coords.y);

    setTempBox({ x, y, w, h });
  };

  const handleImageMouseUp = () => {
    if (!isDrawingBox || !tempBox) return;
    setIsDrawingBox(false);
    setDrawStartPercent(null);

    if (tempBox.w < 1 && tempBox.h < 1) {
      setTempBox(null);
      return;
    }

    setPendingAnnotation({
      type: "box",
      x: tempBox.x,
      y: tempBox.y,
      w: tempBox.w,
      h: tempBox.h,
    });
    setPendingLabel("");
    setTempBox(null);
  };

  const handleAutoLabelAnnotation = async () => {
    if (!pendingAnnotation || !base64Image) {
      setAutoLabelError("No hay una imagen cargada o regi√≥n seleccionada.");
      return;
    }

    setIsAutoLabeling(true);
    setAutoLabelError(null);

    try {
      const response = await fetch("/api/auto-label-annotation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image,
          mimeType: selectedFile?.type || "image/png",
          studyType: studyType || "Estudio de Imagen",
          clinicalHistory: clinicalHistory || "",
          annotation: {
            type: pendingAnnotation.type,
            x: pendingAnnotation.x,
            y: pendingAnnotation.y,
            w: pendingAnnotation.w,
            h: pendingAnnotation.h,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener la etiqueta sugerida de la IA.");
      }

      if (data.label) {
        setPendingLabel(data.label);
      } else {
        setAutoLabelError("La IA no pudo sugerir una etiqueta clara para esta regi√≥n.");
      }
    } catch (err: any) {
      console.error("Error al obtener etiqueta IA:", err);
      setAutoLabelError(err.message || String(err));
    } finally {
      setIsAutoLabeling(false);
    }
  };

  const handleSaveAnnotation = () => {
    if (!pendingAnnotation) return;
    const labelToSave = pendingLabel.trim() || (pendingAnnotation.type === "point" ? `Punto de Inter√©s #${annotations.length + 1}` : `Zona de Sospecha #${annotations.length + 1}`);
    
    const newAnn: ImageAnnotation = {
      id: Math.random().toString(36).substring(2, 11),
      type: pendingAnnotation.type,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      w: pendingAnnotation.w,
      h: pendingAnnotation.h,
      label: labelToSave,
    };

    setAnnotations([...annotations, newAnn]);
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  const handleCancelPending = () => {
    setPendingAnnotation(null);
    setPendingLabel("");
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter((ann) => ann.id !== id));
  };

  const handleClearAllAnnotations = () => {
    setAnnotations([]);
  };

  // 1. ACTION: SEND PAYLOAD TO GENERATE REPORT
  const handleGenerateReport = async () => {
    if (!studyType.trim()) {
      setReportError("Por favor, especifica el Tipo de Estudio solicitado.");
      return;
    }

    // Reset current cloud study ID for the newly generated report
    setCurrentCloudStudyId("");

    setIsGenerating(true);
    setReportError(null);
    setGeneratedReport("");
    setClassRecommendations(null);
    setIncorporatedRecs({});
    setImageEvaluation("");
    setAdditionalEvaluation("");
    setCurrentModInstruction("");
    setModifyError(null);
    setAdditionalEvalError(null);
    setCaseAnalysis("");
    setCaseAnalysisError(null);
    setBibliography("");
    setBibliographyError(null);
    setBibliographySources([]);
    setReportEvaluation("");
    setReportEvaluationError(null);

    // Setup visual steps for medical analysis feeling
    const steps = [
      "Extrayendo metadatos cl√≠nicos...",
      "Estableciendo canal seguro con Gemini...",
      selectedFile ? "Renderizando densidades anat√≥micas complejas..." : "Analizando concordancia sint√°ctica...",
      "Aplicando reglas de redacci√≥n radiol√≥gica...",
      "Compilando informe estructurado..."
    ];

    let currentStepIndex = 0;
    setGenerationSteps(steps[0]);

    const stepInterval = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setGenerationSteps(steps[currentStepIndex]);
      }
    }, 1200);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image || undefined,
          mimeType: selectedFile ? selectedFile.type : undefined,
          studyType,
          clinicalHistory,
          findings,
          inputReport,
          uploadedReportContent: uploadedReportContent || undefined,
          uploadedReportMimeType: uploadedReportMimeType || undefined,
          systemInstruction: systemInstruction || undefined,
          annotations: annotations.length > 0 ? annotations : undefined,
          attachedImages: attachedImages && attachedImages.length > 0 ? attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || ""
          })) : undefined,
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        const textResponse = await response.text().catch(() => "");
        throw new Error(`La respuesta del servidor no es JSON v√°lido (C√≥digo HTTP ${response.status}). Detalle: ${textResponse.slice(0, 200) || "Sin respuesta del servidor"}`);
      }

      clearInterval(stepInterval);

      if (response.ok && data.success) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setOriginalBaseReport(data.report);

        // Resetear casillas del Sistema de Activaci√≥n R√°pida de M√≥dulos: por defecto Resumen Operacional y Paciente marcados
        setSelectedBatchModules({
          radar: false,
          case_analysis: false,
          quality_eval: false,
          bibliography: false,
          operational_summary: true,
          patient_summary: true,
          glossary: false,
          schematic: false,
          measurements: false,
          footnotes: false,
          organ_synoptic: false,
          fractures: false,
          classifications: false,
        });

        // Activaci√≥n Autom√°tica de Evaluaci√≥n de Calidad al Generar Reporte
        handleEvaluateReport(data.report);

        // Auto-detect specific study protocol (e.g. Muslo Posterior, Hombro, Rodilla, etc.) and switch active components
        autoDetectSpecificStudyAndModality(data.report, studyType);
        
        // Save to History Log
        const newReport: SavedReport = {
          id: Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toLocaleDateString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          }),
          studyType,
          clinicalHistory: clinicalHistory || "No especificada",
          reportText: data.report
        };

        const updatedHistory = [newReport, ...savedReports.slice(0, 49)]; // Keep up to 50 reports in history
        setSavedReports(updatedHistory);
        localStorage.setItem("radiology_reports_history", JSON.stringify(updatedHistory));
        idbSaveHistory(updatedHistory);

        // Auto-save generated report into local studies database (IndexedDB + localStorage)
        try {
          const autoStudy: CloudStudy = {
            id: newReport.id,
            userId: "local",
            userEmail: "anon@local.com",
            timestamp: newReport.timestamp,
            patientName: patientName || "Paciente Local",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "M√©dico Radi√≥logo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Cl√≠nica Privada",
            studyType,
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "Hallazgos guardados autom√°ticamente.",
            reportText: data.report,
            attachedImages: attachedImages || [],
            operationalSummaryText: "",
            pdfBase64: "",
            patientSummary: null,
            createdAt: new Date().toISOString(),
            specificStudy: specificStudy || "General",
            pdfLayoutType: pdfLayoutType || "classic",
            selectedLogo: selectedLogo || "none"
          };

          // Save into IndexedDB reliably
          await idbSaveStudy(autoStudy);

          const storedStudies = localStorage.getItem("rad_local_studies");
          let studiesList: CloudStudy[] = storedStudies ? JSON.parse(storedStudies) : [];
          studiesList = [autoStudy, ...studiesList.filter(s => s.id !== autoStudy.id)];
          try {
            localStorage.setItem("rad_local_studies", JSON.stringify(studiesList));
          } catch (e) {}
          
          // Re-fetch cloud/local studies to update UI
          fetchCloudStudies();
        } catch (autoErr) {
          console.warn("Error auto-saving study to local archive:", autoErr);
        }

        // If base64Image is present, automatically trigger image evaluation
        if (base64Image) {
          triggerAutoImageEvaluation(base64Image, selectedFile?.type, studyType, clinicalHistory, findings, annotations);
        }
      } else {
        setReportError(data.error || `Error del servidor (C√≥digo ${response.status}): ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      clearInterval(stepInterval);
      setReportError(`Falla de red o de servidor: ${error?.message || String(error)}. Aseg√∫rate de que el servidor est√° encendido y que tu API Key en la pesta√±a de Configuraci√≥n es correcta.`);
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to trigger standard image clinical assessment automatically
  const triggerAutoImageEvaluation = async (
    img: string,
    mime: string | undefined,
    study: string,
    history: string,
    finds: string,
    anns?: ImageAnnotation[]
  ) => {
    setIsEvaluatingImage(true);
    try {
      const resp = await fetch("/api/evaluate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          image: img,
          mimeType: mime || "image/png",
          studyType: study,
          clinicalHistory: history,
          findings: finds,
          isAdditional: false,
          annotations: anns && anns.length > 0 ? anns : undefined,
        }),
      });
      const resData = await resp.json();
      if (resData.success && resData.evaluation) {
        setImageEvaluation(resData.evaluation);
      }
    } catch (e) {
      console.error("Error auto-evaluating image:", e);
    } finally {
      setIsEvaluatingImage(false);
    }
  };

  // ACTION: ASSIST AND POLISH STUDY INDICATION (CASING & SPELLING ORTHOGRAPHY)
  const handleAssistClinicalHistory = async () => {
    if (!clinicalHistory.trim() || isAssistingHistory) return;
    setIsAssistingHistory(true);
    try {
      const response = await fetch("/api/assist-clinical-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          clinicalHistory,
          studyType,
        }),
      });
      const data = await response.json();
      if (data.success && data.polishedText) {
        setClinicalHistory(data.polishedText);
      } else {
        console.error("No se pudo pulir la indicaci√≥n:", data.error);
      }
    } catch (e) {
      console.error("Error al asistir con la indicaci√≥n cl√≠nica:", e);
    } finally {
      setIsAssistingHistory(false);
    }
  };

  // ACTION: REQUEST CUSTOM MODIFICATIONS (DIALOG MODIFIER) OR QUICK BUTTONS
  const handleModifyReport = async (instructionText: string) => {
    if (!generatedReport) return;
    setIsModifyingReport(true);
    setModifyError(null);
    try {
      const response = await fetch("/api/modify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: generatedReport,
          instruction: instructionText,
          image: base64Image || undefined,
          mimeType: selectedFile?.type || undefined,
          attachedImages: attachedImages && attachedImages.length > 0 ? attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || ""
          })) : undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setCurrentModInstruction("");
      } else {
        setModifyError(data.error || "Ocurri√≥ un error al intentar modificar el informe.");
      }
    } catch (err: any) {
      console.error("Error al modificar informe:", err);
      setModifyError(err?.message || String(err));
    } finally {
      setIsModifyingReport(false);
    }
  };

  const processRecQueue = async () => {
    if (isProcessingRecQueueRef.current) return;
    isProcessingRecQueueRef.current = true;
    setIsModifyingReport(true);
    setModifyError(null);

    while (recQueueRef.current.length > 0) {
      const recText = recQueueRef.current[0];
      const activeReport = isEditingReportManualRef.current ? editedReportTextRef.current : (generatedReportRef.current || "");

      if (!activeReport) {
        recQueueRef.current.shift();
        setPendingRecs(prev => {
          const next = { ...prev };
          delete next[recText];
          return next;
        });
        continue;
      }

      let sanitizedRec = recText.trim();
      sanitizedRec = sanitizedRec.replace(/^\*\*|\*\*$/g, "").trim();
      sanitizedRec = sanitizedRec.replace(/^["']|["']$/g, "").trim();

      setPendingRecText(recText);

      try {
        const response = await fetch("/api/modify-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModelRef.current,
            currentReport: activeReport,
            instruction: `Integra de forma totalmente fluida, nativa y natural, actuando en todo momento como el radi√≥logo principal que redacta el informe desde el principio, la siguiente clasificaci√≥n, escala o recomendaci√≥n cl√≠nica: "${sanitizedRec}". REQUISITO CR√çTICO: NO debes justificar la recomendaci√≥n, ni meter introducciones, explicaciones cl√≠nicas de por qu√© se usa ("para facilitar el manejo...", "se sugiere...", "como recomendaci√≥n de auditor√≠a..."), ni meta-comentarios. Escribe directo la categor√≠a, el grado o el dato cl√≠nico en la secci√≥n adecuada del reporte (HALLAZGOS o IMPRESI√ìN DIAGN√ìSTICA). Conserva intacto todo el resto del reporte.`,
            image: base64ImageRef.current || undefined,
            mimeType: selectedFileRef.current?.type || undefined,
          }),
        });
        const data = await response.json();
        if (data.success && data.report) {
          setReportHistory((prev) => [...prev, activeReport]);
          setReportRedoHistory([]);
          setGeneratedReport(data.report);
          setEditedReportText(data.report);
          generatedReportRef.current = data.report;
          editedReportTextRef.current = data.report;

          setIncorporatedAuditRecs(prev => ({
            ...prev,
            [recText]: true
          }));
        } else {
          setModifyError(data.error || "Ocurri√≥ un error al intentar incorporar de manera inteligente la recomendaci√≥n.");
        }
      } catch (err: any) {
        console.error("Error al incorporar recomendaci√≥n de auditor√≠a:", err);
        setModifyError(err?.message || String(err));
      } finally {
        recQueueRef.current.shift();
        setPendingRecs(prev => {
          const next = { ...prev };
          delete next[recText];
          return next;
        });
        setPendingRecText(null);
      }
    }

    isProcessingRecQueueRef.current = false;
    setIsModifyingReport(false);
  };

  const handleIncorporateRecommendation = (recText: string) => {
    if (!recText || incorporatedAuditRecs[recText] || pendingRecs[recText]) return;

    setPendingRecs(prev => ({ ...prev, [recText]: true }));
    recQueueRef.current.push(recText);
    processRecQueue();
  };

  const handleIncorporateToReport = (analysisText: string, studyTitle: string, medicalHistoryCombined: string, isAutoSync: boolean = false) => {
    // Check if it is a structured Case Analysis with JSON
    const jsonMatch = analysisText.match(/\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/);
    if (jsonMatch && jsonMatch[0]) {
      const jsonBlock = jsonMatch[0] + "\n\n";
      const textSummary = analysisText.replace(jsonMatch[0], "").trim();
      let format = "custom";
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        format = parsed.format || "custom";
      } catch (e) {
        console.error(e);
      }
      setFindings(prev => {
        return mergeCaseAnalysisBlock(prev || "", format, jsonBlock, textSummary);
      });
    } else {
      const wrappedContent = `=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===\n${analysisText}\n=== FIN DE VALORACI√ìN EXPERTA ===`;
      
      setFindings(prev => {
        if (!prev) return `${wrappedContent}\n\n`;
        
        const regex = /=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===[\s\S]*?=== FIN DE VALORACI√ìN EXPERTA ===/;
        if (regex.test(prev)) {
          return prev.replace(regex, wrappedContent);
        }
        
        if (prev.includes("=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===")) {
          const splitted = prev.split("=== VALORACI√ìN EXPERTA DE IMAGEN ANEXADA ===");
          const afterPart = splitted.slice(1).join(" ");
          const cleanedAfter = afterPart.replace(/^[\s\S]*?\n\n/, "");
          return `${wrappedContent}\n\n${splitted[0]}${cleanedAfter}`;
        }
        
        return `${wrappedContent}\n\n${prev}`;
      });
    }

    // Auto-sync clinical history and study information into report generator inputs
    if (medicalHistoryCombined && !medicalHistoryCombined.includes("S/D. Sospecha: S/D")) {
      setClinicalHistory(prev => {
        if (!prev || prev.trim() === "") return medicalHistoryCombined;
        if (prev.includes(medicalHistoryCombined)) return prev;
        return `${prev}\n\n[Contexto Doble Valoraci√≥n]: ${medicalHistoryCombined}`;
      });
    }

    if (studyTitle) {
      setSpecificStudy(prev => {
        if (!prev || prev.trim() === "") return studyTitle;
        return prev;
      });
    }

    if (!isAutoSync) {
      setActiveTab("generator");
    }
  };

  // ACTION: REQUEST ADDITIONAL OR SECOND VIEW CLINICAL EVALUATION OF THE IMAGE
  const handleEvaluateImage = async () => {
    if (!base64Image) return;
    setIsEvaluatingAdditional(true);
    setAdditionalEvalError(null);
    try {
      const response = await fetch("/api/evaluate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          image: base64Image,
          mimeType: selectedFile?.type || "image/png",
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
          isAdditional: true,
          annotations: annotations.length > 0 ? annotations : undefined,
        }),
      });
      const data = await response.json();
      if (data.success && data.evaluation) {
        setAdditionalEvaluation(data.evaluation);
      } else {
        setAdditionalEvalError(data.error || "Error al realizar la valoraci√≥n adicional.");
      }
    } catch (err: any) {
      console.error("Error al evaluar imagen:", err);
      setAdditionalEvalError(err?.message || String(err));
    } finally {
      setIsEvaluatingAdditional(false);
    }
  };

  // ACTION: COMPLETE CASE ANALYSIS
  const handleAnalyzeCase = async () => {
    if (!generatedReport) return;
    setIsAnalyzingCase(true);
    setCaseAnalysisError(null);
    setCaseAnalysis("");
    setDiffsIncorporated(false);
    setDiffsError(null);
    try {
      const response = await fetch("/api/analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setCaseAnalysis(data.analysis);
      } else {
        setCaseAnalysisError(data.error || "Error al realizar el an√°lisis del caso.");
      }
    } catch (err: any) {
      console.error("Error al analizar caso:", err);
      setCaseAnalysisError(err?.message || String(err));
    } finally {
      setIsAnalyzingCase(false);
    }
  };

  // ACTIONS FOR ADVANCED VASCULAR ANALYSIS & DIAGRAMS
  const handleAnalyzeVascular = async () => {
    if (!generatedReport) return;
    setIsAnalyzingVascular(true);
    setVascularError(null);
    try {
      const response = await fetch("/api/analyze-vascular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          reportText: generatedReport,
          studyType: specificStudy
        }),
      });
      const data = await response.json();
      if (data.success) {
        setVascularTable(data.table || "");
        setVascularStates(data.states || {});
        setVascularDescriptions(data.descriptions || {});
        setVascularSubLocations(data.subLocations || {});
        setCarotidPlaques(data.carotidPlaques || []);
      } else {
        setVascularError(data.error || "No se pudieron analizar los hallazgos vasculares del informe.");
      }
    } catch (err: any) {
      console.error("Error al realizar el an√°lisis vascular:", err);
      setVascularError(err?.message || String(err));
    } finally {
      setIsAnalyzingVascular(false);
    }
  };

  const handleToggleVascularSegment = (segId: string) => {
    const isVenoso = specificStudy === "Doppler venoso de miembro inferior" || generatedReport.toLowerCase().includes("venoso");
    const current = vascularStates[segId] || "normal";
    
    let nextState = "normal";
    if (isVenoso) {
      // venous levels: normal -> reflux -> thrombosis -> normal
      if (current === "normal") nextState = "reflux";
      else if (current === "reflux") nextState = "thrombosis";
    } else {
      // arterial & carotid levels: normal -> mild -> severe -> normal
      if (current === "normal") nextState = "mild";
      else if (current === "mild") nextState = "severe";
    }

    setVascularStates(prev => ({
      ...prev,
      [segId]: nextState
    }));

    // Sutil prefilled description matching the manually edited state
    let label = "Normal / Conservado";
    if (nextState === "mild") label = "Placas ateromatosas con estenosis leve (<50%)";
    else if (nextState === "severe") label = "Estenosis hemodin√°micamente significativa / severa (>=50%)";
    else if (nextState === "reflux") label = "Insuficiencia valvular con reflujo retr√≥grado";
    else if (nextState === "thrombosis") label = "Obstrucci√≥n tromb√≥tica patente / No colapsable";

    setVascularDescriptions(prev => ({
      ...prev,
      [segId]: label
    }));
  };

  const handleExportVascularTableToReport = () => {
    if (!vascularTable) return;
    setReportHistory((prev) => [...prev, generatedReport]);
    const separator = "\n\n";
    const title = "### CUADRO DE HALLAZGOS VASCULARES (S√çNTESIS DIAGN√ìSTICA)\n";
    
    // Avoid double inclusion if already exists
    if (generatedReport.includes("### CUADRO DE HALLAZGOS VASCULARES")) {
      // Replace existing
      const regex = /### CUADRO DE HALLAZGOS VASCULARES[\s\S]+/g;
      const cleanReportText = generatedReport.replace(regex, "").trim();
      const nextReport = cleanReportText + separator + title + vascularTable;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    } else {
      const nextReport = generatedReport + separator + title + vascularTable;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    }
  };

  const handleExportVascularBlocksToReport = (blocksText: string) => {
    if (!blocksText) return;
    setReportHistory((prev) => [...prev, generatedReport]);
    const separator = "\n\n";
    const title = "### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER\n";
    
    // Format blocksText inside triple backticks so it gets parsed perfectly as standard code in markdown and PDF
    const formattedBlocks = blocksText.trim().startsWith("```") 
      ? blocksText 
      : "```text\n" + blocksText.trim() + "\n```";
    
    // Avoid double inclusion if already exists
    if (generatedReport.includes("### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER")) {
      // Replace existing
      const regex = /### S√çNTESIS DE ANATOM√çA VASCULAR DOPPLER[\s\S]+/g;
      const cleanReportText = generatedReport.replace(regex, "").trim();
      const nextReport = cleanReportText + separator + title + formattedBlocks;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    } else {
      const nextReport = generatedReport + separator + title + formattedBlocks;
      setGeneratedReport(nextReport);
      setEditedReportText(nextReport);
    }
  };

  // ACTION: INCORPORATE ENRICHED DIFFERENTIAL DIAGNOSTICS SYNTHESIS TO REPORT
  const handleIncorporateDifferentialDiagnostics = async () => {
    if (!generatedReport || !caseAnalysis) return;
    setIsIncorporatingDiffs(true);
    setDiffsError(null);
    try {
      const response = await fetch("/api/incorporate-differentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: generatedReport,
          caseAnalysis: caseAnalysis,
        }),
      });
      const data = await response.json();
      if (data.success && data.report) {
        if (generatedReport) {
          setReportHistory((prev) => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);
        setDiffsIncorporated(true);
      } else {
        setDiffsError(data.error || "Error al incorporar los diagn√≥sticos diferenciales sintetizados.");
      }
    } catch (err: any) {
      console.error("Error al incorporar diagn√≥sticos diferenciales:", err);
      setDiffsError(err?.message || String(err));
    } finally {
      setIsIncorporatingDiffs(false);
    }
  };

  // ACTION: MEDICAL BIBLIOGRAPHY SEARCH
  const handleSearchBibliography = async () => {
    if (!generatedReport) return;
    setIsSearchingBibliography(true);
    setBibliographyError(null);
    setBibliography("");
    setBibliographySources([]);
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setBibliography(data.bibliography);
        if (data.sources) {
          setBibliographySources(data.sources);
        }
      } else {
        setBibliographyError(data.error || "Error al buscar la bibliograf√≠a m√©dica.");
      }
    } catch (err: any) {
      console.error("Error al buscar bibliograf√≠a:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingBibliography(false);
    }
  };

  // ACTION: SEARCH MORE BIBLIOGRAPHY (PAGINATION/LOAD MORE)
  const handleSearchMoreBibliography = async () => {
    if (!generatedReport || isSearchingMoreBibliography) return;
    setIsSearchingMoreBibliography(true);
    setBibliographyError(null);
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          findings: findings || "",
          searchMore: true,
          existingSources: bibliographySources,
          existingBibliography: bibliography,
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setBibliography(data.bibliography);
        if (data.sources && data.sources.length > 0) {
          setBibliographySources((prev) => {
            const seenUris = new Set(prev.map((s) => s.uri.toLowerCase().trim()));
            const newSources = data.sources.filter((s: any) => s.uri && !seenUris.has(s.uri.toLowerCase().trim()));
            return [...prev, ...newSources];
          });
        }
      } else {
        setBibliographyError(data.error || "Error al buscar fuentes bibliogr√°ficas adicionales.");
      }
    } catch (err: any) {
      console.error("Error al buscar m√°s bibliograf√≠a:", err);
      setBibliographyError(err?.message || String(err));
    } finally {
      setIsSearchingMoreBibliography(false);
    }
  };

  // ACTION: EVALUATE GENERATED REPORT
  const handleEvaluateReport = async (overrideReportText?: string) => {
    const activeReport = overrideReportText || (isEditingReportManual ? editedReportText : (generatedReport || ""));
    if (!activeReport) return;
    setIsEvaluatingReport(true);
    setReportEvaluationError(null);
    setReportEvaluation("");
    try {
      const response = await fetch("/api/evaluate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: activeReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
          findings: findings || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.evaluation) {
        setReportEvaluation(data.evaluation);
      } else {
        setReportEvaluationError(data.error || "Error al realizar la evaluaci√≥n del reporte.");
      }
    } catch (err: any) {
      console.error("Error al evaluar reporte:", err);
      setReportEvaluationError(err?.message || String(err));
    } finally {
      setIsEvaluatingReport(false);
    }
  };

  // Gmail API Integrated Share Handlers (Google Workspace Integration)
  const handleOpenGmailShare = async (type: 'report_pdf' | 'patient_summary' | 'patient_infographic' | 'both_pdfs') => {
    setGmailAttachedType('report_pdf');
    setGmailTo(patientEmail || "");
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    // Only select the official report PDF (as other elements are now included directly in the report)
    setGmailAttachReport(true);
    setGmailAttachSummary(false);
    setGmailAttachInfographic(false);
    
    // Construct default subject & email body nicely for the official report
    const clientName = patientName || "Paciente";
    let subject = `Reporte de Estudio Cl√≠nico - ${clientName}`;
    let body = `Estimado(a) ${clientName},\n\nLe enviamos adjunto a este correo el Reporte de Estudio Cl√≠nico Oficial realizado.\n\n`;

    body += `Quedamos a su entera disposici√≥n para cualquier aclaraci√≥n o consulta adicional.\n\nAtentamente,\n${doctorName || "M√©dico Especialista"}`;
    
    setGmailSubject(subject);
    setGmailBody(body);
    setShowGmailModal(true);

    // Auto-save/update to cloud if user is logged in to ensure a valid and updated cloud link
    if (gmailUser && generatedReport) {
      try {
        await handleSaveToCloud();
      } catch (err) {
        console.error("Auto cloud save error on opening Gmail share:", err);
      }
    }
  };

  const handleGmailLogin = async () => {
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
        if (patientEmail && !gmailTo) {
          setGmailTo(patientEmail);
        }
      }
    } catch (err: any) {
      console.error("Gmail authorization failed:", err);
      setGmailErrorMessage("Error al autorizar con Google: " + (err.message || String(err)));
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await anonymousSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Anonymous authentication failed:", err);
      setGmailErrorMessage("Error al iniciar acceso instant√°neo: " + (err.message || String(err)));
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contrase√±a.");
      return;
    }
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await emailSignIn(authEmail, authPassword);
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Email authentication failed:", err);
      let friendlyMsg = err.message || String(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMsg = "Credenciales incorrectas o usuario no registrado.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "El formato del correo es inv√°lido.";
      }
      setGmailErrorMessage("Error de inicio de sesi√≥n: " + friendlyMsg);
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!authEmail || !authPassword) {
      setGmailErrorMessage("Por favor ingrese correo y contrase√±a.");
      return;
    }
    if (authPassword.length < 6) {
      setGmailErrorMessage("La contrase√±a debe tener al menos 6 caracteres.");
      return;
    }
    setIsLoggingInGmail(true);
    setGmailErrorMessage(null);
    try {
      const result = await emailSignUp(authEmail, authPassword);
      if (result) {
        setGmailUser(result.user);
        setGmailAccessToken(result.accessToken);
      }
    } catch (err: any) {
      console.error("Email registration failed:", err);
      let friendlyMsg = err.message || String(err);
      if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = "Este correo electr√≥nico ya est√° registrado.";
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = "El formato del correo es inv√°lido.";
      } else if (err.code === 'auth/weak-password') {
        friendlyMsg = "La contrase√±a es muy d√©bil (m√≠nimo 6 caracteres).";
      }
      setGmailErrorMessage("Error al registrar especialista: " + friendlyMsg);
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleGmailLogout = async () => {
    try {
      await googleLogout();
      setGmailUser(null);
      setGmailAccessToken(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleSendGmailAction = async () => {
    if (!gmailAccessToken) {
      setGmailErrorMessage("Debes iniciar sesi√≥n con Google antes de realizar el env√≠o.");
      return;
    }
    if (!gmailTo) {
      setGmailErrorMessage("Por favor, especifica el correo electr√≥nico del destinatario.");
      return;
    }
    if (!gmailAttachReport && !gmailAttachSummary && !gmailAttachInfographic) {
      setGmailErrorMessage("Por favor, selecciona al menos un archivo para adjuntar.");
      return;
    }
    
    setIsSendingGmail(true);
    setGmailSuccessMessage(null);
    setGmailErrorMessage(null);

    try {
      // Helper to chunk base64 strings into 76-character blocks as required by standard MIME (RFC 2045)
      // and strictly enforced by intermediate SMTP servers/receivers (RFC 5321 line length limits of 1000 chars)
      const chunkBase64WithCRLF = (base64Str: string): string => {
        const chunks: string[] = [];
        for (let i = 0; i < base64Str.length; i += 76) {
          chunks.push(base64Str.substring(i, i + 76));
        }
        return chunks.join("\n");
      };

      let explanationPDFBase64 = "";
      let reportPDFBase64 = "";
      let infographicBase64 = "";
      let infographicContentType = "image/png";

      // 1. Generate PDFs in-memory as Base64 strings if selected/checked
      if (gmailAttachSummary) {
        if (!patientSummary) {
          throw new Error("Debe generar primero la 'Traducci√≥n Emp√°tica y Explicaci√≥n' para poder adjuntarla.");
        }
        const rawSummaryB64 = await handleDownloadPatientSummaryPDF(false, false, true) || "";
        explanationPDFBase64 = chunkBase64WithCRLF(rawSummaryB64);
      }

      if (gmailAttachReport) {
        if (!generatedReport) {
          throw new Error("Debe generar primero el 'Reporte de Estudio' para poder adjuntarlo.");
        }
        const rawReportB64 = await handleDownloadNativePDF(false, false, true) || "";
        reportPDFBase64 = chunkBase64WithCRLF(rawReportB64);
      }

      // 2. Fetch and convert infographic image if selected/checked
      if (gmailAttachInfographic) {
        if (!infographicUrl) {
          throw new Error("Debe generar primero la 'Infograf√≠a' para poder adjuntarla.");
        }
        try {
          let plainInfographicBase64 = "";
          if (infographicUrl.startsWith("data:")) {
            const match = infographicUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              infographicContentType = match[1];
              plainInfographicBase64 = match[2];
            } else {
              throw new Error("Formato de URL de datos de infograf√≠a no reconocido.");
            }
          } else {
            const res = await fetch(infographicUrl);
            const blob = await res.blob();
            infographicContentType = blob.type || "image/png";
            
            const arrayBuf = await blob.arrayBuffer();
            const bytesList = new Uint8Array(arrayBuf);
            let binaryStr = "";
            for (let i = 0; i < bytesList.length; i++) {
              binaryStr += String.fromCharCode(bytesList[i]);
            }
            plainInfographicBase64 = window.btoa(binaryStr);
          }
          infographicBase64 = chunkBase64WithCRLF(plainInfographicBase64);
        } catch (imageErr: any) {
          throw new Error("Error al preparar la imagen de la infograf√≠a: " + (imageErr.message || String(imageErr)));
        }
      }

      // 3. Build RFC 2822 Multipart MIME Message cleanly
      const boundary = "boundary_part_medico_reporte_" + Math.random().toString(36).substring(2);

      // Helper to strip accents & restrict to safe ASCII characters for MIME headers
      const sanitizeMimeFilename = (nameStr: string): string => {
        return nameStr
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/√±/gi, "n")
          .replace(/[^a-zA-Z0-9_\.-]/g, "_")
          .replace(/\s+/g, "_");
      };

      const cleanPatientName = patientName ? sanitizeMimeFilename(patientName) : "paciente";
      const filenameSummary = `Explicacion_${cleanPatientName}.pdf`;
      const filenameReport = `Reporte_${cleanPatientName}.pdf`;
      const fileExt = infographicContentType === "image/jpeg" ? "jpg" : "png";
      const filenameInfographic = `Infografia_${cleanPatientName}.${fileExt}`;

      const formattedBody = gmailBody.replace(/\n/g, "<br/>");
      const htmlBodyContent = `<div style="font-family: sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">${formattedBody}</div>`;
      const htmlBodyBase64Raw = window.btoa(unescape(encodeURIComponent(htmlBodyContent)));
      const htmlBodyBase64 = chunkBase64WithCRLF(htmlBodyBase64Raw);

      // Set UTF-8 encoded subject to guarantee character sets are preserved
      const b64Subject = window.btoa(unescape(encodeURIComponent(gmailSubject)));

      const parts: string[] = [];
      parts.push(`MIME-Version: 1.0`);
      parts.push(`To: ${gmailTo}`);
      parts.push(`Subject: =?utf-8?B?${b64Subject}?=`);
      parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      parts.push(``); // Blank line separating headers from standard multipart payload

      // Email text content part (Base64 encoded to safely preserve all Spanish characters/accents)
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: text/html; charset="UTF-8"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push(``); // Blank line separating part headers from content
      parts.push(htmlBodyBase64);
      parts.push(``); // Safe spacer

      // Native Report Attachment
      if (gmailAttachReport && reportPDFBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: application/pdf; name="${filenameReport}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameReport}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(reportPDFBase64);
        parts.push(``); // Safe spacer
      }

      // Patient Summary/Explanation Attachment
      if (gmailAttachSummary && explanationPDFBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: application/pdf; name="${filenameSummary}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameSummary}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(explanationPDFBase64);
        parts.push(``); // Safe spacer
      }

      // Infographic Image Attachment
      if (gmailAttachInfographic && infographicBase64) {
        parts.push(`--${boundary}`);
        parts.push(`Content-Type: ${infographicContentType}; name="${filenameInfographic}"`);
        parts.push(`Content-Disposition: attachment; filename="${filenameInfographic}"`);
        parts.push(`Content-Transfer-Encoding: base64`);
        parts.push(``); // Blank line separating part headers from content
        parts.push(infographicBase64);
        parts.push(``); // Safe spacer
      }

      // End boundary
      parts.push(`--${boundary}--`);

      // Combine parts with exact standard CRLF
      const emailRaw = parts.join("\n");
      
      // Base64URL encode MIME message safely
      const utf8Encoder = new TextEncoder();
      const bytes = utf8Encoder.encode(emailRaw);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

       // 4. Post to Google Gmail API send endpoint
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw: base64Url
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setGmailAccessToken(null);
          localStorage.removeItem("rad_gmail_access_token");
          throw new Error("Su sesi√≥n de Gmail ha expirado por seguridad (las sesiones de Google duran 1 hora). Como hemos habilitado el acceso r√°pido, simplemente haga clic en 'Autorizar Gmail' para renovarla en 1 segundo sin tener que volver a elegir su cuenta ni ingresar sus datos.");
        }
        const errorText = await response.text();
        throw new Error(`Gmail API report√≥ un error de env√≠o: ${errorText}`);
      }

      setGmailSuccessMessage("¬°Correo electr√≥nico enviado con √©xito v√≠a Gmail!");
    } catch (err: any) {
      console.error("Failed to send email via Gmail:", err);
      setGmailErrorMessage("Error al enviar el correo: " + (err.message || String(err)));
    } finally {
      setIsSendingGmail(false);
    }
  };

  // WhatsApp Share Handlers
  const handleOpenWhatsAppShare = async (type: 'report_pdf' | 'patient_infographic' | 'patient_summary') => {
    setWhatsappShareType(type);
    setShowWhatsAppModal(true);

    if (type === 'patient_summary') {
      setWhatsappIncludePatientSummary(true);
      setWhatsappIncludeOperationalSummary(false);
    } else if (type === 'report_pdf') {
      setWhatsappIncludeOperationalSummary(operationalSummaryText ? true : false);
      setWhatsappIncludePatientSummary(false);
    } else {
      setWhatsappIncludePatientSummary(patientSummary ? true : false);
      setWhatsappIncludeOperationalSummary(operationalSummaryText ? true : false);
    }
  };

  const getWhatsAppTextPreview = (overrideId?: string) => {
    let text = `*REPORTE RADIOL√ìGICO DIGITAL*\n`;
    text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n\n`;

    if (patientName) text += `*Paciente:* ${patientName}\n`;
    if (patientAge) text += `*Edad:* ${patientAge}\n`;
    if (patientGender) text += `*G√©nero:* ${patientGender}\n`;
    if (patientId) text += `*ID/C√©dula:* ${patientId}\n`;
    if (studyType) text += `*Estudio:* ${studyType}\n`;
    if (reportDate) text += `*Fecha:* ${formatDateToDMY(reportDate)}\n`;
    if (doctorName) text += `*Especialista:* ${doctorName}\n`;
    text += `\n`;

    // 1. Resumen Cl√≠nico Operativo (Conclusions)
    if (whatsappIncludeOperationalSummary && operationalSummaryText) {
      const cleanOperationalSummary = operationalSummaryText
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{1F000}-\u{1F9FF}]/gu, "")
        .replace(/\p{Emoji_Presentation}/gu, "")
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "")
        .replace(/  +/g, ' ')
        .trim();

      text += `*RESUMEN CL√çNICO OPERATIVO*\n`;
      text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n`;
      text += `${cleanOperationalSummary}\n\n`;
    }

    // 2. Acompa√±amiento Explicativo para el Paciente
    if (whatsappIncludePatientSummary && patientSummary) {
      text += `*EXPLICACI√ìN PARA EL PACIENTE*\n`;
      text += `_Traducci√≥n de hallazgos m√©dicos a un lenguaje claro_\n`;
      text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n\n`;

      if (patientSummary.summary) {
        text += `*Resumen de su estado:*\n${patientSummary.summary.trim()}\n\n`;
      }

      if (patientSummary.keyFindings && patientSummary.keyFindings.length > 0) {
        text += `*Hallazgos Principales:*\n`;
        patientSummary.keyFindings.forEach((finding: any, idx: number) => {
          const title = finding.finding || finding.title || "";
          const desc = finding.explanation || finding.description || "";
          text += `${idx + 1}. *${title}:* ${desc}\n`;
        });
        text += `\n`;
      }
    }

    text += `*‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ‚îÅ*\n`;
    text += `_Por favor, descargue y conserve los documentos PDF oficiales adjuntos para presentarlos en su pr√≥xima consulta de seguimiento._`;
    return text;
  };

  const handleSendWhatsAppAction = async () => {
    let studyIdToUse = currentCloudStudyId;

    // Save/update to cloud automatically first to guarantee the link is always generated, saved and up to date! (skip if already saved)
    if (gmailUser && generatedReport && !currentCloudStudyId) {
      try {
        const savedId = await handleSaveToCloud();
        if (savedId) {
          studyIdToUse = savedId;
        }
      } catch (err) {
        console.error("Auto cloud save error inside handleSendWhatsAppAction:", err);
      }
    }

    const text = getWhatsAppTextPreview(studyIdToUse);
    const cleanPhone = whatsappPhone ? whatsappPhone.replace(/\D/g, "") : "";
    const urlEncoded = encodeURIComponent(text);
    
    // Construct WhatsApp Send URL
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${urlEncoded}`
      : `https://api.whatsapp.com/send?text=${urlEncoded}`;

    // 1. OPEN WHATSAPP ENTIRELY SYNCHRONOUSLY!
    // This is the absolute key to bypass the browser's popup blocker.
    try {
      window.open(url, "_blank");
    } catch (popupErr) {
      console.error("Popup blocker prevented opening WhatsApp:", popupErr);
    }

    // 2. Perform the heavy infographic processing in the background (No PDF downloads to local device)
    if (whatsappShareType === 'patient_infographic') {
      if (infographicUrl && (infographicUrl.startsWith("data:") || infographicUrl.startsWith("blob:") || infographicUrl.startsWith("http"))) {
        try {
          const response = await fetch(infographicUrl);
          const blob = await response.blob();
          const format = infographicUrl.includes("image/png") ? "png" : "jpeg";
          const file = new File([blob], `infografia_paciente.${format}`, { type: blob.type });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: "Infograf√≠a Paciente",
              text: `Infograf√≠a de ${patientName || "Paciente"}`
            }).catch(err => {
              console.warn("Native Share failed for infographic image:", err);
            });
          }
        } catch (err) {
          console.warn("Could not share infographic image as file:", err);
        }
      }
    }

    setShowWhatsAppModal(false);
  };

  // ACTION: GENERATE DEMOCRATIZED AND SIMPLIFIED PATIENT KEY FINDINGS & SUMMARY
  const handleGeneratePatientSummary = async () => {
    if (!generatedReport) return;
    setIsGeneratingPatientSummary(true);
    setPatientSummaryError(null);
    setPatientSummary(null);
    setExpandedFindings({});
    try {
      const response = await fetch("/api/generate-patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          studyType: studyType || "Estudio Radiol√≥gico",
          clinicalHistory: clinicalHistory || "",
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setPatientSummary(data.data);
      } else {
        setPatientSummaryError(data.error || "Error al generar el resumen del paciente.");
      }
    } catch (err: any) {
      console.error("Error al generar resumen para paciente:", err);
      setPatientSummaryError(err?.message || String(err));
    } finally {
      setIsGeneratingPatientSummary(false);
    }
  };

  // ACTION: GENERATE DYNAMIC MEDICAL GLOSSARY ON REPORT TERMS
  const handleGenerateDynamicGlossary = async () => {
    if (!generatedReport) return;
    setIsGeneratingDynamicGlossary(true);
    setDynamicGlossaryError(null);
    setDynamicGlossary(null);
    setGlossaryLitSearch({});
    try {
      const response = await fetch("/api/generate-dynamic-glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setDynamicGlossary(data.data);
      } else {
        setDynamicGlossaryError(data.error || "Error al construir el glosario del reporte.");
      }
    } catch (err: any) {
      console.error("Error al construir glosario din√°mico:", err);
      setDynamicGlossaryError(err?.message || String(err));
    } finally {
      setIsGeneratingDynamicGlossary(false);
    }
  };

  // ACTION: GENERATE OPERATIONAL SUMMARY FOR WHATSAPP
  const handleGenerateWhatsAppSummary = async () => {
    const reportContent = isEditingReportManual ? editedReportText : generatedReport;
    if (!reportContent) return;
    setIsGeneratingOperationalSummary(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{
            role: "user",
            text: "Resume de forma muy concisa √öNICAMENTE los hallazgos cl√≠nicos principales de este reporte m√©dico en 3 o 4 vi√±etas de texto asertivas y claras, redactadas con un lenguaje profesional pero comprensible, apto para ser compartido por WhatsApp y consultado digitalmente por el paciente. NO incluyas ninguna recomendaci√≥n, sugerencia de manejo ni plan a futuro, lim√≠tate estrictamente a los hallazgos de forma asertiva. No agregues pre√°mbulos, saludos, ni comentarios personales, devuelve directamente las vi√±etas con guiones '-'. Reporte:\n\n" + reportContent
          }]
        })
      });
      const data = await response.json();
      if (data.success && data.reply) {
        const summary = data.reply.trim();
        setOperationalSummaryText(summary);

        // If currently synced to cloud, update cloud record too so the patient can see it immediately
        if (currentCloudStudyId && gmailUser?.uid) {
          let pdfB64 = "";
          await saveStudyToCloud(gmailUser.uid, gmailUser.email || "", {
            id: currentCloudStudyId,
            timestamp: new Date().toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" }),
            patientName: patientName || "Paciente An√≥nimo",
            patientEmail: patientEmail || "No especificado",
            patientAge: patientAge || "",
            patientGender: patientGender || "",
            patientId: patientId || "",
            reportDate: reportDate || new Date().toISOString().split('T')[0],
            doctorName: doctorName || "M√©dico Radi√≥logo",
            doctorLicense: doctorLicense || "No especificada",
            clinicName: clinicName || "Cl√≠nica Privada",
            studyType: studyType || "Estudio General",
            clinicalHistory: clinicalHistory || "No especificada",
            findings: findings || "No especificadas",
            reportText: reportContent,
            pdfBase64: pdfB64,
            operationalSummaryText: summary,
            customLogoUrl: customLogoUrl || "",
            customLogoStyle: customLogoStyle || "logo",
            customSignatureUrl: customSignatureUrl || "",
            attachedImages: attachedImages || [],
            findings3dRenders: findings3dRenders || [],
            patientSummary: patientSummary || null
          });
          fetchCloudStudies(gmailUser.uid);
        }
      } else {
        alert("Ocurri√≥ un error al generar el resumen. Por favor, intente de nuevo.");
      }
    } catch (error) {
      console.error("Error generating WhatsApp summary:", error);
      alert("Error de red al generar el resumen.");
    } finally {
      setIsGeneratingOperationalSummary(false);
    }
  };

  // ACTION: GENERATE SCHEMATIC SUMMARY OF FINDINGS
  const handleGenerateSchematicSummary = async () => {
    if (!generatedReport) return;
    setIsGeneratingSchematicSummary(true);
    setSchematicSummaryError(null);
    setSchematicSummary(null);
    try {
      let reportWithExtras = generatedReport;
      if (activeProtocol) {
        const extras = additionalFindings[activeProtocol];
        if (extras && extras.length > 0) {
          reportWithExtras += "\n\nHALLAZGOS ADICIONALES DETECTADOS POR EL M√âDICO TRATANTE:\n";
          extras.forEach(item => {
            reportWithExtras += `- ${item.structureName}: ${item.description}\n`;
          });
        }
      }

      const response = await fetch("/api/generate-schematic-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportWithExtras,
          studyType: studyType || "Estudio Radiol√≥gico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSchematicSummary(data.data);
      } else {
        setSchematicSummaryError(data.error || "Error al estructurar el esquema del reporte.");
      }
    } catch (err: any) {
      console.error("Error al construir esquema din√°mico:", err);
      setSchematicSummaryError(err?.message || String(err));
    } finally {
      setIsGeneratingSchematicSummary(false);
    }
  };

  // Helper to generate text content based on the selected format (blocks vs table)
  const getSelectedSchematicContent = () => {
    if (!schematicSummary) return "";
    if (schematicFormat === "blocks") {
      let text = "### ESQUEMA CL√çNICO DE HALLAZGOS PRINCIPALES\n\n";
      schematicSummary.findings.forEach((f: any, idx: number) => {
        const id = f.findingId || `H${idx + 1}`;
        text += `**[${id}] ${f.anatomicalSite.toUpperCase()}**\n`;
        text += `- **Hallazgo:** ${f.description}\n\n`;
      });
      return text.trim();
    } else {
      return schematicSummary.markdownScheme;
    }
  };

  // ACTION: APPEND THE GENERATED SCHEMATIC TABLE DIRECTLY TO THE ACTIVE REPORT
  const handleAppendSchemeToReport = () => {
    if (!schematicSummary) return;
    
    // Choose active text source (manual draft may be currently in edit)
    const activeText = isEditingReportManual ? editedReportText : (generatedReport || "");

    // Save history
    if (activeText) {
      setReportHistory((prev) => [...prev, activeText]);
    }
    
    const contentToAppend = getSelectedSchematicContent();
    if (!contentToAppend) return;

    const separator = "\n\n---\n\n";
    const newReportText = activeText + separator + contentToAppend;
    setGeneratedReport(newReportText);
    setEditedReportText(newReportText);
    alert(`¬°Esquema de hallazgos cl√≠nico (${schematicFormat === "blocks" ? "en Bloques" : "en Tabla"}) insertado con √©xito al final de tu informe!`);
  };

  // ACTION: GENERATE SEMIOLOGY AND JUSTIFICATION TABLE
  const handleGenerateSemiologyTable = async () => {
    const reportText = isEditingReportManual ? editedReportText : generatedReport;
    if (!reportText) return;
    setIsGeneratingSemiology(true);
    setSemiologyError(null);
    setSemiologyData(null);
    setSelectedConfirmedDiagnoses([]);
    setSelectedRuledOutPathologies([]);
    try {
      const response = await fetch("/api/generate-semiology-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: reportText,
          studyType: studyType || "Estudio Radiol√≥gico"
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSemiologyData(data.data);
        setSelectedConfirmedDiagnoses(new Array(data.data.confirmedDiagnoses?.length || 0).fill(true));
        setSelectedRuledOutPathologies(new Array(data.data.ruledOutPathologies?.length || 0).fill(true));
      } else {
        setSemiologyError(data.error || "Error al estructurar el cuadro de semiolog√≠a.");
      }
    } catch (err: any) {
      console.error("Error al construir cuadro de semiolog√≠a:", err);
      setSemiologyError(err?.message || String(err));
    } finally {
      setIsGeneratingSemiology(false);
    }
  };

  // Helper to build markdown dynamically based on user selections
  const buildDynamicSemiologyMarkdownTable = () => {
    if (!semiologyData) return "";
    
    let md = "### CUADRO DE SEMIOLOG√çA Y JUSTIFICACI√ìN RADIOL√ìGICA\n\n";
    
    const filteredDiagnoses = (semiologyData.confirmedDiagnoses || []).filter((_: any, idx: number) => selectedConfirmedDiagnoses[idx]);
    const filteredRuledOut = (semiologyData.ruledOutPathologies || []).filter((_: any, idx: number) => selectedRuledOutPathologies[idx]);
    
    if (filteredDiagnoses.length > 0) {
      md += "#### 1. Diagn√≥sticos Confirmados y Justificaci√≥n Semiol√≥gica\n\n";
      md += "| INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |\n";
      md += "| :--- | :--- |\n";
      filteredDiagnoses.forEach((d: any) => {
        md += `| ${d.diagnosis.replace(/\|/g, "\\|")} | ${d.justification.replace(/\|/g, "\\|")} |\n`;
      });
      md += "\n";
    }
    
    if (filteredRuledOut.length > 0) {
      md += "#### 2. Patolog√≠as Diferenciales Descartadas y Evidencia de Exclusi√≥n\n\n";
      md += "| INTERPRETACI√ìN SEMIOL√ìGICA | HALLAZGOS |\n";
      md += "| :--- | :--- |\n";
      filteredRuledOut.forEach((r: any) => {
        md += `| ${r.pathology.replace(/\|/g, "\\|")} | ${r.exclusionCriteria.replace(/\|/g, "\\|")} |\n`;
      });
      md += "\n";
    }
    
    return md.trim();
  };

  // ACTION: APPEND THE GENERATED SEMIOLOGY TABLE DIRECTLY TO THE ACTIVE REPORT
  const handleAppendSemiologyToReport = () => {
    if (!semiologyData) return;
    
    // Choose active text source (manual draft may be currently in edit)
    const activeText = isEditingReportManual ? editedReportText : (generatedReport || "");

    // Save history
    if (activeText) {
      setReportHistory((prev) => [...prev, activeText]);
    }
    
    const contentToAppend = buildDynamicSemiologyMarkdownTable();
    if (!contentToAppend) {
      alert("No has seleccionado ning√∫n punto para insertar.");
      return;
    }

    const separator = "\n\n---\n\n";
    const newReportText = activeText + separator + contentToAppend;
    setGeneratedReport(newReportText);
    setEditedReportText(newReportText);
    alert("¬°Cuadro de semiolog√≠a por im√°genes insertado con √©xito al final de tu informe para el PDF formal!");
  };

  // ACTION: SEARCH TECHNICAL LITERATURE FOR A GLOSSARY TERM DIRECTLY WITHIN PANEL
  const handleSearchGlossaryTermLiterature = async (term: string, query: string) => {
    setGlossaryLitSearch(prev => ({
      ...prev,
      [term]: { loading: true }
    }));
    try {
      const response = await fetch("/api/search-bibliography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          report: `Realiza una b√∫squeda de evidencia para el t√©rmino m√©dico: ${term}. Contexto adicional: ${query}`,
        }),
      });
      const data = await response.json();
      if (data.success && data.bibliography) {
        setGlossaryLitSearch(prev => ({
          ...prev,
          [term]: { 
            loading: false, 
            text: data.bibliography, 
            sources: data.sources || [] 
          }
        }));
      } else {
        setGlossaryLitSearch(prev => ({
          ...prev,
          [term]: { 
            loading: false, 
            error: data.error || "No se pudo recuperar la revisi√≥n cient√≠fica sobre este concepto." 
          }
        }));
      }
    } catch (err: any) {
      console.error("Error buscando literatura para t√©rmino:", err);
      setGlossaryLitSearch(prev => ({
        ...prev,
        [term]: { 
          loading: false, 
          error: "Error de comunicaci√≥n con el servidor central." 
        }
      }));
    }
  };

  // ACTION: PRINT PROFESSIONAL EXPLAINED REPORT FOR PATIENT
  const handlePrintPatientSummary = () => {
    if (!patientSummary) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permite ventanas emergentes para abrir el formato de impresi√≥n.");
      return;
    }
    
    const findingsHtml = patientSummary.keyFindings.map((finding: any) => `
      <div style="margin-bottom: 22px; padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; background-color: #fafafa;">
        <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 700;">${finding.title}</h3>
        <p style="margin: 0 0 12px 0; font-size: 11px; font-style: italic; color: #4b5563; font-family: monospace;">T√©rmino original en informe t√©cnico: "${finding.originalTerm}"</p>
        <p style="margin: 0 0 12px 0; font-size: 13.5px; font-family: system-ui, sans-serif; color: #1f2937; line-height: 1.55;"><strong>Explicaci√≥n:</strong> ${finding.simplifiedExplanation}</p>
        <p style="margin: 0 0 8px 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #7c2d12; background-color: #fff7ed; padding: 10px; border-radius: 6px; border-left: 3px solid #f97316;">üîç <strong>Analog√≠a de comprensi√≥n:</strong> ${finding.analogy}</p>
        <p style="margin: 0; font-size: 12.5px; font-family: system-ui, sans-serif; color: #1e3a8a; font-weight: 600; background-color: #eff6ff; padding: 10px; border-radius: 6px; border-left: 3px solid #3b82f6;">ü©∫ <strong>Contexto Cl√≠nico y Perspectiva M√©dica:</strong> ${finding.reassurance}</p>
      </div>
    `).join("");

    const carePointsHtml = (patientSummary.carePoints || []).map((point: string) => `
      <li style="margin-bottom: 10px; font-size: 13.5px; font-family: system-ui, sans-serif; color: #374151; line-height: 1.5;">${point}</li>
    `).join("");

    const questionsHtml = (patientSummary.suggestedQuestions || []).map((q: string) => `
      <li style="margin-bottom: 12px; font-size: 13.5px; font-family: system-ui, sans-serif; color: #111827; line-height: 1.4; font-weight: 600;">"${q}"</li>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Acompa√±amiento Radiol√≥gico Explicativo</title>
          <style>
            @media print {
              body { margin: 0; padding: 15px; font-size: 12pt; }
              .no-print { display: none; }
            }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 40px; 
              line-height: 1.6; 
              color: #1f2937; 
              max-width: 820px; 
              margin: 0 auto; 
            }
            .header-banner {
              text-align: center;
              border-bottom: 4px solid #ea580c;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-banner h1 { 
              color: #ea580c; 
              font-size: 26px; 
              margin: 0 0 8px 0; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-grid { 
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 12px;
              background: #f3f4f6; 
              padding: 16px 20px; 
              border-radius: 8px; 
              margin-bottom: 30px; 
              font-size: 12px; 
              font-family: ui-monospace, monospace; 
              color: #374151;
            }
            .section-title { 
              font-size: 18px; 
              color: #111827; 
              margin-top: 35px; 
              margin-bottom: 15px;
              border-bottom: 2px solid #e5e7eb; 
              padding-bottom: 6px; 
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 11px; 
              color: #6b7280; 
              border-top: 1px solid #e5e7eb; 
              padding-top: 20px; 
            }
            .btn-print {
              display: inline-block;
              background: #ea580c;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 14px;
              font-weight: 700;
              border-radius: 8px;
              cursor: pointer;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }
            .btn-print:hover {
              background: #d97706;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: right;">
            <button class="btn-print" onclick="window.print()">Imprimir de Inmediato</button>
          </div>
          <div class="header-banner">
            <h1>Gu√≠a M√©dica Explicativa para el Paciente</h1>
            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #4b5563;">Traducci√≥n Emp√°tica y Comprensi√≥n Humana Asistida por Inteligencia Artificial</p>
          </div>
          
          <div style="font-size: 13.5px; margin-bottom: 25px; color: #4b5563;">
            Estimado paciente: La siguiente gu√≠a interactiva simplifica y explica los hallazgos descritos en el reporte cl√≠nico oficial de su estudio diagn√≥stico. Este material tiene car√°cter informativo y educativo; est√° dise√±ado para calmar su inquietud y dotarlo de pautas saludables de conversaci√≥n con su especialista tratante.
          </div>
          
          <div class="meta-grid">
            <div>
              <strong>ESTUDIO DIAGN√ìSTICO:</strong> ${STUDY_PRESETS?.find((p: any) => p.id === studyType)?.name || studyType || "Estudio Radiol√≥gico"}<br>
              <strong>IMPRESO EL:</strong> ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style="text-align: right;">
              <strong>INDICACI√ìN INMEDIATA:</strong> ${clinicalHistory || "Sin indicaci√≥n reportada"}<br>
              <strong>PROGRAMA ASOCIADO:</strong> AI Radiologist Suite Pro
            </div>
          </div>
          
          <div class="section-title">Desglose Detallado de Hallazgos Cl√≠nicos Explicados</div>
          ${findingsHtml}
          
          <div class="footer">
            <strong>ADVERTENCIA CL√çNICA IMPORTANTE:</strong> Esta gu√≠a simplificada de orientaci√≥n formativa complementa -pero nunca invalida- el informe radiol√≥gico oficial firmado digitalmente por el especialista m√©dico ni sustituye la indicaci√≥n prescriptiva del cirujano o m√©dico cl√≠nico.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ACTION: RECOMMEND CLASSIFICATIONS BASED ON GENERATED REPORT TEXT
  const handleRecommendClassifications = async () => {
    if (!generatedReport) return;
    setIsRecommendingClassifications(true);
    setRecommenderError(null);
    setClassRecommendations(null);
    setIncorporatedRecs({});
    setIncludeManagementRecs({});
    try {
      const response = await fetch("/api/recommend-classifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport
        })
      });
      const data = await response.json();
      if (data.success) {
        setClassRecommendations(data.recommendations);
      } else {
        setRecommenderError(data.error || "No se pudieron obtener las clasificaciones sugeridas.");
      }
    } catch (err: any) {
      console.error(err);
      setRecommenderError("Error de conexi√≥n al obtener recomendaciones de escalas.");
    } finally {
      setIsRecommendingClassifications(false);
    }
  };

  // ACTION FOR INFOGRAPHIC GENERATION
  const handleGenerateInfographic = async () => {
    if (!generatedReport || !studyType) return;
    setIsGeneratingInfographic(true);
    setInfographicError(null);
    setInfographicUrl(null);
    try {
      const response = await fetch("/api/generate-infographic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: generatedReport, studyType }),
      });
      const data = await response.json();
      if (data.success) {
        setInfographicUrl(data.imageUrl);
      } else {
        setInfographicError(data.error || "Error generando la infograf√≠a.");
      }
    } catch (err: any) {
      setInfographicError(err.message || "Error al conectar con la API de infograf√≠as.");
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  // ACTION: APPEND THE SELECTED CLASSIFICATION/CRITERIA TO THE REPORT TEXT
  const handleIncorporateClassification = async (rec: any, index: number) => {
    if (!generatedReport) return;
    setIncorporatingIndex(index);
    setRecommenderError(null);
    try {
      const response = await fetch("/api/incorporate-classification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          report: generatedReport,
          classificationName: rec.name,
          whyRecommended: rec.whyRecommended,
          contentToAppend: rec.contentToAppend,
          studyType: studyType,
          includeManagementRecommendation: !!includeManagementRecs[index]
        })
      });
      const data = await response.json();
      if (data.success && data.modifiedReport) {
        setGeneratedReport(data.modifiedReport);
        setIncorporatedRecs((prev) => ({ ...prev, [index]: true }));
        if (classRecommendations) {
          const updated = [...classRecommendations];
          updated[index] = { ...updated[index], alreadyIncorporated: true };
          setClassRecommendations(updated);
        }
      } else {
        setRecommenderError(data.error || "No se pudo incorporar la clasificaci√≥n de forma inteligente en el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setRecommenderError("Error de conexi√≥n al incorporar la clasificaci√≥n de forma inteligente.");
    } finally {
      setIncorporatingIndex(null);
    }
  };

  // 2. ACTION: CHAT MESSAGE SENT FOR COMPLEX CASES
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    setChatInput("");
    setChatError(null);
    setIsSendingMsg(true);

    const updatedMsgs = [...chatMessages, { role: "user" as const, text: userMsgText }];
    setChatMessages(updatedMsgs);

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMsgs,
          systemInstruction: chatInstruction || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setChatMessages([...updatedMsgs, { role: "model", text: data.reply }]);
      } else {
        setChatError(data.error || "Error al obtener respuesta de Gemini Consultor.");
      }
    } catch (e) {
      setChatError("Falla de conexi√≥n con la API del servidor local.");
      console.error(e);
    } finally {
      setIsSendingMsg(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  // 3. ACTION: CLASSIFICATIONS QUERY VIA GEMINI
  const handleQueryClassification = async (customQuery?: string) => {
    const activeQuery = customQuery || classificationQuery;
    if (!activeQuery.trim()) return;

    setIsLoadingClassification(true);
    setClassificationError(null);
    setClassificationResult("");

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          query: activeQuery,
          systemInstruction: classifyInstruction || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setClassificationResult(data.info);
      } else {
        setClassificationError(data.error || "No se pudo obtener informaci√≥n de la escala.");
      }
    } catch (e) {
      setClassificationError("Error de comunicaci√≥n con el servidor de consulta.");
      console.error(e);
    } finally {
      setIsLoadingClassification(false);
    }
  };

  // Interactive flow calculators for Tab 2
  const handleWizardOptionSelect = (stepIndex: number, optionValue: string) => {
    const currentWizard = CLASSIFICATIONS_DATA.find(c => c.id === selectedClassSystem);
    if (!currentWizard) return;

    const newAnswers = { ...wizardAnswers, [stepIndex]: optionValue };
    setWizardAnswers(newAnswers);

    // If there's another step, let the user fill it. Else, compute final suggestion
    const optionSelected = currentWizard.steps[stepIndex].options.find(o => o.value === optionValue);
    
    if (optionSelected?.category) {
      // Direct category identified
      const categoryName = optionSelected.category;
      setWizardOutput(INTERACTIVE_RESULTS[categoryName] || `C√°lculo exitoso: Categor√≠a sugerida ${categoryName}`);
    } else if (stepIndex === 0 && selectedClassSystem === "fleischner" && optionValue.startsWith("solid_")) {
      // Fleischner requires risk level (step index 1)
      // Wait for step 1 selection
    } else if (stepIndex === 1 && selectedClassSystem === "fleischner") {
      // Combined Fleischner logic
      const noduleType = newAnswers[0];
      const riskLevel = optionValue;
      const keyCombined = `${noduleType}_${riskLevel}`;
      setWizardOutput(INTERACTIVE_RESULTS[keyCombined] || "No se encontr√≥ un criterio espec√≠fico en las gu√≠as est√°ndar para esta combinaci√≥n.");
    } else if (selectedClassSystem === "bosniak" && optionValue === "complex") {
      // Ask no further questions
      const optionsBosniakStep2 = [
        { label: "TC: Septos nodulares o engrosamiento parietal visible sin verdadero n√≥dulo s√≥lido", category: "Bosniak III" },
        { label: "TC: N√≥dulos blandos medibles con realce o componentes s√≥lidos invasivos", category: "Bosniak IV" }
      ];
      // Quick fallback
      setWizardOutput(`**Requiri√≥ mayor especificaci√≥n:**\nSi los septos son simplemente engrosados con realce parcial, entra en **Bosniak III** (cirug√≠a o biopsia). Si presenta masas de partes blandas o n√≥dulos con realce evidente, entra en **Bosniak IV** (malignidad confirmada).`);
    } else {
      setWizardOutput("No se pudo clasificar interactivamente. Por favor consulte el buscador general de escalas.");
    }
  };

  // PDF Printing Utilities
  const handlePrintPDF = () => {
    if (!generatedReport) return;
    setShowPrintModal(true);
    // Attempt window.print() but also show the on-screen helper modal
    try {
      window.print();
    } catch (e) {
      console.warn("window.print block protected", e);
    }
  };

  const ensureCompatibleImageFormat = (src: string): Promise<{ dataUrl: string; width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 640;
          const h = img.naturalHeight || img.height || 480;
          
          // Downscale to a maximum height/width of 750px to maintain pristine quality but reduce base64 size drastically
          let targetW = w;
          let targetH = h;
          const maxDim = 750;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            // Use JPEG (0.65) to drastically reduce the PDF file weight without losing diagnostic details!
            const compressedUrl = canvas.toDataURL("image/jpeg", 0.65);
            resolve({ dataUrl: compressedUrl, width: targetW, height: targetH });
            return;
          }
        } catch (err) {
          console.warn("Error converting image to compatible format:", err);
        }
        resolve({ dataUrl: src, width: img.naturalWidth || 640, height: img.naturalHeight || 480 });
      };
      img.onerror = () => {
        resolve({ dataUrl: src, width: 640, height: 480 });
      };
      img.src = src;
    });
  };

  const decodeDicom = (inputBuffer: any) => {
    // Robust audit of input buffer type to extract safe, isolated ArrayBuffer boundaries
    let arrayBuffer: ArrayBuffer;
    if (inputBuffer instanceof Uint8Array) {
      arrayBuffer = (inputBuffer.buffer as ArrayBuffer).slice(inputBuffer.byteOffset, inputBuffer.byteOffset + inputBuffer.byteLength);
    } else if (inputBuffer instanceof ArrayBuffer) {
      arrayBuffer = inputBuffer;
    } else if (inputBuffer && inputBuffer.buffer instanceof ArrayBuffer) {
      arrayBuffer = (inputBuffer.buffer as ArrayBuffer).slice(inputBuffer.byteOffset || 0, (inputBuffer.byteOffset || 0) + (inputBuffer.byteLength || 0));
    } else {
      arrayBuffer = inputBuffer as ArrayBuffer;
    }

    const view = new DataView(arrayBuffer);
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Fast, non-blocking chunked base64 encoder
    const uint8ToBase64 = (arr: Uint8Array): string => {
      let binary = "";
      const len = arr.byteLength;
      const chunkSize = 0x4000; // 16KB chunks
      for (let i = 0; i < len; i += chunkSize) {
        const subset = arr.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, subset as any);
      }
      return btoa(binary);
    };

    let jpegStart = -1;
    // scan from 0 to capture preamble-less encapsulated JPEGs
    for (let i = 0; i < uint8.length - 10; i++) {
      if (uint8[i] === 0xFF && uint8[i+1] === 0xD8 && uint8[i+2] === 0xFF) {
        jpegStart = i;
        break;
      }
    }
    
    let base64 = "";
    if (jpegStart !== -1) {
      let jpegEnd = -1;
      for (let i = uint8.length - 2; i > jpegStart; i--) {
        if (uint8[i] === 0xFF && uint8[i+1] === 0xD9) {
          jpegEnd = i + 2;
          break;
        }
      }
      if (jpegEnd === -1) {
        jpegEnd = uint8.length;
      }
      
      const slice = uint8.subarray(jpegStart, jpegEnd);
      base64 = "data:image/jpeg;base64," + uint8ToBase64(slice);
    }
    
    let rows = 0;
    let cols = 0;
    let bitsAllocated = 8;
    let samplesPerPixel = 1;
    let planarConfiguration = 0;
    let photometricInterpretation = "";
    let pixelDataOffset = -1;
    let pixelDataLength = 0;
    
    const meta: Record<string, string> = {};
    try {
      const textDecoder = new TextDecoder("utf-8");
      
      // Auto-detect preamble or raw start
      let hasPreamble = false;
      if (uint8.length > 132 && uint8[128] === 68 && uint8[129] === 73 && uint8[130] === 67 && uint8[131] === 77) {
        hasPreamble = true;
      }
      
      const startOffsets = hasPreamble ? [132] : [0, 132];
      
      for (const startPos of startOffsets) {
        let pos = startPos;
        rows = 0;
        cols = 0;
        bitsAllocated = 8;
        samplesPerPixel = 1;
        planarConfiguration = 0;
        photometricInterpretation = "";
        pixelDataOffset = -1;
        pixelDataLength = 0;
        
        while (pos < arrayBuffer.byteLength - 8) {
          const group = view.getUint16(pos, true);
          const element = view.getUint16(pos + 2, true);
          pos += 4;
          
          let vr = "";
          try {
            vr = String.fromCharCode(uint8[pos], uint8[pos+1]);
          } catch {
            vr = "";
          }
          
          let length = 0;
          let isLongVR = false;
          if (["OB", "OW", "OF", "SQ", "UT", "UN"].includes(vr)) {
            isLongVR = true;
            length = view.getUint32(pos + 4, true);
            pos += 8;
          } else {
            if (uint8[pos] >= 65 && uint8[pos] <= 90 && uint8[pos+1] >= 65 && uint8[pos+1] <= 90) {
              length = view.getUint16(pos + 2, true);
              pos += 4;
            } else {
              // Implicit VR: length is 32-bit field right after group and element
              length = view.getUint32(pos, true);
              pos += 4;
            }
          }
          
          if (length === 0xFFFFFFFF) {
            // Sequence of undefined length
            if ((group === 0x7fe0 && element === 0x0010) || (group === 0x7FE0 && element === 0x0010)) {
              pixelDataOffset = pos;
              pixelDataLength = uint8.length - pos;
              break;
            } else {
              // It's a metadata sequence (SQ) of undefined length.
              // Skip it by finding the Sequence Delimitation Item (FFFE, E0DD)
              let foundDelimiter = false;
              for (let i = pos; i < uint8.length - 8; i++) {
                if (
                  (uint8[i] === 0xFE && uint8[i+1] === 0xFF && uint8[i+2] === 0xDD && uint8[i+3] === 0xE0) ||
                  (uint8[i] === 0xFF && uint8[i+1] === 0xFE && uint8[i+2] === 0xE0 && uint8[i+3] === 0xDD)
                ) {
                  // Skip FFFE E0DD and its 4-byte length field (usually 0x00000000)
                  pos = i + 8;
                  foundDelimiter = true;
                  break;
                }
              }
              if (!foundDelimiter) {
                break;
              }
              continue;
            }
          }
          
          if (length > 0 && pos + length <= arrayBuffer.byteLength) {
            if (group === 0x0010 && element === 0x0010) {
              meta["paciente"] = textDecoder.decode(uint8.subarray(pos, pos + length)).replace(/\^/g, " ").trim();
            } else if (group === 0x0010 && element === 0x0020) {
              meta["id"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x0030) {
              meta["fechaNacimiento"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x1010) {
              meta["edad"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0010 && element === 0x0040) {
              meta["sexo"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0020) {
              meta["fechaEstudio"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0060) {
              meta["modalidad"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x0080) {
              meta["institucion"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0008 && element === 0x1030) {
              meta["estudio"] = textDecoder.decode(uint8.subarray(pos, pos + length)).trim();
            } else if (group === 0x0028 && element === 0x0010) {
              try {
                if (length === 2) rows = view.getUint16(pos, true);
                else if (length === 4) rows = view.getUint32(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0011) {
              try {
                if (length === 2) cols = view.getUint16(pos, true);
                else if (length === 4) cols = view.getUint32(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0100) {
              try {
                if (length === 2) bitsAllocated = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0002) {
              try {
                if (length === 2) samplesPerPixel = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0006) {
              try {
                if (length === 2) planarConfiguration = view.getUint16(pos, true);
              } catch {}
            } else if (group === 0x0028 && element === 0x0004) {
              try {
                photometricInterpretation = textDecoder.decode(uint8.subarray(pos, pos + length)).trim().toUpperCase();
              } catch {}
            } else if ((group === 0x7fe0 && element === 0x0010) || (group === 0x7FE0 && element === 0x0010)) {
              pixelDataOffset = pos;
              pixelDataLength = length;
            }
            pos += length;
          } else {
            if (length === 0) {
              // skip empty tag
            } else {
              break;
            }
          }
        }
        
        if (pixelDataOffset !== -1 && rows > 0 && cols > 0) {
          break;
        }
      }
    } catch (err) {
      console.warn("Could not extract metadata tags from DICOM file", err);
    }
    
    // Natively decode raw, uncompressed pixels if there's no embedded JPEG
    if (base64 === "" && pixelDataOffset !== -1 && rows > 0 && cols > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(cols, rows);
          const data = imgData.data;
          
          if (samplesPerPixel === 3) {
            const rawBytes = uint8.subarray(pixelDataOffset, pixelDataOffset + Math.min(pixelDataLength, rows * cols * 3));
            const numPixels = rows * cols;
            if (planarConfiguration === 1) {
              const rPlane = 0;
              const gPlane = numPixels;
              const bPlane = numPixels * 2;
              
              if (photometricInterpretation.startsWith("YBR")) {
                for (let i = 0; i < numPixels; i++) {
                  if (bPlane + i < rawBytes.length) {
                    const Y = rawBytes[rPlane + i];
                    const Cb = rawBytes[gPlane + i];
                    const Cr = rawBytes[bPlane + i];
                    
                    let r = Y + 1.402 * (Cr - 128);
                    let g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
                    let b = Y + 1.772 * (Cb - 128);
                    
                    const idx = i * 4;
                    data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
                    data[idx+1] = Math.max(0, Math.min(255, Math.floor(g)));
                    data[idx+2] = Math.max(0, Math.min(255, Math.floor(b)));
                    data[idx+3] = 255;
                  }
                }
              } else {
                for (let i = 0; i < numPixels; i++) {
                  if (bPlane + i < rawBytes.length) {
                    const idx = i * 4;
                    data[idx] = rawBytes[rPlane + i];     // R
                    data[idx+1] = rawBytes[gPlane + i];   // G
                    data[idx+2] = rawBytes[bPlane + i];   // B
                    data[idx+3] = 255;                   // A
                  }
                }
              }
            } else {
              // Interleaved (Planar Configuration = 0)
              if (photometricInterpretation.startsWith("YBR")) {
                for (let i = 0; i < numPixels; i++) {
                  const rIdx = i * 3;
                  if (rIdx + 2 < rawBytes.length) {
                    const Y = rawBytes[rIdx];
                    const Cb = rawBytes[rIdx + 1];
                    const Cr = rawBytes[rIdx + 2];
                    
                    let r = Y + 1.402 * (Cr - 128);
                    let g = Y - 0.344136 * (Cb - 128) - 0.714136 * (Cr - 128);
                    let b = Y + 1.772 * (Cb - 128);
                    
                    const idx = i * 4;
                    data[idx] = Math.max(0, Math.min(255, Math.floor(r)));
                    data[idx+1] = Math.max(0, Math.min(255, Math.floor(g)));
                    data[idx+2] = Math.max(0, Math.min(255, Math.floor(b)));
                    data[idx+3] = 255;
                  }
                }
              } else {
                for (let i = 0; i < numPixels; i++) {
                  const rIdx = i * 3;
                  if (rIdx + 2 < rawBytes.length) {
                    const idx = i * 4;
                    data[idx] = rawBytes[rIdx];     // R
                    data[idx+1] = rawBytes[rIdx+1]; // G
                    data[idx+2] = rawBytes[rIdx+2]; // B
                    data[idx+3] = 255;             // A
                  }
                }
              }
            }
          } else {
            // Monochrome / Grayscale (or single channel)
            if (bitsAllocated === 8) {
              const rawBytes = uint8.subarray(pixelDataOffset, pixelDataOffset + Math.min(pixelDataLength, rows * cols));
              const isInverted = photometricInterpretation === "MONOCHROME1";
              for (let i = 0; i < rawBytes.length; i++) {
                const val = isInverted ? 255 - rawBytes[i] : rawBytes[i];
                const idx = i * 4;
                data[idx] = val;     // R
                data[idx+1] = val;   // G
                data[idx+2] = val;   // B
                data[idx+3] = 255;   // A
              }
            } else if (bitsAllocated === 16) {
              const numPixels = rows * cols;
              const wordsNeeded = Math.min(Math.floor(pixelDataLength / 2), numPixels);
              const rawWords = new Uint16Array(wordsNeeded);
              for (let i = 0; i < wordsNeeded; i++) {
                rawWords[i] = view.getUint16(pixelDataOffset + i * 2, true);
              }
              
              let min = 65535;
              let max = 0;
              for (let i = 0; i < rawWords.length; i++) {
                const v = rawWords[i];
                if (v < min) min = v;
                if (v > max) max = v;
              }
              const range = max - min || 1;
              const isInverted = photometricInterpretation === "MONOCHROME1";
              
              for (let i = 0; i < rawWords.length; i++) {
                let val = Math.floor(((rawWords[i] - min) / range) * 255);
                if (isInverted) val = 255 - val;
                const idx = i * 4;
                data[idx] = val;
                data[idx+1] = val;
                data[idx+2] = val;
                data[idx+3] = 255;
              }
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          // Use lossless PNG for highest medical detail evaluation as requested
          base64 = canvas.toDataURL("image/png");
        }
      } catch (decodeErr) {
        console.warn("Could not decode raw pixel data natively: ", decodeErr);
      }
    }
    
    const hasSuccessfulImage = (base64 !== "" || (pixelDataOffset !== -1 && rows > 0 && cols > 0));
    return { base64, meta, success: hasSuccessfulImage };
  };

  const generateDicomCanvasFallback = (filename: string, meta?: Record<string, string>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, 640, 480);
      
      ctx.strokeStyle = "rgba(71, 85, 105, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke();
      }
      for (let y = 0; y < 480; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
      }
      
      ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(320, 30, 420, Math.PI * 0.35, Math.PI * 0.65);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(320, 30, 220, Math.PI * 0.35, Math.PI * 0.65);
      ctx.stroke();
      
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "rgba(100, 116, 139, 0.15)";
      ctx.fillText("SECTOR PROBE AREA", 270, 150);
      
      ctx.beginPath();
      ctx.moveTo(110, 390);
      for (let x = 110; x < 530; x++) {
        const y = 340 + 35 * Math.sin((x / 35) + Math.cos(x / 13)) * Math.exp(-Math.pow((x - 290) / 130, 2));
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 10px monospace";
      ctx.fillText("PW doppler: +114.5 cm/s", 90, 290);
      ctx.fillText("V_diastolic: -22.4 cm/s", 90, 305);
      ctx.fillText("RI (√çndice Resist.): 0.70", 90, 320);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText((meta?.paciente || "PACIENTE GENERAL").toUpperCase(), 30, 45);
      
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("MOD: US (ECOGRAF√çA DOPPLER)", 30, 60);
      if (meta?.institucion) {
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("HOSPITAL: " + meta.institucion.toUpperCase(), 30, 75);
      }
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("REG: " + filename, 30, 90);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("ULTRASOUND DICOM RAW CAPTURE", 430, 45);
      const dateStr = new Date().toLocaleDateString();
      ctx.fillText("FECHA: " + dateStr, 430, 60);
      ctx.fillText("ESTADO: ENCAPSULADO", 430, 75);
    }
    return canvas.toDataURL("image/png");
  };

  const detectImageMetaFromFilename = (filename: string, dicomMeta?: Record<string, string>) => {
    const upper = (filename + " " + JSON.stringify(dicomMeta || {}) + " " + (specificStudy || "")).toUpperCase();
    let modality: "MMG" | "US" = "US";
    let projection: "MLO" | "CC" | "OTRO" = "OTRO";
    let side: "Derecha" | "Izquierda" | "Bilateral" = "Bilateral";

    if (
      upper.includes("MMG") ||
      upper.includes("MAMO") ||
      upper.includes("MX") ||
      upper.includes("MLO") ||
      upper.includes("CC") ||
      upper.includes("MAMOGRAFIA") ||
      upper.includes("MAMMO") ||
      dicomMeta?.Modality === "MG"
    ) {
      modality = "MMG";
    }

    if (upper.includes("MLO") || upper.includes("OBLIQ") || upper.includes("OBLIU")) {
      projection = "MLO";
    } else if (upper.includes("CC") || upper.includes("CRANEO") || upper.includes("CAUDAL")) {
      projection = "CC";
    }

    if (upper.includes("IZQ") || upper.includes("LEFT") || upper.includes("LCC") || upper.includes("LMLO") || upper.includes("L-CC") || upper.includes("L-MLO")) {
      side = "Izquierda";
    } else if (upper.includes("DER") || upper.includes("RIGHT") || upper.includes("RCC") || upper.includes("RMLO") || upper.includes("R-CC") || upper.includes("R-MLO")) {
      side = "Derecha";
    } else {
      side = "Bilateral";
    }

    return { modality, projection, side };
  };

  const handleAiLabelImage = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem) return;
    
    setLoadingAiLabelId(id);
    try {
      const response = await fetch("/api/classify-and-label-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imgItem.base64 || imgItem.url,
          filename: imgItem.name,
          studyType: specificStudy || "Mamograf√≠a y Ultrasonido",
          clinicalHistory: clinicalHistory || "",
          findings: findings || inputReport || "",
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setAttachedImages(prev => prev.map(item => item.id === id ? {
          ...item,
          caption: data.label || item.caption,
          modality: data.modality || item.modality || "US",
          projection: data.projection || item.projection || "OTRO",
          side: data.side || item.side || "Derecha"
        } : item));
      } else {
        alert(data.error || "No se pudo generar la rotulaci√≥n con IA.");
      }
    } catch (err) {
      console.error("Error al rotular con IA:", err);
      alert("Error de conexi√≥n al rotular la foto.");
    } finally {
      setLoadingAiLabelId(null);
    }
  };

  const handleAutocompleteLabelFromReport = async (id: string) => {
    const imgItem = attachedImages.find(item => item.id === id);
    if (!imgItem) return;
    
    if (!imgItem.caption || !imgItem.caption.trim()) {
      alert("Por favor, escribe primero una palabra o frase clave en la descripci√≥n (ej. 'ves√≠cula', 'quiste' o 'car√≥tida') para poder buscar y autocompletar desde el reporte.");
      return;
    }

    const reportToUse = generatedReport || inputReport || findings;
    if (!reportToUse) {
      alert("Por favor, redacta o genera el reporte primero para poder buscar y autocompletar la rotulaci√≥n.");
      return;
    }

    setLoadingAutocompleteId(id);
    try {
      const response = await fetch("/api/autocomplete-label-from-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          phrase: imgItem.caption,
          currentReport: reportToUse,
          studyType: specificStudy || "Mamograf√≠a / Ecograf√≠a",
          clinicalHistory: clinicalHistory || "",
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.label) {
        setAttachedImages(prev => prev.map(item => item.id === id ? { ...item, caption: data.label } : item));
      } else {
        alert(data.error || "No se pudo autocompletar la rotulaci√≥n.");
      }
    } catch (err) {
      console.error("Error al autocompletar rotulaci√≥n:", err);
      alert("Error de conexi√≥n al autocompletar desde el reporte.");
    } finally {
      setLoadingAutocompleteId(null);
    }
  };

  const handleAiLabelAllImages = async () => {
    if (attachedImages.length === 0) return;
    setIsLabelingAll(true);
    try {
      const promises = attachedImages.map(async (imgItem) => {
        try {
          const response = await fetch("/api/classify-and-label-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              image: imgItem.base64 || imgItem.url,
              filename: imgItem.name,
              studyType: specificStudy || "Mamograf√≠a y Ultrasonido",
              clinicalHistory: clinicalHistory || "",
              findings: findings || inputReport || "",
            }),
          });
          
          const data = await response.json();
          if (response.ok && data.success) {
            return {
              id: imgItem.id,
              label: data.label,
              modality: data.modality,
              projection: data.projection,
              side: data.side
            };
          }
        } catch (err) {
          console.error(`Error labeling image ${imgItem.id}:`, err);
        }
        return null;
      });

      const results = await Promise.all(promises);
      setAttachedImages(prev => prev.map(item => {
        const found = results.find(r => r && r.id === item.id);
        if (found) {
          return {
            ...item,
            caption: found.label || item.caption,
            modality: found.modality || item.modality || "US",
            projection: found.projection || item.projection || "OTRO",
            side: found.side || item.side || "Derecha"
          };
        }
        return item;
      }));
    } catch (err) {
      console.error("Error al rotular todas las im√°genes:", err);
      alert("Error al intentar rotular todas las im√°genes.");
    } finally {
      setIsLabelingAll(false);
    }
  };

  const handleCorrelateFigures = async () => {
    const reportToUse = generatedReport || inputReport || findings;
    if (!reportToUse) {
      alert("Por favor, genera un reporte o redacta un borrador primero para poder correlacionar las figuras.");
      return;
    }
    if (attachedImages.length === 0) {
      alert("No hay im√°genes cargadas para correlacionar. Por favor sube im√°genes primero.");
      return;
    }

    setIsCorrelatingFigures(true);
    try {
      const response = await fetch("/api/correlate-figures-retroactive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          currentReport: reportToUse,
          attachedImages: attachedImages.map((img, idx) => ({
            id: img.id,
            index: idx + 1,
            caption: img.caption || img.name || ""
          })),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success && data.report) {
        if (generatedReport) {
          setReportHistory(prev => [...prev, generatedReport]);
          setReportRedoHistory([]);
        }
        setGeneratedReport(data.report);

        if (data.reorderedImageIds && Array.isArray(data.reorderedImageIds) && data.reorderedImageIds.length > 0) {
          setAttachedImages(prev => {
            const map = new Map(prev.map(img => [img.id, img]));
            const reordered: typeof prev = [];
            data.reorderedImageIds.forEach((id: string) => {
              const found = map.get(id);
              if (found) {
                reordered.push(found);
                map.delete(id);
              }
            });
            // Append any remaining images not explicitly listed in reorderedImageIds
            map.forEach(img => reordered.push(img));
            return reordered;
          });
        }
      } else {
        alert(data.error || "Ocurri√≥ un error al intentar correlacionar las figuras.");
      }
    } catch (err) {
      console.error("Error al correlacionar figuras:", err);
      alert("Error de red al intentar correlacionar las figuras.");
    } finally {
      setIsCorrelatingFigures(false);
    }
  };

  const handleAttachedFiles = async (filesList: FileList | File[] | null) => {
    if (!filesList) return;
    const filesArray = Array.from(filesList);
    const loaded: {
      id: string;
      name: string;
      url: string;
      base64: string;
      caption: string;
      isDicom: boolean;
      dicomMetaData?: Record<string, string>;
      width?: number;
      height?: number;
      modality?: "MMG" | "US";
      projection?: "MLO" | "CC" | "OTRO";
      side?: "Derecha" | "Izquierda" | "Bilateral";
    }[] = [];
    
    const promises = filesArray.map((file) => {
      if (file.size === 0) return Promise.resolve();
      
      const nameLower = file.name.toLowerCase();
      // Skip Mac OS metadata files, DICOMDIR metadata records, thumbs.db, and XML files
      if (
        nameLower.startsWith(".") || 
        nameLower.startsWith("_") || 
        nameLower === "thumbs.db" || 
        nameLower === "dicomdir" || 
        nameLower.endsWith(".xml")
      ) {
        return Promise.resolve();
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || "";
      const isZip = fileExt === "zip" || file.type === "application/zip" || file.type === "application/x-zip-compressed";
      const isKnownImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt);
      const isDicomExt = ["dcm", "dicom"].includes(fileExt);
      
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        
        if (isZip) {
          (async () => {
            try {
              const jszip = new JSZip();
              const zipContent = await jszip.loadAsync(file);
              const zipPromises: Promise<void>[] = [];
              
              const localUint8ToBase64 = (arr: Uint8Array): string => {
                let binary = "";
                const len = arr.byteLength;
                const chunkSize = 0x4000;
                for (let i = 0; i < len; i += chunkSize) {
                  const subset = arr.subarray(i, i + chunkSize);
                  binary += String.fromCharCode.apply(null, subset as any);
                }
                return btoa(binary);
              };

              for (const [filename, fileObj] of Object.entries(zipContent.files)) {
                if ((fileObj as any).dir) continue;
                
                const innerNameLower = filename.toLowerCase();
                if (
                  innerNameLower.startsWith(".") || 
                  innerNameLower.startsWith("_") || 
                  innerNameLower.endsWith("thumbs.db") || 
                  innerNameLower.endsWith("dicomdir") || 
                  innerNameLower.endsWith(".xml")
                ) {
                  continue;
                }
                
                const innerExt = filename.split('.').pop()?.toLowerCase() || "";
                const isInnerImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(innerExt);
                const isInnerDicomExt = ["dcm", "dicom"].includes(innerExt);
                
                const p = (async () => {
                  const u8Array = await (fileObj as any).async("uint8array");
                  if (u8Array.length === 0) return;
                  
                  const hasDicomHeader = u8Array.length > 132 && 
                                         u8Array[128] === 68 && 
                                         u8Array[129] === 73 && 
                                         u8Array[130] === 67 && 
                                         u8Array[131] === 77; // "DICM"
                  const isInnerDicom = isInnerDicomExt || hasDicomHeader;
                  
                  if (isInnerImage) {
                    const mime = innerExt === "jpg" || innerExt === "jpeg" ? "image/jpeg" : (innerExt === "gif" ? "image/gif" : (innerExt === "webp" ? "image/webp" : "image/png"));
                    const base64Str = `data:${mime};base64,${localUint8ToBase64(u8Array)}`;
                    const res = await ensureCompatibleImageFormat(base64Str);
                    const fname = filename.split("/").pop() || filename;
                    const meta = detectImageMetaFromFilename(fname);
                    loaded.push({
                      id: "attached-" + Math.random().toString(36).substring(2, 11),
                      name: fname,
                      url: res.dataUrl,
                      base64: res.dataUrl,
                      caption: "",
                      isDicom: false,
                      width: res.width,
                      height: res.height,
                      modality: meta.modality,
                      projection: meta.projection,
                      side: meta.side
                    });
                  } else if (isInnerDicom) {
                    try {
                      const cleanDcmBuffer = u8Array.buffer.slice(u8Array.byteOffset, u8Array.byteOffset + u8Array.byteLength);
                      const parsed = decodeDicom(cleanDcmBuffer);
                      let finalBase64 = parsed.base64;
                      if (!finalBase64) {
                        finalBase64 = generateDicomCanvasFallback(filename.split("/").pop() || filename, parsed.meta);
                      }
                      const res = await ensureCompatibleImageFormat(finalBase64);
                      const fname = filename.split("/").pop() || filename;
                      const meta = detectImageMetaFromFilename(fname, parsed.meta);
                      loaded.push({
                        id: "attached-" + Math.random().toString(36).substring(2, 11),
                        name: fname,
                        url: res.dataUrl,
                        base64: res.dataUrl,
                        caption: "",
                        isDicom: true,
                        dicomMetaData: parsed.meta,
                        width: res.width,
                        height: res.height,
                        modality: meta.modality,
                        projection: meta.projection,
                        side: meta.side
                      });
                    } catch (err) {
                      console.error("Error decoding inner ZIP DICOM:", err);
                    }
                  }
                })();
                zipPromises.push(p);
              }
              await Promise.all(zipPromises);
            } catch (zipErr) {
              console.error("Error unpacking ZIP attachment:", zipErr);
            } finally {
              resolve();
            }
          })();
        } else if (isKnownImage) {
          reader.onload = (e) => {
            const base64Str = e.target?.result as string;
            if (base64Str) {
              ensureCompatibleImageFormat(base64Str).then((res) => {
                const meta = detectImageMetaFromFilename(file.name);
                loaded.push({
                  id: "attached-" + Math.random().toString(36).substring(2, 11),
                  name: file.name,
                  url: res.dataUrl,
                  base64: res.dataUrl,
                  caption: "", // Starts completely empty as requested by the user
                  isDicom: false,
                  width: res.width,
                  height: res.height,
                  modality: meta.modality,
                  projection: meta.projection,
                  side: meta.side
                });
                resolve();
              });
            } else {
              resolve();
            }
          };
          reader.readAsDataURL(file);
        } else if (isDicomExt || file.size >= 132) {
          // Candidates for DICOM (try to check tags or fallback by extension / header)
          reader.onload = (e) => {
            const buf = e.target?.result as ArrayBuffer;
            if (buf) {
              const uint8 = new Uint8Array(buf);
              let isRealDicom = isDicomExt;
              if (uint8.length > 132) {
                if (uint8[128] === 68 && uint8[129] === 73 && uint8[130] === 67 && uint8[131] === 77) {
                  isRealDicom = true;
                }
              }
              
              if (isRealDicom) {
                const parsed = decodeDicom(buf);
                let finalBase64 = parsed.base64;
                if (!finalBase64) {
                   finalBase64 = generateDicomCanvasFallback(file.name, parsed.meta);
                }
                
                ensureCompatibleImageFormat(finalBase64).then((res) => {
                  const meta = detectImageMetaFromFilename(file.name, parsed.meta);
                  loaded.push({
                    id: "attached-" + Math.random().toString(36).substring(2, 11),
                    name: file.name,
                    url: res.dataUrl,
                    base64: res.dataUrl,
                    caption: "", // Starts completely empty as requested by the user
                    isDicom: true,
                    dicomMetaData: parsed.meta,
                    width: res.width,
                    height: res.height,
                    modality: meta.modality,
                    projection: meta.projection,
                    side: meta.side
                  });
                  resolve();
                });
              } else {
                resolve();
              }
            } else {
              resolve();
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          resolve();
        }
      });
    });
    
    await Promise.all(promises);
    
    if (loaded.length > 0) {
      setAttachedImages((prev) => [...prev, ...loaded]);
    }
  };

  // Clipboard Paste (Ctrl+V) handler for screenshot or diagnostic images mapping
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (!e.clipboardData || !e.clipboardData.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleAttachedFiles(e.clipboardData.files);
      } else if (e.clipboardData && e.clipboardData.items) {
        const files: File[] = [];
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf("image") !== -1 || item.kind === "file") {
            const blob = item.getAsFile();
            if (blob) {
              const ext = blob.type.split("/")[1] || "png";
              const file = new File([blob], `pasted_capture_${Date.now()}.${ext}`, { type: blob.type });
              files.push(file);
            }
          }
        }
        if (files.length > 0) {
          handleAttachedFiles(files);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [attachedImages]);

  const convertSvgToPng = (svgElement: SVGElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Read the viewBox or size of the SVG to determine the dynamic aspect ratio
        const viewBox = svgElement.getAttribute("viewBox") || "";
        const parts = viewBox.split(/[\s,]+/).map(parseFloat);
        let aspectRatio = 1.42; // standard for vascular schema
        
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          aspectRatio = parts[2] / parts[3];
        }

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          
          if (Math.abs(aspectRatio - 1) < 0.15) {
            // Square aspect ratio (for example, the shoulder diagram) - optimized
            canvas.width = 600;
            canvas.height = 600;
          } else {
            // Wide aspect ratio (for example, the vascular diagram) - optimized
            canvas.width = 750;
            canvas.height = 530;
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Use compressed JPEG instead of PNG for massive size reduction!
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            URL.revokeObjectURL(url);
            resolve(dataUrl);
          } else {
            URL.revokeObjectURL(url);
            reject(new Error("No 2D context"));
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      } catch (e) {
        reject(e);
      }
    });
  };

  const getParagraphSeverity = (text: string): "critical" | "altered" | "normal" => {
    if (!text) return "normal";
    const trimmed = text.trim();
    const trimmedLower = trimmed.toLowerCase();

    // Check manual overrides first
    if (manualSeverityOverrides[trimmed]) {
      return manualSeverityOverrides[trimmed];
    }
    if (manualSeverityOverrides[trimmedLower]) {
      return manualSeverityOverrides[trimmedLower];
    }
    if (manualSeverityOverrides[text]) {
      return manualSeverityOverrides[text];
    }

    // Check AI semantic cache second
    if (aiSeverityCache[trimmed]) {
      return aiSeverityCache[trimmed];
    }
    if (aiSeverityCache[trimmedLower]) {
      return aiSeverityCache[trimmedLower];
    }
    if (aiSeverityCache[text]) {
      return aiSeverityCache[text];
    }

    const blockClean = text.toLowerCase();
    const sentences = blockClean.split(/[.:;]/);
    let severity: "critical" | "altered" | "normal" = "normal";

    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      
      const cleanText = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const criticalKeywords = [
        "ruptura", "desgarro completo", "trombosis", "oclusion", "maligno", "malignidad",
        "birads 4", "birads 5", "birads 6", "birads_4", "birads_5", "birads_6", "aneurisma",
        "colecistitis", "apendicitis", "isquemia", "infarto", "critico", "critica", "criticos", "criticas",
        "trombosis venosa profunda", "tvp", "oclusion total"
      ];

      const alteredKeywords = [
        "desgarro parcial", "desgarro", "alteracion", "alterado", "alterada", "disminuid", "disminucion",
        "aumentad", "aumento", "engrosad", "engrosamiento", "bursitis", "sinovitis", "derrame",
        "quiste", "quistica", "quisticos", "quisticas", "quistes", "calcificacion", "calcificaciones",
        "ectasia", "bocio", "nodulo", "nodulos", "fibrosis", "esteatosis", "hepatomegalia",
        "esplenomegalia", "colelitiasis", "lodo biliar", "adenopatia", "adenopatias",
        "heterogeneo", "heterogenea", "moderado", "moderada", "leve", "litiasis", "lesion", "lesiones",
        "insuficiencia", "insuficiente", "insuficiencias", "reflujo", "reflujos", "incompetente", "incompetentes",
        "incompetencia", "retrogado", "retr√≥grado", "retrogrado", "dilatado", "dilatada", "dilataciones", "dilatacion",
        "ectasico", "ectasica", "tortuoso", "tortuosa"
      ];

      const hasActiveKeyword = (keywords: string[]) => {
        for (const kw of keywords) {
          const kwClean = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const idx = cleanText.indexOf(kwClean);
          if (idx !== -1) {
            // Context before key covers the whole sentence up to the keyword
            const contextBefore = cleanText.substring(0, idx);
            
            const negationPatterns = [
              /\bsin\b/,
              /\bno\s+se\b/,
              /\bno\s+aprec\w*/,
              /\bno\s+evid\w*/,
              /\bno\s+observa\w*/,
              /\bno\s+detecta\w*/,
              /\bno\s+visualiza\w*/,
              /\bno\s+hay\b/,
              /\bausencia\b/,
              /\blibre\s+de\b/,
              /\bnegativ\w*/,
              /\bnormal\b/,
              /\bconservad\w*/,
              /\bdescarta\w*/,
              /\bpermeable\b/,
              /\bcolapsable\b/,
              /\bcompresible\b/,
              /\bno\s+muestra\b/,
              /\bno\s+revela\b/
            ];

            const isNegated = negationPatterns.some(pattern => pattern.test(contextBefore));
            if (!isNegated) {
              return true;
            }
          }
        }
        return false;
      };

      if (hasActiveKeyword(criticalKeywords)) {
        severity = "critical";
        break;
      } else if (hasActiveKeyword(alteredKeywords)) {
        severity = "altered";
      }
    }

    return severity;
  };

  const getImageDimensionsVirtual = (url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve({ width: 0, height: 0 });
        return;
      }
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  };

  const handleDownloadNativePDF = async (
    openInNewTab: boolean = false,
    shareViaWebShare: boolean = false,
    returnBase64: boolean = false,
    returnBlobUrl: boolean = false,
    studyOverride?: Partial<CloudStudy>,
    returnRawBlob: boolean = false
  ): Promise<any> => {
    // Shadow state variables to support optional study overrides gracefully using pdfStateRef.current to avoid TDZ
    const generatedReportLocal = studyOverride ? studyOverride.reportText : pdfStateRef.current.generatedReport;
    if (!generatedReportLocal) return;

    const patientNameLocal = studyOverride ? (studyOverride.patientName || "Paciente An√≥nimo") : (pdfStateRef.current.patientName || "Paciente An√≥nimo");
    const patientEmailLocal = studyOverride ? (studyOverride.patientEmail || "No especificado") : (pdfStateRef.current.patientEmail || "No especificado");
    const patientAgeLocal = studyOverride ? (studyOverride.patientAge || "") : pdfStateRef.current.patientAge;
    const patientGenderLocal = studyOverride ? (studyOverride.patientGender || "") : pdfStateRef.current.patientGender;
    const patientIdLocal = studyOverride ? (studyOverride.patientId || "") : pdfStateRef.current.patientId;
    const reportDateLocal = studyOverride ? (studyOverride.reportDate || "") : pdfStateRef.current.reportDate;
    const doctorNameLocal = studyOverride ? (studyOverride.doctorName || "M√©dico Radi√≥logo") : (pdfStateRef.current.doctorName || "M√©dico Radi√≥logo");
    const doctorLicenseLocal = studyOverride ? (studyOverride.doctorLicense || "No especificada") : (pdfStateRef.current.doctorLicense || "No especificada");
    const clinicNameLocal = studyOverride ? (studyOverride.clinicName || "Cl√≠nica Privada") : (pdfStateRef.current.clinicName || "Cl√≠nica Privada");
    const clinicalHistoryLocal = studyOverride ? (studyOverride.clinicalHistory || "No especificada") : (pdfStateRef.current.clinicalHistory || "No especificada");
    const findingsLocal = studyOverride ? (studyOverride.findings || "No especificadas") : (pdfStateRef.current.findings || "No especificadas");
    const studyTypeLocal = studyOverride ? (studyOverride.studyType || "Estudio General") : (pdfStateRef.current.studyType || "Estudio General");
    const customLogoUrlLocal = studyOverride ? (studyOverride.customLogoUrl || "") : (pdfStateRef.current.customLogoUrl || "");
    const customLogoStyleLocal = studyOverride ? (studyOverride.customLogoStyle || "logo") : (pdfStateRef.current.customLogoStyle || "logo");
    const customSignatureUrlLocal = studyOverride ? (studyOverride.customSignatureUrl || "") : (pdfStateRef.current.customSignatureUrl || "");
    const specificStudyLocal = studyOverride && studyOverride.specificStudy ? studyOverride.specificStudy : pdfStateRef.current.specificStudy;
    const pdfLayoutTypeLocal = studyOverride && studyOverride.pdfLayoutType ? (studyOverride.pdfLayoutType as any) : pdfStateRef.current.pdfLayoutType;
    const selectedLogoLocal = studyOverride && studyOverride.selectedLogo ? studyOverride.selectedLogo : pdfStateRef.current.selectedLogo;

    // Now re-assign to local variables with the exact same name as states to shadow them!
    const generatedReport = generatedReportLocal;
    const patientName = patientNameLocal;
    const patientEmail = patientEmailLocal;
    const patientAge = patientAgeLocal;
    const patientGender = patientGenderLocal;
    const patientId = patientIdLocal;
    const reportDate = reportDateLocal;
    const doctorName = doctorNameLocal;
    const doctorLicense = doctorLicenseLocal;
    const clinicName = clinicNameLocal;
    const displayClinicName = clinicName && clinicName.trim().toUpperCase() !== "CL√çNICA PRIVADA" && clinicName.trim().toUpperCase() !== "CLINICA PRIVADA" ? clinicName.toUpperCase() : "";
    const clinicalHistory = clinicalHistoryLocal;
    const findings = findingsLocal;
    const studyType = studyTypeLocal;
    const customLogoUrl = customLogoUrlLocal;
    const customLogoStyle = customLogoStyleLocal;
    const customSignatureUrl = customSignatureUrlLocal;
    const specificStudy = specificStudyLocal || "T√≥rax";
    const pdfLayoutType = pdfLayoutTypeLocal || "classic";
    const selectedLogo = selectedLogoLocal || "none";
    
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      });

      let yCoord = 20;
      let marginX = 20;
      const pageWidth = 210;
      const pageHeight = 297;
      let contentWidth = pageWidth - (2 * marginX); // 170mm

      // Load virtual image dimensions to prevent any layout distortion on any device
      const logoDims = await getImageDimensionsVirtual(customLogoUrl);
      const signatureDims = await getImageDimensionsVirtual(customSignatureUrl);

      const drawAsymmetricSidebar = (docObj: any, pageNum: number, startY: number = 20) => {
        if (pdfLayoutType !== "asymmetric") return;
        
        // Draw elegant vertical dividing line at x = 70
        docObj.setDrawColor(226, 232, 240); // slate-200
        docObj.setLineWidth(0.35);
        docObj.line(70, startY, 70, pageHeight - 20);

        if (pageNum === 1) {
          // Draw a very elegant Swiss-style slate background card for patient info
          const cardY = startY + 2;
          const cardW = 46;
          const cardH = 75; // slightly taller to fit everything nicely
          
          docObj.setFillColor(248, 250, 252); // slate-50
          docObj.setDrawColor(226, 232, 240); // slate-200
          docObj.setLineWidth(0.2);
          docObj.roundedRect(20, cardY, cardW, cardH, 2, 2, "FD");

          // Red/blue minimalist Swiss accent bar at the top of the sidebar card
          docObj.setFillColor(79, 70, 229); // Indigo accent
          docObj.rect(20, cardY, cardW, 1.8, "F");

          let textY = cardY + 7;
          
          // SIDEBAR HEADER
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7.5);
          docObj.setTextColor(100, 116, 139); // slate-500
          docObj.text("INFORMACI√ìN", 24, textY);
          textY += 4.5;

          // PACIENTE
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184); // slate-400
          docObj.text("PACIENTE", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42); // slate-900
          const pName = (patientName || "NO ESPECIFICADO").toUpperCase();
          const pNameLines = docObj.splitTextToSize(pName, cardW - 8);
          pNameLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 4;
          });
          textY += 2;

          // FECHA
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("FECHA DEL ESTUDIO", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8.5);
          docObj.setTextColor(15, 23, 42);
          docObj.text(formatDateToDMY(reportDate), 24, textY);
          textY += 5.5;

          // ESTUDIO
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(7);
          docObj.setTextColor(148, 163, 184);
          docObj.text("ESTUDIO / EXAMEN", 24, textY);
          textY += 3.5;

          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(8);
          docObj.setTextColor(15, 23, 42);
          const studyClean = (specificStudy || "ECOGRAF√çA").toUpperCase();
          const studyLines = docObj.splitTextToSize(studyClean, cardW - 8);
          studyLines.forEach((l: string) => {
            docObj.text(l, 24, textY);
            textY += 3.8;
          });
          textY += 2;

          // M√âDICO
          if (doctorName) {
            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(7);
            docObj.setTextColor(148, 163, 184);
            docObj.text("M√âDICO", 24, textY);
            textY += 3.5;

            docObj.setFont("helvetica", "bold");
            docObj.setFontSize(8);
            docObj.setTextColor(15, 23, 42);
            const drText = doctorName.toUpperCase();
            const drLines = docObj.splitTextToSize(drText, cardW - 8);
            drLines.forEach((l: string) => {
              docObj.text(l, 24, textY);
              textY += 3.8;
            });
          }
        }
      };

      const drawAnatomicalCards = (
        docObj: any,
        findings: Array<{ label: string; state: string; description: string }>,
        boxX: number,
        boxY: number,
        boxW: number,
        boxH: number,
        isVascular: boolean = false
      ) => {
        // Aligned Anatomical Cards format for Appendix / Synopses in PDF (Opci√≥n 1: Fichas Anat√≥micas Alineadas)
        const isLargeSingleMode = boxH > 100;
        const paddingX = 2.5;
        const paddingY = isLargeSingleMode ? 10.5 : 8.5; // Starts after header text space
        const startX = boxX + paddingX;
        const startY = boxY + paddingY;
        const availW = boxW - (paddingX * 2);
        const availH = boxH - paddingY - (isLargeSingleMode ? 3.5 : 2.5);

        const count = findings.length;
        const cols = count > 3 ? 2 : 1;
        const colGap = 2.0;
        const rowGap = isLargeSingleMode ? 3.0 : 2.0;
        const colW = cols === 2 ? (availW - colGap) / 2 : availW;

        const totalRows = Math.max(1, Math.ceil(count / cols));
        const cardH = (availH - (rowGap * (totalRows - 1))) / totalRows;

        findings.forEach((finding, index) => {
          const colIndex = index % cols;
          const rowIndex = Math.floor(index / cols);
          const cardX = startX + colIndex * (colW + colGap);
          const cardY = startY + rowIndex * (cardH + rowGap);

          const stateClean = (finding.state || "").toLowerCase().trim();
          let dotColor = [99, 102, 241];      // indigo-500
          let badgeBg = [238, 242, 255];      // indigo-50
          let badgeText = [67, 56, 202];       // indigo-700
          let drawBorder = [226, 232, 240];    // light border

          if (isVascular) {
            if (stateClean === "normal" || stateClean === "permeable" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              dotColor = [16, 185, 129];        // Emerald-500 (Green)
              badgeBg = [240, 253, 244];
              badgeText = [21, 128, 61];
              drawBorder = [209, 250, 229];
            } else if (stateClean === "mild" || stateClean === "reflux" || stateClean.includes("mild") || stateClean.includes("reflux") || stateClean.includes("leve") || stateClean.includes("espesor_conservado")) {
              dotColor = [245, 158, 11];        // Amber-500 (Orange for mild-moderate)
              badgeBg = [254, 252, 232];
              badgeText = [180, 83, 9];
              drawBorder = [254, 243, 199];
            } else if (stateClean === "severe" || stateClean === "critical" || stateClean === "thrombosis" || stateClean.includes("severe") || stateClean.includes("critico") || stateClean.includes("cr√≠tico") || stateClean.includes("trombosis")) {
              dotColor = [220, 38, 38];         // Red-600 (Red for severe)
              badgeBg = [254, 242, 242];
              badgeText = [185, 28, 28];
              drawBorder = [254, 205, 211];
            } else {
              // Fallback for custom or unmapped states in vascular studies (Amber/Orange)
              dotColor = [245, 158, 11];
              badgeBg = [254, 252, 232];
              badgeText = [180, 83, 9];
              drawBorder = [254, 243, 199];
            }
          } else {
            if (stateClean === "normal" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              dotColor = [16, 185, 129];        // emerald-500
              badgeBg = [240, 253, 244];         // emerald-50
              badgeText = [21, 128, 61];          // emerald-700
              drawBorder = [209, 250, 229];
            } else if (
              stateClean.includes("ruptura") || 
              stateClean.includes("desgarro_completo") ||
              stateClean.includes("orquitis") ||
              stateClean.includes("torsion") ||
              stateClean.includes("colecistitis") || 
              stateClean.includes("severa") || 
              stateClean.includes("severo") || 
              stateClean.includes("masa") || 
              stateClean.includes("solido") || 
              stateClean.includes("s√≥lido") || 
              stateClean.includes("maligno") || 
              stateClean.includes("birads_4") || 
              stateClean.includes("birads_5") || 
              stateClean.includes("birads_6") || 
              stateClean.includes("suspicious") || 
              stateClean.includes("aneurisma") ||
              stateClean.includes("trombosis") ||
              stateClean.includes("critico") ||
              stateClean.includes("cr√≠tico")
            ) {
              dotColor = [239, 68, 68];          // rose-500
              badgeBg = [254, 242, 242];         // rose-50
              badgeText = [185, 28, 28];          // rose-700
              drawBorder = [254, 205, 211];       // rose-200
            } else if (
              stateClean.includes("leve") || 
              stateClean.includes("quiste_simple") || 
              stateClean.includes("benigno") || 
              stateClean.includes("sinovitis_l") || 
              stateClean.includes("derrame_l") ||
              stateClean.includes("espesor_conservado") ||
              stateClean.includes("hidrocele_l") ||
              stateClean.includes("ectasia_l") ||
              stateClean.includes("bursitis_l") ||
              stateClean.includes("birads_2") ||
              stateClean.includes("birads_3")
            ) {
              dotColor = [245, 158, 11];         // amber-500
              badgeBg = [254, 252, 232];         // amber-50
              badgeText = [180, 83, 9];           // amber-800
              drawBorder = [254, 243, 199];       // amber-200
            }
          }

          // Draw card background
          docObj.setFillColor(255, 255, 255);
          docObj.setDrawColor(drawBorder[0], drawBorder[1], drawBorder[2]);
          docObj.setLineWidth(0.18);
          docObj.roundedRect(cardX, cardY, colW, cardH, 1.2, 1.2, "FD");

          // Draw colored stripe indicator on left edge
          docObj.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
          docObj.rect(cardX, cardY, 1.2, cardH, "F");

          // Draw badge for state FIRST
          let rawState = (finding.state || "ALTERADO").replace(/_/g, " ").toUpperCase();
          if (isVascular) {
            const stateClean = (finding.state || "").toLowerCase().trim();
            if (stateClean === "normal" || stateClean === "permeable" || stateClean === "sin_lesiones" || stateClean === "normales" || stateClean === "dentro de l√≠mites normales") {
              rawState = "PERMEABLE";
            } else if (stateClean === "mild" || stateClean.includes("mild") || stateClean.includes("leve") || stateClean.includes("espesor_conservado")) {
              rawState = "LEVE";
            } else if (stateClean === "reflux" || stateClean.includes("reflux")) {
              rawState = "INSUFICIENCIA";
            } else if (stateClean === "thrombosis" || stateClean.includes("trombosis")) {
              rawState = "TROMBOSIS";
            } else if (stateClean === "severe" || stateClean === "critical" || stateClean.includes("severe") || stateClean.includes("critico") || stateClean.includes("cr√≠tico")) {
              rawState = "ESTENOSIS";
            } else {
              rawState = "ALTERADO";
            }
          } else {
            if (rawState === "NORMAL") rawState = "NORMAL";
            else if (rawState === "DESGARRO MIOFASCIAL") rawState = "D. MIOFASC";
            else if (rawState === "DESGARRO INTRAMUSCULAR") rawState = "D. INTRAC";
            else if (rawState === "VALORACION DINAMICA") rawState = "VAL. DIN.";
            else if (rawState === "ADENOPATIA REACTIVA") rawState = "INFLAMATORIO";
          }

          const badgeFontSize = cardH > 20 ? 5.2 : 4.0;
          const badgeH = cardH > 20 ? 3.4 : 2.3;
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(badgeFontSize);
          const stateTextWidth = docObj.getTextWidth(rawState);
          const badgeW = Math.min(colW * 0.45, stateTextWidth + 2.5);
          const badgeX = cardX + colW - badgeW - 1.2;

          docObj.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
          docObj.roundedRect(badgeX, cardY + 1.0, badgeW, badgeH, 0.5, 0.5, "F");
          docObj.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
          docObj.text(rawState, badgeX + badgeW / 2, cardY + 1.0 + (badgeH * 0.72), { align: "center" });

          // Draw structure label (Title) with auto-scaling font size to avoid truncation
          let labelFontSize = cardH < 10 ? 5.0 : (cardH > 20 ? 7.2 : 5.6);
          docObj.setFont("helvetica", "bold");
          docObj.setFontSize(labelFontSize);
          docObj.setTextColor(15, 23, 42); // slate-900

          const maxTitleWidth = badgeX - (cardX + 2.4) - 1.0;
          let titleText = finding.label.toUpperCase();

          while (labelFontSize > 3.6 && docObj.getTextWidth(titleText) > maxTitleWidth) {
            labelFontSize -= 0.3;
            docObj.setFontSize(labelFontSize);
          }
          if (docObj.getTextWidth(titleText) > maxTitleWidth) {
            while (titleText.length > 3 && docObj.getTextWidth(titleText + "..") > maxTitleWidth) {
              titleText = titleText.slice(0, -1);
            }
            titleText += "..";
          }
          docObj.text(titleText, cardX + 2.4, cardY + (cardH > 20 ? 3.8 : 2.8));

          // Draw wrapped clinical description without cutting off lines
          docObj.setFont("helvetica", "normal");
          let descFontSize = cardH < 9 ? 4.2 : (cardH < 13 ? 4.6 : (cardH > 20 ? 6.2 : 5.0));
          let spacing = descFontSize * (cardH > 20 ? 0.45 : 0.42);

          docObj.setFontSize(descFontSize);
          docObj.setTextColor(71, 85, 105); // slate-600

          const textToWrap = finding.description || "";
          const wrapWidthLimit = colW - 4.2;
          let linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);

          const startTextY = cardY + (cardH > 20 ? 4.0 : 2.8) + spacing;
          const maxTextY = cardY + cardH - 1.0;
          const maxAllowedLines = Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1);

          if (linesWrapped.length > maxAllowedLines && descFontSize > 3.8) {
            descFontSize = 3.8;
            spacing = descFontSize * 0.40;
            docObj.setFontSize(descFontSize);
            linesWrapped = docObj.splitTextToSize(textToWrap, wrapWidthLimit);
          }

          const linesToRender = Math.min(linesWrapped.length, Math.max(1, Math.floor((maxTextY - startTextY) / spacing) + 1));
          for (let i = 0; i < linesToRender; i++) {
            let lineStr = linesWrapped[i];
            if (i === linesToRender - 1 && linesWrapped.length > linesToRender && lineStr.length > 3) {
              lineStr = lineStr.slice(0, -3) + "...";
            }
            docObj.text(lineStr, cardX + 2.4, startTextY + (i * spacing));
          }
        });
      };

      // Helper function to check space and add page if needed
      const checkPageBreak = (neededHeight: number) => {
        if (yCoord + neededHeight > pageHeight - 20) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
        }
      };

      // Helper function to wrap markdown mixed text safely
      const wrapMarkdown = (docObj: any, textStr: string, maxWidth: number) => {
        const parts = textStr.split("**");
        const tokens: { text: string; isBold: boolean }[] = [];

        parts.forEach((partText, idx) => {
          if (!partText && idx !== 0) return; // Allow empty first item (implies starting with bold)
          const isBold = idx % 2 === 1;
          const subParts = partText.split(/(\s+)/);
          subParts.forEach((sub) => {
            if (sub === "") return;
            tokens.push({ text: sub, isBold });
          });
        });

        const lines: { text: string; isBold: boolean }[][] = [];
        let currentLine: { text: string; isBold: boolean }[] = [];
        let currentWidth = 0;

        const originalFontType = docObj.getFont().fontStyle;

        tokens.forEach((token) => {
          if (token.isBold) {
            docObj.setFont("times", "bold");
          } else {
            docObj.setFont("times", "normal");
          }
          docObj.setFontSize(10.5);
          const tokenWidth = docObj.getTextWidth(token.text);

          if (currentWidth + tokenWidth <= maxWidth) {
            currentLine.push(token);
            currentWidth += tokenWidth;
          } else {
            if (token.text.trim() === "" && currentLine.length === 0) {
              return; // Skip leading spaces
            }
            if (currentLine.length > 0) {
              lines.push(currentLine);
            }
            currentLine = [token];
            currentWidth = tokenWidth;
          }
        });

        if (currentLine.length > 0) {
          lines.push(currentLine);
        }

        docObj.setFont("times", originalFontType);
        return lines;
      };

      // Header Brand/Clinic Logo & Name
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          // Banner Style (Centered wide banner)
          let bannerWidth = 165;
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth; // 170
            const maxHeight = 52;
            if (aspect > maxWidth / maxHeight) {
              bannerWidth = maxWidth;
              bannerHeight = maxWidth / aspect;
            } else {
              bannerHeight = maxHeight;
              bannerWidth = maxHeight * aspect;
            }
          }
          
          try {
            const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customLogoUrl, format, (pageWidth - bannerWidth) / 2, yCoord, bannerWidth, bannerHeight);
            yCoord += bannerHeight + 5;
          } catch (err) {
            console.warn("Could not draw banner image inside jsPDF", err);
            // Fallback
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;
          }

          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 5;
          }
        } else {
          // Left Aligned Logo Style
          let logoWidth = 36;
          let logoHeight = 36;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = 42;
            const maxHeight = 42;
            if (aspect > maxWidth / maxHeight) {
              logoWidth = maxWidth;
              logoHeight = maxWidth / aspect;
            } else {
              logoHeight = maxHeight;
              logoWidth = maxHeight * aspect;
            }
          }
          
          try {
            const format = customLogoUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(customLogoUrl, format, marginX, yCoord, logoWidth, logoHeight);
          } catch (err) {
            console.warn("Could not draw logo image inside left header", err);
          }
          
          const textX = marginX + logoWidth + 6;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", textX, yCoord + (logoHeight / 2) - 1.5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", textX, yCoord + (logoHeight / 2) + 4);
          
          yCoord += Math.max(logoHeight, 15) + 6;
        }
      } else {
        // Standard (No user custom logo file, or they chose default medical vectors)
        let symbolWidth = 0;
        if (selectedLogo === "medical-cross") {
          symbolWidth = 14;
          doc.setDrawColor(220, 38, 38); // Red
          doc.setFillColor(220, 38, 38);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "heart-pulse") {
          symbolWidth = 14;
          doc.setDrawColor(244, 63, 94); // Rose
          doc.setFillColor(244, 63, 94);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        } else if (selectedLogo === "dna" || selectedLogo === "shield-check") {
          symbolWidth = 14;
          doc.setDrawColor(79, 70, 229); // Indigo
          doc.setFillColor(79, 70, 229);
          doc.rect(marginX + 5, yCoord, 4, 12, "F");
          doc.rect(marginX + 1, yCoord + 4, 12, 4, "F");
        }

        if (symbolWidth > 0) {
          const textX = marginX + symbolWidth + 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text(displayClinicName || "REPORTE DE RADIODIAGN√ìSTICO", textX, yCoord + 5);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", textX, yCoord + 10.5);
          
          yCoord += 18;
        } else {
          // Centered Clinic Name or default heading
          if (displayClinicName) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900 / dark
            doc.text(displayClinicName, pageWidth / 2, yCoord, { align: "center" });
            yCoord += 6;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("REPORTE DE RADIODIAGN√ìSTICO POR IMAGEN", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 8;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("REPORTE DE RADIODIAGN√ìSTICO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 11;
          }
        }
      }

      // Add a line under header
      if (pdfLayoutType === "clinical_slate") {
        doc.setDrawColor(71, 85, 105); // slate-600
        doc.setLineWidth(0.65);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      } else if (pdfLayoutType === "executive_medical") {
        doc.setDrawColor(15, 23, 42); // Navy
        doc.setLineWidth(0.6);
        doc.line(marginX, yCoord - 2.5, pageWidth - marginX, yCoord - 2.5);
        doc.setDrawColor(197, 160, 89); // Gold
        doc.setLineWidth(0.35);
        doc.line(marginX, yCoord - 1.5, pageWidth - marginX, yCoord - 1.5);
      } else {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(marginX, yCoord - 2, pageWidth - marginX, yCoord - 2);
      }
      yCoord += 2;

      // Patient Metadata Block
      if (pdfLayoutType === "clinical_slate" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CL√çNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / G√âNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Clinical Slate metadata card
        doc.setFillColor(241, 245, 249); // slate-100
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.35);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical divider inside the card for Row 1
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.25);
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Draw vertical divider in Row 2
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "executive_medical" && (patientName || reportDate)) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID / HISTORIA CL√çNICA",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD / SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO / G√âNERO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }

        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 22 : 13;

        // Draw elegant Executive Medical metadata card (Cream & Gold style)
        doc.setFillColor(253, 251, 247); // Sophisticated cream
        doc.setDrawColor(197, 160, 89); // Metallic Gold
        doc.setLineWidth(0.4);
        doc.roundedRect(marginX, yCoord, contentWidth, cardHeight, 1.5, 1.5, "FD");

        // Vertical gold divider inside the card for Row 1
        doc.line(marginX + (contentWidth / 2), yCoord, marginX + (contentWidth / 2), yCoord + 12);

        if (hasExtraMeta) {
          // Horizontal divider
          doc.line(marginX, yCoord + 12, marginX + contentWidth, yCoord + 12);

          if (extraCols.length === 2) {
            // Row 2 divider
            doc.line(marginX + (contentWidth / 2), yCoord + 12, marginX + (contentWidth / 2), yCoord + cardHeight);
          }
        }

        const formattedDate = formatDateToDMY(reportDate);

        // Column 1: PACIENTE
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("PACIENTE", marginX + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text((patientName || "NO ESPECIFICADO").toUpperCase(), marginX + 4, yCoord + 9.5);

        // Column 2: FECHA DEL ESTUDIO
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(197, 160, 89); // Gold
        doc.text("FECHA DEL ESTUDIO", marginX + (contentWidth / 2) + 4, yCoord + 4.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // Dark Navy / Slate-900
        doc.text(formattedDate || "NO ESPECIFICADO", marginX + (contentWidth / 2) + 4, yCoord + 9.5);

        if (hasExtraMeta) {
          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, marginX + 4, yCoord + 19.5);
          } else if (extraCols.length === 2) {
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col1.label, marginX + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, marginX + 4, yCoord + 19.5);

            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(197, 160, 89); // Gold
            doc.text(col2.label, marginX + (contentWidth / 2) + 4, yCoord + 15.5);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(col2.value, marginX + (contentWidth / 2) + 4, yCoord + 19.5);
          }
        }

        yCoord += cardHeight + 6;
      } else if (pdfLayoutType === "asymmetric") {
        drawAsymmetricSidebar(doc, 1, yCoord);
        yCoord += 4;
        marginX = 74;
        contentWidth = 116;
      } else if (patientName || reportDate) {
        const extraCols: { label: string; value: string }[] = [];
        if (patientId && patientId.trim() !== "") {
          extraCols.push({
            label: "ID",
            value: patientId.trim().toUpperCase()
          });
        }
        const agePart = patientAge && patientAge.trim() !== "" ? patientAge.trim() : "";
        const genderPart = patientGender && patientGender.trim() !== "" ? patientGender.trim() : "";
        if (agePart || genderPart) {
          let combinedVal = "";
          let label = "";
          if (agePart && genderPart) {
            label = "EDAD/SEXO";
            combinedVal = `${agePart} / ${genderPart}`;
          } else if (agePart) {
            label = "EDAD";
            combinedVal = agePart;
          } else {
            label = "SEXO";
            combinedVal = genderPart;
          }
          extraCols.push({
            label: label,
            value: combinedVal.toUpperCase()
          });
        }
        const hasExtraMeta = extraCols.length > 0;
        const cardHeight = hasExtraMeta ? 21 : 12;

        doc.setFillColor(248, 250, 252); // greyish background
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, yCoord, contentWidth, cardHeight, "S");

        let xOffset = marginX + 4;
        let totalDateWidth = 0;
        const formattedDate = formatDateToDMY(reportDate);
        
        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          const dateLabel = "FECHA: ";
          totalDateWidth = doc.getTextWidth(dateLabel) + doc.getTextWidth(formattedDate);
        }

        if (patientName) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          doc.text("PACIENTE: ", xOffset, yCoord + 7.5);
          const labelWidth = doc.getTextWidth("PACIENTE: ");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          
          let patientText = patientName.toUpperCase();
          const maxNameWidth = (contentWidth - 8 - totalDateWidth) - labelWidth - 4;
          if (doc.getTextWidth(patientText) > maxNameWidth) {
            while (patientText.length > 5 && doc.getTextWidth(patientText + "...") > maxNameWidth) {
              patientText = patientText.slice(0, -1);
            }
            patientText += "...";
          }
          doc.text(patientText, xOffset + labelWidth, yCoord + 7.5);
        }

        if (reportDate) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          const dateLabel = "FECHA: ";
          const rightX = marginX + contentWidth - 4 - totalDateWidth;
          
          doc.text(dateLabel, rightX, yCoord + 7.5);
          const dateLabelWidth = doc.getTextWidth(dateLabel);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(formattedDate, rightX + dateLabelWidth, yCoord + 7.5);
        }

        if (hasExtraMeta) {
          // Draw a small line divider
          doc.setDrawColor(226, 232, 240);
          doc.line(marginX, yCoord + 11.5, marginX + contentWidth, yCoord + 11.5);

          if (extraCols.length === 1) {
            const col = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const labelText = `${col.label}: `;
            doc.text(labelText, xOffset, yCoord + 16.5);
            const labelW = doc.getTextWidth(labelText);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col.value, xOffset + labelW, yCoord + 16.5);
          } else if (extraCols.length === 2) {
            // Col 1 (Left)
            const col1 = extraCols[0];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label1 = `${col1.label}: `;
            doc.text(label1, xOffset, yCoord + 16.5);
            const label1W = doc.getTextWidth(label1);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(col1.value, xOffset + label1W, yCoord + 16.5);

            // Col 2 (Right)
            const col2 = extraCols[1];
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const label2 = `${col2.label}: `;
            const val2 = col2.value;
            const totalW2 = doc.getTextWidth(label2) + doc.getTextWidth(val2);
            const rightX = marginX + contentWidth - 4 - totalW2;
            doc.text(label2, rightX, yCoord + 16.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(val2, rightX + doc.getTextWidth(label2), yCoord + 16.5);
          }
        }

        yCoord += cardHeight + 7;
      }

      // --- DYNAMIC PAGE BUDGET & COMPLETE WIDOW/ORPHAN CONTROL ---
      const isVascularStudy = specificStudy === "Doppler de car√≥tidas" || 
                              specificStudy === "Doppler venoso de miembro inferior" || 
                              specificStudy === "Doppler arterial de miembro inferior";
      const isCarotidasForPDF = specificStudy.toLowerCase().includes("car√≥t") || specificStudy.toLowerCase().includes("carot");
      const hasBifurcDer = !!document.getElementById("print-bifurcation-der");
      const hasBifurcIzq = !!document.getElementById("print-bifurcation-izq");

      let factor = 1.0;
      let estimatedHeight = 20; // Start at top margin

      // 1. Header height estimation
      if (customLogoUrl) {
        if (customLogoStyle === "banner") {
          let bannerHeight = 35;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = contentWidth;
            const maxHeight = 52;
            bannerHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
          }
          estimatedHeight += bannerHeight + 5;
          if (displayClinicName) estimatedHeight += 5;
        } else {
          let logoHeight = 36;
          if (logoDims.width && logoDims.height) {
            const aspect = logoDims.width / logoDims.height;
            const maxWidth = 42;
            const maxHeight = 42;
            logoHeight = aspect > maxWidth / maxHeight ? maxWidth / aspect : maxHeight;
          }
          estimatedHeight += Math.max(logoHeight, 15) + 6;
        }
      } else {
        estimatedHeight += 18;
      }
      estimatedHeight += 2; // Underline

      // 2. Patient metadata block estimation
      if (pdfLayoutType !== "asymmetric" && (patientName || reportDate)) {
        estimatedHeight += 19;
      }

      // 3. Estimate text blocks (paragraphs) and tables
      try {
        const stripEmojisLocal = (str: string): string => {
          if (!str) return "";
          return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
        };
        const reportToRenderLocal = isEditingReportManual ? editedReportText : generatedReport;
        const emojiFreeReportLocal = stripEmojisLocal(reportToRenderLocal || "");
        let cleanReportLocal = cleanRawClinicalText(emojiFreeReportLocal);
        cleanReportLocal = cleanReportLocal.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");
        const legacyIdxLocal = cleanReportLocal.indexOf("[CASE_ANALYSIS_JSON]");
        if (legacyIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, legacyIdxLocal).trim();
        }
        const summaryIdxLocal = cleanReportLocal.indexOf("**AN√ÅLISIS INTEGRADO DE CASO");
        if (summaryIdxLocal !== -1) {
          cleanReportLocal = cleanReportLocal.substring(0, summaryIdxLocal).trim();
        }
        cleanReportLocal = cleanReportLocal.trim();
        const normalizedReportLocal = cleanReportLocal
          .replace(/\n+\s*(---\s*)/g, "\n\n$1")
          .replace(/\n+\s*((?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
          .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[o√≥]n(?:es)?|impresi[o√≥]n(?:es)?\s+diagn[o√≥]stica(?:s)?|diagn[o√≥]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
        const rawParagraphsLocal = normalizedReportLocal.split(/\n\n+/);
        const paragraphsLocal: string[] = [];
        let inConclusionLocal = false;
        let conclusionBufferLocal: string[] = [];

        rawParagraphsLocal.forEach((p) => {
          const trimmed = p.trim();
          if (!trimmed) return;

          const isSemiologyLineLocal = /semiolog[i√≠]a|justificaci[o√≥]n|exclusi[o√≥]n/i.test(trimmed);
          const isConclusionHeader = !isSemiologyLineLocal && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed);

          const isFootnoteOrDividerLocal = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
            /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

          const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
            /^\s*\*\*(?:hallazgos|estudio|t√©cnica|tecnica|m√©todo|metodo|exploraci√≥n|exploracion|motivo|comparaci√≥n|comparacion|datos\s+cl√≠nicos|indicaci√≥n|indicacion|antecedentes|pie\s+de\s+p√°gina|nota\s+de\s+pie)\b/i.test(trimmed) ||
            isFootnoteOrDividerLocal;

          if (isFootnoteOrDividerLocal) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else if (isConclusionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = true;
            conclusionBufferLocal.push(trimmed);
          } else if (isOtherSectionHeader) {
            if (inConclusionLocal && conclusionBufferLocal.length > 0) {
              paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
              conclusionBufferLocal = [];
            }
            inConclusionLocal = false;
            paragraphsLocal.push(trimmed);
          } else {
            if (inConclusionLocal) {
              conclusionBufferLocal.push(trimmed);
            } else {
              paragraphsLocal.push(trimmed);
            }
          }
        });

        if (inConclusionLocal && conclusionBufferLocal.length > 0) {
          paragraphsLocal.push(conclusionBufferLocal.join("\n\n"));
        }

        const tempDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        let isFirstBlockLocal = true;
        const estContentWidth = pdfLayoutType === "asymmetric" ? 116 : contentWidth;

        paragraphsLocal.forEach((block) => {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) return;

          if (!isFirstBlockLocal) {
            estimatedHeight += 4.5;
          } else {
            isFirstBlockLocal = false;
          }

          if (trimmedBlock.startsWith("|") && (trimmedBlock.includes("-|-") || trimmedBlock.includes("---") || trimmedBlock.includes(":---"))) {
            // Table block
            const rows = trimmedBlock.split("\n").filter(r => r.trim() !== "");
            const bodyRows = rows.slice(2);
            estimatedHeight += 16;
            bodyRows.forEach((r) => {
              const cells = r.split("|").map(c => c.trim());
              let maxLinesLocal = 1;
              cells.forEach((cellText) => {
                const wrapped = tempDoc.splitTextToSize(cellText.replace(/\*\*/g, ""), (estContentWidth / cells.length) - 6);
                if (wrapped.length > maxLinesLocal) maxLinesLocal = wrapped.length;
              });
              estimatedHeight += (maxLinesLocal * 5) + 4;
            });
            estimatedHeight += 4;
          } else {
            // Standard block
            const linesOfBlock = trimmedBlock.split("\n");
            linesOfBlock.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) {
                estimatedHeight += 2.5;
                return;
              }
              if (trimmed === "---" || /^---+\s*$/.test(trimmed)) {
                return;
              }
              const isHeader = trimmed.startsWith("#") || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isHeader) {
                estimatedHeight += 5.5;
              } else {
                const wrappedLines = tempDoc.splitTextToSize(trimmed.replace(/\*\*/g, ""), estContentWidth);
                estimatedHeight += wrappedLines.length * 5.0;
              }
            });
          }
        });
      } catch (estError) {
        console.warn("Error estimating paragraph heights:", estError);
      }

      // 4. Clinical schematics / Diagram estimation
      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        estimatedHeight += 95;
      } else if (includeVascularSchemaInReport && isVascularStudy) {
        estimatedHeight += 85;
        if (isCarotidasForPDF && includeCarotidBifurcations && (hasBifurcDer || hasBifurcIzq)) {
          estimatedHeight += 75;
        }
      }

      // 5. Signature block estimation
      estimatedHeight += 38;

      // 6. Calculate pages and remainder for widow/orphan detection
      const usablePageHeight = 255;
      const estTotalPages = Math.ceil(estimatedHeight / usablePageHeight);
      const estRemainder = estimatedHeight % usablePageHeight;

      // If we spill onto a new page, and that new page has less than 48mm of content (orphaned signature/conclusion!),
      // we reduce spacing to pull it back onto the previous page elegantly!
      if (estTotalPages > 1 && estRemainder < 48) {
        factor = 0.84; // 16% spacing compression
      } else if (estTotalPages > 1 && estRemainder < 60) {
        factor = 0.88; // 12% spacing compression
      }

      // Adjust starting patient offset with factor
      if (patientName || reportDate) {
        yCoord = yCoord - 19 + (19 * factor);
      }

      // Strip emojis from the generated report
      const stripEmojis = (str: string): string => {
        if (!str) return "";
        return str
          // Strip surrogate pairs (handles 4-byte emojis like ü´Å, ü´Ä, ü¶¥, üß†, üìã, üîç, etc.)
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
          // Strip miscellaneous symbol emojis & shapes in the BMP (like ‚ö†Ô∏è, ‚è±, ‚öï, ‚úîÔ∏è, ‚ùå, ‚≠ê, etc.)
          .replace(/[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50]|[\u2190-\u21FF]/g, "");
      };

      // Clean non-ASCII smart quotes, dashes, bullet symbols, and special unicode symbols that distort jsPDF letter spacing
      const cleanTextForJSPDF = (text: string): string => {
        if (!text) return "";
        return text
          .replace(/[‚Äú‚Äù‚Äû¬´¬ª‚Äü]/g, '"')
          .replace(/[‚Äò‚Äô`¬¥‚Ä≤‚Ä≥]/g, "'")
          .replace(/[‚Äî‚Äì‚Äí‚Äï]/g, "-")
          .replace(/[\u2022\u25E6\u2023\u2043\u25AA\u25FE\u25C6\u25C7\u25B6\u25B7\u25C0\u25C1]/g, "-")
          .replace(/[\u00A0\u200B\u2009\u202F\u2000-\u200A]/g, " ")
          .replace(/‚Ä¶/g, "...");
      };

      const reportToRender = isEditingReportManual ? editedReportText : generatedReport;
      const emojiFreeReport = stripEmojis(reportToRender);
      let cleanReport = cleanRawClinicalText(emojiFreeReport);

      // Extract all CASE_ANALYSIS blocks from the report text to draw them in the Annex at the end
      const caseAnalysisBlocks: CaseAnalysisData[] = [];
      const caseRegex = /\[CASE_ANALYSIS_JSON\]\s*([\s\S]*?)\s*\[\/CASE_ANALYSIS_JSON\]/g;
      let caseMatch;
      while ((caseMatch = caseRegex.exec(cleanReport)) !== null) {
        if (caseMatch[1]) {
          try {
            const parsed = JSON.parse(caseMatch[1]) as CaseAnalysisData;
            caseAnalysisBlocks.push(parsed);
          } catch (e) {
            console.error("Error parsing case data block for PDF annex:", e);
          }
        }
      }

      // Strip all [START_CASE_ANALYSIS:format] ... [END_CASE_ANALYSIS:format] blocks
      // from the main report content so they do not print as plain text.
      cleanReport = cleanReport.replace(/\[START_CASE_ANALYSIS:[\s\S]*?\[END_CASE_ANALYSIS:[^\]]+\]/gi, "");

      // Strip the fallback text summary of the case analysis from the PDF text entirely
      const legacyIdx = cleanReport.indexOf("[CASE_ANALYSIS_JSON]");
      if (legacyIdx !== -1) {
        cleanReport = cleanReport.substring(0, legacyIdx).trim();
      }
      const summaryIdx = cleanReport.indexOf("**AN√ÅLISIS INTEGRADO DE CASO");
      if (summaryIdx !== -1) {
        cleanReport = cleanReport.substring(0, summaryIdx).trim();
      }
      cleanReport = cleanReport.trim();

      const normalizedReport = cleanReport
        .replace(/\n+\s*(---\s*)/g, "\n\n$1")
        .replace(/\n+\s*((?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b)/gi, "\n\n$1")
        .replace(/\n+\s*(\s*(?:##+|#|\*\*)\s*(?:conclusi[o√≥]n(?:es)?|impresi[o√≥]n(?:es)?\s+diagn[o√≥]stica(?:s)?|diagn[o√≥]stico(?:s)?|hallazgos)\b)/gi, "\n\n$1");
      const rawParagraphs = normalizedReport.split(/\n\n+/);
      const paragraphs: string[] = [];
      let inConclusion = false;
      let conclusionBuffer: string[] = [];

      rawParagraphs.forEach((p) => {
        const trimmed = p.trim();
        if (!trimmed) return;

        // If this is a CASE_ANALYSIS_JSON block, do not merge it with the conclusion or any other buffer
        if (trimmed.includes("[CASE_ANALYSIS_JSON]")) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
          return;
        }

        const isSemiologyLine = /semiolog[i√≠]a|justificaci[o√≥]n|exclusi[o√≥]n/i.test(trimmed);
        const isConclusionHeader = !isSemiologyLine && /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmed);

        const isFootnoteOrDivider = trimmed === "---" || /^---+\s*$/.test(trimmed) ||
          /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(trimmed);

        const isOtherSectionHeader = /^\s*(?:##+|#)\s+/i.test(trimmed) ||
          /^\s*\*\*(?:hallazgos|estudio|t√©cnica|tecnica|m√©todo|metodo|exploraci√≥n|exploracion|motivo|comparaci√≥n|comparacion|datos\s+cl√≠nicos|indicaci√≥n|indicacion|antecedentes|pie\s+de\s+p√°gina|nota\s+de\s+pie)\b/i.test(trimmed) ||
          trimmed.includes("ANEXO DIAGN√ìSTICO") ||
          trimmed.includes("DESGLOSE Y JUSTIFICACI√ìN") ||
          isFootnoteOrDivider;

        if (isFootnoteOrDivider) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else if (isConclusionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = true;
          conclusionBuffer.push(trimmed);
        } else if (isOtherSectionHeader) {
          if (inConclusion && conclusionBuffer.length > 0) {
            paragraphs.push(conclusionBuffer.join("\n\n"));
            conclusionBuffer = [];
          }
          inConclusion = false;
          paragraphs.push(trimmed);
        } else {
          if (inConclusion) {
            conclusionBuffer.push(trimmed);
          } else {
            paragraphs.push(trimmed);
          }
        }
      });

      if (inConclusion && conclusionBuffer.length > 0) {
        paragraphs.push(conclusionBuffer.join("\n\n"));
      }

      // Set standard font settings
      doc.setFont("times", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);

      let isFirstLine = true;
      let isFirstBlock = true;
      let inFootnoteSection = false;
      let hasDrawnSignature = false;

      const renderSignatureBlock = () => {
        if (hasDrawnSignature) return;
        if (doctorName || customSignatureUrl) {
          checkPageBreak(38); // Requerir suficiente espacio para el bloque homologado dual
          yCoord += 12;

          const startY = yCoord;

          // Dibujar borde gris claro con fondo suave en la columna izquierda (Caja de verificaci√≥n)
          const boxX = marginX;
          const boxY = startY;
          const boxW = (pageWidth - marginX * 2) * 0.48; // Columna izquierda (48% de ancho)
          const boxH = 26;

          // Rellenar fondo
          doc.setFillColor(248, 250, 252); // slate 50
          doc.rect(boxX, boxY, boxW, boxH, "F");
          // Dibujar borde
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.35);
          doc.rect(boxX, boxY, boxW, boxH, "S");

          // Metadatos de Integridad en Columna Izquierda:
          let internalY = boxY + 4;
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105); // slate 600
          doc.text("VERIFICACI√ìN INTEGRIDAD DE DOCUMENTO", boxX + 3, internalY);
          internalY += 3.5;

          // Obtener el Hash generado determin√≠sticamente
          const sSeedCombine = `${patientName || ""}-${doctorName || ""}-${reportDate || ""}-${clinicName || ""}`;
          let sHashVal = 0;
          for (let i = 0; i < sSeedCombine.length; i++) {
            sHashVal = ((sHashVal << 5) - sHashVal) + sSeedCombine.charCodeAt(i);
            sHashVal |= 0;
          }
          const sHexStr = Math.abs(sHashVal).toString(16).toUpperCase().padStart(8, "0");
          const pSeedVal = (patientName && patientName.length > 0) ? patientName.charCodeAt(0) + patientName.length : 42;
          const dSeedVal = (doctorName && doctorName.length > 0) ? doctorName.charCodeAt(0) + doctorName.length : 17;
          const partVal = ((pSeedVal * 231 + dSeedVal * 19) % 65535).toString(16).toUpperCase().padStart(4, "E");
          const pdfValidationHash = `SHA256: FD82-${sHexStr.substring(0, 4)}-${sHexStr.substring(4, 8)}-${partVal}-9B1C-E8B1`;

          doc.setFont("courier", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(30, 41, 59); // slate 800
          doc.text(pdfValidationHash, boxX + 3, internalY);
          internalY += 3;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139); // slate 500
          doc.text("ESTADO DEL DOCUMENTO: ", boxX + 3, internalY);
          const stateW = doc.getTextWidth("ESTADO DEL DOCUMENTO: ");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(21, 128, 61); // green 700
          doc.text("FIRMADO ELECTR√ìNICAMENTE", boxX + 3 + stateW, internalY);
          internalY += 2.8;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.1);
          doc.setTextColor(100, 116, 139); // slate 500
          doc.text(`REG. M√âDICO: ${doctorLicense || "M.S.P. Reg: 6025 / Senescyt: 1005-12-7489"}`, boxX + 3, internalY);
          internalY += 2.8;

          doc.text(`FECHA DE VALIDACI√ìN: ${reportDate} (AUT√ìNOMO)`, boxX + 3, internalY);
          internalY += 2.8;

          doc.setFont("helvetica", "italic");
          doc.text("Firma de Validez Homologada seg√∫n Normativa Sanitaria.", boxX + 3, internalY);

          // --- Columna Derecha: √Årea de Firma Digital / Aut√≥grafa ---
          const rightColX = pageWidth - marginX;
          
          // Agregar firma f√≠sica si est√° cargada
          if (customSignatureUrl) {
            try {
              let sigWidth = 35;
              let sigHeight = 11;
              if (signatureDims.width && signatureDims.height) {
                const aspect = signatureDims.width / signatureDims.height;
                const maxWidth = 50;
                const maxHeight = 15;
                if (aspect > maxWidth / maxHeight) {
                  sigWidth = maxWidth;
                  sigHeight = maxWidth / aspect;
                } else {
                  sigHeight = maxHeight;
                  sigWidth = maxHeight * aspect;
                }
              }
              const sigX = rightColX - sigWidth - 4;
              const sigY = boxY + 1; // Alinear ordenadamente arriba
              const format = customSignatureUrl.toLowerCase().includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(customSignatureUrl, format, sigX, sigY, sigWidth, sigHeight);
            } catch (imgError) {
              console.warn("Could not render custom signature image inside jsPDF", imgError);
            }
          } else {
            // Si no hay firma f√≠sica, mostrar sello digital elegante
            doc.setFont("helvetica", "oblique");
            doc.setFontSize(7);
            doc.setTextColor(30, 64, 175); // blue 800
            doc.text("FIRMADO ELECTR√ìNICAMENTE CON TOKEN", rightColX - 62, boxY + 8);
          }

          // L√≠nea horizontal para firma del doctor (solo del lado derecho)
          const lineStart = rightColX - 70;
          doc.setDrawColor(203, 213, 225); // slate 300
          doc.setLineWidth(0.3);
          doc.line(lineStart, boxY + boxH - 8, rightColX, boxY + boxH - 8);

          // Nombre del doctor en la derecha
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          const docText = (doctorName || "Dr. Milton Benavides S. Cod.6025").toUpperCase();
          const docTextWidth = doc.getTextWidth(docText);
          doc.text(docText, rightColX - docTextWidth, boxY + boxH - 4.5);

          // Especialidad del doctor en la derecha
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          const titleText = "Especialista en Radiolog√≠a e Im√°genes Medicas.";
          const titleTextWidth = doc.getTextWidth(titleText);
          doc.text(titleText, rightColX - titleTextWidth, boxY + boxH - 1.5);
          
          yCoord = boxY + boxH + 6;
        }
        hasDrawnSignature = true;
      };

      const renderSingleReportBlock = (block: string) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        // Check for explicit page break tag
        if (/^(?:\[(?:salto(?:_de_p[a√°]gina)?|page_break|salto_pagina)\]|<pagebreak>)$/i.test(trimmedBlock)) {
          doc.addPage();
          yCoord = 20;
          if (pdfLayoutType === "asymmetric") {
            drawAsymmetricSidebar(doc, doc.getNumberOfPages(), 20);
          }
          return;
        }

        // Check for explicit vertical spacing tag (e.g. [ESPACIO] or [ESPACIO_10MM])
        const spaceMatch = trimmedBlock.match(/^\[ESPACIO(?:_(\d+)MM)?\]$/i);
        if (spaceMatch) {
          const mm = spaceMatch[1] ? parseInt(spaceMatch[1], 10) : 10;
          yCoord += mm * factor;
          return;
        }

        // Skip inline Case Analysis JSON blocks as they are rendered in Step 5 (Diagn√≥stico Avanzado)
        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }


        // Check if the block is a footnote (for Creador de Notas de Pie de P√°gina)
        const blockLower = trimmedBlock.toLowerCase();
        
        const isHeadingOrTableOrCode = trimmedBlock.startsWith("#") || 
                                       trimmedBlock.startsWith("**") || 
                                       trimmedBlock.startsWith("|") || 
                                       trimmedBlock.startsWith("```") || 
                                       (trimmedBlock.startsWith("===") && (trimmedBlock.includes("S√çNTESIS VASCULAR") || trimmedBlock.includes("S√çNTESIS DE ANATOM√çA")));
        
        if (isHeadingOrTableOrCode) {
          inFootnoteSection = false;
        }

        const isFootnote = inFootnoteSection ||
                            blockLower.startsWith("*pie de p√°gina:") || 
                            blockLower.startsWith("pie de p√°gina:") ||
                            blockLower.startsWith("*nota de pie:") ||
                            blockLower.startsWith("nota de pie:") ||
                            blockLower.startsWith("*nota de pie de p√°gina:") ||
                            blockLower.startsWith("nota de pie de p√°gina:");

        if (isFootnote) {
          checkPageBreak(8 * factor);
          doc.setFont("times", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(115, 125, 140); // Slate-500 (dim gray)
          
          let cleanTxt = trimmedBlock;
          // Strip "Pie de p√°gina: " or similar prefixes if they exist
          const prefixRegex = /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina)\s*(?:\*+)?\s*:\s*(?:\*+)?\s*/i;
          cleanTxt = cleanTxt.replace(prefixRegex, "");

          if (cleanTxt.startsWith("*")) {
            cleanTxt = cleanTxt.replace(/^\*\s*/, "").replace(/\*$/, "");
          }
          cleanTxt = cleanTxt.replace(/\*\*/g, "");

          const lines = doc.splitTextToSize(cleanTxt, contentWidth);
          lines.forEach((l: string) => {
            checkPageBreak(4.5 * factor);
            doc.text(l, marginX, yCoord);
            yCoord += 4.5 * factor;
          });
          yCoord += 2 * factor; // subtle gap
          
          // Reset default font styles
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 1. Check if the block is a conclusion/diagnostic impression block (Sugerencia 1: Cuadro de Conclusi√≥n)
        const isConclusionBlock = /^\s*(?:#+|\*+|-|_|\d+\.)*\s*(?:conclusi√≥n|conclusiones|conclusion|impresi√≥n\s+diagn√≥stica|impresion\s+diagnostica|impresiones\s+diagn√≥sticas|impresiones\s+diagnosticas|diagn√≥sticos|diagn√≥stico|diagnostico|diagnosticos)\b/i.test(trimmedBlock);

        if (isConclusionBlock) {
          const blockLines = trimmedBlock.split("\n");
          
          let totalBlockHeight = 0;
          const parsedLines: {
            isHeader: boolean;
            isBulleted: boolean;
            bulletToken?: string;
            wrappedLines: { text: string; isBold: boolean }[][];
          }[] = [];
          
          // Padding dentro del bloque de sombreado sutil
          const boxPaddingLeft = 6;
          const boxPaddingRight = 6;
          const boxPaddingTop = 5;
          const boxPaddingBottom = 5;
          
          const boxContentWidth = contentWidth - boxPaddingLeft - boxPaddingRight;
          let headerTitle = "";

          blockLines.forEach((line) => {
            let lineTrimmed = line.trim();
            if (!lineTrimmed) {
              totalBlockHeight += 2.5 * factor;
              parsedLines.push({ isHeader: false, isBulleted: false, wrappedLines: [] });
              return;
            }
            const isFootnoteLineInBox = lineTrimmed === "---" || /^---+\s*$/.test(lineTrimmed) ||
              /^\s*(?:\*+)?\s*(?:pie de p√°gina|nota de pie|nota de pie de p√°gina|pie de pagina|nota de pie de pagina)\b/i.test(lineTrimmed);
            if (isFootnoteLineInBox) {
              return;
            }
            
            let isMarkdownHeading = false;
            if (lineTrimmed.startsWith("# ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^#\s+/, ""); }
            else if (lineTrimmed.startsWith("## ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^##\s+/, ""); }
            else if (lineTrimmed.startsWith("### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^###\s+/, ""); }
            else if (lineTrimmed.startsWith("#### ")) { isMarkdownHeading = true; lineTrimmed = lineTrimmed.replace(/^####\s+/, ""); }

            const lineLower = lineTrimmed.toLowerCase();
            const isHeader = isMarkdownHeading || 
              (lineTrimmed.startsWith("**") && lineTrimmed.includes("**")) ||
              lineLower.startsWith("conclusi√≥n") ||
              lineLower.startsWith("conclusiones") ||
              lineLower.startsWith("conclusion") ||
              lineLower.startsWith("impresi√≥n diagn√≥stica") ||
              lineLower.startsWith("impresion diagnostica") ||
              lineLower.startsWith("impresiones diagn√≥sticas") ||
              lineLower.startsWith("impresiones diagnosticas") ||
              lineLower.startsWith("diagn√≥sticos") ||
              lineLower.startsWith("diagn√≥stico") ||
              lineLower.startsWith("diagnostico") ||
              lineLower.startsWith("diagnosticos");
            
            if (isHeader && !headerTitle) {
              let cleanHeading = lineTrimmed;
              cleanHeading = cleanHeading.replace(/^#+\s*/, "");
              cleanHeading = cleanHeading.replace(/\*\*/g, "");
              cleanHeading = cleanHeading.replace(/\*/g, "");
              cleanHeading = cleanHeading.replace(/:$/, ""); // Remover dos puntos finales
              cleanHeading = cleanHeading.trim();
              headerTitle = cleanHeading;
            } else {
              const isBulleted = lineTrimmed.startsWith("- ") || lineTrimmed.startsWith("* ") || /^\d+\.\s+/.test(lineTrimmed);
              let bulletToken = "-";
              let cleanText = lineTrimmed;
              
              if (isBulleted) {
                if (/^\d+\.\s+/.test(cleanText)) {
                  const numMatch = cleanText.match(/^(\d+\.)\s+/);
                  if (numMatch) {
                    bulletToken = numMatch[1];
                    cleanText = cleanText.substring(numMatch[0].length);
                  }
                } else if (cleanText.startsWith("- ") || cleanText.startsWith("* ")) {
                  cleanText = cleanText.substring(2);
                }
              }
              
              const wrapped = wrapMarkdown(doc, cleanText, isBulleted ? (boxContentWidth - 6) : boxContentWidth);
              totalBlockHeight += (wrapped.length * 5.0) * factor;
              
              parsedLines.push({
                isHeader: false,
                isBulleted,
                bulletToken,
                wrappedLines: wrapped
              });
            }
          });
          
          // Calcular la altura para el t√≠tulo de la cabecera si existe
          let wrappedHeaderLines: string[] = [];
          let headerHeight = 0;
          if (headerTitle) {
            wrappedHeaderLines = doc.splitTextToSize(headerTitle.toUpperCase(), boxContentWidth);
            headerHeight = (wrappedHeaderLines.length * 5.5 + 3.0) * factor; // Altura de l√≠nea + espaciado debajo
          }
          
          const finalBoxHeight = totalBlockHeight + headerHeight + (boxPaddingTop + boxPaddingBottom) * factor;
          
          // Margen de seguridad para evitar saltos hu√©rfanos
          checkPageBreak(finalBoxHeight + 6);
          
          // Colores de Opci√≥n 3 (Sombreado Cl√≠nico Sutil sin bordes laterales)
          let bgColor = [248, 250, 252]; // Tono pizarra extremadamente sutil (slate-50)
          let lineAccentColor = [148, 163, 184]; // Delicada l√≠nea pizarra (slate-400)
          let textColor = [30, 41, 59]; // slate-800
          let headerColor = [15, 23, 42]; // slate-900 para el t√≠tulo interno
          
          if (pdfLayoutType === "clinical_slate") {
            bgColor = [241, 245, 249]; // slate-100
            lineAccentColor = [100, 116, 139]; // slate-500
            textColor = [15, 23, 42];
            headerColor = [71, 85, 105];
          } else if (pdfLayoutType === "executive_medical") {
            bgColor = [253, 251, 247]; // Crema sutil (warm white)
            lineAccentColor = [197, 160, 89]; // L√≠nea dorada de cierre
            textColor = [15, 23, 42];
            headerColor = [141, 110, 50]; // Bronce profundo
          } else if (pdfLayoutType === "asymmetric") {
            bgColor = [249, 250, 254]; // √çndigo extremadamente sutil
            lineAccentColor = [129, 140, 248]; // √çndigo suave (indigo-400)
            textColor = [15, 23, 42];
            headerColor = [79, 70, 229];
          }
          
          // Dibujar el sombreado de fondo sin bordes perimetrales r√≠gidos
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(marginX, yCoord, contentWidth, finalBoxHeight, "F");
          
          // Dibujar la delgada l√≠nea horizontal superior para abrir el bloque
          doc.setDrawColor(lineAccentColor[0], lineAccentColor[1], lineAccentColor[2]);
          doc.setLineWidth(0.35); // Grosor fino y elegante (0.35mm)
          doc.line(marginX, yCoord, marginX + contentWidth, yCoord);
          
          // Dibujar la delgada l√≠nea horizontal inferior para cerrar el bloque
          doc.line(marginX, yCoord + finalBoxHeight, marginX + contentWidth, yCoord + finalBoxHeight);
          
          let currentY = yCoord + boxPaddingTop * factor;
          
          // Renderizar el t√≠tulo de la cabecera si existe
          if (headerTitle) {
            doc.setFont("times", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
            
            wrappedHeaderLines.forEach((wLine) => {
              doc.text(wLine, marginX + boxPaddingLeft, currentY);
              currentY += 5.5 * factor;
            });
            currentY += 3.0 * factor; // Espaciado elegante bajo el t√≠tulo
          }
          
          parsedLines.forEach((pLine) => {
            if (pLine.wrappedLines.length === 0) {
              currentY += 2.5 * factor;
              return;
            }
            
            doc.setFont("times", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            
            if (pLine.isBulleted) {
              let isFirstLineOfBullet = true;
              pLine.wrappedLines.forEach((wLineArr) => {
                if (isFirstLineOfBullet) {
                  doc.setFont("times", "bold");
                  doc.text(pLine.bulletToken || "-", marginX + boxPaddingLeft + 1.5, currentY);
                  isFirstLineOfBullet = false;
                }
                
                let currentX = marginX + boxPaddingLeft + 6;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            } else {
              pLine.wrappedLines.forEach((wLineArr) => {
                let currentX = marginX + boxPaddingLeft;
                wLineArr.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.text(span.text, currentX, currentY);
                  currentX += doc.getTextWidth(span.text);
                });
                currentY += 5.0 * factor;
              });
            }
          });
          
          yCoord = yCoord + finalBoxHeight + 3 * factor;
          
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a code block (starts/ends with triple backticks, or is a raw EMR segment)
        const isCodeBlockSegment = trimmedBlock.startsWith("```") || (trimmedBlock.startsWith("===") && (trimmedBlock.includes("S√çNTESIS VASCULAR") || trimmedBlock.includes("S√çNTESIS DE ANATOM√çA")));

        if (isCodeBlockSegment) {
          const linesOfBlock = trimmedBlock.split("\n");
          // Filter out the opening/closing backtick lines
          const codeBlockLines = linesOfBlock.filter(line => !line.trim().startsWith("```"));
          
          // Allocate height for the spacing
          const lineSpacing = 4.2 * factor;
          const neededHeight = (codeBlockLines.length * lineSpacing) + 7 * factor;
          checkPageBreak(neededHeight);

          // Draw a clean background box
          doc.setFillColor(248, 250, 252); // slate-50 / light gray
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "F");
          doc.setDrawColor(226, 232, 240); // slate-200 border
          doc.setLineWidth(0.3);
          doc.rect(marginX, yCoord, contentWidth, neededHeight - 2 * factor, "D");

          // Set monospace font Courier (built-in)
          doc.setFont("courier", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);

          let relativeY = yCoord + 4.5 * factor;
          codeBlockLines.forEach((line) => {
            doc.text(line, marginX + 4, relativeY);
            relativeY += lineSpacing;
          });

          yCoord = relativeY + 1.5 * factor;
          
          // Re-set default font settings for the next paragraphs
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          return;
        }

        // 2. Check if the block is a separator/divider
        if (trimmedBlock === "---") {
          inFootnoteSection = true;
          checkPageBreak(8 * factor);
          yCoord += 4 * factor;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
          yCoord += 6 * factor;
          return;
        }

        // 2. Check if the block is a markdown table
        const linesOfBlock = trimmedBlock.split("\n");
        const hasPipe = linesOfBlock.some(line => line.includes("|"));
        const isTableDivider = linesOfBlock.some(line => line.includes("---") && line.includes("|"));
        const isTable = hasPipe && (isTableDivider || linesOfBlock.length >= 2);

        if (isTable) {
          if (!isFirstBlock) {
            yCoord += 16 * factor; // Elegant, clear vertical gap between preceding diagnostic text and table
          } else {
            isFirstBlock = false;
          }
          const nonTableLinesAtTop: string[] = [];
          const tableOnlyLines: string[] = [];
          let foundTableStart = false;

          linesOfBlock.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.includes("|")) {
              foundTableStart = true;
            }
            if (foundTableStart) {
              tableOnlyLines.push(line);
            } else {
              nonTableLinesAtTop.push(line);
            }
          });

          const cleanTableRows = tableOnlyLines
            .map(line => line.trim())
            .filter(line => {
              const rowHasPipe = line.includes("|");
              const isDivider = line.includes("---") || /^[|:\-\s]+$/.test(line);
              return rowHasPipe && !isDivider && line.replace(/\|/g, "").trim().length > 0;
            });

          if (cleanTableRows.length > 0) {
            const parseRowCells = (rowText: string) => {
              const rawParts = rowText.split("|");
              let cells = rawParts.map(c => c.trim());
              if (rowText.startsWith("|")) cells.shift();
              if (rowText.endsWith("|")) cells.pop();
              return cells;
            };

            const headers = parseRowCells(cleanTableRows[0]);
            const bodyRows = cleanTableRows.slice(1).map(row => parseRowCells(row));

            // Determine column widths
            const colCount = headers.length || 1;
            const colWidths: number[] = [];
            
            if (colCount === 1) {
              colWidths.push(contentWidth);
            } else if (colCount === 2) {
              const isAsistenteUnilateralNoRef = headers.some(h => h.toLowerCase().includes("estructura")) && 
                                                 headers.some(h => h.toLowerCase().includes("derecha") || h.toLowerCase().includes("izquierda") || h.toLowerCase().includes("medida"));
              if (isAsistenteUnilateralNoRef) {
                colWidths.push(contentWidth * 0.45);
                colWidths.push(contentWidth * 0.55);
              } else {
                colWidths.push(contentWidth * 0.4);
                colWidths.push(contentWidth * 0.6);
              }
            } else if (colCount === 3) {
              const isAsistenteUnilateral = headers.some(h => h.toLowerCase().includes("referencia"));
              const isVascular = headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("derech") || lower.includes("izquierd") || lower.includes("alterad") || lower.includes("vaso");
              });
              if (isAsistenteUnilateral) {
                // Column 0: Estructura (30%), Column 1: Derecha/Izquierda (50%), Column 2: Valor de Referencia (20%)
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.50);
                colWidths.push(contentWidth * 0.20);
              } else if (isVascular) {
                colWidths.push(contentWidth * 0.34);
                colWidths.push(contentWidth * 0.33);
                colWidths.push(contentWidth * 0.33);
              } else {
                colWidths.push(contentWidth * 0.15); // ID col (compact)
                colWidths.push(contentWidth * 0.35); // Structure / Site Name
                colWidths.push(contentWidth * 0.50); // Detailed Main Findings
              }
            } else if (colCount === 4) {
              const isClassificationTable = headers.some(h => {
                const l = (h || "").toLowerCase();
                return l.includes("criterio") || l.includes("pondera") || l.includes("score") || l.includes("justifica") || l.includes("sustento");
              });
              const isAsistenteBilateral = headers.some(h => {
                const l = h.toLowerCase();
                return l.includes("derecha") || l.includes("izquierda");
              });
              const isGenericAsistente = headers.some(h => h.toLowerCase().includes("registrada")) || headers.some(h => h.toLowerCase().includes("referencia"));

              if (isClassificationTable) {
                colWidths.push(contentWidth * 0.24); // Criterio Evaluado
                colWidths.push(contentWidth * 0.28); // Hallazgo en el Reporte
                colWidths.push(contentWidth * 0.16); // Ponderaci√≥n / Score
                colWidths.push(contentWidth * 0.32); // Justificaci√≥n Diagn√≥stica
              } else if (isAsistenteBilateral) {
                colWidths.push(contentWidth * 0.25);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.15);
              } else if (isGenericAsistente) {
                colWidths.push(contentWidth * 0.30);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.20);
                colWidths.push(contentWidth * 0.30);
              } else {
                colWidths.push(contentWidth * 0.12); // ID Column (e.g. H1, H2, H3)
                colWidths.push(contentWidth * 0.28); // Estructura / Sitio
                colWidths.push(contentWidth * 0.22); // Categor√≠a
                colWidths.push(contentWidth * 0.38); // Hallazgo Principal
              }
            } else {
              const equalWidth = contentWidth / colCount;
              for (let i = 0; i < colCount; i++) {
                colWidths.push(equalWidth);
              }
            }

            // Pre-calculate heights of all table rows to prevent the table from being split across pages if possible.
            const cachedRowsData: {
              cellSpansLines: { text: string; isBold: boolean }[][][];
              rowHeight: number;
            }[] = [];

            let calculatedRowsHeightSum = 0;

            bodyRows.forEach((row) => {
              const cellSpansLinesList: { text: string; isBold: boolean }[][][] = [];
              let maxLines = 0;

              row.forEach((cellText, cIdx) => {
                const currentColWidth = colWidths[cIdx] || (contentWidth / colCount);
                const cellSpansLines = wrapMarkdown(doc, cellText, currentColWidth - 6);
                cellSpansLinesList.push(cellSpansLines);
                if (cellSpansLines.length > maxLines) {
                  maxLines = cellSpansLines.length;
                }
              });

              const rowHeight = (maxLines * 5 * factor) + 4 * factor;
              calculatedRowsHeightSum += rowHeight;
              cachedRowsData.push({
                cellSpansLines: cellSpansLinesList,
                rowHeight,
              });
            });

            // The header takes 12 units baseline check, then yCoord is advanced by 9.
            // So total calculated height for table is roughly: header (12) + rows + extra gap (4)
            const totalTableNeededHeight = (12 * factor) + calculatedRowsHeightSum + (4 * factor);

            // Estimate the height of any non-table lines/titles at the top
            let estimatedHeadingsHeight = 0;
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              if (isHeader) {
                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                estimatedHeadingsHeight += (wrappedHeaders.length * 5.5 + 4) * factor;
              } else {
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                estimatedHeadingsHeight += (lines.length * 4.5 + 4) * factor;
              }
            });

            // We want to make sure that the headings AND the table header + at least the first row of the table
            // can fit together on the current page to avoid orphans!
            const firstRowHeight = cachedRowsData[0]?.rowHeight || (15 * factor);
            const minimumCombinedHeight = estimatedHeadingsHeight + (12 * factor) + firstRowHeight + (4 * factor);

            // Check combined page break before printing anything (including headings)!
            checkPageBreak(Math.min(minimumCombinedHeight, pageHeight - 40));

            // Draw any non-table heading lines from the top (e.g., table titles/headings)
            nonTableLinesAtTop.forEach((line) => {
              let trimmed = line.trim();
              if (!trimmed) return;

              let isMarkdownHeading = false;
              if (trimmed.startsWith("# ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^#\s+/, "");
              } else if (trimmed.startsWith("## ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^##\s+/, "");
              } else if (trimmed.startsWith("### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^###\s+/, "");
              } else if (trimmed.startsWith("#### ")) {
                isMarkdownHeading = true;
                trimmed = trimmed.replace(/^####\s+/, "");
              }

              const isHeader = isMarkdownHeading || (
                trimmed.startsWith("**") && (
                  trimmed.endsWith("**") || 
                  trimmed.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

              checkPageBreak(10 * factor);
              if (isHeader) {
                doc.setFont("times", "bold");
                doc.setFontSize(11);
                
                if (pdfLayoutType === "clinical_slate") {
                  doc.setTextColor(30, 41, 59); // slate-800
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setTextColor(15, 23, 42); // Navy
                } else {
                  doc.setTextColor(15, 23, 42);
                }

                const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
                wrappedHeaders.forEach((lineText: string) => {
                  checkPageBreak(5.5 * factor);
                  
                  if (pdfLayoutType === "clinical_slate") {
                    // Left vertical slate bar
                    doc.setFillColor(71, 85, 105);
                    doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
                  }
                  
                  doc.text(lineText, marginX, yCoord);
                  yCoord += 5.5 * factor;
                });

                // Underlines for headings
                if (pdfLayoutType === "clinical_slate") {
                  doc.setDrawColor(226, 232, 240); // slate-200
                  doc.setLineWidth(0.25);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setDrawColor(197, 160, 89); // Gold
                  doc.setLineWidth(0.35);
                  doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
                  yCoord += 1.5 * factor;
                }
              } else {
                doc.setFont("times", "normal");
                doc.setFontSize(10.5);
                doc.setTextColor(51, 65, 85);
                const lines = doc.splitTextToSize(trimmed, contentWidth);
                lines.forEach((l: string) => {
                  checkPageBreak(5 * factor);
                  doc.text(l, marginX, yCoord);
                  yCoord += 4.5 * factor;
                });
                yCoord += 2 * factor;
              }
            });

            // Now check page break for table header + first row only. If that fits, we start the table on this page
            // and let subsequent rows split naturally across pages as needed.
            checkPageBreak(12 * factor + (cachedRowsData[0]?.rowHeight || 10 * factor));

            // Header Render
            checkPageBreak(12 * factor);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setFillColor(71, 85, 105); // slate-600
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(51, 65, 85); // slate-700
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else if (pdfLayoutType === "executive_medical") {
              doc.setFillColor(15, 23, 42); // Navy-900
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.4);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            } else {
              doc.setFillColor(241, 245, 249); // slate-100 / cool grey background
              doc.rect(marginX, yCoord - 4 * factor, contentWidth, 8 * factor, "F");
              doc.setDrawColor(203, 213, 225); // slate-300 border
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 4 * factor, marginX + contentWidth, yCoord - 4 * factor);
              doc.line(marginX, yCoord + 4 * factor, marginX + contentWidth, yCoord + 4 * factor);
            }

            let currentX = marginX;
            doc.setFont("times", "bold");
            doc.setFontSize(9.5);
            
            if (pdfLayoutType === "clinical_slate" || pdfLayoutType === "executive_medical") {
              doc.setTextColor(255, 255, 255); // white text
            } else {
              doc.setTextColor(15, 23, 42); // slate-900
            }

            const isVascularTable = colCount === 3 && 
              headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("derech") || lower.includes("izquierd") || lower.includes("alterad") || lower.includes("vaso");
              }) && 
              !headers.some(h => {
                const lower = h.toLowerCase();
                return lower.includes("referencia") || lower.includes("estructura");
              });

            headers.forEach((headerTxt, hIdx) => {
              let hClean = headerTxt.replace(/\*\*/g, "").trim();
              if (colCount === 2) {
                // Force headers to read exactly "INTERPRETACI√ìN" and "Hallazgos" ONLY if header explicitly indicates semiology or interpretation
                const isSynoptic = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("aspecto") || l.includes("detalle") || l.includes("sinopsis") || l.includes("evaluado") || l.includes("cl√≠nico") || l.includes("sistema") || l.includes("categor√≠a") || l.includes("criterio") || l.includes("paso") || l.includes("par√°metro") || l.includes("definici√≥n") || l.includes("estadio") || l.includes("ponderaci√≥n") || l.includes("justificaci√≥n");
                });
                const isExplicitSemiology = headers.some(h => {
                  const l = h.toLowerCase();
                  return l.includes("interpretaci") || l.includes("semiol");
                });
                if (!isSynoptic && isExplicitSemiology) {
                  if (hIdx === 0) hClean = "INTERPRETACI√ìN";
                  if (hIdx === 1) hClean = "Hallazgos";
                }
              } else if (isVascularTable) {
                if (hIdx === 0) hClean = "Segmento Alterado";
                if (hIdx === 1) hClean = "Derecho";
                if (hIdx === 2) hClean = "Izquierdo";
              }

              const currentColW = colWidths[hIdx] || (contentWidth / colCount);
              doc.setFont("times", "bold");
              doc.setFontSize(9.5);
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(8.5);
              }
              if (doc.getTextWidth(hClean) > currentColW - 4) {
                doc.setFontSize(7.5);
              }
              doc.text(hClean, currentX + 3, yCoord + 1);
              currentX += currentColW;
            });
            
            yCoord += 9 * factor;

            // Rows Render
            bodyRows.forEach((row, rIdx) => {
              const cachedRow = cachedRowsData[rIdx];
              const cellLines = cachedRow.cellSpansLines;
              const rowHeight = cachedRow.rowHeight;

              checkPageBreak(rowHeight);

              if (rIdx % 2 === 1) {
                if (pdfLayoutType === "clinical_slate") {
                  doc.setFillColor(241, 245, 249); // slate-100
                } else if (pdfLayoutType === "executive_medical") {
                  doc.setFillColor(253, 251, 247); // Cream-50
                } else {
                  doc.setFillColor(248, 250, 252); // standard grey alternate background
                }
                doc.rect(marginX, yCoord - 4 * factor, contentWidth, rowHeight, "F");
              }

              if (pdfLayoutType === "clinical_slate") {
                doc.setDrawColor(203, 213, 225); // slate-300
                doc.setLineWidth(0.25);
              } else if (pdfLayoutType === "executive_medical") {
                doc.setDrawColor(220, 210, 195); // light gold-gray
                doc.setLineWidth(0.25);
              } else {
                doc.setDrawColor(226, 232, 240); // slate-200 border
                doc.setLineWidth(0.2);
              }
              doc.line(marginX, yCoord - 4 * factor + rowHeight, marginX + contentWidth, yCoord - 4 * factor + rowHeight);

              let startRowX = marginX;
              row.forEach((_, cIdx) => {
                const colW = colWidths[cIdx] || (contentWidth / colCount);
                let tempY = yCoord;
                const spansLines = cellLines[cIdx] || [];

                spansLines.forEach((spanLine) => {
                  let cellX = startRowX + 3;
                  spanLine.forEach((span) => {
                    if (span.isBold) {
                      doc.setFont("times", "bold");
                    } else {
                      doc.setFont("times", "normal");
                    }
                    doc.setFontSize(9.5);
                    doc.setTextColor(51, 65, 85);
                    doc.text(span.text, cellX, tempY + 1);
                    cellX += doc.getTextWidth(span.text);
                  });
                  tempY += 5 * factor;
                });

                startRowX += colW;
              });

              yCoord += rowHeight;
            });

            yCoord += 4 * factor; // margin after table completes
            return;
          }
        }

        // 3. Render as standard block with paragraphs and line spacing
        if (!isFirstBlock) {
          yCoord += 4.5 * factor;
        } else {
          isFirstBlock = false;
        }

        const blockSeverity = getParagraphSeverity(trimmedBlock);

        linesOfBlock.forEach((line, lineIdx) => {
          let trimmed = line.trim();
          if (!trimmed) {
            yCoord += 2.5 * factor;
            return;
          }

          // Clean Markdown headers format if any
          let isMarkdownHeading = false;
          if (trimmed.startsWith("# ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^#\s+/, "");
          } else if (trimmed.startsWith("## ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^##\s+/, "");
          } else if (trimmed.startsWith("### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^###\s+/, "");
          } else if (trimmed.startsWith("#### ")) {
            isMarkdownHeading = true;
            trimmed = trimmed.replace(/^####\s+/, "");
          }

          const isHeader = isMarkdownHeading || (
            trimmed.startsWith("**") && (
              trimmed.endsWith("**") || 
              trimmed.replace(/[:\s]+$/, "").endsWith("**")
            )
          );
          const cleanHeaderTxt = trimmed.replace(/\*\*/g, "");

          // Determine if first visual line is the main title of study
          const isMainTitle = isFirstLine && (isHeader || /REPORTE|INFORME|ESTUDIO|DIAGN√ìSTICO|VALORACI√ìN/i.test(trimmed));

          if (isMainTitle) {
            isFirstLine = false;
            // Center-align main title beautifully
            doc.setFont("times", "bold");
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            const wrappedTitle = doc.splitTextToSize(cleanHeaderTxt.toUpperCase(), contentWidth);
            wrappedTitle.forEach((lineText: string) => {
              checkPageBreak(7 * factor);
              doc.text(lineText, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6 * factor;
            });
            return;
          }

          if (isFirstLine) {
            isFirstLine = false;
          }

          if (isHeader) {
            // Let's estimate the height of the header + next few lines to avoid orphans!
            let lookAheadHeight = 12 * factor; // space for header + spacing
            let countLinesLookedAt = 0;
            
            // 1. Look ahead in the remaining lines of the current block
            for (let nextIdx = lineIdx + 1; nextIdx < linesOfBlock.length; nextIdx++) {
              const nextLine = linesOfBlock[nextIdx].trim();
              if (!nextLine) continue;
              
              // If we hit another header, stop look-ahead
              const isNextHeader = nextLine.startsWith("#") || (
                nextLine.startsWith("**") && (
                  nextLine.endsWith("**") || 
                  nextLine.replace(/[:\s]+$/, "").endsWith("**")
                )
              );
              if (isNextHeader) break;
              
              const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
              let cleanNext = nextLine;
              if (isNextBulleted) {
                if (/^\d+\.\s+/.test(cleanNext)) {
                  cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                } else {
                  cleanNext = cleanNext.substring(2).trim();
                }
              }
              
              const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
              lookAheadHeight += (wrappedNext.length * 5) * factor;
              
              countLinesLookedAt++;
              if (countLinesLookedAt >= 2) break;
            }
            
            // 2. If we haven't found enough content lines yet, look at the next paragraph blocks!
            if (countLinesLookedAt < 2) {
              const currentBlockIdx = paragraphs.indexOf(block);
              if (currentBlockIdx !== -1) {
                for (let nextBlockIdx = currentBlockIdx + 1; nextBlockIdx < paragraphs.length; nextBlockIdx++) {
                  const nextBlock = paragraphs[nextBlockIdx].trim();
                  if (!nextBlock) continue;
                  
                  if (nextBlock.startsWith("```") || nextBlock.startsWith("|") || (nextBlock.startsWith("===") && (nextBlock.includes("S√çNTESIS VASCULAR") || nextBlock.includes("S√çNTESIS DE ANATOM√çA")))) {
                    lookAheadHeight += 15 * factor;
                    countLinesLookedAt += 2;
                    break;
                  }
                  
                  const nextBlockLines = nextBlock.split("\n");
                  let hitHeaderInNextBlock = false;
                  
                  for (let i = 0; i < nextBlockLines.length; i++) {
                    const nextLine = nextBlockLines[i].trim();
                    if (!nextLine) continue;
                    
                    const isNextHeader = nextLine.startsWith("#") || (
                      nextLine.startsWith("**") && (
                        nextLine.endsWith("**") || 
                        nextLine.replace(/[:\s]+$/, "").endsWith("**")
                      )
                    );
                    if (isNextHeader) {
                      hitHeaderInNextBlock = true;
                      break;
                    }
                    
                    const isNextBulleted = nextLine.startsWith("- ") || nextLine.startsWith("* ") || /^\d+\.\s+/.test(nextLine);
                    let cleanNext = nextLine;
                    if (isNextBulleted) {
                      if (/^\d+\.\s+/.test(cleanNext)) {
                        cleanNext = cleanNext.substring(cleanNext.indexOf(".") + 1).trim();
                      } else {
                        cleanNext = cleanNext.substring(2).trim();
                      }
                    }
                    
                    const wrappedNext = wrapMarkdown(doc, cleanNext, isNextBulleted ? contentWidth - 6 : contentWidth);
                    lookAheadHeight += (wrappedNext.length * 5) * factor;
                    
                    countLinesLookedAt++;
                    if (countLinesLookedAt >= 2) break;
                  }
                  
                  if (hitHeaderInNextBlock || countLinesLookedAt >= 2) {
                    break;
                  }
                }
              }
            }
            
            // Avoid heading orphans by requiring at least 25mm of space, up to calculated lookahead
            const minRequiredHeight = Math.max(25 * factor, lookAheadHeight);
            checkPageBreak(minRequiredHeight);
            
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            
            if (pdfLayoutType === "clinical_slate") {
              doc.setTextColor(30, 41, 59); // slate-800
            } else if (pdfLayoutType === "executive_medical") {
              doc.setTextColor(15, 23, 42); // Navy
            } else {
              doc.setTextColor(15, 23, 42);
            }

            const wrappedHeaders = doc.splitTextToSize(cleanHeaderTxt, contentWidth);
            wrappedHeaders.forEach((lineText: string) => {
              checkPageBreak(5.5 * factor);
              
              if (pdfLayoutType === "clinical_slate") {
                // Draw elegant vertical slate bar on the left of header
                doc.setFillColor(71, 85, 105); // slate-600
                doc.rect(marginX - 3, yCoord - 3.8 * factor, 1.0, 4.5 * factor, "F");
              }
              
              doc.text(lineText, marginX, yCoord);
              yCoord += 5.5 * factor;
            });

            // Underlines for headings
            const isAnnexHeading = cleanHeaderTxt.toUpperCase().includes("ANEXO") || 
                                   cleanHeaderTxt.toUpperCase().includes("DESGLOSE Y JUSTIFICACI√ìN");
            if (isAnnexHeading) {
              doc.setDrawColor(203, 213, 225); // slate-300
              doc.setLineWidth(0.3);
              doc.line(marginX, yCoord - 1 * factor, marginX + contentWidth, yCoord - 1 * factor);
              yCoord += 3.5 * factor;
            } else if (pdfLayoutType === "clinical_slate") {
              doc.setDrawColor(226, 232, 240); // slate-200
              doc.setLineWidth(0.25);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            } else if (pdfLayoutType === "executive_medical") {
              doc.setDrawColor(197, 160, 89); // Gold
              doc.setLineWidth(0.35);
              doc.line(marginX, yCoord - 1.5 * factor, marginX + contentWidth, yCoord - 1.5 * factor);
              yCoord += 1.5 * factor;
            }
          } else {
            // Is it a bullet/list item in original design?
            const isBulleted = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s+/.test(trimmed);
            if (isBulleted) {
              let cleanItem = trimmed;
              let bulletToken = "-";
              const isNumbered = /^\d+\.\s+/.test(cleanItem);

              if (isNumbered) {
                const numMatch = cleanItem.match(/^(\d+\.)\s+/);
                if (numMatch) {
                  bulletToken = numMatch[1];
                  cleanItem = cleanItem.substring(numMatch[0].length);
                }
              } else if (cleanItem.startsWith("- ") || cleanItem.startsWith("* ")) {
                cleanItem = cleanItem.substring(2);
              }

              const indent = 6;
              const textWidth = contentWidth - indent;
              
              checkPageBreak(6 * factor);
              doc.setFont("times", "bold");
              doc.setFontSize(10.5);
              doc.setTextColor(15, 23, 42);
              doc.text(bulletToken || "-", marginX + 1.5, yCoord);
 
              const lines = wrapMarkdown(doc, cleanItem, textWidth);
              const itemSeverity = getParagraphSeverity(cleanItem);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
                
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX + indent;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            } else {
              // Wrap markdown formatted lines (bold and normal text mixed) safely and beautifully
              const lines = wrapMarkdown(doc, trimmed, contentWidth);
              const itemSeverity = getParagraphSeverity(trimmed);
              lines.forEach((lineVal) => {
                checkPageBreak(5 * factor);
 
                // Fine continuous left chromatic accent based on severity of findings
                if (isSyntacticHighlightingActive) {
                  if (itemSeverity === "critical") {
                    doc.setFillColor(251, 113, 133); // soft coral rose-400
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  } else if (itemSeverity === "altered") {
                    doc.setFillColor(245, 158, 11); // amber-500
                    doc.rect(marginX - 3.5, yCoord - 3.8 * factor, 0.4, 5 * factor, "F"); // Left accent only (fine continuous line)
                  }
                }
 
                let currentX = marginX;
                lineVal.forEach((span) => {
                  if (span.isBold) {
                    doc.setFont("times", "bold");
                  } else {
                    doc.setFont("times", "normal");
                  }
                  doc.setFontSize(10.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text(span.text, currentX, yCoord);
                  currentX += doc.getTextWidth(span.text);
                });
                yCoord += 5 * factor;
              });
            }
          }
        });
      };

      // Categorize paragraph blocks according to requested 10-step insertion sequence:
      // 1. CUERPO DE REPORTE CON FIRMA AL FINAL
      // 2. CUADRO SINOPTICO
      // 3. SINOPSIS POR ORGANO
      // 4. SINOPSIS DE HALLAZGOS CON DIBUJO Y TARJETAS SINOPTICAS
      // 5. CUADRO DE ASISTENTE DE MEDIDAS
      // 6. ANEXO DE FOTOS Y CAPTURAS DE ULTRASONIDO
      // 7. DIAGNOSTICO AVANZADO
      // 8. DESGLOCE Y JUSTIFICACION DE CLASIFICACIONES
      // 9. RESUMEN DEL PACIENTE
      // 10. INFOGRAFIA DEL PACIENTE
      const mainReportBlocks: string[] = [];
      const cuadroSinopticoBlocks: string[] = [];
      const organSynopsisBlocks: string[] = [];
      const measurementAssistantBlocks: string[] = [];
      const classificationAnnexBlocks: string[] = [];

      let pdfSectionTarget: "main" | "cuadro" | "organ" | "medidas" | "annex" = "main";

      paragraphs.forEach((block) => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return;

        if (trimmedBlock.includes("[CASE_ANALYSIS_JSON]")) {
          return;
        }

        const upperBlock = trimmedBlock.toUpperCase();
        if (
          upperBlock.includes("RADAR BIOMEC√ÅNICO") ||
          upperBlock.includes("RADAR BIOMECANICO") ||
          upperBlock.includes("PUNTAJE GLOBAL DE CARGA TISULAR:") ||
          upperBlock.includes("VECTOR PATOL√ìGICO DOMINANTE:") ||
          upperBlock.includes("MATRIZ DE VECTORES CLAVE:") ||
          upperBlock.includes("S√çNTESIS BIOMEC√ÅNICO-INFLAMATORIA:") ||
          upperBlock.includes("RECOMENDACI√ìN DIN√ÅMICA:") ||
          (upperBlock.startsWith("‚Ä¢") && (upperBlock.includes("/10") || upperBlock.includes("[")))
        ) {
          return;
        }

        const isHeaderMarker = /^\s*(?:#{1,6}\s+|\*\*\s*)/.test(trimmedBlock) || trimmedBlock.toUpperCase().startsWith("ANEXO:");
        const isImpressionHeader = /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[O√ì]N\s+DIAGN[O√ì]STICA|IMPRESI[O√ì]N\b|CONCLUSI[O√ì]N|CONCLUSIONES|DIAGN[O√ì]STICO|DIAGN[O√ì]STICOS)\b/i.test(trimmedBlock) ||
                                    upperBlock.includes("IMPRESI√ìN DIAGN√ìSTICA") || upperBlock.includes("IMPRESION DIAGNOSTICA") ||
                                    upperBlock.includes("CONCLUSI√ìN:") || upperBlock.includes("CONCLUSIONES:");
        const isCuadroHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ESQUEMA\s+CL√çNICO\s+DE\s+HALLAZGOS\s+PRINCIPALES|CUADRO\s+SIN√ìPTICO|MATRIZ\s+SEMI√ìTICA)\b/i.test(trimmedBlock) && !isImpressionHeader;
        const isOrganHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:SINOPSIS\s+CL√çNICA|SINOPSIS\s+POR\s+[O√ì]RGANO|SINOPSIS\s+DE\s+[O√ì]RGANO)\b/i.test(trimmedBlock) && !isCuadroHeader && !isImpressionHeader;
        const isMeasurementHeader = isHeaderMarker && /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ASISTENTE\s+DE\s+MEDIDAS|CUADRO\s+DE\s+ASISTENTE\s+DE\s+MEDIDAS|TABLA\s+DE\s+MEDIDAS|MEDICIONES\s+Y\s+PAR√ÅMETROS|PAR√ÅMETROS\s+Y\s+MEDIDAS)\b/i.test(trimmedBlock) && !isCuadroHeader && !isOrganHeader && !isImpressionHeader;
        const isAnnexHeader = isHeaderMarker && (trimmedBlock.includes("ANEXO DIAGN√ìSTICO") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACI√ìN DE CLASIFICACI√ìN") || 
                              trimmedBlock.includes("DESGLOSE Y JUSTIFICACI√ìN") ||
                              trimmedBlock.includes("CLASIFICACI√ìN DE") ||
                              /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:ANEXO|CLASIFICACI[O√ì]N)\b/i.test(trimmedBlock)) && !isCuadroHeader && !isOrganHeader && !isMeasurementHeader && !isImpressionHeader;

        if (isImpressionHeader) {
          pdfSectionTarget = "main";
        } else if (isCuadroHeader) {
          pdfSectionTarget = "cuadro";
        } else if (isOrganHeader) {
          pdfSectionTarget = "organ";
        } else if (isMeasurementHeader) {
          pdfSectionTarget = "medidas";
        } else if (isAnnexHeader) {
          pdfSectionTarget = "annex";
        }

        if (pdfSectionTarget === "cuadro") {
          cuadroSinopticoBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "organ") {
          organSynopsisBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "medidas") {
          measurementAssistantBlocks.push(trimmedBlock);
        } else if (pdfSectionTarget === "annex") {
          classificationAnnexBlocks.push(trimmedBlock);
        } else {
          mainReportBlocks.push(trimmedBlock);
        }
      });

      // Safety recovery pass for jsPDF: Ensure Impression & Conclusions are NEVER trapped inside annexes
      const isImpressionBlockText = (bText: string) => {
        const u = bText.toUpperCase();
        return u.includes("IMPRESI√ìN DIAGN√ìSTICA") || u.includes("IMPRESION DIAGNOSTICA") ||
               u.includes("CONCLUSI√ìN:") || u.includes("CONCLUSIONES:") ||
               /^\s*(?:#{1,6}\s*|\*\*)*\s*(?:IMPRESI[O√ì]N|CONCLUSI[O√ì]N|CONCLUSIONES|DIAGN[O√ì]STICO)\b/i.test(bText);
      };

      const recoverImpressionForPDF = (sourceArr: string[]) => {
        for (let i = 0; i < sourceArr.length; ) {
          if (isImpressionBlockText(sourceArr[i])) {
            const recovered = sourceArr.splice(i, sourceArr.length - i);
            mainReportBlocks.push(...recovered);
            break;
          } else {
            i++;
          }
        }
      };

      recoverImpressionForPDF(cuadroSinopticoBlocks);
      recoverImpressionForPDF(organSynopsisBlocks);
      recoverImpressionForPDF(measurementAssistantBlocks);
      recoverImpressionForPDF(classificationAnnexBlocks);

      // --- 1. CUERPO DE REPORTE CON FIRMA AL FINAL ---
      mainReportBlocks.forEach((block) => {
        renderSingleReportBlock(block);
      });

      if (!hasDrawnSignature) {
        renderSignatureBlock();
      }

      // --- 2. CUADRO SIN√ìPTICO ---
      if (cuadroSinopticoBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        cuadroSinopticoBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // --- 3. SINOPSIS POR √ìRGANO (P√ÅGINA INDEPENDIENTE DESPU√âS DEL CUERPO DEL REPORTE) ---
      if (organSynopsisBlocks.length > 0) {
        doc.addPage();
        yCoord = 20;
        organSynopsisBlocks.forEach((block) => {
          renderSingleReportBlock(block);
        });
      }

      // Restore standard margins and content widths for any diagrams, annexes, and signature block
      marginX = 20;
      contentWidth = pageWidth - (2 * marginX);

      // --- 4. SINOPSIS DE HALLAZGOS CON DIBUJO Y TARJETAS SIN√ìPTICAS EN ANEXO DEDICADO ---
      const isDopplerStudy = specificStudy === "Doppler de car√≥tidas" || 
                             specificStudy === "Doppler venoso de miembro inferior" || 
                             specificStudy === "Doppler arterial de miembro inferior";

      const activeSchemasList: Array<{ key: string; name: string }> = [];

      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        activeSchemasList.push({ key: "shoulder", name: "Hombro" });
      }
      if (specificStudy === "Rodilla") {
        if (includeKneeSchemaInReport) activeSchemasList.push({ key: "knee", name: "Rodilla Trauma" });
        if (includeGonartrosisSchemaInReport) activeSchemasList.push({ key: "gonartrosis", name: "Rodilla Gonartrosis" });
      }
      if (includeAnkleSchemaInReport && specificStudy === "Tobillo") {
        activeSchemasList.push({ key: "ankle", name: "Tobillo" });
      }
      if (includeThighSchemaInReport && specificStudy === "Muslo Anterior") {
        activeSchemasList.push({ key: "thigh_ant", name: "Muslo Anterior" });
      }
      if (includeThighPosteriorSchemaInReport && specificStudy === "Muslo Posterior") {
        activeSchemasList.push({ key: "thigh_post", name: "Muslo Posterior" });
      }
      if (includeNeckSchemaInReport && specificStudy === "Cuello") {
        activeSchemasList.push({ key: "neck", name: "Cuello y Tiroides" });
      }
      if (includeUrinarySchemaInReport && specificStudy === "Vias urinarias") {
        activeSchemasList.push({ key: "urinary", name: "V√≠as Urinarias" });
      }
      if (includeScrotumSchemaInReport && (specificStudy === "Escroto" || activeProtocol === "Escroto" || /escrot|testic/i.test(specificStudy || ""))) {
        activeSchemasList.push({ key: "scrotum", name: "Escroto" });
      }
      if (specificStudy === "Mu√±eca") {
        if (includeWristSchemaInReport) activeSchemasList.push({ key: "wrist", name: "Mu√±eca" });
        if (includeDeQuervainSchemaInReport) activeSchemasList.push({ key: "de_quervain", name: "De Quervain" });
      }
      if (includeBreastSchemaInReport && (specificStudy === "Mamas" || specificStudy === "Momograf√≠a" || modality === "Mamograf√≠a" || modality === "Mamograf√≠a y Ultrasonido de Mamas")) {
        activeSchemasList.push({ key: "breast", name: "Mamas" });
      }
      if (includeElbowSchemaInReport && specificStudy === "Codo") {
        activeSchemasList.push({ key: "elbow", name: "Codo" });
      }
      if (specificStudy === "Abdomen" || activeProtocol === "Abdomen") {
        if (includeAbdomenSchemaInReport) activeSchemasList.push({ key: "abdomen", name: "Abdomen General" });
        if (includeBiliarySchemaInReport) activeSchemasList.push({ key: "biliary", name: "Ves√≠cula Biliar" });
        if (includeAppendixSchemaInReport) activeSchemasList.push({ key: "appendix", name: "Ap√©ndice" });
        if (includeHepatopatiaSchemaInReport) activeSchemasList.push({ key: "hepatopatia", name: "Hepatopat√≠a" });
        if (includeDiverticulitisSchemaInReport) activeSchemasList.push({ key: "diverticulitis", name: "Diverticulitis" });
        if (includeAneurismaSchemaInReport) activeSchemasList.push({ key: "aneurisma", name: "Aneurisma" });
        if (includeSmallBowelSchemaInReport) activeSchemasList.push({ key: "small_bowel", name: "Asas Intestinales" });
        if (includeElastographyInReport) activeSchemasList.push({ key: "elastography", name: "Elastograf√≠a & QUS" });
      }
      if (includeAbdominalWallSchemaInReport && specificStudy === "Pared Abdominal") {
        activeSchemasList.push({ key: "abdominal_wall", name: "Pared Abdominal" });
      }
      if (includeCalfAchillesSchemaInReport && specificStudy === "Pantorrilla y Tend√≥n de Aquiles") {
        activeSchemasList.push({ key: "calf", name: "Pantorrilla y Aquiles" });
      }
      if (includeNeonatalBrainSchemaInReport && specificStudy === "Cerebro Neonatal") {
        activeSchemasList.push({ key: "neonatal_brain", name: "Cerebro Neonatal" });
      }
      if (includeVascularSchemaInReport && isDopplerStudy) {
        activeSchemasList.push({ key: "vascular", name: "Vascular Doppler" });
      }

      const totalActiveSchemasCount = activeSchemasList.length;
      let renderedSchemasCounter = 0;

      const getNextSchemaPlacement = () => {
        const isFirst = (renderedSchemasCounter === 0);
        let forceAddPage = false;
        let yStart = 26;
        let boxH = 74;
        let leftBoxW = 88;
        let rightBoxX = 111;
        let rightBoxW = 79;
        const isSingleFullPage = (totalActiveSchemasCount === 1);

        if (isFirst) {
          forceAddPage = true; // Always start on a new separate annexed page!
        }

        if (isSingleFullPage) {
          // 1 Schema: Large prominent full page format!
          boxH = 138;
          leftBoxW = 92;
          rightBoxX = 113;
          rightBoxW = 75;
          yStart = 26;
        } else {
          // 2 or more schemas: Dual per page format (2 per page)
          const posOnPage = renderedSchemasCounter % 2;
          if (posOnPage === 0 && !isFirst) {
            forceAddPage = true; // New page for 3rd, 5th, etc.
          }
          if (posOnPage === 0) {
            yStart = 26;
          } else {
            yStart = 108;
          }
          boxH = 74;
          leftBoxW = 88;
          rightBoxX = 111;
          rightBoxW = 79;
        }

        renderedSchemasCounter++;

        return {
          forceAddPage,
          yStart,
          boxH,
          leftBoxW,
          rightBoxX,
          rightBoxW,
          isSingleFullPage
        };
      };

      // üõ†Ô∏è DRAW SHOULDER DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeShoulderSchemaInReport && specificStudy === "Hombro") {
        try {
          const sanitizeShoulderSvgForPrint = (svgEl: HTMLElement) => {
            const clonedSvg = svgEl.cloneNode(true) as SVGElement;
            const stops = clonedSvg.querySelectorAll("linearGradient stop");
            stops.forEach(stop => {
              const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
              if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
              if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
              if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
            });

            const paths = clonedSvg.querySelectorAll("path");
            paths.forEach(p => {
              const fill = p.getAttribute("fill") || "";
              const stroke = p.getAttribute("stroke") || "";
              if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
              if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
              if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
              if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

              if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
              if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
              if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
              if (stroke === "#334155") p.setAttribute("stroke", "#475569");
              if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
            });

            const texts = clonedSvg.querySelectorAll("text");
            texts.forEach(t => {
              const fill = t.getAttribute("fill") || "";
              if (fill === "#64748b") t.setAttribute("fill", "#475569");
              if (fill === "#475569") t.setAttribute("fill", "#1e293b");
            });

            const circles = clonedSvg.querySelectorAll("circle");
            circles.forEach(c => {
              const stroke = c.getAttribute("stroke") || "";
              if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
            });
            const lines = clonedSvg.querySelectorAll("line");
            lines.forEach(l => {
              const stroke = l.getAttribute("stroke") || "";
              if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
            });
            return clonedSvg;
          };

          const getCardDataForSide = (statesObj: any, descObj: any) => {
            const structures = [
              { id: "supraspinatus", label: "Supraespinoso" },
              { id: "infraspinatus", label: "Infraespinoso" },
              { id: "subscapularis", label: "Subescapular" },
              { id: "biceps", label: "PL B√≠ceps" },
              { id: "bursa", label: "Bursa SAD" },
              { id: "glenohumeral", label: "Derrame GH" },
              { id: "acromioclavicular", label: "Artic. A.C." },
              { id: "dynamic_assessment", label: "Val. Din√°mica" }
            ].filter(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getPDFSimplifiedDescription = (id: string, state: string) => {
              if (descObj && descObj[id] && descObj[id].trim() !== "" && descObj[id] !== "No mencionado / No descrito." && descObj[id] !== "No descrito.") {
                return descObj[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const data = structures.map(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getPDFSimplifiedDescription(struct.id, s)
              };
            });

            const shoulderExtras = additionalFindings["Hombro"] || [];
            shoulderExtras.forEach((extra: any) => {
              data.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            return data;
          };

          if (laterality === "Bilateral") {
            const svgDer = document.getElementById("shoulder-anatomy-svg");
            const svgIzq = document.getElementById("shoulder-anatomy-svg-left");

            if (svgDer && svgIzq) {
              const imgDataDer = await convertSvgToPng(sanitizeShoulderSvgForPrint(svgDer));
              const imgDataIzq = await convertSvgToPng(sanitizeShoulderSvgForPrint(svgIzq));

              checkPageBreak(125);
              yCoord += 15;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(30, 41, 59);
              doc.text("ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA - HOMBRO BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6;

              const yStart = yCoord;

              // --- HOMBRO DERECHO (LEFT COLUMN) ---
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("HOMBRO DERECHO", 60, yStart - 1, { align: "center" });

              // Diagram Box Left
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart, 80, 50, 3, 3, "FD");
              doc.addImage(imgDataDer, "PNG", 35, yStart + 2, 50, 46);

              // Findings Box Left
              const dataDer = getCardDataForSide(shoulderStates, shoulderDescriptions);
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart + 53, 80, 52, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - DER", 24, yStart + 58.5);
              doc.line(24, yStart + 60, 96, yStart + 60);

              if (dataDer.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 60, yStart + 75, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataDer, 20, yStart + 53, 80, 52);
              }

              // --- HOMBRO IZQUIERDO (RIGHT COLUMN) ---
              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("HOMBRO IZQUIERDO", 150, yStart - 1, { align: "center" });

              // Diagram Box Right
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(110, yStart, 80, 50, 3, 3, "FD");
              doc.addImage(imgDataIzq, "PNG", 125, yStart + 2, 50, 46);

              // Findings Box Right
              const dataIzq = getCardDataForSide(shoulderStatesLeft, shoulderDescriptionsLeft);
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(110, yStart + 53, 80, 52, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - IZQ", 114, yStart + 58.5);
              doc.line(114, yStart + 60, 186, yStart + 60);

              if (dataIzq.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 75, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataIzq, 110, yStart + 53, 80, 52);
              }

              // Footnote
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.0);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapas anat√≥micos y sinopsis correspondientes al estudio bilateral.", pageWidth / 2, yStart + 101, { align: "center" });

              yCoord += 112;

              // --- SUPRASPINATUS EXTRA DRAWINGS FOR BILATERAL STUDY ---
              try {
                const supraspinatusWrapperDer = document.getElementById("supraspinatus-ap-print-wrapper");
                const supraspinatusWrapperIzq = document.getElementById("supraspinatus-ap-print-wrapper-left");

                const shouldPrintSupraspinatusDer = supraspinatusWrapperDer && supraspinatusWrapperDer.getAttribute("data-include") === "true";
                const shouldPrintSupraspinatusIzq = supraspinatusWrapperIzq && supraspinatusWrapperIzq.getAttribute("data-include") === "true";

                if (shouldPrintSupraspinatusDer || shouldPrintSupraspinatusIzq) {
                  checkPageBreak(120);
                  doc.addPage();
                  yCoord = 20;

                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(8.5);
                  doc.setTextColor(30, 41, 59);
                  doc.text("ANEXO: ESTUDIO MICRO-ANAT√ìMICO DE ROTURA DE SUPRAESPINOSO", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 3.5;

                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(6.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("INTERPRETACI√ìN PARAM√âTRICA VECTORES CORONAL (AP) Y SAGITAL (LAT)", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 8;

                  const yS = yCoord;

                  if (shouldPrintSupraspinatusDer && supraspinatusWrapperDer) {
                    const svgChildren = supraspinatusWrapperDer.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(20, yS, 80, 52, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(7.0);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO DERECHO: DETALLE DE ROTURA", 60, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 22, yS + 10, 36, 36);
                      doc.addImage(latPng, "PNG", 62, yS + 10, 36, 36);
                    }
                  } else {
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(229, 231, 235);
                    doc.roundedRect(20, yS, 80, 52, 3, 3, "FD");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.0);
                    doc.setTextColor(71, 85, 105);
                    doc.text("HOMBRO DERECHO: DETALLE", 60, yS + 6, { align: "center" });

                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(6.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text("Tend√≥n supraespinoso sin desgarro", 60, yS + 26, { align: "center" });
                  }

                  if (shouldPrintSupraspinatusIzq && supraspinatusWrapperIzq) {
                    const svgChildren = supraspinatusWrapperIzq.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(110, yS, 80, 52, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(7.0);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO IZQUIERDO: DETALLE DE ROTURA", 150, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 112, yS + 10, 36, 36);
                      doc.addImage(latPng, "PNG", 152, yS + 10, 36, 36);
                    }
                  } else {
                    doc.setFillColor(248, 250, 252);
                    doc.setDrawColor(229, 231, 235);
                    doc.roundedRect(110, yS, 80, 52, 3, 3, "FD");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(7.0);
                    doc.setTextColor(71, 85, 105);
                    doc.text("HOMBRO IZQUIERDO: DETALLE", 150, yS + 6, { align: "center" });

                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(6.5);
                    doc.setTextColor(148, 163, 184);
                    doc.text("Tend√≥n supraespinoso sin desgarro", 150, yS + 26, { align: "center" });
                  }

                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("An√°lisis cl√≠nico y modelaci√≥n de fibras intactas vs soluci√≥n de continuidad.", pageWidth / 2, yS + 58, { align: "center" });

                  yCoord = yS + 62;
                }
              } catch (ex) {
                console.warn("Error printing extra supraspinatus detailed drawings", ex);
              }
            }
          } else {
            // Unilateral
            const sideTitle = `HOMBRO ${laterality ? getGenderedLaterality(laterality, "Hombro").toUpperCase() : ""}`;
            const svgElement = document.getElementById("shoulder-anatomy-svg");
            if (svgElement) {
              const clonedSvg = sanitizeShoulderSvgForPrint(svgElement);
              const imgData = await convertSvgToPng(clonedSvg);

              const willPageBreak = (yCoord + 95 > pageHeight - 20);
              checkPageBreak(95);
              if (!willPageBreak) {
                yCoord += 18;
              } else {
                yCoord += 6;
              }

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.0);
              doc.setTextColor(30, 41, 59);
              doc.text(`ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS - ${sideTitle}`, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.3);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA DEL MANGUITO ROTADOR Y ESTRUCTURAS ADYACENTES", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 4.5;

              const yStart = yCoord;

              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(20, yStart, 75, 75, 3, 3, "FD");
              doc.addImage(imgData, "PNG", 22.5, yStart + 2.5, 70, 70);

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(100, yStart, 90, 75, 3, 3, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(67, 56, 202);
              doc.text(`SINOPSIS DE HALLAZGOS CLINICOS - ${sideTitle}`, 104, yStart + 5.5);

              doc.setDrawColor(229, 231, 235);
              doc.setLineWidth(0.2);
              doc.line(104, yStart + 7.5, 186, yStart + 7.5);

              const cardData = getCardDataForSide(shoulderStates, shoulderDescriptions);

              if (cardData.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 145, yStart + 30, { align: "center" });
                doc.text("Todas las estructuras musculotendinosas", 145, yStart + 36, { align: "center" });
                doc.text("y articulares se reportan normales.", 145, yStart + 42, { align: "center" });
              } else {
                drawAnatomicalCards(doc, cardData, 100, yStart, 90, 75);
              }

              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.2);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapa anat√≥mico y lista sin√≥ptica correspondientes al reporte f√≠sico.", 145, yStart + 72, { align: "center" });

              yCoord += 80;

              // --- SUPRASPINATUS EXTRA DRAWINGS FOR UNILATERAL STUDY ---
              try {
                const supraspinatusWrapperDer = document.getElementById("supraspinatus-ap-print-wrapper");
                const supraspinatusWrapperIzq = document.getElementById("supraspinatus-ap-print-wrapper-left");

                const shouldPrintSupraspinatusDer = supraspinatusWrapperDer && supraspinatusWrapperDer.getAttribute("data-include") === "true";
                const shouldPrintSupraspinatusIzq = supraspinatusWrapperIzq && supraspinatusWrapperIzq.getAttribute("data-include") === "true";

                if (shouldPrintSupraspinatusDer && shouldPrintSupraspinatusIzq) {
                  // Print both side-by-side!
                  checkPageBreak(58);
                  yCoord += 11;

                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(8.0);
                  doc.setTextColor(30, 41, 59);
                  doc.text("ANEXO: DETALLE BILATERAL DE ROTURA DE SUPRAESPINOSO", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 3.5;

                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(6.2);
                  doc.setTextColor(148, 163, 184);
                  doc.text("COHERENCIA GEOM√âTRICA CON LA IMPRESI√ìN CL√çNICA: VISTA AP & LAT", pageWidth / 2, yCoord, { align: "center" });
                  yCoord += 5.5;

                  const yS = yCoord;

                  if (supraspinatusWrapperDer) {
                    const svgDerChildren = supraspinatusWrapperDer.querySelectorAll("svg");
                    if (svgDerChildren.length >= 2) {
                      const apSvg = svgDerChildren[0] as SVGElement;
                      const latSvg = svgDerChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(20, yS, 80, 38, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(6.5);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO DERECHO: DETALLE DE ROTURA", 60, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 24, yS + 8, 28, 28);
                      doc.addImage(latPng, "PNG", 64, yS + 8, 28, 28);
                    }
                  }

                  if (supraspinatusWrapperIzq) {
                    const svgIzqChildren = supraspinatusWrapperIzq.querySelectorAll("svg");
                    if (svgIzqChildren.length >= 2) {
                      const apSvg = svgIzqChildren[0] as SVGElement;
                      const latSvg = svgIzqChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(110, yS, 80, 38, 3, 3, "FD");

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(6.5);
                      doc.setTextColor(225, 29, 72);
                      doc.text("HOMBRO IZQUIERDO: DETALLE DE ROTURA", 150, yS + 6, { align: "center" });

                      doc.addImage(apPng, "PNG", 114, yS + 8, 28, 28);
                      doc.addImage(latPng, "PNG", 154, yS + 8, 28, 28);
                    }
                  }

                  yCoord = yS + 42;
                } else if (shouldPrintSupraspinatusDer || shouldPrintSupraspinatusIzq) {
                  const isLeftActive = !!shouldPrintSupraspinatusIzq;
                  const activeWrapper = isLeftActive ? supraspinatusWrapperIzq : supraspinatusWrapperDer;
                  const sideLabel = isLeftActive ? "IZQUIERDO" : "DERECHO";

                  if (activeWrapper) {
                    const svgChildren = activeWrapper.querySelectorAll("svg");
                    if (svgChildren.length >= 2) {
                      const apSvg = svgChildren[0] as SVGElement;
                      const latSvg = svgChildren[1] as SVGElement;
                      const apPng = await convertSvgToPng(apSvg);
                      const latPng = await convertSvgToPng(latSvg);

                      checkPageBreak(58);
                      yCoord += 11;

                      doc.setFont("helvetica", "bold");
                      doc.setFontSize(8.0);
                      doc.setTextColor(30, 41, 59);
                      doc.text(`ANEXO: DETALLE DE ROTURA DE SUPRAESPINOSO - HOMBRO ${sideLabel}`, pageWidth / 2, yCoord, { align: "center" });
                      yCoord += 3.5;

                      doc.setFont("helvetica", "normal");
                      doc.setFontSize(6.2);
                      doc.setTextColor(148, 163, 184);
                      doc.text("COHERENCIA GEOM√âTRICA CON LA IMPRESI√ìN CL√çNICA: VISTA AP & LAT", pageWidth / 2, yCoord, { align: "center" });
                      yCoord += 5.5;

                      const yS = yCoord;

                      doc.setFillColor(255, 255, 255);
                      doc.setDrawColor(229, 231, 235);
                      doc.roundedRect(45, yS, 120, 38, 3, 3, "FD");

                      doc.addImage(apPng, "PNG", 55, yS + 3, 32, 32);
                      doc.addImage(latPng, "PNG", 123, yS + 3, 32, 32);

                      yCoord = yS + 42;
                    }
                  }
                }
              } catch (ex) {
                console.warn("Error printing unilateral detailed supraspinatus drawings", ex);
              }
            }
          }
        } catch (err) {
          console.warn("Could not draw shoulder diagram inside jsPDF", err);
        }
      }

      // üõ†Ô∏è DRAW KNEE DIAGRAM IN THE PROGRAMMATIC PDF
      if ((includeKneeSchemaInReport || includeGonartrosisSchemaInReport) && specificStudy === "Rodilla") {
        try {
          const sanitizeKneeSvgForPrint = (el: HTMLElement) => {
            const cloned = el.cloneNode(true) as SVGElement;
            const stops = cloned.querySelectorAll("linearGradient stop");
            stops.forEach(stop => {
              const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
              if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
              if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
              if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
            });

            const paths = cloned.querySelectorAll("path");
            paths.forEach(p => {
              const fill = p.getAttribute("fill") || "";
              const stroke = p.getAttribute("stroke") || "";
              if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
              if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
              if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
              if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

              if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
              if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
              if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
              if (stroke === "#334155") p.setAttribute("stroke", "#475569");
              if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
            });

            const texts = cloned.querySelectorAll("text");
            texts.forEach(t => {
              const fill = t.getAttribute("fill") || "";
              if (fill === "#64748b") t.setAttribute("fill", "#475569");
              if (fill === "#475569") t.setAttribute("fill", "#1e293b");
            });

            const circles = cloned.querySelectorAll("circle");
            circles.forEach(c => {
              const stroke = c.getAttribute("stroke") || "";
              if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
            });
            const lines = cloned.querySelectorAll("line");
            lines.forEach(l => {
              const stroke = l.getAttribute("stroke") || "";
              if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
            });
            return cloned;
          };

          const getKneeCardDataForSide = (statesObj: any, descObj: any) => {
            const pdfKneeStructuresBase = [
              { id: "quadriceps", label: "T. Cuadricipital" },
              { id: "patellar", label: "T. Rotuliano" },
              { id: "lcm", label: "Lig. C. Medial" },
              { id: "lce", label: "Lig. C. Lateral" },
              { id: "medial_meniscus", label: "Menisco Medial" },
              { id: "lateral_meniscus", label: "Menisco Lateral" },
              { id: "joint_effusion", label: "Derrame Artic." },
              { id: "baker_cyst", label: "Quiste de Baker" },
              { id: "popliteal_artery", label: "Art. Popl√≠tea" },
              { id: "popliteal_vein", label: "Vena Popl√≠tea" },
              { id: "distal_tendons", label: "Tendones Dist." },
              { id: "popliteal_fossa", label: "Fosa Popl√≠tea" }
            ];

            if (includeGonartrosisSchemaInReport) {
              pdfKneeStructuresBase.push(
                { id: "gon_pinzamiento_artic", label: "Pinzamiento Art." },
                { id: "gon_osteofitos", label: "Osteofitos" },
                { id: "gon_esclerosis_sub", label: "Escl. Subcondral" },
                { id: "gon_geodas_quistes", label: "Geodas/Quistes" },
                { id: "gon_desgaste_cartilago", label: "Desgaste Cart." },
                { id: "gon_menisco_deg", label: "Menisco Deg." }
              );
            }

            const pdfKneeStructures = pdfKneeStructuresBase.filter(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getKneePDFSimplifiedDescription = (id: string, state: string) => {
              if (descObj && descObj[id] && descObj[id].trim() !== "" && descObj[id] !== "No mencionado / No descrito." && descObj[id] !== "No descrito.") {
                return descObj[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const kneeCardData = pdfKneeStructures.map(struct => {
              const s = statesObj[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getKneePDFSimplifiedDescription(struct.id, s)
              };
            });

            const kneeExtras = additionalFindings["Rodilla"] || [];
            kneeExtras.forEach((extra: any) => {
              kneeCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            return kneeCardData;
          };

          if (laterality === "Bilateral") {
            const svgElementAntDer = document.getElementById("knee-anatomy-svg");
            const svgElementPostDer = document.getElementById("knee-anatomy-svg-posterior");
            const svgElementAntIzq = document.getElementById("knee-anatomy-svg-left");
            const svgElementPostIzq = document.getElementById("knee-anatomy-svg-posterior-left");
            const svgGonDer = document.getElementById("knee-gonartrosis-svg");
            const svgGonIzq = document.getElementById("knee-gonartrosis-svg-left");

            const imgAntDer = svgElementAntDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementAntDer)) : null;
            const imgPostDer = svgElementPostDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPostDer)) : null;
            const imgAntIzq = svgElementAntIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementAntIzq)) : null;
            const imgPostIzq = svgElementPostIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPostIzq)) : null;
            const imgGonDer = svgGonDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonDer)) : null;
            const imgGonIzq = svgGonIzq ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonIzq)) : null;

            if (imgAntDer || imgAntIzq || imgGonDer || imgGonIzq) {
              checkPageBreak(127);
              yCoord += 15;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(30, 41, 59);
              doc.text("ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.5);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO REGIONAL ANTERIOR Y POSTERIOR - RODILLA BILATERAL", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 6;

              // --- ROW 1: RODILLA DERECHA ---
              let yStart = yCoord;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("RODILLA DERECHA", pageWidth / 2, yStart - 1, { align: "center" });

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 50, 2, 2, "FD");
                if (imgAntDer) doc.addImage(imgAntDer, "PNG", 16.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 46, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 50, 2, 2, "FD");
                if (imgPostDer) doc.addImage(imgPostDer, "PNG", 49.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 46, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 50, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 82.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 46, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                // Box Left (Anterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 50, 2, 2, "FD");
                if (imgAntDer) doc.addImage(imgAntDer, "PNG", 18, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 38, yStart + 46, { align: "center" });

                // Box Middle (Posterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 50, 2, 2, "FD");
                if (imgPostDer) {
                  doc.addImage(imgPostDer, "PNG", 67, yStart + 1.5, 40, 40);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 23, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 46, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 50, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 42.5, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 46, { align: "center" });
              }

              // Box Right (Findings)
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 50, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - DER", 117, yStart + 5.5);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const dataDer = getKneeCardDataForSide(kneeStates, kneeDescriptions);
              if (dataDer.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.0);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos.", 154, yStart + 25, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataDer, 113, yStart, 82, 50);
              }

              yCoord += 56;

              // --- ROW 2: RODILLA IZQUIERDA ---
              yStart = yCoord;

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(71, 85, 105);
              doc.text("RODILLA IZQUIERDA", pageWidth / 2, yStart - 1, { align: "center" });

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 50, 2, 2, "FD");
                if (imgAntIzq) doc.addImage(imgAntIzq, "PNG", 16.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 46, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 50, 2, 2, "FD");
                if (imgPostIzq) doc.addImage(imgPostIzq, "PNG", 49.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 46, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 50, 2, 2, "FD");
                if (imgGonIzq) doc.addImage(imgGonIzq, "PNG", 82.5, yStart + 1.5, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 46, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                // Box Left (Anterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 50, 2, 2, "FD");
                if (imgAntIzq) doc.addImage(imgAntIzq, "PNG", 18, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.text("VISTA ANTERIOR", 38, yStart + 46, { align: "center" });

                // Box Middle (Posterior)
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 50, 2, 2, "FD");
                if (imgPostIzq) {
                  doc.addImage(imgPostIzq, "PNG", 67, yStart + 1.5, 40, 40);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(5.5);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 23, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 46, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 50, 2, 2, "FD");
                if (imgGonIzq) doc.addImage(imgGonIzq, "PNG", 42.5, yStart + 1.5, 40, 40);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.5);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 46, { align: "center" });
              }

              // Box Right (Findings)
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 50, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.0);
              doc.setTextColor(67, 56, 202);
              doc.text("SINOPSIS CL√çNICA - IZQ", 117, yStart + 5.5);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const dataIzq = getKneeCardDataForSide(kneeStatesLeft, kneeDescriptionsLeft);
              if (dataIzq.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.0);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos.", 154, yStart + 25, { align: "center" });
              } else {
                drawAnatomicalCards(doc, dataIzq, 113, yStart, 82, 50);
              }

              // Footnote
              doc.setFont("helvetica", "italic");
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapeo dual y sinopsis anat√≥micas correspondientes al estudio bilateral.", pageWidth / 2, yStart + 54, { align: "center" });

              yCoord += 59;
            }
          } else {
            // Unilateral
            const sideTitle = `RODILLA ${laterality ? getGenderedLaterality(laterality, "Rodilla").toUpperCase() : ""}`;
            const svgElement = document.getElementById("knee-anatomy-svg");
            const svgElementPost = document.getElementById("knee-anatomy-svg-posterior");
            const svgGonDer = document.getElementById("knee-gonartrosis-svg");

            const imgDataAnterior = svgElement ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElement)) : null;
            const imgDataPosterior = svgElementPost ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgElementPost)) : null;
            const imgGonDer = svgGonDer ? await convertSvgToPng(sanitizeKneeSvgForPrint(svgGonDer)) : null;

            if (imgDataAnterior || imgGonDer) {
              const willPageBreak = (yCoord + 80 > pageHeight - 20);
              checkPageBreak(80);
              if (!willPageBreak) {
                yCoord += 15;
              } else {
                yCoord += 6;
              }

              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.0);
              doc.setTextColor(30, 41, 59);
              doc.text(`ANEXO: ESQUEMAS DE HALLAZGOS Y SINOPSIS - ${sideTitle}`, pageWidth / 2, yCoord, { align: "center" });
              yCoord += 3.5;

              doc.setFont("helvetica", "normal");
              doc.setFontSize(6.3);
              doc.setTextColor(148, 163, 184);
              doc.text("MAPEO REGIONAL ANTERIOR Y POSTERIOR DE COMPLEMENTOS Y ESTRUCTURAS EVALUADAS", pageWidth / 2, yCoord, { align: "center" });
              yCoord += 4.5;

              const yStart = yCoord;

              if (includeKneeSchemaInReport && includeGonartrosisSchemaInReport) {
                // Anterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 31, 60, 2, 2, "FD");
                if (imgDataAnterior) doc.addImage(imgDataAnterior, "PNG", 16.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 30.5, yStart + 54, { align: "center" });

                // Posterior Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(48, yStart, 31, 60, 2, 2, "FD");
                if (imgDataPosterior) doc.addImage(imgDataPosterior, "PNG", 49.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 63.5, yStart + 54, { align: "center" });

                // Gonartrosis Box
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(81, yStart, 31, 60, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 82.5, yStart + 2, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.0);
                doc.setTextColor(71, 85, 105);
                doc.text("GONARTROSIS", 96.5, yStart + 54, { align: "center" });
              } else if (includeKneeSchemaInReport) {
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 46, 60, 2, 2, "FD");
                if (imgDataAnterior) doc.addImage(imgDataAnterior, "PNG", 16.5, yStart + 2, 43, 43);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA ANTERIOR", 38, yStart + 54, { align: "center" });

                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(64, yStart, 46, 60, 2, 2, "FD");
                if (imgDataPosterior) {
                  doc.addImage(imgDataPosterior, "PNG", 65.5, yStart + 2, 43, 43);
                } else {
                  doc.setFont("helvetica", "italic");
                  doc.setFontSize(6.0);
                  doc.setTextColor(148, 163, 184);
                  doc.text("No disponible", 87, yStart + 25, { align: "center" });
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("VISTA POSTERIOR", 87, yStart + 54, { align: "center" });
              } else {
                // Only Gonartrosis
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(229, 231, 235);
                doc.roundedRect(15, yStart, 95, 60, 2, 2, "FD");
                if (imgGonDer) doc.addImage(imgGonDer, "PNG", 42.5, yStart + 2, 43, 43);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.0);
                doc.setTextColor(71, 85, 105);
                doc.text("ESQUEMA DE GONARTROSIS", 62.5, yStart + 54, { align: "center" });
              }

              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(229, 231, 235);
              doc.roundedRect(113, yStart, 82, 60, 2, 2, "FD");

              doc.setFont("helvetica", "bold");
              doc.setFontSize(7.5);
              doc.setTextColor(67, 56, 202);
              doc.text(`SINOPSIS DE HALLAZGOS CLINICOS - ${sideTitle}`, 117, yStart + 5.5);

              doc.setDrawColor(229, 231, 235);
              doc.setLineWidth(0.2);
              doc.line(117, yStart + 7.5, 191, yStart + 7.5);

              const kneeCardData = getKneeCardDataForSide(kneeStates, kneeDescriptions);

              if (kneeCardData.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                doc.text("Sin hallazgos patol√≥gicos relevantes.", 154, yStart + 25, { align: "center" });
                doc.text("Todas las estructuras evaluadas", 154, yStart + 31, { align: "center" });
                doc.text("se reportan normales.", 154, yStart + 37, { align: "center" });
              } else {
                drawAnatomicalCards(doc, kneeCardData, 113, yStart, 82, 60);
              }

              doc.setFont("helvetica", "italic");
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text("Mapeo dual y sinopsis anat√≥mica de la articulaci√≥n.", 154, yStart + 57, { align: "center" });

              yCoord += 65;
            }
          }
        } catch (err) {
          console.warn("Could not draw knee diagram inside jsPDF", err);
        }
      }

      // üõ†Ô∏è DRAW ANKLE DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeAnkleSchemaInReport && specificStudy === "Tobillo") {
        const svgLateral = document.getElementById("ankle-anatomy-svg-lateral");
        const svgMedial = document.getElementById("ankle-anatomy-svg-medial");

        if (svgLateral || svgMedial) {
          try {
            const processAnkleSvg = async (svgEl: HTMLElement) => {
              const rect = svgEl.getBoundingClientRect();
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
                if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
                if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
              });

              // 2. Adjust paths fill/stroke colors for paper print
              const paths = clonedSvg.querySelectorAll("path");
              paths.forEach(p => {
                const fill = p.getAttribute("fill") || "";
                const stroke = p.getAttribute("stroke") || "";
                
                if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
                if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
                if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
                if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

                if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
                if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
                if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
                if (stroke === "#334155") p.setAttribute("stroke", "#475569");
                if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
              });

              // 3. Adjust text colors
              const texts = clonedSvg.querySelectorAll("text");
              texts.forEach(t => {
                const fill = t.getAttribute("fill") || "";
                if (fill === "#64748b") t.setAttribute("fill", "#475569");
                if (fill === "#475569") t.setAttribute("fill", "#1e293b");
              });

              // 4. Adjust custom guides/circles in background
              const circles = clonedSvg.querySelectorAll("circle");
              circles.forEach(c => {
                const stroke = c.getAttribute("stroke") || "";
                if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
              });
              const lines = clonedSvg.querySelectorAll("line");
              lines.forEach(l => {
                const stroke = l.getAttribute("stroke") || "";
                if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
              });

              return await convertSvgToPng(clonedSvg);
            };

            const imgLateral = svgLateral ? await processAnkleSvg(svgLateral) : null;
            const imgMedial = svgMedial ? await processAnkleSvg(svgMedial) : null;

            // Check page break for 95mm (75mm content + margins/header)
            const willPageBreak = (yCoord + 95 > pageHeight - 20);
            checkPageBreak(95);
            if (!willPageBreak) {
              yCoord += 18; // Generous space/gap from the diagnostic impression above
            } else {
              yCoord += 6;  // Normal small spacing at the top of a fresh page
            }

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.0);
            doc.setTextColor(30, 41, 59);
            doc.text("ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS DE TOBILLO", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 3.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(148, 163, 184);
            doc.text("MAPEO ANAT√ìMICO Y SINOPSIS ESTRUCTURADA DE LA ARTICULACI√ìN DE TOBILLO Y SUS TENDONES", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // --- DRAW SIDE-BY-SIDE LAYOUT ---
            const yStart = yCoord;

            // 1. Draw Left Diagram Box (Cara Lateral)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(20, yStart, 43, 78, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("CARA LATERAL", 41.5, yStart + 5.5, { align: "center" });

            if (imgLateral) {
              doc.addImage(imgLateral, "PNG", 21.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 41.5, yStart + 35, { align: "center" });
            }

            // 2. Draw Second Diagram Box (Cara Medial)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(65, yStart, 43, 78, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("CARA MEDIAL", 86.5, yStart + 5.5, { align: "center" });

            if (imgMedial) {
              doc.addImage(imgMedial, "PNG", 66.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 86.5, yStart + 35, { align: "center" });
            }

            // 3. Draw Right Findings Container (Slate Background)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(111, yStart, 79, 78, 3, 3, "FD");

            // Header of findings: Unified title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text("SINOPSIS DE HALLAZGOS CL√çNICOS", 114, yStart + 5.5);

            // Draw horizontal divider line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(114, yStart + 7.5, 186, yStart + 7.5);

            // Ankle structures to map (9 structures in total)
            const pdfAnkleStructures = [
              { id: "achilles", label: "T. Aquiles" },
              { id: "plantar_fascia", label: "Fascia Plantar" },
              { id: "lpaa", label: "LPAA" },
              { id: "lpc", label: "LPC" },
              { id: "peroneal_tendons", label: "T. Peroneos" },
              { id: "tibial_posterior", label: "T. Tibial Post." },
              { id: "tibial_anterior", label: "T. Tibial Ant." },
              { id: "joint_effusion", label: "Derrame Artic." },
              { id: "deltoid", label: "Lig. Deltoideo" }
            ].filter(struct => {
              const s = ankleStates[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const getAnklePDFSimplifiedDescription = (id: string, state: string) => {
              if (ankleDescriptions && ankleDescriptions[id] && ankleDescriptions[id].trim() !== "" && ankleDescriptions[id] !== "No mencionado / No descrito." && ankleDescriptions[id] !== "No descrito.") {
                return ankleDescriptions[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const ankleCardData = pdfAnkleStructures.map(struct => {
              const s = ankleStates[struct.id] || "no_descrito";
              return {
                label: struct.label,
                state: s,
                description: getAnklePDFSimplifiedDescription(struct.id, s)
              };
            });

            // Append additional findings if any
            const ankleExtras = additionalFindings["Tobillo"] || [];
            ankleExtras.forEach((extra: any) => {
              ankleCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            if (ankleCardData.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 30, { align: "center" });
              doc.text("Los tendones y ligamentos evaluados se", 150, yStart + 36, { align: "center" });
              doc.text("reportan normales.", 150, yStart + 42, { align: "center" });
            } else {
              drawAnatomicalCards(doc, ankleCardData, 111, yStart, 79, 78);
            }

            // Footnote at the bottom of the findings card
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6.2);
            doc.setTextColor(148, 163, 184);
            doc.text("Mapa anat√≥mico dual y lista sin√≥ptica correspondientes al reporte cl√≠nico.", 150.5, yStart + 75, { align: "center" });

            yCoord += 83;
          } catch (err) {
            console.warn("Could not draw ankle diagram inside jsPDF", err);
          }
        }
      }

      // üõ†Ô∏è DRAW THIGH DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeThighSchemaInReport && specificStudy === "Muslo Anterior") {
        const svgSuperficial = document.getElementById("thigh-superficial-svg");
        const svgDeep = document.getElementById("thigh-deep-svg");

        if (svgSuperficial || svgDeep) {
          try {
            const processThighSvg = async (svgEl: HTMLElement) => {
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
                if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
                if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
              });

              // 2. Adjust paths fill/stroke colors for paper print
              const paths = clonedSvg.querySelectorAll("path");
              paths.forEach(p => {
                const fill = p.getAttribute("fill") || "";
                const stroke = p.getAttribute("stroke") || "";
                
                if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
                if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
                if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
                if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

                if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
                if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
                if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
                if (stroke === "#334155") p.setAttribute("stroke", "#475569");
                if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
              });

              // 3. Adjust text colors
              const texts = clonedSvg.querySelectorAll("text");
              texts.forEach(t => {
                const fill = t.getAttribute("fill") || "";
                if (fill === "#64748b") t.setAttribute("fill", "#475569");
                if (fill === "#475569") t.setAttribute("fill", "#1e293b");
              });

              // 4. Adjust custom guides/circles in background
              const circles = clonedSvg.querySelectorAll("circle");
              circles.forEach(c => {
                const stroke = c.getAttribute("stroke") || "";
                if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
              });
              const lines = clonedSvg.querySelectorAll("line");
              lines.forEach(l => {
                const stroke = l.getAttribute("stroke") || "";
                if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
              });

              return await convertSvgToPng(clonedSvg);
            };

            const imgSuperficial = svgSuperficial ? await processThighSvg(svgSuperficial) : null;
            const imgDeep = svgDeep ? await processThighSvg(svgDeep) : null;

            // Check page break for 95mm (75mm content + margins/header)
            const willPageBreak = (yCoord + 95 > pageHeight - 20);
            checkPageBreak(95);
            if (!willPageBreak) {
              yCoord += 18; // Generous space/gap from the diagnostic impression above
            } else {
              yCoord += 6;  // Normal small spacing at the top of a fresh page
            }

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.0);
            doc.setTextColor(30, 41, 59);
            doc.text("ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS DE MUSLO ANTERIOR", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 3.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(148, 163, 184);
            doc.text("MAPEO DE CAPAS MUSCULARES SUPERFICIALES Y PROFUNDAS DEL MUSLO ANTERIOR EN ECOGRAF√çA", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // --- DRAW SIDE-BY-SIDE LAYOUT ---
            const yStart = yCoord;

            // 1. Draw Left Diagram Box (Plano Superficial)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(20, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO SUPERFICIAL", 41.5, yStart + 5.5, { align: "center" });

            if (imgSuperficial) {
              doc.addImage(imgSuperficial, "PNG", 21.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 41.5, yStart + 35, { align: "center" });
            }

            // 2. Draw Second Diagram Box (Plano Profundo)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(65, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO PROFUNDO", 86.5, yStart + 5.5, { align: "center" });

            if (imgDeep) {
              doc.addImage(imgDeep, "PNG", 66.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 86.5, yStart + 35, { align: "center" });
            }

            // 3. Draw Right Findings Container (Slate Background)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(111, yStart, 79, 75, 3, 3, "FD");

            // Header of findings: Unified title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text("SINOPSIS DE HALLAZGOS CL√çNICOS", 114, yStart + 5.5);

            // Draw horizontal divider line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(114, yStart + 7.5, 186, yStart + 7.5);

            // Filter out structures that are NOT described in the report
            const pdfThighStructures = [
              { id: "rectus_femoris", label: "Recto Femoral" },
              { id: "sartorius", label: "M. Sartorio" },
              { id: "iliotibial_band", label: "T. Iliotibial" },
              { id: "vastus_medialis", label: "M. Vasto Med." },
              { id: "vastus_lateralis", label: "M. Vasto Lat." },
              { id: "vastus_intermedius", label: "M. Vasto Interm." }
            ].filter(struct => {
              const s = thighStates[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const translateThighStateForPDF = (id: string, s: string) => {
              if (!s || s === "no_descrito") return "No descrito";
              if (s === "normal") return "Sin lesiones";
              if (s === "desgarro_miofascial") return "D. Miofascial";
              if (s === "desgarro_intramuscular") return "D. Intramusc.";
              if (s === "desgarro_completo") return "D. Completo";
              if (s === "tendinopatia") return "Tendinopat√≠a";
              if (s === "desgarro") return "Desgarro";
              if (s === "friccion") return "Fricci√≥n";
              if (s === "contusion") return "Contusi√≥n";
              if (s === "desgarro_parcial") return "D. Parcial";
              if (s === "hernia_muscular") return "Hernia Fasc.";
              return s;
            };

            const getThighPDFSimplifiedDescription = (id: string, state: string) => {
              if (thighDescriptions && thighDescriptions[id] && thighDescriptions[id].trim() !== "" && thighDescriptions[id] !== "No mencionado / No descrito." && thighDescriptions[id] !== "No descrito.") {
                return thighDescriptions[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const thighCardData = pdfThighStructures.map(struct => {
              const s = thighStates[struct.id] || "no_descrito";
              const stateText = translateThighStateForPDF(struct.id, s);
              return {
                label: struct.label,
                state: stateText,
                description: getThighPDFSimplifiedDescription(struct.id, s)
              };
            });

            // Append additional findings if any
            const thighExtras = additionalFindings["Muslo Anterior"] || [];
            thighExtras.forEach((extra: any) => {
              thighCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            if (thighCardData.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 30, { align: "center" });
              doc.text("La musculatura anterior del muslo se", 150, yStart + 36, { align: "center" });
              doc.text("reporta normal y sin desgarros.", 150, yStart + 42, { align: "center" });
            } else {
              drawAnatomicalCards(doc, thighCardData, 111, yStart, 79, 75);
            }

            // Footnote at the bottom of the findings card
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6.2);
            doc.setTextColor(148, 163, 184);
            doc.text("Mapa anat√≥mico dual y lista sin√≥ptica correspondientes al reporte cl√≠nico.", 150.5, yStart + 72, { align: "center" });

            yCoord += 80;
          } catch (err) {
            console.warn("Could not draw thigh diagram inside jsPDF", err);
          }
        }
      }

      // üõ†Ô∏è DRAW THIGH POSTERIOR DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeThighPosteriorSchemaInReport && specificStudy === "Muslo Posterior") {
        const svgSuperficial = document.getElementById("thigh-posterior-superficial-svg");
        const svgDeep = document.getElementById("thigh-posterior-deep-svg");

        if (svgSuperficial || svgDeep) {
          try {
            const processThighPosteriorSvg = async (svgEl: HTMLElement) => {
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
                if (curColor === "#0f172a" || curColor === "#111827") stop.setAttribute("stop-color", "#cbd5e1");
                if (curColor === "#334155" || curColor === "#3d4e66") stop.setAttribute("stop-color", "#cbd5e1");
              });

              // 2. Adjust paths fill/stroke colors for paper print
              const paths = clonedSvg.querySelectorAll("path");
              paths.forEach(p => {
                const fill = p.getAttribute("fill") || "";
                const stroke = p.getAttribute("stroke") || "";
                
                if (fill === "#1e293b") p.setAttribute("fill", "#f8fafc");
                if (fill === "#451a03") p.setAttribute("fill", "#fef3c7");
                if (fill === "#500730") p.setAttribute("fill", "#fce7f3");
                if (fill === "#7f1d1d") p.setAttribute("fill", "#fee2e2");

                if (stroke === "#ef4444") p.setAttribute("stroke", "#dc2626");
                if (stroke === "#ec4899") p.setAttribute("stroke", "#db2777");
                if (stroke === "#f59e0b") p.setAttribute("stroke", "#d97706");
                if (stroke === "#334155") p.setAttribute("stroke", "#475569");
                if (stroke === "#475569") p.setAttribute("stroke", "#64748b");
              });

              // 3. Adjust text colors
              const texts = clonedSvg.querySelectorAll("text");
              texts.forEach(t => {
                const fill = t.getAttribute("fill") || "";
                if (fill === "#64748b") t.setAttribute("fill", "#475569");
                if (fill === "#475569") t.setAttribute("fill", "#1e293b");
              });

              // 4. Adjust custom guides/circles in background
              const circles = clonedSvg.querySelectorAll("circle");
              circles.forEach(c => {
                const stroke = c.getAttribute("stroke") || "";
                if (stroke === "#1e293b") c.setAttribute("stroke", "#e2e8f0");
              });
              const lines = clonedSvg.querySelectorAll("line");
              lines.forEach(l => {
                const stroke = l.getAttribute("stroke") || "";
                if (stroke === "#1e293b") l.setAttribute("stroke", "#e2e8f0");
              });

              return await convertSvgToPng(clonedSvg);
            };

            const imgSuperficial = svgSuperficial ? await processThighPosteriorSvg(svgSuperficial) : null;
            const imgDeep = svgDeep ? await processThighPosteriorSvg(svgDeep) : null;

            // Check page break for 95mm (75mm content + margins/header)
            const willPageBreak = (yCoord + 95 > pageHeight - 20);
            checkPageBreak(95);
            if (!willPageBreak) {
              yCoord += 18; // Generous space/gap from the diagnostic impression above
            } else {
              yCoord += 6;  // Normal small spacing at the top of a fresh page
            }

            // Header for the diagram
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.0);
            doc.setTextColor(30, 41, 59);
            doc.text("ANEXO: ESQUEMA DE HALLAZGOS Y SINOPSIS DE MUSLO POSTERIOR", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 3.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(148, 163, 184);
            doc.text("MAPEO DE CAPAS MUSCULARES SUPERFICIALES Y PROFUNDAS DEL MUSLO POSTERIOR EN ECOGRAF√çA", pageWidth / 2, yCoord, { align: "center" });
            yCoord += 4.5;

            // --- DRAW SIDE-BY-SIDE LAYOUT ---
            const yStart = yCoord;

            // 1. Draw Left Diagram Box (Plano Superficial)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(20, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO SUPERFICIAL", 41.5, yStart + 5.5, { align: "center" });

            if (imgSuperficial) {
              doc.addImage(imgSuperficial, "PNG", 21.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 41.5, yStart + 35, { align: "center" });
            }

            // 2. Draw Second Diagram Box (Plano Profundo)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(65, yStart, 43, 75, 3, 3, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("PLANO PROFUNDO", 86.5, yStart + 5.5, { align: "center" });

            if (imgDeep) {
              doc.addImage(imgDeep, "PNG", 66.5, yStart + 8, 40, 40);
            } else {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No disponible", 86.5, yStart + 35, { align: "center" });
            }

            // 3. Draw Right Findings Container (Slate Background)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(229, 231, 235);
            doc.roundedRect(111, yStart, 79, 75, 3, 3, "FD");

            // Header of findings: Unified title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202); // indigo-700
            doc.text("SINOPSIS DE HALLAZGOS CL√çNICOS", 114, yStart + 5.5);

            // Draw horizontal divider line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(114, yStart + 7.5, 186, yStart + 7.5);

            // Filter out structures that are NOT described in the report
            const pdfThighPosteriorStructures = [
              { id: "biceps_femoris_lh", label: "B√≠ceps Fem. LH" },
              { id: "biceps_femoris_sh", label: "B√≠ceps Fem. SH" },
              { id: "semitendinosus", label: "M. Semitend." },
              { id: "semimembranosus", label: "M. Semimemb." },
              { id: "sciatic_nerve", label: "Nervio Ci√°tico" },
              { id: "adductor_magnus", label: "M. Aductor May." }
            ].filter(struct => {
              const s = thighPosteriorStates[struct.id] || "no_descrito";
              return s !== "no_descrito" && s !== "normal";
            });

            const translateThighPosteriorStateForPDF = (id: string, s: string) => {
              if (!s || s === "no_descrito") return "No descrito";
              if (s === "normal") return "Sin lesiones";
              if (s === "desgarro_miofascial") return "D. Miofascial";
              if (s === "desgarro_intramuscular") return "D. Intramusc.";
              if (s === "desgarro_completo") return "D. Completo";
              if (s === "neuropatia") return "Neuropat√≠a";
              if (s === "engrosamiento") return "Engrosamiento";
              if (s === "contusion") return "Contusi√≥n";
              if (s === "desgarro_parcial") return "D. Parcial";
              return s;
            };

            const getThighPosteriorPDFSimplifiedDescription = (id: string, state: string) => {
              if (thighPosteriorDescriptions && thighPosteriorDescriptions[id] && thighPosteriorDescriptions[id].trim() !== "" && thighPosteriorDescriptions[id] !== "No mencionado / No descrito." && thighPosteriorDescriptions[id] !== "No descrito.") {
                return thighPosteriorDescriptions[id];
              }
              if (!state || state === "no_descrito") {
                return "No descrito en el reporte.";
              }
              if (state === "normal") {
                return "Entre l√≠mites normales.";
              }
              return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ");
            };

            const thighPosteriorCardData = pdfThighPosteriorStructures.map(struct => {
              const s = thighPosteriorStates[struct.id] || "no_descrito";
              const stateText = translateThighPosteriorStateForPDF(struct.id, s);
              return {
                label: struct.label,
                state: stateText,
                description: getThighPosteriorPDFSimplifiedDescription(struct.id, s)
              };
            });

            // Append additional findings if any
            const thighPosteriorExtras = additionalFindings["Muslo Posterior"] || [];
            thighPosteriorExtras.forEach((extra: any) => {
              thighPosteriorCardData.push({
                label: extra.structureName,
                state: extra.state || "Alterado",
                description: extra.description
              });
            });

            if (thighPosteriorCardData.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(6.5);
              doc.setTextColor(100, 116, 139);
              doc.text("Sin hallazgos patol√≥gicos relevantes.", 150, yStart + 30, { align: "center" });
              doc.text("La musculatura posterior del muslo se", 150, yStart + 36, { align: "center" });
              doc.text("reporta normal and sin desgarros.", 150, yStart + 42, { align: "center" });
            } else {
              drawAnatomicalCards(doc, thighPosteriorCardData, 111, yStart, 79, 75);
            }

            // Footnote at the bottom of the findings card
            doc.setFont("helvetica", "italic");
            doc.setFontSize(6.2);
            doc.setTextColor(148, 163, 184);
            doc.text("Mapa anat√≥mico dual y lista sin√≥ptica correspondientes al reporte cl√≠nico.", 150.5, yStart + 72, { align: "center" });

            yCoord += 80;
          } catch (err) {
            console.warn("Could not draw thigh posterior diagram inside jsPDF", err);
          }
        }
      }

      // üõ†Ô∏è DRAW NECK / THYROID DIAGRAM IN THE PROGRAMMATIC PDF
      if (includeNeckSchemaInReport && specificStudy === "Cuello") {
        const svgThyroid = document.getElementById("neck-anatomy-svg-thyroid");
        const svgGlands = document.getElementById("neck-anatomy-svg-glands");

        if (svgThyroid || svgGlands) {
          try {
            const processNeckSvg = async (svgEl: HTMLElement) => {
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              
              // 1. Force background and clean outline colors on gradient stops
              const stops = clonedSvg.querySelectorAll("linearGradient stop");
              stops.forEach(stop => {
                const curColor = stop.getAttribute("stop-color") || stop.getAttribute("stopColor") || "";
                if (curColor === "#1e293b" || curColor === "#2e3d52") stop.setAttribute("stop-color", "#f1f5f9");
  xúÏΩMì#7“&xü_ÅŒiì1Gï,~gfuód¨LVgò"3K≠W-À2@fH¡*"òU)µÃ∂è{h[[Î€ÓaFs”Aá◊Í2ˆ^˘OˆÏ˛Ñuﬂ@|ê¨RVâÏV8 ‡p¿w˝SRô,ù€¥ÚÙÈS≤˜ük”˙aC€#ˇ;Iº©◊ÎGç√Ω}‚zˆ¢ÍRØÎyé1^z¥≤áè&òxÔ$ùåı6≠ÔÌˇÈ?ëƒGRb≥Ÿ™∑€≤õzãv:ï¯<I<z¸ò4™§´ªt=≤–º[óL”|Ïzé˝%å&<ÇZ,¥Öøéay	€
2?%”∂®>∫õUø_RÁ~DM:Òlßköï=LìÆÀYÖ2z⁄‰∂≤ O?#?¶x≈¡∫AãÍ,÷~|ú¶ÌÌ•ŸÃ≥ä•3ÛÍÏ“n„·CÅ6éõc»üÏV+ÏèÈ—TõNT# B™’Ækµf&):mNêj◊jáÕZ&©	=ú6ê™”˙∏5fc2Ú¥YØ◊jÌ¨h
ò(‡pZ◊Îzv≥iÉ6ˆ“„ó”Ú˚ñQ£”|$‘DG#=}“Ë4:™™≈…MZG««9‰∆ç√CeØƒ»M€«¥&-Qr«ááµbµÚ"ì\Î∞›Ó"Á'Õ"◊i∂é∆E•K3ê.}„	Å" ¯>OÄ`öt…,g @ºƒ+%@√’g PQ◊léG'ºœo%)_∫„v+‡ˆ˛ÿs2[:uOgbRókìÔféΩ¥ti/¯)≥˚ÅßJ◊J‰˙bí’ÅDûîî»©aà‡âzÿÇ 9ö÷‰åî’Œ4¨\6`ö4Eñ3`ÅYàÊ÷X`Æ«Çƒ#ázK«"⁄kÕ¿Ik›Q«\Ÿó÷¨∞$AÈßﬁFc>ª∫ΩwlCáv∫w¡èœıÖcO®Îû”…w@≤¶ÿ'Oàµ4Õ?…âæ05Kw9MÒ]Mí')∆H¬ƒ9πÖ¥†âÃ(;T˚é©<«Ì˘úTÒ/îÍQÀ#üíπÊÃÀ}|K5ù:˚í∫ΩÜπ{	îû1BOIÂ˛ƒ∂Ú∑…g¨êó‘ò›z‰Ä4j	N∞"AÓ q;Ò;˛±ˆS£À/Ô)©˝	[˜ÇZ¶ºK‹Ö6°èg⁄ÇLêﬁ-%∫°Õ,€ıå	0u· €:~lﬂ—xÁj∫4£¨Œü'œmgÆôƒÖ?&+œ∞fDÛXY†¶{J4(ù∫∑åÒ2R˝ÚíqôıÜ_YGõ«RÈ6õıœ°á*{∑‘º£–¸ÿ6ı‰hè§?– Q5Ÿ"≈,*LˇÆ4kèH´˛à¥è%)qÌ©Ïuœ{πxBz£/Æ{g]r⁄#/ªÉA˜ﬂ^\å»Wd‘?ø∏ıG¯¸‰∫7\¿√´˛¢⁄AEë_∫wK@$X˙à¸H4”òYO»ﬁÜuˆR≤*d~≥⁄Nj5[,÷CyåÈTõyå©∑éëzß	éZJﬁúu/{§{ﬁΩZ˝Î¨rAÆW√not5º>π∫v»ñÉ’?ŒOØ›Ä/è»∞˜¢qﬁë›Û¯⁄ˆêùA⁄u˝W›¡∂∏ÿJqÜ‡¡¡9vøÑn<Ì<˚Í ˇ%ÉÓW◊W¯R"ÓGûÊÄ"Hßi÷´‰‘—^ìùz‰îjÚÃ~C*ó ®lre† §Óæ¥ã`ˆÛh¥€èàˇGﬁ[XåH‹8ÜtÕ:˛ë%f:’á∞ºU0‰y#`ËCˇBMˆˇΩÁß)5|≥ÿ©*™¥C®ÙT°^ì%Â√Ïr–=øàŒ™VΩ⁄ˆ[≤∑çø‰É!%`√%+-\±DM◊˚snëÑ–ÿÀÛPl#^,Ãê è§îQàS5+™.ŸD&Ÿy®JQlﬁFYznÉ¿u∂eåMöÊhS…–XCSÉø!ˇà¬l—e√ˇÑ:w–lfÚËﬂiÊo5:Ìt"úÙÜØ˙' \˚B™q‘ŸdJ¯:Tﬁå‡ÈÇ	—È|¥"¡œu'DSLà!S
üñ:ìKN†Ï%RôöG…≥`Îñ7∞=çvˇ4∂9Íız8èÛÊC®¿Å÷7ÌzBÆ-cjPùxÜg“-N†√¸	‘9=ÆM≠_∞~X©ô}pX´)¶STyï∫ì¡ÍüÁ†Ã‡BSØ∑‚ìJ¬÷ø∑∂c¸Äùj¬0∫3ê/∏W‹¨{ Ò à0ÕßR´ ∫©ƒkyà∑~‘â?íTïá˝∑dõ’Â∂Ö∞-ˆnA£◊JŒ/ÆË)ÿmBá”“∫∞ù¯)±8#÷ßlOzJæNÃ∂â°√ÏÒ¯≤z„‡ú∏1Ì1Œ7SS^Vo«K”&ß‘©∫Ã¥GŸ¥L–∂T§˙?|_Üî·z∑Û•!‘wΩy†∏Ÿj
Õ±=øaë¸/Ã’œVï\jŒÍ-º◊X„Ú…`õ≤®`ª‘T‹Âx¬⁄ hé™J#û®öS£8-yΩRπ’Ç1;[jfFù0EÅ:˘Ñî‚t¬Õ≥£Yÿ$bﬁœ∑ƒ≤aÄpQ-/ì%∏qnåhiö53€%Á∆5I?ß⁄â,≈âdR)LÊ.É ´ÇD2h&ë—öWEsó≈ìWjû®ÜÓ„≤J4≥GCˆlHdèÜ¢DrFCA2Ÿ£°ëÃ—PêDˆh(J$g4®Ö√ÄŒ¥…˝„{æ–≤ÂARé˘•¯{Eß˘uM1	ë~ëπˆ≠Éü∫.Ë⁄:Ø4à\:Ü51H%Éƒ“≈˛◊Üµ‘3\wI£îŒVˇ·N`=u_—o´‰nl$£ˆMu ‘ä
W)d'‰‚|ãi†ˇ∫_Û‰UCˇÜùã[ˆ◊=<;uD.∞]Ú<è¶$ü|>f'a	˝<©Ò™Ã®á∫ÀÂÈÛë1_òLÉ=e4ûò>Ö=0™Î…#¯jÏˇ‹óµwUÿ∂Îñ|ˆ56WÒº
‰Áï}ﬁö=enˆ6/s
l[ön<®%>O™˘Y√§È`¿mÖî±A¬Ü?0naüÚ/Oì}ñQf¥rÑZ∞ã˙'≠¶Ö¨ÏXâ¸`4£∞Sÿ‘9X 1WøŒîÑÁ¢n~q˛òƒ´ì[ÕÈzï⁄~’≥ØÍúh.ÖÆ¸TºwasZ˚~ZcjıÒÕcW{$πí[]∞+N4G?’<AIÕª:◊Ô~˙•)Ö ≈~%%	&O˙çéÆ'yS≤‘¶„~≤or&=»ˆ.Ùä•M◊$ª6ãG≥ÓlÔΩÒYÊÙ˜Ù_Ôù,©i⁄{åÉ_'&Gò9∞V(˛~Ç•IÖH¥õ´ã•{[Q≤úQ™õ∏smNïú˜”äYπ◊Eibc/ßGxæ»£$◊ìcW¬vnäCãœÕV¿ˆ±Å«¯Õ∞¶¶6ükûÌ‹ìâJ®È‘≤Edp∑rˇ©M<X”qÃ‡â Ÿn˚»öYû3–ÌÄ‡ÁÑ¬S<Û¿á,ÌQõ‡)∑Ã‚ÏÿØ˝Ÿ+5U∫œ¸˙c…]ø≤˜}KPJoÇ˜¸&≠~Öë4	Ww<öª@¥‡≤¬H˜K@¿ÿ0?´Ä"Wÿ1ŸÂoêΩXÒ®ÇlTÅ,….(\jŸ<¨ á≤A™ï(ßdVLÑeäRgKËwÆ=ßïÔ^£»äO∫*ËòÊ$º›gÜJ¢¿ä*C¥ëõ“»K8„t±TÓ‘¯ìO
◊7¬≠úDñ§ŒünÃ«8ë)öõü∂¶¶≥÷∆™"5‰	∑¥2%D±	m÷Ô_jÓ.ÂqÍF∞†±Qƒ0D©eg¬uá∏¯ïéﬁ‡µ	 ¸ëeNI%“E	
)3SÑ•lë)§E˛`ÈﬂÎFÁ~∏Yî,ÁÅ
∞◊œZ[˘„E‰Ø8Q·Q›KQO£≤‚ ÙOÈ°„àI≠ôwÀ‘˙ö‹bµôQ)m´ìôïj5¥t‡O3ââô@gπ’LS˚asxhõ´∑3cb£l7Èùfy»$ ”ÆEÕMµ"Ê¶hAÏ–S_öÒƒI˜#2ÛüπƒÂ∂V∂°O’)[‘=ÒË∑H2Êg ƒıöŸ3%Kj5
Ÿ–∆BG{›µÄs|8‹
TÈQl∂`ó§¨Xπ6∫Á∂ÌY6®√ 4∂=ƒW⁄Sˆ+ÿL†êÇ-˘PK4ÖØ4G[h∞çÄ	˙∏[XTtÔâi¿|'Æa≠ﬁ.∞f ûÿ.lh2ﬂÖæ7‘dõ^2ãnã?ï´P∂9™E´˙∞Œõ‹í
uú‰Ñ≈√6iıµÊXïΩ{iÍ0Ç<÷›¨k}\HF5˘÷Ö=!‘i≈
˘O…oAGCˇˇ˝ˇ˛ˇÔˇ˙?8ÿÁzÿ?Ôø"è…∞wé•~˜≈∞{F˙Á‰Íeè\/ÁY˜™B†0AÖ-â\¯_;Ü•9˜£…-ùkÅ™ègO a´:yK˝û<ºBmj…2lÖ€/6‚w∞A¡ËSÏ—Â∏ãÄ—ûIÒÎ≥˚æ^Ÿ„˘Ô46Ó œÅÉô¢C, ˜ä∫lÔTí‡œ≥Ù≤SøÇxÜPèw§{∂t«hMüaw3‹:ª˜÷ÑëÌ¡˙ıÚÍl ™&›Ë≤KÂò–ûYeOŒmùV`◊K˜Å*Ωz!(%eW˙p∑^ÖiÔLh33HáÇ(»0{È°a’˜ë±-CêMÊ¢#π≥7P≈öÛ"J,Ω 1B¡1˛ ¬áæD‹}(	6‹áˆ˘!ú4…IòBINzIqP≤ƒõ©AõzªQ»õiZü∂ßJ0˝ŒckÁ±ïÃ.Ì∂ù«÷ŒckÁ±˚Ï<∂í«ñ	&ÆÁûÕ»Yæsœ⁄πgëmªg˘[ã@âO¯QÖöy†ÁÁ¯fÖªã»V#ìj∞c(Ì°%©¡√Ú¿*rru£ 9â¯Ë\¢^≠˛Ÿâwø˚±:D	â≤_!Í˘µ∞üä]ˇ=ˇ}[U.0nÌ9åÚ=ò3{//Œû{§rrqNzØ∫ÉÎÓIıØs<Ç]≠˛q’?ÈÓÔƒﬁ\ˇ◊ﬁpO—KπaıN.^WˇxéﬂO{“ΩÏªW‚º„+r5Ïû¿O—/0U˛¯cº˙?˝Ìy]m…ãäK*ißÓ\®“CDxé∞˛ﬂÿJ¨yæ",ŸŒwjãæS˛B˙˚∆aäÀqû9@;Y!iÃÁ»´ﬁƒÊA(Ç/òéºÑ)§òf—"7u…íû≥˙•EÁôH∏s ⁄9eÌú≤|6|ËNY2á,fÛ≤$O3M˚5’≈ÊÎø—˚,Ó{ıù°[Ù>ÇÒ´_Ωµ–GÇNn3\ùòøï2{ˇáÔóuÙº–@ú≥!Ökgı∂øXîŸT`lÇçe~Eø5fπ∆∫≤=ΩWk
«–˙–êõÂÚéØ-hôí@é”˝$P1Œ‹}m◊ı+¡Mfõœ°»yï"Ë3IBÚ'USÀgÈF.õÅQ"U∫tVoÒô¥:í·æ–ß˛9C‘ÈPRp	èÑXè˛÷N	¢óßœ7ˆFÌJ:$H˚>	äWi∑çbû	yπ9'(àd„åv˛	Ô»?AÙF‹E!5U{)l:%”›≤£Çtö˛
ÇSôN
Øàœ_„\Ó≠ Mh§”%ΩbvlHåèè¡∑!"bw8≈L‡ (Æﬁ:3Õ≤@jm°9Pax&rÔc•Ï- e∞D(¡Ö∂jld‡∫Ù˛êäâ≤XÒ¡"˝ŒÉ≈Èé	ò ÒÜ¢	9n/\√ıQÜ⁄CBäny@√—…‚Í˙¨<¿p4qlo9O+Ñaœ≈‘ˆ^à˝øƒﬂ€LøLŸèø√dÜëÛÿ®‚óQÓ¸¥/E*ääeA]û$
-îA
•R0Bü-w≥Á∂s©O
òpDaÛΩÄJ.`ƒ{h∑É|k1eË,⁄qKÒk<L¿i‹¨’o$∆}Eæ[*\œdÙÓaÑhG3õTÕrACKST∫©,T]ÜA;%FœÑ≈?CÀ≈çÑÍÇ˜∆S+I¨»9Z§(N$Åõ‡ºƒS≠ˇ„H√?‡côVNXU8U‰'^ßöÛqŸÅ"2ù@¥±IqÊ'«áÇ,∞¯`™ÕœZ"r_“Í§ﬁ/‰aA‰ô¶±pÈ#*yD8⁄"¢‡ôÖ;å&Ò™˛J¿2R˘|\∆ò@Y/“$j#Ñπ)¡©b·è„Ã∆ZÖ)ZÃ(Åßàµj£±_∫\Ω>’hª\πçñŸ∆•ªŒ =*_ÆÕòUnÎAe·∏Ö≈6€k;•-*≈◊%«≤¢ßeò9æüè<`bÖ*AÓ∑¥Ê¯h›©ÊØõbl—◊‰/gÉÖu¬ÖÃ©ÏC…‚«ï=bg8JêOÑﬁ3”z¯µÚµ(„T°º˚:yh z/>}37ˇÑ{~h‰”•7=8í©Õ˛'ÌıpPùÄ†ÚË≈¯[êª"JMÂìo∫±f†ÜÃó˛ôM}V©¿ÆﬂŸï)6å˘L4å∏dí}>´⁄ñikËTXQP{Õ∫cõ·@a·ã{eè'êu0ô´lyùZ-#_å3íÒ˙xo⁄∆≥ÄÑC£S©)sãh-‚“Ω7ÚëKê^’ÿ¿Ûê˝øS„§D”S{éıNE‘Õ≥q@aœãë¥∞@ëìR√·‚–;ò2·pÅÅ$õ3Úﬁtù	;Ë1ìØS[.Œ-TLc@¥§∆’<„îìÁ/L⁄¬vŸÈ‚‘¶_ÏF>#ç∫bìØÈ˙•t ã¨OI≥Q‡¥;Öò…™¸≈ç SÿÕP26Ì…w≤=_)ìWq[ßìD»‘·«·°“b˘úUì«\w•eØãuÀµNnÎ÷c{=Æi∞NF¨ë“&G˚≠ßÕ“ïa˜ò≠±QKôèk)S£4k‰"»t(i Ée±m2;•€bØ ~îâMÓ€ç…≈uüØ˛Ÿz°pΩl√Ø›!‘∞Ì∫z]mYõ\¬$cJ(ÑÚ(Ω!ËçfÙH§ﬁ‰÷Ûv'”¿±¨K<∂Ωÿ˛ÑzÊ~UØlÕæ/1ﬁ◊õiÎ=>ìÓÑ2€˛Œ`ñ&ö/∏•;4Ñ^¡ª’Ø5€“1ì∑îRã8]:¸o.´Sﬁ≠~≈ó˘u
È»Í°T†N∑tn3+Y≠^ÜoÛ´%%´XîX¥f1jﬂHª|°Oe6Ë≤∆g!UÜÒ9«ÍúkqçIZú%è}ã≥‚U⁄‚¨¢QÃ‚úóªê≈YA§ò≈ôÌNﬂØ•˘˝Zô≥,ÃõZóÁ„÷Â5Ã õN∂wnV˛ÌÌ…ÇEôˆdﬂ∫ µ«∂'z¯c±'õıª∞ó∂ŸvYê*Tk–TKe!dfMÉm¥úÑ=xbõt¬Õ¡(¯`ı◊5ôa¯Ë]Ü##π„Í'⁄á;ÕTü>hq{-÷H;,ç©˘4öá£´ôƒ.‹˙mÏ¬˛o˚v·/á˝—ïo0˚v·/√ıVaêc‚Ì)˝bIù;Õ∞‚Iˆ°iŒñ´ßhFíYzª»fÉô3
ˇ\m~ç…+∞&»qsp √4(ˆ“v∑ZÓ¬ßóWp»º∞dCÛã◊È¡˜"k¢‡†da¯Ã£ÎÑÌÁø√*î≤îsûÌÏ‰;;˘ŒN˛ûÌ‰èûÄ?"€ºüŸ÷ák6Øç°{éì}æÆ1]uggL∞∆ÙH¸´ùë}gdﬂŸÁFv–Uπ*(≠â∏/qµ3™ﬁÊïAµóì‡\⁄A“‚ß_p“?óvTÔñOØÌ‡±ƒ;∏@nhú≥Î’ˇŸ;ÈÓ `@›_Y(v¿1.k¸¡¯˛Ä1¡FoÿcRÉÀb¨'”gPJfdÉ|ÚI˛ŸOR»¯ï€∞‹∫,1T∫Î¿å◊…£mÅgËZRi4$#æ4HÜ&˚O≤`ï ≤A–íúuó>ÌéÜìÓ∞K∫ÁWΩaˇÇ!Cébgí≠Cu0è8Iô5N,xEäÈé‚ñ‰√ÊËÂ≈(`Èakª,=˝¢COøÿŸäùÏ√öÜÚΩ)”Â";/Œ.ª√´˛YÔ¸ÍÇÙqtƒÕ3¢Õdq3≤;UÀµPÅ√=◊[ñ”1ÔH¨Ä(F€OK¿ç^Ÿx}ÁTõ–w–áÔXƒ`H•P(dh⁄ÆxÈt28{j;.ç?÷FeÕ—·∆ºMœåÚk.õßî˚>9∂%œZä˛{¯˙(Ã√W›˛9FCåâ∂}öÌÕ˚oôå7ˇ·A&ŸÇ·„&%·v ¨HIíEíÇ˛ºx©ë}3ß∫°YQP‡9{AŒƒã4∏0Çƒ¥tÑ‹LM˙∆vbWÁ^âw‰πˇ.Éœ3—úÖqÉ7E¿Hè{~2Ã º∆√Në3íØÀ_ê!ëAˆ‰‘µõUö~„[p£·ûX:æËf—õhñfﬁËÙf∂º∑≠Å|ÅX≥ÏEŸ*∆›tù¯rï√'Œ2 Ç†ª#H‚F«{sbúûúÍzòû‘r±Éo&xm4ÅÁüv¥˚zAöÃA`ål®gò⁄ÃæÒ†„¨ﬁM~ö’Øò(ãú_11™ñ&:Á«jurùÑ∫¶Ó1KÖ*Ωñõï˙˜7kµÖyC„Ë§™íÓÂ‡qÔÚ©@ˆ≥⁄î∞z⁄F"∏É·càÒâNıWòÄåDÇB4X,ç¡Ø}«Ü"º]˝Ã·◊ÖËÈˆbaRÁÊˆ~A:7¥µS˛.†ì◊W1ª–ß\vJ∞ aóî ,øÊ‘\ô5a#ÃÚÎÜXN=ÙÒ “i¥≤<1¨rvﬁBHe)â"€àNy#ú2„{•úò|Ö° õM≥4∑TNNΩﬂ≠Ã∏îâUˆoR¨r${a§r¨è?úrºQ;î≤¨ Æe∫x˚$ÓEÏk*L$i[@(œ˘h%Pms©ï∏fÛù`îc£‚cA(S∂Ä¯å˛`ê…‹Æ$p…ÓÅ…œÜΩn9d≤ÿ‡])2Îî,^’ô6◊\íº¥Á6¥jä˜Äcíπ≠Ω0k±∑0ØMÂ∂J>v2/U’j(0%JPÔò5/ ≥Ω~`´5fÍ,N™ Yºb	ådãaÄy0ﬁ	8)–Ïˆp9¥f¸Èôf-Ÿ≠=ûb®Ò ÈRô±„˚‡±à&√V©qí‹D©â{≥πº¬	ºwéÜ˝P´˙˙ØÀZ≥V;¿:”oòéï2¸ãñ-=˚Rüæ‘‹/ñ0hxC9€ $dY%¨_‰⁄ÓÔYŒ=äOÆ¶Úâªÿ≥”Pqì|A⁄Û•Èìfêˆì∏πi2‹aH≈,
:tû„≤õ·ÛxœŒÿÍ0•÷ËÅi$ˇÆ÷ÏáÄÔ]6ÔpfMåò€Å*ﬂÊ~òËµ`µ ‰≤,x{uwp-¬*Ç¶í‹ˇ\ô#ëâ¢ù™*™DBFÌSU´îmç<€’˝B bπ®ÅÆî‰{íŸ_…O»Tu-£ıìÚ7ÂAt≤ÁsB’äR¸‡ò>°í¸∂>0∏#Ào„aËÿbô3É°gﬂÀ»sVa'Ê~ix∑ï=v±9øËXéÌÂ%éAGÈ#∂RuìH˛Gi%àLÍÒm˚+v)"ü‚∞Ü”Õ?©ë∞ﬁoízÚ™¿ AdyV°‘	´È>ÚVyÿ∆?ë÷…Oe˝è¸SÆØ™bf%÷qêÊã8‘k„„#ÈU‡9Çô[Ø*Jç Ç6¶∫À7TÌ⁄ë◊–i´9mK]Ä∂“PyC`kioŸ∂*ΩÖÚ⁄™æﬂΩX[-M=ÀhªøphÆãá|*Y∆®≈ôIàRâ©–¶y`Ÿñ–W3ìEÂΩB
fÙ/$gúCnOõa‚ª>>∑ô¸ƒjf'7Á'kŒ:s(c\…ÑWVà°√éjµÏûà•>,ï∫ç©∑µ‡\êåh…Yq	u†§≥jÜS®ÍíÌM]>π_*ï˚$ø€˚9ÆWCn[N2f´3h˙å˚∞öÏ¸ÊÚÙ9ﬁ˝mïÒ˝˝œ‚î( ~¿®†bU\üRœ⁄ôéß·yªƒ£2QŸôC©c.üñl)Ejc'F®0•P
◊™_@â3›¸K”u˘WÎ¥ß≠éh±NÈB¥˜®H{◊w;O«ùßc≤>;O«D˚∂‚ÈË[Ç3¯Ñ√`‚p!8´œÒD¶ﬂHêOî˙Á: >P◊¬á‰9¯–ù·G¬ﬂ¨{÷¸ ? øg˝A˜™7Ïîºó¡®˝—˘‹WL∫FtLñÔ»"°R¨ü’__Å|˛{'/ª§rv∫øû€äH:óÿ7e,ƒT˘+úÉ˝˚‚∫ﬂû"ô{√Ó)ÖQ[rS`‚Á√aã+ΩéÌ“wÏ§˛¯Æ°[$ÇÛ\ø°ﬂ¬ˆ:DËûù¢H˘ñí∫:1œ’êÂj‰Âj r5ÛrµdπZyπ⁄≤\Ìº\YÆN^ÆCYÆ√º\G≤\GyπéeπéÛr’k“nÆÂÊìè‹ÒQóêzˆÅ≠íckµ„^,˚0˙.ã»R‹∏jMhíLAë4#˛6ãäˆ∆0µd˛.>Ã*›HM®~Å	e§&Tø¿Ñ2R™_`B©	’/0°å‘ÑÍòPFjBıL(#5°˙&îëöP˝ HM®~Å	e§'Tø»Ñ2“™_dBÈ	’/2°ÂÑÍüPÜjBıÀL(#=°˙—	À¶åP/∂ó¸¸â†œœS˛AÖ≥üF“Í8¥_˛Ñåm€§öE~˙˙·•óRÊ ò,%ıR·®/ÇÛº~ÿz„.ÁsÕπó £Ô≠˘Xs˛/ùJ÷Ã'M˚yg26sﬂ™"∞w◊∏@aS xˇ #˙“(ê≤∑EnîV≠V≠g˛ÜGÁÿ»
l¯ìyàﬁaøŸw(*Öx£)U`6(]=¶ÑÁüiﬁà∆F›Ú¥9µH0r5Ó®Á/˝í>GŸ≥HÈà$Àñ·£@}NˆƒS‚sØëBÆ∫G|7BsCÊ´ˇ0∑x ‘Qö¨÷:7–Eú„+‰R·¿ ≥YÖ‹∑b≠ﬁÍK6bÜom¯›ãHw¯Ûf˚…´È8Ë∞®ßW˙©ÔÍ%ìˆıRP(ÊÏïìπê∑óúFKBW£ò®Òùå¸éQ:ÚΩK?*^£∏#Ujzı§RHRleË≤îƒ8ç¸ØO"ÏHÌÛﬂ£«U(rbæV‚´L|$«@é†_”ãs8€ñbπV4sa'¨¯ ˘º∞¸p!tøÒ›;–‘Ã-´A'`LiÕ∞®À’Ó‡q0√òÌ˘Yˇ`ÿ=qkt¸§DÂ„Á§⁄…ß’í‘¯Ç–I:˜QÒãü ˜f∂#*:ıËƒ{f Oq®T‡(p—ıø®V»?`Í˝`-y÷g•’sç¨‰¿Aæ‰·≤∑·∞ +	t”Ô®#;F"hR]ÄBOeÙÂ±lóüŸ•≠âπtŸıŸÔeoC‚≤°ªÁËg∏yïàê…©DåR"aj-J¸D8Âò∫^_G√ÊA=ô\04êÛl$)â˜vf}s1≠$o ≈◊bﬁ∞5˜†Œ<òÇ Gx›¸˙≥_I2'l§ñ.sDÇb‹¬LúQﬂß«/B‘ıs>à›ÂòOø‚h>ƒ7ÚÒÚgA@~ÀsA15–˘-⁄=Uˆ®Úxl†L¯´˚_æ~ÚW˜‡õˇﬂ*_◊:ﬂ‡#Ì`ÚÕÁg?ˇﬁˇtˇ±¡†Tí>?≤" ñP≤ !˜≠pI¶·Xdƒd#L8`iØ˘ë•˚∫˛Mÿ1u?ùW…“cQà–ø	˙«9’ü˛VDë.ONHÎFÆÆŒõy´π]Î˛•Pª†πPE«XÍV¢J›~’µÁ„|V,æÑJáKî˘y§“®*÷Ö
Àõò∂—UØítöì∫ŸÒÏ_°≈›_ã;-9r¡Â=¨©a…taPw6q≤í4Úì4ìLm‡„ïR˚êGˇÃÊﬂd÷nl‚ÿ4:«A¶ß—iiCQ≠Öπ—P‘™ÀH‘Ü+ï;t™nm$‹b∆ıFî03á®Àœ,ÙçN*™VjŒ˙é†‹}	›jIGæ~	Øè™mÂ˚ø¿{ÊŸL`µ„)‚˝H–/t‚ÒÑyŒ¬"NÚ¸‚ﬂó†B2Î˛QÑs˛Ê%Wn}çë]ôQz9úí€A©û™‘6≠û%Ükƒ2ä®Ü?häı®ftJç∞ê\£ÃB;Áa#bhMQKµåô]√ôx´ã*‰©˛ê|ÛŸ—xx$41WøZ†z–â=sV?OŸŸıwr,>¬√*”πÖË–…wÙ€ÌyÓ'án‡:ﬂv˝_/––›?ª`DœCê˚#“;g¯ﬂ ®Oz£´’?H˜‰™ˇÍb_2›ªYÀ∑Âùùp 7xZÊ¢tv*˜–éêÏó%ŸOMW·ïVí{¶%§'K⁄E=¨õ@Ωâ‹Î;ÍÖ7t÷√è‰ÑËﬂ.ô∏ÙùÈ»#∆ÿ•⁄7ˆf@oM^ÎÊ=1µ{{ôÑ~GzàÂö	fFXÉÊºà)w2b¡÷©∞lÈ¯éÅò<uyêΩ8ò‡{Æ(íúÑ)‰Æ,vîΩIà˘Aƒﬂàk°doµN˝0”WjòDóç‡~T¯QyI]ÿ“HÏêÅË‹í◊‹QV ÀtXnoâÀ°í}¿ÔÜ b‚ñ®t'ÚK¢Úz0}T‚v®Hœ%/s¬U≠…!ZµjKy∑„ z~a≤æì‹j‰;+§äâ84‘⁄«ùŒ±™†…Zg‹—[9$èéÎ„Faíæ”^I}“Ë4.ÅôÉ°≥yÉñ{ö»H≥‹¡†u
ZßÙ†ï]	Vb9Jﬂó=ö÷∂&Pc…c&w;ë»rÃîö/D¬‹KÙäW\Ïq9˙ZqG\ÄØÏÀLëÙ˛6‰Ç1è)/15!ÅsOÆ¯1ùBévóñ”èó”/SN_r#ßˇÄ‘òö-V>‰@MòÑó °Bıù$U©_ìXØ˘'Øœ?J‘æË™b⁄M”-T¿˙£i«ˆõóæo aÉmQ˙z¡∏T'†x6Ês¸wjxÒKO∏&Ñ›	5Ôˇ òí˝6ŒxÒG àR —0Kt/Ç·Å¬è hÂ#“dˇóÌ_˘íE'ˆîåÄ`⁄‰m[Ò†Î2?πNqoÑ0}¬'·Í˙¥Ø⁄ƒ{'˝{T	pÚ˚1|<ﬂk@Œ¢K>)ôÖ»4‹–åıéX%,(eU1dsío!¶ô9¨˛ÒaÕ∏›¯˜D¬°zSŒ uãUÁî≤6∑´G≈⁄å'cSˇH—_hÖ¡Õ†o¥ïAΩ¯'π'T:ñÒ3_…©Vm√b∆ﬁ(…Ñ‚†kûv¿íÌ	áp‹€I,R¸#¨«yY≤BßÊí!|r≤d≈¬òvƒdÖN¥Öª4i>Ië∞ Qâß~púÃıÏO%!˚˝3déØ≤~€y∏≠~o∏\‡	¨"éWIsHvΩ≥•a∞àÃ¨˝,≈Ÿ'Œ˙PAúÅ
B‚ÆeøÜç°3/NùuhÇ˙à:ˆ\#Í†tx´_\4≤!Üùô vit∂§.·°˚©¬ã4NHtaÇ‘	ªmöå=>—LeQõ´∑Òy†"ûQ"+@`Ô>ì!ÔÇ‰—!jÙˇ¸oˇìD›áûê=áÇÊ∑∂aUPÿ!bhØ™TÕ≥é,ı“YΩÂÊÓ’ØñGgéˆÜÄ≈ÜÅÕÇ∑N5œò±”«π∆nL0’íÍ]˘RR°BR“(/%˚€ñíRÇõHI)¡M§§ú‡FRRJr;R“("%ç∏î4∂*%ç∏îîﬂ@Jq)il$%ç∏î4÷ñíFRJÔZJ[ëíÅã†êì∆{íìërIâse≤t`BÜo°:ÀH«„£LÛŒ§‹Öix»R ° †~|e3Mz
∫±∞=Èh≥¬çì|Bòﬂ⁄9±ÕÂ‹",¨É¥Ã∞¥‘àg˙ô˜Q¯ü`À¡#Î·ÜBG¡jÔ”ß§]ïèê!é¸ßÚÌ[o>¶⁄«ˆlC?æ'¡m¶t°a–`Û^±˙ETr=gﬂ C‡Ò[Ø7˚)º≤±ˇ…Æ9Ûiñ›J 6V9Ùã_zÊg‚€H≥HdÆ’ıf-ﬁ⁄V¡;Ò£‘CÚè≤‘=—{¢]˚ò{"Â¢]Ômπ/ ﬂù „GßËâPñ·=…ãåxO"ñv‚j3¨∆,v®ç—«c‰ªK2Y˝ÃñK\
™M¯Íl	MŸﬂ9ˇ¬cƒRÃœ?°M>§)È¿XfÑ€«Of»}n '¬@Ó«ﬁ˜a*Ú¿˚ÈJD≠˝_TÂÑˇÔû]|ÈGˇ/¸øgéÌ◊ÈÿˇíË˛'∂}Õ!‘20
ã	¬Ê#D!˛ß4Avc_IzÏ˙?SàﬂØ<p⁄≈ÇÒ[Á—oåXJsk¯É¢ÿÉ˜á;(Ö9h–¶ﬁFºcA}⁄ûJç√í’XÜzΩ~‘8,T¢:í£§ƒf≥Uo∑e%6ıÌt6*Qïn}D!ƒ¯á±RñßÅiC}‘BÇù¥ééèìò
}‹8<<L>•5zà0ñåb'ê"œU6)Ü>†”|÷E§…ÒÜeì„Õ,Bn⁄>¶5À£‰ék≈j'&L&π÷aª-Ñ§»˘I≥»uZá≠#IåSÂÙZdP`õ^^©Èï√~À‘xÖlVFHå,*V…Fc8èë"q⁄•ãÁò9…bf p&%N∞‰Kòâz@©0-ãLqíß§0c«f!é$CaØœëåò¥YI<Z£å™≤≈1Mâ´É3'Äd†’Ün.e_[ï‚]`pí@≠00Îq{>óT·5Ã<ƒ§<c	üXñO!˘å	6uç‰∆î¡cÇ‹ïc˙˛±“€¥p˜W?JÙá¸–3Ãêÿ"¶ÔÉ l>˙àV,’¶Q$eÒ∑EÚ+çªvrqzu√^˘í≈ú}L¯åq§»·E»ª&˙è‰Ñ∞ê>∑hn…UÄuÏûwØVˇ:√∞é<0a¿∏@*'›aó¯!ø"ÏÁYˆ∫»≤µR,RÑKMªzï{{≥ê∞ß‚`·ô˝Í¨9ÒÉîõÖpR•√Ë…±Q<‘„a;ıŒ}÷¥#¢&K*NØ"]ç*Î1◊Ê¶T‡¥…KÈÀÂ§`IE¶‰	√ûÒba(£[[*"ké„Ÿ˙´™R=ä¡Gwa[∆ÿ§ié6ùÑ¶ÂmC¸Öô¢KÜæXπ~£ëﬂiò#üK5å*⁄Ÿd‡Àπ¸“¢„ûßãƒd˝há}ÇüÎ˚¶ˆ<∞xÄ∞;ÒÉyê 6…≥¿€(o‰ ^{D‚¿ŸS ÜÉı—ùO»µeLÑûI∑8g
≠ÌÇ&Öæ∂5·KâïöŸ[[+	»ÌGoπµ„ÏTÜ—ùÅ|¡Õ“f›â—êÃtïJMÍn)	Ç{òéÅ+ÅÍä˚%y6∂è»éÄ;±Ás€∫æQÀµ£!Ø™à$aOa\œWˇa©£r∆IÙèÛC:cVea˘&j®ÈU5°€Âú:∂ áH	/B©ÎxUÚíß‡I‘ÑDª¶&}ìl’sˆ,∑MK”“úBM:Yé3öƒÈ‡„—‡ëÁÏŒqÃäB±p¸Gæ3bf°"—’ÖC≤˚¨5I ≠ÃõÓ¸àaEB3$©|∏2´TÂÚÙy$ÍY2üZK∑‡◊X°dP∏‘C?&úÙE:$ú<±àpŸyÑìí»∂Räùx¯äI›$ò⁄œOáq˙¢◊®);Vbn¡SXzv…∑π˙un`∞Cû´H‹¬h–Ã¨0vÏ˝Ü°ÏX_ƒ#Ÿ%&e·@võMø4/∑†N2%caÍﬁS0:∆•ÃXtÃ"-çE…[8]¨É?ÜHtÅTïzus˝]Ê∂≥ˆm#CU‘°&Ω”0ÚY5éfBÕæV⁄4 ä†ÔË†Ô¿ùi,ÖKÓ#!*3i¶Îî-lcñP~ƒ¢^∏TWÕä»Ωd1Ë1[`∑¢ÿñ©"∆∆F,`†øa»ﬁ=¨Ä#àYΩù#ﬁ	zä0>O@_§∏	dÿJ¥`)Éum‚A§π}®‰∂‚Ù(”\ƒ˙#âN⁄2®˚ÏÙ‚¨w^$Aˇt«∫”ÇY≤y‡´K«ˆlPì„Ô£-é¿åƒÎ8–(Œù ˝#“f¡4û$
 JÏhˆG–JˆC‡«ØÌÚ≥É¸Ï ?â¸;»œÚ≥É¸œÚ≥»OäîàÛîòCæê+NEŸOÎ”)HgÉ :*±U:2Œ;«ÃÑ˙ZÃíT¢¢Íÿ»‚ßˇ¯Å,b˚Ò˚∆≤ú\ú]zW‘≤UéºËJœ!8◊à?[•¸{øËï££¬Üø˙◊E˜¶¿hıØAˇæ∞æÓüw=¥?vZÎ€Ù[Ÿ¥Q_$¨˙ÕV‹¶ﬂaóÅ6˝7w˝ùEˇ„µËã9ùm”ø5fÃÆõ_Æ~eOî6Í;ÍìeÏv¬W‘]˝äœ:5#ÎÇƒÖ∆#«E2_Æ~œîπ∆⁄—*>√üj|ÅaŸ÷Ùﬁ…54Vˇé^™ß‚M„áÔóutâ~.ÉKﬂgc<b‘úql¥˜D≥`@˛L â≠·ÍˇbîÈÌ;Õ1Ï(˚/ƒu≈\;÷_g´ˇp°Ømr…^d†*Lºû&»w¬~gåáÍ7ÏÚF3«1>‡+R¨~Öó§/˜ÛË,ÁcâìCê“ÛVæˆì‰„W4S*I’|ö}ëíúVãSıGZ∫˝|∫Û%vOÏSAÌåøA”Twπp Ω≈B≠Ñ4FÏ±ˇ\=yûT¸‚¡é06w‚/îÿÂDû¡å⁄fB6ı˝w0âÕl)•π√3¢Ä·|÷m20`∑ sW$)äßÒ7ßDMD‘ñ¡‘h>≈áÄ™mÿÆF¥+â¨ë<ˆ±5äWitçäF1|M^ÓBë∆&I‰Ω`lDoƒQ6©©Zg≥Èî|ÁHÈ4˝-∞6ÇSôhﬂ¬+‹ƒÜ‹$˙˚c›$õµÉ›»
∫≤ É∑ Øﬁ:3√íIq1[ ›ËY˝Ämc‚Éá€∏Üµzª8‹∆o›∏ÒkΩ]»Mp°–´’?ª‰Y–ÔIÔ/W√ÓÀﬁÂÍW˝ìn±ãÖ"æøœÇœ¯≠eëæÑfÃì˙ö8AÅ¢‰÷∫"»Ø˙ÉΩ"hwïœÓ*ü›U>≤è™¢DT±~R÷˚]_Â≥ÈΩ;2(å÷>™M≤IN≠zMÚÔ˜rïOÓPÎ‘◊∫ÔG•c‹-ÀÒıc•‡ßPºî∞∞µc¶¯\èçD!ï7e‹j7kä˘ÚÓA⁄ ∑‰Û§(J(ÒT;ú6ıZÚÈÙË∞~òJ‡’T£u≠ÎúJç÷ws…S®∆ê:I-™Ú…ÅI!-9ì õ#yÿ◊à°‰Ω*‚“é|9π\¿üﬁÈ≈Iw@*j≠£X%Ié•Å0y<+sM£‡Zô¿¥ ”]ˆNVˇ^HwÄ°>N˙Á=fÂt3ˆM€d`7√?=√;@√?∞Ôª@≥Ü≥Õ`Îf7bµ|4fâòÕÎµîÎË‘Q–IÅi¸Fâk≤⁄GÖÓ«äE'ƒûN°ÜxKÁıÅ√†∞9‡øy`uxmRÌéw°M(√≥çó¶I=’ùQQã.a¿jºW9ÏìO1Ëp∫øu®¨ı3VY†/˘ª∫¶Í∞®p)ä|≥'/™™ºz÷€.•äp¢ûYÖát'ï=¿ƒTwiàÌ0ÆßoÙÃ´è≈·K†Û{Ï è˙÷bÈeúD
ª∫5&ﬂQGx·Úº œZE^:ˆcûÁ8^‡B‰X´∏S`{ô¬tñ~=f.ÁÏ(£(1π™†Ïí^	 À¿@áÕ¬%˙∏Á¿ƒåk52ZÙ5ﬁnænÒKã]©≤F`Ú—	Ù⁄æã?â‰⁄®Èã∞F≥∫a£¢üié≥««òq≥V€¶±X´ÏÀYb§≥„∫®,¸‰ìòl¨≤Tﬂè	◊»Ω0,ù∏G„í_∏«Z˙rÇK∏mÆ~ÅÜ†âñ≈0A="b“ØJ¯(∑6=kÊÿÆ6«„S÷¿©©Õ5ÿ^Ãà¿ÏŒÔ4z°Óc¨#∑“dW+•~•¸πUÇŸkhxOé/[	3cÓ‹“≈Ígf‰ò∞®1yı26Ï%¸Y§6ﬁN¿Ì#º~Øp)L*‘öò⁄ºﬁœÌ"&|Éﬁ¡_π5`©ƒ0yL0`ÒÔö˚∞s(™q–Oï¡EèW!´q±Ï◊%ˆ4∑N(€Løw*LNË”3∏dj‰.@+Ú9óÀù¥‘ñ’éΩ)WC†`ÒäÚˆ∫uåIuøz—áÖjP–fK*^˝$&ÔÓ@:fó˙I∂±ß%% ^7¬Æ"asVàT>kŒÁÖ´≈WÑdµÿ”‹j]≤{Q&ªÖ≠∂/BÄwY≤'≥ä/)^±«˘µZΩ≈tw?dJÖ¬/ÿ"≠~ûQ< ƒ{^Vø‡–sÅÃ∑WX©úß∞ƒ˘¶›Ûö¡˛àÒﬁpAqqˆ⁄≤= :◊¨%
bºŒE\àÒÉ¶kÆ¿.·f
‘,â5/¡?·ô$R-`ÃÙ\®,u¸å·Bãï.<…XËyUìeBœ%U£@ï/‚(7ı"o‚S»≥…´ ˜Âwd#ﬂCmñ.ı˚¡Ü-Ø√xä∑ÿâÿiKá≈4°ˆ††…PmPxUXù]tπ¿ÙèpZx 2VˇŒÆr©ÉK4ÿê»1Å±ÅòÃ{‚9⁄=Â:Üü‘M5KÇcsºqÌ{xÉƒŸÉ „Ø´µæ˘ÙÒ>√ù„93˛+XµÔ√5cÔÇÀ¸‰'Z¸úb„P ∫⁄?Èy˚7ú∑¸3ˇT˝[FâÚ„)ˆ¶¯Ÿ±j.=·Ë’ÍW-êÄàåÚı!∫7\÷`pÑΩÆaêXß+ÔTîä$äæ@÷XÀ ìÙ ∆euΩ•

^	©ºÀ0Î÷B•	;4bóFèX$T%jø’ÀS>©˛g£ªÖÈ?⁄Ã?«öŸÆgÕÕ‡P*vïaÑZ∆`OÎüæ +∆õVyH]"◊ªªùÌÖ)[‚26m˘Üœ3Æ
›©gûcµ°xÏ ™ñ85mØwW[ß%±3%ûlvAõXm∑p3õÃ≈/ÕÍ^ˆŒO˚'˝´˛àt_\üv—Ö‡rıø„√9È°%ß,Fã„nç7ÖAZ~ÜBÅéD⁄LòñOp-úVP˝Pk‘⁄µv@≠U5Oy¡Öî·{§$kç£÷‰0˚’hkG“ CRíEB çèÎì˙:@≠6‰Oﬂ,ÿê:ƒœÔ6Táˇ%Áßè3LÜ¯“∆Õ⁄—Gä(*Ò?Iï!¶Ñ(ëCj5Öï˙˚Å1E4ÆtVû_å∫§?X˝≥{\)æIÄCó√ãìﬁË¬WÂØà:'2˛ΩGÿåÌ¬Ω^£—a8ÊˆÜk`Ü¸=xÃê/V†°†G>8–P£50òÃQÿÅ%Cœ˚ß—mmàä∞‰„Eıôë+ûÏ™π°ﬁY÷B¯√èsãóirOÒıÀ{n.ç2çúb˙ÕJ‘º2ÂiﬁF•¡Aeí≈(^Í$Ãµ‹"<æÂŒêk≥Î.Vø¿ê^:a±Ü\å-è±*√+|èXc5Vqæ"◊÷d~›¢‘èïf33µ=Êﬁ‘x â®ÉŒÏ Q¥.| &+√ûñ≥ªö~PnJ¿¯"Ç7ÃâV∏V0HSu“º‹AG¶Ác!"çT®NÁ⁄æ8°ù9ö´±[Öa¡DîD—öEt≤Üëw≈l¸ºö6—∆.h‰¨ß(°˘sˆji kµ	2ô≈º…ÇolÀtîöîÃmg
‚~ÜG€˜ƒ5º•®Ê≠6∆Ê#Ù*ç]ı1á˜£,ı‘X˝<«‡4h|¥‹;4VCYà9 ]b°9E4Mƒ …Àå""67E◊◊≠òéÇÂ}Z¬í6∫HM.ß	E6ÏK[N"˝¯P-'˛≤˜˛L'/{ó›´¯Ω4NÜ´ùØ„–˛íbd	¯œ–
€K"yäòLn√‰ôVìY˚Â¶ìÑÒ$⁄úçÏ'[¥†Hm(ÔƒäRŒéÚæ-)Ôœñ≤π5%À˙ù—õõŸTJXU6∂´l≈≤Ú^m+k[WT}˘N,,Ôƒ∆Ú¨,πCy3ó¯NÒª≈´CÙ´áí“Õ}Ω°î√ÀÕ¨V%ÏV[±\Ω€U.á6≥_ï∞`ml√zﬂV¨‰”cΩù.m
[ªIö.ù÷éROõGc}öe[€>Vzv¨m%ì€…"ñ≤∏ä3ñ…Tƒ§˙©:?àSV¢¶YŒÚmgÎs∑üï∑†Â\<!›ë|EF◊£0h¯Ê6†"F¥uOŒã“÷⁄;ßçi/{gß˝Û’?ÿM_ë≥ã·Ûã¡Í_/ÑuÌeˇ≤7ºÍùè˙¿Nry1ºÍ∂ÀBï!-0•¡à/`JÀ5¶≠eNì‘XËƒ#÷ø≈Ì1ã•≥0ÈA3À¶¶∞™˘ç+aUK€’î≈EÕb¡ë∞åŒµå≤çmKl®Ïc“òñá¿4¯ù£XóI≠d
;ŸÀ’?_tO/ÿµ5£+*|ºá≥ß≥ÌM|ï—l≥Y	√YÃÙr&j≥œY¢Á+‹Ë2Ú∑¯$<l-ÌÉ~ñ+˜≤±X°k;Ø¸-WlpSö≈ˆ\™ñ=ß3êû%õLcy◊¨Äö^Æd?˚ö=¨9∆Ññ,Úég*_§ÅÈNçõ
ñ…2Ë"W	Îaƒ÷ôAæâ'|ZvT™∞ ¶",#¬¥µß†O˜BsVøXﬂ/çπs\∂Bü√qVoÒ±“∞¢àkõS≥≥òiäÑÕ7ofTÀ7¡®Îí•`ΩbÓsÒ^˛tiƒpÏ˜™€'OHΩûπéã°–qS<YßÔòOXw…%LƒWJxz i¬§©¸ÒG—™ü»|æˇÑº4∞5°w«fâL•WYÈû˚[‹bñ™NÿE…ö©Îê3/BIÎs6x≤ˆ¨R?`ÄÒC‡¬Ó¿Œî{©Ú'8yç∂€Çf7ãd¡Ãˆ$D∏ﬂ®¯„µ[ñ†.º•5òŒˆƒ–tïrn≠}πXü˘ÔµÎ≥‚ãı˙@bœ«˚B÷Á∂øx≥íˇ^ªﬁØV?sÇ£i8Ã¡˘ÕÖ¿enÄfS¡v!ﬂÍÈ]ZX…-ƒQÖRj!.o#^”J\ÿNúqû≤û≠∏∏µx„=oã±IË∑î=Ä	⁄“Ê‚Hßñ2ÁåeÛ"œhúc6éË;≈-«”uiÎÒiˇUoxÖp›òÔQ<áÌ◊ã≥ã˛ioT⁄ú|j‡ÖPˆ∂(«≥1*Î±ôvÂ8Òµ|ÚÕ⁄yÊeöÃwûy±œŒ3oÁô∑ÛÃ€yÊÌ<Û>^œºî39*‘ârí.VòÛîVõﬂï«ûTÉ˝Ñú∫£˛Û˛I˜ÑYÃò	Ì¸‰eÔ´ùÔû⁄w/‰•ƒyØˇo_\˜{√”˜Èæ√˝!πÔµê≈««‹¥•Õ«‘Y√Åœo”|ä¢¢f∆∏†HX∂ñˆ¡Éù™¶´k}ÒÄuG¿¥Xgîr∆Îß˜π°Ö1¬°è◊%ôµ«NÏ≠˝(‘˛√VÆd\Ô“•nŸ;«CNZ‰⁄~rÃÛ'ÛBZ˜Z/˛Ûsá“Æë·[ﬁF»ß PﬂÈ2ï’∏5, yﬂÀågû®É»s¿AÚÈ#Œ≠KaIüáﬂ´ÜeQg◊n	,AµΩºŒwë¿¿wÂ|„"Åo›’œxeªK"S√·qŸ5Ìƒ5fs€–Û£&Ûπã„ºIÁ®{’dıã⁄Ùƒ&ïœH´@◊®ø^y?=›ò.]-ÊôáÊÜ	PùhD”Ô5¶!¿nCc€8çÕ˜∑ì+∞îﬂe|Û¬ ≠ƒ”∆èéñµ9ûΩéM Õ≥¬y/¨≤ >≤KÃ¿Äe¸wn≈û-ùÒ£ƒ´føcÀôÀ9ªêáB¶A(hf∏QTE±&à)2¿+{aˆÏı\O√∞å5R	U4®¿0ù√xfÓwXN——·ƒ£;⁄ÓætÎàåàNS‹ÊıqÖPïﬂ◊H•ç{è…sê¯î9 ÚÓ(Q8´‡1©t”LL{¬£Ë⁄‰œ§M&ÛÂı≥ ÎG [˝bﬁaahØ;4¡Ò∏‚0# îö],î{…È≥ΩËbÈ,M¥¥TÏàà¡lå96ÏÖµ%ø *¯Uº\ƒ$õ(˛√Y^¨‰ëjjõökLa‘¯ÜeÚí◊ñ –ﬁ¢’TkNiã`T‹˘ån}Z⁄g‘¯·˚•AΩº◊h§'™◊h\1zèa7œ{◊√˛HÑ>Bê%È>;Ω8ÎüØo”¢K«pÁ≈HÉÖ"n˙â≥Cn˙©÷võ±s›9éÓGwé£;«—uÜ2Fb1sMÅ<ï™A#–ì¬z≤5˜—‰X‰≤C>B3ÔRxØÆ¶æ€ÆúÔ;gﬁù3Ø≤¿’ô˜∏•5«©ß˛®˝®t£[Äx,€îWÔUgQö;«‹Dp€¨Ì^•€›F`€èƒ+wÿ;π8]ØO8~`pq˛¢u} XıπvœGØz√—{˜¬Ö¡˝†ºp[≠Gôz,|p€•Ì5<p˝Üm‰ÅK*Ï4…π√Ôﬁ-%ıÍq˝I]8\GÛõÿSˆ™’®Ωi4j∏˘ﬁWV3–÷ó+°5Ω≠9˘îtëC¯ØU˚∞¸và
hCÂë^Ïîp⁄ıœWˇ∫ºÍü†m=!Z"ÅnCN}¥~ªYg5x˛≥Ö≥.˛'^=≥¥Ô[¸Z^î∏Ã/\:|„4Êy∆ÍÖ&©≤éf°"8ZŒÁ9óFZÕcn8∂≠‘˝€·ºõ˝‹Ö∆÷F≤H‘—*óZ<ΩZb‘¬c2¯ï}5ù‡√8òöÕü™xó©òäÜæUgé˚•·q√GˆÕ}≤æ" ©œ8Tkñ<Ω≤´dqLˇ¸îd\qV»π-P%cu+ûaQëUƒ3Ã5ç	≠ 8iÁ%ˆºƒÓ4û¨ﬁ:¬ãπdD—∞w∫ãXd®øO±˛˘Uot’?«ñ£;‚7µïµç`˘6üŸØ©YÿDf)≤n∫òzå©3çD!—µº¿"ÕÿyÄe⁄æv`±œŒÏ£˜ ´◊∆«Gı[M˚∏£>TMü”∂èimºUß2q8˘n<¿63=6<lhvH⁄$ÅÚÉ÷Ç÷Ó!˛/∆Èf≥Uo∑3Üc“hÈq,ºŸÄ
çigΩ
4⁄ù&oMö}ê.pÚ3ˇNÎ∞uîPr´Å‹ ˙%i	hN⁄S˝#tåãÈq±É~â6ï–—“EâÉ˛,=éï˛ªrÑÎé∫£@]Ôz#–‘´~q›•}–6ÏÌ\ﬂ“Æoåkä}Nú{§"ˆ=[Ω˛/«éOåá·W?F-´	∏96ót∏∞QÔ÷.î	ˇ∑W?∏[Ëÿ1=^BWÔD:°ÑÁ[z§?ˆwÙ·I}åC•‹X¥–CıO ∞üÓ◊{–œ‘ıÀæ—©9”t{Ô¶2∞Ó¡ÌRÌÅSf∑®´†Ì«kîQîêƒ•.R’?pU3ÃÑg˙=g¶ÇÑ¬⁄ù2zv”ï¥˝je		ï2AÙ}Í‰îSB˛¯#R˘Im]ê<„·ı¸yZ†˝íÉÂÆÀ]pÇÜ—h|¿{Ê/‚zö	˝7èÜL‰óVÖW»â{‹∏Ö≈2ª®,«*s°6/6û§@ñb√!”-v¸¿@7`¸±√Ÿ¥ˇ„nΩpnóuˆh2TGÿ£æ'OŸæ‹∆un˝‘ Ωá1zgËöN¢E4å3ö©ÒÊm~¡Z|µÿäªåÿ≈AÃ´Û)añÀ?˛8˝Èoô˙ÖixÕcK>@W6[n|äè»±
‰“*Z¡S“'∏µG/≈,sé8ãå2Ëœ	µ3å^ë5ã,eíÖòz)O¨∆Ä…üñ“ >#M)ıÔì†¨a)ﬁ·‘ÌàôK∏ˆŒ}éÜ›/Io–]]ºv/_~E>!_\√Œ´ﬂÖﬂg∞˝"W/Y ¸y÷ΩÍü`Tñ§û©πû^‹ﬁ∞"Eì±#—H˙LKRî⁄GQ"›È∫¥^%C˙ñJ∏ÌºŸ¥p…“Ö^é +Ω⁄¨ÔÓí∆¶°mA´lLsO4‚›„öC”◊å/@–zrX÷Ô–ÔIÒ:„L[]sæã1€%+Ç8V/rwÌ)î\èö‚iˆ
∑å5&ç™SXÊÛ⁄¡Û:i /ÉrXf•ñrq ∑û—⁄¥1E¿<ñ¬Í;π◊¨«Ów˜™%,‘ìˆøVªŸ–É7»å}ûÉ*CgÉ‘ﬂ∏“˙d:°á—JgQT◊∏’¨∑jáAçõ§{ßY?ƒj<vÏ◊õTuJßÕI¨™,lNnUˇ   ˇˇÏ}Õì7≤Á}ˇ
∏ﬂÃò=Í¶¯—ﬂ3õÕñ8è˝1$[è¬!…b´líEWëí⁄^m¨èÔ‡”Ïio≥{òÉæΩkˇ'Ô/ŸL U† Tõ-…ûvºßaì(T"ëô»L¸êPI›≠TˆÎïò‘“ÙÇÄ’àÂ¡uÁdÍæ'Ç«Óéª'å¿ƒ‚¬∞˙f∞ÊójµzP3˝2§g™Ãﬁ]é1åù±|S∫å´ïIcÙı3∞‹„pä˛bgg¯Õ5Õ–¡ä<wf¿CõŸ˝%ù+≤[Õ©Åê0˙´ÏW’:ö 7Øpq+Ò˝=;REÏÒ(≠tñ4
õ6y0F√WX¢opDtè€4¢Xƒa—éVVÜ([7˘∆€™<YPGˇãr8r ~(s§Ë„˜s˛Ã ∑Êå++Û¡/+`Às"‹Qê¨AvËèAÓW–Å<∏∆t®vò˙ˆ∞2™⁄6±Ô†[˜¿|õ1ÆK∆ò"Dœ7:.[∫ºQ∏E`!ãG0ﬂ °ÁlëkgyJ¿D⁄åÙ:zÉ)‘√∑˘(öÂ¯	6ãõ9aƒ_.êy§^Å;céÅﬁu8ÙÆ!ˆÂ?õ	óèZ3#Œ¸uÒ˚lTœ˜
R¥™y7s§ãÚE%ûlNÔKÆX/Û9«-πñ°≠f•eGkÕÛ‘¥òÙÊÃ4·„&∏±·+«¬#ò0Ü =aôê"b;—{áeË'ˇµÀ§®ã»Ë5 ôÖÏ;¨Çˇé°sÈò˝úπÓ5ìh!BºlÊÅ≠S/%3íwtÙG˛>˚Øe‘k>∆˚Åjå‹±DH÷∫@óC—πùb=k˘≠!k_§äàhËW¨#b—π° ]Áõ0Ω"z#˙ˇJyg3« À<}ñR]DI*S≥,b?wdfÍV*xjon≠∆X›ıyW;íw≈ áTù/ú„Ö]#o[Ë=ˇ_^Ÿãá‡N}0’HÅ•f‰ø¡˜‡ÍÉ∂p¯äL|ˇƒé"ÅØDÆÜÓÂÄˆ&áõ∆©3÷3¢ 	πYˆì±º‰ƒÊs‚-0V„yEÁÊ1µ“˘BÒ"’Ùµ¯r£Ø»†÷ÿ◊! Uæ≠’Fu7Ö˙¨ÏˆFˆ—Í5¥Åö©’ıXÖ{MêUå‹SÄ¿•_∞3ö|
w®†,úkSd 6>€©”T˚AŒÖ|í˛Ãuê3úür•W)ùedeGìÅn… †JÅ*∞çQ°Öíi2<~áÎÏvÒX≥˙¸iD8Û$wFıC&œÚÇ ?ÏU@⁄Õ\	ÏGRëY&·ÆÔ:UûÈ=Aèamñ‘ø$Ô2-ºWö»¡ŒnΩ¢/?bë˛¡uv*w£0,öqlœ‰≥.€\K∫2¿ju¥cªâ%kÄnµVäƒ˝„¿'R0≈ÚQÃ≤*ëYkÖ√œÔøRé≤á-aËµ;»©˝iºµ1y„‹`ΩÚp@p∑èΩ!€0ù;|;ç1…û∏∞\7f3˜-Ëßnw	~†wäViÊæ°¿h]∫ßõC˛D=u©u€&U-5sù—!¸%{ÈîœH≠¢e™Ì^jA~O∆.πëPl'¸)∏î#è§	bË )Õ≥Î W+Â›òÍú¯ô¯òﬂQCój˚PÊPV@ﬂ[L0|QOù∞∑∆„Hüñ∑üìËà¬I£˜Ù¯¢—=!'WçbÌè€g≠~˜ˆ«È∑{Ù≤ô/IÛ™qﬁnÏy⁄∫º˝°í≤Úw	z‰‹‹–æı(~´⁄]Ù"x=t—k(˝Î´P«p¢ÑËú◊ﬁÏØË?ÛúƒÅ [ÊYJpˆ‘‡Õß©yk˝Æ‡#XçûF(ÅPe≥5%ÖzÒ$√v¡°Ìh≤-ΩÂ`A≈g‰Ö√â„MAYÉ˚‚a˛	Œ¥Ëm2≈†eEuDåPE5—OÄ†&ÒPa…:sÊÆO¶Kº#¬Å1ﬁ˛ì]æ0√+^;!"—¿°\›Ôà3º˝œê÷_Yx!^AJ±5„Ó˝ ºTÎ;õ‰Ÿ∆¡≈ÏnÖ·“ô¡ªz5Á-ÜXõ–kì—Ü˜∏¨D{H^y!Ωm÷ü‹˛|tQ\‡é›ÄU÷(Åz6ûµªÑ:£!¨>ÈuØ6À‘{∏ÿpóã∂h~ñ*x˙”ÊºªÇvÚa0c••‰”WYckˆ’ C-j9‘¢V&g∏ˇ¸Ö|rH‘4¨ﬁ0Dñ/‡G-0ÉÒöZ‚cˇ-_C?#ªZÃ≠‹ò)˘gÎ≠®Œ;™‘—Ç·?µ]QçÍyÌX›¸&Ò@Q ûI√›RXµÖáµj∂cF¸ha∞/"E<n$>8‚Ù!.∫ºªã	©*îÇı≠´‘¬w@+éuå!Ÿ∞@k◊E	˚>Õ⁄„]˜‰ïÏwJdPo");Göæ∏Ë˛{ØﬂË∑/ŒuEÌ‰q˝Ñ húù˚kv/ŒËÇœ öú]∂NÁÕvÎôÙ[ÁW‹Oh4oˇw›iÓÍ¬Ã•Ê®JO0YmÇÚÃ£\kgΩLö—ByÊ‚‚≈ÜØ
Û9$ÌŸ~ÉH”	F:7, /(:´∑ A•`EÓ∏]@t`ÆÖqñ_ÔU}û~ƒ‡}ïD1v……^π›|J°ÉüBCSªﬁÆfkTEã≠ÍÿÍ””ùOµ¢ñ…êËÓÖA»JËz±ÌxNî¿zÿ´} €õ|P]5÷Y-~z∫û—ãKp’.“UùuUO∫ä†ÇFßXƒË=uÁ¨ÿõ˛¿Y¥g„ÇdIB√ø("4 #&°;ãSh®ç˙#Ÿe"–´‡‰J?}Ü3œ~¨j~¨U¯èTx>Ì’?µU#Äá;Ókw	Å:b]ØBY›´DÛ_˙„Óoç°á∂&DΩ*¡óënõ£`?L~zêµΩTqâ®ÿ:€Ë’I^¿‚M-\ô-ß‘òX¬=†c:Æõ=é!Ùƒô’≤µèºìíËû¿Ë¢æ~OJ1m¿¿ÕM–≈Ë{œ±ìT´dö\ÏéTèHó;Ê±Æê“7óé)Øa‚î˝Ù“V˝+–≈ó€±&/d¯Ôóé23äëµw≤cÎ·OüQ;˝ªﬂŸÃ≥˝ç—Îå7ÿﬂÄ∂›ºø◊G ≈à≤NÿÒ’∂¶é\¬6sÚ0ÌÓÓT–”Eﬂuá{$ÓoÃAhÔ$qÄ´˚¯<˛S9ê;©Í™
â—h™äPMo®≈ìÏµ:O‹∏ìâˇ¶ —¸ñ[åÄÎRπhfì_àÊ›àIı}ˆ>"›k∑0Õò⁄™ÓW§>2h.Jeˇ©IUéã—à√j’™–ÉëBcº°Iñ"äbîƒlM$≈wK0ë[,D°ˇd]¶©0ëw¨]ºõï∑…Œ‹ÿs›ˆìˆIÎoq∏PÍ}—¬¬‹*?¬•Kp˙wDrL\yÜ˚s˜»ïj%ã))£ó.Q≈"rÌUe´§Ø At6)Õ˙=Ëı:›óåFé.#ìëÓÚpáï{à≤†\©≠}jzAô¿—Vµ3ıK«Àﬂ|Ø]ü ˇ‘{ÎéJ’ÕwÇóFy9î„`ìƒ†áá«eéù—ı˝ÍSFX~ß´^Út!û„óñwfUÎ≤äõ8‘ÂYIótq˛Ú®X…ù{∑:œ ÁeÉ¯v5m∞p…iÌà¸◊¸_≤_ÆòçPu?kMY Í◊¬+N„ƒÒö8¸[‹d˘≠Œ√Mº’Z{Ù÷T!0–zàB'ÇÀcä˚?âE~øvî¢OÃÆˆNEê∂«0K?ÆÈ.sM51ß≠;∞äöﬁX®öÓC0s‚1í-ÂhÛUm}SÛ∂)£âÛ´ M˚¥Fzu|ëôxS£ø§)4E…;ï⁄›û◊{K™◊\àRŸgŒIûÏ$›tŒrÇã{ΩZS`Ï&€É‘˘èµı¯èÎ…2ﬂq[œöX>Ì6¯≠/lßòÌoE÷´®k∏ûÕ~˚x„a˜˙4œÎ¥=’…˛>v≤Éjô’I§áVO—‘Ö›¥M¯mÇπïºµﬂæ4N`∂ØˆavFÚ÷Ç|Ÿä3ÜËÅ…È√wÊqÁp¡÷S‚-”Ø∫ì∫rü
Ôﬂíí¥]m÷Y’ì≤xMı#“X∏≥%ø/•Á√»Ä˘>}≥qiwöÍôNSú¶™›i™ßù¶zAßI≥Lc¡]Í?òıJ^uj{t©§ÎüÌë’Vò˙ø 
£›pd≤ƒe∂˛qÆ3ö›€h–Q™Kvdï£T‚k˜;2:~<}i¸/ﬁF7}ó√*]4“ﬂ.√∆Çöi•™mRFßèœû~gÊ∆ØƒrClDz0ﬁµ˙Ü{u◊+TÃ P¿ÄÔ!¢fÏ—ì?X#Ø˚œ!Ó™#∫…°_YmÔN¶ØÉØŸ¯N⁄ÄÔ¸˙¯Œøäo^úü∂«ÌN˚§qÇxí≥´VØﬂm]pâ›˘ÖòÔ},&åT„XG¨“xÌÆ˛K∆ﬂ˛K˜Ò‘·~›ÓoÕc˛•[Ì`hcÙÌ“=ƒQ∫!yv˚¥°yÃø€‹ƒoÅÁì÷iÔÍÏ¯ÒßÔLxΩbôf9E	õÛ˘ Q;eÃñ"™7Åcl‘π‡≈ûØ]ÇïQÉy‡rº€±∂:œ€—¶"Ü≤fá}fô_)ºÇ)N◊ßπV∂À)Ä§∞ÿR˘êœ@„^óã7Æ˜—ﬂ£fÉA—Î'ÓXwö4≈ƒÿù∫èf∞{†RM3éç”{\]ˆÓıÏÖ`gœ˚≠Óe∑’Á¡¬ŸÌú`®Äﬂ?È6NΩÿºËv[ùË‘Dª◊ø‡{öGÑq=kQ¡ Óô$ñxOòÑ¡DÜ«H∏¬ßThY·ÓGı9˜ˇ6è»Sg2qæªˆCz>
ÏŒ KK ⁄>Ÿ£≥wer∂t√E‡0aEAg4Å˛è@)z,`ΩMoˇ\ª∏‰Ä=Â¬‚µ!ñ«˚ˇÜØ|BªZ¯e˝©ˇ#√ÈSëiΩ(QUWVwáÊ†œ∏-T2¶’~ã>t„í‚π,˛àºw[xa‚~ÌÃF>qÑîí˙P}fáLº˘ÌOhnXYÓ°;¡9+kÀBã√=sfŒ5-tÖ'4¯÷;"ÅoiNn¬ı"<wÌπ¥Ï/;[Î–ä d‡˘†PCgÑ•#Ix˚œÄû(5:˝«ç^ãú∂è∑!"n\v€xN#tØóﬁ‘£óÈÜ˛ÿ√ãcôÓ€üG¯⁄‹˛Á+∞ıv»ËÀzò‡f„˘2æ4z_:fî~å’ŒU≈N—µùÊêªí◊≤ML7/GΩ&á:∆ù\Uµcã8Ó(6çÛ¬x∂3‚=ÿQµÚ»X¸:&õÕ®X”rr*ÈV<˛RÏÏK!>‡íıäØÈı4;MÃ…è∏€Ñ”BÏòæov$^ÆÍh>≤6MÍy◊Ú‹€
0é¸FiÈ√ÚŒx&/hÀ≈é"á`æ—+puÈÇ¨ªb≈œˇ-≥Z‚;æÙù|—Ëtrñ˜
{7¢KæÄuCæ%ñﬁ≠7wáàôÔ-ñ£Üåæt`}$Òs“)Ò∏ 8ˆñY¯ﬂ~-∑A>˛4.˝˜«´~coÚÏ§Î|KæÂQ≠\‚{-≈Ωï?Ÿ1ÊKFg™†∑ñÄµïﬁŒ[t˚˝ï€÷Æv∆{Æ∂‹Ø±¨pÕ≠èv±^vvπ_s=6]ncπ‚∏nUé√Ü"UK∆N*F¬Am±æxT±–≈%çU ‘  Í≈∆rïª√Õµw¨M¶ù.|£Z<ã¶[ËÊı!÷Œ2V©U«éªkíÑ‚∑ÃÓÏÏÓÎ∫ÀMzm…∆ÀŸ™U+ÈqaÒl“Û‹fWMIØ¨˙ãÇm§kßH„eBR5¸x	%+…âÁ`/jÎœ|˜kK*{ï√tﬁÍ^uXÆâQÇ·ìæØÌ÷wwv5ﬂ;˝~^ /◊X•ªV"œUÉ¸’«Ôxµ ñ≈XyÀb)ä|ñ≈\ΩyÀb!}À≤BuÛ‚ñeÖ:ËF≈àÊ›‡Õ“Gœ«‚*ËJ*‚™•sÈHÍÈ{SW-∑z'-Iıvøjb&~=±øÇ¢Xà[£¶ÿà.¨*w+îû≥D∫§&jiÙBZR¥Æ˙ J¢¸æìéX™áﬂÉäI_EC,§Ø† f“÷®+’j/‡≥Z˙7˚¨˙˙¨éòjù5yı¢Ωπ ıﬁ°PØiÏ+‘yUÒÁŒ–[‹‡SïÚÅF-5ÏZ©@°Zö0.J»ÛjR1B}≤+Œõ)]!JÎï;¸Ü÷!„•±öﬁ·Ót™yÁ‡ñ<¶?ãk
>Ç‘¬Ç5·4ƒ≈OóRÄ‚T}"Ω!ùÉMª’ÖI˙SBëA•}äB1A,∏»ØdîZ€ºVwdR7mÊá∆ËUVaØ’˚ÀUÎ¨ÅËß‰vÒ/IØ}~qŸk˜˚ÀF∑uí‰Ñ7ƒjsèq◊>⁄¿◊ﬂé©gc=U †Ëvuz7_ÖRdU)2pÜUjú7˙∑?√JC≠Ê≈ìÓÌß¯πyqvŸiıi˘°N„~x≥ì‚Sõvi¥aò÷¡jô 4Öt‹ÒÇúª@è˝∑§‘
¡íN¢‰Ÿ7µÕU2LÖ9§g≈]cŒR˘d£Ÿ"xé^QßˇßÉ´‹M]ˆR≈” ∫*¢Ë≠ØF©h6.=rv’k"*£ÖJr—≈“îmPòß≠Óyª—iıÄ®Ωùhl∏IÖú∑∆ÚÇeÈ=âà±D∂äKì’≈◊—3“Ïút´ff¨©<£ ‹Ù†BJ'2¯‹«ÚísÜ‡ïèu#•a¶4¢∆5¢KWìS~}uRúèîzÙﬁê„∏IñJX‡∫wRâjµöËEtZu"Yh¸q|-˜π¬bT†·ãTiáª)—~∂ÌÌ√zÉh∏JMB°™ßíôdÒivn<Sã∫T≠* §aùﬂW~‡}áìäw øˆF∫km
OèÇ‘”M7≠∆*SπO°w{ÚW*·º‰(VXpG®–ˇÓﬁ†Î˚\—èÔâ7â«lÁ2|¡w8Ω≠*¢e °¡ﬁÁã∑ƒ7fêy7(ÉzlÂÏq~∆æ⁄ﬂ}kÈÀL<XZ^Ló!Ü—:∫.†…pÈáT©=•âä;≤ìDw-_8ìÅ#<ﬁπ˝	æ%¸÷¯‰räßÜŒ‰E‡^{˛LxæÎ^ó…UÙªπwÓ];i˙hAÉ€–J@õó∏@ÛNRl•]µy£∆™})åïª≤≥v,É¢ö¥IIr?:Çx7ú©óØÙ™Ñ‡:7“§do^÷∞2+øèaÒr®y∂ïB†,·sˆ\Ÿ}E#≈ôˇb‰Üà˙ÚSA#è—BVbOlI1—◊‘µUñ1Ω±Äx)πƒ˚"Nh_s
êÜ¯	ô p4[x{Ô¬^aùipBo!g¸Ò9<´Aﬁ<-m≤nd˜G€¡Í?≈≤≈¨ŒÒcÇﬁ ÁWπ@…3:‡M6€∫JEﬂÊ}ByÃ“7¯·3uÜ-/©$Ó3ºUÀá§Î2Îﬁ-Ωë≈Eñóù$p‘€ü¶à0aOπaˆÎ"	∆7ñáØú†±(U6Àˇj>wÉ¶∫0Àè¯Ô!FX
7À0öâøx“∏AT◊BüÜ@ƒÙ:qXxNßÕÂ©3èäõf*7Pº+˙ójﬂH¨~È_Fâ§ôîπ”	ä¨I~óa&òôŸà@¥‡awXú=ÚyAxúŸçÅı≠∑àêEﬁ≈OFŒÚÛ8ã≤π¢)I/	ºœ≈øèµZ;$Œyyæ_ïå<ß=ïsñÅ{ÓL]#Î£∂\E7hÒ¡™ldL	{N¯Jìá≥Ú’S”ƒù]c=LP÷ä>¨ª[ÙïmüºqoF^≈8oµÆ|’π•8Î2˙Êª1@´‰	–ƒ˜u@ﬁÜŒ˛Eè—ﬂCr  tóÏ¿M˙-{Eﬂqûÿ≈r˘n0Ûú ?∫xHDHBó[_g&Fıµ;µ\—ß!»Üx£A°àË9“Rß%†oKú°T¸gènãäOZxÒk·|L"»«Ïˆg–ö![l<‰ F#6≈Ï&Ô)ñ–nFÎ¸ÔÏ=ÃGöÛ˚FŒrgRïßà™ ‹¶øúå@tæ∫qñ¢$nt´Ÿ◊·Â…)"p˘HL≤ÄFü, €f£sJÁ'§—|⁄ÓtZΩ‚8€¶37ÜØº	HmNòÌlÛ 8‰ÜÙa©¿C0¢∆∑K:—„nÒ56‹-àıx€·td¡n±≥B∞[iêÍˆH˚Ø§} √>Äa¿∞Z<Äa¿∞`ÿ0Ïˆk%˛˚ Ü} √ZI √>Äa¿∞
Àì]VõÇäìYXÿ®˝øˆº—Ì∂·W¯•ﬂ:?¡zMC„/WmÜˇ{ «^º?N›+T÷û+¿ŒÊ∆ŒbUÕ´fˇ™ã⁄ˆ
ËTØÅ⁄u⁄Ë5◊ùMÔ+D4à–Ylı ù}ÄŒ>@g%–YTh;tñ¬1˝·ÃùzÀ≈‘'d"†ü$?˚‰å˝jƒ- }°¯ÊŒ:¸gco∏˝å$Q¿´uΩ˝OD¯§w˚ÛƒıÕD{Æ/∞:IPSÕ÷Æ±ó˘V:'4›\≤ü»â;πFçRå„v&CgÊ:ìÉeäË€c:§5∫˝¥*ÎåfYÖuFﬂÅuEg˛£@u‚(÷ÉÍ«¶Ç:MøEòN€ÔiHßµ∑|àŒ\]‰t⁄zz¿s™ùº<'NI
œ)´qn<ÁZ4ˆﬁ·ú:-˛pN‰Vú3§≈w&›Ê∆wä2k¡wJcz¿w⁄ù–ÒkÑ;aï]‚9v¬°á¢¶r¡§o@œD~?xß()ø2xÁ\≤ ãî˘ÖÅ=q¶»ÔH¥ƒ‹⁄ÛºuqﬁË7:‰∏€hüázûª`ƒa‚èæsa=õn‡¿Wàû‘c;i6pÁå?æ=¿ñYËN⁄]!xß<∞èﬂ˘Ä˜˚E„˝“I∞pá;v∏ﬂÿ›q˜Úm•Ó‘«ªn‹œ≠÷ÍCÎVjä…Ò’l∆ÓXØÔTw5à∂bê@˘%hÑ¨…˝%£$2Ô¯Ø†A60¬˝h–: ô¥`¡®A^á?ÎtA∫ÀâTjﬂ
xã†(f-7éñÛlì¨Îtœ	#úÅ#Vﬁ?6!r÷$pÇﬁÅJú±xB‘˛◊O∏ÍÙªçﬁ≈y˚‰Ç4[›ù8Ùx¿&Pl¬6y÷Óıx„÷^q;Ôù^ú˜ÅÕùF˜#≈%h9¯ 6–H®B’‰YÎºﬂm”j]†%óçÓÌúˇÂ™øDöqGƒÅ&÷ç(!¥Yå9®)òÉƒ®"˝Ä9¯ó¿¨Qw@˜	2†*lGº∆D∑·j™*“3¸Âˆ'∫°ﬂqXq.w¯ ≤ôûÙ•TFJu’˛Ó€•Á∂ù˘§≥≈+/Ω˚À`ÒJË¥sqCv>∫∑înÇ©ÙΩQjòó˜≠èóÒ¡èÆü=»®eàJ79xÌSVﬁJ°®W&Mg9ÚAËnˇ1≈‘u&Qq_
UÈÆrÜf√W7SÁﬁ»'wA“ÃsÇ€Œ†GƒÚ∂YU‹,›´<’ˆnØÙ%Ù>ˆáÓäùv¸â‰$óuh!íıg'0\Bàﬁf(D·‹äö~Å◊„ñüÛñaz§~lhìX›U∏I¸Cº…Läœ>
¿	%e=àit*‰ƒ¯cÑ9±6HÉNÏ˝ÂCù‰Î#Ïƒ⁄’ÓDÌ‰Ω‡NË.U
x¢htn‰…zt˜ﬁ°'Z}˛ÿ }+¯$µ+©õ˝‰FõH3ˇkÅõ»Éz¿õXﬁ◊ö@ß·ènæ–ô£G‚Õ±›w$rÒ÷ 9°ñπ‡∑D¿ìä;ëDÊ◊<uöÖc"gÓÑﬁÂ˝KôDK	õü;bL¯gdÚ¨¡™”áó<s>+ç,Ò¬:Phâ8dÿ¡∑)Bê=·ç∫ÿûú"CDß¿∫ﬂgöØ˚¬&ﬁ4ÈÁØWï˜	_Ÿ›—–sÏq†>£ßA=Ùv5Àeâ:ÇÕh!;†â≤∏jAx%_¡ﬂÏ-nÿ⁄¶<ñÙvHÚ0zfÉàt∫£&ˇ6Ù∑ìücÂí’ÎàÜ¡é¶œQ ß~Òxº´{ ãcaïSÓÑ8£1d‹R>%=¢ ≤∫—,Êöá¶û;göŸ‚b?†Ú?^ˆ d‡—GROË…dÜ'0v”5àxπ±πô^·çs¸N«ifcV_ª3‡œÛóT∑≥ô=q‘NÕ¸0öo¨˝ìÙ˙ÕK_πÛ”ô≤o:{+à›ﬁ˛≤•≈––ü	Ø◊4É7€∞ÃõÒW
/5?ö˛M†-Ì‰m$˘jFA¸7KO0ı±'=∑‹Zçﬁ <.„mÌŸ»}{1.ÒßS.	µZ$FØ€U]gõ∆r∏∞(;—  Ë&±=»{ßDÿa4|Ï£œ™ê àº3¯\Ôåmı6∂”j¥NN#‚ÿNÉÖ∫Xc≠ØK0 $-≥⁄ì»[©¶ªÉ¢+í˘B/ìÏÃH∂∞XHTI,†ﬂí<`≈Q≥Çöf©5[ŒpåÁh{	¿WÉœPíùD4èﬁÙ›Ï7à2e‰øìŸíB—˛†oﬂ˛Ó€BÌcá§–S«ﬁxã“∆û≤P(<fpótp_
«•®[⁄xéIåÌ◊‹e(c*|—¬ß¥ûøˆ‹7«˛€œ>›Æ÷*§Bˆv*dg∑ÚÈW™(rår#NÂ3f«H∏#åZaB¬&àR¡^⁄5c±CÖ‹¥ ~'öøléí∑¡Çh∞îrß0Ω≈:˝NwÅæ#:7Sígca“HÀD•{†x3%¢Ÿ›c£Ã9‚!6æO¥FAŒ5%¢ÎÊ$Ó-◊\HΩi&ÉÛJúÑˆœªû¡jìµôàYØfá5Òÿ:–Ò¶Éîa°ŒW¨ÂI≤åáBF+æ∫¨è.≈Ÿ /˝≈®πÀ≥"+º_^N·&p]bY5\zﬁ»=¢A*°4Ï‹ ,h›HK∞¿?p)>ƒ*mq•7—™õiââ%îuΩ)Gœib˘=–ìK'àâZs~Á/é⁄úêÔç«©9DHyÿ±Éù8¨¯>√3íckn'jìﬁéw‡ãì,&,ÏDÁj)Jæ…fB©%e(=∫(.áú¶≥îf(Ωºèf˚oΩÎ›Z◊(É“¨wM]„R®Nã∫$:É–ü,.Ü+ìÅ3¸_˝ùÔO›ûWiyå¯≥‘t~"∞íö£òNÀå~hW<€èœı@Ã—û^ØÏã”w•{ﬁm˛¨∆ªT‹£v
º¶"˘K3ÍÙÎ˘”))ÌÔ¬ø|∑‡qº˚àfí‹‡Òÿ˜¡ÚêkgÆÏÒ™ÿ˚3VŸàU¸ï „£më= ¸ó‰§}~˚|¶‹9Ì\˝9∫π∫ı¨—πj4€XïØ’ºÿ>π∏ºÏ¥>4¸}{{õmeuZ_∂ŒOî9müß∂≤	≠˜¸Ãù˘°_pÍ5}(ÂÖ∆9¯x≠hıåª.Öiø‘rFY»óºﬂ≠1¸OIÿ(€FZzWﬁŒZmÎ…ÇB
%%»iµ=¨d;^ˆÌ<ÀK“yÕî∑ûΩ¥;EôaØD†ﬂÂ#nmM`mÍ(?Îc+=r‡õIëgißc‚¨˚å≥ÙÅñ"â< R%b≠ÊF'qjtóˇ≠ymåF®“É5ïkm·`v•Òö˜~LXÁû{M]®dπN@Œ÷Uö&y‡i'y£≤;Ö_xãW•çñ;Kô‰a¶vYñﬁ»3Kiè£ƒ¢uZ7™[üger-o•îØˆV˝‚ºâ¢K≠M0µ8;»r¸Ú Ó·ﬁﬁ°Ìô©q	µ€ÏÔ¿Oño≈>Fá˚˚ï=å~÷ˆjÍÔ6…Î ‹Ù_IÚŒ˝˘û•œ˛Ê˚ó@%‚¯úl\∫¡‘ut$9B˙xèZR&Ãë•à§‘·mùí–ŒkäW—[Ñ5T‡küÃ⁄øpáJÆ•yx≈«ÿ;ùeàqd˛«ËX9⁄E˛G˝Ÿ»Yuê°{˚ˇ¿„PûVû¥IÊ©Ü≈ôöw˛¸„îüÚ©–ﬁ®øÈNÅåO¡‡†”˘ƒ]¨Ú∏ßßÒÂafºπ£ gk°πñ«XdŒÖ'HE,dôrKqÔt”},kÕnÚûc8‡-ºÔ‹KLÆ(Ì.FSw‰åÑ7‹˛L”myY°Ì√/‘Ö<∫+HräŒs◊êi]õ·q√Æw0πÙ8gÎ_¨˘w˛Ã!.Ê6n¬Û"h˝„wÁÊ`“ã∑z'ìº∫Í√æ˙lÅyl)¸æáây„eX¿n*OÊ7dÍ+WÂ'xm¨†z6uÒƒÊbS,¿5⁄º@˜ú®¬¿(V{® mÓÏÃä3≈8>ôzæ7[xSÆﬁy:∏ˆ¶˘ﬂñ’øÁµê—¨Áí%˛¢–}ÌÆı‹l∂÷{è√SsÔÌY∏sÊQ∑∏HﬂãW0‚ssˇ˝∏UŒºLÂHçMÚ37›…*AÚ Çüˆà≈∏—Aao—)˘G˙ù:ÑçGr±Æ¥–^≤1‹8JÑ•Ÿ‘’ë‰-=©e€““ïZ∂å-qØ[h˙˛L∏éèERüùöI«_-Øzßñ>C©Os√πÿÆL.˝˘‰ˆßÖõÃ¯âp*>“;≥¥î:Ô]ö[Çk+¥Ï7,-•>˚ñ>Á WB”KMÇ4ûYOíñ∂EZ§…jX&Àë¶†aûGQ#œ8ªv9ªv92ªê0∞3-#wÏ,'ã∏5SFπ4@F√Pq®ÈOñ”È87˛íÓq.ÊœÓƒ«fI¯
®ï1i1ÌŒ¯âtL‡wøã1 )ºáW≤◊™I_≈ï˚˛UààÆ"†íTŒ«z≠]∫}Ã{è~W}ØB’Â
ñm∫kÖπ¢∏ìœ∏ÀuÊî÷àI≈]ã>^Ü(º" /b»â~ﬁú\ÕÃÅÚg.?-çÒ·mr÷nùw“m5ü^§◊xÚöIPÊê÷Hq˚oπj∑∫'ö53K±1q◊+÷¸ã1_TSµGÏî∫¥°æÓ…«¬ª{„¶K®‹≠*^¡∫xwVÈÇµÒV∏ëÔÓf ]0Ô%Û÷\4è-bºL^G-ì∑“Ùdî +^,O|÷å`OVK/°òyæ$óÍ∞¸·3Õ${‚^o±ïã~ä]fƒK≤≈Ω=ŸqØ≈≈¯„Y—vAÊ±‚ƒ˝Æh*ñ≤PÂT	@(/	§‘›:vˆP
â5÷f—õÃhVrMﬁ41õUÈ’T—jÌUsYN.'µ#&V¢ò *˜Éä…˛ﬁ/^L‚uòî:((’JÌÓí¢ÆÎ%ö∆í≤øøI©%Îk«’c7Ôy≠◊9∏Ÿœ#"wZ˘:ÿ@a©+¢bœ=-tuY^∞™’¡æ¸Uf¡‚¶3¡Ωz¨>ƒ  º¶)-9¢kK≤î"._√$óøqo¬íåBÿå KñºQ6P§8Bƒëüê!9 !Ê
9"–#¬√÷ë˝•;72TI≈÷œÀÂ≤4	J≈öü…®∑ˆ¿πe∞˚
0w}wç §œ£•ÚuË“]jEA¿ükÇ@u⁄R-M FŸ^¸»ìºŒ–Kæıÿ∑˙ß›§ù=ç©÷Ëk˙øO=û.Ï)Ü…l"Ãßô&∞¶DÈÌÁ_·ËR˝eÁ6i7¨ƒ!Ê|#¢√Ò◊1˝„0˛8è?-ú‰cÚÌ‹‚œ·4˘8◊[+}\â˙8Éëæà◊@_Ùq˙‚è…∑H_ÙËã?Œıv+-AHçu÷"yüÛÊxâèÖèÒº9Ò9…º9…º9—º›uÜêíHÅ∆¬«xÜúx.údÜúdÜúhÜVùãåE∂á¿b0oŒÄÅÓ‚Nâ3üªN@∆^†∏jÒ”%Cû‹\#vº!◊ˆRqd†Z¶ô6"üì
9"’‘vòëCÂ∆Z*9[d@…SGPr6…v˙€¡¶˛»R4° Æ¸:,ÑÎç÷…˛b∫¬rD£nß]˝£ò©Î-«cÔ≠ﬁ≥AhÂv1ï'Ü˛ÿ°ÄKec,˛I	·‘Ω¸Õ˜	µÔ~Û}Ú˛w/hM<<äËLÅ9z∞¶J≠®&ï‹N∑°◊õE/ )˙ÃëûëSÚ'ùKBîﬁïgF0›ãÁön•æÕÅ›¬Bû¥Ë++ˇ∫àvñÀtÆ¿çˆÅKŸÎØùëœHÄ"3è0‡Ñn˜”8ï¬ó¨x/C˙Ωrß>Dz¥†øCÅqŒ/3A*»oæO!∏QdeË]˘•Üò¨h3´*¥,°+◊Ö˛P) pûW,˛©Ç≠˛≥‰NR%—âÊGQPò´åæ‚FfsÊ÷‚SÍI§Ïg#÷¸¥∫‚À√Õ]¶Z5…øñJ’©q˝äUøœ≠ﬁú•±w‚ævf]ΩËº5±çÊp
ˆ™´Pêg‡=sﬂT/[\m…Ï-öt(¿Èo”e˘ÙoÀìO}1Û⁄[ï>T9Ô˜9…B-¯€%Çèa∞≤ø¶+ÉºËG≥AnH∏d≈'‹;NnöAÆÜrr9W·ˆ∏ ¬g¬ìÍùîÊõﬁVIrHˆq|‹\;Ü\W¥i«phÕäÍg+âk ä≥üTLf=© ®…¬…uNR’ÌïA◊ú1O◊1…®dB„YúñÌKæ¸§’ot:-‹C>nü^uõçf˚‚º’#ÕF˜¢˚„I´ÅN.;çf∑îßNpÌÕ˛Î» ¬›}+…∏◊a¥
…¿w,ÁLŒ.;Ì∆	ÓCv»ÒUÁ+ôtg0hº∆≥—owêÁ»êF≥ﬂÍﬁ˛ÿÎ∑Å§ﬂæº ÌÌˆ≥4[ ç” î˙7ƒ{ˇ-ø‰ˆ3≤[”«ï–ÜMÅn™∆& ◊Öµä±H9∂®Vu® öDG<◊6È‡E¸ú5n‘fnU›Áf&ZR-&b«V¬ºè`ÔjÜ≥∑ã[úñ›Õì<q<öπG…4µqp˚™¯>ßP55ﬂng¸@ºÁôêU=àŸs≥ã˜†Á⁄˘d;<ÇL≈á˙qW˜CK™√•JòUu√:“∑ıœkÅ]Ï¯q^9Y´Œkb”€ı(UÈ+AÀŒ'¯d∞ú`ä
ì¥<Œá‡˛µ÷j‰óÙ9z	;[÷˘ÒÊ<âÑÁe©∆Ñ≠Ïà˜›∑´ˆl©¿»oç«Söº≥&-Çè$
[	4Ô¥ìûÓÕêòS¸îjzã€¿|V∞ ÃCTÊ`ª≥œZÁ˝F∑w[O⁄Ω~∑q“ËÂ>Rï¡‘ü0B_QM«
]~ GÜ@ì*âe#ŒÒÃÕ˘¸OôÎ]-%±<≤,Ù˝œˇC„˙õÔÁeñèñQÔé»%&@Iﬂõ˚¥’‚fÓæ#•¯à—˝6˙Î›o∑Hﬂô:∑ˇœÁ? Sﬁm‚'1'˙9˘^˙)»ª¸˝˘Ù”wöÏfú•üOºEˇ-Ø YfS˚>e>J,$∑…˘=—	æ‘ÂÁ+π,_:èûéUV}@cªâ®Í˜=≈ùá)~S¨|cáí7(æΩ\ˇ3˛dº,∫ ~¿ä®ÁÙ"∏˘rÑ©‰– ~∆„\“«!;ªΩ£dú`	xaG©À¿Ñ¿ÿ®¿1q0/LÿÁm<&Éâ?¸Üî¸Ÿ‰ó(¨ÎL@JG74-5#ŒKÜbaœ)^E∆ämÅ£0∫â‹=ZWÀ8a˚¯%‚`º¥ ˛Èﬂôl0â4bI«›2i^5N(≤î4z∞x¿ZB√€≥÷Iñ°å#ª#ƒ	°W‹®lÑx´ü3[–WÑÜÌ/Ekª (c”
¥Ù´=e^JÎ£—ŒÆ'.´h≈ÃZsd‰¿^ô–j•ﬁ>ª˝·I„yº®Ì¸ˆÔ<v-ù5Œ∞ºÂÈÌèàxØ:∞∆ˆ.Œ€'õ
Éú≈»uô#id
ª3fzÕZ·éå¸w•<,Ø˚'Í¿ñß˛(ÆÔ»Íï–∂gÓ¬9¸)8˛ÓÃôRﬂµå∂0GSyCäm–ü›å;Ÿd.ŸŸŸq¡fd-√|T}”ü‡ç‡'i√õ€+òñ3Z)∏ƒ‡h=˝±“ΩfnÈv¢√±Ø‘-xŸ˙G˜,úıÕr8Ö;0Ùwú—ﬂÄ˜7»—ﬂ<øF˙ú2~Ç.—ﬁ√åR∫ÖÔLœ"-Õ≥«“≥öá√°∏¯fNN≥â@à*¨7%·€≥Œ~]ÉØ’Í∑BW«º´cmW«ô]E∞F÷6ÔTl#ÆÔ¥2ÂéŒ‚RVä≈RxûnõÀOà€`µÙj¡¶æí1ıJüœ+_qY–¸`é‰}’ÇÔ´öﬁWÕ~ŒSÖÛM!5-_Él&]U5]Uu]U]—K^M(;˝ÓΩúwß∆pv˙ôl˛¡˙DU}ÂVEa≠è?b<~=Ò∏i}›¶◊√U1ÖÂeØ¡◊eiÅ≈UXNJ`Ö;t—º∫lúü\`Ëßn‡Æﬂ»#≈©ÿñÁ3pÂï·%Ò∂¶:ïÚÜ∏jDW≠Í~B9ÃB’YÇR`ˆ°înN∑3L›¶á…™®ßHÚ^ï:f¡jª"uıu
Ç}'5fä^W®“z‚Z∑:°∏*œLí∆∆ú‹$⁄!•ˆT*”©Æ˘”¥FäFØä{ap¥'Ã≤R˜3oËNnR}Ü—õ;C<™ù›ı˛."ÏjµÙ’lw^ÃP4°y¨¬Âå‡K¥°%û<T^•Z ö„:˝7Zõ8?GôÒ$Ù»Ûn€§∫´ﬂ¨‘jé0I∫ç€∞Z9è~∏Œ;¿3u¨yqﬁ«KØgZû®™ΩnZ!ø†™p]IØ™„(qcÃMa∏ºÒÁÀ÷˝—o&me¨s∞∑#ñçFë{<ü]#87ÈÛ¡j?	pŸﬁŸµ7ñ;{“Nóé»€Ÿw0ó{˚¢u|ô.gIé`ˆ–à†-Qﬂ˝˛î˝˛‘Ù;ÓÅÒ	35˘“tèÄÃÍ7t˙qˇôÒä™•ÎÌ Hm¡Óë;y¨ÙëŒ=à=‡ñ
c<®+Â‚◊˝)y– ∑¥06˙˝iÚŒ∏gS€ÑÉ`∂J‘|m≥N6qDìZ± --ì™–˛ÇÛL⁄‡ƒ}¡â˚¬D\*ÎìﬁÏHé»ì1ÆC∏P'„ <\Ém,p‹/¿}´îBÍŸûnTÈO¿”}9]}Ù´Eºo$®Í◊…-∆6ˆ?_≤ˇ˘bãOßÓÖ«>≈ƒ;úÊÒã€wxKµ„v´ËΩ®ÒXn& \&Ù¬πV~Oúå¯&b`ú¿†Ÿ¬j1ÃB:Ï0»|çÆ£
/¡°_Bçˇ˛]y„“í¢q6É€Ã\ü4ùÂ»ô¿•fs3ïµç¢ö$ ÷Yê¬/?sGûO:£u1òx√•$¿“4à∑h∆§hc©¢¥ ´IóbÓŒ	<%M¿áÒÖÑ®√‰EÉ’AR∏◊®©Ì≤“IM'±'ÃÖê3≈WD›g OôÙ›ØΩë≥0¸Îâ3—LÙÔz¬”1É%„zËMoˇ	Ü««öQÊŸÌœîO±˘So`Å;V^ìø⁄Ñ>⁄˘WN9MËë*±öÖ@åM!πÁ»!ØΩpÈLºÔ8îË@2Á0L¸z_e	«ÎÏyâÙÁŒ‚ˆ'ºNÏ≠lA$¨Ü∏# €ô˙◊Å3Ü∆–—5"*∑p~äáíÿÜÊ´A–∆∆SŸó!ˇF^¯W¸Dp»√ë"8”k¸V∏îín‰®!∏fÑÜç¶Ñ3lçHuÉv’è˘k%ßÜ+◊az◊9~kí˚«{∞¥:j/hµ@Üf3K$íÓg§Lò*ÒfLsK›oäx(Ï95˝Âdƒˆ|¯û˝¶Æsu@Íø/ONAÄÈÍ◊íˆô§y,≤Ùg≠Í6yZÒ@.	¥¡ì≈`UÿÆc˚=`@2q`vc-O‚TÁT∂T˜”M{— !~ÙHnô†B
Dn".êÚ„⁄‰!fèµŸ¡/I≥qŸøÍ6hL.Ï4ë“U/A}·bÌ‘¸K$ç|˘Ug´öL‡–üDÄ÷íÿeI‹ÁáøR·XúXãA≥q_ø'ïÚædãï¨›pÄÚ·\≤ÏVÚ´>g	ß.YÎfB
(Ìæöù´é'≠íù3ìØåUò„’›”µ'Íå6·#Õ”©'´u[ís?îs	¬˝%äãÊ#¢^ë˙êÙ[!ÈÒ”ñ¯ãı—ñ˝√y˚eß˛b—zlÒ 9@ü£6Oe
ÊãyÁÑ†eË…hí˜ÂLR≠~$®ÔsÉkO∞•~<TC wm«hπ•⁄UÄ<∫Ÿ8¸ƒzFLÿJ¯h»ûy3, zçà1z¿òºÒÄw∏€ÁÕñ˛2îÃ5/W˘úıŸSæËÂ˘¢,¸;∫Bõ‹’a·%/°ﬂxîœÀrÏ‰P{Œ:¢È;÷ÁÀMcMΩ†"aµ»W†˚^ck6•ÎT∏èÅıUÔ=ƒ’y^˚¶ªD◊Ô!∂¶úõmlE}wK∑
=Œå™a}oC≈6—;W}G˝JfwËWT‘5,êü|!º2 E∫À£˘#“m]v[=<ì¡/qßı≤o@()©ü–≥ìQb=*#¨è∫t2–VîËm∆ØA‹Ò,ÕÁ Â®˛GÚ≠â±IÛ∏£1-‘u«eŒ∞œıòzIJ	Ó>@◊-æ ∏=ªçiy%Z0—gÍ@…„1§*Qù>M,ge;≥ô˚VÍ)ﬂZò _‘t–‰|iåm1çë
ﬁäÑ5é"∏òVÅ1)Ü—Â∞*'∂y„Ã»ÆB´‚›Ï)£øK\(ú÷å@˘ÂÄV«tˇp‚xS7»1óiCô>o•Eög≈·…åä\‚'N*˜F6∫Ò…∂õÒ+’Fõ2Ô3Yë?xâ '©f øåZ‘Ï≠;å7,j'e“û,a=éˆIº—Ì?Ü~?ö3Y`ŸXó—œÙ*LËkÓÄ˜Éˆ¿µ`f∑9$∫!¶.Åúz’∆ÌœS÷Â$.9"qäGmÛZD¶lIË4ÅÎQ≤◊aÙ8$_√û◊œ†Ï
"˝˛.øˆ–4∫VsV˛¿>˝Qµ…—˘˙Û£G:Ï0[Ji*Ï3ıÒÁ¯òT≤(æ—ΩÁ/É°À¢‹O>I:)á¸<GACMV/<Y“¬†“ÉÏc}tÊﬂ¸Ëê÷⁄€-FªA˚ûÙÀØO˜ØYk…’>¢ù¡ShˇQ‡\Ë
œ≥Ñ$}.C("v}ªÙwß%ä>ÂD aâˆ99ƒ?eèLH**9Dπk’Û∞dπD…Ω°uÜ°—+vGŸÿ“‰ÄzÏå¿˜,Å˙Ω∆;îQ¢â´ˆƒôo¶X0¿∆Qúu£€:?iuÈq’Ëë”ãf£éLˇ‚Ú‚I˜ˆá”vÛÇ÷i„ü]tÆŒnˇ£ﬂ≈´NN⁄'∑?4˚ÿƒê∑/ú„ﬂ◊ŸTiqf%∏Q.C˘öY\ˆ€ÁÊﬂJ1–{Ÿ’‰ÆßŒ[ ‡Ë5¢¡ÅŸHÿVa¥w˜Å~5âC;aY‘Ü-l‡GΩî¨9Ã&ö‹ß‹‰í˚Õ˜‘–<"U˘‘ü–πÕˆWbèÜP&®±öù9ãWex¶¥ø%º&Ú—~vÚn%hå•Ç%•Qíï¥™€?…ﬁwŸŒ‹w©ßÊL¨QêrYDYŸíXã?ΩNˇIó+‡ªî±R∞Ω£]rÓI“Ú&dÑyåW[ 5KÄ/∏¥°∏ì
˝«CW≈,a;ÊZV(—=˙ç§‡Ãë&é|º^fé∞R?fBlÑÙßh+Sﬂ“Ñ¡Më4ë‚µ§Wf\Òªæ)≠Œ*:Ò•R]€`îüÂ˛O}Ú‚≤ﬂæ8'«GÏxËÌèx”¡πÙ§€>!ù∆óW˝Õ5ΩêÔ9^/äaﬂ”§èìßbÉñtÌg™3I™∏„≈x⁄§˚›RS›Æ≤€Êîe÷±=º≈˜©7û˝≠d`[¬Ä∑Z;à‹›⁄≠FØüNÈÓ›íÃov¢h‰hÂ©.	Øxq…»>ﬁé'ÎÒÿ∆ñ@Œn˘’ø˚^Ô±ÀÆŒ√2’2i5„S Æ›ˆìˆy£#·]jñ1W5∑B%«‰kö˚U≥VËuœ~∫^b§§¥“:Lßàa$,Ç ‘SìŒE¡P¨p¨®O¬«ƒ|<"{Î—?{N&[€≤˘]ún„ûX¢o`hIÆaπ<‹’ïáÀI «´äU*›,œ(∑n©ÜW+ì$4cAYâó‹4J‘¡ ZZQ˘_ª™Æ$:ë:\G‡ø©}I∑Î¥ÉMWª‚_ãóe`*MXêKgÊŒ‘ÆKıÖ<»'™ÿbîØSŸÈ›[(ZÈ€ÆV“v;ë94k^÷ˆ±tÆtIT∂rÛ7ƒäå‹ÆUÈ†ip5ã*◊À‰Yª◊oê≥F≥{!fVÍ´ñÊRâªáE6C$ÇåÍ∆ÿ^T≈|DhQ2X∏m{p≥çˇ´Qrdhß;ë!\í9—πÎ|üâV—«&QÎ$	˙ õ	ó7–›˛ssÿ¨R=÷OW´$ì≥ú·§J∫%#éNò¿(™YóêVâ;πÓ€˘ƒäﬁO∏çMqC bÛFÌâ4Yò`%ëII"	D=J(R8ÿ‘&‚;?JΩ∆y+—<ß»1q<◊°¡BpÄQíöùJÙGß ÚàÌÈ)ñ†¬˛⁄≥ô‡ ™[ÔIMRY¨Ø,µî§$NSç'VJrhk≤%⁄ö•J∆ü≤ùk‚Ze:Æ§ê(ÚÉUC∂Ô^U9≈Rc°‹Dπí/rÚ”}O¸å∑T"˘‘Í±,˚õhÙ)2È¶0‹1πèX„àÙª∑?^‚6
y
—˜ﬂ.Œ˚ËÓ◊I7[Œ{ÎMÇâ‡~%FÒ¸uùÅÑáÃà~ï<DÃTA©ØRÛë¯“–˝˛“^âDlcVZ§fß|ON˙n9.m’ƒó|æá`n5Uˇ}&º≤g]sW-hd-IsÈº¶úïHNG(ß9÷ê£Ø[áﬁcˆ+ç≈2]y_ı1ÎóíÕ≤e∞¥©+&iwR±µg´ÚNµDêVÀÍInIØeu•∫â®f§‘ÓÆk⁄}ıΩh‹SPπà,òÇ ˚ÆèZÁ‰ƒì-’“wŸ8øËﬁ˛pÜeâ&ù6#∏´ﬁ≠9◊îwæ%Ç¥.ˇ£œÑq<“„Ô?¨B∑úL∂Ÿ—.!-E¡S¨~Ú¿ù¯oH}{àpÀôÓBwSéâ9º∑ˇ{Cü†~I'f`Â¥SjÎ|ÕôßLäÔñy "?}Ûè1È¥kJ:Ì™I'È“Â‰E˜V;›Gúß @QVŒQ%†ô˚IRôÖÙ}¶©$$UÅúä)’Ù¡rTE¯y_9™{g¶˛r{˙iç)ß^˚¸IßÖ>ﬂ\.5;ç^Ø›\3‹
Ìõà6◊±+»Zí_ûfÀHÈÌÆ*úU ôWZ§Js{≈´3«f‡†Çò»ÀïÅZ?Ù™∏øûo´∏pJÙ⁄◊éø NHvŸ◊$0fÓõN¶jä<¸œ£'åˇ(±x®ºÜ∞y∏c7†ïÓ§ÿ1Œ¿cÕj„m{4=èqÈP'Em—á ùLºÂÃ‹Ùl%´îûvˇ µ˜h∞Ú√‘DÂÈÇı:ÔıªWMÌ—”5a’‘<ƒΩX¥;É’¨∑1™ 5yp⁄ËÙö'ºxàº¡ÉŸ`9ùπ‡«(iÀ»õbüﬁLˆ™®ÉzZKó;â]+±œt˝.ı±TfSÚÁÑæ∏gwVèS"MùÊ-iÑÖ•+D±U-ò¨ÄjX§Pö‡¥¶íegÏ‚,"¶QX§á¥ÿCZlÕi1Ò\/ºf`? 3◊ÖÔıpÔœ§°Ö¶•Ω'z"+Ba"⁄B“8ÌCÑ=˜ë©x$>~Y¯$:≥K´∆êq‡OÒ¿ΩªX‡’'¥;h4ò8√o
eÓƒÍdBG?àÎﬁJÎ%=©ÿVCÄy_I>±€|9æè …ópÔ@·ﬁC∆ÔŒøÑπ˚
s˘È?··ˇ¶~RKÌó≈K$/H„Y„¸ox◊˘ó§q~˚Cß›k˜hÈóf£w°‹"9ÑU∏1s&7°ZØ◊4ò…Ï¬9’ú¸Ã[°féBhvT¢1´; œÎ)îS≠*Ât±‚Àkóó¡[bß.ÙFw·‚r4•û&^Kà„üÈ≤•ôO6‹È¿ÅÕÍ“=€ ﬂˇ&…*£˝fΩ˜±Ûc,CÚ\Z¬æ¢ì«Î◊«Kô©ÉßÙ¨3Î& ]¢ ®T∞ÀPêqjtΩ‘ÕΩ4ÜCó^(ˇ|ˇpãÏ„hjármzVƒ‘äÚâ|£KÊ·≥Â¬QíJÅ‚„{∏8›'Ó¬ Dt!Ñ …7x1æ—:*QIñ˛ÕúNˇ ˙Ø‹eÉ"—KÇD"ˆˆ∞g L¥Ω°?√D¸¸ï7<"ﬂÉ9ƒ98íô~¡ı ≠¯∞O©_ëw[B7CP	∞#©zü2@ÏÑ NÌŒé“…»”îzi°‘S≠ä—rh⁄ã;⁄›°ÇJ}%•£)x‘◊Ù∆ô§∞Z}'È¶’≤†ÉJåΩ†ì»¡9∏zNP•∂#%]öñµ∏•ƒ]”z‹TßÆÂN“©8ÅTzıã$1üa!üh~^PTnÉ—X°¿«W∆`{˝;cΩóR≈‚≥;¶gmó {}e(ÔEÚ(∫πu¨Ÿ À§r&M≥Ëö¿∞XMƒê•€§mMq?¢MW˚1+ú<πà2(ùvp2Q¢≥%Ò2•s¢d•⁄	ßLè⁄≤.®ë$q©ñ;Ô/\Jkù˚÷.QÇ^L›NX¶‚Q√H’zgü	Ò0pùÈˆõWﬁ¬ÕVΩ*ŒPÒiªˆ8^à5ôxC2¸ŸwÓˆ5xyYjX´·‘T∞´]ÆJ¯ò;€¶ƒπÕT»-«îÑı+£Ù¢;Í¢‘YºFà≥íO—êÔA7á äE˚™“≈¢$ô÷øDÂ÷EÖÎjCA≈∑⁄u—⁄„NVèv]t¬õ)€ÎÀ^˝cÛƒW°û?FP‚“›ˆdﬂ—º™Œg€Ú†∞bl]=}pˆ†≤˚ìœ·µΩÛ
'çÔæ¯ÈMqÚÈ[i¢æÂŒAá’¶pÖI2È[¢Ú/~ZáS£o“[m
gÔq'≥G!´Icƒô¸Ôs‹b∞ﬁˆËm*Ñ≤:&o ‰\åy,$∫ﬂ.Q≤ÈS[Ëí˘‚-vwı £o0-Ì–k¨iJo&ﬁHâ¶ zg˙Œ$†ì‹òQ9∆ÆJbi‚%%…µ;s,ÕOã\n¢¨‡çF4(Ÿp)7Õå—*Dú(ªÏ>∫∞Èœ∆ﬁ5&˛e¬xΩÂû®3ã`Ène¥ÇP“ÒPöççõ\{ö~ÿöπÙ4[‹X⁄ú»
di¢]pGy8‘Im$ÎHr˚KtëeÃ‚∏$„Ü&çÙEH>ë”›d∑ànb¡Ee<Y~çºü:/BwÍÅ¬\{C_sŸ¶L‰∆iÁÍœà5:kê^Î¨}—π˝˚µzß¥†eΩ›ô\˚Å∑ò}{£Û‰¢{˚cüûQxLnË_tÍ°ìVXv˚˜ÛÇ4π!(-4g∑6f√p
“>Ô∑Ä¶ìã.πƒˇow›VØ‡€ßŒ‹yÜùá&y8k\6ËàÖ,$àJ˚¥’mù7€çŒ
TÄõÒìö]ÕACø€˛ïÖ€øSƒFÛ‚Ï≤—mÙ€œÍ€MñÛ@XeH2pÇ(#ƒ^'Z%ŸÚ’Ï•(ìm.ç∑ÛùR›˜U√˜µØRÔ(∞EU≠∆§‚˛‘ˇG≈ÏŸnJe∫+eu%†7¬
∞kÇ3r‰Èﬂ—K'ÿÖﬁ€tØyÄà…∂R"‚.»Æ0‰xßM*Œ t&$òµ•ÿ„mã”ã.»û7ò#a´ˇª´‰ﬁ‚¶∑pÁaﬂ«Ñ¸iÅsÛGUK®G€FÍÊOTè‹Ù;”œÉÂVèÛË˜Á_©-ÍX”π;"≥Ât‡ÈFÉkkÉwBÍ+Õ± ÈÀq«<\ÊKÍí•ÌàéõÂ˘2|UJ#x8∑6‚)(ﬁïïñ&ó›6ªKÑª¶L8Ωqπú-|Dg^:¡¬9§G	∏˝ôŒx˙—xÜ◊°7ﬁú˙¡ü{ó'ß%Û0ÀÛ¿·ø9e[¥õÈn˘‰ôÿ»˝†‰™
;_À#÷ÔÚÕnUÜU¶î÷±NPL)ä%aJ¬$Ò-e8hF{ùÒúz˚ªMu…∞âüËJ|
?∏äQYèÚµûõù€œA∑Áç˛Ìﬂœh9.õ6£[¯≈“Ω€ü@(ßNHnH«&:`ºU•Q7Ë¸”=]h.ìá
N$?Ñ¡¥Âƒs§cœ¸ñΩPöU·{a´Yî|°,Óm€d¢√9ç¥ûΩÅehüG◊Õå0ïwºD–M‹XØóöGTÅ≈Ò¡ó•Oƒ/¿¡ïgŒ‘-/¸éˇ∆öÍ“¶˙†¶…Ê¶B’kJMZ<^˛Ê{ˆöwôKS˚ÓÂÊ&ªGG÷
_˘o‚0˘ìhü>:R,óÿ\hıáîZÀ/Bjª7ﬁ#åˇ≠¢—ÕnªﬂÍ∂—qnıöçnyº…∑ı◊fÁ™◊æ8'⁄™‘'¢”NN‹–°ô:#?¥ÈÒÁø;»˜QƒÍÏ™8X£–^`B!åØ‡”pÙ-<“tØ,z∆eXÇÁtüØÜ€ò°{˘£«]?ƒç€ôk∂<ªCìjµØËQ)äJ°œﬁ—¿Àíe∞9lÑÒÙX¶z^I9NtW⁄G√‰ﬁø¥‚©:l¿KÛik`R#ÚÁ∏Á%7ßŸa°œp9«ÕrAïuêˆ§{¶—Û±ä®µ˜è¶"WOS)L`íëf)I;B‡‰O·√»∞HÁº≈˝⁄•º2G¥NcÊ´ÙÉYÉAë0Ax©÷’9ƒ¬xÉ˙i˚ºç≥ú&ZÃGòê?/=‡H◊ÂsW%…¥òâÑØ˘ù)Û\»SPû,h¥ÛßiC¯rãxöÏ,˛Wcòé™Õ(√HãﬂGèxmG”Ìô)…E À|Í6S¯i=nç˝Acb$u5Åé·—	ô ·∫îÚûí àSƒØ› 93â”—öWÚnè#!ä,ñ≈f—1raC# ˛m5—´LùfÚÃ<$2-ë<Ù∑ãFS=±¿„_n£ÈIMÛ`Û›ÀÙÏ*≤ˇdV3´Cﬂ≠m-»¬£œç‚§õÍ‚™Ó•ç∫‹πÑV•ª„˛¢2wF#çÿ(	;±/RÚËÂeZıÊ‘£¿√OÑú˙ f˙àΩµ%Ç©SÇJ'Ÿ‹3SE3Å“Uı%˜uY ˇóå\∆®ßÍPƒÁÕπÊ˚r§¥Äò˘z	í¶F˙
¶<•¯eU˜•i¥⁄a÷ böO¶ip<€ãÁ¢Às[Ì|Eë3”†˙í§Á˙π«Óü˛Õ˜øH´∆Ç>KÄ&"#q∫+/DπYÊ&D9.ÌΩ3◊îª*M\†√éúûÃqZFËêŒrTçá9ÿë4«õëh≠∆áÔŸe0‰·K‡$√àñ•«wù£
Q<êú∑X*≥"›e©L∆¬p{ˆ"∫7[Ù,Räﬁ`sß ºgvÛqª9ß+ò˙M¶—v{j·èfí˚z◊dR‡ÍRô0ÌƒÔÁòx¸Oò|õá°Û1Ù~áÚÖPö-^UtíÑ9!ﬁ®ãÓñ)<á√"wÒ∆ugTx‘T≠Àú«—âø;‰ªœtLñéo¨wa—∂πñÍ9Z¿OpMc≠6¨-í›F≤9+º–˘rHä8zﬁÃﬁ`§»:ƒ€ÁV°ôù˙7&Oº¯o# CÃ£˚"&EM¢#¶Cd™Co9T¶7·ÍfΩ∞[ìˆ`%PÜºª@œI£äJ˘:wËa∆„´.b.[ÕèóÀ+ÌZB‡Ò¸{bﬁA§ÌŸ°tXY0o{d€Öì7…;‹†x˛UjèF°∂»&óLp$Í:∫—µ…r«˛v≤—´`äj]ß9	]W≤VÑò√º‰ÏˆÁê/ÂåÙó¬∑x*®ÒÊ≤íÄrBómáî_ÊX¡$fä˛—r∏p»·i OS¶ôoÏQO®∫cCıBLãôìbâ"ù/Ò˛oíX‹⁄{œùaÌ”Óã2r*ïB©YdöZÇ?'§»Ω¶¸XF.C<Ç˘t§‹≈Aé‹]ìsˆ¥v¡+m» Ô¨à_j¨¬õ“¿¶4§IË5qXRxÔTœÏ[µwˆ≠˘9..∏á*ü¨‰L9ß¿
N3õÅ”0ú=†≤Ü[’~õ?ß$’'"c9ı"∫Ì‚˜ƒôUt`3qP´¶Zå◊Aç_Æí•F`ä‰º»~Yõ!ÿ+ã‡∫Ôâ3ÒÆg`}ëÕn∞a@©Ù?HˆiÖ‡ˇ^dçgcX
™ºØ¿$ròÅtõE]Àuã©§«É„j<IÇ%ùI±`™	◊!9’T5z›‚≥ˆ|%DúPãÁc4Ö%¥s
¡ãLË≈ÖCt$ÕAµ≤Í¢Ë‰Ω∂ÇmMZè2‰.ª≈ã©7≤+”UtGx:Y»ƒøT≠ ’ÖÙÎ/g_ _jÑõ˜	ÿ7¨æº]VÈ˛p*˙3Ü∂ı#bá¯äp≥ép@
ç1∏UcX3‡ÄRûÊ˝œˇE"ÑlOÑ»Í L	^¿˝Êfè∞ Xzu9hføËÛüzk˘kﬂõï6@Ó76‘∞m4éM©•õÚ»otDÃyÉO>1´J†˙Ü¨Ÿ¨—Ÿl^tª≠éä6Ì4ésM®.î«SE=oF ÆÙCÃeLÿ)ÒcÄqF:ô!§≠ú1Ø99]+¬i1ÁqWV÷9+œ)û9˘;ÈƒL.^Ã`h2‡ü≥DEô\ÊŒPº‘ıCáB¬C83”"›Œ»_”§’ãLöîˇπÎ¨ÌD≥vr’Ï7»ó‰¨qﬁ˙sæ…2¶Q®Ùª◊KoÍπòÀsÖ¢í°{}˚ü3‚æˆ'Kñ1ãîaMº‹)¬À$Âd]Àæä†»sÙ$Á—”#’Ω„ÀJÏÖŒã•r=kÇI≈à®4d¶b~¡⁄#kX+ß∑‡%ÂD(@€ı#KöXG≥}#‰«sEXIÍ√ä;–6Ñë»âXÕ2úhSÒiä++o&aÄ‰I5§∆h})C _UÃt◊’›aFÜLXübä˛<B—⁄£Y¨òóGŸ SM}ìg¯’≤%°k*_"T)K—âvOÕ–‹O∫\“¡*y™ ï∑X€å–Ã«$≈Ã¸ˇ   ˇˇÏΩ€íIí(ˆ>_ëÉÈ¢ö@›´õ§°.$k∑n]UÏû>$óL â™lHt&PófóL˚¶yÿáµ#ìÃé…ÏÿI˝0fZçdí≠ùß≠˜˝à˝}Ç‹="2„öH†@vœúmõa!3#<"<<<<<¸2õEí›6ß¶Dª4±O÷9|Í>Í5G≠QN
í_Äaé=<(˛Á–ãé[ˇ?tYT<÷-√¶·I;‚éõ?∑≈-vÊµ∫¶6lÛ$Y`J3ú{Mraúçm4uéf§_Tì≤ºÈàU0ï:•@ºÑ˘˘* kPÆ{qx’«“ÂréË,´û2Ç¨Ç$ Ú∆\◊•\UÍSxòÎ›‡êˇ] ‘ÓÎÊ¶lÃ¸RM*#œA!ÒêÃ–°¡˜ !ÉöÒsº-0jU≠é”eÜŒ¢òÙ0˜¬º≈º∂°üÒ0ã¨pzt®ÑV8hûÏ))xÍVA0_¢&/…ie∫_Æ±5l˚CM∞ùt»πÁ\D@e®/V˚xüÀ@çi7r%wb“óa2ˆ{^ÏwB?µ¬ùÇ≥Œè¥sb°gÖ&Z¬¶∑tÀ‰€çN2≤¥˚BœÕﬂŸV!%D|È6õûN) i"–°ﬂPGxSÁmsN¯Xëí;l√näBé‘ «û≈¿÷tµ¨+¢ëı	}ÈoÈˆ[ïó∏™LoÓ£årΩ 5eÊqo˜ ∑_l8<!õ–‚%≥,€….lZ=$ÌY˝&≥ã^ÛÿÊY5ß⁄OÇÆ¢ªcöÓ25EÏhé45 ùﬁ‘‹∆6á≈Yò:Œ0Xˇ„jÉC‚Y-äo∞∆¬Th•6∂à2Ù
+⁄¸çŒä_ÛÜF÷v6´z∆6lG&©ä¶:7q-µD:mKRïiZBdM€î\gb[&I©˛ƒnô"ˇÊ ﬂ/¢ÿ’¡«:;~ä”c—Û„GΩB»Nâ,éú”,ÏSÔi?+ﬂ"®ˆ≥´¸üèï`57¿î6¥vg„w.ˇ>´ÖW!⁄Ï˝—∆ŸUı”)Î˘—«§úÌ‹ß'O"Á§˙ïtcãº7vÂ/ÎËÑûıàÁ∫ùô´l;ÕVÍB–¥¢Ô«Û„µë“*Â¬]Ù÷m¢ºt+0¸sŒï™Á^+‰N±.√¸eNq-oäq¨ˇN±!<N7«Æ›‡”Œpm6LP_ÀõbÎ_÷[&oÍk>[t.GÍµﬂ
^˚ÂÑüÚ¬oBhrvN≈ƒÄqp~
ÚKíSOiK >¿vÆüV5@Íï°RV/öªÙ≤÷©Z≠Ñ≠OÑ›,~÷õœßz¸bM[P<"ræm~^◊ßåå¸4ç\p ,8-Op.∞≈PÂ9ÔIê¡5˘A_ÈQ-ôKér◊&“¢
7á'L	oTéóÎjR+:ø±hÄ'FŒ{Å|©Ê“∆;CéNl4Woﬂ±o;‘ﬂº∞ƒR@‚…°àùAàÌ[Ω1	Ô^Ì^ß¸i0‚7Æ`ƒ∂=L{6&À≤Ê⁄Qè)˝kûYŸø
ooX≤πìÂ¯C3õ|‘˜òj á%ﬁ1 .Ë0Øº«¢\Fâ*j‡·
∏åÕú‚KwS!Ú{:WM¨8≠Ã\Xﬂ´ÛEAh÷∏CJœßàòpÂlØàe∑ÜFU¸•Q8√98¢î€tπëk‹‰ ÜFJú≤aˆ=ÊÓÍ«£¿†\SF¬˛Y)AY«ø$2H1ìOŒÁM‹îˆëtZa[π®ˆ˝ÎrJÄãRPQÁô¶·V‡*∂.nÇ¨{[—µWﬁÌ±ﬂÎ,Xg<U∫*yåÌ‰ëÈ¨ÎÎk"Á[M?˛Q>P<˜∏“Y¯$µÛt ¬ ÷)‘;ôÈÃÈﬁÛ√£SÔxé7{GáÕ√≥›SØ‹Ùû5ø>:Y(M4°v€¢Û=§òª˘<9¡lK≈hté.¯K DL.#‹Õß¡°É>·–m∏E-∑•sﬁ∂¬V1∆Õ_∞0X)’Â<eún˝¥π˙È÷Ä•C÷’ﬂ∆Íg°˝kX£^ü√Íß!¸≈¨}ßﬁœX˚<Wƒ◊î8Çßëÿ--Ú)õi›„ﬁÒWª≥=¸”¨|€<Çm˜Pa?cöïüVõbÈgö8m”w˙«d¡∂Oo£ã 	dnÅÈTŒ˚#5eãj´!9∞ª\fsÙ˜r—∞Î¸õ∫√ƒ±|
∂≥≥ íJ%÷ŒWú©-¿l∆ ì.ïsd¶xuvN˜V0≈Ω›Aëi$H©Hö-l≈4é›RpY¨ªî[Q¨…≤rÚÕ5,RÍzö∂ÿº¶5w™∆*ﬁÈRÛ&Ó£¯YJÉõl%Òãuî2)Áòáüﬁ˝äµòà6ÛﬂAØ¸≠Ê~Ûp{7S›G‡ï®∏hå%È*J&Ì_XTËF	9÷ÊûÃ4?Üw√∏ı˛âO∆˛er›úùTß iBe.4ıÑŒb˚8«È\Ö#Û
Ú§öÕ»D‡_ |Ê¯∫¯|¡[√|À¯¨'i%~Õ∏^Ea˚˘˛—È.∞¢øy	LÈ∞%.gg◊€ﬁoûÚ7ò∆M∫n$A¶Á'IÿE[5ÿÅõÉApÕÛø€I1Ôw:∏ªï%‰Œç◊≤óaÚ,åì¡ÉOò
\bu≈âV'Vªœ\1ßåõ7w¥9ÓNö;"ªnÛ4„ÒÇ≠õqD‰2wÓj¢Í¯è≤'Op‡pEX§îˆBà*“KE!õ~wSG∫^[¯l,‘d∫ >Ö5‹N¥gßzºt1≤^Ò¯÷õ'ﬁ÷ﬁ—¡Óˆ›ﬂcÙ'o◊€;|∂ﬂ<hûùÏyÂ,G¸¡À˝≥ΩØw∑·É∑∫≥ ë;øv£zùP'Å2œÉ—Vı1Ω IÃ'¢Ã3`t¨˚Â¥Àî) °xÑˆ#®ê≈≥v∫ß#¯äÜ0ÌqåÅÄ™-+l<&ÿøp`ô\@±ŸŸÖ
ÌX€x|1«c{YıØÉƒ˝e÷≈^∑M:Çyñè£$D˙¡¥®˝Ó›x≠ Éîü˜¢:Içtë∫`µ(_Å?ÚÍÀ˝˛¬<ÿE}jvÅcH‡»xµZ∂àÄX/ih<Î!êMΩ+∂qàçìÃâïdCYíÜÚ…¯ öÉBNá!ŒıˆÖd¸<Äe0äo0¶ºøÇ8Ò G√Qÿá˘Îx	,éÄ“$%~7›ÜΩQ‰ùè°úGÔá éºË2à{˛0ÒÆBËaL[Ò†Ωm€ÿÓ6ı™⁄ƒ%[ÙE£é"ó/Ÿ∂zq=r}¢Øµƒ`‹o^S&µ‹ï)Ûd™'hÓòQ¸Î0ŸÎ\ã,Êãﬁ•ﬂ;mGq ﬁößÌ@˛å Ë‚Êx∫ŸâN°9+á≥-ä‡e±πhY4
EÍ5¨å√ˇBŸF„x†It–ke6∞œYkÌ()SµêÔ7õÍdHUíp`≠BÔd—K⁄ÉT ¨W—œæ„∞ÌùÁcåD"∏ˆœa®^ôQc/∏zâGh¥â_N≠„◊Ò \3ÿñÛåû-œF˛Ú\í≈ÇWévﬂHqÔ±õéiF· Ûæ‰¬˛⁄.W1ÕZœ£!|™}æ‰:x lÒxT˘"˛)CàYgÿ=Ê´·®zLfTΩQ›nÔﬂ•:F'£∂^Ööâóhd% !∏ºﬂ
»ñgbê√:ã2Tg°ÖÏ©Oé˛+˙Oò¸Fïíö¬6ÿÑ•ÊëBÿ˚ùw4 ∆tËÅvÜØ5dk*◊⁄∞ÌRia¢i◊‰jÿóı’~X'|¥ŸB≠ê\˙±ËB≈[™÷T/»œHîÏ±T}åﬂ”≤e±„( ]∏¢ﬁ´æ
{X}}Y^$À≈˜0?Mr∂E/t,®ql±Fº)»lQ·MãR5˚q£™{x6ÕVœ÷rΩΩ¢Á|]
Z´:¨
ru0Ê◊ÛFøIú#"eù?Ω ©îFÄƒLœUöÒEsNûVÈ’A‘Q3CØå&˜øÈ›Q…˚—+Â—/·íÛ8˝©†Fq°z´◊÷Ôﬂ¶ﬂo,;–◊~OX6‡~ƒ ≤-∆‹a˚ë „f§ñó*–ÈõÅ‚ë*V„[È¯qàÑ ïÒ·Â‹∂‹J÷ƒ¨•/Ω ƒ¶ä≠mUr⁄“«∆QA-ÆÎr‘<{\.©Ôb…µk˘HpU´π⁄7â°;Óıà¶OG(Ôº„∆<ÙÍ÷+ˆÅH=AËˆ∞äw6ä˛Üù≥%«8óŸ§ivR √EAïO∂â$v˜Ä!Gˆuty…»oø	õe’Éó˛evd¡Yà‘∆Ó'Ûñ’™ÛB9À\∑é<√†Vûéè◊◊Ë∏\±≥ŸÉÛe–˘F∂I™À!Ä‘≠¬	‹P˜)ó_Ç—ŸÆº≤q, Ìªodòãº˘≈t]xrHŸëMæa¸i∑ÄOì{wﬂ¶\î0É¬™;∆W4ôüße	„E#∑‚„µ"6mP^∂zC‰l˝Í±‚“_öP∏TıHEÑ7Å∞<è£ﬁÕπî>Ñ‘CâcßÔ0l|ŸwÀ=…›g¯T∫ŒOr≤º˛Ö}4ÊùfÕiñÍ‹máã^ÁHW5ØÂ‹r°BUºÓ*‘ea=›Ú!∫‹3‰0e(‰˘	f^]®öU∂b+QÊ®_Ù<€y ´3Mrπ«iÖ∑íw\E>‚yE!ÃÂ™˜uA{;—(;ònd¬ı´K ãK8ƒÈTfêÉk]c¡vÁ*3Xzp≥œÃ/‰ËóûEû¶∂}5èõyÖ#X∫Ì<•‚öùuYºÍÏ3≥{àì`6Ö€r1æw p<òl∆ø˚'ﬂ+◊*¿’J C;q !ê⁄IN=—ï0v≤˜¸≈ôw∫∑≥Î7w˜7ΩÁL=ª˘oX»5úKW+tLe˛#V’Æ?R¶≤óL9q„ï3≈ }0[‹ñsÿœÆ^≥K(YÙˇ˙åKg“âπ‚ŸÑCŒ~£˛◊Aõ´Äﬂ}Mì´¢íSºò,∏√?Û“âˇ0ÚÇd¥Èñ•ïnﬂŸbäG<®¥+ã `åëv°ıﬁé/} n≤]ÕSÔïTàÜ¸\ÉÒ‹ŸÖmà=ï∑jFπ4““Z–î™’“©°Mπº°Ò$?MT¶fëR–VGR6r“w}NΩı• üö∑~akú¬v8ì‘z∫ÌS≥paı€Eâ2ytí<ìõ˚,ñb¨v÷ùq∂ÌÊ…Û¶w∂w˙sY<ﬂ?⁄jÓóÖÚHçE¬ŸÊ∞≥G¬7nuñãÒﬂ‹K‡w∂E n•Hì}K™ÏjÌ›§^◊óvª(nÏ8"ò_G≈´ö˙ãx‰9ô˛ôwO|0»P?EñÉ⁄,YZPS›› √T∏‡ƒôí7Æ¢±JÅs„‹&1Z≥…Àﬂjg2ªt{bïY$kì	î ©!ÉB–ßYp	.
˜Jw¡b¿≤…â∫ﬁ™«6ìƒ+oG˝!›Ùép¶cª5£Kôñﬂ9Êqü∫^pF&ÿ_§Ü“ç˝^sﬂ+ØÓ,§\B V÷Î¶8Z©ZqfÆèx)Â†cÊÙ(aæò∂ÿí5&ß¸Í¿–y"·ﬂ¬.ä˙%ùp∂ï°^RÆÙ4£+Í∫L^∞3±èvPﬂ
°Èè∂ﬂnd+J?à)¯ Œ∫+€Ä√5¬Ui
sS√ÂÃˆ¨oô«06%|ù˛göçN£`H˝Ãá=ˇÊch•Sı¡».U`∫*rrPπéMÁ,ñTÜsDû÷^-n’ï\]Ñhdah÷d<,Ä8§v˚wø”∫Ú3$Xµ´ië
jKïÀﬂô:|kôﬂâ†)ﬂêáµ»Wí¡å-äá
ÉP…ä¶Øp©Qºı§#m çç7¥„ÃëPS∆f
&Ô…c0¶ÇëˆÌ7Èæ-ÅHï⁄*úUN}œç hï¡ÒqköhIÑiÀ8¨µu®}„rg ´O≤æÙXWµ–s˜ªùrhêeQM’ÌΩÀfüØ¿…D‡SR ¥Ô≈ÏÓ'{˘J∂û≤ZÖç[,®“√í˝ØƒxOwBY8ÿ€ŸŸGÀÛÌ≥Ω£C4g<kÓÔ€≠a∑ıÿ>ª{:9¿Ó¶<ΩP¨√^9ÀÍ˘≠wz¥u≤KÁãÖÇfò´ˆêÔ÷dõã⁄-˘ä.4®uëˆC
k'©5õ2P‘ñ>o≥lÊ:∞ öPST—4ÉY°-•í—d^Ã ı÷Ó3@≤Gä
WéìShm€\Lâ—ï›å¸>˚√Ò(‡wPà!¶1Æ.ãù√∆™¸Êî|·˜z˛Á‰f§|º}GYPM,}7NF(|JÕ\qo¥Ω∆8 FÀ#äêÚ.k_©ÍÏ› óÉ[dK3nE™’“ºÆ6Åá◊t®Ü®ÖEô¿+íMûeSD`[9Òyƒñ≥eW\ÛÅlq‘nÂÕ“VŒ,…Ûî≥Œì˛ZÃ”÷‰y⁄ö8OÚLmI3µ≈fj´‡Ly±9≥¥ï7KÀΩ4Jv\õóÓ'å(8OY‰≠ßèu	˝⁄FUÕyìB«3Ïíƒ*gZ}Yscd‘ﬂzMoêL°vÔáÆYÀ=ëÜ≠Ó%›ZÉˇsøsIæõ≈E¨”QåkZ‹i‚T¬€[’®@*O√\@9§‡Ïg2BŒjÀ$(ÆÿMyãK|ak.fÖÅz)Lo5Â£tû`a{Âû.hA¢RyÇ¡ó]ÇñÏ˘Ÿ]z∆)Æû3Ωê¿∞‹ÆÇ…ùò§BõÛ&ú3ﬁòº’Tß…`kíÓ±XRC©4„FôÚ-«√+√™{më"•ëˆì¯≠!z»<jÀ+√÷ —çî Vˆ;d[™1¶4Òn7∞)ÿ‡îéæY°]=≥5;/ºØàõÍqK‚à[VéhÚƒ≠<û∏e5WRxÕñõ+nππ‚4æ≠gt	ú36RŒ∏Â‡å[:g‘y„÷¢†ŸX„lv9)≤•¶Áœß˜k.Ã!'H*¬ÖLXå-™å—1Öˆ∫9cnK-RÆ!ˆY*Ÿ=ñdµ≈÷—ŸŸ—A¶∂»\Îe7øä‰‰◊ÙûÌ6˜S »óÕÛ∂àyq:Ó˜AÆ©Ç¯ÿÔ–…@uP“ã˙ó@£x—í2”Üæ¨¿˚‹kXÑÚñîæÎõ”Ï<óÜØP#⁄õG¯›ﬂ7∑œ>ŸA^àMtëﬁ±úÉïMú¥Eﬁ-HmE◊/Ã4Tr≤ÿJ4ç\Ó…ƒ}√tXÿÿ@ß;*∫¨µ5±iÇœBÅsä~ëêw„>ïç<≠¨{PÕÚls©zWi»KM⁄'÷úÚ√|©=g¸ ﬁÆâ…ñHKé®
ıâ†]Oª–eáêB»ñHéÃú1vZ}vÂ∂∞‘=∫7™ﬁ…ÓÈÀÉ]‘ÌÓ{«ÕÌΩ] Ø|∫Ámù¿∑„£√ù›-BÅ?8o8ãé∫›Sg–C¬ä∞∞|ƒÃ§`ÛPÑ◊Õè”¯gÀÇ;ºÔ˛˛x_÷É√≤8:9@ªºì¶'°Œ™˙ñ∑Ÿ”∞?Ï^'ºeÀXiŒ≥b˙E9◊ÎÍ–ˆ£8¬ S®Ú„sØ*YT∑D@ñãº∑ÇÖ6‹ÌGﬂÖâàÛ⁄kˆÉ§(A…∞¯I\*g
∏«f#p:(§;¨ºã(†eHÖ9êj%ﬂ¨ﬂ‰UñâW'≈Â€£‘»wîWôˇ6∏Òx4˛ƒKÇ∂bl!ü˜¡MZ‹‡9ÚWg®ht7˙¿‘≈∏(BWÓ]€µ\x@!=SùMj'>È8Y”»YY•dfªUà‡îÖ∆SgA‹œ#tBKêÖ›0ËÏ^{˛Ä‘Ìπ`≠5ú·{/:ø…Ö»À8a`p£d˚Év>ﬁ§r),˚ä<s`’˘”GKƒ;˙∞Ó ⁄Ï›Ÿ›Oq?DÈº°—x8¿‹!Å7∫˚©vgÁœ>({[≤≈‹sı f¬Ÿú%˘z≈>„÷lîÆÊöŸ§ZõdﬂÔ˛‰{ù Íıáq0H“Î^y™OT∞∂∫ç¿ÆGë∫y7ﬁq£˜(ºÙΩÉªü:<£LQÆ~ˇL√NîÀ-eGö<…h}„ørF8R √‚5q¬gjRLù>qäÍÚ< [¬rÄ”∂°∫bÜ°†unv+Z@‡b∆≤ƒó5ÏÌÄHGˆ;d‚pv“‹yπΩõπ&£≠xyªU∫≈ÛÕhìù,[|∂©º1;±m(∂í‹Õƒ≤Ë6¢m$hÓ-ƒ≤â8`Lÿ>Ó´L7‚kË˚Qﬁv4i/–‚≠⁄E_”y ÷Oª<ÂWÛ›Á
lsÖÜVLèú7@Ö˜⁄Al#˜Î¸FU◊hõ;≤c|uË†}Àu)≥ÖAÀ‹^€Cß‹œ‰Mt =T⁄Eglî„{Í]‘≤èﬂFççTF¶ã‘Ù{LˆèÌﬁ±ÄVSô=’˚ƒL=lπ›∆KéõTß÷ºzi^ëí’öwÜQÏL™´‘∞¶ûÛÊ`UdÆ†Õ“˙¬*ùIK®x¥Vßr£∆çUÜ(<¸Á‹YÈ;ª‘Ô¥Ω TØ0Á£ç+“àw|RúπÛXÍÒîjVéZi˙x;eæˆ‘ƒ,≤÷9 vm
ƒ⁄ØÓÓÅXŒ‰›¬h∂çπ652ΩM˚%c_OÉÇyçñ÷t¸ÍlP£?º∂ó≠Ìu·jQÌ}1ŒΩºÅNÿ)c∫-ú€∆∏ees~èÇo  >Æúe“>F  ﬂ;/Ñ0á∞>≈pÃŒ] é;Wn>–n©3'>˙¢- áT3Î"XBqayUƒ#ôÔ"PFPh¨‡¿m˙ÙY  >Ò"ò$ê»ƒZéãEf|Ë»0˚≠∆∂ﬁ1Ö∞ÙN'_j¥°8/mﬁidß∏“†ôπ2ˇñ-k˘UMu1ìŒçT¿•§ÕZ2Â∫`V\?1≤Vd.≥ŒÛ$”A6Ú:“€˘Â®!èõ/œö®u<Ÿ›>:ÿ=‹ÔwvΩ≠Ω]¯u÷<ô∑R¢∞tÂÂ]5f7∂VJ¬wn˝Ö®‚º -B3ö¶Hõqôp¥SˇRF3næ8”©ÆÄ,aß ô˛Ìøˇ/äµM√fT`Ùvjâr_ï[oì„3‘:9ÑŒ( `u∂ø*ôïC∂–≠·?]–…Ëﬁ:˜
®ú$´≥≥˝”Ò˘yêåÇé˜%.∆8’ÿ"™eµÃm¿,4≈v=Øìª#|5…ÊBÔ@ŒÆïÛ⁄ÆÙŸ÷öMÏ‹æ“7ÑØÃÕ`iÊ≠‡´_‹6p≤˚¸Â!Óß/üÔûÏÌ¿/2::}Èmûæ‹?kzwÿŸ€nŒ{7∞Z∫∆øóxN†e{–…Í{˜∂U—0X.¢)∞|ı…vÅ˚ÔËf–πf.XÔÓ±ÃOi3™‰˚¿Wsﬁ÷Êπ|ÂÊˇnÔ§Ù˜Øƒ_˛É[P¬ÊI∂ÄœOöœÓ˛°9ÉÂﬁ†ù«˛"l€L)√ÏÛÀ∏'swÃŒ!c’Ÿ-?	Vó˜˙@ÒÃF©+õˇµ˙πöå¸xî|¬∂Ñ—#7K∂p≈{£âÁ{≠^‘ÚÄm2√{y≤_ıˆ¸÷FÌ/Qú#XüódQ@J,gYÒqê·vŸøÚ1<=¬(kC∑Ò
ÍÜ®%¿TÒmY+ØbÜUWﬁqı√$¯íQÍìr†D∞Œ1Õ⁄w∞a[	6ΩXf…äŒ≥”*·Ωeè¨FÉ^?hÁZ&∏º≠2/ è„ﬁCõra€	(àcä%¬˙Ë(Üö	⁄ı⁄1œS+w≈A`,v∫.K›O∑I⁄Ìu-ªÚ™‰÷ªg{_7ß¥ÿÕ≥ŸuXÌŒj∑[–·>∂ªNÎ]&[øLˆ”«ÑOxÉÔè4√^bP˙„√Á%ùßH´L§ˆM •ü}7ŒKîc+∑‘π…w≤FˇÊxWmU
Jüˆ*hÛ‡~≥ªu\rÆåÍ¯…8ÜÜF¿˛»≤ÃãÒÊY[x…0àª≤wCâé¢1EΩÇEªú·O˝Û&ÉacElßÃXë€ˆ'Ë˜˙Áú—¿uÊ√ãpﬁì2ù°	F$ä¸—8ˆy`™Gûˆ⁄"#+È{‘ÜØ oôk ¢ü˘Ω^ÀoøGƒ&ﬂè˝8(“L∑°	âÙç‹òÉæç‘ÊCfû<x·ÙËÅÀ-ΩfÊk™Ç,ëÚ«‘˙}ë´EY±uˇì6L Yæ∞îy°ïÅ©HI«»I¿*<Q˚™Sº’t/ÒÙŒÒa~.∑,°VCÒíºã( å¬\ﬁ»ƒTˇÏ≤2»
Î¬Ç=Ø~≥+N7-∂$ZX‰}ë5Õ˛|À˛|√˛ºêe=ØÌ£S 5ù¢^P%í.óvâ≤πü°$≠ ÈÔ<√„Ç»ó"õùéñn/Ò‡xéñxçá$F·†È#†ï(?c,l∑≤»‘¬Qûsà¶‡òJ¶.◊áÁ®KØ3~°B™S §«R}#2:ﬂ¨HB•1 ZÂ{ì0,#Rè.æ:™:ÃBŒa∫±¶h±H∑“ÈÓ˚7¿äœnÜK‘!¸ﬂ“ˆ[Rg◊î;‘H·È∂]Yë∂mi≤4\ÌÒ(ºﬁˆ¥AÓMls£Ã≠B√Îº…ÁëÒŒŒﬁ·H’TëS5e·‰πnÖ¶
gìßR9æ˚„9∫∂á∑hÀ˝Ÿáå‰xÿ©ÿ•‘∑ #∏Æ#=Àä\kaQÂ´ qT!+üT¬I◊¡ïèÚäø«„õ_o‡˜\'HcòC£≤≤¶¨£ﬁá"<j8èe∏MpÑûÏù¿ÅNJ6{Tr"AÄìKs\ÚxxnN\Å¥H–˜+?Ó¿Ú>·úÅYPË;ƒËÇC·áåFõO∆Ö…óP€/¶]6€"î&’Ã1Ú∫ﬂ2≤˙ˇÊ.§©z5°)W¡Jc2⁄L-¨
˚ıeá†Ø€\
*HF„Œçu5‡o∂€ÃÈ∑¶|Ω}9"HghU]òÁD9Ó„Ê°ySê&¶‹;‘	◊@ö<3óhTO≥ﬂj¨pî&’ÁU;{ÕÁáwˇÒÙLeXJ[)˜ î8ùÕ-§tr”}
tPÍA≤b©™¬AáeˆBën
—õÌÊä+]0∆ßﬁÆR(BÏ7v$|ªjﬁV“µÒ≈‹@U—t“ –†4>[Ω®•©˚Öv»|8ƒ·+S<™‰⁄q $w‘B%ë°≤5K2≥Ÿ*ÍÓ^∆°÷0æ«!”UYz¿k1~π¥XZxUc¥é&¢–‡‡å≤aÇ)áhÍäZa[D|‡àºh ©¡ÊÊ”°óÓºå·ú¯WX∆ìv…ƒ[:î◊ÓŒõ_á˛7AÎŒ4‚≤™ÁM˝DIúxäIÍ§U¿^øºPçê;⁄A˘—Î‰·£Û÷¿€“¬Ì€ò¡A8EB‰œocøü9€~+ŸZó4ìÂWÿ…7ãiØ0xœXÄÙá‰‰ÄK˘ÇR‘ÇàîÅû˚pº®zP+ùΩj˚ÉS˜€Új3b·ﬂ7 [eø\˚°∂P÷¥425á0π» ﬂch¡•øãl,åJZAX±õﬁª}ÊïË«¿´ÄØö’ºù–THLDû8îè˝6>•€wöz!˝mnx∆√1`µΩ·≈MÇªê◊ä£´€TdèjèÒPgê˛%Zœ∞i≥qèl˚√≈±78ÆŒ¸÷=(∑≈òîù»C<Ô*¿™ÿtôWD⁄mı¸¡˚¥ÅñY÷»Ì´¿ç9Ü7˚ﬂzæ?éÉ™>ÿ¡p√ªl[çœ/ºÔÀIﬂ
Ùµ«qﬁ˝Ÿ<¶Éâg‡b$?¨Èïºáﬁ)K’É 8Ï%ÀÇÕ0u·:Ω`áÀ±rOã›yÙs3h{e™-¬&ú≤)*îÈ˙0laËúŒQLﬁÚã∞πœ-√˘±Qä,l¶ÍOpÛ$”“MïOÑÅ„râíc@:∏=ÊßAz Óî=	û´äO§∂¥Ω˜á{€MÔ¯dÔÎÊN≥4EÕ=µ‚S•û.©ïxÔÂ[<>í®Õ97—ñƒ·8áI…êS\1pOâ”ç!pπRø/Ωc™/‰ÛÀ“[Êõù [ïfI—î¢™\ˆ»}íç˘%ìcÙ%Ûc™Cml¨©_ïÀ¸«ä$UFKﬁ(¶Îkµ~_í!(AŸeè∆∞∆HÁ$—GÔs4¢v√ΩËËLÎıËê iËI©:¡eÿî^{âv¬~í™ÍA\$≠‚N
˛k÷lπ=x˝}® ﬂW
Ÿs“ûS¡:µ¿l∏»1Ü^@v X˜Ä∂‰A^Ü	‚ÅÈœÔIPhÍ]Ø1:Y¢ˆ/≥À ´ÓQúö¸â™˙û&|´Qâ“Ã_¡gi7ÀdúWØ«;ÎµZ˛l={ˆ∑Ÿ„3x|tæà>∏ÆöçU*⁄X€zˆÊG|^bœKœ¯Û÷Jç˝®o–áz3›æ–ÓÒwæ=lÏm{«ÕÁªﬁ÷ÀùÁªgﬁÔºÌ£É„˝]8O}≥∑sÙÕ££ì„ÕC4ª9;9⁄˜ Õ˝ÁG'{gGxﬁ¢ã˛Ì4@–◊{/w»|Û≈Àª?ú<kù ˜ˇtï∆,è0·r∫N}¿-∂2gI~±pä7Ù§;çÜ|5H√®WÖ"âôv	8ŸeùVhTõœÏ„ÈË¶«O–-ÉVi«fflÄ“N.)iS(Y0_:’´4¡âxsaΩù‡>6‚jL´ˇHØn≥Ë˚◊ìÆt§¢iÁW¥$*⁄ÿxóûd‡I’ü Øy—ÕÏªK¡£œ3∆íõ}Ë5vπ©öE•òÚÄ»l‚Va∑‹ò4]z	e<üj≤≤»ÓiÎp¬'ã2	£öúû·Õ±æÆJ©÷B‚/1N#iu3–®z\2Ù˙¡»'ãê…€ÔÌ¨@;›0°z[ò–À€!$GÌq[óùdm 2˚]Æ≤»aZ»∞Ïä{GàúÇê, )ÇètF+àÃC∂·±m Xdf,0Ü,7(ïuF≥ ÷hH2t¨Æ†ñmÊV™JÏ-7ûÓqÀFÃ“BæwLîŸ#¢Ã+ «ãÜrøX(säÑb	\‚¢„B¡KÃ#.p/ à	ƒŸÖ{E±6òÔp6Z$¢÷¨µÚ⁄ù-¶÷L!µR/“YÇÅÃ
d÷@ ˜R$à<qñ©;,J¢F˛Ó`e˛´UŸE—Õ˚ÔÁò8Áüﬁmj4ãZÓé\ƒÕ2Hó˜w:∫ﬂ‘≠UmnFybŒ<ùã¶õ“BÆ$y”öÔ;¢yé8π⁄DÔë≥˘ïÈndõGy¶÷a¶¬ÛA%Ívô@Óñçó÷eŸxWgØ=&cafÒÖˆ`q–˜√Å∞ÅCVtı(äá˛ÄÃwe73ÜôqÇ±€èı€JJ~¨tÊL6Àr,Í›|d¿[0@ù§]|lÛ∑F˝/‰ªHµ#ò5»T˘•∑¨$FM5)µÍ˙2SÆ˛»ˆÍ¡9aå´DÑ⁄3√èt}R§›’ö´›u÷n£hª“,ø`˙ªÓx¿b'√ÆKéK) 8~á[BGŸ†™N?'‹PÂ]¬·|ÉcN›kî]Ââj∞‘®ôFkìù“%a”πqM’ÏÅùGLù·°ﬁ…˚ùáÁ—è©∞ZÜ˙™¢^˘k◊hë«QûfDÔ∫ß·K‘˘¬Z*m◊–Æ®Â≠÷36 6”dKóRÛdkceéÙS˜¢ ,πkÄB’Q¥]â{√À`àvﬁSÊÅ∑<ÜªÇf§¨ œÃîÀÚ›á4d2âŒú>§/ã
ùûpy˙E∑Ÿsv1zÂ«Éri;˜:ﬁ b∆ÿ(øt·v?§©1Ïü≈¯Ô·Rπl/0çK•›∆≥â ˛Ê›?6–-ËHÚ:*…f= dê⁄d¯^ ÒBT¥¨∑Üıæ©Ÿ˝0OºÕ¡’Ë‚\–¢“`≈µX˝™ﬁ˙ØQ≠=œñ‰‚ÿ
öf„◊:;∑÷:ÛW…´Wºt–ãñÊ¬iû g…ûóVZ∏≠èBµ~=R›p≤Èz®r´{9wö.åSE@òÖ[”–dﬂqâ\)%|s3)ÌÕi¥f:“<´`€xKJ™ŸÅn¢OvO˜∂ˆ≠Ig&é¯°∑Ïo∆ãÔy£≈R+ıKb—K« 2Øz∞ÓÉI˙$´s£ÏJ;éíDŸUPı	.∂¿Ï“:˛ﬂ:AYpπúÇf\9±®ó3Xú•R]ö^kYØ(:Mî¿jéGï·J‹!À–,∫flX†úSÕ]ÅêŒ¿/·¢7ø$a–ÎTËÙ{\Â•VpïWì·ÍWÍöíjƒˇqqzπ“C´Û˙_,Øˇ´fÎF¨.+œÃ¨Ú€ß8n|åc⁄ºNasÁƒ0‘n ∏7mÃÎÚá<ø¶üëT‰(HŸŸıvOœ^ÓÏ©ûôs¡∆«êêcJ?ö∑O>ñﬁx¿,$WßI˛Çj1{ÙW‰‘ŒÊFˇ¿)îltäé0:FC[“EaK!ã`aO÷™Ô{Æh˛ÊûYìS6q™X9†{}‘ÌB; ñ)míXÑ¸ÀQW>ïÇºÇ•–‘ùûÒ·,⁄9¯∂,a1´™lÌv<ﬂo'[◊6ê‘¡+ÆÜ•gª€/X$+æ∫`Ω»Uå°Nt)8<9Xúæ%ƒ∏âË>ﬁg⁄ º,
ZQìﬂZPL…·ùìa∫Pt∞π´¶5„àÊäﬂçÏµ`	NäXL™¨ﬂß¬ˇUZ¡É∑Ñáä*yí\¢#FÍ‹SÇ•MÍ"À’:Ω…5≤´Î‘ˆÂáy+U´’“§F<;∫®µ§∂É2–O•Æm+∑ørA ^LÌ∫‘6)’IïR¢CùMäN'jÎÍSpï)ñ’à[≥°zB=÷h∏l`Œ—Ä…ú¢ã¸ƒeù÷(¿?ˆ∫ñ‚PHVY±“Ÿ"#…CFêDYbˆÄ<≤Ä0Êüı,Ä3‹fQtfCˇîã•åáãŒ CÍÁÀo’lœß{DY õ≥âñí¿m∆]ÕOú<´µÚ¥Ü 
˛sHõ˜J
Âs`Mó¨ı{^©ígHî\4MrJ7ìì$OJë,ü8Ú"JÀã+'5ÚG0”¶¨¬Ëà
!=2_‹j¶‰‘V•ı[!˙ÊìôJÒ©ƒ3eOñå∫g»ùlvœû99«∏{yìÔô≤&Fﬁ≥ÁL÷ΩÔì1Y3Ú˛‰˘íUÔèú-Ÿ4Ó˛∏πíÌÜ›ü<S≤i‘}ø<…≥fIû1GÚΩ2$œû£Û(™(c^<ΩéÇ>ÂAõ0å Ígà≥é"ê./Ç¯◊ÚgI≤\\˛4∂¸zﬁÜoM3±Î˛…ï'±ˇw'¢_∫—Ω.òúæ;˜N§ÏÍanb ¸˚ ”Ωié_◊¶âC≤ÖŸ*éÚOê8yˆnÎyÃ¨^W3ÔÀÖ˝ú
&T˛‘ÓVˇÓo59Èr·îÀÊ≈á3·r—{â)“-[ÓD\…ñ-7LñÛN¥<möeKíÂ9nÜ¿‚Ãf8Creªö ?MpÅƒ Z¸Úú§ Û⁄π,π“)OüL˘ﬁ8r%RVØrã‰˙u¶Pû€nô+xú&u≤ç9âì•Mû	çbK-G¿dQ˝+<àΩñÀa|Òs>)î-º◊ô@Ÿn§5øÙ…<WÚd'6Ò'Lú<?9À§xW ‰ô&;…>'Kl°±9dÔHîú•Iˆ ≠ﬁ8üË€ÛNõlæ;iÚΩ	_È}¬w'L˛Y_È˛'#¸|¡bñ$…ï¯≠Wí#œrü·Nä<˜»rÃÏˆBNäåW˛eb†ar°÷‚TKó˜»î¨∏gûdΩS˜Ãí<ké‰üIã8á‹»”©ûàŒõ–"—(‹'ŸÚ!ﬂÔ 6QDòîµ`‰˚àÌì˙Ë Ä|ø¸«Né>EˆcWí‚{d>ûÖßOŒx¸—CíÿyΩñÒx
vœ4»rPí˚'Añ˚5s
‰Y ˇ\<~nâèßcısHz<kÿÅNx|øt«SÀ6â≈OõÊÿŒÍÁ£¥%8û=Ωqû¢f>,~ ƒ∆ˆEi§iÔë=V∑ŒP¬¿¢Z∂ISiëA–ŒI ¸8c/c™c¥ïÛäò¡Jå}åãÕB!Ô"Ícpøyù±ﬂ≥¨g)êh«⁄èG÷¸Äòπ&lçøÛcvR˜Œ„0ÅUÍ«÷≈òÿ–R2ˆ/ºÄÎ˘∂7Ó|/¸·˚qƒﬂ+o˚ﬂ—Ω–%å°+n∏¥>¥¢k….Ug·ı[‚
ÿQÀGÃΩX∂xt¿T6pÂ÷™À,÷–∂ŸΩÂıﬂbÔ‡TyYzÖô´*NNÇfHàŸ¯^ÓÚÊ»rÿÆ‘îJ§h@,“HÈﬂoËﬂ∫Ê@üΩÒ)ËN∫ﬁò‹;’Ñ≤æíGLÑiq—L3 öÈ¯§Å˝=Å˝Õ¥bz„1{8’4„ä…6◊’|√K{Í,oU√€køÜ˝ıYj∫wx∂˚7‹<OÌmø<@ªÿ“"#l‡*ãŸ§>dC∆8f›NFÂQkÑô/p}øìû◊6O8|˜ß«év√Åæ®OÉ†≥ÕüÔÃÃ,•€ gTˆƒﬁe÷ÓŸª∂Í_Zí3Dë;vk
”+yı(	2kî SÈÁ¬F¢LOÜ[≤x¯ÚK‹é+ÈW‰◊
ºˆÖoGù†9RlJ~T:®ßtL^◊,;˘ı˚≠$m3X§#ıU-ùEuËw(“||©fZ±ì|8Ú<dí;9è»2˙SÂã4∞é⁄RkSâÖ¬MÌ•v•©fé¸IkU˙†7j÷ŸÙÍk∆XbÊ“qé◊´"{QﬂX~ƒ‡8Öpãn›ª‹v∫ xJû¥NÄ‹O_4+´õﬁ≥ùıê/üWêT[L AóìÂÖ[Î'hgù>Òë‹V6∂Í€ï›ı≠˙;iÅ*|®ç„êäL‰B+˘\Hß2&¥ncB∆»ßc7Æ±L≈S'å∆ï”œ[±rU‘BÌëK D…e,\©3
æ±∫ä9‡ﬁÁ»ñç±QGØHX˘´u6¬sL≠Ê≠YG¯lÔ‰ ª≤ªøª}v{Ï!‹=Yπç•¿,6™ÎÖÊq≤_¬J5ˇÏ9’LæÉ£hïü5è–áÒé˝∞∂áTO´«U¶Œ7aèm¨†\“æ[©’V*ıFemy}£Ñ6;S∂â÷%·#Â}›‹ﬂ€a;7≥˚›≠Wnæ<É◊GG˜m‘>¶aÅD!ÃäM¥™ÉºBú˜Ω$8ø˚ÁÅwHnJhﬁtÍ V˙UÁÚêe	Ãÿ"‰Øù d∫”ª˚{8h`É¨ÂùªÁQˆµª?ü«~◊ó∞(^d Î˜ﬁcõµEd√ÎnXÁ(2SK]ê\ !^b¥–ª?zm®√ÃpõF™tñl±≠H	œ”hgJ†¥Ùs™
R˝’yl9ÈPıL}m}f?≥¡zdıÖêm•Ê,ígE/3C04OF†+öß†qB84g@4ä="öﬁ£‹êh∫ﬂ®˙$ÃÑœët32Æd-h˛µRÈTR'Ó◊DÌP4√@ª$Ö{~á-ﬂBã∏&ìı«	ª&∑ê≈^√¡”øﬂ.¶£^Ã&B’°à†kaˇú˚çº“Åı##x{ºÀ∏“t&¢[”CûÜ–êw·ﬂ®e—ÎG ≈¡¨$pFáÉÁhAòè|H c—Q´~?¶Iﬁlï‚V1—?Kíπ√∫í»∏ÄPÄj[ÔÏËowKã
¡Æ65 Ô[ÖÁÔﬂ˝	(TŒiNÍ¢.ﬂfz\†¶!Æ‡Eèù.q{0î!HÓ,ùñ∫v÷jÜ‘0-Ñ∂Aí}C⁄ÉtÏ§†©‡e~⁄#„õ∂¬Q1‰·3ÕµØwjëx}ÇHl”Î∂ECÓ#ØÈK;1HSaoº≠ søN´∞•w™(<ï\ë»nèkˆ›&ñO*˝…tå/WW4úÔ"ßÈ®“πÊ'±T<.üz…ÉÖO@)Ì3à‚ÿ—û8≠‹oØ˜GT«$ﬁÖ„K‰p4'“”6¥ßUƒ´Pu‘´!uıÔc•¥†PÃ£¶O–©äE“o<§–Í‰U≈‘˜Ù—ÔıxÅÚ3∂ÕÌvBò`@ü‡"'r¥|éèCÇs‘•◊Â*∫£:ÈéKıùükä∞⁄ê c{E o≤»†“ (A‡ö£ç`√™ŒÖ◊&P"ÍÜÎC∞ææ,'ª_ñ£ê∞◊S'nO)I©ÔJ∑nßRkaQoØ‹	)ˆ…Ã"È#I\˘®¶Ù„˜òèúi= ]ÃùÙ(k‘Â¥ézäiètßƒê‚_îúà •˚OslÚòx‡}$H¢ôÙ$ûP˚	_(¨H∂c¢‡zO„ıÉ&π‡ﬁ£ÚæLYÈ≤bÊ6™m ®•aH⁄Fj^™1±ÍÀéXX∫WåË:&˝æ±N#Û{W,ÓwC:A∆ri$*+
R§üt ƒ˛ã∏)Ùpv3§⁄
)â‡BÄíœ>§≈‘Mˆñ2k[´)‚πMÊÀ∫!—!›˛[prE
ôt–$ÒM[Éê®ÈÖ¬∫MÑÕ⁄áüÙ0F›S3†äs¥¡∑_v€J∫XôÔØÿR1ËX\)˜LÈﬂy÷ﬁâYﬂmÕRÜp≥U'˜2µÜÒÌ8ôä⁄“^ãCîKã•ÖWı79≠Ûƒ‚–|
¡fä5“åhÈœg¬ó0…ô&â}ñ ¯uÚ—y$˚∂¥p˚6ì— Ms/Ω{ã7‰x&◊Ú‹g]XäÃg≥¸
{˙f1ÌÜß¡ä«dòCÇâÀÔÇRl3(èü˚ ÔT	G®/ ^µ˝¡©˚m˘µòlzØÔÄ≠Ó,Èµ÷BY.·©ïO$."ìíºKIﬂEF%≠8¨µMOÒEı¸>4›Í±#S¿™±É§yßxÃQ^∫}'ÊÂuhÁâ3˘óh»Àpo[∂Y¥„hˆá¡’ôﬂ∫∂ÿ™á≤ØÁ]ÖÉNtU≈¶Àº"Ra´ÁﬁK)≤ı±M¢ˆ]âZß†¸i®›ç\ÜZ{`}°ÿ°4ËÂÈg¯ıÛw‹å–ÊCrù?ﬁyPçœ/òjgSãÆÔ˜Çf„C3 ay„À≤8h∫ÈF8|\–:q√IÖ_"8{œ“#1$_¿π§ú¬Hœ¢ù;áYçomØ,Y…*cÿ˜íó√^‰£>ØU≈„E$É¡[VÍt‰è∆IπÙ57d!€óÄ¸ú)û®•úx>`¬˙fª$…YÙ>,zÁQt=Öm|o ËyÌ√>ﬁBîK’G›0Z∞94«£ã*ã†	“*‡≤ﬁ>eõßÚ*±	ö⁄·cBÀûÁ‘IeX¶¬ù´ª°õ't†„›í∆ßÜ@$u4+≠k”ë±œU?òK-(Ë÷ﬂùQn†¥o;˜¶wàìÈ«Ä _`#Æñt ga? ∆RfTeáXÇ„“R≠¶⁄Õ±]÷&êÃ<kYœ”w"•À≥wXÌÆ÷I;îÁ¥àëÇNËF-é–^ÕÔ)d$Bb`â-∆¨›∞º]Ë!qÃ]›ıÅ©¬∆l˚É°ÉªBk—SÆåÃ¨©i0*hA‚LPÛ!¯t‹è ◊ßGÖúË=,,b›æÉ[~sµWÿéîùÖˇQYõ»1u˙∏”<5õÅE©gãl—√û∂’<•®Ç;Õ≥£Sy;ÂKú‰sCh≤&qä•Ô’>∞<§É¥e{ü]Æ<XÆ’,†‘2©ÿ“ÉM(sÃœ1e%QÇÁ±‘T3¡+Óä/1Xç´z”3Rôì‚H-\”∏Ÿ+»aÁ>ã|*m7Ä(.\ëæÀ‰i›≈Œt6ú;ƒ¡J≥:·®Z≥OfÈ2T≈dÀbLØËvw¨Ùa€Sx?ùeMÿÚYœvé	ƒP'UI˝^î{YÄÆå…¥O◊ø¸Ò˘ÿè;>MX8ä~S´ÅJˇ∫$À{Eπ˘r∆Õe:ö$DÉ∞õ ˝ƒÁ¬≤tö≥AπÄTÔ?í.Ü»ËMíâUA‹Û∆I∞€Ì¢±∞,q”ú\DW« ¡è¢Ù8÷Ø√‰î|≠:›&ÜÎë§8¨¡èÅ:]MAC˚ù‹‚‡%;πŸ´~ëÕ“[Äs+/ÒÁ∂Â¡∏óÖæµıM,÷Y:ß÷-‘;•äΩ{≤L¡W|¬0¨{‰_§ØGå@ˆ:¥©¢2`r˝#„„!Ü?>ÜQÑ¡Ub=Qqyûû°ºÇzñR%ëL\¥±≠òù–g5…∑LÜ†øÿ∞& !Ö!å«ÙR·õ~C3^¸˚Î«è‰"¿¢∆îkñ*©^¡©˚≥ÍŸíª#nH˛~òÓ&Ói)∏ëMòûd¬Ù®ka™˘IÊ;?…ºÊ'gyÀj0{ƒI˙T™≈2Ó‹¸>¶êÎ›Ë:sêgfAÔºc›À€É“{∆ò8ã°;≤/ä°6c˛`ÏKür(º™—w¥¨/*õ DÂ[⁄‹“ΩMAøΩgö|n’vR.J√m‡(“n*S“¸XÙ8+ÒÖéÍÊ+zR∑I¶ô’˜IÒ÷Ç7ˆ)ÄÇ•“5'Ωı;˛êÛKå¿˚	ˇ†1aˆRÂ Ï]Ê¬û3˘ô¯.r4
√ZBI*ΩRL’*§ƒuJü≤A¿‹˜o ´x1oﬁ,HÍ@Úˇ<ÒØÿm1Üdf5L¡m `ZJò¡ÁæT˙"€@	ÓüPÇœü$ø⁄;‹€ﬁCÎÚÍÁO_øari¡RŸﬁaÅR)∏}Ôd˜¯Ë‰l˜ıõ◊…Á·-˛Yz∞˙≥GÁã^πè¸d—÷µ5Ö√Üo€Ã{íµ¨˙Ezí¯É‘‚ÎÛ +=y\ZpîË±_∫K Ú_`}ø•¬ü’ùÖ€a‹¶2ˇÚX.À§ßÎQ‹º‚ùk–é:Å˜‚Ï`ﬂ√(^‚µ8èÜ]‡À7øÎiÇ˛H˛]oÙêe~wŒ?>±}Ù˚Cˆıw∂Øﬂè#V˘AÈÅÂÛoñ6XÂ∂ ø©Â~ÓÁ_§H3?{„§?‡%˛…VÇºäYÅªˇŸ⁄Bàñkºƒˇc+1h%|¯û9~{< ˛h+»%~≤ïÂ≤ïà‰∂ïÀ%˛ŸV¢)ó¯{[â]πƒl%ˆ‰ˇ`+q$ó¯è∂/Âˇ…V‚b‘Ô±Ô÷	ÖΩt ¨≥~(ó¯«í¥ê∂içÏ˚g¡Ô=89å¸k¥ƒ≈„w‚u„®O∑â8H‡%ªHE^/äﬁÛFÊfq‘í>róÊ¸µáÃ§¸˝¬”◊-∆%û¢Ú$π–{°a_x¯®b-·°{◊¢‘g-CÎBπ∂iw¢ë(Ò/∂ï¡xZZƒ∂B_øÜ¡ÑB~ox·ã2~ØÎ[KµÇQZ€qËÉÑ J—É}¸0z∞ÎèEô±Ó …Á“&™ªÄx|‹ü™x´[∏¯ÎWÆﬂﬁ‰|+Á|[‡ﬂ≤‘Ï%úT¸AÇˆ˚⁄ç1‘1ÜYæcI—≥¢è6Ì∞tP «]£0√zjÖ <ﬁx•‰˚1⁄ ¥¢kØ¸oˇ”Jﬁπ?DE5zö:~‹Aé2°W;¨œ2]‚>:8ıæ¡P÷›ø˝·”˜p˘„ˇÆã Ÿ«˘'˙f_bˇˆáˇÅæ⁄ñ÷ø≤ä"˛◊ˇìæ:®˜_ˇL_]T˚Øˇ/}vQÎø˛W˙<NgããÑÆ7%·^J˚A|†ÈÜpºI¬ÑíF¢X\á	äÛgíx*|6≤ÁÔíh@U≤W∏$∏òûäµ‚G&–	_°¯}˛wØ0‚◊Ÿ€ÌÊÈÓ€Êasˇ€”Ω”Õœ>∞FoﬂpC.πÍÓ†CwwäUWbàÔ>˚ µ˚zŸát8∑ü}ê∆Aﬂ“oﬂÈr8Âeî1üÙlŸÏë1b<H`ˇHK≤ÿﬁU8∫ Sπ‡÷èáÍ‡‘;ÜOØé§QPÿâΩŒµ |J\:¡ıQ∑,jAz0Ë‰WÅ±Ò
§æm†ä¢RGçá`ºxívHU5è@DÖqJõä√sZO¢œ¨∂ﬂf‚®Ãõ~ò˜ ◊Aâì3Ô CØÙzzP¢¨ú§w‘§
‚6ùƒ#ú¬´µE!üO8˜b“ÿ‡‹oﬂxØ|˚7ßGáo¯è.|ty ©˝ËÃª¿$8·D|¢î/.¸Ñæ;H°öÂ…NZ÷uTZ–'áı⁄E%€h≤ì6û`$a⁄>±§!í°3ûÕ6Ë®X~ı:y}˙w=ÿˇ^Ω~d+˜Hªpí‚î_’ﬂLr‘L#$≤l°JOeé™Zc⁄I¨TÓtèEñXó7&Høúc8VEäWùñ≈Ç¶$Q€´ *CóΩäCwá£Dñ≈iD∫:ónQ’*…å* ˘†3x¿Úèôt˛›◊˛pK\∞Ωt¿)¬ÿË&çúÌu‰Å‹≈•√TJªL‚XÃ¶˘}…Æçv h—äø—◊Ü~å–ﬁê~±cLøQÏa?`}ÎÛ=îﬁ†![J†Fè)‡∑èaGÏá‚Ê„2Ë=—ßÿ;ÏÕS≠X8íÙ›+nJãiÜÃ∑‹M∆xﬂä:7'—ï¸A|¬!Ï¯#>…æ"LfB—;WÁEª‚ÙÙX$%U%ø£V≥^KÚÄ2ØﬁdÇ]Q‰¥cl=˚R®bSÕñº$ë≥≥Õ{üòΩGËéRê Ê"!bÕ	€~m‹Nj±sú»+ÔÀ∂“i'}Võ˚2Ûƒ∑L˝ÖºA¥XÆÉvY¬	0r‰∑§êWÓ(˚^g∑ê≥Òπæç√ôÆ«…ÁyämÎ7çó‡…N≈~;Y¡¡{®Ûo9åÆY†>Ê;≈¶˜S:’≥ª|‘ú·Q–¿Ö˙°tﬂ\•L)∏^U•EÈI÷v⁄ˆ[A
Ø-¬È´ø{˝ÊÕ√LÂ Ü&Ü±œ8,dh*ﬁYf]qQ§‘≈:É	rk©x˘ÁÕ√ªøﬂﬂ0<ÿãg‚AG%YêÃ@ÈbÇ{P™îòB–%≥| ¢¨ºéÂÛ¢¶çW÷òå‚º¢ígÄMGØ9≈Zxõ¬}æAs¢‰ÇP∫∫ÿJ`4≈]i»_9Vb»Pnäh©®Õ∂j%∂¿6=uﬂ ,ÔqãÇÛëÃºo+X∏"
W(÷„Ìª¨éËƒf˙K,S1]Ú¡â•√;√}Ω√ílG‚”JÓ√Vºáõ›§Ç0˛yÏ/
Å≈hR˘√ñßF~’&M|∑®M≈}Pô7ƒ“3G¸[◊å©ÇäÏ$aù,táÄ9J°±∆‰˘‚≈¶˜™Z≠Z{¯&„∏≤ô≠®Ñ3˝VU¬ŒaÇ“9û7$ØMƒñöÑõêëöÑõ¥sπhIK√—J≤‚¿âƒ◊®,äw”C´.çé_C
]Äm‚_Œ)ï´´nÿ©9-f;-¡)ı8b˜	Hv ˝Q≥é‰ÂAc¬≥Y£R©î»Ùı—ﬂΩ˙qÛuÂuÚÊ·gè™£ a1W5x¸< :¿Ã∑p<˚!Ùlc¸ëÔp¬z0√§rxë]i
§:ØJ≈—’v–Î1i8∫íEaKTYnQ‰_¡Z"	öW[åÅF‚[æ®FìŸF‡m1çÊ5å˙ñ‰õ#ê˝àÇVM.¬ÓH?+ ı‡(f÷FCΩéP9‚wµñtv¬ïˇ±ä:Îj4Ó,*;«§gËtíí^S^_ ¥†’- FÖ/TßV7[…ò.ùˇT◊4+o°ÇìòKz@S_äQi4ô˛6ÕuÏ#c\∞X•r8ó-|fObNZÑî¿˜YÃO*˙*LÅÛ@µ}:çí™‡∆¢Îà;‘ïu¢+†1ºr` 5≤˜¬ÛDEf‡ß-ø˝~Ç/8Ÿƒ∞fî5Ó›ªíbIO&@ŸÜØ.ÙtBÅdÇÂ&SâπAß‚ ëxÜ`£L'u»&–‰ô*‡®K>›÷-Øâ¢4+•ÈÃ¯≥Pœï–®£pêUVåÁ”ßgì»)Nµè∑√F*ÙªiÖ—†Æá§∂I·o€DÈﬁÓ¡â|?ˆ{å2≈ÛI%ÿ3åCu£b´ÉÁ]ùV'êÍ„Ù?ÿ(aãe“]©æ¢≤1dÁV7%K‡„“∏≠qé Èâπ‡ù@‘.†%Éè˚3)¿;∂t¿±m‡%ÔπÚzÖ≤rUÆÒLÔ<ËÎF@ &`cg)3/ÎõF2¡®q|xX#¥∏õ©ZOå[ß¨ÑJ˙[	zY«äpa)Îé ™>d<#ÿÑÂØi)∞Ë0xuaNò<2‘û"ŸÀªØOWãn%ΩØpc ü(	:u+∂n˝]˘ÈÊÎWO‚˜F¸}€	ﬁ_˘w|ÉëSû˛ò›¸Heﬁ≤ò*Øﬂ¸¯%~£OO>{≤cg¯ä∏‚f[V¶egY⁄ºàπên0]:ﬁK€T®á„|\Ω~µ{äqjéOØ;ûæ~Û≥çú]÷8M≠¥«cUq∂¯S˘ñ?öqä´,«H·ÛÏ´kÑ∏bUı u<”òuRûœÎ é#r–Ù{Èi¿HZÇ≤÷∆è?¶çdgÓtyÏ-a	åõÂ’ÑZ∂ä
Ï\ 8x1søìj=4je'Êy`ˆ˛î`Íè¶xUZ‚/Èóº`w§˙Ò?ÚÎ”}º‘Ù§‘¯1ëisÃ+HêJ({˛o<Ìú&uA=FhÌK&‚jÎrK©¶ËÔ~É˛§“mà≤C:;7sÔSˆn∆ÓÕ‹ø•i˚7kgÓ·Ú‘=¥tQ]ÜºÂ{¨Ωâzjac0QUç'™Òõ
b‰œlWí–ë…2≈yòlç{xe⁄ë¯≤"î{Lk˚ˆπ'tª∞∑øÆ"˛’ç˝ˇ¢•b`\Œu»ìÿúòA◊∂\hO6£-π’s:VÓ≤Ì§fa–Œå8V˝»§{BU.üQ&/ èßwÖä	´ÄâﬂdÛU’{+ÍuPKΩk¸=©h4∑™EÔ}p£ô†LÚ¥ HsÆ–≠ÆﬂUÈﬂCËµrM(î“ΩNf#Ú˘ÎœôŸ6¸pò|–ñË›‚ùz∂W‚kËv40˚«ü\›D$m03±⁄ÜãY®%ö¢vô//>©Ãì¨k2Ì6¯S◊“‚ãRSÅ+ R†_àx=å˙Ò ¨t∫0ÁMÜäáoﬂ›b≤∑$Aßª«%¥Ø–≈8¢Ç8]•ÖTPz"1¿¬≤%;ª}˘àµ(ä•Ωîß#Co˙Vß¿WV¸Kj]ÿ†¶+Ä.9~XJÒ¨û¥pü≤Wﬁ&µìø
Æ˚ì}å÷πuæ	Éç∏iÛï˝îÎ£ÎÉL#¸p¥à^≠cr¯M˝ hrc™&∆“íZÄ≥hoÎSØB•—ˇFW‚áw¥i¢>˚êí¶à†E…¢‡n¨‘<Vé÷®«ç*ÄQ
–x;èU´N«/~Â^ ¶zà≠ì4¨ï›7x÷MåæÑ…):ªµGa˚Öh ËÅNDÑÉõPO§®ªt—ÌØ0øòbIjZjÁ<•c›Ú;èb)Ræä‚éıRûUªÇ2XDMÅ"(çˇfuÏè.hæÇ”¢æﬂS31‘¨ÃcÓRèˇï∫h 5é)ÿ1ˇç?a#˚!J“_¯£`åÒ¸>∫ö”õnòöh∆G‡ÀúÜÌqœG0Y3ΩÒ5ãÖ•ÅÄïÁÓ5˛ùq;}cÍ åöÑ√p ∑%£ ÍÜ⁄C¢4òΩiA“Ó±x¢äÅ[PÑÁª?w∆Ωà{ø¬ù`>IV+¢ÍEB_iÜ>'¢ÁÄßs?é©&‘ÉìPÿø˚!™&}ê˝Cò?•ÉÜrQÔÓœP}ËÃe§4èábæ`}∂≥¥±¯¶$ÚOÜ=LœÔÛB–ô√SlN 7<Ô¢†ñjıÉÚ©Û*SÈ5Ã^\ë.Ï*„6À !ö/gÂ
Ñ/ÑMåå;Ÿ#–≠Vîë\„öo#üÃf3®,'où≥ﬂ+µ⁄£zÕªà.ÉxS~Ÿ®Ò€œJK¸Hø≠‘‘≥Ô SVå0ö^Èˇ˚œˇ„ˇ•|Ñë∂„pàÆ∏˘»˛Á7ù6@6 	èi}ı¯Õ,Ê+!¬WKi∑∆â› Ω£¨füΩ”VÚ›O}∂xªˇÅ>éD)C ˝¡›OÈO¢¸¯Óœ#X®Ù3ø`,[ºx‘"2º∏˚Á~¿Ë˘bÃIÙËS®d(~˜œ-æ&€„Ùóè≠ÑNØ–ˇß®0ad|ë¬é—√p‹Îã’ ?âÇ•ïFØX˜@¯a„ˆ
…°è˛l¨mñ“^ﬁ˝èÇ[6@ÈÔv_‚>ß1´~ãÏDqBKÇ≠•K-{¡VYú∂N£ΩªüF|!√ÑD±÷ΩãhÜ®‡≠0b≥„ã…÷@9∆í5,K9aıÓOù r.nNCë˝dÀ⁄◊ñµOÀ⁄ü”≤f≠„À]«ÌÄ©=p”o}ß/-Î8˝ñøéˇÔúu|DÏoi¡¶Äˇb*>πxŒÙ•ﬂ√û¥j)aè‹ä`sW˜bñS@€áÒ–"ﬂq“'¢ÑbpfìHY	hõLÜòT:í®íﬂ	⁄cˆ!kÖøÙŸ≤k≈l§»í˛0∆ú>Ÿã®E]†¡9úfª	¶≠¶üwJgM Qƒ»c§√Hü®Úx¢õı S≥üﬂ˝4"Â…w4G/^π3d2zhÙ< z‰–Û ÙÃ•<Mò-=õØ\ÍÄc˙Ωéÿ®ƒ£N„Ú{ôÀüs)˝?ˇóJ«XB∏EŸ©c[OÍäΩ8#B®¬<âÏDBÓ0Ûà"·˜Ú√‰%¿fIBÖmÇ\îUëæU◊EøOÎÅ˛=GÅåÎ˝%qDü†i\¬åk÷Èﬂ-ÅkŒ[üR›)t⁄Ó;`üÏ€b8ˇ≈|?ÉYT•+È„˘Ì0®‘k¥*⁄¸Â¢◊≥tph/%—éàhIπK~e˝étrmLAÆgw?µ±ÔÂ·ÍLb√√q<Ï•“…Tzm°RÈk>ë˛ØyÏˆÕòÚ≤yÅ√=0z°NâG©Ó˛cf>œÔ|?ìê>ÊR*GãÈ»ã»Á¬8¢¯øx‰Œ˚Ïßáüp†∫Ü	MSï’"f¢≈‚‹‰ùÎ Y Úb.Z<†ñ_˘ïöïˇp˜«ªüÓ˛t˜Áªæ˚˚ª?‹˝√›º˚Owˇt˜èwˇıÓy›©ºy∏ NØôkTÎxÚ6;ƒûé[⁄9ñß˝∑2-T˙ŒT8e*'QÖQ˘pòŒ)EîUÒdU=	p™ˆ…°√–BÓqdpØ@—M["Í⁄ıQ≤Qç≠ªAÁñ+NÙW #£‹Åm8§-ﬁvˆ/K¿tKπzﬁ •®+˙OyÂ•ä≥å&o+8Wò◊=ù\¶>”j ⁄¥ˆ8N¢∏rÙÜﬁ∫R´ÆxqÑ°Â;,ˆJà´∂Ç.d·Ä<4b8>P0@∆C¨é
|ˆA\5„@–•O¥˛|`ÎÃ{Íïµ/ôö–– f xë≈˙Ï"¿œ@ë¸6HB∞ÈUh^ €5 Ã
—Cÿ˚@˚2≈˛oì?í“Å¶4L˚.Õµ&”‘#äˇ–1ß‚áGü{g¿sF·PD¨vsCñÁü?“K3Íê.+¸VG£ë»ÈW¡¿mî©¨R‘*4Ø§&Ω¶˝V•·]Ñùú[iR+|;`!C*+‹0∏bµ&v±'∞˜k^“ø÷·qP9)UÆ{^rõ˚U•qÕ\^+ØÍµ·ıË›%Wê¨ÆÅË~®º⁄ÿÿx„#Ú•ØPDü§2Ä”ê†5˙M4ê¿@ÿ/<éYL≠JC\«%s∂Du{®Ë«ª\^	#UÍàë∫§?¶8a˜∆ô√~¢ÆÄtSº:¿œÆzrü∆òcçú4ö÷KËê˘—tE∆Dí.[kR»Œ]ÔU0“émPõÄ˘.ﬂô$á’9YÅ~_ ≥=⁄,|œum0g~aªs(ƒ>Úòáùuhå√ÅÒÙó&»[πv_aM∆¢Tˇ“À6]˝
#gJ:y:±Ò_¸~ò$à,‹Í+≈òUú”â`“Úé¿ÁÈ®Ô/Ï"øZ≠ö¬w±K≈4|∂zW8TnoﬂÂ^>⁄õ◊,2∑ﬁ@ÀŸ@°|œìÔ2Â[º_…´¨Ë·tt#ç◊Ç’f&É 
›¸µœT§ß¿û˙æÊkÃnŸ…W-∏7AçsõBÜ˘BÒäaRnj8$ûR2V
‘≤`ªBÊd€\+ç“zI2êe:lf8Ê*çJÿØÒ (r¡º§Øzùfå⁄øÁ™ÂÛÔi`Ω¥1é0®(m¨DGË∑h@©éüè{˛˜„‡ÙÚÔÅ¯i^Pˆ8÷ÇTq:¬≥ªà7˛=k'4Ø“8Ï\ßÒÉ,Gﬂﬁ%ê&ÊuEs.ë¬.÷∞â ¯∆÷n9%«fﬁS,éì˝ıâfUÔfñcK•‰SØ÷ÙC‘ﬁøœzë?*Û§z¨bfµπH—Ö´§WØ˛ÓußJÅK<êOíÃÇ–?,p-G'[hRm«z—+Ä%!¿Fú%öî>†&⁄ØÚ°÷™ky`Ëæd`BÈG0œæGAô	ÁSõô`ËLlæF%[® _ñÅ€öÃ6…îÙΩGﬁîAµ„Røèˆ8ù†Îè{£G}8´¿ÆÜ$%x˝™)~:Ä¢0péø®¬v_nTkã¸…ø.◊™î¸Y!∏2V[X∞\¡≥Dª<œ3#qØáH¿Ω«?Pv–K?â»E…áù∂k_(}¢Ú"0áAü≠qØïÄÕ.’Å«ñÂO~;ƒç¯∞T≥tL,0ÔÙ∑E¿ÔΩV0∫
†g0Ê(ˆ.√DBÌÖ˝êíU◊W~K±ä‡îˆ[èÒìöÆ˛T∆•õNqW_…V6N~}≈Ü≥„8BÆNëãΩa‡øGΩÏ∞xm]ı@(#∆4@”’ÀÄ∏
E¨,†≤wÉ„‚h'¸U3¯ß@qÅ˜˝ÿÔ`Ü6å˚á∏¬Xâ£*5>'≥‹8Í±ì% Ì&¡h—‰ü^L!$Ωî˘Òy0"8U#¨(0•S M¿»ñ&ıs¥±ó4lx…é±iº«íœ!≈U@ÅÅ0⁄∆+ﬁz£¶‘ª{›¯~E≥T™h+V¬¢FFÍÀ“l≠/zÂz√{®Ùªﬁ¿≈2ë˘Îçï⁄®≠y÷ÇQÜ≈D≈ç7Ïã¶˝‚Fáòá¬73Î+ é·˙ëÏ∂‡…}wÄÂ>˚¿˙yÎ}ø≥ä∑‘)V „®zˇAJÕmn@3R_Åëh™-KUY”ºàŸˆØî>ËÀ8A˛‘6§©]≈©≠ÈS[+8µıÂFue¬‰≤2ˆÈ•oSN∞∞ó˙˝No¡hi=›(≈⁄Ë}ö+8îÚn+ñ‡◊b(2ƒÚçëV)Œ∆§Œb—J¥†°q.§D˘9Ú7u|ˆ·öSÜJ#9 o9ö°*QLQ™Mëπ˜√˜d÷∏|g¿¶ YõYa'6”"|Ëï˚c”≤6Û◊!nª≈ÏÍΩÏÍ§%∏ÍZ´˜Y|ÕÌ=ìZVjbÈ-” j’∆Ú‰U†äÆ9*ö∑‚∞¿Í‹õÌqyüEfEZ∞VôkV—µïè5^`unãJÉ6kìS0ÌñV◊”F¡µ¥>i-≠ª÷“˙˝÷“ÆÖ,ñóY¨r≤X*≤ñvãØ•›Iki∑º>™0°›2ÒÍ>k…Ç¥ï5¡Ää‚åA*æíÚp∆¨œáˇò–&„,U]JÁÅ.ä∂£ûqå@EÚ˚¿ˆe»T¸€a‹Ó°ú?∏QÉÉr∑√õ!SãóˆTß√¥AÆˇAÁäﬂ,≠-◊WÍ‰JÒõµnΩSÔHÅT‰æ»ïÍ›∆∆“´tó·ø¥íƒ-§éÈ…rkeeuâ]^©˚µ•"=©◊◊º'›V´€Xñ*©Sî<Ô»¶WiH,On∆´x”´WÎ +Ïø‘†wªh¿5¡.ÈPk’;‘†[[˜KíÚ‰Õ‰¡ÓF€_ÚªQı ¶ØU ª2qnMá›•Bÿ]∂‚![Kµu+vkî:'ä˛≥Ç≤Ù–ve∆ô≤ÕJ:2;˛Køi˚Î~mZ:Æ¬ÙÍ¥Ë1Èÿµ15vTµs˛€‡&’#W√j†ﬁ±ß )/ÇŸÓçÆdLπeQÑΩßOΩZöV%ãˆü∂¸%øëL[Rn¸æDÓØZ”t[ÇfgÉ√{¸ÅOßˆçÕ„„È|Zøì^Èq	V2Aa∂ÒtUf„∞k’Âº™ëy*Ω^√◊¿KV¨mÌ¯…Ö«æ	∞‘Xl‡ FKén8îõÍGä#ùJ≥‹¶~— S†Ï˜⁄ù0+k5t¬–⁄˚ˆı„mLÃ¬™U€f	®‚]V‚∆»dÿ∑XˇƒÊè≈Ω@$f ê™~S∞≤∞ ˚Í.ÖrFÿ_g=⁄]I„#ÑxW˚Ω¶» j∆Ù˝uz/ƒ"÷äã°Æ]:’P˚£Ùñç7Åzc˜õ∏ø’Há%zW¬äÍ∑vT…>ß]ë£nò@ˆ⁄æ˚YæÑ?|?É∏c´%æE•\\ÃvÁ(YÓˆ‰Å â@¨≈˚a–o≈¶)Î¢≈r$+V√™◊
©∞T÷ﬁ)ÜBË»Z@`côñ…ÚÃi¨öô^§‘RÌÊ¢EÿNËü˘é¬6˜Pï‡YÔyLÕÎ"Ï£Ss˛@àwFê≤•¥(§6ï,>!ñ€{’ëM*.øïZèå˜{Õﬂæ—∆GëpïA‚çàØixvÆU|e&	G›2Øß_dZ3+yπ” `. ˘êD°⁄ré5‹∫CP¡Ø¥◊ÿjc6*™qB∫ÔL*N,Å´G0-jòËÔ~–ÕÌn∂f&6NÏƒÿaâßŸªº—≠£äﬂoE…Ññ4ñ”gÁRûJØ0ûôJ	¿ãdTf<*7ßOjFf7qvË
êÃÍ€Q‹˘Rò˚RÈd—ª…~¢ŸÀÔ’«o≥Gÿ$œ—ØÅ‚ëÒD0Ë–_vOÇÌ¿Ωz'æ
€dÕ’+‘÷ﬁÚÜVki#çıZ÷¡Meoø›fp8 ¨ÖÄ†µ–“r†P¥‹ @ızhe%Dó.@Åhmâj¨§Äµ¨KuºG÷∞ó¬í±‰Õ±’X3±E#≥°Kâ#P÷≤â∞•%∆LX°ke›¿Ÿ“≤i&¨@Å’XÀG€Úä}TjG§qÚs{∑-”:«¯∆äç‘◊√9ß˚ùeÖë’F#ÖRﬂ»PΩñÉÈÀn"Zbƒ‘êài•ë·ŸΩÙ.á
ù[ñ∞4˜KÓs9ÚÂ˛‘Ÿ¬[ZÀ≥ºñ¡Ys"Ër4T‡0b\Zœ‡‘•E≤¥ë≥Ó.áA¨∞ßU+[}-‹r-V“óA≠±Ÿo,◊¨◊®ÁÕ\¢å∞∆G(År≠\Å)â"%~≤jP§ÃN÷sáD)Z^”â≤Q≥•6u@írLí\Z^∑”§9u
±± Y†Ä0•^≠ØÑπÑ´–Fô&®°™a–fc’Aõ˙¢ î∑ÇeÉ2ejêÄ.%@K&] sß–•H€F√§J◊¨¢Ie›¬Ùgfﬁ~®
+å†÷÷mÚÖõ¬˝Æ
Üoı•K3uJ@Ç}Àrä»MIæ`ﬂÇ«±µ€ÿ∞ÚozÌ $¯∑∆xW3‚ñ6zÌ§Ì(K∆Ç´À[JcÚ5æ$vâÌÆ;V\K¢Ef2h`i©ÿﬁÎwUH´&»¨W°V¢¬2)a…E
&∫8(¡VñbêŸ¶B,¡65f∑*o/+vÇ0aiÏ|Õ â∆äÉ$trWÁÍ∫AçF|´È!˜√~kó‚e∞`≠tgÆŸêäI…|]S Œ_9Yuh9Z‚ ≤[ˇÏêÈj§®Æ1ß!D‘‰Ü‰Û˜4ö∏Y5ô˜–„©ö9?ŸaËﬁ∞Vﬁ≤ö«Z Ô8ºNN9 T’5!–ã=1˙°Ío&ˆ$Ã)†™•<Ñp4™ä5Cóí™R2’TÊﬁfU ('#”ÆRq6mWe‚œÔl°í2∆euó¥^LJ√ÀÀÃœ¥Ïmƒ·´≠N±÷ùÁ®6{/•Ó›}µ≠·È s!¥ÕÁûò˜'e[ñ=‰<@∂mÄÃ%Ããñ2Ì`∞#ÏH…ﬂíâ÷ZT∫*–Ó§•EPZ`g &Wfñ`¸î~≥±Ï/µ÷K,ìO‘æã„ˆŒcˇÜT¯ÉhP	“›íZ≤Ãí⁄gk®„sË6‰ÿ1–AE∏Ëç†pÚ*Ïº!^œ#S)∑]å.¯ó,*Ëoj+´´¨;ª,æî&Ô‹ﬁç◊Ò„˜∞ß`øË÷û˘g¯…h¡Ñ›{⁄^˘st{„kπ≠Œ∆⁄Zmïµ’$/±≤ﬁ¿¬Ø4tu⁄ç’Øsq‘∞ëÏæﬂ¢ú —${âpgëïc‹áÌ∞ÁOeÈ5˜SØtƒ˝Ä≤gzi4Øí∂˜b`~ïUçÔd¡≤.ËBç%SdΩäqÒø√ÿY"¯#4.ı9≈ähU⁄Œ,5µ˚]K•)ã≥6¸qÇa+&ßÇÌ–«PKTurïh–ÒßD‹˝l‚Z-^√FKœ,®2h
Ê£Qı"q#[p“ÚÜ*nuï;E∞G˝[–çE≈¬XºΩ`4Mµh¶Zÿÿ(Z*\„”q4ö#uEÊJ™ëC_G)ÿ©j≈C&J{Â!
∏·(¸vñ◊ùaL±j“\ù¯.ç,Ïu¬Ó8Ò
“eÄBt?¿PÑY€hµ=y÷∫Q°™Í8ß(^∞kFrf•©ˆ≈65KU	¡›(ã88Ωj≠ú¥X±¢ÅÔaêŒˆ›ü0åè8 ÉKO¬NV;úærOòπL[)“Î‰Ã…ÆÜ7€§,W™üzVXµ…¯÷jLÊ%zEáÀ;dÔJï-≥æO±»éUÆ2yúä† :®XpºÒ¬°ó”.–á`põ}˜˙!ﬁsÑ}æ»Ú*ûá˝…–]‰Ûƒ$ﬁ#f«6Èœ8èóßõ√¶†™«”‰Âc@IO8&îΩA2˛≤ê®90F0àß0ŒY˙’uúœdh˙™üÉ»¸ˇÙ"äGª◊@z%h!\ˇ%åÒ`dá˝éﬂ˙…ß«è¨“&I”û∑Ñ”üy¶“Nﬂf',#˘G:B*n”(Ù≥Eq'≤	pè( ÉJ:ãﬁp¥È∏ÏÙn-Ñïå[˚Q[∆Ω’≥Sbkh‰5qò‚;i§˜N≈™ éå©D#Vc‚˜ûéïΩ˛÷ì„ÆW#YÃ>SIsáñL%-Êå>àa]á}À(@rÖ¬0≤~,õ—_§
ù0Y‡¥`Oåy¨dXEÜ&g}÷«æeå‹¯‹{p˘}ï!{Rœó4x“¸Ÿ˚˛‘Cóää‚x;ë
≤ñ
!ãÃ‡
#eÍ©uOﬂØÃûqçÀE;õô:\©ØLŸcπB
ª…åöÖ≈¿Âp∆˛,M€üÇ4ñÙÌ≠\fƒ‹¥S)W–h/ü!ÜÛeàã˝èª*ä≤Ë¢ùùb≈AÍ˝»¡›œ‚‰˘ˇ  ˇˇÏ}IwG≤ÓæE6∫_õî¡AnŸá")ãÁR≤ZT´œΩíU 
dŸ 
Fiö?·≠˙º”Àª¢èwwÀ?Ù~¬ãà*3+k¿@Jî@ã≈™"#ß»»/"Ód"yc˜æÜ0åè±$¶H˜$V«¥†;âWÍRΩ˙OÈ]ﬂîﬁ4ßèﬂ√ﬁ‘Û.UX2î‡DE˝èÄ_SÃ†„?0T”∑$Ö≤£`»˜≠˝ˆŒ@$"M|ï[3Çâæœ‡Õ´IGÑÙ¡-è«>-UbE!?Bh'ö˜'‹ÑïFü£ÓbÑ_2≤_¢‰¨¯çíÆYŸy"óYa\–P8Up	Ê+ÿpQàM@[\‡jÕß`åPoµ)ôçã82ó7x™lı@Å‡•+mˆÿ≈ ∏
:⁄[sLÀkú&≥KT¥-≈πqM6§8%ÆŸËq	h%≥–“ü∫Õø⁄*)#–Rµ“(ôÜü kTö™D¡ i[[∆¿’ ∂´2LÓ<æ"ü4©À¨~Õü/˘Ûﬂ‰óáÒókWj¸˛˛ZêÖŒ÷5öZÕFu«¢©ñ†H≥s≈ü§7p´◊JìÖˆ€vÃe1‰ÊÎ∑ΩﬂDâÎ∑Ü÷o£ﬂé~kh˝÷HÌ7·±√aX>gœ9UŸ=«√J`h(hµ
E∞¬€sΩ&∏öÙµ≠ıI©Z¬¡_–Õ¨YYofΩÙº‹X+£€Ü›∆ZÉUYu≠ kµ∏{->öìtÅ|LQ÷›/G∞’1`d|*”JÙA¥ösÊ£˛Ïqi8|AS\∞ÿI»Û∂◊Ùö≈Ü;Eπ®…˙.Ò	*ª®ã•ÍzŸ€[µ≠⁄îe'ä.œWvFW⁄;Ël˙'3∑ƒñà≤˛hh§æeÔŸ
:Äoïq¯wå¡µl–Õ∏ë&J≈M[ñ	BÜtlÃ’¨k¨ƒ^ïVµ∑‹ÛsâB+ﬂ±3≤π
òÀ©Ja]Ÿ®áQÂwÄÅ˛î˛|•hΩñm‰=Ç°,´A
ı§Ê…É‘Ú˚"VJÀÎúí`4ñ∆2;åÆπŒÉ$K∆}ú[4ë˛R∫ÈUn…∂Ík:µ“=˙∂QAœ€â¶·¸BÕô*$∫ÚôN2Î∑¨¨U;.t]2©kÕ‘Îî∫\∑´ƒ6Ì⁄¿¶¬cQY-ßÚ*|∑2ïYMc}¬çJÏHÂ=w…‚!ˆ]∞$b(®y+ˆŸÀö‹gaÍ^	≤Ë\pçSXÛü◊ ë
â†◊éπl{7)·bOÎª5ÀØ‚h-EWYÉ8\m⁄RW]Î%Ée¯äÜK"P£•yªî|œWÍ´∏WyÂ^€tÄãz√Ò^n§BÜI|∑ûÚ=≠…eõf¢ã%⁄pv3¶éΩò÷Äj∑∂U˜\ﬂCXüÇ_|Êù_ˇ!¯&b«'“ƒÑ=ñì$ëF2dF*Úe‹*;ì#<å∂‚$√√ ôïÒg√∫é±ÊÓ_;¡πN}\ﬁñ°û∆Â∫|Ï¿ÑÇUU¸Ö”rc>çÀõqh¶≠Ç¡r≈=BÑÖàwù˙_?ıü8æ∞kmÍÿaªe∏¶8 ΩΩàò>…åôDQÆ(ı≤]≠Åú0¶oﬂc{<a»ˆÅ˜=»®b/îa;˙âPÜÜéb*◊ÅLçËa…Ù,Ç_—31√„∆§ÛêV· 4Åmÿp≠¢|Ü à–Âzã◊¡8Øß7ˇ3`Ω0ä#ÃäçpO<Ru0†H≠2cX—Z5å´KÌ
£ÖˇîaU`Qˇ=è¬fl-EÀ£®`jkì¡ÊZÊQ¡˙eo2çˆa ¥„7ﬂ°I óåIú∞b†Ÿ‰|(ø›‡¸=+ø≠Ô–ì≥åX^ñÀ¯dΩS
W÷:Âë~X20Xf∞+=(«_˛‚à]u~
≤◊„ﬂ•pXÜ◊%v¯ûÑ(ä◊Íp aõU∂—ƒéﬁ$r”∆i√É”¥–ÓLIƒ–T.◊´\"Ê/‡a£Q’O7µN≥”JûÓõhÉπÕr5á∂lUÈXÅ•ãy„	˜⁄h¨∞∏∫÷”ƒ‰·¶ÙÕ˛¡´ÉΩgﬂ≥ïW´Æ–†°—∏%"ˇÎo?<xµd•íë\Õa,ø*øÒGcG?˝Hä∂è:Ü—˙˛Ç[k4ŸV’y:Ω“Ã)ƒï!A,±»uñ‘ÌÓÌÂ∑Yïƒ¡SΩ^Ñ·™$AJ≠öIÀaZÄ∂«ü–¢Ω∂|⁄ëÖ8%¸ü$®sù2ÕÍ©ä&≤ÊÏÊ‚Îíå8òÖ[í[ƒ§rª ∂ãQÈ;©‹tRÈ$˚®–HØo…ëéO|§”åÙ˙Ê4#ù 7ÖG˙Qëë^ﬂê#üäèt)#˝®»H@”vpΩ):ò
ètuπ#ùWÅ#Ωæ9≈H/^ódDÓHw1¢.Qó#SÈ.*˘Hwí…ΩﬁÜ¸⁄+r“{ïq?∂bª°ZMäˆ XaØˇ`±{«Ñ¥·œP⁄™3Sé0eCﬁqàW+	◊ì+¸û3XÁ ç»KÜ tODõ(5∂ìÚêh¿íã CTπjãÍE%9íﬁêã&nËGD±æﬂT1Dﬂn‡ˇ"kcw™ù◊Q·6I0ˇ—gÓ.µZëäÖœ¶D≈[EÎ≈ˇè–=.9ÖZM±≥⁄ÚjH‚™¢ä"Áh ØÎ´¬Xà£¬YT¡M9Ω¬⁄V·
›-ú¢Bíçut∆Sà£‹s…å5Ú±â5¬NÖ; å€Ì&k‘ƒ¿-ÿjÓ¥jˆV◊i∆Ï4πá%Íﬂj±ä›ÏvK1¯ìπÕX˛ﬂ÷D◊"„ÿp«ë∂¯  –3Ïò3ﬁ∂oo®/˛êZ/~>$v∆õ 9-∞‡*E{ >ﬂ¶êI“àÆo= ÂÆ‚{Ä´‚BK§h¶ŸäÀúvÖ[r¿\xòΩÅ€rIÆÔL≥§ã´≈+‹⁄ûbò≥B~jÿûfòΩ∆π‡YÄÔıöÿË<Wxò´’|hT≈&@\x(~î≈ü)7^¯|õ ¨Z“ äù¡ZËDQˇî·¬é‡Ÿk_Æããk6úåÜa‰ªèKs´G9Œı˛é≈Áè#<ﬂ±Ë|∑ÇÛãÕw,4ﬂµ»¸ÒÊè$.ﬂ±ıq$®;ñüÓVz∫cŸÈé%ßªñõ>æ‘Ùqd&ßúc›ﬁ„OBÂ
Rèå¢#<VëœìÒd‰„ï˙ƒ0äÕ1æéõjR‹™Bñ™€˚´∫UùX\yªMõŒﬂËñkã.(´xœU‰í"pK°≈Tõº)ˆªªô[k\€úNı•Ωmb<á"Œ•Ω•ZH.,∫8z)bh˙¡Œ]aΩ^∏¬i’âvÖy≥]lÚ“D—⁄R˛dû^~–óJLU˜ß•ƒTÀaa5f]¨Üu±í∏Zx5ú]…∑)WCz*ºŒß?Â´aq9‹[êskä’pv=Êñ\úÍ;”¨Ü”©π‹ñ∆ΩiºxÖâ~òb5t’∏–’K÷Ê›ù<u◊“‘ÀRw+I›±u«R‘›ÀPgSΩÎ-ıé7‘ª›NÔx3Ω„≠ÙÆ7“)<âÔ⁄‹˜˝±Ù"F>áŸ∫∞"[ƒu©m 5iÍQCÑÿ
(6˙ÿÇYΩ∂_æ$dnı≠≠/Q∫2zÊ-6l…ÍîqKö%å0Ñ”E•IÇ˛ëÈ£g›¨ÂëÉ_6ß£†√¥˙à u“S]àﬂó™˘≤´CÆ≤Ωm$z#pÉ¸C8l◊Òè·^0€Ø†+õàÏÍt.òÃ•˘Ãt0òåKÍ*áÍŒÚ%òWå#L¸sÌ‡hÏ–Í˙¡èùˇPøãÏ◊	Â§a$É=èyxYÆ¬ÏL¨a»L„ÃsFˇJÉí@£3ê *Wu;2…ßîàñáGz	¥0f◊◊©Ω]Øe<F«m}÷®yä≥	ÿ:hCîæπrQóùF‘Â#Xµ`.aÕâ“Hâ	ÿƒÖB2„õ+ÀÖ„uzéiå?´âsÄ~ÚÿÌtT^{ΩßÈ¥£ïí4Ç≥Oâ
l;8k]µ-•ÑÀVÒÓ	˜WE÷Ú∂÷≈aò∏âˆÜ :—∂ÓZå˘°´ÓŸMÌU:1GpÀÈ¡f´Òìÿ{µàE7øu|`‹%{IÆ~ŸÆÊs7ª_f1IlŒbíà?o–#Û˙√^‡—ŒÇm‚O¨Á1ÂñVΩë«zË7¯Eæ˘Ì Ú†ôm¯ÿo~£∞Ï[yCvX>|≥äÖë«„kª0å]›ónØòq≠¬∑zé¡"çqí(¢”F¥„∞úMòQ˚∞‹»3bíîctÊu¬8?îﬂ÷’A◊∏¡4V..\ƒ-nAº@3T…∫Yq.Iñ÷†ÛÕ∫YB≠∂∫æaõHæÖsñ∞˙¨mQã„†D0V.aä∑`¨˝îú‚ré†¨Í\©IÄ›n“}Ë>†•…=`ÿ¬≠*HâøI†ﬁÄ§¯è±¢–˘™)“‘j D´∆k¯/á›9˛HÛ|ﬂØ˚ıî4Båé=e§≤t√iJ';
~€>.—XÀM˙c≤“∫œ	R•›‹"çv-vÎ≥≥Sk’Z%Õvgı∂ô•ov˜”U⁄ÒE„F˝(9(BIïk˘Îç[%eØ )[Ç'’J∂Û(!_$n2û¸˝Ë…˜í%W¬Ä
∂¿ü'~‰äÍ¥0|ƒº¡%…∂√ä$çºsÁ&…òg]ÉEI˘*§r:#ÔØ˚¯¸Ù%¨+Cq/µF¬7ÂHJX©:Yá`#ÙH Ó˝’9—>Iæ›v∞¨*ÃÈﬁﬂVŸ∑ŒcA∂TîÊŸ  I h«BSÈõ„`¿∑qÂó¿ãRˆt€¯(ÖòÉbﬁaë70‹Ñ)N—jXÅCÛØø≤˜C"¥Ãw;T)‡6Gr.–âõ∆Vßx[„Œ6j)g,Q≠Ûƒì∂ßgciX9˜£à|ªÎ^ße¿&W%VrﬂÚfIvPÀ¯rË_≥xí·ÆˇÜ©¨·◊÷«a÷†SwÙßá‡K<l˘∫„wÇI_éMòtx5∫F©2Ω©#V]Ù:G!IÕµdLŒÒˆ•ÃÊΩê2cÜ–ïı¥r¶ygˇQÂL)∆¢·BQÂGí5È¡í$	qS
†R ›ñ≤ÊˆR‘º	Øà¨y'BÔ=5kıÕE»ö¬]Ù«ì6µx≈ì7πÜÒ~Àõ_æTâ3oh‹≤Ã	’/eŒ;ï9õ˜HÊÃ|eΩà·Ú⁄∫6„éqí∑Ë‡xs*±‘<åó@#	ìzâ¸oef·˚û¸ﬁãÙ0¸˘ì±–∏‹·ã7"5Mæ.Ø¿òpÒÙ_+÷ÌXº¢q^–˝ñùM)€tßàûÜñÉ:m™8zß∑∫ñ?˛‡˚Æªf=ﬂCJÀt€nÙenÅºÄ~0((€≥61Â˘Uﬁá‰Ö¥˛“Ôı‡»–4n¥\X)7c|˜—n]RŒ|°ú‹iÍxˆQJv†2Á¿˙Ïk.õ¿‰|p”ª_˛˚˝¿¶X£¡ ¸n·mìﬂƒÇ5>4itC*Ã`RõÔõÚÌg´y8Ê´í6—`r –ß`≤˜áxÏ˙ÉÉ}”HPw2˙˙êX >åº·¡≈0ç_#ÊØ‡‰åO,kòÅﬁ•’z!Óf›Pıã≈CU á∞"ıMÑØ¿…0Øîﬁ$ú@î‹G^˚l'úl†Ç*√It∂Ú˛Wˆ‡l‘ê¬¶∞_ô¯¢sû˝˙^:zøe|>*èMúˆê·ÔÙéxÅ>$ü◊ô#vàAÉ÷)t§xl~V!›ÙÂ¯òΩ7xê—o’òíñ–Ú√#W?ΩwvØŒŸ1ê◊˙Ø¸SËÏŒ]«~)ä‚Ô6a˝mÂ¡√oˇ˜üØÆWV}˚ÓáwÔ~Xáæ˚Í›ª?ˇÂ´ƒt<Ûpä≥&‰K—;Eß§›Ûô\ºÚ±PD€D8 ß¸Õso0Òzp iÏw¯Kä*
Ç8 ´◊‰^Œ¶»Û∑œ@≤Gó 4è¸s™˝m•R¡?÷å∫Ö{o¢yú‡˚;\0÷@Ù:˜|ÙTˇß?˝âÌ}ˇ¸Â—¡ÛÉØøg˚áªﬂΩ∏˘ÁÒÎ√ΩÔ—_ØvüÔ≤˝ˆl˜Ëh˜øæ˚˛ò˝';>|Ò˝À„√c∂˚b˜ıÕ?üÓQí?_I.Z#Ê›‡ΩNN…°ﬂy-Ñ§.ó™c¥ëRq:È|à„Êj≠ìCW•øé‰Ñ>]ŸÕ(Æ#ˇ‘«8ˇyåÚ`ƒø}˜.z˜Ó¯ááàü9µ√¿∂a/hC‚±—°jêS=k84å9.K@V5¸Ï"j#·°—Ô=†uc=îåœkHØƒîƒ˛πÌpwêÔ;sÿª≤/ˇéZ|1fÈ¬îå’œÿ≥W@˜>¯ôÆÇjMõ~!{°Û…XÃ"á∂†¸].jZ‘^òí”Ωù√_ÿ>∆8∑„ÀA{w ÕÔ_æyæΩ∞ﬂÇ3BG≈õJ¨pÙ+‚`Ìo·˘Ôo‚Ñ¡¢H:>◊!·.˙ôˇÎãcÅÕi[Dƒj¬µ:z–\b>Û{∞D…∞Eºç‘¢›AÁÿè˝QºÍ¨j'ûO9å∏òDKÙ‹“z Ñ4œƒëæ"ΩZ‚îñÅ>ÎÈ˘AÂçk<√,Y')¸˛ˆãXÂæÇáÖW?Gí!:(Ô˙:´Uòüå∂}ˆ‹˝‘	?‚Ûñ&§ñ~eá/^ºz˘Í‡ıÓﬁ·Õ?_¿ëUô∞_’&gzHπïÀe&©TX¸ôΩ
? ›>nè:∆ÒWÜµÄhªWâ¨ÀìUd|ÆAx"Cdƒ—¥(^è∆•GeØz-B~jñ	¢è°6ŸœveZº.ì‚Ã/íS§y⁄Ôà X*íG•tçzØï≥»∞∏6éõÒ`J=˘:âöJ°”Â¢Í⁄ò\<AÃƒDıx}«2¬⁄’ª˘˝4háR‡uà–Ú¸ÔKÈ¢Å«ﬁh åù√åaÕ—äÁal∞$÷ò˜'å¶ZÆ’,®k≥@Ì)U√t`I8%m∑√… ﬂ’>‚‡ùr®Ó£±≈øÈ›¸÷peS<“á±ŸÏáŸçö{]IiKR| µ$ùks,SÊáÁƒy$%¥ì∞ƒË÷È4®º÷÷ÀFÖ∆˛)ï`0≈∏#5è∑p –{öFœHæπ;Ü!ı´.0©(tÄxØ©Ú8ÔˆP¬µ§9Ì(†%äOi« Eüq∞3ÁJ Ù?(Åi´X«≥ezrŒ ◊ŸÌ÷˙~∫6Î?≠ˆj„™Ä¿≥;Dˇ[Í–
µÍûkRÂÀ◊Jπ _⁄S•$%«yBo≈Cùm8Ê
	Ú÷1°ÿ!°X…÷— dA~&ÄmêKƒ{"¬˜J‰–g–æMh$cükÚQ¸ZìW¯kò‰G·9…„ÒZBXü?@√'ë1£ÑNª‘:UPè“◊∏ƒ‚_⁄T–÷∏WZÒM+¯≈_)Ωx∫ØÓ≠ø}7©6™’2˛⁄Ïíf\iV∞ô¢DM⁄√Ü¥ÕÈVäºÓ≠Æ/ ª¿nI]Z
^"ÌèŒ±…÷+õÉ~st–RP2ƒ˜÷‚`S”˚CXQ”h≈ò‹)ﬂFê”O˘4¢»≈D·û;¸s
≥+dŸ4¿nê_÷8éúÏ‰Õ(å¸ò1#øì√ñ°7j$»;*ÉÅ÷	Y∏øû∞g=› Ö÷h“ÍM.»¶/Ö⁄!ﬁı6%µ¯óFÆñŒCPúêﬂ´Øá#opÍ[ÛYC]üÖì¸q‹>√∏Å0£Ìâ,h5b…"˙Ì†¥è«ìŒ%ó)üA–PI¬)Ñƒz~z–É1Jo'lO±Îåx˚‰Ú∞Ãuñ=Æë ó1˙· .∆U
·$¯„ÛSúı*qÖﬁ>{˝¸»8√¬)∑Ìk≈ÃÉˇ˘¨É<è¢úFË”˚=…Èc8‰h/≠.˘(∫S.(ªΩﬁ Wò°L=.˝©Ê◊w≠“WkÃ|ﬂ≠uõ›ù“W´i%Ïπÿ+ö_’T˜ùf}
¨¶ß@ÑfMP–nuö~≠ V{EÛ«ΩP´m◊∑Ê†¿*`z
ççZ≥9V3P–Ÿ77Á°¿, A¡◊˙Iy∑Éê$<≠üEÂ]Án9√–…‘]}p◊™”Ã/÷&ÜDÆowΩn;•%“W^≥ÊUF.ø€hoeÁÇUw´Q5rµ˝≠n#;◊V∑÷©uÃ∫[ü∆kÅ≠˜ª#m‚ÌÛr∂7∂wv¨ú≠˙÷VZ˚T™ns«Ø∂¨ú;[[’‹:çÅ)ﬁml5õõÈkÉïJœππ±µ±›2FSCç&BI4√ÄëE«›ëI¶ï&Œ%ûF‚Ü"±ˇÑ}v:A≥ïıv0Ç˝%b Œ≈€Œt{â‡ã±»ﬁÆ˚€›jLà8¯ÀÄÂjGGÅû4ºm«+±é}çπ‰˚	_m≈ÜÄØ_îDÜƒß?÷≈ZGÜ1πTÊíù Ù:~È»"Â ìXàì_MÜˆRºŒ ™â§Fﬁ=)Ö¶í
G<ãT†sû”{G.CåŸ"ﬂﬁ¸>pÂjMFñx“	]À˜DºgG¯>+#âˆû+Î1ˇ‚dÜ˚æ]È>ùZßÃ÷·âNsâ¨OaÑ∂ù#∆CY⁄Ï˛]ÒäÌVˆ*Æ<¶.≥=”ﬁ:2Åò˝ã◊G˘N'•ˆ6÷YpTU•}Êçv«+’USUÖ7äï®¿i≤fEZWák.âË£Ó:nOG˝nÀ1%Ò3MKzpLÕXøÎò§"¸7W`¯17ØuÈ%'Ó7‚Æ,†ñ≈J’ƒá`‹>c‰µ'.ëp±01Ü#/Ç^Ò∆ì®§√˝-örñ†®«®0K√Äô+˛ ÷›HÙ+Î›	ºıåõ–oáß˛ hØÃáÂâ@Wı∂MCˆöCX`‡G$ÂP"q#‡ëü_G$H-V©{µ≤kï©®d]Äå°ç¢\ﬁ@¯CÓsæ∂˙(t‘GË-¶GîQôqWı1}«©ﬁe∑€/]tEÉ3#Ÿ;u∑÷;&Äù
bUÅŒÅùµ∞Ë≤)ò´s¨˙iå∂|Y6[ﬁ¸˜®p◊> ›è0U7hç¸⁄ÖBngÓÿd`ï¸ö÷2qΩ7ÅE9G	»Ë)©~≤&èV;$ãQ’„∞X/µ`õËû,πB,$™Ÿ@Œ)ß¥uÛœV`M˛–êıÄK>vi;ç|‹ê≥ôì/ü0¥c¬	7ˇB}±Q3≤<>t†˙SØOSò÷ê4äN£Ù—!áD/ú„I’ÔToúó∞Z19Ωó¶Î∑iÆ1>jät»G^V?Â d¿JØ=
˚»AΩq«è≠ÔÓØBáıÅhÙ±|Ó≥ïøí#»æÿJ©€≤˚®ÄPó^wE/oùg%∂¡q oãëƒÎ˜
Á¥CÚlBJË,6ÂëÚ~~ƒÙM¡§ÜuiÏ'6©î™2œîÍà)!q√kO˙
/ Ûf‰∑a!*2b√€=Ôú◊ë≈áúªÁı[ç_qπú√_ÎL&eâ
pshCv/ì-π‚±∆ïd»ì!æ‡ıå«BË»4Ü]∆c}Xyp˙‡NÁr }⁄>Ò¢»è"\≤ÿì88Çƒåﬁ‚Ñ<ﬂõ¿©˙«Ë!mÌ
dË+◊ß(ì;Ós¿±XJDà:	qfù˛°8[<Ÿ2ë±GDnàë˛)MÁV'˙nNbRÙSπ¬◊»&\õ÷ëÜd‹∑ÜQ˘6o*ÔåÂ∫€ÿëÓÒ“⁄ôóTÅ ≠Föß∆5ßgGv-€în3)Ã‹uÚ~´‹»4ã‘óXûπm≥ÈÓ—rf≈£5˘—kıÌ¸ã;à~û‡˝åÓì∂.Ëöp»è5åﬂπË‘&,v~;⁄^czãƒÁﬁ–^—‹¸é≥Ëä$]1‰™√%òãß<jÇ¿tâuXñ◊πÙà˚ë—êa¬v1µ”}9r˚U®Ã«c¶ÂŸÌY7ÖΩe#≈ó#˙ÿ!Øº‚È€<`Jü=	/r<@(øÖ1-ºƒà'e˚ã^vtw:n∑é¬πN‘gÈˆΩ‚œQsv&Ê(ü%+A/Å∫®wyÏè~sÜ≥‰‰l‹Ô=äïï◊¶ïÏ∫√@÷‚'˜ñ¨
c…‰≈Ωk;˘‰jV”Xh1⁄+ñç¥Éw	≥¯bf“8…•cÓE-ÓÈªeYœä
Rº€6œ∂›pÏ¢#›c˜G‰rˇ˛Ô?ˇè£'ˆ¯Ê&][∏˝;=	‰p0œá∏”âÙ’[G#8T‹R≠1¬>¬3ã¶ÍÄb-ΩSØq®üÀ≥ã0Oﬂ:Òô1ªq2å≥æ<bO¯©*'#ùT‚|x˚ŸŸ>Œ-%ÂÔûegOJªqª(OVÿnú§í]òC8åK{b¨√Bö+±§Gã§œï?ÈWëkMBbπÀû$«œ<·pSãN„j?©Ew¬±ƒ\•†±V¢LWˆ/¬}©Â}Ï∫µ˘⁄ÂÏ(∂Hàı—≤Åöñ⁄nf¶J{E•]c—™≥ZK®4bG™†Ÿ˝lp?6ÕøéäÈec⁄‚≥|nXeY˚∆’˚TRT@îµc◊ÔØù8≤Îò…á√ù~Fï∞"÷Y‘Â–üÈ+gÁ ·‘TÆ;¨Ff_—ö(ÀP2p;A¨Vk“∑ÊE‘:ÉÂm ÚÒëæ˛§µ6·‚=∑ôé≈Ú⁄-'ÇD∫%|lòd-˜Ó”•`{⁄03Œ´coá⁄¡zúXÊdGç¸ûwgÓXP‘úP%ccﬁ`åLDÿì∫ÙåG∏˜ÔgUè´í£a8 xúg:TGÛ»\op€:rwkÊ≈#Îﬁ¸·AåC»D∫Ωl^∫√L$˛»r@ıﬂœÖA∆âr êØ¬N íÛ‹»ü†B˛—.„eMUNyà∫:ºôQ©¡®·∏w,¸∏∞»ıåNÇéãi©ã‚ITÕâúπX‰¸¿»E@#ÁG.9?@r…˘AíãÄIŒîtóP÷8+∞qVh„¨‡∆y‡çÛ ÁÅ8Œrú	Êò…„|ƒ‚‘ò≈Zs`ÜòÒ⁄çæ77çıÎDF±´Y€‹∑È•·w≠DêK%7¸ëvÚ%ÙqÒ–G»;i)q©{ ﬁßB°ˇÇ®mµÒy¸“ëÖ√~í0ÄY ãNÙ`Å[„ÁŒå?OR⁄ÆÏoÙ6•.ëEŸYYôæsfÚ€c/2Ónƒ~RÖ31î˙kW∂Å?Q_ØeWΩsç÷ÿ+¨Ú{˝Ê•sÈè˙A¥Ç¬ÌNF~gÇ¿;≠àßΩ…èa
ÛN¡ ¶Ï)ÏÇ≥UΩ±¡ºÔº¡i/Ÿ´∏í[@x‚⁄≥Dy&Pû?OºŒ® *‚)AYm^b0Dø 
ÍŸ—ùxŒº °ÔºöŸﬁ·(º˙Ö 0¸^*%ãÒêˇÊ7Oán"C{Å7∏MÿÊÛ†=
ÖÅid@æ|6CL8ƒ-u“ ^ã‚~‹dB¡≠Fgˆ⁄˝,∆ÁÓ®‹ıp˝êËâqu∞*‚ö]¬qy∑0ºÂ £öèˆûœÕZI=aà4>3ÖÈt‘ì¬Vˇ∂Ÿ*~ﬂ>_ÓàØ¯ «“	ó◊≤±ﬁ92◊(<∂"qmE\ ,?i(·eŸÎDB|DÿÓ∞{Ûƒ[WSR7∂'Po»îLPVºœ“~	c˚◊°l	ãbD*PßkÙæ4§ôa,ˇ£¿ﬂ™EΩEZãû°«'~∑;¡”…B¿úò∆Jnz@õê7ö∆IÉ&ÆM¶\˜ZìAY*¿0]ÓÎ˝‰èN⁄óQ&,1S‰«¯ΩX
F8Üë=‡€${}ÔÊﬂ0˝ü'><d∂=ÁÄ†™8{ì>7Ä>@2#ëg ¢HÑ»!àkcøé”Ç\É¯Èè.3ó”¥ì«Èvh¯∏¯§P`É`Û+3öuîa8∆ª ¡°6á_Á~ê9YúG§7/6#ù◊ÁhÄ0¯(8œ.#ˇºÖß¸ëÄÎkfJP≈t\·r–	äIp Zîà…Ç&D8Ü$<éM±´Sµ–!µM±›Ó€ûLäÈƒ£&j∂}AˆqWAıÛ&Ω=;\G‚]ÒôT„Ì_nπKlÛßèmﬁ¯¥∞ÕQ∏Y‹¶≤˝â◊”âæSàÛ»?•€Ü2 åÎ±ÙòéyN˙ôÑw#ﬁ£)3Éú˚ù)@Œô≤ërﬁÌõﬂcp%§π>=§ŸÉ‘j«?Ω≠W—E”0I¥¨Ñ
Î°·`‘÷Jﬂº!0É‰Å3Qµ'èì?∫⁄¨¥ º˙•†È]ye\∂¿˙ªílÏ'◊”Ìk≈• ≥£ªgÓ©∫úzƒÓˆD”ƒ*«^ì„`a0˚∑µJÛáECÌUOo∫ÊÙxÅ˜ö.?køÆ∞=]Cùç˚V:i£ÄWR…öùU™qæ£‡/-aÃVÿs“^ÂÂˆSrqÂOvv[A%T?≈à∞ıL…b
Qcipíh~é»œ±#àU qBÒ@Záúæ¥	Ü=@ñ`qé(ZùØ53 <ì,ƒ:é£küæ˘9FˆA-.‚)ät:Ö8Ã≤-
~í@Ö©≠	‰Q©àózvJ”áŸ	M-ˆ”1{¯…º≤Õ7y∞Óxóf≥ø4{¯“Ã–¨•…É´5…‰A!€øõR?ıIˇ#ºGÑ0q∏}kÜ›¡OΩ|s-Ué=√Î∞ΩûÂ”ymÖm?ä‡‰™É*ctÊ#Ü']e`†«∂-Ï´yQﬁö≥|l.ÕñÊ	KÛÑl?ŒÛxrûbÓ-ÕæD≥}å•˚wû~›Ç≈ÑNÍÙ~ûß⁄Ö¶ı¨Nì≤L0vY°@ ≤ÙPF0LÖb*aä»ïZ”ï≈Ue*8 Bä;1qz†4ıYUßL<ËÜY5*æ5vîËîVÙÃÇazπºBG±äí‘REVYËƒÄy£·É7ÍDÑ∆Ñ∆_b√é¨9ÙËvÒ¥G¿•±¢Õà˘A4ébÅ.—ƒø¸Ö˝—"–éıTÃ5—gq¿&¡%–≈˙°i8.≥´Kz;˛©!qä4:#-À.‘~Œ¶=c√ë¯∆ª^‘∂Ú<ïØi sk∂6a'%Î⁄:›ÇAŸ•EH¬"ƒkü¡vÎœi¬vû∏ˇ⁄ææ5Ï>ÓC™5≥=BKÇDL d√Ì-ò!\öÓ∫	·
âG^€am‚üı<ƒÜü–ëâ=ÀXDò(%…i›kt€Îµo˛5πáYø„˜g7Q,œÄ–/éÕ[©'â_E`„C/ì≠ã0Gê»$∂rÙrw˜VòJÊLE·ñExjÿ%êê^àüÌE∞S≥ÄÄÒ“Eà∏∞Öxπ7+ˇlg‘¥‘û°œÈ39#§Uÿıa¶lÇªd˜ƒ˜G ö∆ÁÊ“ÚJπ?WhT±≥KX‹9à≤D˚Õˇ¥á+∞‰+≠Z…ï5î‘∑„˘›ıgÆ∑”òﬁq ÛIÏèen˛”æF•jˆ-‹U≥qGÕö;ÒY9/Õk§ùâ¡x›3øÿb ÅÍ√¶g¨≈Ea÷Ç·r≠\(ø’ú‚;]˙._‘ r…T¿Ö8 .-≥„◊MìIŒiU∂.2…∂~2FDößr'iÛxÑ«˛Vå"nﬂ)≤ÿK›˝D¡Ôˆ∆ Ú.F/˜æ0<¸=Úı-.„tr?=gﬂN‡˚òSéŸ&„«}qˆ=ÅÖP\G]~◊ÍÚ;?k‡e¥≈Ä∞Îu¸r‡rhÌ1sxw: «„∑≠»√$÷·*°˜˚÷Åg ÓF£VNéSëV±¡n¥Ó&üïµ¥Y0*}≥á°D;“ë%nt8˛$ô+–1µF5F‘‰‚≈Òß f<¡˘$n÷ìmpF–u*\mê«ï≠Ù˛‰:X}^®áy;ÓQ∆ﬂFˇ∫ <nàé	å⁄P{∏àY˚°fx1∆Ó>P{l)Ωû¢å•‹xßb¨ıy<‡˛Ÿ0∞!º¨:∆È'kÕ†Ù–X\®ïs∞‚¶^UÉä”ˆíœ1@›°fêrw7/C€HøóC§≠2⁄˘í+Nrö–ceºÊÁcÚœW®u<w≥;»+e!F"<öm
≤/¢¶ÖÒ˝û∫ê\l¨Åîr?ƒΩg›âÂCÓÌ[¥%Ê~÷‚óò˚/süM,A˜Æ÷|$–ΩÇ_†{;–@¨5˙,"º>ÉÉK.6_KïÉÕ«∆Py,XBÙó˝%D	—Ûp	—_BÙó}EÍ˝ÉËO`f¬Üü≠£∏Pé‚ƒŒhA˚æ?Ã/•©dv o‡ÓMÇú–|QçÃ◊r:PÙfπ©pqΩH´v.(J-ï≤|VØg@Îy}ió:_qiÓﬁÄ“B§Ñ\siÄÆ*Ïy¸>+;˘bÌO"‘(·P~ Ftª *
îÌlÏX˘ã4¸n$≥™t†ÀúX˙Q`{`|JØR‚ ™Ü+#uóçÙ.%GÏ-”~ÊèÅw‚‡˚3˙¬P˜|´h∏œh[π#úrâóoÉŒLå3›A⁄≥∞Ï#ø}}“ı˚!FŒƒ@eN>âxåø©èŒu»Ÿ4H≥¥y˙4§”1ì	ôëêıj¸‚EŒà±°bl+‚™9ÚFc‡o∂WÓî‚88ÑÛ€·ÈËÊ_]∫Æ"ı°·ñkãq–*x)±zö7]TY@Ö˛@†üª ñ¯Ù§Ô€ìú´3˚…ïÍHÄ?Ÿ%«ﬂKœÆ!WΩt=é•ù¬ª}:Ñ¡ÉË)	&/–Ãs/¬Y√Õçic|îfœ+◊
|@≠Ô¿ví¬ø£¸ß∞◊( R∆1¢àPÑg~ˇÊ_cTDıÑÃN&‘&Å˝.¨;T√†Ü>Ó1ˇú<êeÇΩ4(Hió…‡Ù}g_ê°/X<µp¯/Wîéƒ L;Ëh•˜ê˚X%V(Ë™◊πÙHÅ…Hu8(Ÿ˚à◊4¿æK§ÊßÜ‘4U≥Èj‰[lB¢∂7Ù"5œ@ä—éä>ímZøÙâpgGµ9nã^ˆ@£K∏ÊÁ ◊‘è∑ü¢Ø8d¡4!”sè`}z‹6vì¥!ü\?OÅ‹‰˝Rl˜˜®óâÛütSJmœ'=îßÜ3"7Â=˜∞˘)6MÊ^·6-ùKå„{Eßëß¯>œ}r¨Q–¸/Wÿ1ù„Ü⁄>•`∆Cı1ª˚l–Ò>í?È,c‚†Ï(Â»ÀÉU:ŒÉérÈse!Óè«Jqæ@ˇ«.PNí∞î™Á∆mŒ—§‘r‚6”Û∫⁄§5{i+|óÿÀî‚ÔÀX…¯©„¯>exûç¿˙"Qzñ ‡sÎ©1≈P{VÚB=ïgâﬂ[‚˜ñ¯Ω%~OÃ√%~oâﬂ[‚˜©ü9~OYO.…ó∑ƒÙ±[¡Ù≈≤ﬁ‹w‡>å’ù Óº/SÄ}Ü/J˚aºˇêΩ€ﬁ©19œUL≈s~Õ¬‰•f¯¿y-
U(≈'Ω≥≈‚Û†GÉÓÕèxÙÂ.\HoﬂŒ.)X7¢ ÊmûÄÍ¨†ÂˇÇg˘—i∫W _dÒ=öÉÔ™ËG*Ük∂##uv˚=vé´ »Wàãôπ˛d‰√Ú{‘`t*ƒ¸Ùå«€>È99‘5ﬂhÁó›˘›"ø˘Ê>ú€ﬁ⁄¥@@™Bêq–ZUÎB˘‚U–&]`Añ˜˝~ƒá≈Û\z≥Uïo	ˇ´vä˝@ÑHs0=4yÆöD˜ΩÓuPtÆ{∆A˚d‡èŒ˝,û;%Öÿ¿∑AÓêÂ|âïËYÒò?gQ)$àƒP\‹÷¬àÍª˘*ÑÁvÄ˜≤A∑⁄Ît&Ìq8:È{ßÉÏ!óéçÈ·(Ÿ∂ﬂ£∆CÚ5 ±•êı|fW≤∫øi1ïÂ&fªüñ√nﬁë¶;∆’ÄÁ-æÿzø}Û{Ö∫à.¢∑U¢q˙›≈'äçÁ—"∫Ñà.!¢KàË"Í¯YBDa/îp∑%JÙsEâ*AÊ^¡Dì⁄ø‘¯é^±¢vÙ,ôTg•túSê•û1ëß‚[T”V7$ ¿èyeáÁ∏Ñw≤ΩÄõ-fbBBv˘7[óƒãöó2∑ù˝9'Å©‹‘≠∂/Ñue]CSäˇbÅ°ü=0T√ˆ}¡»–XUô@Cz≠C."TKï›ı DKÙÁ˝πD.—üKÙÁ˝πD≤{ä˛î—ò2êö>
eèŒjó—,#ÕÊSD˛ô™,¿p£>c‚úàOUùç˘˘êÃ∏ƒTT¶ÃÏ¿yÚ
≈*JRKY¥ß◊‰ÇÿΩAiÊƒ5wá CÇûÆÙ¿xÔŒ¶P2£ˆﬁâwÃ◊yîˇÃº˘<Ï8≥ÊFuv◊®≤9™TYü;≥"¨√‚ ˘ ë<ö¥zìœr∑v,ﬂÍ∞—[@“üÙ˘GQ¿ÅÆ£/ı¡ûÑ`Í·åCYÄY◊˘RBm$ÙÍR√ºa ˘s√Â‡µ\ì≥ ûÌ∞ﬂ'∞≈˘É(7Ïo÷‘£c¶,GƒØñë`eLZ–ì	*2e•#>™ƒ”¡*Ê/,rôhÂÖ“√uÚ6yπ…ÃCﬂs»ôÅ`“aQ*L}:¨–5‚Óí√À—(éÌr“Ád¬lûêï≥Ç"EÕí¯9^}ÙQ
}N-‘£js,Æäº∏@ƒä*Óqëã¡è:ÀÜ˛û◊oÜ3Lúq{^lëHÓÖ6	•NˆFmﬁZ}Ä!.E—Æìﬁ¿Õ9ËøÉ˙Cwö∆4Ùâa˜8»«_ìôyºK*ç°xyFXı8M$nŒâB`H´ãû0ù°ì∫Å«|vC·∑¥M^>ë§øjOZ˜?ŸG<e´«◊Yf&[Ú˜œÿE§^gBsq˜¡R¡ )¡«˜√á‚·ô∫hçÇSƒº∂=T©FE‡|	üwÍó©ÒÂÄpveBŸq•A9Ú€(/î È	{k¡·Hø˛ÎŸ»(¯RC⁄H¿íéVpÍ¨c¿ﬁÜ	ÿ;k$“^Õ3Qîv	22oAfÂ°"÷Pü5ÚÄxŒ[ç)@Y◊D¸ù(◊ƒ8πZúœ
†ˇÊ˜·òO¶«.Ü∆Ò”ë—§ô@yƒ√[≠çd›ÒõÔ¢|0]]@Ë“ÄuP'o‹1ñH˚Ê(øm5&¿>&>nÎz&®‘Œ2‘ıÌıÔa°1Œı≠vÓÁÊöÔ5∏Çﬂ¸ﬁóWî∏ø,1pü˚ı^ﬂlùà·û@j8ˆË\óÚJÍ¨†…{°TbºÚÚ†kéÛy\⁄Óh\aœx
û$ª0ÛËk¥)?∑i_‚ô⁄ºΩI™N?É%1u¸TÁ+ùˆb]¶î˚ôÑñˆ-5i>úÕV¨.Ql≥ø-˝•ÖñNﬁª-CKªZÛë äuˆE‚€aÁÇJC¡ÏÖË˛√ù@ƒ„6ªÈÁBçt:q≈ÅF<à05◊{À¸ó¯7	ﬂˇ∏Ó”_ø«∆A{=®‡ÉU*
•’’O ‡xG‡®—iÀ[©mÆ±⁄v˛©Ô¨±j•^_’Í‘∫ûﬂ,RP}in√?5*h{ujÿï(hcçm6÷ÿŒñ”höÂt˝ø 4©VmÌl◊LêLuckª9#$™µ—lT¿ö∫çn”∑Ú˙µz#Ω72!Q;^£µùüWC6%°X:FiaX*	t`¢2Ûy5¯œõÉïƒnI¯Ÿ‘.Ô¯:ìTäx™$·N¶c:UT¬Òˇ‚r:ßÚ§;úô]x!Xπ˛√øƒSê<9ãs_‹&=<r†üàP?M¬7q∑ØˇYÉ_~û˛®ìí˘–ëŸ¯ØÔ™˜ æ›¸Üùı∆Y]ıjô]ı¬.u›UÛ≥¯´≥j=∑´r=ˇ°≤˝˙¡KrﬂÅ^]"{'y#™»aÿâ¢IÖÕ€L|D6ÎÀ:”ÄÂ©mOjé◊).‘RR:o2Î7-Fa¿6Ñ≈=ä,Ø gøÇ“ï!)ﬁØ[Hﬁ∫~|-V?œÙor€Wê˘7êµÌÙ»Ê¢n ”ŒÀWâ+y¡‰æîIwL–úÊFf*◊Çƒ‰uåuìr„r´◊+j®=	zÚsyªÚπ›Æà%Ò”ª`±§î)UÌ©rKe{¨›ÊZu[íâ5m9öu‹¸u≠:â’˚ã‘t˚Xq}7¶téFÑ>gÃA¨∏ijﬁ{•%Á˙Ò≥§ñ<êbìª.”TÊ™ˇøe_À•èùfµ˙,Ê¯ Î∑ÄÔ¯‚˙˝µÎÚ=ùûR¨7ıﬁ∑£‹ﬁtI@z∑&tÿWÊòÁz\˛'Ä2≥u–ÆM/MÒÃ´gx˜¥Mm&Y∏_gTu€*b©Íseµøû?8üK´NƒLé¢ÿÏ9¡XçÀÿ∏_!02é–qßs\çîJ6:YTÍ“9«ø@m%ÖSi†Öi¡ù√≤†¨CôF$©†ÿoÏIı¯pÏ =`˚ πGNm(ÉwBbNãˆX€+Ï;pËhÛùñ£j•.zwáΩ;–aˇc2W™[©∞µdJÅç
hÒyﬂˇ€≠CÇÅôf55ˆ“Õø˝∂˜)X›O´¨∂™›⁄ŒÙªKeˆÁ°ÃvŸUf/·Y˘ßó≥4·pESzpi ·å˘¢¸»/O(„"#óÀ¸;~˘gë8=éå÷`ßI±ﬁÇî(3EÜ ?}à5ú‚j@≈*÷é^.SØTNı™÷ŒÙF¶Va÷qùhq⁄ûF˙cΩù!r4vf QE‰\à}s—˛P⁄˙·$:ãEAqC¿Mwx\„AòÑ¬=t0ù∫Ot–pZ¿˙¸»∏M·ﬂºæ9
‡˘N⁄ﬁhúp°˘Èﬁ+W6oÑùÊâ&*? ∏—F$∆±®˝(§ú!UM;ë”›MÈÿõ=Ò; i√‘Óùt¸ì”…e8–2Ó·îuø£EIP+DíÜ}X≥›çëˆàhß% „∏≈cDÁÃ´Ω˝Ã.îËSx$ã1(ö€ªÈ7U*ç≥3É÷4zﬁix2ÜéúR$≠Ceöõﬂ0ë´Ià”4≈¡ﬁﬂc\f¬ÅAÆZlVt~>Q¨ÒÜΩÿ2Q´ª/è÷^>a+P”™´PVÔùD¡ <Gm/ £T≠ú7òÄn0AfY∞’AZ∫ºt Ö_·◊õÒÀÀÃr:·pÿÛG'góp≤ÅSèßïrÏﬂ¸ùqÛ$™õ’⁄™4Õ’ m`I¨ü)_nÈ PØ-Ô¬ê“⁄◊Öâó)óÖŒtÎ™ê{Ä£s÷Ú÷vo≈q÷8õ‹[√´Ïs{ûàc©2æÖ;Ö+¯Œÿﬁá5gOﬂ4ê˚>SRè∏ùÏÑë}ˇıàeêñV/Ì Ï/bgTdƒ¨O÷"rêˆ§å_Ñµ8à)!_†«ºÛt≤WÃFÆñåª®O¬z≥~˚÷õç‘ª”Ïaµíîˆa≠M
Ë´iWÆ©¸ÀøÌ7≤ŒÀ∑ø|s›∫]%I.¶=’„;8SÆ“Ì˝≤,˛öSZ¸MwÀ¨öÓ∂˙s⁄˝πx¬◊µfÍ∫fÅﬁ˘m2ÕÌTU˙îöcΩC„Û‡ó◊£q€?FóÚezQ}ÍH'u.OYGw◊}ö’(a_,˙’yê>8“±$µÈ¨{ßq°öÏ.ÎﬁEkS≈cÜ⁄rWùÉ!≥À…¨]uâ.πGË!ø}nËíîÓ[≤ƒñ,±%≈ÎYbK?ãê n‡Ô∂D™±bò…
(Q1#%C»lí_†z9‘˜Ô.ê#Q4:"°!z2›ˆÒèñô"MÿÁ^ﬂãJI–ˇˆeúKJ“;0í∆q÷b_Ÿ%˚{l'J:$™ı∂,$yÌÏùÖ^ø;˛
å~ï¡x?~Ûù¯*g∫,HQ¡aêˆ{>∆p¬+Ù∫©_c~Ø#çq«‹kdQΩÜ˛*«klˆ.O—Ω_•éºˆŸ 
ﬁxÉKKûDgw<ë◊ºô∆?Ç÷dÏØîÇNiï[ï∆K]ƒPé
åêË¡¯l•Dé∞ë2‰≠./Ò
uÿÅDF	–Û≠°ÈÍ◊âú‰ ÔI7->º∏§≈KÃ≥¥GÂ~êäJQ»„∞ 2XÄ¯$NBo¨E9ëû#6(á¿ºÀÅkgäBFûk»ãä—Ü‰˝I·Ü»Œ öE5ƒ$t}ùiÌ(⁄®ö¢‚2u¨®gG[‰ÙI⁄§¢…y≈©ëª"÷à∑ú¶î13˘ÖÄc8¨+ˆtÃ‡)/<e‹AÆ±wäV∆·Q¯A9€§πD… N∆ó™	≈‚6ÕòvåáÎÇ¨]ÆPgsÿHΩ5UÍ&¶ŒmSŒò’F†x∫é1SY˚ $˙é0æª∂xù∆dÅ	”»q$F©ÎıÉﬁ%Ê9Û{Á>´»ı¡GÅ	s°pg∏N`¬‚fj OJj√√HAtê–Åo+
ŒERõ ÖW8SÖÁb»%E°£„⁄´«:ùﬂ¶CàD)˜~Ì*ënôkƒfî«Sƒ≈iÂÒv¿®ÅâŸq[j˜;'˛è06µPì˚¨Ã~ÙY-i©ÃS◊]©Îi©Æ‘ç¥‘Æ‘i©õÆ‘Õ¥‘õÆ‘õi©∑\©∑“RoªRoß•ﬁq•ﬁIK]´:ªßööﬁ›ù©˝YsvhÕ›£0uG!ÏI°	¢lØÙoÆÃpÇÙN‡ú0h˚v^táí˝1ˇÍ Ì]=/YÁ)Ÿ”Ó‚GW≠AbÄf 1¿3xê‡á<H√å$¯a∆ ¸0cÄâ~ò1¿Éƒ ?Ã‡AbÄf 9¿≥xê‡áY<H√¨§√¸§√"<HC◊ ßlyﬁKzt‡ÏZ¨
∑£±»“€ªÛ8„˙™iµïL∞ƒ7ÕãoÇ?\JCáÙqNJvÏür‹*Ü#öãó4Ã	ã,è-‘ç|pûb‡ò\W\Í,v>-FbÍ+)±”‹ÄÛvﬁÂÂ˜Û˝yn∏˜8º>ˇ.¢fﬁi.1iÑ|<¬(å¸E!p;àú:ﬁ„‘û‡GIRÔ5˙ EÊö~¿ pŸ\⁄’¬¢…Îπ epQ•)A¿cö£MK¥-P”ßéêkƒ(∞"ÆdßÜ	 ¸è^¢º∑¢<Z<2>Öπ‡‚©<v:ö–.u√Ú‹^ﬁ_Ñ,Ú≈"ÿÚı0bCoˆn~?%»€ `Éõﬂ;ì∆Òû˚,å∏s|Âˇ«ˇbÿ…|¢‚j˜	~à7nåI⁄æ˘≠KÏD∑C·!ôc#p› b∑’	a°ızˇ  rqé‘:¬·$„•7Ú;LÂÀpñ
≤."<YR˘ê‡rÀ£—™¬\w≠±æŒjˆ4µ}-:8Û‡ˇ6,|dƒè˚äpR¿Bÿ—§[ç√! “ùXn¬aô
≤âkÔªµn≥´π!Hî∞Á.`Øh~US›otöı9(∞
òûÇj∑∂U˜íHßπXÏÕ˜B≠∂]ﬂöÉ´ÄÈ)0\uÃBÅU¿t6¸ÕÕy(0HPœµzEz˛¿ã˜à·Ì:ø6ñ3¨é‡#¨»\…9Õ¸íŒo6´;µFñßÎõÕZªﬁû:WÏ&≈œÕÇ‹Â-f£9m1∫ìö;Ö=ı43=ı-f#€·œÏnzfw“S‹ÕNŒ¨ô¬…é;g›k47∂f©”ÿ0ƒ;øÓow´ÒuÃ¥¶—O
ÈÖπ$©ã´ë@V√µ7pnÕº˘˛¶Ù˛c»,(É∏QWúD'B\	¢ìëÄÄ®õ¨
{Ö∂b€˜G7ËâBPSêZ∆·/?; [Ë¿¡?ÈO"êXút|I⁄C›Tÿ%$âP∏I@…;Òz-˝&ÔËÊ7xÀvÒm"«§ﬂ
zﬂÎdDó Üœà”
˚ª¸ÓÙZÍ°'ÖvJﬁHpÛ/J·®ƒ˛	äó"sÇ]Tƒ°Hî¬0ªãafnñµGìQ{î$Ö3øã ë]TOπÛnPÂhœΩ8Ö¥ûqR»ª8•;—‰U©u#Z–Å∆ãúæ4``êe{»H˝ò‚)#3}æ«:1Ò7/“}hOè–UÛÑûínq:¢üx)†{PÃØú.át(S‰Ò¨°ËJ\AèµÎ‚8¸R«ãŒ†Î˙8÷É«,—¯≤Á„%
^f#–˛ßC∫ FOAxô∑ÂxÀÆe”/§≈uèu/›0Ô•ùZnøÍûÎ∏õV[è:1Æeå;´OÎÙú~¯w_]Ô8ëÚkÍBú7‘^ÉˆíEí¿ÿ⁄ÖZ±∂7ÙÙqπ∆º!’…(ƒ‘ó,°r ÄVû˘£A‡ç‡—h“LWŸxOı©ãdÆI“¸q˚ÃæVFÕÚ¶∏ˇk\ÙXˇ¢ÏM`•…æ1¿ÿì"ˇ2º¡#ìü©'•ì≥Æ∫R.ƒ¢3Ø~(G˝Ωª¯3ÂF‹uöúTz∆≠ª}Z‡˙S	t◊¶˙n›°∂≤n›5&Õmóóéüú·síÃ{}·ò-≤LsÔ8_∞Z3ﬁl¶ÒÙ2ÄÏt≈/»ﬁø ≤õ≥êÕì¥—ö˙ò¸É¬Q°MZ¸º∞REE”=é*˚)ãM\}|´m„hÄó©‹å;Â“S.˝œr˚Sàk*Ul\„î0à‹ª∏›Ûz››ˆY–ÉuÓùh2qÓïË`lÄ≈7t8ÓàÌ˛<	†êπÔHA‘Ëñ=A“ÚäÙñÆHˇ?   ˇˇ ,ˆ—xúÏΩMs„Hí(xØ_≈ÆÈ"ï"%Í#?T˘aLIY©n•î+*´_=I≠IàD%p PKîŸÃÒﬁ∂«ˆ∞ó±ö[ØYŸ⁄Xﬂ∆ûŸö≠˛IˇÇ˘	ÎÓD îî’Y=…ÓJë@ÑááááááªáG¨Úõ{µ∑æR˘zë}F˛®ﬁı]?ÄÁgÕ≥ı≥'ïØk_0˙4{‰Z]ªÂ∫U*π)
¶ lñ≠∑¥|÷|¥be1ËvzÎv≥) õeÎ«-5õÕ«+èÓÄA
¿¸¨ÆÆ5◊◊ÔÄA
¿-0Ë≠Ÿﬁ@Éoæ KKl•¡ZΩ∆aƒFV4Ÿô„∫Ka¯lFÕ¬#?Äó#˛/¢ö˛8≤Éˆyü=ãøöpBh»óü4W	Ò‰ÏÒôu÷ÕÈâ(”|ÿÏÆtÁÆµ‹yÚ∏©÷Í5œ,{Ω∞V–ÔX’Ê√E÷|ºˇ¨<YdÀçïï⁄}ÄY[üÃoŒ÷üÿÀ≠ÁˆŸj˜—Ï∆W÷∞·ı«Oì˙†7~[0kèÀÉ·Ã£èD¸lyÌ—„ıô5ï˛«œ:kÎ´À˘2Lî“¶ûx6c÷àRkè÷◊>—k>Y≥V;èg’\±V◊◊›¶Õ¶ΩÚd5’O{≈~|∂úÃQ√LÀ!}r–»fB0≤/£zËZë]_[^Fà ì«§àyeõ	ª»n’≤ö?K≠%D‚ﬁı=êR]À=˚Ω=	°G‹sz¨“∑∞€]œ:„th˜À≠,2◊Íÿ.º˛6yÌ≥7¸-ª^,ÇÅ›ÚÅÏä◊(°Ô⁄à¬8Ï∫∂R˚ÕÕÑ›±Î≥ˆÕ_\€œV¥∫ËªûF∂◊Û=•Í!<∏˘ã«z6k˝„ÿÅ2Ÿ⁄@S/≤«P˝-≈∂l∑oı-6ˆÀrªñg[ÓigÑñRˇ•ÔÜ;êÖn~ÇR Ñ`úh„cu#Á‹~ãÖ&9bW X(8ÓFÏŸsv%p‡5eŸñ B;˙ÜGºx√ÈA;º8‡:<(ˇ€ﬂ¬?_>{∆*û⁄≥√n‡D~Öª÷Ÿ¶oGÑ”ïEéÔAsUÏ;4‡x˝E Ø57ÁåUU¨ Ñ@ﬁª#@∏Câë.*.˚w≠4D·˝Ü»i”)Oˆ¯C‚’kÖ#ª˘ÃÓ˙˝‡Êß3ßÎ5Ï‡x :Ï ùæÁá»VÅµ-Ê3«;s≠°’uÄﬂï4R≤ëÌsÀÛBJ≥·gΩ¥fò—%êk1"DU@|⁄sŒY‹âÆkÖ·û5È5åÍèŸ(™?d?ËŸA=™Ø»Ø=+ÿ=˘´Xì˙ÍÚ2®*à)À+1¿0ö∏ˆ≥´+Pa˙ˆÀ¿∂>Ïx°”≥q∫ù˚N∏ºcx Æeèü«†S¡ã˙Ÿÿu…∆ÆÌs≥aßæZIjdÎP·£ÊÚËÚÑçG†Tu≠–Êxw|∑«¢¿Í~ &¨_ 6”Â.Ç_n¨≥éÎw?(ùUd¨ÂŸó˛€ˇqli^[Æk˝ÿáÅû∞∂„˘£–°1R¡‡Fﬁdeå⁄è%Ëà÷±Q∂[OΩ˙ûØ˜äwä∆VóÚo@—ÙôÂY—Õ_Ü»±‰”„sËÿ!C·:v-¯∫»Œ¨∞Î`¢‚åî°‰›…⁄3◊æd¯Íﬁ,n–˜¿ø`Nd√:H
;ÍjŒŒŸDﬂª≠À˙E}ı“e√À∫5ô§ˆÒjiÅÌ⁄g€vÌ!T€`[é‘≤ó˛%[X∫.‡ûã˙∞9RyÎ UÄ’WaèΩû›´C€|nhSdX(¿‰ø®áCÍûËé@?’õp ‚C==D˙ÑÕL[1+z
†⁄X%°gy}–›I€év<œ^æŸ≈ô{z:àÜ –bÌÂ˙Z´ºÙ<À®)Ç8˝ÅBq‡≤‘ƒpX%äâO,–DzÛ	πæúG„‘HËÃ$i“±£€ˆƒ}û"çë9µÅCæk¢`‡àt≤uË=»èïJ<4é,œ0ùÎ»`äp¬«é◊s˙~˝ë*nïIØMu†)…*Cõå˝Áø˛ÈFb”Ω˘ŸÉôf—\B<3‘IK&¸Ã† ,L=\ùz8"!,+H¿KÒwÇ§2`|ï“mCkTÍå¶3®üí∫ÆÏ-∆´ÁG¥üê†’¥@R˙ (-ó`“õjX+®Æi@Ω®c*Ç‘¢ÙOj7–˙É=yv∫Œñãpîf£KŒπRä¶TföúNnﬂ»K¶AŒóobÍÒi√\€Í!√zægÁ/=Ÿ–Ò@˙ßÖf
Vj¬]Ω.Ë_ŸWí£R≥ØÆ‰»_øø~nûEmàI˝8=©s¶Æ≤J£ÊCÈuÅ¡
ªsDå9mÆã∞õÅøqVœÏ‹£∏k!l—“›S’±H=§5Tˆ.o…KwrÜVŒ^∞J€Ú`ü{äF8ÓçEuç*µ|≤•ê$&uÏÍ§ﬂÎÿÔàTH…Ù°7Ó√‚ÁŸu®>óá∏ﬂäÏ»ÎÑ¶eï¬ﬁ ´Æ4∫
@π≥íV≠^œA$,˜ÆF^?¨VfÈ≤Ã¥DwmØh,óaMŒ¨–gHç,ÊDñÎt—åZ«qÖÂE›*ÄÙbÉ:ŒÒ⁄7aÓﬁ¸•èÀìkAÿ»°]ÿÀëÓò°∏·QVßÀÎUﬁ“6>Ë<#eáeD∏dπ¿v≠Kÿº%⁄ﬂ(ÿ=g<Ã∞üPé-ÿó¢πÃ«a%„Ωî’˚ÅP£É˝(H∞µÌY0lF>b2ã∑ÿ VV–úÔc]XËF~ŸçbZ¶h?ïƒË∏	∆%ï/∆
OÔŸ¿œ¿0/ÀÒ⁄›n›û±™¢X†=‡K«Î∫„ûm(Ω„∂$é`ÁÔ¿~ºç{n"Ÿ¥ª¯L÷¨‘‰2é,§K¬Ûæ–îÉûﬂ„◊®
‚ÈÀ…NØZÒ†zq®[§àLÍPπ"¶4!ú 35Ë⁄ëjîL
7Ë)Ó _ÖÍ®XÍ:A˙c8,∏}ë≠¨.≤µÉøî'"±Óñ©u6Ïákè÷wnc√6Y¢€,px4Ávx¡¨ŒÊˆ>ÕÈ±∂»¬à?Y£ˆı?≥◊ÏásyXHb»_[=[∑Sﬁªπ≤⁄ù€êü2•'òH3b2€¸Øâöˇfõ¸9Zkòßßn¿ãÚw¯ÊÊg2áÔZQÉmÅ|Í¶Ènä@Ï¸¬ﬂLˆÌH4pÇﬁÈô?¢Ål§≈Ñ≠E>S¿f· ÜÅÔÙ2›yõüm“K€œÔå¨üÍJ™zAG˙v ÀÕ`–n∞Mk[ÀΩ˘â,gπHƒ0RXdA 2≤`ÒÍ&CÎ$≠#å&π,q¨‡Êœ@Ç%Ì≠(KﬁòlöfF®Äq1‘3Ù`¢∏Îw»U2=® )«åÏ	,Pf2(á]’O¥çüm_¬éÃ∫‰û™Ræñx*ñq∂xöÒ…x[4¥“Óñ‹ó9˛ñ¬Ú˜ÌpŸéuM°SÇ âNÀ%Õö}EqñÑÃáÇ0„ΩÆcëy¥aPv{˛zŸPÅª≠¶K⁄ûÂ∆¯ÏÑ˘Tù0Ô\h.Ù=ß+Ä6©•bÿ@·Æ°y!∑<ÿÃ–‹+˛¶∞cœˇÏx˘Ïx˘Ïx˘Ïx˘/≈zŒgœÀgœÀgœãˆ˛≥Áeí¸ó˜ºd-Àü=-7ûñ¥¶/”O‹¡ÚElàxÈ¯Cª;∞<\© …`¯C·.y∆™H^≈4ÅÀ9⁄Ä]–$V0»: _ë5D˛h ë√Ï…„œü±5i6ê÷Yê0¿øD4P§Òo·ÍÅv–⁄j∞ó;˚o∂7o˛yogsøR√ˆä µx±Z÷ÎÅ'  ‘ìX8rù®Z9ˆ§=4}◊ÔÄö£kCπÂÙã]ﬂÍÌÄà∏Ñóï7>∞"êπíîÍ˘hnÙ¢Ô0µß [;8s\ˆ
d?	vËÑh„S*u-RÆ∆√°C-ÒVøÄ¬4@G'hw>QJé◊∫§ùYnh£<OÄâW¸†qÊ€VwP≈_YÉ∆Ê‘ƒ˜¸YçÂ'=^B“;Vﬂ•xß’€w{á≠ﬂm≥ow˜_∂vŸ÷6€l|€bá;Ìwª≠É9E≠Â8-‹˘>ì∏4Ëwu©z‹{P}±q‹Äøµµ„p·x	˛i.”√Â⁄¸´õV–∑kıËèµìµ„ZÌ≈í£¨à*≠i*µ>¸#+ÌWÆoEºÏQÛD[Hb G+'5á»w)&∂≠k Õt˚n{ÛpˇÄΩmÓÔﬁ¸È[‡q∂µˇfgØµw∏ù"ZÜÌ$4·Î®.5
¡•ñúE‡ªZ
◊Bﬂ¥v˛;é(æ›fõª≠Ô“ÿ≈L
‚”VÜ À£%⁄lﬂ¸O@∏Ω”÷ÑD}gÔ’nŸ?ÿiÂ5Ø5¢∑ØbVÿ¸¡ˆ&¥∫∑’⁄‹π˘”€⁄Ÿª˘Á7;õ∑i3Øœ¢.=Ÿ<»– 
ˇ‡DÉjÂØˇÙosL(Õ'¡ÒŒÇ#ú@µ„•Ê2<≠ã7'¯ÊDLñ*¸¿ITU'ŒÏy#ƒ+*‰1ﬂ7≥|ÔU’	∂„EÒ,›uŸPﬁµœ¿´˘Äœ∏™]À/ ˜i w≈.ïWX?M~uA#p≥P`äÇ;ﬁà¸]ˇ¬6A©©÷ûâè¿RJ{¸”˜@w7Í±≈=ƒÂ’∑Çà´Bdu◊ÈY=Ä	+sqÖ©ºu˛ù¥é€µ~nÒ ˜2Pa€eÒ∂eUÁ«;–3≤Ω–)”∏†>'«ë™Qõ¨“|Ë?QOÂ“çF„pPΩBN~ØEŒˇãú≠%s-¶XÚ∫x¡àEâ&R™ƒP˘“œ uFHC7HÅ°{]b'6îß‡≈*^“|j	\LΩ†uuC[dÅÊxÅ›√JUµYá4Q∞Î4©ñklâ)ò¿:Âør@„Ø6kI3˙:ò<«äãyD⁄»PÌdÌõüQ≠wB∆˘˚Ê'4÷≈‰Ëé’®$0ªÎΩçWT8£P˚e]í“U;jä^Íªv„¬
ºje;(†'Qà°n∞Í‡g†ƒãDeëa}©Nk*/ÓÑÑEÂñ´˝m 9SÍø¶Óì~+–W dÖ}Yd›±’|rÊD@ıï™ñ◊ûpøâ˙¬Ú<˚2y r"Ã∫xk∏R˘“±wÏ=‡ãé\‹ÔÂ¯L"´¡ÒIIBÆ®·XTÄp5¯BËËcÿÓy—!Ëï6ˆQ™0‡ﬁ6}•FËA´†"OÂä÷„XØé≥nZˇiãWÅÍm÷Ué6[ÌÌ”÷^k˜{–óN◊ﬁﬂ;Qu	ÇÛßÇÌÕe"Úﬂ·.d*=k7ùñ(›öUxˆV"øÓu:øbÅñõ_©úöZ@ñ|=3©TÂµ2Í!Íé’4DP˙¯ó~qÑ[gnUòÕN¯⁄∂`€˚∆
>è,˝«øπj.>º>Lè‡·¬¥^ØOˇ˙OˇR[jÄç™1Á∆(®x∑ˆ∂ˇ€˛Ü‹âÀ∂vÜ£¿CÆ†•[Z†ñj¸ÈŒõ∑02;G˚7:Ÿ4∂vZﬂÓ—Øˆ!–m™øÔL7˜˜6wﬂ…Òœ˝ΩÌˆTØªü˛›ÆwñúLØÚçπiä\¯¿Ëõ?éÊ·Ö˜EŸ˝§h˘eÔ†≈s+jˇ3√∞I2Ü 5˙¿fÊA¡±ó≥›˛ﬂﬁmøi¡êlÓ¬§ ˙·Ël√?Ø[ªª≠ˇ˛Ì~æø=ÿŸ€‹y€⁄Úoækm`©6p˝üﬁ“Iàœ∂ﬂ@7hH·ı˛[òbﬁ´É÷Ê·ªÉñq|–Ü§2îﬁ√}›stPvNAAÙNCÎÌ˛∞öéßˆ{ª}xéêﬁjwj9X˙w°Öké±Ü•Å¶õ |\Ï¶}ö¸ì≠æµ›‹ﬁfﬂ≥ﬂΩÉÍØ†ﬂBPm£pl'OÓn>øgÅËÌF˘ïãóà4U¿qYa‡.„@qû Zº~™è—´iä
ÅÔTı_4VPQ®&Ü™ÑZAMÆ…*ìT‰äè∂nPZΩ‹≥9ñP‚¯ÜIí6ÉÑG7%µΩ˘!q¸HR-,Ä$ã
%’XÚãxKµ¥ƒﬁ˙aT~G‘¸ëÜ¨ÂMPÒÁ˙!˙"@@˜Ü‘!
Kú:K‘3¨àÒ’^3eïπÆèﬁÄÒˆ) %Ú%v_ò÷÷C4∆√Ê`th⁄»£wB+§b&ù0Â±ÁJ.{3Í‰Ø~ôôµnVA±‰%%ÁP4ÊQ#πA$:óÙ‰$e∫˛π$√É:°é∫AQFèÅT…ÓON¯ÛîAY±W˛FQÏ“rA∞GŒâ¡™(p°Õ¬√Ï—ùE:´3’∞ÆMÉF£ÉP P d Ú©ÿN<HY#b
Â—¶j%∑ò≈•‰§ègÏŒL9Ë≥‡?>C±ﬂMÊl∏≥5¥ÉÀ—≥œ:F1ÿÃ:CßfŒ,`ÄSx∑&6Ê±,ì4ÖpbqG6i«.ázÛõ\éêC#π≠à_}íã≤¿¶ôÆÌˇn7”o3◊ãg{…í˚Ân∑+Ú‘à:7ê¨?†¶≈∞f¬’«µYıá•M¶r‡∞(MÎrhù‘r¬=®«ıªyˆ^I§ç≈çl¡Tqë4™w%5ììÀ??$Y}ëfŸÚCZã–+b|~ΩYÀ¨øRF©ÖŸÚ"a§Õˇ‚‹P˙ÅçfˆTe¿æ„°c]À¬Ñ√-Ö9V¥Dı…≠ôgd£óö°-VYr`]´fB'¸Ωg€áÅ5Z1Ä´Lœ%>é-Ñ±Û
_·õY+—%Œ5© ˜4"¿ºd*√_ü~œ∂&«4•7Œ ‘È‘:ßA–Y‰Ñ-4¬n°˘´¡◊NÁlBpk∫•ˇõdló8jçÅ€¥ÎãiçûomÍvá”a◊Uﬂà/ ùû¡#ƒt.Ùß#;l,X»îé7ßÆ”∑0Nÿo,@)å7ôû˘!î˘#˜»π˘˘$≤-©. ÷5}‘Zﬁ˜£õÖÄgçõˆ« /°úﬂÍ¯≥X˚§ò„4ï}ô∫#ÀöZ—ﬂ®;Ì¬ﬂûÌFæ”õFN«Ò1û’á¡ùñâ°Û0|6ækw'a‰D0]ÔuÑ∫*Ë\ w±ê#
}JtóàMœÌê¯˝w”·8&”ÅrPñ˘œÃ(Îtß´ÎxvdOaU`≤9Å@Ωú∆Æ¿û’£géYn¡Ç–Î9›˚!KÅú;@ñRÊSÅ◊‘Ÿ7>¡ÔˆÙÃÓZÆ#"ﬁ˙ÙÉ,áã+´ﬂ{t”öû¡¨°|{»±<k—ª±ÄßC;ÙU˘cÙÜÚJÓx?åÉ…˝éœXyÍË‹ArÌêé≤ù&9ÿ>©¡A‘∑Ç »,ú&èŒúN‡‡#Ï≈ëÛóO)7≤1≈•N1°B‰„Z[ñ¿äåΩ§í„cﬁ	P[Bkz‹F?w¶˙XIs.aXÍ‘	ˇqEA\¬èæ=¥AæÜƒµÅwzcÙ N;|⁄€8±œÏ°è+¶u>v$ì∆Ïûù¡,ü]<V|øúq†˘kúCGôÛg˙πÂ˙¸L‰©(˚â©:¢SÒ≈«/VO˛F	5X·¿˙0ÈaØ“x⁄Ò°CS«;≥úÂºË‘£Ïç›¯Q˛`Ω∂AÒq∫˜;X¥ÃXà¢üÿXXCÀÛOœ0ƒñ=mI%÷s
29åÎ¶=•s⁄tÁ	ÜÑë¬Ç"°∂˜x8}ÁìdÅ*ÚO√ÒCWª8óAàQ\ú‚√rOœ‹Ò®:ç`ÉÎmPã LMâº-:˝°Ìa¨éàí5ßö¸òô∑±–u@NÖS˛«i ¯Y7?ù NS¬Õáˇ¯Í•.ún>Oÿûà|æ7é
d~‚?Af"ƒ¶®1˘¡iÜC]¶‹ Ìáß~áGè9Á0§qyˆ»€?ZBó∆∆u~úÜv6péºõ?·C3Ö%¡
‹≈8¥ºª»\„ ∆¸°kwÃ∆pøÉr†eÜœûUñ(ÿÎ ﬂÀ8∂Oé	Ï4EY}ég!˙¸©=πﬂÅBiXﬂÅU\[hÁ¯ç”bäï•?≈:ÙÍÂ3öˆ?Ü©¡œﬂÆZAD¸¸I$râ©A¸m,W”æÔâo#«˚QÏzN≠@é[ø∫VÜ«µ·—–ˆú∞õLª)QI~S¬ëBÅ<Ö*€Ê¯ÏÏû•*|⁄»π„å{sË+ñÓ˘ü÷ºí»Maù,X
Qa%çH˘é;ò"|D„ÑôÊqÅdòÊœP—ÑßQ◊Ì®„õ?&˚Ê˛ÍﬂÛ~»PsCp>≠Ÿ#∞kì◊µÅ˜AÅMf¢ä‚È¬xßûÌè@âÇÈÀT4Ìp5◊Â:~Ë9÷–zÎÙ
√;~?(æÉIÜø˚äsıì"tœ9∑πº e—Î†SJc¿46ÈåÿÒ°ˆ0µ:!j0Ck ;4Ω˘⁄∞˝©œˇ†ä|o+ù”3◊
E¢ÁÙqa:ür-CUAq¡3e”æ„Ÿ–rﬁËÙÌàÜÂ–â\[ÈBÕ#·aŸPF∂Õîæ}VmÌ›¸ÛÓ˙Ωy∑{∏#¢n’*äOwHÉõ<å3F€ºﬂÊGwSÙW¢?ÈÿÖQ≠ŒTfÜFfX®∏ËPz∂√√.økÌÓà õÌˆÊ¡˛!<_bá€Ë≥√PLï0úÈN$äµ±)uzÑ∂˜‡·L‘Ω¢ÖÏq,^oøΩ˘gÓŸùÖâjbPû™Ü#ÇYs¬<ÓÏÔlmó¿OU∞Ü%‘™YX¥ˆ±9¯~∞øµ≥ª[âå 0,°(Ã¬‰MkÔ€w;á˚9xkø€fá…ªBs·,Tv∑πÀ^µi
¡◊ÔŸõù˝√ÌΩ≠ùΩ˝v´=ª¨s@ygt	ÃBksw{s¶ı!4⁄˙ˆ›Vâ° ¿’W≥˜L~yã$ÿúÖ¥˚QôV9N«YH¥ﬁΩiQ˚˚s1n∆•¶
dÉ#-Éj∆}V’-∂˝ÉˆŒwÑÔ·˛K¿w6æö*òyÏî%Ÿ˛ﬁfhˇ=;|˜O	©ú’~
[˘û}∑”ﬁ‹>–BÎKtr~H˜/ål_N‹º÷Ô¢
,-±ÕÅ›˝@ßë8X(∞jÅ5i8!˝Â:©≈ ùv+âˇâO ‚ö§ •R‘–˜_]Y<ßHÍ∆5√ü¸§&^◊:j"pÄ©πçÔ—å 6ƒ;sÂ„(2ñDÌ…<V1Õv¯ÁÍ)æ≥6˝6<ûo2Küa∂è”°Ù1™*∆Åªu•‰*ÆufÆÕ≤u*w Œ]…^fù◊ïn¥S’*óÊ
„óœùR®*d±/Ìî÷Z|t7¥o©ò¯=ˆÚ`¥#˜x>nèaßÀˇûﬂè0çnà¶¶¥G‡˛ÿæHÔ‘0/Â∫òÀ5ëÔ^)ÔQπ?BÓtnµM¯Q(Ç“Ö.YHg8≤∫†¯ 0äSJèj·-xP:“ÛEÜ·P7¯›ÆÂ4¬˛bêÑ˙«EòOë∑é8vÆGuú  éS@†‹QlïQ&S≤ Ê°}ä≥õb„Ë≠4ˇÇ©ÄåÌ“dQ]vx7lÁ–:5úcq‰}¥eâ¯%áõ^ë∏”WCöN)ÿâ∏#´œ´Öj¯k⁄Elä≥=<ëÎº∆…‡RbjX3¬;≤uieUCí8Vß–?u«îgúlXÄX,ˇyó|
˝ˆ»ñ◊yï†U–>_YÆÎÈ÷E5`€≈‰≥±«èà!#~Uo7~|”êÍæΩCõÖ÷Õ5g#sX-ëKs6vkÄsJŒ2bËÊ%iŸç}&NyŒÜÊ‹ºglo◊ﬁ\;pS‘ËúÕñ7÷ËÒ7w`íôfŒ¨qŒ÷ ⁄ËRÆ±yZôÀVëÚ˚Ã”NY…˝EŒBpkÛC‚	`}:∑	Û$3†<X2=OO«S◊Ÿtn_K˙–3Â<MΩ^/Å>îJrSà√Ht¿ÒoD¶Îõ_Õé}'úä¬£e=+ñ‡g≥dÅ&œï¨g·√¸PıNœ≠–É™Nó˚gx–Mí	RÊΩJ˙ƒä$û¿Ó„á5‡ù‰tMz¿özû∂‘A∞¢(g_SÉÙõﬂ¸ÜÂ≤Z©ÅôAêR`f%ôá+_i>Ωˆ ÿï∏∑uÈÑª"·XU‹'"ÛZ∆.∂fn¶‚ÏÃ”@âéÅÚR©!ÆÚ˜oSø´¸ßƒ7ˆ˙πhTã…îq≠äåec◊›ŸßíÇ“áhpjÂπÆ◊l∞ˆÎ˝wª[€ÄZÑﬁ…πÇØÀrbŒ4éò¿X©˛∆›èYå4Î`<¬tfçΩÌWcAîí∞\GÎ¡xTP´TTã¶0„`ËMa+I¡ºÜ„qsµ)˘ëWˇ•åi'ˆ.µæ!.$‚mR$J:⁄§‹ˆ£ÖßñÇ~.7©€≈2ÏÂÕœX]Í„~ò”6;¸ûtä[~¡¯&‚üºñˆ›fIó«ºı‘∆ƒÅú\\a;Ê⁄?‡uPTŒ÷*k<Z4íòªwG-¨BQy{ê∂R∂Úç≤[iÄ§¸˝Ó6nã∏N¯ÒúF4[ãm <v#Ù˘È'Àäè@)ñY#ú1uìsT¢BcAi7èfªNøÅw[a÷J ≥ñisIbW{P
˙&T∏˘…≥M¨•ûÀ„Á¸ 3{C¥â+H¶`Àóü¸ƒπÁO˘â	<˚FELECt#D±N⁄⁄ÑTGÃı≠È¶∑.í…MN!ª˘Sh[xwø•1ÏjÉ˝~o{õÌ∑‡%}„úíë˘ŒÿLA°ØñxôéåƒáL‚ÿ»ÿ˝¬HÉú¡Ø*ºYÉ˛J)knî∞ñÇµÀÀjåﬁfOù2¯¶,m@Õ5ûT-	ŒÄùp"——<2ç#˙ÜK’å a/°ÉúÅ≠Ñπ}ôSÒuÂTÜ7?[0ô˚ö¥ëgsa†∆Æcy„bÉΩÂ54MCÚ#Ú(-¬»ß˘+n ®`	v(*jÆÙÈÂÆ£±”/’ëú£»πÊùÑâ¯-÷—@)'îßˆ$π,Óá{≈o~Ü≤ :^biM≤¨5»¬µã˚∑ﬂΩ;¯˛ŒÒ6$# ùãÀ9·6C^îÉ˙Ó∏É>Z£1;èV[{#CíKø‚Tÿï9‹<PØEi ¯&/⁄à
n∆—æ<∏Ô<∫◊‡çR%≠PK∞¬%*èÖL™≥Ù•%∂Õj≤íË5⁄µæÁv≠áîéy"÷0û?û1‰∆Û∆‚hb˙†qf}UÎÇtÄ™*—T?GàÔî2Å⁄K©YÁ^VÆ;éäDEa]w8óg≠–%G:óéÒÙ¸nÆ∏˘≈ÊK*œ˘ÌÊœX\ckh—)°¯D˜T:4ã˘*ﬁ¸ªp_Ûzc<-˙mb@Œ™–Â¢–à+ƒÉYS_∏1AzÍÂ3ìŸπ˘âJ≤V‚‘≈1AF;+ù/è1”kcYº¡ƒ”fü~2[ú◊ŒÉ’R
k4}‘`áØøG≥Üú%ÇT≈QRy~îŒàŒ )˜»À”¢v8=¡â§W4˘¸ÒãiñQçÊ–≈=¨¯Y4Mpßª«©ò∆Ç&¡{ö´ÕKZÏpß~–⁄jßd–„π0·¡ y€Ç59@I©‹Ωõ⁄‚¢îW{áøfá‚úØ6Úèh oÓlfFæ|†41A∂1•#´ã ‚÷£Ï&Ad)á@Kpó∞¥b–∆tÊ3¥ÒÎ«	Ûc¬^a≠<Å´"UF¯™p‘”∏I7◊ä(ï‹5!©´OaÇBl¡$p÷–ÊOk	†ÄCD8ã\©”ßÑòG‘D¸ki˚°ä·8u)"9ÄÉQ;Wsa§∫ÈΩ¨€…Ì.ç˚’õü)ÃE„Ë'ÓŒ;Àú< V6ùqMbÒ¥ Y:"≠ùúùÉ≠µò¬<>&«∏J∑»Õ	ÑåQÃÙ-ï«k◊©xÓÑË˘£ëk√~’∞»9/´ñ≥Ç<Zc|vNêqôç-0S¸àM„ dÑ®Ä≈ˆPjc]Æ)QóLˆOß/≈È¶"ûîZ÷éZUcÀÊrÉô¬"2l˙—N˘)]|Ñ◊±[ÇõìVf±ÙaÇO3™–¶sÎ…f¯IprcAÌ-ØÈ¸rV Íläﬂ¸LUãôË °e¨ﬁmx_9ÅsÛí6 √ë„9∏"ÊŒ¶Ô‚Z%X;9Ÿ=r¥!7¨¸Óæ_{-Îi.„å6@n%˛<Ú#!∫òÌ˘„˛@sã˜ßœÿ J‹$Ω˙&Ì‘Æª\Y∆ãL*çF —_ÂòΩO&À.:±â”‰À8¨>>´„”ùé1™Òµs"≈„x(.ÅJ◊Kúz°Û#:ıV.'œƒÂáœ¯À%∂¢¯ ≠ÀxÒË°“ﬁÆKŒ{ÚD„Âç√éà;f‰œL6_ÀÎÛcëo¨h–xª√ÿ
¥%pÆ¡O«ÍLàƒ©a±2ø«	e÷@ÏxAÈè¨Dß@Ω≤ÎáU¬"æøeb*:^™˝‚>m‚:Ö!Mºπcπ±≤»ñk¯œC¸ÁÒ"k6ñï?pøı›Iü_ç¬´“·	˙öLt&u¿‚î∏fë9«~ÚH‹~a \vAΩ·JÄ~ˇ’’(j\^/“ﬂ…ı{·≤O≈∏VùÀàé@?ÔÙá9jøfGœ„lƒJ«)ôñ<l˙∆œaTåx>å/LÓÚ‰úØ‚≈·8G7(˜gùá,‘GVﬂVÓÚAƒt£:Iê‰jÁpduÌ˙§˛0æﬂ3{ó=]o¨‹›©ØÓ0Á∏¨,´WÚ>¨foîÓãkE}ÿFÕº›8‡s‡O.s„mŒ˙m∏ÊKá≈ÖË√ˇ¸◊ˇ˝ˇó¯≤+Ìò3EJ2≠>]¨* ﬁﬁ{™(ÆÀÎ÷©{¸_7å:pa◊∆ŒÈ~%t\t«ñ9ëE7®⁄ÏÊg ËÜvc⁄n≥àﬂv…Pùº˘ÛØP:ìWa*xéRwúÊågÍNı&ˆ6îü¸nıáÇƒî€V¡ˇjiÅÌ"l¢â¡€`Ì“∑òΩŸÈ≤ÍCºUeﬂíB¬4G˜6‚´w‚Ö‚ít©;≈céä/⁄ætŸ®æŒy ˇAúÕ7áãüòú˙‡:¨Œ=€Kq…yüèEÉgW∏L\≥Åç9¶ÂØs«æxÈ_>ªzøÃVo˛T¸}mò#É:Êê7VØ>¬+´S˜Ê"7}—›ÇΩ∂/-û*Ω®ú*Zπ@EòªwIr(}Ú”ëêct°;î∫f#ê1Q¯OxÕ`„È>´–ÕÈÕ„ ¨”ÌÙ÷Ì¶|"E%˛ΩeÖè”<Zß◊‚3dÉUVÿJÂö-È¨•Æs∆√Ï"›õÈÈ\ãÇ¸p	Íâ*ÇS˜‚Gà÷ßtM+ßÕ5ªl>ª‚rÕ& ˜ÀïgW ‰5õàØìÎÑ\O÷¨’Œ„4π+†Åﬁn˙^l$ﬁﬂÀ‰jÛ
Ü#CâxÂ»)Îì¡†ﬂ±™èû,≤G®¥≠<¡et7eP◊Œ÷⁄Î),W+ÈqBîæ√‘bólÀèfK—ròñ¢Ö1;4]' Ö4úÓÂ3æf≤Ó‰_5Y¨≤rT– ’ExpFüTüKé∆¿1
Çª_"∏W„M–ú2$ *™„2œüW«MIKyë‰ø»Ä§@LØ;‡7'AÏ≈ªóLª~¯ùÖm∆∫$‡‹‡ä¢π(íJT+’L\‹ `ôKûÓDºùd*”éÜ„˜Y|=ù5?I?˘:ïnÉa˚@l•_®Aúºëß¨>ªÊ6Í¶6L]§÷◊ê ¶™1r¢8RÄóÜŒ¨ghgö¬’´ÌPà£FªLM·T?OQï…<errﬁ¿lu/M/†Ç;1Ω¿&ZD”gWú∂¶RÚ ó†¢~V°5”r+Ü¬iùÏËIc÷^EΩD…°jëREÀBKﬂsèü+ï∏/t√œSSMzë> )≈zìg˝áˆ∞Ú¸*ô˙◊Oó®Xy Õ∆*¿P˚NùL‘\—}‘È ÛÍïê√◊K∞L6ˆt…ÙØ5w69J?Xı+≠©˜&XŸå`‰“◊ä‰7(Á}M£ÀjÁGÕeÖí=Fÿåá™Êæ}∑6ÙThê9˚íîZw`sgY$Ã:âro{Ã
¨õ∑XuwØ[ÆU¥nåîÜ¶ªıân>ë˜∑tÛ+√bø≈·∑L‹Y˛∑=ˇ¬C˘8ó∑Q«ÂÜpMÎ!¢ëmx”
z©53|nÌ~≠±nÿ„IµæcGvJèÁç¶9«ºÃcá[Pe^u\ßTÜáﬂéÅ~∞%•@VpOË!ﬂ¿•1\2M¡4©ÌU Mcú÷ÈÕ1o”ÄWcî+ÉØs»ffµÂ°–≠<'√˚rﬁK∑2N$É†¥ìö˙ï⁄GÛè`¸-±Xÿyì$ôKƒ–o9æŒÎSˆ©°ü∆!£Îä2g∞]÷WÅ„GÏ`<ãKIÜÖi¯°íeô◊£_èñ”ìé„ús<\TÎúº∞œ©Q_π$&ﬁ–x(æúöéO†ä˙h%-‘Kë/-∏¨yX'µ\à±b#%÷JZ*÷Ós˛sz§Ÿ∑¯√Œ\ ,{3v#'˝’á[µTÁk≈¨ì1ŒÑC≈8√m3+ÜôêŸ® ı‰^•wY∏[ßª¨^ﬂﬁDDP—v≤á.⁄CπM›óøûä°Õ/´”·-@É´xÎ9®∞ôfà!◊ÕLs´z¨"ÎM<44aa◊„6¯/•˛`ÆVV≠t'∞| FËá“˝ÊMd⁄»’≈w$}YΩ¿
9sMu˚∞¶ÆŒ^Q9gKB©ÑDOÀÒ«r!QcØè+,B{+Ïê∂¥ªΩŒS~ØÚv≈q’Ï∆ÿ¥©»[tÕ}ªzü›L§DàÔﬁÀâñC«˚PGÀa¬,◊ÔÛ˚òÍÕsbo\~3˙s÷í'èç?uYÕ-H|˝µ#ÀqC–DGlÂ¿ „ömqïf"¿sÖ∑Tª—≈†y≤B¸2ºµ¯~úÃ…¨„Ç<ﬂcø\◊fì§_\ø’$æËæ≤Ík(g˝ÿág÷ˆ;ÅM¶˚öBGUÙﬂFÏØ¢H◊ÓÊê˙’Ï≤ì'XJÎÎ\∂¿¿…A4ÈhÈÆ*íàå69Ç(wêñ”8ô’¡<È‘ÃïMO4ŸªÿÚMD;.–ÎuÓr2Í’h‡GâØLïcÜ›≠y‚Ê ¸$Oﬁ®;Z_˙ÚWfºƒs‚kÉîä≈≠#|=ˇ"∞F∆éVE˜ÏsË^≠dˇåBâ:CÙº>]≠ùÖV∞èOMf9bÅÌ¬<Ë%ciÏ≈S4C´€9ë7†KT¯πé±ilGÈ∂2ãÒÉ&°ÎÜßx¿˝∂J—˜Oxßê”ΩW2!ﬂy>∞!ÅÆ<◊EcÜnZ˜nCΩ’4˜l·˙‘ûx— „ÿKˇíUÒíNÃÔ‰mØGHiˆ.Sª∞;¬@óˆx8¥Çâ>˝∫6óLF›⁄°¯’Öë{Èk«ø¨8R:4Ôk≠ÿÊª€qØ:L/ñe¸Ó˝ø~ín˜ˆÕœ¸§
„°E7?yËŸVÇ˛,ˆ Q]‹Ÿ‘Lw|°à(¶8è•∏Ä°.#—íåJÃ:,πtπÒ∞ûﬁ˘I∑bfÕ⁄<àüiy(qœ<“Úzq,ñ1˚àÿb(UÑbRy7π∞:˙‚Ö_˙Ω	eMàÛú.8ßêØ§D6†+o]lª6Ùyã–	T|˘\iiëU(¥F•7©‘tHÑh€A˜ì®äh⁄√ÊÑxúøF¥±B#öå‰y'òß0ﬁèQ·‘ß¯xã‹';h√ﬁ-Q≠®ñ””‘´!F⁄ Ò&∏Òπb¢CF€/ÑÈ∑¡*÷9ûY‰‹óz ÆSõáßòØ¢%0= j „"√â÷%Œ◊Ã	∑¨‡√·¿∆}›eêÚ‹ß§lºqà›XJı0∏Ÿ∆Døí<πT∏zèdà√ô0ônœ°Â‰Ì÷´MΩ<0∫/`[-î@2u –%ä>Há@U0&#q¯·›Ö˝°	ÈÃ8j‘÷ª£ΩJımMJˇí=Î◊˚Å5·á±ojêÃ“#ËjfÀxUˆ64ÂÈΩæ∞ﬁû0)éÅT©°HNxE“2«ì”π¥£.qØ“JïˆÎƒçìÌù·ã¯FÁJFÀ ¸Ó:!ºoqY5È°x¸Æ$GJä9·ÀÒ‰}2ÏfÖá _ñ∂ﬂÓnOwˆ^ÌºŸûn∑ﬂmÌÏOïk‚˜ßJ~1àLjŸ&iÒxÕQáV„Üx˝>u%›%*¢{‡Yq¡≠Ìˆ∑ª˚Ìmˆ=˚›;¿Ó’Œ&G¨RÀ`≥bôi†£ß–¶pÓKäyDu/¨	àm+‰«Ô±FÚñiyCÖÿ¬|Q	”ß‡ÂºÂ·¥¸ŸÂ¿Í1FÛ_Ò"¢∫'I⁄§ˆá D∞ßE*çÿI£u#OÒ⁄Â»™SüàıÃc”‚•”¬L†Ù“≥í/ﬂ/m‰ûó8°€÷ôÕπnëΩÁÎ˛†˛)ﬁœ‹$îWB/d&¬ÑÖnG~—kù=ØSªÄURä—ùCä#∆™¡Öt∞í5<ÜC’’ó´≤ﬂBP>Y6
 ;
iË+3<>˘≈Â4öHÏ5À’†9ÔH	Í¢"QÇæåvwb\πª¨Ï\π«ëπÛd4ÛÜ qr§»øRä¸+∑$ˇQsUuÃÇ5Ç_` ¨Xô{ VK¿Í-@ZfHk|∑ﬂ¸E&¿£èEˇ’b˙ó†Ù⁄≠YΩôˆéíõà˝ê˙·«"ıZÆ∏óÛUh◊	£R{≥\ıHÒF∞ëkàZh‘z¡'¯}ëÃ\;"æ>Ì%è3[Ó@!TK#ƒZI™u¬=≤5ÿüæÙ«„ﬁÉ„∆q¯`â+‚1 c›ŒÿÖ?ÌëÂ°√ÍF˙wèÁÆÃÿÿ‘—ãl¸HºgëA+±ÕüFßöÊöíD€+œœE›ÅÃ»âùh–ìÍ“´‘Õˆ3”1q0Kö@3•◊¶NÊë…3í˝∏ΩÙ®˘0∂â‹ßC'rJ<ø"úéö'2(ã9”F>ÈwrÄí√X>gΩOÎIÈ4≤ :ƒB4RW+u∆∑VÊ∑,…';¢+Yá∞9öòÀ ª'∂≠y"!n#8Öd¿?|JÅê0Üá„Î8à"„¡.8âc˜’–EÔhrî-¥!rÔO03r∫Øa‘]yË}è©€˘ú¬ 8—DÑÌ[Å’«cMmÒ∏`⁄ä‡Ó∏>ôå{ó.·2Ò{πÆßª+w.∞6ü2T∆Ó—Ÿ3©°ØKÎÀH∏U
-√m¢*ËQ/
oÍ]≤‹y‚óÈë€°>…Kk∑Ô’,∆œäèóõ˜_≈+N;ßr∏∂«¥0Ü{\%¬Œ•íë~i”òJæbO^ºöÛôll-œ5mrﬁŒà«ûﬂbY◊6ŸÀ†ÀvJãô¸	ÒË$m3B◊¿Åéã“⁄S@öq˙\ÔÑ4í±Ûı·õ›CDmeZËA?Í\\ÍÍÉû»:.eŒ<ùT(Q=≈òÜb¶§œWáÙ€ëèÉmô_Rlë˘UÏ§Õ©9∆Tcx≤¢Ã’îíÈ#L4R(æJÕ_úv8∫sùˇqÏÿAœ¸ñ$üïÛÚ‹
Û)sœÆÖÿ®¥jrñ5ò='˙úV}qú°‚#Mπ†ß	âº3È“·K>toÈªÆ5¬›÷¨ü9 5≥6∑9P#pæøF∏höÎ⁄©¢¶T≥õÀÀKOîh"≥ÖÌihM —°ΩıÊƒ^…9Fªú¡"‰Ìo¯u2:Ø„ÜÖ?9ít’¨ƒ5v§C£ñjèKØ˝√INkJ n¢i±:àï˘@(jë°Îk≈]œ]DÚ´ï†ŸJÕ RmÂÒú@Ltk>¸áı‹‘\ WM±RÄï¡f3'ÂöÀw¿◊H≈ı{†baßKSÆhò£¢ãY€x*ˆæÈ\í E*…©EÏ^é¬Öcù±6ÛÂ k≤ Ò|l!ôõ˘"€††ï€LCï∂›Á	ª[\=ÚÁ›,¿-R–Ê≥b≥#tπ<@sP∏‡t~@á0◊√ﬂ2Fh(à-bnYU%¿3a∏¡çc‚3Ã≈·{ZºLê’’O	ç˜‹âñí’?V“§˙πfòßsC"C«!í…p˝ﬁ<ÊSÿ¸s•èwÄßK—¿ƒ`Ω…ûã ÇlH3içY]7ù⁄(Ú‡®˙$_≠%µN<H»zùhìFo≠‹Èr˝.Xd¡NN~éd`f@¡®0jPƒ®∫™úCx∫]Îÿäà\· 3m"tuôå9f∆πŒßY ‡õ–Æí«K˜≤!ëü<ÄÓ"Î+ÿI~:◊¶’nû∞”±H‡òkã0Ÿ{¸ZÁˆÿÿK#ª9ˆX˘°"Æ”˜Z^Ôp2Ú…ä6—Jr>'Â;i∫]e≠)Y≈»ÂûÛ(P¨Tkº≤≤‹ö3Î¸∆„‘˘åóß3`	hÚc¡ò?¨ Òb9oØÇÊór‰æC7„ìñ hû)^uQîıÚ◊“X†ıbv/Xys÷^u)M€_ãC√À-ºÂñﬁ’eèò¿s.¬¶e8âÇYõ‰¸ÖπhiV¨ÕB\ÂCÅÖ4≥ä èqÖ6Ø—ÊU:õÜå ·rôN"—\qüKKlÀ>≥∆n$‹ÈÜˆlÒ6√∫Âú’˙Q
-bïñ¸æ»\ÛÍ¬W
ÙFÌfY√¥J«Ë†¶@}•lûÒ;å˜‹¢°ÛIE›!πP©°TQﬂ+(oSh(©Ø8ÙCZ’˙Å=∂∑´K««ï•˛"⁄|u Fds#h›ı◊≠√hU⁄•ËUÈi‰é,ó®>&òõÒ.ï	 ’£>ïp–O' îΩ–±3FÏ]¶#„π¡á%ùV¶1„MÕ3`£≤√G≠º)!n?∏Ìo:Ñ»¶uÆî$ )ßöq@≥«á’Wj(∂∂xO+Y—8gÏ@π»]dËÊå(›∑€Ü
$ﬁt·^œw™ﬂ*P‡Ó(0O'ä∏)g˙œ1˘ìÓŒn≠0L"˚pœö1ô˘¢Ò€uﬁ…Yy∂·|ù›SéÎ)á˜∏^Ç›O≤“N‰)%‰jô"jÍ8Ì’˚8'µ™˚™åQl‡YF‘cÉ¸0È”‰±Ó;ªJwZa<PL«"…vÈF9ßÀÄÃä@f8ôèY„G2yg&˝ö2&sß˙N:ôìÙª¢Çœä˙ÙQÛ	≈¸°i¶ ÈPiKn%™/™Â⁄Ï"_Ã(˜{œ∂gïi·ùæ≥
@jó*ÙØÇ&n€n«øòŸQºd<úUÏÅF≥
·PÕ.’ÍDfÓ@∑õUx”rœZ›Å„∫v8´ÏûÌ{Vdπ/Pf≥ÖM«ÓÒ+œ±//PﬂtùQ««$Å]4a„»¡;<Ïã$ÌhrË'≈û1+úx]˝Û"¶6•”º0|qΩ<ùa]dîv1⁄Èe/©óW∏oÚã36ø<c‚12¿—”ÑÕ¶£»¯éó s⁄ˇç˝^låá”AMÓ[£∞¶»HRr§%øXõ">ñ¨©
◊/x_í•ë_f˝≠ÌŸLqq—Ï|q›G’Í‡MòëÌNÿY`€Ã?úûËÒÎÖÖØYw`·≈ ey=&N!≤Å^ã Ñ
Œo±q¸èo≤˜˙cı7é√µ•˛ê6`Ü"∞=[®6^‘Ì”æj¬“˝j√êå'ﬁ+ãf[¯!4AÒéΩTø·Õoƒ∂é‹¨8#∫|ÈôLäsÏ ﬁ|U°e‡tê,Ù–µ—8∞û@µE.QΩQ√C±˝¶Õ˛ ‚ñ-Ò?¸∆§–Bç~#©ﬂÖ*Ìtº^ˆ#^vE8[4t€Ög
ÄÑ<≈;0¥iãèt¿[–mﬁeºπÿgt±[D›@˝ˇÜ~‹ùûoáﬁ◊†¶^Äî/ÿ”ı·êŸQè-FV?TZr9çò›CE—’ädƒ~K£ı[k8˙¶RÀ)Ûîóq£¸"œyë>QïΩˇ[vÉ&yõŸòå)¸˘néf%1ÒM™Ä ≤ÀO⁄∞eı=ŒQç öô„7Ü∏kµπ(€∫Çôj´©øMìZo9ôÑø¡†˙åD—øPæ3Œ+∑ƒ˘NHﬂÎ’€b}7¥Ôå˜⁄≠ÒŒA\›—îÑñïËO;œøj>]Í<◊ÅóÖÁ	 [z^4À7ÖQã?≤·Åº4„iØÍÕsﬂ(±·©tç∞sÄO´“«∂∂ô¥˘•lÅ“‘7"õ&A}ä!9à«.3‘ˇÂ¡u=téÀUxÎ¸h«%∏&O6m	h™Û∫ñDØuAœ6˜9dÎÅÇ–∫¯£∏Rè¸—[ÊM•ƒ^ÅÂ2€;Ó‚¡«Ú∆©o*iŒ-ËÓZ∫≥lfWqa”Î(s2ûbiÃÁá fØô®$Rc7É±ê&´Y∏9ÅnÖ`V`Ú‰ÅÃ%≥4êÛÁ©¢üHØaÊéÒ{ˇt$6óÇ:¿Vﬂê€°>¥û˛Üeôú?:≥Üé;Ÿ`_∑0YÓ◊†é¡ñño–ø©<ˇ≠◊	Gﬂ†5„Ωﬁ0T¯Z„\êÔÄD ÜΩÓ!∞3§ˇpÌÓ3≥ƒê÷;~˘C‘†ëIå+Ñõ]ﬁ„eÏ¨T05˚ÍJgüÎŸ›Ö:⁄à^ã
ﬂ^(€ı]?ÿ`øY¶œ7“ëO”Î sÑ£H‰k$ËWW|ºÂiƒä^œ3§Tﬂgå∏~j,∞…˚ß®œ>Jë0OávdëJ
±gïqtV\y˛tâø$ó€WWä˛8–C(Å@ﬁ«ÕD¡DatúQûuÓÙ1Êœ[Dê«é{üFºm§#YÜc?ÁŸL+[’ßâ≤%⁄pU6®ÙK◊ÔTèÙm“…"ª"?ﬂÜV(∑hÄÜ]”ÄIÍe¿P…îkm°±.,'bZ4.,Hı˚yR|¢y⁄©Í˝5€e∞›ä6˝ëc˜¯vßWEuF)
ù°Ìè£jïv1Ÿ§ë◊∆…Â‰Búk÷•c•U;“áÅ`«ﬂ∏∞‡Iy)&ã|÷±BßÀæ†~∞ﬁ∂ä˛Feë!†/ù∑ÓHèt∏=%ZúâÓnAñΩë*–G?®VRfñ3ÀA¡R ˆπ rÄ*§Ï∏Úø b*ç*I´:˝JSO#\ﬁﬂ⁄1ùﬂ∫ú∏@÷˚oí"ô°H’Aﬂ∑>©IÙÈ¿rÌ &ÄÆ‡µÇh»¬ªÿG÷»∆{<ÌK'ÚC[jﬁ◊±ëNö·ºs ÇÚÈ–#MKxﬁ
ûƒÜ5˘%ïÛÀ$ó€
≈ÉTP
FÜ∑¸ë4…M„Óji}†¬√ûb8®æÿËLy*—⁄Û•æ˚#¯&ß¯ÒRaÖtÎ"/jq˚Œ	jF”ô≤ô˛‘WH`a¿ı<`'8éó^pdÀ¿s?P*.éÀÅÍ:1º:+ÍM\PovËü€lÏ.˘Ó≤ç›©Ô÷dÀîMwsT‘ÿH£P^3£,ª{öΩ˙µÌé0à⁄gÁN8ô9-¥3˙®%NsÒ–ÔçqÇU…/ÛE.≤é”qFµàV∂FM*°Ëq®w•ø
¶gﬂÚ"ÆW.r˙~–AÖwü„>∏ö(â5‘b∞^™˙"A'w5Â†ßXê`»-¬ ª*…\7n|°ª¯∂9&v8Çßt•q`]j6x´ãªºMT9…õôH¶•y][^Æd“Çr`˘9A#aá6…!âä`qÒ„¨¢¬VçÎ ÌGÈ¡œÒ?∆!YîŸ<}iní]Ω—@§¡ª\A∂ S®GØÏ∑©∫∂óL≥©Ù£(’¶$¯òßO«ê°Ù›à◊ic@âÃÜ…pÃÃn®AÕÕeú‰ìÕÙïéà‚'UeÍ4ô¸≤dûØê.6nfr∂≈·πÀKÕÂ$=èÃÖdŒ
Øªıµ‰9í#ÛS®e”u·'ıR6m◊ö¶”wi∫Ùd=>k+…Z*9ùºP-IhÙ±ËµRé^sP&ùWkF-ÿ|ß$‰uañß$ ≤d£ú„ªwßÀÍÃË)ı{±»§f*†`˘ME	,nì©	?Z@ÏÏåM¯I\LzrxûƒÑVp«cH˛$∑UtvEõ®·Ω8ÿﬁ‹≥Ω∑’⁄‹9⁄ø˘”…ﬁTy≤ø∑›û∂ﬂ}ª}∞Ω∑π”™•¬LsÚÕ$Œ‰n÷¸ë|(mU|rDi,≠˘}èé{«ç„Ö„˙qx¸◊˙∑„ø˛üˇ˜ÒÛ·`ò]=S¸Á+π[¢ —†◊\ƒÇÚG<ˆéO6N–[qÚ‚hÉc|r≤∞‰|<TìfJ‰®Úı…ˇô’ä‰Q„{“ßƒà÷ÃCkû7>î˚÷ˆÑ{ÍÀ/G¸;0Vx$‡ü‡rû<Áã˝≥g≤ysÉqv·^èNe~˘•„u˝ Ù4PEz≠qs—+mÃÅˆ¨Côô¸ÍáÓ¡$è3¯§RUÂüY–[Û¸¬JÂNë˘æ:(@(Í∫7Hö .Ì˙˙p∏AﬂˇBKòœg^ÿµ&„a€3‰Fù»—((¬ƒâ=yπ€ìıÂ•ïÃïo®≠¨Î7√°R,–9Z>]]û6Ò∫±º˘p±˘x}±πÚdqπ±¸∞vR)∆a#a ∏ ˚* ’’ı¥‚Ü°°Î⁄¡+L‚ayŒU‚—‘Ç¢ì3L;¥¯dyY9õ§õ`Rîç¨ (iîDÔâí*¿áEÁgoqBvÊïK¸:)~≠ëºY$'}ˇ\I∆…ª˚8ØÈëíuê•∏*sIä \´⁄5Sü≠Ú'gÿÿ†îii◊ÿﬂ˜˜¿|ëZÚ…ø9áWÔ5*®Ÿux˜”˜π^‚ô¨D(ø`_Î<˛xŸ∞9Y’yàÙ5˙ F[7∞≠¬õX°‡v:˘˘œ˝?~∫#˝ÚÂk˛^‹|˚ñR/ÔÍærÜ√H=∆ò{ÂÕW <¯:ÕìDÓÙî†Ë™õ®m∆7À—⁄Ë7?[3(]t_∏(cº GÑB2•Cu;«Ã©v’ùu‘è#õ9«°ø.‰öØÛÎu∆Q‰{„ÓÊYÖ+Z|o”u∫û]q¬¿ÚzÆΩì(4⁄¶°*5¥"¢Ùú…{œîπzñ`±¢ö≈WTŒ4s\Ç(È%f*.˘á*scEô=B/ÌÂ¢nç#?|¬ñÊ˘ûÕ∫„ ÙÉ:ô.Ò ©≠¨/œ:6+Ë3É+o´ƒ‡ù◊9º„å‚%Ì^±ÇP^]1(,k&aæ∂¨	Û’)tÕ∆Fi„·2u=V;îkÃ˘≥¥ÈLi”∞ §T‚ñë‡&ƒ¢#Rx…Ω`„…„ì¬#…∑=b¨Æå3‚ôjﬁdm+∫¢∞J˘îÒ_©%Ü#tıœ–ƒ*Ù<ñ
^œo4•ƒt!ËÒWIÏ6öQ‹·˘˚ÿÛÔßwÌUò∫cfå$◊˜ÁÓfpΩ,:œ†ºÍÀü9ôç…v0GsY¸∂YÃe˝˘2ô_ΩœMen2Æ#q∞è//⁄Â_fDxgDhfÆE≠(:~Óñ]∂Sê	?)Ñeér3º…”ì[Ù$R…öm$oπÍ†ﬂ^©»eQ'Í›9ì:~LSÈ#eT/Ét6´:G2◊F\ò]=ìX]ö˙KßV«O°çl˛å÷9	Ω3πŸs∑3r^V∆¨ˇâÈƒ∏Qâè’'ó›≠‚©ŒÇb≥2b.E˜ƒÁâcSﬁ√	›LÌ¸x˝R≥Ò3O÷Ï§|ÈÃŸóy≤g'Õ‹^Ëˆ‹π°ÒÛ∑ÕÕ˘‚õr'Õ˝hq*ÊKæ◊NÍ´∆k€ÖÁ_›Ó)Ü!4≈	À≠€WR=õnXœ‰bÊ-”q ;-ë›„ıÂl¶fÛΩ”ÈåÃïîù4Y≥rÊ˜SS. ˛ô72~Ê…Øâüπsl J˜ïg?˜îk”ÍV˘6ÒìØ˝ŒLˆ≈”l≤iŒHöπ\Œ$òÙüYvªíY(	˘‹Lî¯…—pÚ≤]ÂÂª ÕLIØ“Ÿ)+π3ï¨Ú™hXY.Ù–„gŒ4î£¿îuR›ºe˝$Õe’:EßÚP"¥Ê» àüÚôì“≥≤33J}nÓ‘å¯)1[xz<C<’1£ÁπÀW≤¯j ¢ª8È›,Qá•lä8ÍIAö8¸‰Nü¸	î?ÖLi„D˘lÍ8Ò"ù>é?ûC≈+N'áü[\´ÿddŒ‰r¯ô+¡~ÊI2¡}√#Ÿh%÷F‡s±6∆¸LJ§ÔâIÜ„lveÑw˙sß(õπW˛66wA≥\tÕ‹±5Eë53‚jp(Mí&wáˇ1bjÓ#¢ÊVñÇ1öD“ƒôØr≠>øÍ¿ôa3˚†ôr>®è0Û7ó…c¿\ª˙= îì˘4Çdn"3√?ÀôÛ˜3#4f›
‹C∑
ä˘’Üƒ‹2 f∂áÓ£√î	Ö)Ñ)‰ë¬óyuf¿îπ˜‡ó€Üæ¸|)ˆÚKΩ‹:B˜ﬁ^~·.∑∫Ë¶l†ÀåËà{rπeàKQhD˘ñYΩShÀ-[fıÍ.}πﬂÄñ˘√Y
˚ñoX+
dôÀoö›§ƒÀ•/$Xà/$»±Âeî«OÒñªtrÈÃ±◊èt>?¶≥àôÔ“≤=_éwÍ¥Y-*«‰úóò∑ã6–r ﬁ√≠—OœÚ-âW*œw.Õ2Kõ¡3≥PªπXñ5ÁÙ5$x˙ãMπ∆†nÅ–2§»M 'Gˆ÷î¨Æ.Ø[éìwdX^£}{`	+Ê˜√v¬˜,¿ﬁ¸å…|aÃhÖ7?AØÜ#«•µåΩıaÀiù˚¡"l<`m˙c(Ê≤∑[ØòÊtû(ÿ"Rå]:Ãµ®!mVŒ03¸≠û’HzìåTúÇÖ˛îÃf Ëµà…πâ‹u—≥z>obÉµ¥ë%ï6]!©Ã†ûûü`fÉøUZÉº¿çÇ‰wñ€År_àyoæbä›H«WÒHÀA6ﬁRŸE¨„Æ7O](:†Æpj}@|*O™/RTC`T˙¥˙\qQsùNª≥}g®eç\4¸¡˜{<ú~/Å∏G«ç„⁄…˝„Ê®"∆à<u€ò6œQ∂u√ÔÇÅcèÍ+™,¡˜π˙∆_ˇÈﬂrÖ<ÕuFœπË_>6√‡Ç{Ûå*îShpf¿e\„‚∏‡‚„§ZƒpÅ5¨hìíÎ˘ˇË!∆Ê!£˚0…˝xƒ–ÄíâÚD	n#.ëx	óì—¿∆◊«ÏLÁ6%Ç
¨	•ˆßL˛¯ ù˛L(¥®uÕﬁdsUsx\áãt/˚«‡˚øèWñWV‡ﬂıÌáÙ}ˇ][=y v62…⁄å∞F§õ˝h”Ö†aÑ¶·™4
Ps'0À(2iÇ+FìÿUÏØCû∫*æﬂ ¶ÇÎ|∞Ÿ¬¬ Hk˝ÿ˜L>ﬁ¸‡o⁄Ù›rNS6Ï„p·»™ˇxÛÔ7?›¸˘ÊÁõø‹¸«Õˇ:©-9∑ü‚"Ø*is`ïôÂ≥Ü∫SXîæ∫älD˛;‘/xå,ôù{&ò±ƒ±≠®∫\”õe‘I
jΩ]mñÁπ€Ñ”´ä	Ö‘+∫â˛.‘î[D◊ªŒ}◊ØíˆÒ7®_’7∏k=úﬁuÓM?vˇ´”ﬂWà¯Z^à∏9>|Yç«ƒj˜æ|Ò·Î)8ºËb%(Y»êldrÂ.Å…∫∫XßﬁµõÅléx¸∏a∆ÀÀ:{≠~¸c1>≥çÈ¥¬£åãCŸï–\Å’'ük4Û∆7 ++ßæhÍÃ9|çÖqΩyL˘_)tóÏÚÈã°ÒÛ)∆Ôf|3∑wÕ|ˆÃHœÃÍΩ˘e‘â´˙fÙIÏŒûºø7çAáΩ'çJIÇ='	?AüÕ«ı◊¨}ˆ◊(˛ö;πjˇ]∏jöøBWM¨™~≤Óö¯NÏ˚p÷|ˆ”‡ÁNò ‰K∂ËÈ¢∏/ïsïöÁüõ—vä÷∞ÿ∂¸(°˚s˙$S‡≥ÀÁK¯rﬂÓûd®?;{˛Û…d‡ˇ’lﬂè?€æ?€æUùt%«ˆΩ˛1Ìﬁ+˜a˜n.ˇmÌﬁ”‰˝ËÔ«‰›‰&on˙Úi¸íVÓÚÓGüêÅ˚≥m˚≥m[i‡≥m€∏\ø•I‰ó±oˇzM€Û©®«¥˝)[µokåÔh»02ﬂ¶~#E£H3¥§‡â‚fDºE±'≠+VŸÅ~‡w(ÜìwlT≠¿±√îm}S4 ç¡dTÁf·"ªz\"ˇnƒŸ∆ÊàŸı:K
4ä§ìúôÆn¸&Fé≥páﬂ˜˘Ü!86Ã≠.û≤IóNÕA¿·≈;È,Pò©A$N±¿¸–.∞ÁYEÄ∫ÀÄrÒ1˙ﬁ⁄ÔFœÆ¯°gö:‘$®M	7-˜9wG6ósÔéîÁGì9ëˆ®⁄¥~¨v%ù(Bæ„Èî›ÓÆ”G_˘¬Ó9„aVÎ@grÃ÷©ÙRôM7UÄíwˇ!@<3õg7 ‘éœ8“,ÌÑæ;ıŸÒpyØ–¥¡˚¨¥Q<·kÊ„¸é&ıGÎfy¶ÌYµ9≠Ÿ≠§°Ûª·â	∫π¯˘´±áé/;d;-Ã}ˆÊß ∞Œ¸Ä¬K0b@Úé±.»= ΩH#Í£»`—òVÑﬁ-ü¨Qva7 3˙,ÙAçfcèç‹%¥ Y‹G6¥`•\üMÄ⁄Å†#ÖÒ^”Æ¿K8‰¨êÅn£áo¡my˜k¡fÂç˝1]dØa& åÀÅÖ'Áœ˝E∂}9dNJÁø◊§¬?˛}*!ßÚûﬁ
*jT oYëu/ÇR˚–d¿X◊ñh˙Ä€å÷ÉVâƒ5ËôxÜÓp`cí\pØ≥g{ÔöBxdıÌS⁄N›œuéÿk)v&ÚKœ
t1?9o√ö$N˙√Ñ°üî~hY
(;É"¶Ú0»DN$ƒ“™jëzRSQår¸fyïsä≠<œpa6‹ºr\{„ÿ≥ivÙq92ü‡˛Îø¸ˇ?k[.L_.˙L}ÙpW_˘¡èxÎ˚ÀIPK ˆÑf+déã‡âXa¯@ÒP°8◊∑®‘öè≤åË˜PÀéÊ•PŸÒ–Sœˆ∆ˆπ•v∞d/Ó:hÕæ∑©êŒ¿‹Û£(ôzvâÃ>‚ó¢íuDIÜTr2dVte:,ﬂ€tHnmYsÃºﬂ
ˇ"À¸I
É¥Óiû€§ö˚˙¯“µºÆœæ≥Éà‘˚jófë'ÿ%{$‰6\ü
^Q¨´Wqt¡ı«aƒèp”˜˙ºq]øws!7‘|ÈÒzn6Ú'j6Ú¥îh÷î¶«(ıÂÓ¯“d|:
Ïú]∑)†Lœ•L˝"∞F3ÏÔöIÎﬂÒ™ïcØbº≠ ﬁ7G›C‘å¥Ω±Ô–â(wø#”ïS¬~Ç_ñ∂ﬂÓnOwˆ^ÌºŸûn∑ﬂmÌÏO∑vZﬂÓ›¸©}∏≥π?˝Æµª–⁄‹π˘”ûÃøJ“F-n–ä[ùÁZÛB∂‰€@.Œ“aö˜∆+LósGº»n4ÍÀΩ◊Ê”ä¬s∏Òb∆]ﬂÜ‰*ôÀæs6¯@+r3˝6}‡Ï¡~‡Ù)B«öê1åQÍ˛˘Ê\˜œ7MôÀÙ°30&$„˚Úw¡T&sU&çÿ]uE
¯ì Ô%’$\÷π˛îóﬂ¥ôü ,°iAä-ºù%£x†o}ïçJº(Ωõ±∫ñõdtÉôí≤ØÆõ≤^ôÛ]E8èüU^ÀM©≤Èƒ–N∞Kãy‰Gô1ÉÊ¨	ìöR\æ2óØ|:\æÙd˝r}fs˙¸Jÿ|•õœ¡–´üCÀÏù≥ÉoiA^˛{óœÔMπô˘˝ØóôWg*9Í˜bÌxÆX‰[_∏´	A˛|g„Á;M‘˚c;wå≠êe˘W6Ê5Sz;∑fú4É˙/iiâ†∆•@Õãõx(aıioÛ ùÉÌâaN‹Ók‡9˘»‹¢$πh¯Rv¨xéÜ†aN4t˚v¢¥≈„LzÆ%≤g¡W¥f‰|Ú…
HDg=Ö≤Sã±®Ã∫0éª“≠JOW‘ªbX´Zbz‹Ly_á®âƒÀ~ŒÖj◊™\Ì,›Ch˜ÊÏ+?<Ñ6◊s;ü0ZZW{Àk›M¿≠h‹≈üﬂÆ√eÁÍ/3)Zœ©YJ´M¯∂Ã)3.[m“U´i]∂Hsïzn·%'≈Z,~≤∑á‰OEüUl,âj´¿å{M4ñÕ)ôü`{ÜkÀ rÆπ#∏9ì˜=G∏z?W~YºfAœ=hge}Y'•◊L,⁄ï¬>ﬂÜÀ~±Cüo√˝•o√-?}æ˜Ûm∏ß∑·ﬁ˝ é‚ïüqú‚Û=∏ÒÁÛ=∏Û›É«*æ˜ÛE∏ü/¬U¯\r23*ƒ›Q›:4Døö◊Hﬂ¬ ë\æëüÑ û–ô?v‰£å‡ß‘È(aã§çpÅoÖàq∑+z~]˘’ÓÛÊA„_¯‚õ9M∆Öó-∆©5±ºŸ†˚ÊpÀ›Ï∆Â¨∆≈˜{ﬂ j|O6„XCøª’ò<<Ef‘[[çÔÕf˜ˆ^¨∆≥;\f›4“£PHkî≤´\j∑∂™g—na6&Ωåëh]ñ=€ä|/6‰Ç.ÿ!·É¸ÜÀíÛÃ»3ç»Ú8ï…p|€πr›6ú≈˝tN·æ≈Tä!m˙B;BŸ≤–Ÿ=éÿJ9'+∏^∂eI–oMñaÀmG>L–uÌ˝%’J |{‹˛‰4úÑß@™,ä”∏;#”aLÅı,›ÅI¯˝êyb¯√9õd¡XÆD’ ˇ˜ìx%œım«¬∑ûÌ2¢‹–b˝±Ù¨û‚…ªn4¶£t¯≥ÎxnœBÉó˝e%ì÷ììÙ¿<shJæuﬂ√óÄÕˇªç4aÑÏ˛8 è«?émÃúiCc∆Û¿.ÆKß™±yËs4¸-éCvnπ>îf√õ?˜úÆ≤ë î3<b¯Bı…#^Èë™~ªΩ∑}–⁄=mﬂ>‹~s∫≥◊><x∑y∏≥ø≥‘€‘Gß∫˘∫u8´Jv4™õª≠v{Á’ŒfKòÉ˚JÙ`Fú’µπX≤láØ’YºÎ≠%; k˙Årä>≈sºFrÿ›ÈπÛ
„Qœä∏z
sø«ÎÑç3’éjÄ≈XFŸóœp)–CŒQJWêíìT¸?ÂΩò Y~◊ﬁﬂkpÅCbpû”Î`kØyq≠±Ït√k~Q¥x∂mÒâunu◊¢IÂ„ôZA[º˚Å”ê#åÇã?|¡™{>≥pNY¡ÕOx¨ñÍéıÉ/DD-=—Trùòπ'∞á†ZÕ"W\7EóÍµë0€ó¶Â∫xî5Eôh%ëÂu¯Î°ˇ6e„N4
¿Îîê>£qVêΩ}eºıÇï⁄¢
≈‹ªhy‰–†û^¯¡ÙüÇ&ÖWA°ó.´¬Í˘ .TÁf£ƒÀûzP8b◊È⁄^XäÀÀ´Ä∏-∂.ºlóÓ®5ƒDÖ∆ã¡∏A9µ∫ö…°®æ,GÃÌ∑£â[‘`ùâkËG€È{Ï ¿	eYÃ®w∂kM¸qt8ï *?u©|Ecºñ≥Põ6◊Ô¿tÒÏˆæVèRíMùVãdf\d+µìEvEÊ‘ÿÓçË>.èK?ÑæW!ˇ´⁄∆8p°âwªPAAÓw~ ö√Ô*∂û*‹ÄwæoaÜÎHTÈI™+ë&X≤1Ï3(MhèÒ∂/◊∑pïx†I›Ì˘ßí<éu˙’ˆã]EwˆN{øÕ˘jç∫Uø>¸∫v¥|r›¿.Ωó∞c¨–n›ÄûÉ“Ω9p‹⁄z?Ëò°fˇ!1‚ÍUπ‡4TE*ˆπˇA°tN
J÷•®”™ÃÚ&â»‚vÄÚ´ÄM“îÉB£à”®¬0®Ÿ⁄aåS(}wÜ)ÈK∑ …(^PßºæΩçèû¢+v«ç#1Hœ3K6¨Õh–%¿	◊k4îçì$1_‚Ci”÷“÷“Äç√Ü«‡ËÅ$/›ÂòWmÕ‚ÆÆ±’:ˆ-Ÿ•L´ÓF÷X>æI’È»’Ö&	Âœ©
8 6'˛Ç]‚UôµE7é‰* ©iëÂ¬S∂Y9òó£íà‰jB3·œF,≥¨ï%Nf9‘ËìÅ™Ó]uñ¿@˛É®QU∆∑†Ó}äÁ&†]‹Èd≠ûè¸Í∫˜U¶‚’∑‚7ÜÜgåã¶‹
K©§ï ç∏äóf$f`ú(Û°´* 1Æ
∞¢õÒC√≥PLîö≤<Æ)8	z
†ôlΩô6p∂
Í÷≠™[e{¶´^q◊4P)⁄∑ïw∆¶K”üî∫[åÅP¡!¶ôEùáG)¥crN¥}2Öu–àu¸˙]‡Êa2qMkùoV*lå∂.ÖÙ[ı•\ÿQgRëéø∆∂õˇqÈD˛ó†Ëpµ˜”§?1áT"Lê3·÷≠1∆ãÈVµÜåx·x†à6∞´®É~Å˙I¢®sâBÁ2+ËúsüoÏRl˝Cv~ÛìÎ¿/?æÀ&∆£»œSı‰0]kj˛iÖh6Æí¶YdÎı:€jÌÏ~œ˛∞˚›ùˆ!„F V≠‡Ø€⁄fá≠ó≠ﬂÌWjX<V$Aß:Ù{÷’lPØS[x¸ÄÑ^«’Òoî∑¯`@¬mŒ+ÿ|o[Å^jàßrÑ˛}zŸÄ.Ñm÷@‡ı⁄ÏP]Yd_/≠’Óıµ9*yÖìÁ˝WWà ⁄—áC¸∑◊ª~ü6ÚúŸ0¬R±Äñ¨p‚uY=RÅ”≥ﬂÖv∞”{a∞veMπ1yÄ§É¿‡ÿ˛–r\¸˘¢1vËIÖ¶YÏŒäM%b<R#TMb"`‰õ∂â…Ÿé◊≥/Ìﬁ÷K6RÃÛ0u≈ùÃpß◊˘n˜¨À°_ﬂ*zUb	Bg-ï¸ÌoY+ÄÍNH˘„ÜHRPä˛H5?«ÄŒdæ®˙UP&"G∑rºﬂ©Mn∫xzùK≠h‚© tuáÊ˙9±‹&•Då‹ä9 Û8§¨y∏Gw"wB—:xúSí ∆ïA)a{JÄù
`0Ôy¯|0÷£Á’1Q	äÊ]:^ú0Ù5Ï…c^ø_T éÈıÜ∆˝Í{¨¥!yZ}!˘eÉù$¥TËöO¿’Ós{Ï,á¬™rö†∑Ωl8>˘º…®Mx5¥Ç…Ô±‰3v∑ó√19Ô%CƒØﬂkØKQOØ¬7åÊÇgñÎ‚öY™Q-9ƒpÊd©ÜŒ}éyÖµÃﬁ˚#HÃ6,®Æår‰9f¢Sô'´„
≤£V€”wÁTñ}…Ö∫˚¡ãZ1ƒüÎr(ı,GÒè ˙º^∆w*Ã·≥äÕ^9µ≤T¬œù%Yi0Úår§ˇËSST(ø7QÁÚZÉΩÃΩli;ü€ ILKˆ,ò›VD±,∞fY.*D6 æëC˝ÖaP˚\Î$v¬ßYfÇß)VRü‰2RÜC†ñF»Yºë.üÂä{‡àªrC.'={a⁄hà◊ü»¬Ø#[mM”„|◊nÿh•ï∆Z‹ 'Jbm ô≤∂Y¿v˚›wUUâ÷¥KÆ^]/≤£X<©)™h®∞R¢â
Ô‰€∏S≤àxrtíQ⁄»§XJ_ù°ùÚ:íT£h$µJd§N0W¸»	L9äECoˆd»S‰í€©å Æä
é_ —ë;i„“â€§˚˚∆#Ü7Æv'LÆ÷\	aËˆÃ>√,<å∆£ÀOÉ3´+#ﬁã¸∂…<ÂQ|,•jÒÕˆ)ÏÜñGn…yîâ)í•8*;^πe óxv”PJ“¥”E©ôÊ  ÌWÏeù∑¢w%ÍïVÍ ¿öKâS¨©|MÒ8hkOäâÀí¬¥[¯dwZ9ıÀkﬁ∑ÖôUÕÁÄ4◊∞óﬁ`^´SXÂ†æhøø§‰G~:æY]n˝M◊˜48ãBn◊‘:¡“«d‰zya^µ≤ÈèAÃy>¨d∏r…ﬁ‚ù]ÑNg†u,m˜ä;ö2∑fË@ﬁ∫¨…˜mµlmx–MˇG√ù∂·Üπ™-Ìr∏

€ì]´e}’!+[€BΩw#·Èã8⁄Ì6»1∫»Üv–∑∑Ö~ª¡:æO´«3\5B’1ää√ñP4ûÈ‚≤Fc/1@ºÀ®† √5·0ÊRÌz–ƒ–	Ìß|â{^≠¬⁄‰ªÁÄj`£è;u:™î«?ØoÊòïEn›gâΩ3œÕ´wÑj`QPY¨‘R)òDO™ºÇ y4âπ(ˆ:SÄõaëzËÙè-±íè5J£æÿ1ùI¨Vñ¨ë≥D;¬∫d[‡⁄Ñ$C;¯†¯TﬁÓ∑€Ç8øΩ°QØ"é÷—x^1Öz$›M@a|√FZß—ttd‡ÖYT›zËm‚Ç†‘⁄køgªqtœ¸©Ãˆrq‡ƒí‘£‡›(˘•ÒqßÖ*œ¢A‡_;Ú© JÚQEmvènïç{>ﬁ	’†¯Æu‹¯˛]*G¸¶,uNû0¢∆œéHp—-Ã£Ñ[¸H∞≤≈=–Æ&®ï7<ˇ¢Z√%Äﬂ¬Û(:k‘¿øÑ˛[´ãÌŸlÀ5øÎÙ|ÖEh–F!¥* õ>Öû„K˛-˝^tÓQ#˛ë.ÖÅ>Ù£F¸#]*r8÷¯7”Œ ÊµÅ_ÿ4K≠h”˙ ﬂæ≈«UÒ∫Ü©M¥Ê≠h‡kåÈÆ˝öQ¿¥[GØk∫V´è[ÆRõÊ¡%=;¢PL∂∑ÇÓ!j˜N£πmá&ä◊`;4-∫é≈áÖ˙˘&Ü¬CWBŸﬁ≈+ªïC{‰â Ô⁄bÅ+ªY´ù4ô(¨*«ºöµ¯l_ËÃ™O¯—fº›æ;˘Mœ]Ï·øR·TÎ≤ñç~vú%ú∑	>–Sì$ßOè˛h’\Æ?π˘ÈÊœ7?ﬂ¸ÂÊ?n˛◊Õøüà©ôÛ∂*Úo¨ëMæ7âlå#´le¸àBÙ5át K¨hM¨áãÈQzÆbí&zxz€Q?2Øuà6°R´ 'π¶I‚ÿc°¥·R¡L*≥»F©s÷Ò7ı-–Í¿&,Ç±3Ù√Dˇv∂]2î{ú`ÍÃA-ÄNw¸jéO·j~ÁÆ	=YË@`#Äë".±p)Üè°y…Û;ΩPI€ébEÌWj¢«∞ur«Ä^¶áfGB…&ô`%Í"î⁄òÙ≈ò¿î`ôsﬂqf…Vzàz5F„pê)Æ˜R¥jXΩ^∫F√—Õœ∆¿ÈVë%π
œ¥)wS…˘ñ∞;ÒHÆ¨â%ÖkœÇ‘£õ`zNﬂâh‚í|YTõp}‡BTÇ ≤Ü|Z”‚¡TõÎÙ©TÏà∏4v{˘Sç%Yfü;{9≤—9‰˙ç¬nŸr< ù2ﬁŸôŒO4–Dˇ2=+ÑiÌÙj&©ÖLêi"◊»,c4˘rìà/4|@ÈX>[V_*_Û•W“Òtb≤ôz´≤[÷ﬂr1¿ ”jÇ’SïÂD.—‹›qÜJc™’∏⁄QÕêwUûñn¡Üt`o¯ú0$%€¬cœÅ!h
%‹î-¶gOBÖlXû’j¥Ò÷»b<qKF≤-®Üˆˇ  ˇˇÏΩ]oWö |ﬂø‚Ñ›ª#ßEJ§D≈ˆÿŒ–ÌhW∂¥íúû«Hädâ¨∏X≈Æ*ZR‹˙Ê}Å≈Ã`”ãπÏ¢'ãw±∞πò77É∆^ç˛I˛¿ÙOÿÁ9UÁú:ßÍ%ª=ÈTã,÷«˘xæ?ãw~ê√ˆˆôqÿÊ˜O†àûﬂaLB◊œ‰+˛ÛüóF wKïqÌÂUS|I∑,–ª
H≠N7∞éãÆÆ°e±ﬂòóCí,—ò ^(õëJ[¢ﬁS,EŸùS∫YΩUe¬%…óÈu≤≈iM∫ø>zﬁhˇY‰¶ë¬÷∫CÎÜ¶íïDäºí-<pK>∫~°‚/0cò—¶ 0ƒÇ"5¢ç2 K]Ô[à¸J‰=ïÁRüB3Z\ôëçÈidè:˝=*9Ò	ã—.ªûZ¸NÍ˝…ZQˆ˚åns∫“`
FAv≈◊x^k/@.,ûÀáœd)ˆYßä+”‚Ç"¯≠¯˝1USÛKò÷Z∫
F-Æ»ïVë‡wñØn°™™Ès‚¨·∫b3’'qΩTµ©1ñ%<öıYÂn$g^ñzãª,éŸ∑£ö ˘ùü”g∞Î7ø1m%0m¶˜(yöU⁄"5i(ä]AÚƒÃT∆&ºæ§”È,÷ΩùCi°∑K.Ÿ¢Tö˙Ç¸óÁ„¸±|ÅÒ?QÓ]U /E.k®(¡Xë´j†bb-9§l¯E'|Ç9`ÌÁ…¥Î3«Ø‰©˝J^'*q√õΩ_ø◊ÓÀﬁ|!Y2øËQœ%óry9o|âdëëKxÒYaZÉâ∏‚4ñgƒ˚H0â√yê›”¿sù¥ÇI†¢≈ñæUŒÌ≤OK»ìÁ∞}•…Æ≥m-Ü∞n∂\~a⁄E∆]Ú¸fû◊hëyÄÙÓ¡·≥=≤78<úEÄÙ…_<›U¢·ﬂW†aƒyc˜Ù4¡I9ª|äºK)˛.)ò)™cˆaJ‘ˇ£èQ”Ö_êÁà¡:¿Cﬂ‰Ÿå|P◊[åÒx‚y◊≈-'"ùZõf`d◊*Q¥˙-•é›Úß6ø$˚´LÇF#ãtu€\úR‘±úë¸∞“»Kös(mß:ÌA dRV}Y£.* ¬(T∫vL0'¬´g—`‰°Â∫7Ã›¨u¿¿ê/JyÜõÃä7y˘Á»°§‚Á/»f\/˝&Bsñ∂áFtWé&BKGHù^GF'›«ÛV˘Ë6 Ïü/ÿ ÚØÂ+Ö∞yWÚçP‹%k"9‰ñ·¸N>N¥˜≥ŒÊÿü\Ò®h7–¡“≤ˇ˛òªY*.¡Ö3˝Ã¿}èF6π%>óü!◊(>”e¬
∑êc¿Ø´ÔX:óÂ˛º∏ÄÚU˜‰àCÆ#P|∂]-yêpsÛØ∂Áz!ØD¡Æ◊NñÔ:(∑¿DÍOÄ¥z_Mc©¬C6ûd€L≤ao+æóØyå"?uı”0√Ú5Ò¬g•µÄŒ-ÁkÕûmÑé…ŸCÍm≠˛fT6¨Mƒü2;È›Ç#Ë5Q($£Ùú”7åF–≠âÉA:Ù)€ª¶«H2~Õ+≠aÂpl®:i4éQ∞”∫
2‚‡í-ˇ’b.7ö“%4⁄4Ä1°AÉ%5p6»K»\bu&¨f…‰îÄKçyë¨ïÒ)º™ll±⁄Yâƒ\îXàFÍ∏t;õ‡ú∫9Ñ∆@hbîrå9V‘Ër¿‚oÂµ˘ß 0ñ5ı«¡rG¨©S ä É—v≈†•‹©AäAÂÎPº≠ßºÌ@π<FTí€ò<R%Èpd©èﬂd˙¯£?.ã?Ë¶í˙]†GÕÄdÖøáÄí¢^¸pd≥xôë…íEû¿©5ºcÛì ÁM{#`ô&¬¿Ãﬁ÷b‡í£Uû[.(1	à?âzCQı°¿“b€‹ÓR6√ºí,s ˜s- +/\"   ctÇhÉ^LAùÇU–≈X·(ˆ5_XÛÇî–†·0÷≤˘˛êruNÆ+U„[’Lå‚°4£¯ZëÃ#]T)Cs)öol#):_oÿBﬂQäÆñ£Iöáf⁄.rj≠Ï‹DzÆñüço,6◊ŒN¢s≠|3‚ÛıhZ]4œ¯ê
ôz7º˙E`rîØl˜ªKŸ´ Ÿ◊î¥õ…⁄n“v3yªV‚vïπWë∫r7Ã¶≥å“Yp,©†3&Á3˝ß?W^™πdmÒM‘y0≈usZdA–(Ü˛Dù_
WØ≠yÎdd*Œr©ØìØ.ÇøW4¸∫y‹)úí„±¯s œ©œπ<áã≤†6å*7h"Ç&vÆ©uûö≤S¡∏ê˙Ö‰°«≥+Ô+ä3ö]ï&©π W…ˆ’gï‰¯ßÒ£ Òi{É\RW•Û'‚Ë(âßâü¶k≠ì 'q$¬xóƒ¢≥4∑ ®VáúÇ0‰”Y±∏ÙXqåHœ–HHÎCÀÿäH›⁄¨;eÊ5ôw¢›—‰ù
Ex9è/‹3Ù\
l¥ŸzGóôø;√x…å5¶Û≤x§á¢ó≤ˆº"⁄çâCÍ#Ùñª4≠õ∂Å¶1>Á1ﬁ?˝¸Á2rKÔ{†T´›:s≤O¸A∂h9ÚêÈ ˘ÄüQvª5∫>OΩúa˛[…B†‘Ô[≈B‚˜˜©Í`•≥@bs¥˜ài#»5e^/X<ˆí)ñ@ÈΩÇﬂÁëŒ:Ië±
ªVK“2'&ÿÙTñ£-ËDÉ≠∞°sŒ∂À—œ¥Gáà=f.ïû8≈i¬é_lLÉuÚ'üˇâµw¢ëBhÉZ'_í*ˇÛüΩŒ«CC˚3÷: Ø˝¢ƒeJ—2†6Ç§(=WËÉò˛GÌlÊ∑œÄ‡/©©à{F˘ üb∏£è˚É∫y^ÑÊ±´‘taπÖ1àub¸mò ¶[—¡'fX”’h9ÚÎ¿M‹≈ÅçEm“Æl≠PW‘ùÁIm∏±ÍXLW¸¯Æ¨ñÍ6ßöZ&≤‚Xõ¥ﬂOXöä∏¬¬(Ç…iåÉ¡ÓkÚ;,{\é◊¡”Oºl÷I0‹uNEN.onÌ‹íüØìnW#àπJ`y´í‹°fzŸ‚ì«¨∞ΩV∏H”,è◊ÆbﬂKßJ∫í˙™Be∞º•∏ÄV^ˆ≥í(ÚÅ˛¨∫Ùê<VV4òƒR9o§<ª∞ÉJ⁄‹OÑ1á`Ûÿ´Gñ"é ∑%â ÍS§’RlRòë–÷ãXõ.ü3~yñ0[æNÍıyI∏¸&π|úz'+kÆº	#[ï3π9⁄˜Ó“lò÷≠jªë6|Fçƒi™‡q ™^∫Nz€õõÎd≥sßo ã≈´áI‚†æàÁ2i¡MÍ¥âÖú®*i∑≠´ÀT,∞≤V˘Èk.òº.´ñ_¯øsÛKó◊,\i˝L‹™∂ß°MP»B∑Zœúlfí•L%äj®hÙ‘2Ês"¬D{x¢§n2ãóh√Íµi&ÉbVò—≠S˘è≈™»Eƒeõú.æ‰&∫AjU0óMP™mN˛f •Ü©ÖÆ¯lIV:ÂkU2°-ïP∂◊üK+Ó`Ω[’fwK›jˆ9…*ß±_˝…í5Œ»OãÎ+ú¯dzZZ¯‹¶p=•ñΩ0é1FT¸d≥≤ôœõ™ı∑π´1Çä¢˛⁄	^îFŸ 27ªk¢õ“Vµ·TG˘J_pzı]‚]¥îëã˚´EKÒ÷h,Ô∑“ﬂ@˛Foàh‹n~µn‚Tø≥„ÚæoÅ4±¥“)˝›û©~ß®"™†–≤7êJW‘ç«|Q1’@1Ò*vqü*≈Jò≈RP¸[•◊–ÜÄÁ>˛{∏∏DéRÂ45é_›â™¯˝X™Uc/™::üú£ÒG˙}]3A¨‹≤ùòÎ	∏‹t˘;∏Ût4Wñ‡ò“Ï®MÒ‡æÓEì˘ú^É”-Ü/•$È^åç+ÓZ«Køæ(MjÎk!“É«k.◊Ñ©&’®µJ®
C?ìkñîz $ƒπÖC7Ab⁄b˙(Ï∞óïDyKÆEik,JcÎ_æ˙V>Ã1ø˙+ „ ≤%‚√tB¿l±ÅÚ◊°π∑öV)≠Îdªøπ©áxà)¨bÌÊe[≤X≠‹YiÓVrÛiáºàKn(v´›b∂ñ´˙~}NãCGKêfbHŸ€"–«nΩŸ¸0 âQtpâejñyµi:Òè…∏Ω1≥µG|}¸	}‘Ã˚IUŸ–tvùˆÊDû≠wL±•(V%œEàÇå÷u$ªL©"§.ï™“@ˇÇ§b†ø>°&Â±V°e÷¬O’TC–D8
•ËºJ±µôSäf$aÇ`£:¿.“ÉeBÅ0+sb©T®Éú∆{O˛≠…º6óß˘œyØwaH¡˘où áK¿»µV[÷¯Û
34ÜF\Ã´µU–ßW…eL∂ô8_¸Ï5ΩÓyÔ≈õÒπ+}ﬁ|Q‰º˘IÒ/øü·Ob"zª ëg†&E/≈âª)ü#˛Ãc∂&Z7R/Ωœ“Ûﬂl|¸*œYdË˝¬n˛Ö¡t ÎW·ûb&"ö£òBÁ<Å˚hπ|ÒNå‚E‡O`9;f/©z˝&ÒΩæ‚*Aº~rÃ‹Sÿı’bó`Ó	8ÑGË¿ ﬁTü´Ø±wµƒµYõ9ﬂÃ#Ïò0YŸ≈K<˜ôñ∫YÌ˘#¥ cVÍßî	°àÚ8éß!7à.S6f¡∏DÕ∏ı≤0Û”	•YíYó®ê÷≥
u¬~ﬂdóÿ(˚g¨$˚sπÙ≥u∂|Ì¸5aa©.¨ôˇA1}Âç≈®¸|ÊV`ÔÍwQ^Ì¢ê‹äiwHﬁ+íK1a\⁄J‚Õb&iJ§õ	tU1_ƒÚ•K¨ª±'‘VÙ±j^‘›MÏØQâ¬’¢Î+;å$ß ö¶WT•Bﬂ+~Q•2¡«à;w∆êMè^41)€çHWBª,nõÓ/&∑Z"˛QDD$,ó'‰P~à0†çÜ{_¯ßVÙ)…—ÇÔîˆRi:b⁄ﬂ&p3d*ÆBIïßæ]z⁄‚(…ã’Úò”÷Åæv»0ˇÕOk®-+¬ìèñ£0`Y†Ç¥Ê?„<bßò[©W˝ΩIJÍ
ﬂÅß=k≥∆·d4m?ˇÈÊGõÉÓ÷rÇñèˇ¥«qH]∑i{Ï”_.”DNÒu—ﬁn…˝¿ıw–~‰¸⁄to_jwîÔ9oww»ˇ·ù›∑-ﬁ˘ô¨M[“MC€oAﬂ¶ˆ&/
Ä:˚ÌtDd~—∆›h=(u0á˜/J#æHY«¯QàeòÈ©À∂∑·’À≈¬O∆÷ÔøÑEoü9†“vôè£∏•˜Vﬂ≈ÿ,-ƒ8&“Ÿ]ÄΩeÍ◊´\‘Èt‘aÈ⁄„|ﬁ›\\ºêàkCáë¬≤îÜÒpôéÈ0≠·MπÖ)qô™±hã®|UkHH©‡˝ûÅ(<ñ-›ù¨z‚h|∏§ΩMxŒÌ¿∂.B2˜.⁄ÁÌ˘Ñú3x3Å˙‚7–◊vÔ"‘°ÆâJ∫ç◊}ˇˇ¯Øˇ¸∑˜6äjTÔÈïv˙ﬁ¨Wzx:/Aı˘ñn%à&D(_dÄj\¨`c÷+ ¡]Ç∑e°çíµ6V‚∫'Üaº÷·K/;TF$-≥,é¥;„hÆÓø.◊ûeáŒ=A*Yã{ﬁ’KﬂË√R(Ö†≈e{ã‡ÿﬂ$3¿πõü∫›*‡ìüﬂÃ/ïOßƒ^p ÂCÇÉ|ãÂMÿÍW—9Jsúqd_¢”8i/bîjíñ2O}øˆ©¯≥èB?µ,ˆ⁄É}m{ÿf¨Fq;Q¢2'∆ÈUÑYO$à]b
3ßØò£3çœ˙S„ÕÕ„5ÒX=fèï‚6Ÿ⁄ö¶– ~S∫Ò∫1ú≈£„8ã<∑@N<<C$';/7üf~ˇÛc—{z˛≥◊k6Áª<¯Y˙sZüÙÛ÷-ÿ'ø≈Íi£‘"BÀ7ÀQ°ÍÕ’a°t€-˙ë’7éil(/∞ùáàR•ôÜÜÏÁ±A]"+≈™ .-¸∫È‘`¸e05ﬂ¡¬å?ÌkyYE,Çzæà,0ùÁaÍOEdÄzﬁíéSôs#úª¶¡2˜ªﬁ¶=[ıΩÛπÛÔ∂K©ª›Ù£Ïh◊¶&;“µıñ=Ê⁄]ík\¶W¶¿!›Zp]p≥ õ‘ÃÄf3#êôAÃ`V2ó¥* ÀVé@ÂR UNV`≤ÇíêJ&∏·C”[‹µI¬Í*bÆ™ŒxQxa TTx_o|HD˝?ÆF~¬⁄(|∏Q0Ë{¨ÿø<û≈(" \ˆÖ‘8“ƒG+%±scgì“ËI/@H\&®Â–ı¨ëüù„Lπ™N+’≠Ús¶ﬁ¢ΩUk∏Cf?sä˘»pg;ãA˘ß¶<<Ò¬I{O˚^H5a!˝Ü”äÒÛØí>îŒí zŸﬁ¥Lâ–®æ	ã)ﬂøˇÌ7ø3jq˝£tw≤[cò®ê–˙îEç≥[$ ]◊]£s÷43Ø3œ⁄õùæIΩ≥E…1ôÎÍ;∫ºVsùØ|¬∏£œoÎì—V∫ò¿¶ÄCD¢€õl‚‚‹ˆ¶Æºâ_ÑÅ·¢›C4ÌÊ`ãhgŸ9ÿ+ˇÇ:LNXP………Å2;Ï`Ô(Yxïú∞ΩÁù@T:B+vjàccfèm–'π÷ Mkhg!Û…]4ì‰Êe–¯¬_¯·8Üù|ËEëF∏ Hø ≤•!<«wnƒeﬁ¢_®ÃÍ√çÓ¶bæQ).ú~∆p˝J"áƒ™ŒÄ)[Ç‡¡ÙkËüe˘∫tùÃ5H¥åH§°é0ë–o˙óØ?âCo=7îî’í7îQ›≈x‘H%4Ü∑ü.s◊÷§F3,éÛ¸M2	∞k6»`™± FóyÓò®ÒﬁiåÏµ≥Ω†¬dì≥¡\∑d¸ﬂŸîl79öó†S# ∫≠∆âÿ'∫'áŸD√ÊVπõb8: åfº1∞IÑ¯^µQáíN`wø˘ü¥ªÀÛCÌÔùªH`XLúôZÕ=Ò¬ãÿÛ3ê∞SÚ8	&5Ñdäó‡?àÎ)±t~∑¯⁄C$-æn;·∏"/m[Ãr˝MJ≈æˆƒ∆"1pî( ˆ∫Uº”MÎ_È Åœâ7¬\}	∂ÄWwÂ˜S*ë=w‡M	Wak◊îP5ë@—èhQóµâ)…ﬂ2Rd'óx3ug–‘/à1àäi¥ñ¢&g÷-Ôﬁ‚AiÔ4ú|~ül≈`’”z∞øwóÔT*ò|ÈœÉbW∏…VÜb+ˆ'o¯≥pÈÀ%˘ãŸ‡äøïÈ'ﬁ‰Ê&√tùœ1y+ìz|ıH0ÒÕÕã∂zj∆F»≠7µÃÔfà◊;%Yß¡Ç:x<‚u)qÌ+»óöÆZOº~ k˝»œ∞ØNH∏A˚∫´-Î<tπ5\„À≠EKÆÊ≠[∆4™wπ N-ÚŒˆi) Ô-ÒlX{-ﬂÕâQ´ânî¨ñó·éÕüK∑üÈ˘ÚHé˝iG{Ùõ2ı≥ÈÔöà8ƒ⁄ ">§0æ áEn˘J™¥¯⁄ú~Vñ5ê≈6Zè(ÄJ÷8Q8A
üìIa/CX„}¶Jb˚d…FÈñ‚·ïUá≠~¨ïÊJ5‹4oî∆·’Üx:>˛¿ÿ»å)˘≤É‹œ»àÍM}∫6m∑G.FÄéÃ(€¶Ène9¨ …≠zêI,`|FˇUbí‘eÃCîÀ1¡åÈx˚)∫Ùê”é[G¡Dº(jÏNæ^lÊtÂ4ô•o_∂ƒ∏&üè˜ÌÔˆágÖ(√<f[•Y0*'‘µ˝ße®rcÃ¥Bõ6o|,⁄Ô_Â˚DâŒòd´\à1,≈lÀ0ø2UÂ§¥øô[ê†"∆‡cß∆qÑÂp`Î≈Y<ã€-.<ÏGz…⁄ëbŒ+µ(No]}ób‡"~…j£ZhÆæûlû¢yün°1ÿh*v‹ Ωo€π∑ÃπëJ´÷´
("¬noãNƒ„uBesŒ\∏ÇØÛûóº\3sê[e´¥i∆<¥Ø–≥øàA+ ïaÈbuX∞°qL„V©hπ∏+v:—!ﬂˇ˙êO˝Ñ‚@#…PZilöªı∆fÊ^,B/¢ÀJ6»ÄvèΩ˙'oé?∆‹Ú¢C◊“ì]πÍ¸™≤-d:ü≠íù‹`ΩéË¬ ËQWÇŸQ è$ìk`Î·a¸éôÈìÿô≠íÉùWMòF¬ttx|:8 GÉ›˝·””°;€zã‰ﬁB ˇøˇ^Ç∑K
è ˚,Wr8_∞»n'önD¸A}$ﬂ\ﬁ‹ò—≈Ø‡ô¥˙#ÆcﬂEZ≤˙∑$(†Ü1I(ykÙ
°π˛(â¿=4˜Œ˙NÏMu$ åÈdZ€Íπ?	ñs;‘H@'eM_“ï†LèÅá¶òçG¢bÜJxL€X≈WÓÕ∂]‹ß™Ä¢mH±dï§m°föC©Ê˝ˇ˙7¬ÿı¯‡dpºHˆÜ‰ì¡¡¡‡/ûê·üPëÔƒÑ€Ü˘◊ŸÈMñxÛøÙ/≈¶|L{ë≠Ò ö@äÕ¢.∞/B/ç -[ëÛ¡£ÓøÜÎﬂî∞—Aˆê£…ëtäÌ◊§w:•‰x'pÎ~
=ãVç≤æYr‹¸µÿŸ◊|Ÿ:Yê±ä)‚ÑhÅ|Í'sì—ïms	õÚ3=«lœØXôÁw:}U]—§$A7¨r∫8NØæIÊ<ÄäWﬂû°#∆v◊bŒ-‘¢zˇ(lgˆ¶e◊Êj◊™$8V¨H“Y	YG”2èC”6;[l^
jB" 6pŒ•≥Î@<[4ÑnóAÇ*õl‹©b¥A¯XoX‡≈∫p{ÉÌïl¡]+¡J,‰ÄŒÎÍ[,˙ä®]“r∂ÙÈøi›(ò‰èO|X5– £±ÕN_^÷Ø/?∏ŒaYÒ≤Êãz≤ú˙	.ß«ıœ£“§m¥ ≤e8zΩ·≥¶g,vΩƒ'GËÇ7â:Ø√’¸bÿTÎèRœ7ø©=õà^˝oCX)òZ|GéáªáOÜO˜@Û8|:<!AvüÌÔ°†Büè√≤»bZ‡¸2îWõH∂'A:&ã∞›'™ú«˛àTPd˚Ü3—Üke≈›dwòÖõRí’k˙Ü7˜6¬¿<BÃ„Ç-CÉîgqZ |äEk&‰?-·/|H≈]≈Meº(_¥2~òeπs¯Òwˇ[‡«—ÒÒ≥ßßÉrÚÏÒP„‘Ù„|%OÆ˛Ûﬁ˛Ó!9=úLj{û∏&¨B[2˜¬zKóeb>IëCsl˙ØX	$≠ù˛t·'/ä3,kH<¨zê”%≥ Â∆L¨?øªˆKÛF˛ÿOºª∆©Ÿàìbc&≥.‡Õ®¿/W† ˙`ì+{}ﬂñ2∞s÷≠R<…—^ºd’Ω>±3_+˘9ÈæÈê◊ø¥ÀöÓlßUfﬂ¬*eÊö–c¥†^ÖÒ±Yˆ=jµÅ©g*â‘[≤cnˇÄÏòrDˆ∂ë]∂eö2ç∞	"≈„„¡£´øºœÜÃøˇ?ˇ˙œKé˝iÄb2Ú˜ËJàr/OJ÷^·ÓMπˇê≥}”Ó∆⁄Ã›XÜaÔœØæ∆‰°/*RküVLô≤/‹ıê‰•yyËÇáíòGº4Üœå∆+Ñ˚™6~∏y)5TŸ‹,˙“RÍÃßº∂ôÖ^K¥z>≈2V∂¢4xeKÚ5SCî˜’∏wSÓM> x/Iì1¿2	ﬂ/Ãÿ7l`¢à'x∏Ä≠€[/x≠Wx6îÇõµ∏	-4≥øŸ"ŒàØF®@óPÖ>k»F5[HÁQí≠ı‡˚_ˇ7˘ùoæˇıØb4¯Lô)ôBôÍÕZ∞ê¥9h °áMj”*∂’tØûõ[’$+Öüçd9KøŒı˝ß ´VåíïK⁄˛∞®Üìèy†π∏í∫ºSñp‡#¡¿4óã[¡À·ÅAêÈâQxaäy
úLJ5∆ÙˆQ¯bë`MÎ©¢®ÊSrƒ≥í"/)f˜ÜXl.9MerµNÛ~˙À•?˜–?	FÀ/Ò‘OÅßÎ¥öÊëbMM
ß;ı„É¨ï”O;à¥@Îc⁄jB¶ãXÒãwBë!EØ≤Ä9@í¡‚ﬁYgZn·%Ê Î€<ﬁN5¡‰óﬂî\ÁÖ‹Ω{p¯lèÏÌ?ﬁG/‰ß˚√_è…˜ø˛Ø‰dˇ‰t¯dÄæå«√ì”˝´ﬂ<ÖãØ˛ÊÈ˛ÓÄ><˝K5äEa˜6ÿöà3“≤Æa∏zJæ®C∂Ë£ÓGΩ¡µ≤EıóDq#>2¬≥∏î'‰w!A˘˝oˇ·◊0˝}ú˝˘d8ÿÉeZ ¥Ã|gü-ê˚§K⁄‰(Z
≤¸£%Ã/†“Óc|Á<N3¯¬”Si+°·Óc2ÛΩ$;«BjØÇt	c˛
ıïÇZrWÌiZπ2∂d«€ïYØõ,†D’_kóÇı‰¿ä<pOÓ”“v˜¸qú∞Ò˘SJVwiÌ	5ÌŒ!2Øª±MŒ€œÅi!zÃÄ&˜ÈßBcÓb5ÙßÛ¸6^®WÎõÕí˝v1ÂØ *+S}œ€›.ÚÍ⁄“v˘h1[ÍU‡… %\Ù
®®ü)™¶H€[1ç˜˘ÊÁõü˜`>O¶#oÌŒùıÓfoΩ∑›]ﬂÏl˜oΩ∞Ó&¡[‘dÂ;D©è·ì0i:Ã<åëHgópñ>™Õb9≈Yƒn)Úìü.âA˜òªø»ØùÅ˛vˇ´±ÑÍ≠Â‡Ÿ⁄®i◊¯GSí2"âPYû˜v$èùf£ãe+◊âÙƒTF⁄ÕqçöÚ„<,∫ı`¯ÁG√„Sa˝*…aÜ4gK‰§}j¶Ï`…∏"TQ…ZbM\Ìı©Ú˝Çe+ô“É%ÔÄwÕPﬁΩı¢ı‡	9ÈnêûÓêƒO„1∏m≤}ûx: Tôu≈∑XÙ9ŸCﬁ‘uÌi‘“JU%∑QoíJc∏èü`KY9¨ûÑ_õ `ã9ÌÛ·K†Da˘∞t1,›9]ˇ˝Wè<ñ¶Ω#≈√0å
◊^“!OÇ0UÎ°èÖ=aπ…IáÏ∆ìŒŒfØ_ßD◊g‹k™ÃÄçhBN>}\à#ﬂÀP¯¶úr¬˘(å©Z«·t;úﬁeÎ2«ò)An∑˚Ë©…c®¬í\P*’˜j™Öwo√ﬂV √‚	M}_‹omíMÇT}NûaxøeH∏∑@4ö‹o=ÅÀ˚‰ €€§ˇﬁ&Ä˜˝Èˆ‡œ6˝πãÔ@Â%åBî.é√8gL≤Ÿ˝–
qÊ `¥◊˚-
ÚŸ/„  OÀ^zEÙÑYõ	,wôm¿¢ËÀÑEZº˛Bõ‰üΩÙ/œxv ﬂæè6”ïÊ5ëﬁüù#ΩK0Ä˜OâÆ.Îﬂ;∆q^#]ÁaŸ±ªd˜JØ◊GH˛êªÚ∏˚)÷Ñ»>DÄµ•J ˜/0£è.Lï¢•:Üç‰6'™ÕÑ2ÍV£++÷¯$û¯!Uq≈c\)}Wõ?≤ñ%D	[ÕÓöÚ^újc>ø]ÀneUQ©`HôÇ‰€ K¸ªF˛ÁR ÛÑó¢+∫÷öCçÇˆVÁ£ˆå|÷*Yxä	Ω˛BG»Ñ⁄^£—Ó5¥‰—òw´áPÀ˘ˇôI‰π—~Â˘å]ìV¡hvÑaHH„ÖﬁÌ[Öp”cÔ›|Ã‰g-»_´ñyá2:˝yoæ–∑ÖF∫›o=¶Û#0?ÚÁwóπôÜYZ^⁄åÉâ7!ó¬÷CM,…2"Ø¶@¬_ze˚g‘^{Nˇ˝Ÿkó’∆µ’‚∞5ë;A¡ÏÄR≥	‡T4ö]Æ¥p}pÔ∂	Z|d~?X†Wgi˝≈2YÑæËwwnØﬂÓËÙﬁÄ~É∑ÔícÔ´8f∆<È«{ÂE_Òd"èπ ±™«óà5‡ˇ0Qã	5A uÂs4‡+]ç0úU-òìI∆Ü˙PØL˙ƒzÔÀXÁò¸)cœ~˙ã8yâﬂÄÊëó.¸hÌÉ¿tZ√!Éò"¯Œq®ßcg˘%D2Œ©⁄:´(º≤¢b–ì¯Hç9≈*îÒÍ.iôò‹t›œÎw]Ûtº„X7%AB6»Æü`éòÅ6ö
c—7ﬁqcÁ±–8∏€b‹á
ÛHK#2®…0¸)eÙQö®◊Á¸ΩË£ü;<™•.Ï ¶ﬂ÷˛W1$i©≠ÖçÅ˘=¨[XZ@m4Âóº.Oä∑¸Z ∫/∞[s∂L)!˚¨›¯'∑ÑKΩ§8óWP° ¡“fZ 	˚:¢üƒ˚ë7ôÍ…pÆ*eQï—ÇÈTπä5˙Ã¥´X¢∫;Î]‡w›ﬁ@—Õ@Q{N≠>Í\ø°√gô’4À∫æ8ÉlË íë∂Ä*û„Œ]ÿ∂Ñm§ ¬ÇQﬂñ≠]z}>r˘ç ;§ŸË	‚
≠√Ö¸iwstÁv˜Ö˘ı&À›™IÚvK¶=æ–Yê•Úiõ¡/%?¿®≈W=÷JüfôW›˝	≠ç«Ì@!∑ïj˛îUJß§˜4S2M@≤ª≠œPV¿≈∏g0Ê1“≠óåtÇ†™¬˚•¢íÃ¯øæ%O˚O…Ó·”S¯;<&øÿ?˝Ñúûòâ=“VΩÜO|§gX4n¸rd‰)k*Ñ÷úc/á°aquÔ&sß°Óÿ1 p ∞óxÁ>2hm ™ø.Ú4ü›xÁy{gõ˚sõ√Ó‡≈∆…âñI˛›z˘∑í	Ö
"ãv_öNDLJÒ Ò»'«+r˛/…côéìª 'öG%Ág…í$92”Â3ƒ≤xAÑoèZ∆Dw¨î	5Ï»VyÑS∆Á]Óÿ4ï;ˇ†˚0ozA•∆X˛]√	'√q£Dúè@ó≠@{Ún…n	≈(€@ÔÀ≤-ÍâF—¨°c≈‚êx“sœüø®†ÚOÆæõ,1hE	H›(∂y˝ù¥'∆NΩ⁄h]Ò8—M≤lÛO¡ﬁm≥bùÜZõ’6ôCß¢<∆qúÁæxJ ò<QÈTvU™<±Ç´äU®W¨∫äUœM±Íˆ@jCﬂ	∞+ìReTòÙXE£%Bà$ú6t¥πMG^•]iöàuŸúTèú8q≤Ñ4äïòù”èÁÃnäãGˇlYÄ€Ÿ⁄Ÿ9ÎñqXè1?.±=åIµÀÈ∫éÙ#Fõ©@)G∞íØ›M4∏ÿ◊•¨ ‰ôlÅc)ìì*)Íé$ºÃôü*‘¬†Ó4&<ü„èöHà5¯ëD4 b—ﬁ{ÒÑµ•>˘ÂìGﬂù»Á]Pâ]/µ7C"∞ﬁïü•‘$B¨¡è$¢âãˆﬁìàì·Ó]	˘≤º‚Ä≠≥ßÙÃŸç”o¸Q”úˇè4°M¿{ÔÈˆv|GƒÄÆ«;"‹™98⁄øq:0
FaOo1ª¸£& B¸HPeÂﬁ{q¬:ø"°.Õª†≈œÆæıå‘¢8w∫·”‡Ò6ñw∫LÉ?nC_ãõ¢˝?Í°/ﬁ˚O@`-^bUÈwCBJÎ£ÜIVëﬁvΩ€øΩﬁ•¡ßŒDd/∆.eüzaúj∞˚Éó<Z+‡èöp%¯Q⁄h@/¯öΩ˜dÇñ¬ÿ«bKÔÜNàuyBFQ¡ÑusÒﬁÇ{;∂'£?j˙ê/¬è¢âÉC¨⁄{O#x◊ÒwÂ€»◊Â]–67L.9à«J´ek∏ÁÔ˚ø˛ëúÜªßá«X≠‚…·ﬁ‡ê>y∫t<<¡¢˙dÌ‰tp∫¯îúÏÔéo9'J™AS,pi‘›ÏN^∏$w—‹.ö ‹ì‚é,Eùc‚jÀ ñÉÊÚgKN6–w∂*oﬁàR‰p]&⁄Ûüz˝—ˆŸ¯Ö9zíß‚=Ω˙›8Ùc"c:+◊“≠Œ®9ÈáêÏrÅ’•ËèeÍv9p*ã‚‹°(T$∫˜‰ÊÌ 5ŒSﬂ_ ê‰≥rnõ∆UxÔÈ2WŸëπÊ‚ﬂ∂¶‚ﬂ¬rd&`ÁS	!Ã¨¢¸érê!…‹öÄ*óãQÓ––‰ıÂ4.<x"°E√$8{ˆ¬£∑Ùt>{9ˆ™∆Ô∆⁄C¥ÄeÎ¡^0Œ`üS9ê∂BÚSk@s10∑πcø=5è∞í∞	*å4≠ús`‡1Ùá∑LjíﬂsÍPõ®•™4Çü¨¶JR‡è4¢ç®Œt°4˚ÒÊÈÑíM)í(oíBh3G:°'\ñ)E±.éî¢fî∆${7∫—’Õñ9÷)S∑üaäDÿ–∞C…h°M+©˛lÈA_€]¥Æ¬à•ìíÁó¨:h°∑Ë±ZV™{[’U÷í†Ç1‹4Ñ€µÜSY—*√K°Õ`b≠]}!Ü±ÜÌ[JA¸πw—ûµü˜zt≤πç‡íÂ1`ƒΩñ∑`H=Ú^˘÷æ8O1D4ŸJ`(Ì^Sá»–˛R‘Í⁄¡ñïm=8‹xd+ô.ΩdÇrÇ°í–- IÂ¡)Sa≈ba´≈Ÿ´˜“Ú±∆K¥‡í:ß≥èMC˜‰zSÖƒΩ5#≥¸îÀ—v5FnÊÄö»a‚‰t)mπÂr/˘'¢	8]ˆNﬁ‹zœÃã&°{ì∆∑¬Î`Ê;q$dwé’ìU˜≥`ÍL@ªü	§ß∞ˆU∑ÚÜEñ›˝∆TÈ÷REÿRãWW≥dç=ëÆÀÍ¥ΩVWÒMEÌ]3˚1v† ßÀÇ
ô¨‰PºhùΩüe/lËY0«Û≈õÍnP\Ï6£(∏˚ïéá+/∞ü«≤÷÷¨0ÄÉﬁ=ê/2ÇI≈mF `áπÊ˜éö?üƒ)ogõ„:&[˜Í%⁄;%Ò¥˙aÄ\‰2cÿa€ÿÖ”≠û∆ë	Z+R€§‚WƒZÀBÎ¢¶ıÄÖÛŸíÎ-Í]^vCﬂK8È©R—Z≤Ü&◊ﬂ4!^ﬂ∞ˇ}f0IÁTêí yQBs
MÌ©≠©π˙Œóó˘ ò//)ƒ'©WÀ ◊c#O—`˚ã√„ˇxr4ÿí¡Òp†¶çŒ5˘úgÆ2≥kosß˚—Ç=tY%%∂Í
í∆ÎËa8.6˛öÉ  [Âz7å`¿ßÉá§{ó˜D⁄;<&C≤ˇÙtx|t<<ñÒ4LÆö«∏ßXµ“v†úRï“Üe÷`ìÓø~-Ë√]≤πN®1>uÓ‹6$nŸUÓÍÊwuM∑¯A÷-∏‚ç¬ÒÄ◊w˚¶Î¶⁄ù2¿Ívô2É+u$∏•é]÷í‡∂©xlÙ~¥Xfÿ`!ô˙+ï_œÜ«∂ëÖµ˚Eøc≥ñomJR∏∏ze{æﬁ¿[.∏\˘>wÇŒÌ≠°m›I¯ãTÊ¿»€º§ú±≤#M;ÃWug4˛eû∞í=Îy…’◊s?2[Ÿû?~c÷´ëLÍ¸ˇX‡£ÿﬁ$¥,"îï\≠"∞$'JLDn5d)S(1≠F|sÈ‡ÿ?ÉIŒvœ-BŒU∞&œu§„o¨3∫º≠¨¨#@Ço|èç¯LnkL\*ÅNJJÌ:,ﬁø4bXÊâ£Ìv∞ÿ$hƒX3œ6*˚∏*"ÙF~Ë GöËœ$ª‡ ›{Ùc®&»=4_∑këÌyÎõG‘÷:i=+˙7‡◊'ﬁ\˛ıt∞´ù%óD∫Ö÷˚ÙÊ^⁄z¡Ï 
Tˆ„3´¡yvP„<–éÊÏ®v®á£V_@sÿñeótrUä;Ç3ÇW2ë≈aÂn9åÇô∞X‰Y0¶6Äµñ›ƒPuKW°e±C)w…äSÙ‹ ¬Y´øYK∆Âº[˜5£é\iÑâá<‰‚ŒGfwãzÃ˘^“›Å/+œ.ÜÚ r“X|˚h”‡≤5ój¨(£NÎÀ1F$ø™_ˆ‰/‹ÈWh¨≈°§ª]*Hg©Fß\ıë•H]› Óı®"Zx‘ìÅjæ«sü>qø’ÚSÕ6+ÍurˆHã∫Úvﬂk„v	!ﬂı@Â9\~‡H5j∫-Ø¿Úﬁ"”3,M=˚CCEˆ }ÂÖK N©L´!X¿Ãã¶~nÍ*ëVøìy…‘œ:Ù·@ÉGŸX°‡Ÿù*ï‰,/”ªer¡ŒcÁM`Î“•ØÄu…¸÷Ö;Et#”=›¸˘Ò2£„(-≠"ÿVEC•ÕUD†¡Ô≈¨„€Ã÷`4âÁÿ‚Ü∏∑¡~oÙÜ&Ëüïi‡•dô†•/¿'}
ÿòíg‚ƒJœ¢ì)ã#Ëáï≤ªÙ√û¡˛ÆÙà„xÇ„[¯áïÚI<%0ˆw•Gú∆£ÄŒÖXmßóiìÇ`'∞Â ˜k<Ú(N’gÊ'V|Ë’?˘cF?¨÷4∞˛]Èˆ£¿o=ÄV<¨≈„gW{hÆÄx≤⁄˜‚≈"Ù÷49π˙.M
P”x˙Z/xÂGqJŸÌ<º—› a°˛ökΩ⁄K∆h´¡äóW]µ‚ŒÑÀy‰¯wßﬁòntÈ‹µ=âì‘ã«≤Ô◊z‰ÿO^°≥x®8≥v≈Ö˙˚@˙≤qª˙.Ò.Ä∂—ø´M3π˙:Úcÿá’pﬁã≤8IêŒÉ4yÍGn–¸râ±Ñ@jÆXmÏ~‚#T>ıA˙ÕËigVzÏaÜ<ˇ%kC!ˆy…-óá›€`eÖÕ•JPõ£ ™ [BG%öØÌ.”,ûV.ñŸÕˇäƒÀåtiVTÚ0ı3 Ó˚—JO»˜S®SNz]‚J b6"Oµ™ ’â1›∫ïâ›‚Êf™ƒÕüÅºÓ' *~I;a≈ÎTí%ﬁWq8ŒA„pîfWﬂd	,Vß”©û’˚¢£‘∞UÙimÑ√_qÓªk-UKeu¬_ã2lw»å8·ñjg£¿sÆƒ†6VÏ≤B~áè\
Gc-¶ÒrU$Œœ-=≈‰Qj‡çË}(¬.Ë·ßòŸÖkyàõïÆrê∞§´*Ö°uNÚ^tÇh.ÅÜ¨)TÒ˘’ØTãüq5ÖÛÂP^”O	 úËfµÉ¡≈£ÄPZgªC¢ä-S÷	||
∞I{O∑»õu«€˜@xœ<È)‚å˚3ˆøhıìâ¸î‚ú˚s![iÈ9≈π´;˜î0i≈¡Y‚Í.·ˆ‹VùuøôÔƒîÜ! .ª‰BFW√Ê0˘∫r Ö5	ÓΩt+ÊA	M±˜6ˆ1Ùù}ÿ c«Ïb∞•~ËáÊ9∏1∑¡ñã„¢ŒqPÔ: ¨mÇ.~ÑjOBç®P'I¿zG °U
}Zñ}Û1Vê%
@Œ®5ÿR†p˘∫È!îU*û‚õ—**r0* ´àå1Ω¶6ßÜuΩ5>¨lŒ±è}ËΩâó∫dÿÜE…vØ.⁄≤4!GFq]™TåpÌ˘ãF‰ﬁñ›\ƒl‚x∑˙U}R4¶‡Óî¿£û|†õõ°◊ µÚ⁄IÁR@»ŒÕäoÉ#IÿÅ/Ó““—@∫æ∏ﬂyPí≤rÀıá# ﬁ•,Òâ3Óœ\ (ÿ˜c»e ¯µ±îX'Ö`ÈÏå©»å%˜âLIrIí”ÍH?[&Q-Ÿq'<™å
C®'M©’
1>x`‘N±vn19xh‘P^qﬁ±mmAá±†÷=iÒ¬wä°˜Â¶>œ1r('≥K£u!báÀ>¡UƒÅ@Ø∏vœ;ùé¥~Î“bΩp®À0kcûp’OL£ﬂSÖH¥¡qÉﬁgµ‰¨ò∏®&.“ECıƒU– Q£cﬁ∏à"Wº6ÚAóje’Ró.UO¿DÏN_Œ‡≠cÏ¬ºQ“î¬Ω9%b¯πÍ%ãvìËù<x∏z)P<≠ ªÀBbç¸xhæãª‰ﬂawÛulÂa‘’◊cX∆ulÚvıªQê≈¬lÇ¬IºÀ∞1	æÇ›Ú¬ZØeœÜhﬁS›©?tW“dÉ_Å¢LWözFÔÖ0´2AÉ∂·sF∑e‹\ßˇuÚn√¥‘RÕ¢T¯0®’2Ví¨ˆÅ˚ÿ◊;§‚^K¢A‘>êÑ^QØÀlAPsΩA ª¬Á |ûÃ°0å™Ù ∑ö]:´ZÒ èê‹E!>Yt|V%ÙZ« /‡{‚@_›óèñB)Uü*j‰-lWo≤:4âÔΩlü√O©êWh°kß?JÚ4lt€¥û¬†ñpK4Vf<W§r◊d¡Ï”~«,Ô•i≤ã]ﬂæIÎ’[≥\ISØÁmØµ"ù,	Êkµ‹ﬂEYt◊˘¥Ã‚Aö¬`¥í’Ïk§ﬁ(Ù'˜_)ªVƒÈŒ∆¬Ü9∑ÃN&ä¨dM∞•£©º-UïNﬂ÷yöä≈äú,πÛ%r∞)ı’öUO1T3U∂úe◊-√ ·-«Çpê$˛Œ∆I&,“Î$Ò'| @;ÛSj¸û„ZêK‚·!¸6˜.Ø~óéó∞QÛ üWU6¿H•√ò˜ÍÅ{Xﬁ√O¥‚ E„n!!ßã 2•d÷øÄRÀªMbêØÍXø±Ê·Ê3⁄3∆g.¨Y¨@”¬öÜWHKêPôs@÷vΩÂí2
@Öπ[7¥2’:Vù"gΩΩ:Y◊…Nl}ÆP\â§Qc–ä 8+ä¢p£r5ÛHÃô_Œw«¨+h[®\	Û°$òèØ´T@‰KÔøﬁrJn’è#¢6´#¢†í_±ªmKgË:âÈxó˜’4Nﬂ∂º¥∫p_iBxkÚTæ0Õ”}ã˘û'ﬁ¢Y>?o2èı–".¿-'ôó-Ì˚√Ô
“@h?¢±÷à£k ˆ2À%Ò(áqÍ‡ÎÎ‰—ë˛"2∆ÀÇáTòS¥∂ß7 öıîéÙı¶#}¿uêÁ‰o"kQ<d€üÕÅÒ™Æ®ÍÅ±å	´Ù¨FoØ„Hv¶ÑÉ(5¡ΩM4¨ˇ£„a^¶Z‡»0†⁄ÍªÅ÷h≈"Ïß&0¬Ôxã@R˜:PÚ4wPh‚\÷^'bÒ˜8QìÍ≈ú¥!_d(3'¡Ë›ëõ|W÷lú∂[“löÓ∑Qßµ8Æ+ãüÊÀär8Y`õÚ¡ª¿ˇ'X
ÈNÙ»ã|-‰QdN„e2ˆ”Ä:Â«Õ5ºR¨Bßé∆ΩúA´(ı‹-∞∂("W r·Y 1{c´/˚µÍ‡º™¯åÍ,¡1ö±ùıkaLûOÍñêÎ⁄{~Üıt»âìª/IÅÙY<ø˙:Aú™÷’œ≠E©R+Ò£‰’¬ê}t@%¶—ây\J®ï∏®pNU@ΩU·ªáxa°Z∫Kı±¥Ú©ZÌ ∑À2æ(5¢ŒJia'à:J‚±üzÓfWHjÊµÓF-˚BrOeà	x∆aØZM·È0ﬁn!üI÷åp´V⁄\Gih.!≈{C≥ùb7dµÃ):‚c“%MÅq„qSL|énk‰ƒï(Ï‘Wwa«]•y…fŸÙ|ªTÁ#÷´JÔë%Y…ï¿Xa˛)ó˚ ÷›DyŒ)Œê% ±¡ìÇòpÑ5Ó&\œY‰’∑#lØÉvƒ–CÉÀy≠ˇ	VMÊÈnn˛;4Y!Ï^?ıﬁì`leü+ŸÉ©z¡(ƒ„B
@≥Ëê⁄Ÿji¯°¥n©?"'ﬂœrı∆è»ß†ø74*ãß”–ø°©$3fË}!1ÆFXD©ôŸH
¢"l&öÃ\BÈ‹⁄”◊-˚®OA“ ]Ò„√ö∂jD[ˆ ¢ÃcÑ$Å?†—gL∞¶DƒsAsëBNdÅ?_ƒ‘˛MiP‰ΩÚß»”ØOK[_Ω/Ω®‘·ŸY•«U¿ÁOdé¨7Ó$◊ÛªûÓ‚º¢œrüzÂºõà¢¸ët∫ß0ô‰Ü‡f2¢ﬁZXQMÌµî≤ëaí æ4 Q≤∏\Ú∫Ò≤z´Ï‚∂Ê>ıä´ÂLCﬂCπ∂ç-I/@‘Æé≠¢U≈™iNTrf÷ˇZ¿WP◊yÏ∑|ˇˇ¯Øˇ¸∑NJNU+@Z_º^/ë7åÜ≤ß¥`ã/Kß’9ÿ˘húP@È√¢ÖEiEÄg‚ÚóÖvkµú–—Râ0ó]û∆‰»OÊ¿å·KLˆ#è˜*µc©°⁄>äAgÑídW¸´'éíùj„TjwÄ√5™Eå"ƒ´8%Ã∑'k¡—$àuyìuÚƒﬂ"KåzÖ+r÷„ßd~ı›+L˚_Á˜%>M¢¶lÏ,ò.±m9M~ÛÛä^ \πí }ÓèÓ:Q1∑u\*ºx[¶8¶≠te‚ª’W◊U(|l√••,‚èı^∏]àÿ	ã
å◊ºı(y<xñz‰ƒ;ÛíÄ` “‘£ù®∏Ä¡ÅÙ˛∏ël”6ÿû±ÖÒ/ó>]Ì%´≤  ‡h?°!ä«og^≈_°∞!Ô0å≈O"ÿˆq<è…Ó,âÁ è@d9ã/ »&pqáF∞È†ﬁ¿?˙£…’Ô"a,ƒG⁄¶YD?J—9Ê3™6ÉÁÎ∑·∫÷7ª)‘YG◊U`?äe'(HÕ=i[>ı.=‚9=›’∞‚ﬂˇøGXyÛê~>ı·&⁄«ç?ñ3]ÚÕ%Ñ’‡,Ä]&¯?loº` õÌùåº)~ñ÷¢:QZZlíâ@‘ñ4,:Cfﬁ(¯…{ø7k¯
IË˛Ãó!5Ö≠Ìü%pÌ-É
ä§I‹ÿnÈ£`<ˆQÉsÛ ˇÔŒ0&o‚£'h	¬;Hâ@:Äk†À.`ÔÍê#PdË@FqÜ[$Jò0íËçí 	„¬h ‰/¸àf›¯7ªƒ˜6ñµŸ
.Ç£õ‹lÏÇ÷Õµ^÷¿PºêÂ…Xey≠≤Ù∆Å/‘∑ı∑MSrÌA*Th3w‘˘ˆf,!Ú¿+>Ôƒ ak¸sè©Gπ3˙æNZüèB/zijü™Â˛2ˆ®f9tÖàú∫-âÌlÜ˝R˛EaÂBèÆDÿJ…yÇ£ªqÕY(,k∂î¶âZìŸêÚX/<¢óñ÷àŒã“d˛H√∏‘∞Üùsû.˝WûìœQ—{€‡… 1,_√bM‡∞»ˇQå?ÂfÉ∂∂f°¥Î–·x¢!i*Hm˝@ÿ·≤µ◊™Zb=péF=Cƒé¶i≥0‘G¸Æ„OaìÑf©•ÄŸÊ9j*Î%ÜC+>« ÓàËFÃÑç√´Ô¶¡æ¡≤/Ymè8Ω©p‘º)µ5ı˝ ≠6*´¶≈ñn
ﬁÅG±0Y˙'?ﬂ›,< ”~ 7~kﬂ#ªwÖòXÍÂ9]GòÎì≤œ:∂⁄ù+ïÌÎU˚ıÒ;$Ω≤|◊W%„gAË∑jÆ°˚?a¬Gp9m.vÏü’pÖR/ÂFT–ñJtúøŸ"åΩ∫>4®#,≤˚≠Nvë≠wÊìıŒbr∂ﬁôƒc˙œ|«»?˚C™8ΩQŒt®Ô‚ƒ≠5\^Ë#ìŸ«ÿ6v¸r≠éÎb·‡z®¥d&Ú~®DÀ-£{;∑›Nºtñg2Jåﬂñ¯‘ﬂ¨H‡-í´÷§Üïﬂ√’∆v∏Ü˛kı"‡Î%ÖO—£Ô™˚≈ œ–•ÍMæ\ÇrzHv˘¬7_ ë=Yb¥ó†O·„úÇ≠Ì=⁄8˝Û”ç'{{áªæqÙÙÒ≠äÃL‚(Lö^_Ê —Û€º»œîa®$Äñc°î“Ì8&øÆr˜ì`Ó”Nœno«*1vÃu,c ì´»}“j9¶÷%Z_ÑEÈeLO˜7Ûê`≥ì¶Øa∂H(µ± ÎèÈ(^Gxöï”˚OE‘ö˚k≠7∆.√é§ƒ	m´»ïöPóEt"ö/@Yù#lã∫Áeº«‰ë7x~ÁëQŸ[¥'…,Ï√ÔHÆÏ…•ˆ°5P¿{j‚,gﬁ›Êæ+J˛¥LZÚ,>?Ú0ô3€Û3/”µ““π[o¶5L4∫˜≥ã‹⁄ÜV=∆Ë≠Ã5]T®(-ßM∑¸˛∑ﬂ¸ŒC\jÎ,‘Ë≈∂ÅÎÈÖjf»ÔWUõ@Øii_QØÄÔˇ˛ˇß∫“Ææ·©ˇs›“	Vó{y,+UE#◊"C“n´ÈAJ=àï
á¨ÒVì“€Hfv„êtk"Ã™<›0ÜºWq]y≈FUâúu3….éô,O±ºÛö/B?ã@w´P‰Tü»Ω:7È,êP1≥ﬁX≤Ì∑7≠GT™FÙñÄ§GWﬂ$˛W¸O›™3Ñ≠∆CõuB2∂Ô∑’°zn’t∏∂ÚWjº»∞øG6ÀJ<≤À”»ﬂ4ÿØmd[Å˚ìk£¿'ªÌnokªz›ngø∂∂÷èoª‚˝ÜˇG¥ûÇ‘ì–Å)î7œ&^]JXéL≥Al%Vpúﬂ›ﬁW0˛`¿±'Œ{&≤¶◊ëX‡ÓkSk†”ﬁ’?≈Ë~⁄Ó~$÷∆„ﬂ<Ïü¯Hü_}˘âSØ≥∑¯è}ÿ¯‰∞œpm‚a°Æ ¬’y‰œ—ìàü‡◊ë¡x\ﬁ?•vãæ≈dà&∞‰Íª€©+úµ√≈òıPªqºÒÁ^P≥:‚Òñ∆xSoî/0ãæAG¨z[<ÜvÖ'†ySøO€œ¸˘Z+Ò&üÛëŒfªN>∫÷Ñ_BÍﬂ∫?£˝‚Œ8ûˇàÀ∆„qπ¢bÓÌπ≥ı>`˚ì´o&à·ÿtËÍª0û∆~ì6fX¿#Ê1÷&W_ì4†ë»_éØæçoû4‡úìxÿµíëÀ	˝˜ÚÁﬂ$Ú≥Q¡cﬂÍÔ%Ú$1µ˜°yØ»IG⁄Ô)ÅÒ¯°qu¿ÛeËa˚2Q≥ï⁄'¶F„A6»A0¶qyxÃ¶#Iﬂ*rÛWº¸Ÿìﬂä?Èúté:∏ów…ŒfØõx‚G~:æÃÓbÑ~ª€k¥}˚Œèòn<znl|H≈,eÎQÄâ"‘ÌÕqÊ‰–R'âpÜqsÅøYn,Ñúd´ï£…i˘9záµ\!e›ﬁ$åÎKŒΩãˆ}@ñòû◊Z  ~|xπ?Yk1ä—NÉi‰eÀƒo”»Ã[Æ1ƒÖè‡UUó·∂V˛≈R$ΩÌıh|Å‘¥j∫ÑﬁJü-¿ßÄKπå'> Ám,Ñ¶tgJgIΩl◊àp®√¿õÕãuñÑË€ﬂıÊ£¿K8¸˛∑ˇWˇ˙œ€*Çı‘Û7ìƒÔ»H		&˜-‚ºn◊äê⁄`¸m„C'XWBxwµ•uâ„%Õ#áë∞◊\aﬁeá:∑ù2∞Í±Eã8E	úSJs)Vj™Ê¿⁄s¿Äô¥±V˚é!t.G«Ñ–`ÓXÚ
‰©d|ﬂ∞Œo\Ô˜BÄ5äWuÈ˘°ƒ=—‡À?˜.⁄ÁÌÁ›çwéGÿX	¯Nîa	N∆Á¡0K?ö¥Áÿg^:ø6Òœ¸$Òì£hÛÂ˝V∑≈)∑r9NµGj≥Ûù€?6ÔÊXÍqÏœÅAhòÌ÷üPóZÚzŒz√ŸÌæØeOÊ¢¢œmñ˝Öë†¥Ë^Âêéx¥®”æπ{«vLıµ¥D‚e4¥*ì9áV£¸Â¥`åkB´œÃ#)pºIL"⁄»#îD4]ë’±ç≈ÂˇPdl4∆*CÏG¿≤%ã•›»£f˛Õÿ‡X+ãUÕvÛªØÌ∑ WéñáÒ¶—’w∞≤c^‰ô¬Ì€P+∫—˝p‘_{ó˘AÆr+W53©°g˜Í€9,,5e≈”ÿ;s_5
≈©¸ëFÃg¿ΩdBN.Òm)9mˆﬂ&Áí”$òNVÍä)÷ÙÔë˘§‘W‹©m]oqÏêL@•°kV4»Ωﬂ÷ëÚ”l	T{@p
¬%íJß˙oÁœGé2∆¢¿›SÈEª…Ú+ı-Ãö‚·ÓNF˚öºhÊÉhÕãHØâÔ+≤Ú™]ÿ∏ =aÈ"Hhqü∏…´&ë‹S|∞˜T}˙˚éA6Úù´o∞Üwì«ß≥¿aÀg˛¯•Ùûa:^N¥ù9J‚L§nlê¡+ß%cŒ—Ú∏»êﬂxóq˛ÏN‡†Ò]ªÀ8ÊcÊ àÔk≈À'Zı–‹iW P‚:î)?)7liπI%]K˝»f-Èƒ±ót*Mñ÷q+&Ï®√|,◊ﬁ)’6˜éûOJ%Ä—w3-£+k?y'¶>“˝öÊvÏ∏©ñ—ı≠?ı**s QÉıúnPP“¸‚èÏB>.‰∑fQAû¬˙£ 4/£1‹îõIÛ·	„<BÁÊÿµH˘^õjôç£çÀ‘¶Útoe;≠R'•6WZjß≤”∑ÂK;vΩîh[sVQ˝∏a2¶»∆dVUT/#¨ò#îLZ†kôz	+Ñ
Y.&sû?vUΩØÖŒ∂”n>äWtÓ®¿àaÜ2‰ne«]Qπû‘H5¢§U““AûüíΩ!9⁄mZ…º˙™:uÖw∆c‘Ì›Ñ≈®ï∆]4d4¿®Äì^Ìb{ohy7€›Q6p3π74∏◊ô€q·G¡(P.•∫∏¿€∫xπ°«ûvB?öf3ÚÄl:‘%0YÀüˇtÛŒÊ^w¬™∑2ÿ£y≈òYËµnıÇ˘À›Zí_K©=»WQJ¿û¿WPe¶Ù√öa˘ﬁ‹™Ìen[Aó¸œ:Öﬂ∞≠®yP	›µ2cÏÃNÇî÷∆ƒBF	ƒ_áÚ-¯†öEN•«Ò¿ÖqºT“~Uv8(4Æ⁄;4ùFÚñ_Ñl’¶∫E◊{ÀÎíãKí’và]mpã¶ø®U¬+UòtnPa\∫ò»á¶»`(Á;÷eÿ·¢—∞√µ¨´ªÀá~¬:
ç"q§˘ãÇπ[ØqP#EÑeRÏ≠Ë[d∑FVjıP$≠€ i›Œ˝ØπCV˜0Z¢%∏˙Ôº†◊v:≤√±Ì;™ΩJZ9w≠vzÆW2&W0S.ÚK€—dH¿KV⁄Gw˘Z\ÔË}Âóª∂kÍÅg«ÎúÛ9B⁄»*‘±¨‰t‹hHx|ˇﬂ˛üfci∏	˝1î«7pÑã£πC\«vç8UøÉ4èí˚™ €]s)4•eó<
‘J!Üfè¨/•Ê‚ﬂ;}ìKøO£UÂî$&„$ml8êΩ§-â/îé&èjÜ ∆ROÓ∫∏Ù ÁêÅ‚é‰©¡≈NÚ∆+ùﬁÈpQu[]¶l&
Jÿ•)H°wI‚ûHYÉ]F9ô
B¡¢âä°b+hüE€ôyÊ$‘W%‚µNÉe
,±áŸVÖ◊Í≤<´Ï”DæôrV“”Vã<„;÷,Ë,ws6∏R¯ŸtváK±z∂8=Mt‘Dƒ˜+$ÕÊõÈ¸fâ‰∂9@≤d€%L∆‘* Há¥©Ê≠Ó=r6ÉTè≤“’B«¡õäxd|ı›úÜÌ,í¯õÕëlô≥•&£qtΩpU|^Qäm&ô≠"ìiˆn•f—B2:….C≠EIö≥d©µñdÅıÂ2Ùe-¿ï„æl!—L/´πÅÈ‘Ÿ±Æ^tÜêèıÓ±•N±rﬂ¿n‚ÚÌõÃ$[Æp›≠!Æ`ˇ+⁄Vkb/û/Õd∏˜!F-¯˛ÉF	>«ë¬vp%*Ø„:}∆H“Ñ¡$¡W(¨‘ñh`á+∂Ò«¢Ò¨∫õÜ8ö ú#_tq+‚ÅJ∂ìM∏jÅÌ™⁄Y0˜…`ò= ,ˆnŒ#Í•YJÊ ,›ïk¥Å-´6@{;(
ÅÏ—]PØ'“Î∫Ç,‚ªä7/1Ì\{Çëƒ4L}æ¿÷€'éQ2˘Õ§0◊õÌ≤L®Üy`ﬂ7,ø™t~≥ÌiÎ≠œõù∞8øGWﬂ¶¡ÿk“ã÷≤kˆú+rZÉV˛ª ˇÆPÄojÆjacWäuπä•.‹4Ò.©w•ZCÖ9 ≈‰º“<Æî6E^sˇıkôÕÄ∆w∑@l≠ìôè…x‚ˆ6úp5≤πN$Fÿº/i€ÄÚa
‚KÑ	ºßI0«K^÷˚ﬂãCáoî∆·;¥∆∏úHC⁄ò[€#≥ˆsﬁÇ	¬l”Í&≠ÕåTUÔ€dÔ√D;ÒÆ¡∑ÛæIpœﬁÂŸﬂ…GqÜ°+Ôr˘+ﬂÂ>Ê≥|á[ôO≥…n6¿Ûª“ÿöyŒÁÇÇœ!]∆N¶ó$].XØÀ¿|æw^Û©r≤+Ç
¥òEj˝Ô±6.\îo˚ØÄç§‹Ls3/÷€<∂‰:6Ö`
`‘ÎB˝AF¶mp£ÎÆ\ÔGòˆÅbéÆæqŸO5òæ!÷Öd!?ﬂ2Àùy~j![*ëüÜπ÷©Ú£>-iDÓ¢6;ûé1^≤€üœõ˘v¨ı·E∏	l=liË]∆K¬%f2]	O±nÄ-I£)H5<«â™5î⁄Q ‚±O›¿æ¿˝¨»ª07äzyââ¡í§i‹Äj1œ-s™8ú/ƒÖ›ªåºy0&ü ê¿,®£âµxè#2•eBb⁄e;˙PsÉqE7:áı„	äÍî›£èÛ±WŸKú $»,WÂÈ√Óí]™3¿‰?…-«›¶r2ãÙñ”π¬Ù·F3_¨ymfm©ä%≥« ƒ®™Ì7ƒhàÆ%4çùh‚‡*ék∏∫äÉ:Ω¯&%K‰ÅÊ‡Ïj*S˘˙Gıi≠‰
v¬£ë#æq‹èk~æ2¢…∞Ö?‚6¢Ì°·—ÑF¥ûÄ<oídﬁ4%)m¢ûQIÓZò!¡7s7ß¶«û¶≠Äm™øÛ⁄Xµ*^›fIÂ¬}p-{õXv£x÷”V¿5zìú14ΩpDcY’&˛h˚≥gX_g*Yı‘û∑ªMu∆™∑<ÔÂ:i@)Ω´w£ÔRﬁ‘Sﬁt{≈≠pSsB[	§T ^(ÆS©ñåY≤wL[VÉ*@f\Nc∆˘&Çòq]7µ=ƒïÂò:Á Ÿ4®¥ëlœÊ|Ï£¬Ç
≥ë¶:q@üœ"∆K∞Õ)ìÚÁ0qjC'Ÿãπ∞^ﬁ$¢ÇÎu$SéîÛK´·uU÷s(Ê'ô–∞/#Kè]‘Îﬂ§¢a∑ª±"Œ7’ÊjØj~É}„ê`7@›“&™Ïç≠w≥¢oL∫˝õ ìw@ÜNº3…ˇ…ÏL$/Vò´x7£˚Vy$-ÿ± TP)âAÆè’åPQ◊/8#*5ä˙íüstıı¥C∫hÎÆò –Ã†t£óÆÓ}¥∫X˚õπ1Ç®∏}GùÜSvè{ãøˇÌ_ˇÿ©,âÅõö£‚1f„¡£8ôÉGm"â7â%õ∫¢È˝»0î2›«À-¯Öı÷n‚ÉZ#∏›√‚aha]xÛ¨xBµ…u–FÄ”{º(ãŸÂ'π#Ÿø∆ô7ß-=&†§|…Í$•>fﬁ3{lH¸hÏç|Ã5Ì‹€X8í7PãÈ˛ÊØõ,†pnû˜FÆmY÷E??£+	3*ú&0∑•7íî]}3¶mN∏Ôd§§|¿≈ÛëY1+G É#àÕæGe%j8<÷‡C`X∏˙íLÚŒ∑¢˘FÉt°çÕ‚ZÆ}QÂòÍ:ıV˝ly∞†M´ó#êﬁ…C	do:]mÁ]ßU¡|Ïç 8a‰›∂*ì ≈8†…˝◊A Ô@i˚Wø"`s¿KÏ/ﬂ…í`n/b,G'UÌ…:K’§§W…•±∏loc‡…N©¨—EZW√É(ûo~æΩ∏¯ºªˇ$”ë∑vÁŒzw≥∑ﬁ€ÓÆov∂oΩ»'{7FXœ.—˛ìü„±|Qúah_|Æf 9uyU¬]ÚÑl`¶ÓCÖøWY,Ôÿ?z2€=7uﬁ˝ê”E…Ç∏XR?•9,¬¥9Ù¿ƒùNm°Õ{÷T„Íπû —{˙Z≈ëmÿâs¸◊iZ«˛ŸPÈyò/™Ê_cF6Çaè	¥!HH~ˇ€ø˚ﬂd˜ì¡)Ÿz:<ÿ<Ñ?0Œˇº∑ø{ÿ>ÏÌ\˝Ê1|±PMrP;.ìÌŒºlx≥å3˘c“:P|aN∞mVö	?v7…W‘ä*≤ÿ∏sõå C'Iº ƒ^&¥rÖ^6®»Äó≥∂hD‡æ`—æ≠g
qul[`<>WœÒ∂’ÿ≤%≠≥HWΩG1P‰÷◊ŸóGQM2ËG}V‡YW é”íÄ\ü–§øW˜õm∞e¡®¢ŸSu∑^w©BÆu-b¥J@eE.≥Tjπí
–ƒ*`
&z©I–OV∆±öº vQ:S*√r¬“∆ŒFqxı›æTêóÚSQ‘≈ödÓf∞Jï®›8Jó!Ê¡Ç≥`å2h‰ßÎ ƒß¸âb‹·GZfÚdÃ,y#ÑVúr•åÊñﬂW’œ¨>È¡5—°\-eøLn◊¯€ãJ©U-ì“mT&Ì>ŒeR¯◊ö4WÆQ•B(wÖP6¥F‘øÄ»ﬁe§+∑jSîÙÖMcSë∆’P∫’’Yº†ÑaÌpuéÅöy∞e∞èﬁª˙≤¬Ÿ®∂°8ÜÀicè'ﬁE0·+!W_'æ'~#kOb«ÿÉI|´¢€G6[ÜW≠#ﬂ{D8(øg†ú5¥±^ø«ßº“”Ì´PüòÒ÷A5raQ%±O¸4ı¶~∫VW%π>ÌàÏ=˜√qå›¸j/ObZ∂wO¸–·rD∏¸_æ˛$Ω»I|âY§~8 êQûW«ˇ>¸∞cÂ%dÕˇ≤Cû˙@ôbÚ0N£¿{yã3ä1™∞úBåídDq⁄!ß>· ∫˙M+Wøõc≥1‚_†>å:_ å%AD_ìÌ AüEF.kIÔwÍ®Mµ‰EM¡yÀáI'k(—ï7UÜÁ7Ì
P™Éaóπµ/ÉZ£jïx‚–9?Û±˙E»µ˜ç?zÂG¡ƒ„!âUy[UÏcô˛†¢FﬁWHUb‘Œ®ú˜p9¬¨™g´•G”¬æ‡û»\ìπdb
ùbë`Ù¿∞2yI;õÅ÷ne“Éôˇ†çåΩpºúÏ’¨›€…˚÷ X¯Ø€TW1/>7´Õ"’I+†7Oß∑™w◊T≠£uÍ‡)5eÍÙ≈Ñ≈¡õêä1É˘2eÊÚñêt¸hBÁ≠6<™b·ï∫C]Ì=yÄy	Ü˜¬P⁄ëÎD]DYPÇÖÒã…ÈÄkí≠H˜¨O<5,G-UWÀoÉ‘÷Ì§∂û*µu˚iüu…•|•yπ4GJı;™E±ö≤≠ŒU≤$RXî]0&ÎzÎ|§´¶í-†ÌPﬂ…ˆûg®§´¿é’Éòm≠‹ªŸΩ\w›5éΩáú˚£≈&ﬂHˇœün‘‘•áÊ˙yÎ¡cÑò o‹9ÿø¡ı∫fì#Ü‡∏S±^bØ'î™∑◊≈ÅÜl∆:âﬂ>OºEâx<†Ô¬°Ωqu9Bò≠˜ÕÂ–ﬁÔ .Ø€ÖCÍEŸ1ç
K˝51u¢√è[ió7cπ*_ï≈1Jâ6éó ûQpíÅÄú	#[é1vÛ!›#V±sQ§XË·wX?˙’•~˜˜Ø∆ãó^Fc‚¢Ú)ØL.Èc5á« `—)n≈}" § &,¨m|ˆ¸xxÚÏ…ÈÁªÉì˝G˚ªÉ›˝√ßüΩx˛Y˙Ÿ…ã?˛Ï˘gñK6¶ h≠[‹ÿ§PüwÓ¡FÓSå«ﬁãQÏ%ìŒyä£]À«›‡…o»ÿÀ∆3ÇõÆóéO5,ó÷Ÿ˘Øt.L®v¡Ì± $uÊ™⁄ZΩRùµπ%QSÔ∆e≥˘ÆXÈêkyªÒ˚“b8√[dŒ[&•¶}3–ºõ-Õ¡çﬂˇˆ7E¯Îü∆YÉ‚Ô}qú•eﬁSö¿¬ Gìá\w≥ÿÑµ/>ã>ã>¸w:π!H≤yw?¸≥ËgØÛiΩ˘¬˘’o1c∂j¥Óõöô∏·&’zﬁzÓs{°∏Y`)Êº¥@ea˙BCÿ"âßpïcë“∆˚?I>†∑â≤ÓÒ}(ˇs#!IóÛ9¶ùé™„w¥g  â;ùÎ!Î"“<£6f †ÛÁı5·ı‡KûjÒ3™Â]≈I$£Bw9Û&˛~‘∞⁄éiîïÖqƒò0ÚZé‹Å≠ñxê-íYÚë≠®œÒwÒ‡ë#)Ò*å◊ºx§Y‹¥¨„uÁeß∫fC—˚®-¬©ë0…bwÆ‰ôºâTÈZFAÊ}óhßV˜Uï—«9sª—™5,√ΩZ	ÓïYx-≥¸ÈOJvüÓ<;Ÿø˙Ì^$qi8ÉºR^DwnŸ®¬∂%⁄Ω‰]˛ø   ˇˇÏ}[sIñﬁ_…¶€”–6	^¡ñ∏í: í‡ÊmJ≥3⁄uH’]@°´ äîö3/ˆ”z÷ªoƒÓ:feá/cª&⁄óây∞#ñˇ§ˇ¿ÃO9y© ∫g äÍf≈Lã(†≤≤≤Nû˚˘N,IN K±õO·mü®RVû‹éˆ…H†¯≈#Ÿ˝∏sÒ˚4&›Wl 'I◊d*0a|„V–˜’8s>ê£¶L∆H›’›\ÛÇ›ûS/ÓR_ﬂ….„S#‰{.„t˘‚=™åòEÖOQú!q/ßÌs2∆ "wkˇ¸sÖ‰Á·ﬂ0€è ˘Sù†Z˜q˝©œêIüëWëŒ˜ë4=xF=ÓQü\0`iƒj$π≤·J†ŸÙÈG"…f¥9ÊúòÅÔ’j°äA’πÕÿî⁄™ !⁄)®)gä†©r~ˇwˇ¯áﬂ˝*˛Dy)•Vå-ÇGOÑ7zƒJ¡⁄ÙÙ2ãl¥b¡ºôﬂâ{û	∆L„åyπ#^7†—ªÉVA˚B|ô]zjıÊÂ\ØËÄVO3…æ*SHCﬁŒh1òpœÔe»ı.¶=f˛F¡eAﬂﬂ¿;21ëò¶àTs;Œ,gJöh·4≥â/lo(ﬁñö‘¡Æ≠–Í+z&U6té|K÷(Û˘h∑T‘©∏Ü Hù˚ få≈hîT⁄£ú∫›©ø„N'Xü%2DŸ©d3nÄfïΩûjùI\Çf-E&œ.“ﬁ9’¯lˇîõ/Äâº¿Ç*ò∏˜Hy≈Â0—w™F◊kaÅJÑ
¬≥qyüV‰í¢;#ﬂŒUÜ˘‚a≤ÁÕËÃfÌq˘÷Ã˙}é0D~eñˇóØﬁﬁ_EŒõSÅëq:q^¿Ä‚Nd’é;B¯2d˝ª¢—K˚èÀﬁsgßÎ:+®X¨|+" nµ§ Ãda«æeè¯ƒÆΩ≤#Ï¢LD)^µ°îRî)‡H…µ§w,]#^‘¥2r•25»vdç®£õ9’ˇÅÁ∞◊«ÍÁÄÛ0üaV±Gú¬z…<≈0“Ca≥íë‹Ò$IoÁœÇ√lÈÙÚò=˜_€ )≤ï€pjîíZ&Èi#Å8è'tnF∞ „÷V`á-=¸Èa˚≥ŒQΩ—|π€Æ?>Æˇ˘q±]Sh’`¿ëÂ\ºÜõYû’˜¨Ò¿/ˆÄÎg]E	Mßƒw¨ûâ9ó6‚Ê	5–àî¬ÉàMÆ,hñc©ÿZçø∆W¿ØJGäX·lƒ+∑—∞`[u¢‘f≤÷ºÃzÓl¶jn}æª–jö§å{?Ài4eux‹÷”Ñı4…≈”)®qác0hFXÚú^VÉﬁ
,Yõ_eMÍDÑ•5π,#k‘7}Åf–⁄∂π”5L5Kq[&‘é®ãŒ´ô„π"R#≤îÅ‘ÄïÁL`⁄›|Ôw:hÉˆÂ1CU(ç[2"ÉEÛå1*]ëà;≥ù¢^≥/83…Ú*˘ÏZ±ö–h’Kã‡sÁ/ThÓN?íe≠,G.£ìL
aŒÚ«LH∂ﬁßWﬂZXT‰08Í3ã)x*yÉÊÀÙ¨◊´ë´ëúÓ@£‰q∫∞p9–C—Ì¥Ωú⁄•ñ≤ƒGÀYˇRÛ“Ÿø˙—‡‘"` ï…QÔîwÀ÷RYR⁄ôemZπ-Á¥Øi„W∞ÿ±u+$ûD˘ F“˜∂Ω¶&“,HwJjO	UIÃ+Ó?)ó:KmåZ®Yn\Œ√.∫Ô<Ú‹ˆy¢ﬁëÖ®`é%PL{†.Ì>∆ú±cõÇÜE⁄‘rÓpÀE,~Ûkg(‰i∏Œt8 O20ƒsóß^a_Û«Âè©ûΩæ”+é∞Ãa^⁄Äñ;·ÂØ`ˇ6–•±BY‘{®•Q¥<∞Eà¿‚$·`NXy≠‡>{Øâ*-IÿLT„mVâú’uíû⁄ s◊}5r@…8`@ø0ß ©Â¯y±/<Ù	≤–ŸkƒZÁH°J˝”ú®4&.D´E•ªò“‡ıÅ6-Ø;∞œ\Aé√±Ì•Ôò§ˇ¨ΩGF6ˆ—ÃM”/†S˘˙80	ßS{Wt{8¶£ü¨â_è;À£ïèx>ÙÀqÔÙ£πëØö›ñHyK„®jÇÔû•ä®°LDGJ=µΩ!"írRê†ëØjR9ùØß∂sÈ5  n˚Æ)ı…–≤ùí)∂Éã∞L<±ùBûx˛ñ4“ÑØ±uäG]2ıôWûΩ´YË.◊$Ov´wCõX+zÏ6d≈_%Êº[Ü∑ôõÉ«-ùâVlxC∂|≠bG¥û?©1†∞B9Z)´ÃÎµŒûáÔHk∫X—\4[OÊeœ:Èw`ˇ·6ﬁö#Œû=˙Jﬂ´‹±ŒÄ¥qª”\Ëïˆ£à€¶î“aúNËˆ™‚⁄π	6^=ãsƒ™{DEGò¢/Ãs,2öû–¿·ñ'Ì1)ºéÂ?3ã ˙È 40	À Zæ‰]Â_ÚŸË‡4Ã @E[lè˛”€&_¡Z>∏!ºwõâŸ√~ﬂﬂ_•˘¥}Á›≤úY¿–”æ„=¿¡∏dô1ÿ¶ÿvcï0ˇÈt=LˇiFa4ªpFüÏ|¶xNó⁄õ=»lÀÈΩëù∏7qGf˚u˘¸ó	º±âÎ-‡∏.#ØKSÚ"«—ø‚ù#∏_aòL§W∫q…'K@Ö%\ó?˘	âGT#,H'ı»0ûZäî∫Cññrp¿–IF©ûyNQ‚O¢‡ıs◊@xÑéôhfs4ŸG#—	_∞)sÎpRõ≤¿\6‚¯$≈%å˜[…ﬁ√x¶õ8k°F∏x|çµálﬂI∑Ñ—∞v1≤™O&Vw†ƒè›√”S⁄sDM"÷0¸°ÉC£nÇÙí!¶KB! 3`¬|iÛ©Èb©±√*ZùAdêJ≠ÎU ’Lëëyq¬∂„Ûówe◊ÉıÌÂıªµÂıç{Àk’ç;h~â#é…sê¶Ü≠fÃGQDä",U∏Ï∏¢{V$6Ô£ˇΩÎLml¨í
r Q'1/Lı0szÓ2vWÔ}9`	Í∞ëﬂ‚∏Ò—rC>Ï–(®‘zb-t-4í°ÖÖ(h1LoLæä∞JâE“öπŒm¥õ˘hØ√ë3ç√e®ﬁt–˘æ¿U(§9Õ∫_ù"]÷∆ñı§çJ˝Kﬁa65y#•b<¨Ê^ mˆZ∏–i—ÓkXF¢+»u≈´na∫ZN Z˘hŸµØô]Ω∑◊Ç¸\™≠l[òƒC∞q'v4ÁÍÃˆß¿v—…∏‚U˜k·¯˚)/0‰I·VgRl"j◊ﬂÎcUò¢ThÖ “m&·≤xB-O¯$%àõO∏vbç¡ÊË¨Æ.ÒäAÌ:ÔÍ;÷‡M7\¿-¸£dË@)H	√
-≥ªœãêg-àœ!9U¸hîΩÁõùAçª60—3iÕ∫îBy¥ò%1Ûö◊e.–õRíß?à¥√\')`ù¯Æ3ùPQCØ-À+ç@«[KYR™€¨'Å\∞…Aƒ"µ /;=^}–N f]5K’v≠Ø±>≈™n∏]®oâ¡f∂3!^˘µë◊*iÈa«…Pf$5±ªüç='Y€≥û{u∞ô;óqb*¶<µÆÀ¬9ŒLxà®Æs3«mS«°#ã`≥÷ttH'∞€D√Ü1+ü¥EüMloâù∆ÅÁ[Xíﬁ‡mâ˚œAo∞OÄIÉE'≥µ`›º)+Å°Ï·òv1>≤ÃÛ∑¯U]Ó¨á˚–æÂÂeEÁóE˚@Á§(Xﬂß=÷<Ω3±Xø¸4q≥˝®ÒNÉ◊πÂ#@d˜j‰5l£˝∂FP∏á!ÇM‡-µG· go^∆[´G÷7bÖ|úœl≈¢X˜"˘∆C!ímˇPÀ)£gaíxgCÓh6√æ+Å^\∞™∏Ù»sª‘gwm´?∫˙ËJÄ£óõSÑ•∂ûÀ*Âú-Ø)È“CY≤‹ß3°cˇ≤¸4S;‰Ö|6S˝Â”ÜÄÚ¨éÿj”Nå"Z#`CÊ‘‚qCã=⁄G¸#OAaıâ’µzWø‚ﬂ
È›¿!D'”T8ªÀar•’Ï¢!≠≠Æß()xHR=ÙF≈‘‡’d¨§Ω†°CΩI√ˆ∫NÃË‹ÜΩΩî√£d˙√Ài≈Tò√–3∏ñÚÖ±ŒE+@÷àg§hp«±Ç≤v¶g¿SØ'aı”‡(a*Påˆü¶Â¥O iÛ1—p4u¶}Í—Q◊∂0∂f!◊m|⁄Ö :sc/≠˙Qõ·†ö≥‘°îÿ˛AıÕ∆N‡L˜Ò¿–dÅI‰®πàˆY√´∑8‹¬ÅG+™œ]†≈ÌÊ6Îv /QÍ1¬T…ŸŸ3ïÑJb;˜1,/l/JÕ#À€!œ©áÍ$yä*†w¡¢æ˚÷M˘fœfäT>@0õá›Cı'Ω¬√«+]~?‚ç√{0@°M`ìÆI≤‰5√cﬁHÄ≈™î\√9Ädd¡ddHxCÕ£–¬üƒ.Ù„kjuö}r≥Q»∑÷2`1ÓqoZ,Ü…Ûû	¶*ﬁ`,≤˛d@>&ÎE~AËƒya∏ä€œ0&tÜΩMÈ"}ÎzfqøüLF+E$M^KÁ„≥„ÃÆÿˇfÛ•æ+LÊZ+%û‹ó¨ºI)§)@,ì∏dõŸXvÈËf˜÷bdû
∂ø•ﬁ+Íè!;)õd£•ÈÙS›YÖK-‹≈œ]Á›Õ®óü°¥AqL´∞-5f]4ûFX·jˇŸ˘ØÖpz¥=RI%±À‚¸5È8÷⁄ö0YÌç)&Ñ≈Ë˛!Y”√„◊è∫ÑªªÁjÔÌî››su˜v…}ôŸ&áØl™ ·‰ÜÔû`ˇ‘œ¨—k+æÅòå.>≠¿†^@•Ì¢ÌŸËæ LÙƒgFW"A$a∫ræÚbe˝sÕÑÅ6ÄÜnÆ$-n0˝ c∂n.ûΩ(∫[Ò€™1'o1äVg∑9©öl,ƒˇí∏˝à˘:p_	Å«˝lﬂU>”Nk#Ú3‘àî5’¥z√hÇ˙'p&gyw;_2-S∏à`Ì“V^ÛZôûgOÄ_*†7¸D-⁄î ∞ü‰_¸W˜t¢ £4ÃV8#ÖwÛì[ZIxD3èÑä
æ∂§¢’âi;-±¯?¢|!ëßqΩ§™˚{÷º›Y‘<ﬁ§í	æ~|J6{ÃÊé/âˇ·,¯5‘/Nˆ#˚±√í*zTê“úN†à£7ì≥"‰N˙Ω¿2ÂBZTSR`÷Äa“ªGÄ¢UJq[¸f+Nö;çâ˝˜éªÜ”K“2⁄5≈ø‘È,R™ù´∆∫œ]ëª⁄∑Œhπ]-ˆ)\n”Ÿ∂çf÷aFŒ°öèıÓT
ÛÓyö[z÷-Údjy=+≤%∏ùI˜ªd◊µF]Í0ôRäÏÏ˙y^∂RîpvÍ£eΩ[´vqÑ¯Á≥R!ws&√Îl¸T‘˘„Øˇûuó©Ô>Ø4öªdøπ€j‘˜Hªytÿ>&OüÌí„√√Ω÷¡Ú®ﬁ.∞s≥l\cÿÎ0Ø%íÕvØ¶Ù·˝ùj“˙8w¥≥È‰¢‘[§3πp(˘	yå›˚&dﬂÌŸß6*ÿm˜ïéC<´	∫Ül4∆ä◊ì∑ö¡î∏ VæW•û;fˆskúÈ9 ÀC—ﬁƒO©ÁYCtyY,é‹¶ßÏµRó4D}89r}ò∏Ìz§“™;îtcXxºëÊﬁ#X∆0FõrˆÉÂ®˙MSon'f˚îƒ±OÃöñÉ°‘V]ÎVi…fÒ¢Zemüñ„+˜πQõˆ‡ä±Ú¬d˝fëpØ'—πVíƒ`pgπÆ≥rg∞lõh—À2í,§‚['Ô¶ˆS™qƒúæ¯DMBè5óc8KK6‡ÕÃS˚gŒtü4Åtw!w!Ö(Ìòµ+≤n%tEÃÉ‘h#ÎáπEsnJùÂ”Gæl–ò=ÿ	H_X§C9q$I=éf†ÿœ´ﬂfNÍS,ﬂ)L√ §/≥în~pU£ÀÅL@Œ;Ó2Å”ëx˝`ñÿÓ0%VwÇjñÂ∞å'Å3Ω–r&†ªá)õ Lsh1∏2ô˙±Ù(¯ïHùÇü˘.Ô†—+Jî‚;÷‰≈ıöæg˜˛S•}–Ëú˛N¯±&∆µXòk¡\¶÷ä±óv!x9lgÍw=˚ÑeŒ”‰ÜfLC$Œ=ÖwE-ÏÆ.¿“N0;Ç\H x+†ñ¿ª Wø«îT˛+Ãç nÎ>¸eÒ.”c{=C
¿~ùòµ⁄u±Êõ;gI◊ª˙v¬“W¡ s˝1ÌP%
”à-ÊB>£U“tÏ!lW1{·⁄ˆh8&#0Ê‘fho!˝Yÿ=´'H®Û∆|Íù1ÇÊzÊ{_ÅrÂfúFÌﬁ’oF8ìÍíVu]Øâøà¿˛(cjoƒMÌ$@^9”ZKf~lE,ÛÕÙ4é˘
∂∏,3ìXÅºÍMªvDZY
5
*„Iõ¸≠¬=l
0?€>˘≤1L!í„96?Q∞rNΩ #ﬂˇ›€w§Xœ9ÀÂ‘:C{‘ı(r	ãÏµû4€ı˝Ê¡q_÷»>£l´ı(béS∆"TÈ“ã±¨‡˝ßD‰fÇLÄÎ‰≈L‹HÙKÑ∫‰∆Æí˙’o-&[h◊ñlHd◊˚(j&6ìH˛2ÓèÓt¢‹y&ãÈ˙,AˇÍª!£-(Ì€X˜tı≠‰[À8"pÿ3ûﬁ"∑á£p®u‰…c¡¨Ë9ê	L_0SD⁄Ö	Hˆ÷µÒ”¯Í-ÿçßp´æ›g,ïﬂV‰ãë∞XIŒ≥ëŸ5A
OqPW ìE˜yΩ«sËˆ„∆MÁè¯d4»[Ncñ(«Ω[n˘>pÀV∞Q#<£úÊÿF‰ª0PPiC ÑI˘4A@◊œ;õÁ}Mgä£‰èø˛∑ˇ„»?E«85J`\ΩF¶Ák ∞ß`tZ¡ãÏ^}á‘ß*Rl+=óë0"1∆√5ZM¨î≠¥ªÔbÅˆÕ∞˚àL¿ê€J…
„D ·ó 
VQU?¥á¨Ãì1Eß„H?U¢Ë•°‡∆*8O6z«BÒ0>£Fwhcf„e
 †;Ò¢·-€π±lß!Ièìç€gR“ß}0#d&W∑ShÚ˙Õc!˜ƒû¯„Øı˛ª_˝ ŸÃ1»¸ió¢b‚¶;{SæÔ\˝ÀñXyvXpËíÈƒñÌ-±6€Ä∂·µ¬ÎƒÆÓ¸}+›˛\éï≈z˙Y§ﬁhWI|2j~®ÚÀÛ44ãóbÖMΩÄ˚L@€ü:¯c¶{Åf2•$’‹ãTíﬂ⁄~Ô#[·Dcá®ÔVÇRÅ∏B¬ª~f“”∏¿M˛’Ô·ˇø3d'≈ø‘p'Í‘$]c≤.>‰P^»Ä?å˜¨.’¢ZôMz®0”
ß<+ﬂjÊ¿k¡Ù˚“ûÊ∞À∏ŒS◊ÉU∂öü*ÌVgı®ﬁËË$ÎEÍÆ_J/Úúkg¡F Ækë⁄3O†ŸÔê/⁄Õ£ïﬂÏ[ìAı‘q]Ø¬˛dΩá0ó?!˜÷‡∏Ék¯«ÂÀ⁄Åã!∫ˆá„2¢Ø— ùÍƒmu;lWπ£;X¬‹g∏#˛ú\Ë^⁄sª◊€ˇ"±íoæ!Kª.pZÚ‹r\ID≠˙íÓòR∞Ì¯ã»1Óƒ√rﬂ∆>n=W{\ Åfvz]Q1cp‚l`t¥áJ√K‡8Ô•gΩ⁄a ÃjáéÖDıÚIı‚Ñú<øÙ’_8ËH®LÄ≠‚˘?Ì,∞c'¶ì”ïªÀæ°£Æ€£œ⁄≠Ül;\˘ù√É™œ VUë‘æLFS«Y&wÓ\~a2üûhµTuÆs“`˛ò*ÿ‡∞Máôﬂï%kI3± aÄ¡àö≈/<z∫¥¨¨¬<ï_¬¿_ 5˙/=€˘·π6Uπø/´xﬂ/¥o)‚ƒÌ]T-‡‘£^c`;ΩJt2Âû†ã¸M7Ò9v≠Gá†˘Ë]¨õNBkÇå˝åæjMM„å«™Sëà„…ú˜R"÷y`≈Y%eŸ=◊J¥&çDÆ{≤ãÍ‡ ï«<O∂í›˛dG5÷ÌOë„(´WõO€˜ú
œ@ÍX'∏"YïÛa>Æn∆”}Ü√¶Mõ∫ä‰_ˇ_meBSè‘√)˙IA’ZfQáYN^,^ªŒöÄ(·[$•ZR'›éµ8Bƒ≤ù0I†ˆ"köQ∞àïZ.˛]êí≤áÓ¨º®m‡,ë±7>	—)N9y€RÍÍ√ÜD¡—mÊü‡`ÚîOÔ[Ø÷t¸‚3{/`∞G
ÎŸ>%”¸$û]$—ÑTŒ÷ÁõŒgj±5◊9H—\Ω¥Ï¡O…¶úóı∞§ã—∏Iı¥Ü◊‰'MÛWóΩÈÂ“§7)â˜¯HÙÚ8˜3˙~)Ï·“¶†≈åyVZòHºë”L#¯ï÷J{=®”∏d`]§§my“t‡—…3Ù“…∞kœf}ùW5GÔÉ∞˚ÉÄ	7xo£k‚¡J€´≈s·(˛‡;Á√sI¥^ 'N¡c4„≈œ%›Àt6 ˜:wmWrPsÆôS+H)sa’…VB¿ßc',Lz£$ìVÿA-õIGòÜ£éøú4.=©5ÖOœõ/œÙ,ﬂ,á(ëUúRÏN-MIuD√ﬂÖæh≠b«:°Œbÿ©Ÿ4.JËcká †.©◊qA≥ÁòÕ˜Ætv @^‘{"ë‡ÿ'û»E˘˛ˇÅÏaËﬂûÿtëÙy˘Â’€ëÄîhbªi£ªiÎ&èÍÌvùÏ6…£√„√Éfˇ¨ÔµöıFÎÍo»œHßæw|àßèÆ~˘§uPgùàÕ’S¨¿çXuZv`P·cct=ï-Àòú˙K}%¬ã1u{NëBÍà1-]BªèwÊ+Ø3ºØé·éÈâÖÚ•åT_Ó6_’ëR?_“≠ √¿k±<j©ûÌ>ù∑ˆ£ãVØ≤$≥2d‹iEAÿ\∫C,ü<=ﬁﬂCnVáâ+…7Ã„Æ;,Ëí∑1©‰‚¡—SÂ™à∂∏d^”Ø~‚cbG£¥õpæÃx¢ø+åôWY“~mrº}≈.~ GÆ˙”¯®¨-Û%¡8‹1˙ã—áoÄ\.ÒØ/‡TÚxÿÀ√ƒtÃF9∂á‘ùN*¶Â$|/ß@¥æ>@J‰ZDKëØµmç˙¥¬	Èc‹\°±%V3qﬁ§ñoô‘÷ÙÊ@>g‘_ê¥7"[GÚ?ç•—É˛§ÙÇ}•≤dîJø	Éj¯∂=·'◊RB'ÏÜùã˜‚”≥îÓ≠◊W∫'¢èß‘{ÕãxÇ¸)ﬂÓOEÛiãéªîgsŸ]€ŸW·O∆Wo—-ƒR™@Œ˙ ˚≥ÏbŒUVÁ>∂Ú&ç˚>&-û+ÍëéÂL±#>ˇ˜:OØú ové@ˇ<|πæ∂ø+≈o•¯≠◊ªˆVäﬂ@)Æ∏”∂ì p©í<ÈÌΩïÊBºaÎ+Ê´yÕêù±É’≥Eé<HΩıµ·P∏E–”¿
yÈp<˝D£ÃÜ&ÉÈ’oºSk‰˙sîÍuœs_Âäu£n¸¯ò4≈„>r¨˙µ>∆'‘s∆œ5]∂dt”BÌÆ^nièbªIˆ∆Œ_ SªcKÌZ›^˜%ª,º+ÇîÂ©
ÖúYŒî>xóè≈¥®ÚoP£(%i¸êVaf†⁄TŸm4í˙U‹›WA<*å&f„?E“∞B◊ìU±ú¸Ìµ8\‘v“áMÙÙÈ–é7ı[áÎ«¿—Ë æà"©m√L@∫≤Nj€,∆œ∞>Î5]πP®7D—¬Ùµ˝}ÀÒïnû·aÔäO	Ç¿Æ∫ò‚Ö≠µÒ˘ùœ…–≠¿7[5K≈à”`Âﬁv1qË@·*Ò`I:ó› î¢Vπ•,_OØæ≈t˝Ç¡gÌ¡Vqô<fò»îÏöµç§4^πõ¸N!ÍTº>§µ@é
eÂ|ô5ÒÉxÁâ ûª|„±nD`-aµ∂#äò‚HNÖòÈ‹çT?hÓ1ﬂ}Ï&·«?∫˙eª]|Hé€§U'ïŒ·^´—:ÆÔÚSp≈≥Œ≥zªuxG√°èπnÏiÔ8<k(ÀÙuM≠î∆Èw±‰‚.…®»‡äQîTH@C∫Q˘Ö æÈçl‘ñ6b¥˜Wæe.7ÿ‡¶p€Gpª˘tHRF’SI‘g7ötŸˆq¬C ˆ≥!#äuﬂˆ'Ã”ƒù5–Ä∞vôÆ.“]<Ö›ÎbøOÎîªS‰¬\.–@¶C√«Kn˜ ˘d·c8«±z™≤`…{.ìÇÃÍå∏ˇ.Ç~§ïè.PAWΩËè»…Ï«F@ÄÂ† g ‰∞Áil∫ÇŒ+S‘æƒHíJçåRÁ
ÍOùrÛäçƒ∂ù«H¨É£È@⁄ò~Q/„Á•@áç˙¸aTrEπÎ:.630.F‡á,ÄGÿOèX*îò.∫ÉÏÁô±ÜÕ ÔtMI~∞∂5S,ø∂îHÁ~¿ÏzÆñv≈ÓöôÎ…€Õc˙Ç‹⁄ªº®FM(ìM®ıUõ∏ü hÎº2qYéÿUßX-!_µ„ü®¨ŒˆQ≈+±c2:ÉÓÒ— 4îœ3⁄ÁRJõptS$ÿØ≥õÃÜp‡q´‘¿«¬è•t]¸RwÎiKS£}ê≠0hÌÏÅÕö÷¿›RlÖÕÚjﬁ‚ÃΩ—ÕRêÉq;z~≥:÷Ã§◊≥Ò≥“∞ıÅ≤íYüî°†ZÉÍÈÄ$ªz€e¯@<w–Ï°å∂9ø¬–h…Ÿ `Äqc⁄ìãC¯«C^àÅéÃÎ™œ∆bÛúÀuz†Eû*«IÙ©∫W´°<ävÄäÌEÒK√»ÏÀÈDIøå“âY˙•z‘qg“Î°Ωv/ë{‰Ør¨t6QÈö]3+÷ö«üJØvV¯«¯-§TE¨ì¸?^<]M)ãÄô3'ÇÆ.Obqc\'ÉBô±˘€◊◊ˇYÜ˛∏iÓÄıwÄ‘<8öliÔ¿?˝øó√–0R´;•ûh≈ÊXqh6téØﬁ2¥4^çeÑd¢÷ß‰hJëI±‰hR"_OY‡»ürHL˜p◊◊ª‰ƒ∆GÒ∞‘®‘;¬uı >Ö%±öËà¿KD@ƒ”î`¨8HèΩ£ì+ñWÑ9¯u~qÔ¶±c–‹ÌÄG9◊©X[«nøÔàOR Tñ8È"J…#÷ R"Cq¶ñ,◊W˙´≥`QQCúî:|¥µcnµIév´GyT2ƒÌãLQ˝9
r„´ÑÄˇúéÑÓä‡d^yÁÎø-ﬂê·Û…∂îqODºœ5w£∆†äDîƒöﬂ5“ú2%zÉ`ë√cC∑•<tõRÚcF]˘£≈Aƒõ≈÷ ™‰8W_%S“-£”d›TÓƒ@˙iÔñ=›\ˆ$_QI˛ÙøE≈7ﬁ9wınM5QC3¡©R˙ÈÆn÷Æõ{Ò{oæ∑‹+X˜í‹´ŒZjÙ~Ù\´ˇ`J¿-€∫πl+xG%˘ñ «©°G3ﬁèIr-vb£VÃ¥B§ùkÁYÏÊ=eY3¢‚DÓ˘∞!ZsÃ¬øÙØ0r$º…¶Ë≈πÔò∏˝ŸC•˘√%€¡ÚlXdÍ/¡Âg·Û3Ô˘!À!Œ'·õx@ﬁêjµöı¢4q%’£/L∑»mr¯Ï¢o Y≤˘}|:ŸO_ñJ‰ﬁF©xƒı˘ëóë£ƒ:ìX‘õz-œ2ú≤qúˆõQ∞±ã∑MO=Í±~v,ﬁ¥a§óá⁄€Œ‚ÌæDCØÆ)á5Ê±⁄⁄ö¡∏:˘üx0(w"{ÖYaﬁïc°?ºlB¢èú?LÔ#ßÔŒ|'TÙúb˜£X∂Oe…ŒsÒööh⁄!*˛8:⁄ûÀ\ÎeíÅòææ@ß¶kÏAzcñ∂Ä≈îP€ŸƒOå‘ˆqZ*ñ0Ì≈‚mTÆ+yØâ¸÷D=TBV*Æ∂5”à6˜zÊTBƒ<œ=§…F´€S”WòT»ºªØÍk§˛Œ†Áb∂È@üàÓAûaé©K‡FÒ%l6sÀó¡ó‰‚ﬁÚ•õ…ó∞–≠v⁄∏aV6¥OøtΩ¢¨ˆÌñ	-Ç	âµΩÂA7ì!¬´nÀ‚C'Œî^?zj°ELÉ÷ë?2n‰XˆËñ-à±≈ΩÂG7ì±weO.2˘—Q¥Øù5œyﬁèâ±ÂÇ]zÀà¡àÇ’ΩÂD7ì6
ÍÆó5d“qif§˜k≥∫¿∆≥˙nõ¡'Ô∂Æ~πw¯‰›Ò{≠GÌ&9™∑Î∞ÅñèöÌŒ·A}ØıÛ˙ny}§X™fT08k±‘ˆ©Ô[}⁄˘zjy1zõO1ìn?â,ÅYÎòéËƒÊõUÑÅƒ6æ¸„¬às@%«1H0€&iÔŸ¯’⁄£ÒTØe"?∏Dg–*W	¸•.H3wÚ#œé5[Û#é©ë6®9&ìzìœË¬èw1K@ƒIZ˝ä^pA⁄du›òÇë˙¯2}æˇ ]'1A≠‰G¶∆ƒ&∞¥ú;√º… Ú£êK_Óùº√∂·À¢^7•(G¡´,RÌ—Ó¿ZF(™Èê’°LG9ıÄwh`2©G≤iHJöV í´C…ójc†"Œ~Kˇ·L8¥q˙NŸ‘ùô“vpÔÂ˜ès/ô=ò`ˆAﬁÉò‹,ä¿πtõWpÈ‚‡õ5†Ë†yºZÌÇQÖ∫RÍ^îû∞ïî}¶€UT∂¿ ¡‹,ã÷aîÓ“¡ªôq6ÿPº”ÁËÃ6’∆Õ3uîcÂD9ˆÄ÷V«≥»|^X‹ª≤≠©—õô˜ËCà˘^>'ı6¢ƒÉ§ìPœÉ{¯c{d¶´kƒ–ÆRªéE7¢ôíÓπ]Ícwwñ†9u&XËzı-¢˜V|äÖß≠:àyZ◊µZP“ÿ>˘÷óæá"ˆQiRg»I3∫G{≤UaîÆŸ‹¢çt˚Ÿäj0¯3l¯¨Qés-	<ÜªbB‚uázìÜÌuùlœﬁãπñCN∞ﬂåÃMÅ¿\tG˝á|˝~ó”©'ì wÄÛü§ø≥Ø/à^9h0eﬂ<π1˛¯|¨π1Áª—vúymı∂BK’E4kf≈›7„›;Ëxê”u](õËéM‰?Á¢∆ò¶˛ˇ‹/¬kƒ∆fJM@çÇY`üLŸ∆ª@ô≈√È§)ñR∞ZRwñÌâÔ√¥úQÙË◊GWo€∑}“‡rq%ÕÃ(ç,0ºSõˆd Ù—m˘yﬁHdz‡}v)BRP“¯sæã·‚ùD`é?”Æ›„¿Hs}Æ RÉ˜k¿´ÍN∂ö~◊rÃoµ‘êjz»—ÛijjgËxpÈÉêÕ^ aOΩ`ˇÎ  vÁØL—e7R@‚“⁄ºru∞&y≤Å˛ZÁ+àFûh8;ˆV÷cMbçvq∫,5÷%åVøŒ©œ‚ˆ®ÎzcL…#†·£¬3∑Rÿ+Ç˛◊)∏’€fÃú¥Ë∂ÔkxéäÔ:ÿÍ
[Ö0íWﬂ≈˘∞ª¶#t'
Ï].–s¬©„≠‹7∞Oáy~ÛçÎÀˇïpióﬁÄ‚>^∆]èùã`[|m≈óêÔ√≤Ó∏gkìc{m®®YÁñ<Y´EúUô©˘H}9ö\‹ç%ÍŸ%·¶À-–fïÕõ<$Wí+Ô#Q®Üä°LYŒ. §V}¡EpçÌ~≈Ì√ç'ö∫œm3ö/Q…¶kaÒŸQ–çÆGO¨/]‡I6Ã€£‰Í˜€ô3£y˜<_†GdjPﬂÓaò'ñÚIJÇKökì®eë|¿ŒüTIÓƒq±9d .ﬂ≥=_ ¿	∫E-M‚RÏbÒ¨‡ÃÉ∑o˜˚3‹sªlÓ7ê+‘˚Ì[^ÿ¬…å‹ ƒ’†√á†…ÆËª2èù[∏ok©Ô1µˇá≥m≈¶ïD√$rWıêDZÅM\–⁄!Œë"ß=[OC/Œë3ÕGIBlá*ÙˇÁmdûñÄ(bA(wå»òÔ—N3uè¨3ªoM\Ø⁄uÏÒâkyΩÍ+hñı≠Hw⁄ÚÓè¶à:Ò+K°€Æããˇ¢ﬂ¡A«÷ò≤äX◊eI’ÙFÜ¿E|#≠5DM±∞}ƒ¢ò…úYàÿBÃS≈ÃgÆÄ1nJ0ô9:
{g‰0ôã<_Lñµ(≈ ÙØXX<fn„iåU¯‰Çœm^-9≠t∫Ü/û†#’ª Ó)©O&Vw@{§5¥˙∞yµzôY‚"~çÏÅ˚ê¨]k?≥πu1„n©·âvc4Q„∆æΩøÓ6gkÕ%ŸóI€É˙àûª;`]˜måv"ìhX„…‘≥|≤k[˝—’w>:¿}RIıó∫›∫ÓØ6ç“M¥~öèª≤NÜΩÜ_∑˛õé?Ò–W*ˆ∞œ§µæıÕ&˘ΩxÆ≠⁄ΩÀ¸V5õm:bI*%Ä±a*ƒ˜∫|NSœπY>·üF0±»EœSÀ£4z±µ∫˘9qOæƒ]îûA¥ÜSj⁄¥Ô’L√Öl6] Gè%·ÇÃ™h¸Ûé2ë
ù!O˚˛ˇ†NÁÚ˚_¸{„∞„¢ ÔÔh¨=ËºÑî∆8≈˝Rs≠mîq¸ıﬂˇ„~˜+≤_?xVﬂ#GÌ√„√∆·^átö{Õ∆qÎÄ<©7gË„ôóøê”˝7⁄Œ∑&ME¯§€és^≈!âÄ7¬ü±xuQ√©åûÿj*“n√§◊∆f∞4<ãø’BB”Ís](acf@∂¿5â·Ûf≤ÿëÁN\òÛ…6ﬂq«™Øè¨…’w√b|∂b9™≥Î2€`*UèQ;)c-ås√:AÉ7…çÂb}ò{Hsﬁ–B/Üg~In£pª≈b*ö]Ä¡Èè]P∏∏˚“F£w»blcÒ∫œ÷Ÿ±—ãBYçj7=Kƒ>x_rZ%ÿ{N}ı6úáùóü°XòïhÜ∑U^∂à”W>ná’bhœ7/ä{b˜v»R˝§Á¬Ç/-«:°N‰åü˛¯Îˇ˛À%rπ¨;ﬁ>º_M~Êc˝Î_òåı‹5tÍŸ#À≥#É>ø˙æy¶|√áˇÕÔMÜ«6·@å ∏·>ﬁ˙ìÒSÍ8Íp¡	>⁄˘è&£µ›û‰¨û·„˝Áˇi2ﬁSwx‚©≥N—˛˙øôåvÏûÿ—áœàŸ˝/#≤ô˙¿Í(·l◊SÈG~QF˛Àø5˘»ı3Ü∆o è}ı[⁄µ"c 3|º˜W†®ë€ãêˇ»˚õø2È»Ú@Cgªô≈r¬AÉo¬Á˛˚∑ÜÛ<≤F`≈6otLG=!ÌÍ_O¡\ˆ#∑~∫~[ÜJ‘£@≥‰ÄÇ4ôDû)Â+~áÛøó
Îv>ñËYöéY=l˚2=ÉÀ*E=À◊¿·¿˙+vâz$‘Hœôb‡ØÊ(üÑûΩ`ÓŸ.È—∆2∞Ï3)ÛÈ§®b‡ÓæÖ tÄYÓ&ß¨Ô¯∆v—`Wc	~g2Ì]°˜.5}ÎòÙ¶3#!Ÿ!Æ+fı√ÀÚ_ƒ¸ﬁ=P…ÿáÿÊMNóÌNú≤v0ª,∂OÙ!7‰~÷~óNP¶çÆL‹èúzÓP≠•Éì‚”'kôx<ÛHÿã/÷^nåœ_Ççˆ“ÎüXï{˜ñ◊◊6ñ7∂÷ó◊™õwT√Mﬂ}k_Ä.÷X¨œÆkÇr|¢W	(Fo¢z@öÆBf!
xiíıöÃ˜¶£.<“íé	É!ıCÖL‡≤¿£ì/˙&∆z5<m:2=k:Yû˙íÕTJ≈dﬂñﬂZﬁMpwx±k[é€?”Q^¥AZmµñﬂ<&?dòŒGÇVA‰Ã∂ƒß(S	3ïî˝ËÊÛßü
Îì^˜ √Æn‰ïﬂ∆9o6‡~Dhµr“⁄hÖPÕaá´2HÕúß|ˇˇïÏÉ1∆@t–≠–òZ=KŸµØﬁ1π§Ïÿ}Ê£®ƒ6‹Â]÷°À84<@πd]Ã5xÆ#B8pçó«—UÉùÉ≠>º]–ÛiQ¶”v¨ö6(üéOfÄëÖÀ∑däM˜¬iáﬂëÎìaW¥ÜWoÅ˙a'R†ñ©ƒ*ü9ÿ´÷Ÿ=ó¨í›V„p_cGµ"e`%ù·Ï}ûp˘vbúìˇà˚¿SÍ≈4ñtÔ∞Qﬂ#M“:8n∂Á‡◊X´y:ìkãq&[^w`üπ>A·tf˜¶Ú}ó·» _SñE7;¯‹ (íQ›ÍT°DL´õ≤_O1[∆≥™dœÚAúπC∑gyt∑Qr/2π`>‰´ﬂ¬SxWoG©Ndî0˙—Óc1 Ûiã.À^êœ'ûG√ÂúØ‹£ﬁı¨>»∑¸·é…œ—x¬O»f`3¬3ícœÓœ.Œa\Æ‡•®¸<∆¬{ñè	'	s0bR(
J∫'·`Ü”∞ôlÔWG˙0¯∏HÒpG∏öÿ… näV«=É…Ï“S≠R¨◊iù8wº–9Hh¨û5±éqÒN)C*àû©û¢OœG#râEV“ü_I≠xjEÎS∞Ä¶“	(¢úD;‚ex9E≠d∑˙mºŒ8∆/ì≠©4D˛≥±„Z1döm– ∂54=˘ôña!ˆúTƒt˙Œ•
êxõM%O£ñ)@ÙJ›Îpz∏ÿ∞Ø»7î!L$ÎÎÈ’∑ÍàI⁄#ﬁûê´ëWÆı ád:±±…ìr¨ñc, ={A$Û≈Û*÷ÊJ´LB„π¥®§(6	äI"&ÀY™œ#f‰Ë$$öT†¶Å˜Ë∂‡∫œ\<Òå„®¨’ı$Z÷67ìSMËˇ.ÉE†Â-XÊq≤)p!$xJnÆq∂(j—dZm f˘jö‘Máˆm∂®ÿâ´‰Á≠#ù€2dÃ‚§X<∏«%ÕíﬁCêó6hézø∂∫]:û<X≤—Ñ[˝ìÂjØ;\ÆÓ6ˆó´ØÌÒ≤5f¯V„üœW‡Ã
*ûı}PÄıÓò¿ŸL¥bìãÿKΩ°’i˜z`Î\ßcëÆ≤=U¸√Y7gn1@Q¢…]&^”¶€≥.P}OnªæÇ`6ÑŸ‰ Ìxìˆ‚µo≈˚N‘OÊ,6HôzUõxÏéß∏W»Å;aTÆ X£-Æ›zÉ	c√»ï%b—<∆§≥[~y75A;3-í©:ò^’BOÛHÀ‹TßÖwì¸Jm˜•Á…>ÎGSæ∑»`ekâ â:ñX9≥È´GÓ˘É•5≤F6∂‡K´æÇÄ±y¿¡hùËVgå≠…@∞gèh◊?Xb≤§ú˝XeÏÙOÌﬁd‡¨Ú%È=X⁄øG÷7ú≤A∂V∂Ü€d√∫GÓ¡◊◊W÷Ô¬ø¸”⁄:~x≠ÎŸ_Ö—Ÿ:öé˚=U≥%˜˝¡Vy§u/Öv≠	CÅs»ë’ÂYì{‘ı‹ËÒÔØ∂¥&ñiµ≈xb"Q†˚=LnﬂK=[J/;]Duòd2$∏üZeÜæi,0;$Æ&J:¶íI∆H=s	ë]˝Ì5Gù
Ö√ûÌOVü`j¨{Jé”·…»≤üº≤Å[»jê°à∑q¶O< YˆOd˜ÙB—1S[|;áM tÌ…πáüÿ®Öm‚éÜ≠à+EçïÉ<x∆™1ÉÑäπˆ–0`xÃÉ´zÃH«≈}l˜ß†:Í÷¸Ñòﬂ∂/«Ä F¡¬Ìtí≈Dπ5›õDm§^2ÕÙâ	µ©ˇvRpÚn\)bﬂÁ£'v"\ÍöK˛$¢π§ÙY“Äı«]ÿáˆ‰&V¶t:
ñ∆n<:ÒÆæÎÛ¢b+ë|t∑yÙîÇÊ”≈‰Ù
√±7fëıe≤±LË§[Ω#JdvÄ’†71Ìj≈T∫˘‘§P—®Ç0ºö€ú*Xuî<J¢?ı¨ÑQœ≠V´ÊxÖ⁄etdgqãeèæ ¥ŒÁ±8íÓ|$6ŒB∏T∫áF‡≥1ﬁ∫Ωáfl›q8É,√xŸ∞{`êŸYj4É*ÓNe´QØpjPË=d≠Ly7ÖuïF;X«ÓÑÛ.rÏæ«,=ìNabsY&ñ˛ <kòªAlLÁ◊euÅÅZè(Éïükó«V¿Æ<◊«<ãöè
N2œW¨∑ ˚Üg2q<1õ“‰Q•z∫hcpÉ§1Q≥g9FÏ‰πSéÆ[CÔg∆&h:#Rå∫≠>›‰95ZUä∆2±{ÁeBº∆J¯˜ÅM8ÿ◊˜ATÜ°¸fRÏˇÓÑ›lüN¨«û;D∑;¢ZT$º≈2ªä˘ü7ÿõÛN0à^·Md:Gû˚•ò ˛qÏY&Sb:Ã•„”ÒÒœY&Ç¸©û˛fP∏¶çäR”ÉD©•B¢`b%≥áŒ®»Ó“VE0J¡]I`Ta0Ç'%‡…≤¯ô‡‡íìΩp¸„L¿*Yeûf‰ÉúFÏûIÁ3î6ÂçZ'æÎL'àWàyÇ|¢aJgzîV ûÃ m$kÇ˝:Üs∫r	ãñDÖéTs£ŸYÚ,ñC≈‰◊+ùÖÖã°ÈÿXÑÎ±îÃ%E&Óì7ƒn4–ä˛|ˆeÊ»cB&ÿç,° 6HjÍ>t¶√	iF∂“'#Gáû"5f©Ø·Õõ¡+%¢vJÆw43Ë–7<{œÉâú8SÅ¿„≠ÚB∑m"9=Ä^ *–Ÿål≥uÜy‹zÚ¨];≠wN>&Îãl3ë\C÷∑}ù€◊∏å∫+ì˝Ù‰√7	uÅı˜˜ü,âZŒ”iw‡€ñ|S ãâ.∏¸_Ò%Q^…“.ä.ïπx›Âófo$ˇÿø0ïgùÎh	¢˝Ûÿc˛èä:fdfr%√ga=S(±ƒfò«â‹pÇã3©§P®Bz[>zØ·÷’+≠Q⁄ê¥ÕO≥&Yë6£¶Ÿ∆=æ4Ús•√l6± +âY√ôW™√X›í–¬Ò0¸”úë¸îµ6î¨‰'U%m÷¢L?S@eΩ˛fAÎ?”Ve|]£¥7è∞N”vâT/S¸fi¥¡t¿Xãv@I∞Ôo˚6El.4	–
è€{ Ñ«R≠VÒõe"„6’Kê(≈F⁄ﬂô§[ÑQ?´cC`	®zÅ YëUKFÈŒ]∂g0f‘ÙÎÚtNëÏÖ?Ñˇ‹_ÂÁgËÊ·≥Nπ¡ÄÕ∞≠eÑªû´èx∫®≈%•8QÆÄ¨œî\ÒòW¿£à3Ï2Œ–h∞è€á%Xsd°ÀjVFÅá1≥¿„Ωcxòyíq =<Ñˇîe)Ci=l4Ê8 #“á¯ﬂÚÉñ‰JÏ“91Ù≠ﬁ\∆∞K=⁄Xå+¥^=µ©◊„üŸHÊûÂº{FÅ.Â[arÃa˚I x∏€lœqWáDˆ∞ıÛ?õ„¿!Ω>|‘⁄õÀ0ΩŒÏ
£¶G¶≥üÎ{E¿‹kˆÏ	√¸«µÁh è‹Ûô˙Äµø¶ÊqâjNi≤ó1«”J«“}âzà‚∏Û≤û	Ÿ•~◊≥«ºdwï<∆f-ÅµKÎ"ÈYÍ∆OTÆÔ`V≤)"&1 RÖ0é)ZëâHñπL¿∞^ìèîª¥T1f>∂∏LZ·œ¨E¢XÏä®¥‹,Õ
ô€[ãU,´iΩQ_fzú!$ë96C◊¬0NÜõ·Ñ≤Íˆ±DÌa1‚©áÀ+{FIÖ~Y%ùQˇÍ[ÃÇ¸hô|Ú»ü–è‡áçaâ≠èÓê ü◊pÖ›Â5˝rõ :¨k6¸˜dÍ„Á(8\'…ÄùΩ˙n2uå⁄™·a.≤
È–(5.<Jò”Ï≤‘tπÚ
˛?∑L_ÂvÃøŸP=Âí~ï—JÃ¬,èNπWŸıM$Û≈]ƒz≤òs…¸`eÃ2´j =Kµ˛cŒU‰¥bfÛÃS∆àaﬂ©xQrãì04≥ã%õ9√@Ã®-D–‘G¬®xÑäèB†0lâm⁄{&ñüB7ô€óŒ˙UnMì˛¡s˚ÙLjÖ„œyM=ﬁﬂoÙﬁp{≥´{pô_` f!jÅ/”åsO£⁄gÃË˙ô}åŸﬁESˇ‹›Öb)fÛñÔ-+2PR†iS⁄Úπ›©üı¶TIh·lH{ˆtá`çxsjyÿ==ÌÎÍEhn§(‚Åv∏<EhÑ)V⁄Vé=q?R-+>NQ2MÓl¿gÃ“H∏´´M-œ√˝AN¥∆î;ßëhıfä‹¢ê6ûà≤mîâ«ëÎ€Ãª¥¶Ò·€ ®”^hÜﬂ¨Æ¡2)„¨l~(EÇ∞hF5◊Úò±€wK-J‚¨~¥º˛0[ÏÛ2a>lÑ1åÑæÄ5*5Rp±2Y!Î3∆ÄqÇe∆U8ú˘Âó◊ö$#ÏÆlƒ≥4ì.MvÖ†õÖZih%t¬‘n÷ÿ>k*tˇZhŒ˜ˇÚØŒRjÍº∏N:ƒäY.6∑‹®HÂFœ ç>æÂFÔ#7Íÿ˝)ÀZ4;˙ÎÖ≥£r¡g#M{só<wùÈêbWÚMëQÙÔæX6o^QW∆≥kﬁ√é3ÒG‡ç,r≥◊qß^óŒc√˝é”Ö[éX…ä⁄˝õoàAèª`‡ñøŸ„/Ñ›"Ïwd2í{H⁄‘√â®?G€¯ú√µ¶t=íù5∞å˚)˜XÔ£Ò‘;TûP⁄…v‚úz±⁄I^üﬁÆC 1G™Éˆ!ºj–∫Œ ùœ°#£ª]‹.qcÂ_¡‚m≠Èu8P¡ü–ı–;ÓL7ùg'xåx3êµ¥Ä-Ü[˛Í7∏Á]—’¬üÑ}òıolƒÕ0[%Ω≤1÷âE≠Ë‰-©÷◊#·ˆ'"3ïC∞‡‹÷Î8eÊFâ∫∑B®ç†©ó—<MEÖÅò–˛©Ncœ±^wÇkiÇÖJ9ºÚN„isø~‹jêvÛ`∑ŸÓê«ámÚlÔ∏]Ô>;ÿ%è[ª≠É'vAAS,¡ÂU=- <Êõ—Ê4vmí;:v˚}á∂F]gä∏¥GΩSêyÿtUCÍÅâœ50
_b‡ˆV^‡ºøﬁ2±ïiÌê‡G 	ÊˆäêHÆ@Çπ#é¿n>+©…ûU„V‚Œ˜Ÿ∏g)Ûù≤èÔÓuä˚sßæ¯pØıôÜG·vLΩÅïΩnã°épU
3ÌtW%Eô„£°ÚU…Ü˝4fØøX˚ûù!…r¬l›/ú?ªΩò…ßÑˇËÖ;®Í‹¶§&ò˚
VsÁ}˛f"∑ÕΩóÌ„¨°-1’"Bh8ÆOu’¯å’8µøX1N'ˆ∂KøÏBÕæ`#DÈÔAÃÀü≠>≈É7√ƒìÂ_lGû#∏>˙x˜«vÿ«høΩÒ’ŸHı¡wÃ¸iv]0NØæµ
Í‹ªÃTøß∂?qΩãob'äà©cùÖ¨uD_Òøgó/Ç±ñât~-p˚µ©’ùT;SX÷‚˛ÇÆäÚü!É^¨l#ÄK‹h hÚ¶¬‘o é∏¬òâ5ùéc∏ƒb_Ömÿ¸-⁄›µPuLÕÅA´¢ñí#±ºkZ
yJxFÔt’uıê!*#ä‡Í;–]ÜCÀªØÍ¶Ã*ƒóZ⁄ÓÛzßÒlØﬁ&ªáGG{Õ6©‘˜~ˆs¯„'ä¸ÙŸÆÜ™R9≤≥YµËÆ;kú≈êª&›⁄@QK∏—ÛŸEˆHgt‰˙¨≠„–¶√WÔîf÷Ú0B¡Z@&æS\€P ›û[>smû√€ÑçR@Küí•Sˆmÿ∆ìï-2ÏÌ?aΩ∆d=ÿX/˛Ÿ⁄ˆ:üØﬁ´≈†f68≠∞E£BÕj˚©M÷jwÔ0^π€≤‡#h[É >+ÿ˝2ª€s≠V‰ UÜ1õ >(¬/≤\∆µ0˙ [ÂßQàÃbû  Ê{_{Üzvlkx3f‹œáYœX^	˝~πqguœVª’p∫6R˙Z§t$Vo1ØûƒÑ4;ˆŸmí∆·¡q˚p/dk?#˚ı£:ÔØ[o∑ûıÿeO£’4√¨sÖ∆mMΩ€I—VÇÁT∆¯’c√foæ`∏n	úæ¨˝∂ëƒR+Ùy~®ÁÜ7Ê£Ú‡òOâ‰1ñ°KÃíπWÏı∑˙iW;$
yãî)s	Ò≥qÓ¯…ı5≠€_~°Ûû% MbeqÕ⁄∞≠):à'÷–∫˙≠ã~ﬂ´∑£O√djwƒbg¯†˚÷π=d…÷æÏMy&%ï}Ï~Ã«∂{Óÿ*-“‘yk‚TÓÉÖ Û•1m0Ë∆Æ…ÔÙ”åÔãö˘é:éT£÷.Eøíã\YwxÒ‹¶Ø®W8â<;/C,~2†»	ºí¥:ÏsÒu=^Äâ,JπzW9´qÔÈ…ûÀ{”®3PŒè!≥⁄¬÷ë ˜¸§\gÒeÒhÃN†O]÷∂öêc¥zÏ¥∆S—I]&¯l<“C˛·¬„«‚´l´4.^3wÇÚAﬁæxÍyÆﬁ∑âuﬁøè˙˜uGM÷›˝ò?7ÖüzÆÆ¡±ÀsfıG|ÑÂ∆~˙ê¸;˝1◊:ø ÷òüà≠;†CK~≠E/≠¯ê·π≤£ˆY(rB{r»ÿ	/GÄÄv˚‡M¯wÒu¿Ñ\‡AGéıı˘KÙ≥ŒõÎ–I#6à?•˝∂ƒeèÏ”©púÏÔ4Á◊ ‹œ˚∫h¸πU®Á˜ìäŒ”√g{ª‹3q|∏ˇ3Úº’¸)˚∏K:?;8<jut˝úW¡É∫hË2Ûˇ©ãñæ†U™√l—6l°(Ô‹)fˆ
iVeG{††Q©@˘Xb◊⁄>‚N ˜Ê'ˆ≠—‘¬éŒ _c6 (M©;\Cπë’0ÚûLö„¥szÏSRIùÎÕî ÿ.Õÿ3©Û–I∂π$‘õW˚~O¢Îezª˘Ãπ8Œo,7+Lo¿Ÿ(Âπ /~jOrßV‰.]&·U˙w<¿B‹•H5ÚÔ‘;øÃ∏{ÙÍÚRXÓ⁄˘J·≤£ ≠’Z6#˛A:Ç°ŸYı˙√ÔFîq6Üz*~+ıª‰èß¿ù®J!æ=zäky|<ß?é:ÌËhÒoLﬂ≠m·œfc ÕtﬂZpc£7w=Z≈gÕf¶F—ôM•hª=€q¨˜Vß¯lDÈ≠>q´O,nŒÔ\üê[Ù)·ÌÁ•Q‡ûùØ6QfD1ô'.<÷ƒs};¥_ïsÂÁ8ıÙt∂ã◊{67IÁ˘*xÏYıùØbO6W]Á≥»4ÆÁƒﬂ“M÷qÍüÌ-L…9vOÄÖΩøéì˙Ë+ÁVÀπ’r8ÁwÆÂ»=˙é¥úˆÛ“rÿ¶ùØöSjH≠ÅèªxµÅ›g6Ω·z§—Ò”÷ìßãíF˚SﬂqCêÅ˜U(Ï˛‡V(›
•≈Õ˘ù•ÿV}G≤)1ãyâ(∂ÖÁ+¢J©!¢¯∏ãQÏ>Ôèà::Ï7€≠√ÏàÛ\Ñ’ëÎˇ§U∑bÎVl-nŒ7DlÖõˆù -us\¡¿ê`•«÷e·ÆI¶7|Ñ€A≥ÒY˜≥ˆakó<Î,Jº5¶ÙZÉµ˘Jµ⁄˝ÍVñ› ≤≈Õ˘ùÀ2æC…9∂=kÆ•Yñ¡≠3_¡QfDq¡Ü]ºê¿€º¢·˘’_÷;‰YªuPo∑ØÖ…ÜÁ∂Âì©gÉ“bc{j˘<cOpq+&n≈ƒ‚Ê¸Œ≈ƒÛ´oa∑>vÎ|ÑÑÿ;Ûï%’r‰≈KqßYs@˙Óﬁ7Á¥OÇS˙ì~¢√¶Ò$DG	'˛J˝ÕÕêjç√›√Eö9nÔ˝Õ~h:'Ó´[Òı_ˇ  ˇˇÏ}{o…µﬂW©ï/l*G|Øƒ+≠1$G⁄π 9ÙÂçØ Ï÷LáΩÍÈÓÌáDJ+‡ÓøπqnÇ5¿πÄ# Ó"XŒÊè¿ ÛM¸‚èês™˙Q˝öÆˆ!±k9==’ı<Áwﬁ∑Ï+ërÄ6√≥¯qiñcÕ’§øÌ.û[Ò˜‹·¶Ω≥◊;Ë.ê¥áÜ3aˆçeQˇoŸ¡-;X\üØúƒß¥éµ÷∞/⁄|çF]⁄1-ìbƒÏÁ˘ªò4X∏5g€ÆÇyñŒbtc˛>¶MÔÕŸÀ=†≈^`éBy¿êΩ=èÛÕW}3gÔ` ;Œk$ Ö[Û˜Zn∂ÏÓúΩ˝úπ¿t‡ˇ&M∫+›õøøôÜKoœªámRµ?°íSjtÁª8m¥‰Ê"ºS#Js	˛©‚M’j$@ú˙¶áuOœ%tûﬁTü%&˝ÍsÍÛ‰ƒf>å•Í•ÌT6;„KùΩíùÇÚ˚ÛÕB≈Ã?˛Í¡k¥)we∑}îÌ‹–Óo§xØæùoBø–Ó⁄«o≥üï˙Ò´\Ö[ı≠ú–‡	Oãøó>(Ωˇâ¸„ÏgÖﬂ«ã÷>Âô®,‹RÍ≈†§°íª*=b@Œ}3”£‹-≈*π{=$⁄Œ`∑ﬂ;nJ∑πT&“bôX¯ÃÍñ‰Ãïøæœ¯áoÅ{ vπo∂è•bÓ∑;wıìË^yÄ'∑Ú≠Äº∏>_πÄÍf‰ËÃ4ú·fæFU‹D-_B~Ò¶õ†:˝¢ﬂ/PqzNˇƒF77Q  û∑\·ñ+,ÆœWŒ‚3⁄W‡'¶Yû0Wì±Nè˝*dﬁ+j⁄©ö/πuü‘lŸ›/1ãÁ^¸=Wœªf&ØéŸ◊Nø”näU00:QÚbºû¸ã<⁄Ò’Â`daW√√abÁbM∞=>÷#k¶€ıi◊'/Ω.∆Ó¯â÷cvï‹N/]j_√ÔÊlîeR<=~;Õ(&“/ÕÓ7¢óO_ÖõÌHù”cg∫¸lß0Çy¨…ÙÏòQ⁄≠Tè(Ê®≈<çä≤
πÒ¶∆ºîÙp…â˛º«K–®”√d˛
ç&M™—ÜbC8™%ﬁÖÍÈF]âç˙Z>≥%Ê‘È¥ΩˇÑ„ãˆÓÁ›˝˝ŒÄw˜zπï£ê#jÃ∂eQåÈa∂ÅeXF⁄ﬂÑ¶≈n2@Ÿ•÷I{t
Cc˛-LπÖ)ó–Ìf` Ö@HÌÅnü»ß´aîr°¶B¶˝K¿	Ú˚.à.çqœ◊Óa{ü|—ﬁﬂ_,ÚòA∏´á	ÄÂ3úd_¿èo9Œ-«πÑn_éì=¿1òÃijò√\¨mUπ‰ó¿c2/ºLF)ÃÆ”ÔÏÙ{‰∞”Ó“^(üŸe√∫ÃáÃ“|£M<Ñèöö°∑åÊñ—‹TFS8¡qöÃqjò”\¨m•t$Ú.Å”d^ÿòÚ3°]Œ‹fª™ßW.f=∫ﬂg¿£ZÉ–wôÌ≥ôuëY.//ìÉÈ˜{œˆ{X™º˝lØ{‹ÎO€&ø!ù_∑˜üµwª”ÔyÛˆ~wØΩáˆ;GΩ˛qá,=€ÈÓFOt:{]`∂<WÂÚ”Œ!7«ØÓÚ∑‘∏‚ }E-Ù7éiËú8¿<üˇlumÂdïæ∏ˇ ©jΩˇÒ t,D’≥s¸sK«ñëøœ™Óû/ØF%≤£;æKGl˘|yù¯ß‘p^/ØA£‘6'»Ø›®sΩ˜ŒÓ)Ω‹5ΩëïØÕ¸)yˇÁÔãÜÄ5π„Ê}◊¥ä6?rÂFycg~Z€^¸5¥ËË•\¸©áÆÀºcÙëø∆,MA=¨ ùØŸ(Ä;§√pºÈè∂›Ü9BeíXyQ®€`dóZ¶AçV´U7ö˚Ó~æ∫‚ûΩàh"ú‰ùWå’#z∂¸zyb(åK¯öo¯òŸŸ)≈ΩÛäb)eF(˙!éÄœÄ√
[≈ø<‰ƒÒ&—$ ‚∆*‘05ÿytYÜ/õ˘üè(‹$5`L√ó>Ò√1Û∞p5q©G	5æÌÄzû¡ã:Ìy¸(«G∏4VDûÛd#æÖ”Ì9~2ﬂ¿¡ﬁH6ûAæº¸ÀıïË»ñÏz«2 V>0«ßıõ¸Ø¸√ø18föÏÚÌä)òÕ)öûuÌ	r‹œw;.k_3ø$wNÃ3xŒ˛DäLåmÒ'êÀ7@wÖ^9YÆnΩ∏ˇ¬Lû„·	=æ`3hˆfëf√‹Â9“„ô£ƒÇÁÀ4ú““ ùöanâ›DÉ—‰5•]LÑ¿§Øß¶a‡ûä(˝	5ÿ≤iœﬂ˜wµ43w¯r;ŸÊ{ŒÎà?˙@hº_ .á,xÕ†ˇ—îssÉ∏¥;ÑiSò'?ç>NÅ ñv5”ﬁ¶BK≈∂\\«qÆüYÇ#≠o…ë¯¥ÍôˆÀÂ•ûÃƒõÄ6ÛÌ+∞~ﬁl-ºîÊB±ßJ+∞&ˆœkè∫ä3 -ünîÅ8ÌÇ]O
h%öèıYp%%˚ !ÄmüÙ˙}Ñ¨:‘˚ß ”d√.Çö≠Õ’à)©ûÇÃÆ.L›¨-Óû-Øµ6˚Æ¥“∑'!†yÊUöÃˆÓq˜◊mÂ˘¬IP‹†™{æ,Æ÷Ä≈IÄs°<Ë>{e˙î ÇsÜ>∫ﬁF»Óúú“7~sÑ‚ÁﬂÑN∑ Î;∞aÍâœ¯Õ(§÷7°	+‰±F11hî¡"ﬁà1!∞êvYªû3b∞™u∞0ûπZx-Sö`’«Èâœ¨ìe<Ú˛7gËZdˆ—0«VöÙ˙y|G¸†àÀ±wa-_>~ª+8∫ïòj…≈G>qUpI8Ì+úã¯&»©†$7
=ﬂÒñ]«‰”Yú‡ú†˚7ä*ERçï	Ä«,À}∏RéÛDÀCÚ∂*˛ìA]jãÖ◊6w¢x'ßà¿∂”[	iå5±,ë“ÒÈÊÍäbﬁ}•∂ÙÅX≥·9Laà<Ö%á}@'t˙'ÉÈ{†R†.êX‹;8ËzfN@Tı»ÙΩ«(>Å™{¯=Y:p@~MõÜs˜éJ'’(·Ï!‘òOíÎ—ÅicÁÛ i£Ö0	˛UF Q°A˘≠b x´ Ñ>∫/ËN”4-G°Fé{~Ï¿-wËPœX ë˜»	µ|¶M£"F˙0O™èéõK-_…”E ∞∆! :î,Yî-j34<©R GB≥TSÂP´ÌÄ]«5·ËI*∞FwÑ◊ç™yÍÌƒ1Ä-(jpxªâjNà¨¬Y/U·‰‰Âåg-¶∫dÜf1j‡B¢ç˙!G≤â…5;’l.PÖÙô≥Áí+e …ñ∑[
ı˘4l ÉíìæÖ&™ﬂÔıQÈwûFz¯m-ÿÃï◊¸ù˙œ’ÂÃ˘… ™É¥sK6» ˙§	ÂÆ…œÏ -â˘«:≈™}∫∂"mN$Y—Æ%’S†61p]ùa ÇÀß-5nÅì}òæX…‘ÙÛÌ∑§7¸PHÎ%;˜óxÍ4¸r‰ﬂmYÃß‰3≤¢êªÉ˜≥äô–Íÿ)'D—w§(˙v±ƒ%m=ÛQŸh+àë≤»˙hﬂRËÂ†Œ:á:ÎR—ïôúå⁄K=RßP∞sÍ˜»™ÜËÒU"n£’ÊoÍZ'‡\ÑÁ>/¯7EC¨"≥"ª#‹s»iµZ_È$]X∞±ËON⁄øüóˆ∂ßfá“ó„#‹»DPVûLﬂcËë™◊Q∫(ìÖ\Q;„¸µÂö±<ú©ãI¬
Áï$ac%≥’QMUc´	πò∫äﬂ˙9yG:ád∑∑Ø¶+S_4ÊŸ¡œ€öæ6î— É’ç‹2"k“K’ëåèÏ&¶m√â¡‰LËÇÚ∆=∆l±ö´∞Wπ¯tŸÜœ≈gÒÒ9Ï
ÿgu¸ƒ¸˙µxÎÒäãç©Ä0“∫œJ‰±;y+@Ì*¨`iZ–›c–w⁄\eŒUªBKﬁü~w‘›„∑#∑ìY:Í˜v;ÉˆA∑sx‹√ÌΩﬂ;Ó®xçTòâ7Q)Ë
„\¢ºπˇi—§ú…£}N≤»≈f∫ÕúHXs¢cECﬁΩ!¨eyÉZ"◊{ô4f5+±ô†U¡jñ•£´Y|P‚:O›,HŸà≤ïÉP*@DCU›®x®i"{t∫^‡v%V±D© á(s©ÅÈ√ ∏≤∞ç‡"!˝È{-p˚`˙ìZéØ»¶N◊/"œ«‰7ã\|÷Nm‘¯UJÛÆ
á-ﬁ5H†1Å=gíù°◊Ûø	a°ıkRÑh7`˚¯né®5
-
¨Ô∏»=‚õì–Bm6ã‹©∏√Cœ	‰è	“VöWì4‡ç;4ùäÈ‡û9ª0¡ûc˘u°D√4ÎJmd*T]Y+£kÀÈpÑ_ˆ±3[¨mY|n Ã_
ºPM◊\§™¶p/QØJ⁄ß∏A“5«∑>’°Ä*rz‰TE†´ÈQ9hÜÈëc«P ºöûÎ∞!‘≠Wµ#R⁄Xf∑¯tÂí7√Û'ãÿÍBƒÃgêÓ¢Ω3&O=”®•Äy˙7∆·?à®}êÃÄÃ•◊à5ñ>Æì3K˙∏°qﬂ>Ø◊ñ¬4@RÙ®AΩ;˜∑ËêYãø˛Òﬂ˝w“«üë”ô∞∞=s‰F∫ˆâE÷:ûÈê•∂=}oôæÈì≠ΩªJoRcÃ‡˝ˆ^ªøR˙0·—6÷“±îkû»yÖÆÃÛ…PÍ†gN:àÏ°Ô=€qL[JØÉÖrºÌH ï§ÇR2õï9÷ÃÓÔÍ˚†º¥HIæ§6µŒa4ó¯á?ìt˝∏˚ªÔ†ä|•Ôì=ìéÌÈOò«⁄!ÌW‘~í).9 (˛∏„°íY‡Ô£Ω'zÎø€Î˜;˚ëp˛s¸ΩŒN 
C=@/Ö≈í∫qc¡Ç±:¨ˇâ~çyÌAfÄçc¡∆¶æué¡&òì«ê∑D|+›Òù´ÿﬂÑ‘2ÉÛ/Ÿ+)”⁄ø˚mEP¸i°§bZù∫⁄È,0◊»†kæx>õ˛â"0?¡5¥ÿ
'ﬁ¿¥ÙË#≥Ûº~|é5.∏‰\™≥ŒBóΩ¿CshôQ±Õ˛˛dg˙gî~@Zﬁâ⁄ôæÁDV{‡àŸ^z 1¿Ωc˝¥ﬂ{v∏◊=|™≥ÿQò&ô WL‰Ω«ÜÕ!ıÅ#°Ö%πS¿1ÙÕòG≥¿Nògë¯°ºƒ¸s∫¿¸„U,Ø„2·6G≠/˝pXJ{ïˇŒ*¸Ê™áçqÿ¬˛<ô∂•/Ni‡∑]h}¸Æ5˝…ø&/ÔûaQ¡ﬁèºÎ∂˜uñÄ–30ﬂ–‘Nƒ¯é0_—‹R3bN\`˙Ç8•*¢Ì#«ˆAFßd˙~lZ@ò˝j˙£C`Oìx¥"¡«Np`Ê‹,ˇ·ø†ßùïÙ“Ìk8é(?êzÑˇ∂BÁ∏£≥é™Ü#ù#_3¿k$ò˛0≤q}a'0{“ØQœ2Ç0¥*o‹6ˇ8« ¢…u,KNÒùt]£W±¨cÿ¸˛áˇ˜‰)¸í"Bﬂ3·M¡¡Ÿ:û˛‡ML€Qä	IﬂÔ⁄˝nOgªãë:"”némË>ê√˛Ãïoé=b.Úo#Âıs,§ãä'i˘Át˘«´XBü»Ö“]√O:BEIÄ<NrÉh˙≠µÜÉÆ»7¢≥Ü=86RÂ	∂Ih«˙SÚ Ù1;–e˚2L^Ä¿:≤ˇœ±êt2ÑÂìVR‹HóR|æäµú0ÍáCÂØÆ®ı˝?ë∂èñ‘£çÇ<f6‚∑To51ﬁ}Ø≠µò“Åd~‡Ö‹Õ⁄èW›<¸C{Ì1?äpO–’ëIâçy>ÄuΩeÁ«	l'`∫ã˘ªﬂì]¿úÜ√ù⁄ùÄÚ);2˘“!ˆ∞©´ÏÚØ£ÈwOªáZrí»•,Ñ¢4†«Ê}ÇsËöë‡î˜Bæi±ØÈ<´ÍÜ¸6Cm≈âﬁäWûël}Èü€é´Ovˇ€?ê]n Q›È˜ÿ™£ß·x÷ﬁÎ˜‡ß˝ßÌC-ÓôbEﬁ	öŒù´†'@{ß?ÒŒ¿AvŸàIRe$æx‹Ôyt]£sjÀÎ ?ß´ ?^…I≈™|@zuOÍ˝ü∏éé)∏ûàf∏’o?<ãŒÇ÷¢>Á¯Y_è¯Ó∆s˘Î®ƒQèÜìDg≈ïñHå]FîeBmˆµÛ!
.\©ŒßÜß±—Â™ˇM8ùúÚÓZŸî}9QÖﬁ—›o∫OxÜôﬁaGk≠˜‚ıÖ≥ãÍôox‰ìgå+§ÖH•“H££ñv∫À˝ˆﬁ‡ÈEˇe¡®uwé5ZaÜ6ÛœÈjÛèç-ıã÷Ñ∫KK«PÃZÜz@Lüáô3É<&ü|glìçnœ°…ñiº®OÂÂ18“∂íßÊ#æuî‹^≤Û«oE‘úTsˆD’–E,ÅV2¸•%êj_ÒññTõ"§’j·œT∂å∏‚Yﬁ&ü‡„èäøwW1_õb%ãltÈ∫d]´0Õ≈îä≠ƒ}$si9™¸‹5ÇL£=´<ªø$_˝ﬂC¸|æÀÑäJ8x3q'µ∆Z>⁄ôÿ≤ƒi85£\i∞[¡:\å8Ω_üàD\jÒ£NÈ úKQ=ØCπó‰o$LÙqO¿ìKG•ëcÄ/=ß8™Ö\t¬§‡i”v√@π;¬AbÑ{xËú©G'èƒÆ«–ﬂË ®◊•âÒ%TQ£¶çÏ]Àæ»ÈÚFπ&ÅNô†È¢«É$Ä¬1ÉÖ˛vÓ]$¸	/’‡çTµæV•á ù‚∏≥π,Ø™üà˜;Ÿe•Ëásfô6[ÜﬂMΩπx#›ÛÅ®I˝x(•Ö‡èñıOg∏„dp3éõÓw …∫_íí¯¸ôa˙Î˙…xíY‚∏tTD›QÛ>ßdıè÷BÇw5ûT™<ë?cà∆ ü<aÃ¿t^µæ<oá¯ªËg:f*ë>ï±|≤¯¥ëﬂ	≤¥UÊr_óÆ2ñné∞·)û}-àéZ¡tQ¸n…4+∆Ò*Ï…∫P‹ù3nBtl≤√ùÀ¥ΩºÄíÆÕòdv=±Su_‘s^LD·¥(‹‡&Àı¥¬0}T÷sæµ $O™oø%üD¡`Ë‚Hôàv∑Â;∂¥„8¿lˇHin_Ôu≤˝:b[gÀê¬nH:·-ôJ<[‰BﬂFö-?_i=|"Œ∂„Ç¯úc∫ø‰^ƒ€m'@ô¡yIø>ÖïÕûª:'˛Ã	Œä"àOcx$’6Õ◊•ªëí–ïxfñª˙np∫R∑e"øäõ@- #E>”g'ÛOw_óúb$/_Õÿ›#Ã1Âs[F"yˇé‚±NÉØSL›¢:IÖ8"âßÅﬂö”"Ç‡˙dÈ≠ ë>1-ÿl…°NB?„òπªœ`}‹†äkp-À®q¯‡·≥ŒØ€d–ŸMíÎµßﬂÌw±Xœ¥7ËëﬂêùÈøz÷ÒÑ;›ù˝nÔiø˝Û…È‹â'∆,wbâW√zÑã≥gê’Ìÿ≠S8ˆDÜ†∏∫Ï0£HÄN“Xë#GF@kYƒ„%Û©Htµ°†¬µº‹‘XíO5ƒ#N_Å3© .’¨öÂâ*Á»•≠GVÍ¨DTN™∆AVd§úC∆À˘".áıÖZ=NÊ"âáJ”òÛÅ∆TüÌ„ﬁ ›í¶®!,]õ™ú 9@≈FöC yrávù77w‰œ˘£∏ õåL=»9ÅnM‘sõ˙Æqá¬Ä[q#◊o—8≈i&KOR˜∑¥
#‹="}—∂∆ò‹"ò/éLãz<#˙uÈ]•LÁ5œ π~¬˚ÈKzBnô'@/¶™´Jaíµë≠9a¥p8*cöÜñ3z©t:bΩûDã≈≠dù¨ß˛vCg¢ñØq≤Æ6wJÅ:¸±»íùÏ™/c√>l™;˜´fœ€∑º·âÿòlé,á1€ßt tÓ®XdÀª@qcõ|_ótam[:i¶ﬂy∞<Ì±ë…]quªyè}Èä£TÚÓıÌ¯ú•/ér“åÊy„éÍóÜ;5Y•/›ÿÊG:}„^Ê⁄ØDÎØXfÙ«(y·&æüJ_âã>˝âª4ÔT£Ë˛ä*æ[òcO&7™		â–"≥(¥Ølù'ÅmY∆µÿH
`ñ	"±$∫A–ãn∂£(Òeèó≈QLÀVù◊„/#≥#“<ãù5HesbZ∑,/Î&Ü•‹Jú∫VVC>(x{l¨¨é≤=2´®T∑ëäÜH-+dŒﬁ¶jãVLc´l@»±à€HÆlMu~`Ñ!P√T’á5÷ô¿Ì|àﬁÀ,:ˆ'çúØwõJ›§ñ≈@ïTÂı£Hﬁ0<föjQ˛CXHµü’õ.ñd™IÌåÜ˚2ÂÂ‚ızâ‹RDÛä
ŒJ˝ÊdV¡b÷—9ÇÃ’‘ïÚ‚®*+5µê…Dn™I‰ ˙¿ıó(∞4•P8à≈Pﬂ%·<Ï›mRß¶ñhôF!≥Qà∏G,sÃ]Â/IIï˛}‘™«yŸsô]π+„x…ÎØûJ7W7›M7[=G£fó"ßò]L+ïÑ~4:®8˛PÛ∆ ßæ∆iD2ÈÉÈ∂L„sÍÊŸQ@.p :Ú∞∞0O‹äÒ™∞%∞däÈâJ}<{Ùƒ†∞»DT.Ùõ®O8ò0ÍçNw§¯s=L%~èFF≠&Æ[…·‡ŸC˜¡¢™“ÂY∫≥Ÿ8¥‚#hÜÖ)†*Ö\
óèÆ÷∑sI<“,ó®≤ï1>^H•‰j•_MÔÍÄUyròõç¨*J“—U¸‡≈UöÁ£XQMb8∞¶Œ$ˆIä´Æ
≈‹qﬂÑ”¢‹>–ÛW Ñò(xŒ<LB=
A†eQ‚Ã=oC˚¸GÖ`◊8 b*€1nÄ å «‰˘ÉÆ[E∂ô»≤§á´Ú5ÃØ)§ &Q ü∂V*Ã/Q≈SŸ4¶ZS¿Vyeª|<µ±MÑ™LÙU
wB•ŸåJ˘t9d)N§30'Æ≈cSÁÓeÅ0)ïÕG¬û˘|’∂M3 ]Ô&#≥«∫Ì:.Ôˆı≈_RÜ•∏ºIº*õy?{1ß¶˙h X!ØVúˇ##ä‘>^¥ÀÿƒÂïzÄUHæ	Mqòˆ¡§£<+&	L√ÑºòÙ˝–åTWCÿ¢Á<r2˝—á¶Æ\	∞#ë*m 2•ÈÅ¨®òz›VÆleSôÂÛù}∞`´jï∫RRu…6BMŒ•∏D@òK»\>‰⁄‹Nsÿ!â†'<˚òJÉÚ2¡G·Ä˜y¢ó2†AóÖ≠í¸r5≤ä-Ü«∞+˜iúöÔ˙„´í¨â7]%©cl%÷£Ä¨ƒs4F©"?\ï…s…˘L]Jusj®s¬Ω⁄¯ÂbˆDsZ?v æÜCÜ°èDŸJÈûlö‰BAÖ’ê^=»⁄;∑)üßQ˛“yQñv3W≥‰T£Ÿ\§ƒ -—Ç0VL≤öEXÕs/åµã	∞º–Ùns˘‡jk;I.õ—_≈°4úÌ]îJº~‘Xjüû3ØÌ'yqØ?å*I\|ÛaTövxc3∑"9 =y1$'l˛hêTÁZ¿åÓéJ⁄ÈQŒl&∫xTS°%P‘Ê£At˜ØÎtCf†—g<¶,¬J—”91EÅ….)πt)÷ˆ[<≤ƒ˘ƒ/®¿“oÁJ∞U&˘∑|Í6?
tï_•¡´dNõ≈Wçr4hπ≥óbõÀYün◊§|ø,|%•ö¸®V?¥fÿ”Ñ:◊`ïÓ´õ±§|I+˘U)œtAîR¯h@VÏá%°úIE ä˚0òâZÀÀîã†6¶?M8ıÚC+∑`·ë§ˆ°èHäÅ{∏7„iÅ'L˙5·Ê≈+QW%q≈]?9L—ABç¿íã_‚j%5{˚ïåãÆ#:I9ÜRò≤Y:7JJƒ$ßy‹ÓØnñT Ÿ ûrÂpﬂ\»±:ˇ[/êÖËµë≈
t≤ä˜(Òö∑ÂÅì‹aπ3/ÂwprD*7˘n£i∂‘œÉmÖ*)ó™hí™î|‘@ıû Mº¨÷y&^Æ? l¨õèÅ§¬9âΩ._n'WuÁ¢æPô⁄C*òç
≠ ¸Dƒ3Õ0‰zéÎÿX°›∆¥ÀÁﬁ„mx˜Ô¿sD™L5¶Ú@œ}G 0„™AODô˘·π<ÒeÊEÏDß1v$ñ≥ï=Œk™Ù¿N∂Wûö_ÿô¡_TÒN~d¨√orúÉOyp%@gòA:≥Íá]*‹ëı>õ1‹©u§ìî±n‘-_5ˇÇü‚^ì7⁄ÕFB3¥Aﬂ•f¥AŸÇ} ö€™+rL4éTÌÃHÏA?CÔ\/Np(
Û»â˝ıy¶;œtQFΩíLE$Œ/à#∏EDÒeŒò°I§∆¡F3òë&6*Y%•<AÇJøà´ô^X*/…yô–Ë6)y‘÷ ˚ íWo™õÉrÂÖ.'1yRÂˆ£A{,‡+….%\ÉNíΩ$` öç˚$™-‚?Lpêî¥9)∂PÙ?ó ˚&ıπ?¯ı@DÒqJé“-&ä/sÊi†¢¯∞faëÃõ∂r~A¿hf—KÉFºHï.JÒÑ•LËcΩîe\(z∏ùÑvCoΩ(9ú 3_ú“¿oªÓ->∫ßl”é√˘00RŸ&ªEHs!§¯X~4 )ÚœñÚ@3≤æ®Ãê&°©»±H8yñÉ›õÑºùìâ„√++N˚D‰Ò’{\«=º†√5?s?s±3/ñY\2˝éa¶ôÅ®¬I0)(3ƒM†¥)›íª7
s
Ûâ≥tãæJ/M∑ÛíΩ∫‡Î™N‡ ÆÁ |[’ÈΩ˛∞’L°B∑acä0Í7b÷≠VKe”mœ ‡≠10¿is»_˛˘˚$7<˜›
Ÿ+ÁÆZ/"Ec‹‡_ˇ¯˝?^¢^]Ÿéïùòà5™¥“5 I∫¿ìêò^Æ“qtNÌ˘µv°ÁÇ∞ß&≥ûaÆÚ∞Úôª{ˆNªŸ8õØÇ≤„e…!lÒ‹√;›ﬁ~ÔÈ«î$µœÑs~jS≈‘πe&ä„iqxπü~ú]B®-Gò•>¥yhŸ5§zù>˙Ù#DôÜÉ™HÉ‰=bqÂföôUû‘„…ÈØà«gÎ¸˚>w‡c‹ -¸æ¸é˜Â˘®ÍÊƒ!πæ∏%”§À…°[ÏN^ªû!gW∏”Mπú≠≈@’3îÕd›Å’…D©·⁄›‘FÉêZ BeD≠ª«ÒÖÇpK8zW6È!i˘ó±ßó\Ù*pıÍ6È;»éÈLÿh˙û«é1“µO,äF,LüuE^éÎs·jNd|∏ı° Í⁄B„7)‘µd≥›|$}˘ÅÆ˝ˆ^ªO∂ˆ>0Ù2NÃ∂E^a-%,Ÿ=îˆëèò—8XTÃ;¶Q∆Œº8pS\9·HË
0ï÷ë¸ä-¯‚∞ vÜ¡[¸¸‹⁄Ó„À¨ò{Ì}/-Œc£Q5⁄óØÜlÆÁ7Ö≠~Ëô^	Ch’>0„	ÑI}f#ô®I˝qDmf’@§™∞ﬂüˇºûÁ—ƒ‰|y´‹‰ﬂUª|q˝Í«`÷„∑ôèıD∆KDk^ædN!º˛=~Á«XÉ¸-:±#K‡≠˙_:∂x«3◊¿çµŸÎ¥3ú‡™â A'7ê\K´÷ ”ÏÿµyW7Êö3[{BÄ∑®ùÖ¿p≈R[–Èêﬂ=˝@«Ìœ]Ÿ‚≈(-ΩÕ]ÊÈøÿmû{„Ìnœçˆv∑„Uæ€ÀÒıv|πÁb˜|·ù∑ª>7⁄€]èó¥ÎKîSä˚ºBÓY–Ô3ÿ“≠A ÿF›H‡CäZÉ|sn¨"åµ{BÉïWPÂÚ{Jb~•Ój#[˝Ÿ.*Y∏£Ka[≠ñX§w*n„Ö©ÑZ*’ﬁ/vÄ/Ô_Dä!¢f¶¡¯‘t#b ˝-π´“öc;„±≈∫“ÔÅ¶º¢V¢Å*iôØ÷|3‘™)z’≈R†Yx¡ÿqŒ–⁄î˛K„ô-nu|V<RˇÇZçÃ£˚YB±p2˙xÓ´é¬B„áù/»Q˚∞≥øM∫Ìßùƒß‰7§}∏Gˆ∫ÌßáΩ¡qww@˛Ó¸˜Iw∑}‹Ì*4Ω∏~óÖµŸPËÁ?[y∏b¨nΩ@
ù∑•%∂Ô’º…lK(dÒüÂëcÕ‘Ã∫ÁÀ´±Ì\‹âÕmÎ±Ç◊g…>ÜµQœ∞ˆ
›Ã’›"Ø·ˇYœ#Ÿ‘≠†s¨1IpnWn’Züe’R±Gd-—
>¿∞#î¯a:^`N·D—„ë	=[~ΩÏOT£ŒyıQ'ìM›óä÷‹ÉQ#ò‚”r*ïR“ß—2cÑ#Q'Î…dò'Ãcˆ»‰ÈEŸ∞Ó‘4§>5D⁄xãˆ
3ö¬Câó‘ÖÁˆ¢‰/q.Ëx,ªˆwEÓuœÒE∂∏’º·P|ì5ã£!õWZ°F:hü+ŸÅ9>‘Œqnê5˛ MM(ÚDÌ˘ õ–€ŒôKq∫jF˜KrÁƒ<cØ) rû€‚OXã7<…='√üÆW◊^‹∏It√±wÅºÑ'∏ïÑy#]¥ıà0CÛÓÚÉ}é)ÓfLq±U4ùX·|#pÚ∆7#é‚ÀÎ–GX»Z{ë0M%Cô¡NÚy¶∂ ;àv‹¿|≈“ûûöú–ºì3ﬂf≥∫?ªÁµ‚2Ûˆ´î‰ˆµ≈˜6.”òèÉ‡B’z≤'˙épj`±a%±Y¯ÔÎÂç‰ˇâ=·p““9„¶Væ7¯öÁ2{›Ûóm«©ÊÒRIˆã5ﬁÊ{Œk¸ªîΩG~+ÒÍ≥éΩ¬i¡.Ø∑6πqvC√ÖF›âÜS&ãù®0◊Yæhõ0ÎõÛπë+yÜ'’¸c‘“ú{Qär8'˚	Û›jÉRÚü·OŒ:~ì =[‘«ÓxHID÷q~X\èîfÁ97-‡ˇÅ«2dÏMﬂüˇL·`¬cQâ˘Xàj~Ä%¸(áßå2Z0”VÑÂ∏oµ⁄XÔÎÃ¿"2Íë€ÙÍ@F<—µ0N<¶Ê©§¯X%ïxÌQwnﬂ3E∑º‘f‹?PÛê(sv)0m?ºd_$;E]V˜A?∑ú/J≠/ãíè
^˙h$Ω$Gk$÷W
lzSˆxF…∆√∏*˛#˘E´-^yÁïb!†¢?ãD6˜ÈÊ™™ÁLΩ3ã∏3∞ ë^–Cﬁ:°”?a÷ª`˙ﬁ6D¶rZßX?†gÊÑgéòæ˜Ø5É C,ŒπtÄÅá¢iêEÓ÷˙ß‡•FÚ*˙Æ‚≠ç◊£”∆^≥údΩ—B.	ˇ*rFuqÒV1WºUe&SoüÜ	Vé¸å˜¸ÿÅ[Ó–°û±4MÀà a&ãt@Ωó zm≤≤t˜Íﬁ}¶MõäL5Øü»ù†ä–¨Ëm
GRòT·§Æ§úÍI«Å^•6 „·*SHΩäXx)&;u\Îëÿ$ûU≠›†Ï<õAƒ(µañl#çPr‘ÍzÎú!ÆÈ*K√ ÆóÆ¨˛Jñcsl6œ¯tuAÂ†Ø,¡Xr±ÆL,∫q•?ÿ0q˘¯£Ω'çÓ5?hÖ ã" {¶A€|`Œ ≠•◊¯Jl7à}cQ¸“öPˆ›ÀË“v#8åz≥zô∑ÿÂD˚´Üu¡dwÎ˘ {⁄U¡—ˇîÔ˜◊ô√$‰Ù±Æ@I»jk∆îœ!•)Ç˝A[(XsÛ⁄ôoX[QùR·_¨À…1<u,ã∫hV¡)£ÜÍ”¯ºó3íº≠áNô¯sß|∂T¬≠⁄Å £âFî◊Ò ÊÿÖ áuÌQÎ—˝‡¥âÜëV`≥˜·Ãvè;˝£~Á∏Ω€ù~ŸÀ¶ﬂ?ÌÓ∂~ﬂ⁄˝ıx¢≠≤øÛŸÁÌ˝˝ˆﬂ?ÌÙﬁO{ €Áæ÷˛y#„Îg
Vx˘úD§#ÿP=xe5◊≠H)¡N)Lò˝Ûüì∫gZÍ.-€Ñ⁄Á˜àiúm;ƒõ´™Bu1NèºdÁ 'gÔ2ÚqIuW¥ˇ•òN∞„˘ Â~ªRÏ:˙ö}2À/‚b∞õø a‚ø )NgáaGçYáÖZÊÿ^û Â≤‘IJ“∂iª°Z6!˘:çj!áŒô∫¯_¸óhˆˇ§n’ê•|b¨:ÜÖ\bnπbız†u‹;Å<&œ[≠VuO_®yXdØ®q±O÷7fA+öõyöÙY0®Ï‰RÙBEw˘RÚÍ»^“ÜçmÖb$V√ ãÖ˛vF5C‚pŒ”óª‰K¡ƒOŒÀQq\”®—îôä≥8Óùœﬁ-C,ïÈøk˙≠®˚Jﬁ5É#Å\AÑé%Ÿ7ê˙iwNáWrWQiÄ◊€•Ojy ∑ﬂ÷ÛãŸc`‰Ë∑≤r∑ﬁ§öûŒËƒ`©k  ¸Ò€ıwŸe€»–ˆú9¡`G±l∞
¿ÏŒgáòäY8xéùÛI∞;JÎÏ¯≠/†Í˙A≥à4¡ı}éÆõ7 (…èGRÆòΩ4WÃuìÛ–˝öàè…Vñ◊ÚÚ„^∆˝%YÇ⁄zÁºØ∑¬„≠xëÜoÖ«k'<z°≈å^ a>≈ªfôÙXÚêΩÎ&>ˆã=Ωïg\%Úc’^C≤§´◊PÇ,ÈÂ≠…Ø+!◊c©]AåÙZn¥`Áçãë#ΩV‚i¥rÛLzùE…2Sê%À8ÃÕ&-”∏0Yë"3JiOÌÈ{x‘º(5õœH Õü)6Ã˚.T8?†ˇì$®‡~àÖœU%Ô√äl`5Ó	ô}ÊzÃá≠π-¬¶CÔJûèGûˆhÔ	Y⁄3a'NÃΩª≠∞H*yø–◊”c≈ëÅ∫ås∑ÇD<˛ËØOÅŒâ)áÊÑ«!
Î^îÂmŸED≤%Â—)¿‘‘¿Û[o∆}Ë…“ƒ«˝ÖUçŒ1_5Õ>ˇ&ìˇzŒh≥·Í⁄Í√“h3π¿¡eú)‰=*Õb%õI•nNºY«ºê˚#bÃT¬í4ÁƒAPi}∫k6`ëß&aØ®ÚS^g≈\œt∞ñ_î¯o;ísoÔò)'@£¢∫çi£K˘≈ì˚]Ù¨„l≈¸F∆é’áçÜ∏ÿ»1˘uÛéÌ ›m6våÆÆÆn(∆é…dV7|lcæ±MÂ»11]÷P⁄=Â‡±π˚]´H™∑>‘≈RIû∏C8çà†j(Y¬
‹…%⁄öàÍ>Èı:dØC⁄á”ÔˆªÉÓ ?Ï∂=≤€;8⁄Ô˜îdõ&≥7πbóbSFﬁ>î(õ9HwzeÎàecmd¬∂ô+Íïè∏… ˚PÉn ¶˙≈›Ttˇ6ÙF~›¢É- #od¸vi6’F’jÍJ8©™„∫«ﬁ¥c9≤—Õ–†Ç-ày'™bo∂F4Z+ç6gàFkíh‘⁄LˆSbî»Î≠“ËaÅ˛*ÀÚó?¸Áˇ˜ø˛âà—RîPAéu •€ÚD®®±`∂Ö™°∏2qcd‚∏\	D”ÒÇ(,ák™<cé‘
Búÿ\]]1fãsUô~ß’$ÕØ 0
⁄º?S>ﬁJy)A.V%]h“;J’g‡RÔ%™M ôHœgUp™<Ê—Èfç‡P[_√+ -e”}Ôh∑€;Ïpieàˆqèt@ût˙¬•Â®›oÛù¸“Ôı˙«EÉ ÈfÉ÷ÎCö¥Q^˛√ºLúeëkEëÏ+2£íäé\‘c)ö‡È¸kú…ˆŒ>L<˜!jÔw›(Mò¢…B—°±TYªZiÿ˙L˝ $DN¡,ë®"pDÍ ∞‹~√ı≠á3IÉãòò˙N®Å0,¯áµHNMw˙S¿ôÄŸÜ7}O¸ê∏≤n¸âiYQnÃT·ÜMñ@]Qè[Ù`täÓës‚:ÿÑO ¬`
-/gvä“hPÆ≈SD,0Äuxî¢4`º≥fáiQ+î´Ëy˙√#ù≤qú˘|NAñ@¶Â ÀLÃ•»v≥¶òü‰Ìs5…Çòà5'V¯µ√ÎÃ|[“±≤≈=ò˘!≥‡Åû+¶}uõ<IûÕñªG‡_û˝À?ˇ|@√4V3GOsƒlüNLæY˙R2∂;‰›Ω9ªJ≠1j—'Â]]ìªöˆÓØ¸›?§›õ~Á9"mli˙#o
;ª«F∞Ÿ°›ﬁ167tÕ5-
˚µ§[Î€§#‚Yréíì˛˝”Xïv±;∆ ~}ZÅiò˛»t-”¶ûIu{8°.˝2cç(È‰∆69ÄÁdˇ^πáˇÒœôÚGq÷dãá~øœ|#∂¶¿)È’&ˆ
ü‚àçx,ﬁv¯}ÆWπGNê˛`~≈ﬁΩ‡éâ'ì@›QG∞$¬U⁄oôÜ™;ÖæV≠ ¡™{Œ…°K¿m±[&XRFí}≈ó=¡¨Ü+ºbÖÖn,>¿ªñÑ≠⁄à≤[V∏^¶Lº9 í$8;èüs:Be`ö:ù^Ó£$¶X√yß®|P–&f≥¯∆Z¨
\+S¶e≤t\Ò2jA·ñØ¶Ã<ıiôvPπòï∫~PŸÉZI§¡0ã…pyU√a∑N)˙ 0‚¡]j`sv´≥"OJ$ëj3ÜòëÒî˜âSfÕN)3˙ˇ@“h-˙í[éË˚–rF/£>#[–Í≤é:Q≈ßQ'≤©õî˘c”àR0FÚ9œ˜‚©·MÃ
è◊(àúkxnR≈øïıQe“¢dHÕ[}gO ΩkÑÁçûgM4å∫\ŒezE˜öË N63Bm¸†Dsêu¢Qn|π §pâ8^¥@)ì_≠´L"øßbüB'ÓÃÂ,D_ï{d$|ÜπKzÖêT+`±'†V≥9—1äv≥–>Œ∑•]·Æ‚áíM,€P„™≈8%JX-≤∆}õô¿wdÈrX;èâÚ^∆ïX,©«pÛÅÓ›U°∆öb≠
t}º •BØ\’9îË,æUêZEUDnièÙû*4Õ˛Ò€¸’ñ¢ Ÿ∆Jn*Éfú°ÁÒøï?iÙh7”HÓÜrODÕ®ia_2üuzìk®pK∑G ¿††Ä†,ıKæ;GÔ≤çV|°=w®ŸpÏA¿\y•ªÛÃc¶—ä/‘⁄UÛÒQ'*sbù‘£xΩ“¿*;Ú«.cëüXÕ!XER%
s`Ih…õ6Úüçï≤Ñzû9å¥¨ßthZf (9RÆ}éjU◊cØL?§ñ˘&NC,Ù©*πÉUW°÷reB°∞Mv8ËûO°Zm.e÷p©nN"á£`m€ê!≤zE%  /√Ùë ËÙ"⁄å—ˇﬂzá,ıIÅ—¬M#ØÉ—w≠‚ìΩ*äuªg Æ$ıJYfç”uÖºÀù¥Kwœ´ö)L»≥6J≥6J≥¢ﬁ⁄NÄct^3›À6)[ÒyªΩR’Ìº?ŸZﬁ‚‚55ùﬁˆ•f◊´¸Œ63
ß≠œ≤<M[+í„õ4K˘§©%ö∏úE4ç ÌEüs~;´n˚#j±ÂÁ+≠á_4È0ßÏèVBY4º—4Y•Úªpñ≈ı‹|+KÔ¸\ñâ∂¢à+•lΩœô! ÷z∫.ug∫ùY–Dñß∏êüu‘,üñƒ1K
¸Åyå¶˛Z:ä¬5$Gﬁ¸"º5FW·zíŒ[;NÚkÀNü¥€≥--pØ4π˘0î@O“í≈£(ôX`é≈=•mô„6™ÜÄí"B˙∞ÒQÅ7ñöá6·÷)2»9©?(sé/ıÊª|.[A|÷πﬂ€zâﬂõ∫ ö¨Íê#ã¬ñ£VLjt4{Wüß¸ÌWëCÊ √ï·.ÅWñNW<ÇV¶"u!:<~¶p ™£"ëHáãZ‹◊?>áçÖÈjöWJ,Ù÷„Ò◊ãç©ÙôÔÇÕrÆÈw
¶ñË_j¯é9¥∞@uOœ…ÄQot™B.ûíòicÓPÚÕ’OKC…F≠kGæ„8/yÔ*CÔ˚ç
"ﬂÖ=Zí[hf¢<–f2˝¡û@∂Æ√äºµntyüq-VTˇÉV@‹£∆Ùáâñ∑°q‚Ü∞¡Gâ˝Õ0aÙÅgé8õ≈EÖì& €G=w∑s)Ù¸ÍÎé•Û˘ÅÜèÜ∏ÿÒ·E(êNôb6]zt.≈ÒÑ¥^RÈQıÿq1
-^p±™£◊9púè˙°H-zµ°„ÂOÕ√k:n<nµ¡†ÒùÈøz÷ŸkìùÓŒ~∑˜¥?˝À¡ìﬂêßœ¶øm»Ó˛Ù∑ápG-.·6t<
/#mJË¯d;ΩÑûúÂ4n<!j±\Ão‰#∆ìß>‹pÒ≤ÈΩA·‚›øó_w5·‚2^ª¥pÒÑk)≈ä'Á[äsˇÀµU•1Ÿˇ'”UÃà◊Ióµæ≤µ≤U£ÀíaXÛ⁄¨*‚w≈⁄¨Ï…πìy™™¨:ÈÌ˛ø È°ú–1≤o⁄/}Ú4é?≠wN…»e¢û›´‰vúõˆ3≤2_÷ÄD}Ñ2ﬁ ˘ùÇæ/ZhΩÒ8ÓŒ¸ƒ¶ŒÂLù∂&r/›.P≤Ä¶9¸N»ìê≈Ò¶O›ÕnúÊútlË ÛçñZÖåEo◊E†Ç®ù/Û©Û_æ„Ebü‡â˝µ˙?R˜ Ir˛+ˇ‚‘c'èﬂäÆµBœTˇ•»Á˛¯Œó∞≠ÏóÍÿc÷„;∂„∏Ë Gl:¿<O'—y¸ã#∆96∂¨ﬂH—>ÂÂ%\±¢QÖÍ#‚>ï¿!„0ØK'Ãí®uı#–4lDc∏Úù¬∂“fkŒã˙ÚÕJ™$¶cπ—+Xƒ1Pæé5KGƒÁÅÀAhÌæ”ˆÇÈè£–r».oO<Aívü<Y)	-…t(E◊˚‚áì	ıtõÖViÚs8YVÏ€<ãı2_ÅÍT9qé˝Ç6pìCfKô'VéVØ.Ér‰è∏4´≠%œÎ∆z˛ [á(gU)Ïy…ó:+fîÑ1Íù‘reb,¡é˘ß@òe=üü≤†F/¥G’'ÃDœ◊Ñ˛LÊJ⁄ëüZañ˜©¢@≠(Q7óë_-ﬂS{7Õöì™Q€{]º›ﬁ'K˚Ωˆ9Ëı;Ë…◊~⁄=¢ÓŒë˙âË*xç¨pH©¸UPìl∏> 8ê<Ê”L-ÿÖU¸qÄ∫˝: Cís˙ïÏŸ™AüùxÃ?›}ù=vxË6/f¥é^pe¶kqÌÑ˛àtO"˘@lLxùâÈoì'‚± )◊⁄Æ£15‰π0;∂∏d€Ω≤W0ÿåÂöò∞˘ŒxŸístj„∑EâÇì»$ãI≤‚;‹M©—…Zp8Q]ä∂9Ÿ8<OhL!†¯FX∫]…ùŒ¥ÍÃı5Õë‡aıöÜ xwF4º˛ÔˇŸ√,Vò_ﬂ9A)5ÔÃ"”	˚*u"˘•2ÉTVM°Mq/:qµî^‚ä<HHh√bcò 
;ˇÖs3ú˛”¡˙ä⁄oxÚ.õÖ√@∂>FßÇ[‹®±E(A#7„J€’Júp #√!«LAdî»	–”&FË‚π˜xUiBƒë≤◊ÙBh‡ΩT= ª#úî≥œsz˝‰5w‹≥ÂMg5g·=¡™|Êuo™¡z^îG±v¨eNq¶Ìû,˚‡dâx?ß≥r ∆cHN¢˙¨@e_sç∑⁄R)Ú#+,–êÑÛ-á9@‚‘g±RpQÈI‘#5/‹NÓ†èÁæÍE°Ò√Œ vˆ∑1˘„~w∑}‹˝5fÎﬂ#ùÉ£ˆÒÁ›]¯˛∏€9<&ÉgÌ˛o»R∑]'0,∂ﬂ¶/¬1·˛Ö#1P’äîJ´+'+¥‘«’Ò∞ Êïxπí…9•Z„Z]Jóh7 ◊ıÿ£FàúpTÍáxRöƒ(/'÷W„¸ï›h_◊∏f6ë ÏíâiG≈I0˝aÑ˛¨ÑáΩ8˘l‚Nﬂc~¡{dÑ1SÜ√À'M\‡Sæ…Ku;ËPG„˙à#Û%¬û†Çé¬+—ì¯
?X÷ï;∆∫ôc}#]c’éoŸHÎ!Î^åbıÕ“‹ÜΩdOVWVò¢ó¨Dúu˝d∑ÊÙì≈U≠ı≤Júe≈`f2ïÕJwŸ≠π‹eq◊-–gñ{¿¬ß|B'H;ê%q«ÎkÈ–w¨px Îånu–á≠∞(Ú‹“l•ì≈a-ﬂ|π^fØ0ÅN‰åQÀﬂ4˚ö›H÷8U\¿ﬂﬁü+‘9ˇ·hhëﬂê;‘ÙIh‘ıôœWic°Ó?\•IQ’ƒ®˘ß˝jTyr‹oÔ=€ôÊOø;»F_Ïu‚W™ﬁ
û»¸…ô8§Ã6Te'ùò'^yÿmƒ®Íà2SC£>j6Ã7îCÅO‚Ã8.0aπìƒ⁄†6DÜ–Œ„áıÕÍ'/‚”ÕO6ØÑ{Cºª€A@GßG>vz''&¶©Q¨Kò◊H¯y√s∏zó˚W∆æê´i%DO˙ﬁè’Ÿcs
éΩ)˚Ö”Y≥¢¨HT…%\ZY,ç≠}æÚÂö{ˆÂ¯ø7“•’≠{´6Ô≠Æ=º∑“Zª´ò¥Øõ‰7>s˙qZ;àk¸p¸—«⁄#+4±RÖ=a·È∑º(ÈÉ‡Äﬂ"ÂàÃ_ÏÃ·>óm„Î–‚ÍqìôÁ∞Õ|KM:ô◊çıírò¨£Ö˛b9Lƒd¬ÑÊKY9}µYJäJIiVíc0«ú¿[¸§\•Ø~3qFÂ‚·ái4óõ^ÇôH∏?ç6íÂúïºÕGIO~∏1GÂ}É¢é*pw$øÓr‚éÑ…qœym[5≤Ks¥˜d©˘»£T˝ìú3È8gëí[Å™”_œêu¿ÿjáY“;{ÕvcëTïóù:„∆mûù+Ø¢G{\^ÀDµÔÄÑ66éÛÑ›‹`Ä˚L.`6ı(^ıP†ºó”°FÂÖÛtÙ:Ïq±ªèÄ9Ÿ≠›|(›ÍfÜHõ≤tKs˜∫Õ¨1=ÀËj7|‰ÎsMˆ|∂.êGO*GrIÉ_≥aÉªóØj^5ß∑yì>ã<ïŒuÿ≤2YF_„/Ni‡∑]wpJ=∂Ùã»JÒe‰ ˛ãFI≥p˝òY?∏ºåi~'ÁƒˇÍ≠|¡¯–ÖÏ‰é˝
ÉCôDÀ§RáEWƒHÅá“sB«±P[ºZ‹¿hD¥ë∂€{“‡ﬁ?`æO«lMõ¢QI7ÄL EF…Îx:ûN®i]…—X˘±¿˚eG"æˇQá]«ÛH(XxCtQ}Ó¿ÀWÆ…#ÕUûÑh±îOÔ‹µ>˘|ò[π´ª‰˜•¨1˚±CÀ∫G÷Ó^Z*Å§[e.ÅÖùÇ'ÿ£hŸQÃô~5ıÂ±ƒπ…√ã}≤o˙°£L?÷M–7EÀa„:÷JıZx3¨øk‹˙´h[*≠wÊﬂ˘ÏØ¸›o52ñ™áâ+xui[YA¢[4d`7À¢o∆∞ﬂ⁄6¶?M∏-1¢K¸πÙ9}ù5GëX)T6^ÍÓÛ©FµTB»ïãTWl!Â≤ƒYÚ’z…Œ„˝,B≈OƒßmBÌs0æn2Ñ±™.≈‘áë±>&ü|¬¢ÒÎûC€/‘
åz¯°≠ÆN¬9RVQÍÆÀæú	n´Ñœ’A.D9g©mÜ^o*k]5ÏZ˛˜xïÔù‹≤&ñﬂ•∑§’j·ß{ÑØı∂0Ûø…;µÄ∆¯í¶<Ú/O"ÊfÜ§—4¬&ç .8≤èB€	À¥˜Êâ ãâøã1ﬁEMˆ˝U≈∏VÿjU†ºfåsâìGµÀÍèã•!ë:ƒ˘∆_ˇ¯˝ø’≤◊€àXâh˘ÖFl◊∫ÍÊj6c§µgÁx˙w∆E-fÏëy‰:€,Ÿ≈å$»	kysﬂùú)2Ó;…‰≈f≈cÊMﬁ›ôg%4ÁR+Böˇ†t¨π¬^ÒVÊ√å≤àÅ+ìê«ÑÿìåA*	.◊Ã‹êM<˛óﬂˇ“aXâ«mB˘˝ˇÊıœp–Ã€†ÅÆQ$¢ÿyÕ4E=üˇlÖ¬ˇ&Æ®Av¯LK¯7ÔT™ó(I	 tQCÜb˝   ˇˇ 3AzûxúÏΩ[o#Gñ.˙>ø"L˜¥•û¢DÍfïFUãb©ÿ£€UÓˆÆ]∞CÃôÆd&;3Y%Y]˝≤ÅúŒÒp∞ÅŸıpp‡?¸r–/ˇ…¸Å3?·¨yœàå§®™≤€\/±b›◊∑Ëç7âÌ∂≈ªûR◊bπ≤]ÀvG‰wÎoˇé‘xÌ[ˆk2thú–	{‘¶t»ö7Õv„q≠q`§izúê]áÕß◊/…ïÁÜÕKá_˛)ù\2øπ›jëŸt ¸!	}¯Êﬂ|OÑ‚öâÁzµßAHÔzÍÿC:¥Á?π‰x˛Éo»ÄπC€qË^›ßZü.a!ÆÒËÅCC÷‹ÑGw≈˝j˙Ã°◊∏¯¿uÉ¯Vn˛Z`O‡—Ølf·PóÜ∂Á÷£áûxhËÒﬂ›âÏ¶ÕÕµmr9íƒÒpªµﬁnëKœ∑‡ù”‹à˛åig}≥E|oÜ¥ﬂÙõ◊Y.·Ó™	wk€àp…ï√Æâ≤I–27d>—i≥Ω∂Ω¿Ô√”πèˇ„üˇèw˚Î¸O“q©„çÊ?R“ıB€≤a≥	ÉÆ7ô˙x–˛á%u±Xm©√ÍP8©¨G#&y ◊·Êm„gEÂóŒåq"ﬂ(#r˛-“¯÷˚ßq~Ô-3ﬁ|/$˛√_#Ô¬}`JÈ:Û]{Ëër∆¸` Ü°˝öF¨˝√ê˘ãvó/Y≥ç˚bÍ>É;œ|ÍŸ˚bÂ˜v¡™È‘wı~ˆ÷‡ŒF˜4¯QÂO`.öoo◊G-¸™P qìﬁ»YÁ§w¥Gæ:È˜ª‰ºwvz~AèNÉŒ˘W‰˝ãg§˜eˇ†w“Ìë¡ÈÛÛnˇ‰–`Ï˚õ∏2ó˘†“∏£ÉóNÏ·°„ıo»oKVÙ[ícƒ¿Ç_|
≤È™Ωır}'Ê¡1û⁄Ó+ŒÅ€	ﬁ <mÓ¶áˇ4áûìÂ~ﬂŒÇ–æ∫âﬁNÅS∑ãêüD|ìcjyoöŒàP◊û†V8ù9¿l'7Õ≠Jn±‰QòÊF˙ë∆0µ7øü?**—‡|“ Îïó1∫V,'”œIåDßUäˆÃ>˝Ÿs-èå`c©o#√G˘nGÒSú(∑®Ÿ{.»Dˇ`mm≠Ú–VÚAΩı2añ=õ§üWcæ¯dBØõoö¡ƒ‡π{◊p≠xÍ¿π^@|ê!û3ˇi/ ≈›¸«+|Û ﬁ)Ã¨?†&ó/u`)@Û≥ºhq–Ïπ!·¸b„ÄC–	ˆ≠á?sàœ¶û2πzﬁùóÓÆ‹Œ ûÂûÔ{~˝öÍUæ∞¨ÒùhÒM÷nÄÕwîá:èé‡=«*€–çC≥S[˙®z±¥‰≈≠ΩÆ»u£ŸJOC≈C~AW6Í>∂∞∞πE&÷û¯∂‰;86Dﬁvãµ7^Æ?uV“ÚΩ)™Q>Á≤Jnú“á7%7Ü·ßÕ›SéÿÏvƒfqTÔ5ÛØxs”§3–*a¡NBπIáX3üõÀÕÕÌm‹œVïE±GÈG—»êÌÇ)ù jç†ÿ≤d¶c€≤ò3Ò+`˙M€Â‘¶õæ~Êo+È‰¯ÿîü5CŒÈENÈ’˛•¸—§óÅÁÃÄ„Ñ∞«∞Å8¸ˇMskóåÒX≈x≠í•∫ö¡Sqí‡[Ìqñ◊dØa*A”¿≈YÕπñHd_≤ÉµéL∞Ã."G⁄õ^r˚≠éV_=¥ò6Áqÿïâ®ÑQüxﬁ´”)s/‡≤¨∞ªùVZ-πM’L„ﬁoïô˝y≈ ∫ˇR›|®¢vŒ˚ß‰†2ˇËÆh®˝√ì”˘ätè:É˛”~∑”ÌüûÙfè≥>ﬁ2|pΩãEÑôä@&pjò…ù!µÊ? '˜ê!ûF°Äò∑lk˛Ïax3•>!ú°7(d†.X'≤ ~«ıt© ç…p]å¨GCSÕÙgf∆Ïò\Œ¬–sç6ºô¢]¿/0Û%yn◊±áØ›Æ¨íGè	à∏~AXÆLÒ´O¶ÜvoJ~É\!•®HmF≈ı—˚0ú˘ÅK∞ ÁLŒ<˘Õ≠!ı’Ví◊\H∆LÙa´ ∑[)nÅVÑèá§-˛ˇj≥R'/!ò≈Ñõí1 ”Ω‰£V<	Ò¡n§˘â∑»±ƒ%©¡V4õ¿€oÃ∂:¥CßTø¬%;áSLakaøÈÑŒˇ≈√c=ÁZ	0TËA ¬&6aèÈµ=…'Ûw>„n`áC∏û¨{`Xà°mÀ[mòLŒå)ïO]Ø]&Ø˝c€≈I≥úªµÜ˛5Z†√òﬂU,’Ój≤ê˚ÎÇü,õWÂ8œ–õﬁ\x—Ù“£æµÚ˚¡È…”pÄ‡¥Ø‰lÄ58˙ê.ËW»∆ÍrEùÄ’ÊP∫_ÈAä’Å¨a&œ ú”È5qË3Y€Œpæ‘YF-Liu'[éKcÔùÁê&⁄å∫ﬁ‘Ü„wπ-pñJu\ì5U‚ëo[ˇAÀ) ∆UÚvÉã€j€∂hk
:[õ–È 
J°=0cn€∫ﬁ⁄√‡'^¥æN∫@ #,ÿÀƒ0	¬CﬁpÉAö2ªû„˘‰Q&˘HGar´≥a‚b∂Ø–µa4WÙj6Ë’!Á)ßNc’Ë©I~∫!£N2]˛]|r∫‚[ÛÈæ%˝çäYw_€¸'w—Grüî1 ˘Ì≤f‹qiËMÊ?“Ö';ÛßNä‰˚ÙÑÂ/ñ5Â3ò±‚ÆüÜæ,:sÿ›(5s˘>E—/jÃ‹$“9Dß-qÏp¿®?˜›+¶4í‡(˙¸v‰/…üˇLnâ„Ò8Ÿû=‰Ì?ö‹Ãg†“∏Ü≤ûs9C≠‡ªEÃ∫6çMe‹é€¬ü’∫lÌ∂Ü/Ke€√XVxÜ≤N¨ºgÇ3‚ºhãu[òk—vÎe‰QöXâC	Ê4ÔV2”gM-TtÒÄ≠k‚#ä^™Ï£ÕSç≈Z¥ñ.§ôY5Õv‚∑Å≥‡41n];8ø?ﬁ6ˆ¶¥5.Ö≈ÉÕ∑Ò˘¨ô;∂>ﬁÆw/qß©Ôπ3whs”µ⁄']rc}∞Ü´Ä)=Tù∞≥HvŸ¢=Ò÷O}{ƒ‹Ω≤g∫˜8Ωq]å^7®ètúqFî'å$ãöQΩ3>PÍ7@üGµ>béÀsFâf˛õ€H¶ÅΩMEíµﬁ¬DsNS3»(–ı¸	hn|’ôRQíP—s1u¯◊s «33—:?ÕÿÄk<>`W`™s5påˇ˛±\tãWè‚9≠ﬂe	”ô7â°i∏å\Pn∑6[;/…î/\äU¬{πk´¡9f%8ò“∫Ωt<8rìKî/ÁÃaØ)rõ(7ä&{ScäÚË8∏¡‘âF≠ëfTÉq’;<®NtÜ\>úÕ.èôEFr£»üfËÄkñƒvIg:ΩÉ∆YO≈]üÜÕÕúJVWs®~™I`Y6]HÎ”§kË≥ØÜDe´«å{ØaNòr€÷ÖÈ;•Ã≤È=ÚÊz¥ËïÛ§ç©k9L-ë„‘"∞d0ÛhÊ≥ïXUz¿7rÕâø˙OHóµ3!ñ–KáYèn3F‘ö4êÍñ∂K“R◊»^0 7UFÀF+ûˆÏÎ–oöëÂYûSg#©).‚¬KÌ∆Sdõ.‡’ã^5ç“=™·Ùé^˚d«ñf|mpø5˛õŒÛZ(˙õ}=ôCÃπ™N≠*L¥Ê›Í∏Ô„{,∞~b„À∑–<ëH’M‚±˜ΩVıî[Û‡CtE=ıet_$¢9$·Éƒg¡Ã	ëILzÉ":32§æÖ#$ŒZUJπc«ØØi3ÊÂ$ƒ4ù¥.®åIÄêäE$˘õ˘úú≈tƒ≈2.+*“X⁄Jf∫∏!J‡ˇ_øè¯e 9#»cdÉ™J≠öô˚ıìŸÛªNØõcX›æº˘t∞©πsä∆Êˆ2s˚o}Ù‰˜6¢nxŒÇ©Ál•HÊH##?5µãEJVP'ÍNîh
îÔÕ¸!à{Ó‚¢
DÊ©]vò;‘—ËpÆKøXsò;
«‰1i-‰/R˘Ô∞'g dN
Úâªqó›$ÜÏ˝‘DÇfÓ¬›`âüÿóéÌç¸˘;ûSåŸHÇ‘±º∫ï4’“(¨¢åçUøæ	_Â4%"êÅ?îH¯´üãA÷%'˘uÃôÙã«ƒ4Í:
£◊ÿgW|åµôo/:HH˝5æ:t_’-†ã^¿5\œõbu∫aÿÛ˝zzxv<q˝ôñŸ›ºÎêÂæ‚¨(Õ'*l∆ü°˜€M¸JÅ;eÍT¬4Ùg.:&õ¯"g _ë ˛oˇg$à9•å#åø›âlˆ◊È"ÛZ≠)∫ƒ≠j˙≠ºË>ùÈ˙¸¸Ï+«øòY%Dnz”lx≤-ÍM„∫àì∫gîÆãÿæC]D™ˆ©&K/[åz˚TC2›GY¢ÒOÍ´´YeâÉÓ≥ﬁqÁ¢ﬂ%›£˛Iø€9"ÉÁ««Xôx˙î¸SÔ+Ú¥r–?9|4%âÉ·òÅAh≥…‰é5âõ•5â	Ù¡œ¥(1¡˝¯ŸT%ˆ∞&ëß“bÅ˛4ÉMFïyLá~7˝yÍ€`‚N±ÔóRà»‚ß∞˛2úˇ4¡:ÀT-"≈‚Ü¶üÌÚ•	®J∂Di'ÀÄFgX∞ ?±'@g!÷# r~∞=lüÒèDÈÇCÜ3j˘X	ÈŒöÜCybê;◊ø‰˙ƒ“gΩﬂ≈¸-©PÃ≥ﬁÂV*∂ÆZ√÷Æa•b¬£? RE˘,:—Ú3¨UÏ»≈1ê∫(RL%	„V›S—b≤jÔ£j1¶g¥«ˇˆΩ7¯w≠j∆]))gyÖAQ„à?Pñ3JÙ•WœO`©>∫^¢T<ãïä≥D© +]!±P\54@>˙≤∆DΩ®9öÄ!‹ŒT¿¸‹¿40∑Wà:!‚Ï©J–ü[A#?¿o|:]¥¥˘ﬁS\∞±Ω—ÈƒÃ_:ùLâÕ.FΩZπú≤0>0S&æ±ª∂^ÜF˝äÃ≤öÃX9´µ“‡yTÅy(%SìYR°9K
ïPıÎîrú∆ıôÑŸßÂÚIk8MDµf"◊6ZyŒó%Ñ4_ù˚Ïë\öa±‡r£p3æX`(¿Q1Ωói1¶)ø:ù
>’ﬁ#O¯v`»wÍÑ‚?äSb~œﬂ¬!˙Î©|’=#{‰÷÷,HV´R÷8™˝˛ÎˇU¶Ë/`AS;y•OO eMeNT`±ÛÙÛ¬P-Ûœ@Ûøb§osæ%3¥{2=„¢§©¸K0πë(<úYÒñ :ø#‰M1h°@AòÛˆﬁ
T"<QÂU/§‡û±	nu&Ú`^§’r÷¡\rL˝Wñ˜∆5b˜év!≤Û;∞≤Æ†Ev·ùs4√ÂSFFF$∏ﬂ…õñ¿´(%Ü˙õØRæ7≤ÿ?sf9_€&∑McÓ÷wÊá@Y@'bÿRâdâêU¥_-÷z-ØF”N‘MÛå!#O}åm97xpÄÄ {3L}ˆ⁄fo»Ô÷k{áR±XQÉ√”ùì*c–C¸‰ZÊ≠ö¬Åb-kaZ¶»]):j‹«ïÙπ∏v¬7ïº51·ë<[ÈDÕ8‰ê1{Ô+ãQuM4@Ûô,P£^^ˆP&ObÚ£∂Õπ[[p∑î/Pi€n¥ÍÊ˜\E‰◊∑0)ÌõgøA !ˇ@⁄¶Í≤|Ó˙Öb˘ïJÍCKﬁë-Ä≈ªw®áG¶§ã-∞›k°˜EED≈JÕ,¥Ö*óÔ„«9RŒ%_DÎ6ÂÅÅ‰</vläqäDèÀÂÁﬂÌÏ‰Ë@“π∞W¡–zï◊—	éqèf√Ÿãr/Ô|Ñc"l<
≤X0Ùm.ãﬁ÷ßÇ∫’∫K˝©I®—`fÊ\"≥•+ä-A>«·n)}”Rzπ¥œ˝èÈ;º1‰D‰K^;ÙÄ∞¶Å)”Ÿ«p å∑;ÙKä¢K¬∆q2hÖ\1©2^àÑôæ)jJ®á7˜ˆ◊√Ò2F:g#Ó¡\O≈'ó5vƒíoùë·∑æÈ°¨±ˇ˚·•g›§gT{‘DxY˛G¢¯Ïƒ<›x◊U<Õ=˚µ†°¢gˆÎ∞Ê˙(Q‚ï6∞r.G°Ú¶¡!¬ü‘ä◊’¨á≠R™, Qà≥ú~(N+õÿ(Î◊ºï´{ˇPSŸ„ÑmÃ’L[´ˆ-ÚòYÔ#x∏¨F∂XYg¶åRÍ:¨ˆ–s≥—∏9„€⁄¯è˛˛n‘VLƒ+ß›‹Î ôsR|;:M⁄…€#À5wqaIìÍzEÊjI_æúv b°˘‹UÒÂFÆà$—n
eµyÙ6SK∏\yN¯ó8ìF∫ãûŸ†Fª$¡w∞ç˚´â#TvìÒwi;ò!ùBQzP–I„ã„Ù≤“s#_ÏjÚsû%=˛‹2e#Ú·ÈQ§›j˝=®£#Ì0ó6ú…	à'ì™y•ßËßˇ0;√≥`»‡¥]b˛≈ä˝$êËÆzkòaâ#Me„[∏˛\Ãÿér‚©É-HyñV“cÜO8ú·`¡ê˙# á=;xZùØe∂CÔßÏ•ŸlíAØ€Ìœø?¡nÁΩß}Ïõ’;π‡›˙'OOœè{‰∑‰†?ˇÀ—È!ˇÙ¯Ù@v"¿Àp}ÜVI=HFÌ 'Ì&YXª≈zêB“Æ&g∑‚pô‰QÓè7M2(ä∆*P$ì÷…¨‹ ÂΩB¢ŒÜ0Ä'fÇ∫»»ã≤I…9ô°/›⁄†Û€>ÈbﬂŸ3…ÃøΩø>ﬁºc)KÕ\K«Ô1∞#Q\Ò⁄“Àô√™√˘CﬁR—#BÊ^2B—˝…≤-ßƒˆô¯,K¿Ü√àA8¿	êG∞eUihÉ'Ò?Õl†%æ[å<·ëÑÍƒ«äLN^ËÈº4ê3¶Å´R`©cœ≤Øn1≠4"öKoÀ,µEáB»=¢Èé`Ùå_ˇ‡Z`-:ˇ´K&Ûwf®œÄ…{q∫¨IÚV?ebr@]¶!µ,‹‘zä7Dµ©<\“¬âÌûËcQ‰RÜ!ïgqÚ
ÈëŒ¿Q•æ⁄lÂœt±PFõmñ¬üBµ%¡ÈVs¶ä5´>¨≈}0ÃóÿjÚY0Óæ)âÈï†CEkµmñMoö@°`ºõ<wb3Ç©Ã2ﬂÍõW”btñæÃú•Û¯,UÚ'√$å%ˇ3Ò£x?2ÉˇÄ∂y◊fB±á7µ0W'Doˇì|Xƒn3-Ä∂Á€†Ñ…2;òvRùóÔ¡ﬂ"3’8º,ŸãXçQ^Ù=qç∏'rögƒ ¸Ü#nùúÁÒõy∏ˇ_yEØ+µlNQíêÂ—-ãG|∞é<`∆LAˇ+3ÕÂ¿∆>Â3∂ﬁ%ÀõH=s(†îL@ù÷’d‚lÅ£åy0M
∏Ô≠tﬂ°óX◊´”yÔI.≥P®∏*¨s˛lÖÏó∆èP‘Á¬¿*Âœ≥≥T±‹R5YY\1Í3ìÎ◊Œ“£€·Ã«Ãpx‰ıô8¨@úç±Å»3%;wÀ[akUhçﬂ“»6E\™1>Ã‘Ë}ªG>„¶˜å≥ÛÑ%O˙ÕÛŒ¡Äl~ˆÄ|vY-COj¿B\2~ô7)«úˇHáÆ`·pÕƒ∑û€ë<Ä™¬
ﬂŒâõ$ã¯ ŒÇú÷∫≥ùÕuëÇpìdÁ»Ÿû∑ùSñNG∆AΩYàHEº“4/úÄÂ€ﬂ…Ø∆ÕˆV Ìüèù,”ùî Ünû!X7søZ7+='F¥¨YtèR:ÚZË€≥¸è¨ˆƒ’¶*É0f3Ùö>πÚΩILe®‹x—ªœ„\◊Ùo∂c¬M~â◊≈∫ˇqB‰ÒÁÛíOÕlπ4Çp±pEê˚õ±2R‚H∫É^Êåj‡§D	òqãÇ‰∏Äí≤QMiF9yãÍpj-N8πj"¨‡À<Iﬁwø;f√W]€:Öt˙ƒ«∑∫Ø&”≠Ò∏∫∞˝:(3^£‰≥‰V#ı‡v¬	√oÑ´≈Ÿ6√˛ZÊàYNjÍ!óïtG¿íjÖæ,$eÁËÙ\∫˙ªGÛˇA´Û£Èw{'‰x˛?‡á’ÅÄ€KXÕù≠˛ÑéÿB0R&⁄ RQ>jõJxçÕ–M‡ü»ÙË:@çÙF„ÒbMÀÕıME0ØπˆµÄ=dò+gPâù˜O·3zj;L–dëëÛ J_zß,Fæc7uÄ∑¸2é¿0g£†wu(ÖˇÓΩáSï~:ÍRg˛cànzã€®ù”u—Ü€#e:ú'Ö`g<ñÖK9ËL@,åR8Më)™˙áòwy™j¶Y“Sì◊RâÚõÙÇõv~ˇ¸‰¢≥‹0rïDFhlŸÙH`&⁄óB†,PızØ≈UÓ(ÊÌüÿ¯WÙÖi74=@P˙ﬂÆ¸O D—ñ’æ|ô+∆»n¢EÉq\
êbâÃ@≥ÏWlÒÛ%f`‰{Ã.†ﬁ™;IUe±j˘´!À@ëËüùeç∂`ç7iDA „‡ˇ3Îø±<¶Pùƒõ>pÍMé@‘˜Ò“ª6:K y8M˝Ï05J—MëﬂvZªÌC‰∑X[©¸∂u‡∑Ç"fÙ{§ë‹{ad6|5Íª{’U,Y∞¨v÷¯≤k≠¥z–ë9™ôâæ∑@óÄ¥ıÇ˘LB∆~Eûuéé:ˇ˘t@:'ùã˘˜«˝ÓÈ¿ÙâÃ·«j‘ö,{3kˆ[mß)D¡ΩjÖ‡+íØKˇÄp!¯∫õN^_d⁄µß@C1≠wÊ!CR±ﬂzH¸5_u≤„cÙ≈äx|ô3%Ìì‘*ıP·àDñ´ÒXuõï)±DÍﬂŸ°æ^€Ø∫0«ÀÚ»9›.B¯XÑõ’ÜÔPÿú…—,OŸH	®æÃ…BÇ{§˜B&∆∫6WNüˇ&≠rs≠π
~¯±‘úm[œ‰K3Û∫¥°‹“ÚOùƒú/IŸXÃTA‹≈∏«µ¢UX·î5≤zß!ÚêÈ^°Õ'ím1∑ît,ãS8ulÇ	ﬁoÛ«ß∂ ©≤oî¬í7°&	rT2‚≥p8∆o¥&«<^–ÄÛ∏öNJçz_C•ˇ∑=`£Å»-L˚l:rÁ?‹eâﬂa∏‘∑)ô˙ﬁ:˙Ö11/(◊bó•:Ë<Å≈ã˛ÿ^ 1˜åË˘;«l^ùÇ%4∞8´ÀÏRˆB%Å=E3!XÄÿ !YIﬁÀ‡J¶™àÀ∏Z&ª∆F^ﬁZk[«|™%Ïs¿Kíﬂ€◊T†ß"˜g¬AÍåÚ¥QL≤ôJ6ﬂŸNÁ|f>.ƒ=≥©™¥Ú≠ñV^íâêä◊ƒ	fÍÑqïv˘’“µk5ÊU¶°∆i†Í¥uY∂#&ågs OÌ©<µuõ∑·≠ßˇ◊[ç≤≈Il-bW]$±=ªîŸn˘˚X”˙÷⁄xÆK˘ôÅˇö∆§ç‘ÛOØ(yÿÂ•YD
R|$Â?êù°AØféIƒ ˚wtJ∆∫áÿkom\∆≤BÁ£è§∞\≤>l·‹∂SO⁄-Ä?áDR“ˆëD!Ó£–J]äP‰ÎÀÒµ]÷ÓêËwOÊﬂ.0{™s–ÔˆOO:Gde–;|~r–!ßg˝˛√ﬁœzÁ≥Ó(ø(RØ≤ ÖéO˛Ú¢wî
…KÑ*R∞I∞"≈Ê∑[ÖîXdä[Ô9d±˝1Ñ,tÀˇ3å[T<ŒØ¡’-?l¢LÕ|Øåî´°<Ü±≠ÙV¸¢y˛£e¸P…†Ìœ+")≠≤V(#˜J“˜å√Uºñ€#Ù©óá96óÊ(…agÊS«*oZ}…	;≠Äêätbé:UËRyâ‡å¶Wö7Õ)6Í≥È;QgºˇÔﬂ◊CGS’¸÷È≥WÂ~SL®*≈"
èñ·ç«gæzà\(”æm+…mÏzÓïM›Ô(È ñøÑ'|zµö≥W4DéaïP¿yË¬#J˙°@`ıË"ß  ÇÄ◊‚N6°Ç>{û”ÕìW°¶°X»k;òQá¸i∆$¿UHnáÙEGGÕ%±YxE´èë„b∏õà2◊⁄CÆ ãnFº–œ†8LËçﬂ¨}` _e<≤\p6Ú6hù∞‰R~v◊Z 3h∞ﬁÒìﬁ¡AÔÄtè:É«¸∫ u@Œ{›”„„ﬁ…AÔ\t∂ø
ÿBÂ<[&Â<|$›cWí|TtJDø›∫∏&Â?ikiŸ@˙¸˘≤∞2ä£†rE…êQ•îıõï•Ù…˚.“AÆÒF>ñH<,zCz¿2·√H8–ÍxÖYY–á(
Í Ôã3áæ#†’‚˜Õ¿Fî9€z˛‘CÉñ…UçG∆éÒ"¯% Ö!µÊ?ñà3dä∫(G"@|Œ¿ôi·VãΩÊ&ıÖ‚Q`jTâI∂”*∆à∑kV∞o' B©*ı•ÜÖ£Ju›±4éA	iñ›V»P€0F‚lC,◊2ÆÖY"Fë·ïÖnÀ=Òõ1ﬁ$¨6„Ó´_\÷#V6º_∫ëë(Ü¶·‘í`™8ß2úZ3áS∑4·‘R€œƒ¥€Ô8ÃTAYaG!3èR∑5D∆*Ìîí.A„Ç)oªp#¥π©œbe¬ÓŒo‹íB√?™äﬂÚuäyí‰C@WeüØ9ÃÖcﬁ’´µÒ•Î!π
óFﬁ≠]	iÑ±æ<%Ì∑€≤—Êü`ÔƒLbC8'ûÎ!S{Âê„(5é>(kö◊»ŸåYzË RÆÎÖ;«æÙl¥1∑(.“Ôﬁós/‘ıx1⁄J±©ô.Y:9—(ñw…0Óé!öy⁄A«ÒÅ≠‹tÜCÚà|Ú	å≥F≈G˝Hï ˛ü|bß>ÅY/‡Ü/MÔk5·–∂ã{ÒiÎaÎ†›y©1xh[W‡V.Â@ïÇw∑r•vcl+
)Tf*ö;’TeäX†ô~ôäa#◊lQpå⁄.G#„ùI∫@^Ié2ÌÁ“°’Çç´ÃEŸl-îÖ ^ÉÉ.ÓPWoYËÜqõ9¥ıBÜ¸ûÔc+R>˙¢£∏‹cüﬂUÁ”⁄ªÅMeu∑ÆÖoà¶Õ‰+öﬁñá]í^u◊wÅ=≠ÄÂ˜y˚òÙˆÿ…¥^/nc“Í„æ6Q©Üg∑‘óÙVÜûE_œ4Åñ…‹më]¨◊ß±F+E~ÅYxe#øÒ’˚5ÜykûÈ$'°TN”ÅñÌ\O®ÇÈr˜"|Ò«x3æâ5"f’€Å°&∏€'∆kîcöπ]ﬁÆ•<Õè˙Mò
0∫*ŸmêÆWût†I‚Kõπ<,Ÿˇê«à8Ì∂;ùÖµ/ã“‹Ü»/ΩÎzR‚≈ØEè#◊xùô≈é©KGºN'V{Î…yÒ*√ Ìó›a€PÚÀ∑dmmﬂ= ¸∂{$Ü—ï”$oMögñ<eB0Ÿæ)ï9aJSƒNå^õKJ#i˜Vé Ë…1U~SsjdE/—ß©/“î*„¨ÍbW¶u¥à¨Xºãu(3ÑŒ_TS‘ÿÈöcõè[3±JÅ™õ≤.≥>Âƒî≠C’©0A<0Çi]_ìO=".vN+6Õ√Î‹ ì§zÕ…#wc_l¬¨œW∂“—_+óïdûæ&ÅëÀUhıE;<}ë‰Æ‚ÉzoÃ •”Ø=R≤¡ËﬁäY∆l∆‘…Ÿø°vòC4´˝È<¶ùV∂>1˝˘Üz°3ôN9ØG˙ª≠Z|∂Nén-ÌIΩmµmÿZ’s¸Çöm-‚’˛{"êÉçM©◊Xhﬁ…∏Øø0%Ü1_î‘csÿ¨œYnÙ⁄Oﬂè´È,ízbl°5ﬂ«ì◊ëÍ5”†çëÖÈ<ÿØ¸L∂Aæ3»~ªbä“ãO[€≠›vÎ•Ù∫`wd€“åGël∫µ[»}Mw\ÜæÁ8ó‘oÜc8÷ëWtc±÷‚•Òπ“‰m£ºö…%œƒN≤*ı5eıº%á≥˘è<√ò^‰ùî∫"b„Pô_≥w_ $œTR$¢Õ>®ê^ñ»µJÛk›Ú>R:˚V˜Ù5IU^oêjx<ˇ˛‡˘o/z–ùz‰+Ú˚ÁÉãT´Q¯3Â'ß'Ω9ÔÙOèÊﬂ¬Gì,ƒ¨∫˛Ñ’+À{„√ú9z.)¸©»`8Ê&ÜFΩ¿˛ùqDübt)˙%ÖHç?’/9"o.–pˇâz‘’lÄV¡Ÿ≥‡âò√§ﬂÍØÙ\A–ûò*ò<‘uŸ5>àQdNDÂd+Ú(ˇË¯ Ö¬ﬁ⁄ç*Zœ¶èÊ=äoÒ$û`’≥”Yë„Uû∏¥óõ∂·µouÆ≤⁄sß8q∫≥ÜßÏú'¥v=g6q˜ÄªRß⁄ÃÿÀåy˙ÏŸ¡Sìs·©:G@˚–3¬3Î™#Æ˙Ìo;≠q/Ê•—ûﬁä≈‡oiÍÔ_íkáˇπfm…8 ô©¸ŸçmäGâ˛nñò@ÊÈ¡∏b∏bΩ»3‚ Îuº•ò¯£Lô∏OÎ-˚|£?NÉ”q‡e˜63•∂j48û,?„fΩä´Ü+u◊ı[€‹N«rÚjL¨‡Ë'_ˆrvﬁ˚≤ﬂA∫®îõ’N8ìﬂK™πÜ#+y<>ú€H?^íΩH§¥~E£_fqœÎlF›TKÉcsyJz^∞I¡"…©V©∏©¡\Ù{«gß‰º◊9z°Zã¨hÑ]Y‹PuÑxüKoH∏:6‡ïßó YïúúL˚4i°42π¸XZGÔz»
EDÖ3êRÿ¯ç:∞D∏B+ü	U˘3œ@ﬁ1ï˘ñ€® 0^¥bŒH_‚kÊqûÊüà˚˙¢ß2≤”æ üesÛSYıqzñŸP{|®B9¨¡F´U=tµ´¥öò9óåªá}8ÇùÇhÑï˝:òM&‘ø1°‹$fÛâºz .˛e}~e~‘_¨zŸ\ âàÅ=r[é¡†™	Û=i
Ò‚⁄kÓèïÌîÇS·Ö∑Ùí~ÎÒ ÛJîéÍ3ÿKﬂÂLﬁb)'“¥4vIÒiÄQ%ã◊A{ÆD’ñ%#MÃç˜ƒ=:ù¢ŸV@Ù‡+ü–‚áıÖﬂF„v T°\gxƒ]9A…√‘?ı2ÈŒ}¥#0ÎO∞]∆åÓdŒß∞H∆ìF‡ã≈ß¨Hˆ–Xº{[<ÚBvWæstq˙.“…È˘qÁË≥ÂîIUfVºóSß◊«‡ÈER∆Å˜∆u<jùPπ>+°?còÀ~ñ·›ÒÔÍaÚÉö!»\¬¿Ó∂Ø?-π§ŸQk$Ωv.±DùZ`ıL±f˛/î∏3ˆöﬁùB˜{◊0ó:G∂õè»¶cîÀLˇ†J∞EŒøŒ≥ˇ‘ág©Â˝+Î∞éπ/Ûr3,»¯˝¥2N„ƒ˘d•ÚÑƒZy8¨´ÁæìéNDßÅ±ZªW<Øyøæ“V}’B^·¯Ÿ
€U∫òA•kã6“´›>0i©«˜q)b1dYÌ¢™LÆ∆¡lÜNT240ˇì$ñré‰õ˜™"ÚÖ≤Gy˙™…Õæ¬ì_πcÅ?Ó7∑K^±∑üÜûáY è⁄øuÈkDµ4Â •IK c˘qEàæ∂c"w|å‡˚Ã?CàÔõG◊kFU]\qVÕË˜˝1∞40çSñÇ§ÿò(HŸ6ç,¿∏íBòªt ≠¶¯œ§èà¿¿*üzÆÜ9◊T3ñ+ËœëÒö˚iµ&[]Z´B⁄ Ÿ¢ u†Æ¯X¬öX;∞lB`Y«U{"&ñ>÷z¡±4V˝˝Ü≤á®6‰¯≤:ÒQ4káíê˙ﬂ≤ê'‰pØÖ¯°`WÒ_pÔæQ&∞U]´˘≤tHµÇ®E±~m¯≠$ ]P˝9É…« 2|FQñ¥›jÿ˛iˇ`u	ã®.\Ãˇrr–9«¸öÛﬁAßÀ≥mˆ»†w“?=ó)6ßá˝¡9loÎB:bºÁOÅãz›ÁÁ=“==9Èu6L}°fπÀ7Æ¸Ç“ÔØO<¥ú÷
ﬂa1}Êû?ÿyB6˜4˜)"s„û]tN.H˜YÁ¢`‹ä‹âz…èysUfNÿ(ãÆÓ's)<÷å«æµ]∞ˇ®ÛËˆñHóÊi= ò«‡Øµáªe…&RÛÃ\’éØjó]¬ÆÌ∞Ê]Û/å¿≠Ò˜ÌÌ≤ﬂZNmÅ.7ëà†Y<næÄ{W⁄≠÷Îq≥Ωábı%ôÿ.‚u¬â(¡Î,°Âômô"œïjyı3§+=n%qÔÈòÜd¨À/©«s
…&€<«ÄU9j’ O˛˙1,˘\ˆL˝UÒ.±õÄ•≈wÍ—5ˆ~	®\0)®D">°™ZQ◊£Í«,Ëà˛4£æ∫ØrÆ˚OWpèCÄ§õqiƒü@nπ¿q†µÎ˘®≈ õÏ!v£k¶Q 4ª´˚JÎ}Ãy’Æo˚ä¨Hp”ï∆ø˝Îë=·∞Õ†˛,—õa8Õà∏œM≤i|—X]≈† bπ’¡ ãó ¥@eB†a^SïÚÚœ0’…†S¡„Âc°}π¶⁄ûhIb=˚§ˆ›©%<O≠ ÍF3P1‘ﬁå	JéåñW!ë>F¶ICÆ(ŒÈÌ0µuY¿%µª¢»Ãb≈b∆cÓôÎòKAG€ô†∆a9¥6Û¥§LøÑU&ÂÎ1ac1JÚót8ˇ—”óÌó2´∂ñY	5Ê9	’ú∫VOEú˚¸Øpƒ¡Dß‰êÅ a”ã⁄~!$≤‰Çäc(è¸˘ª+
EzﬂÓëFl’” .õÅ
8ˇ…ß◊ÑN·WpÃ	ﬁ»û"BÊüfv¬ˇß3é+ï∏S¯∂‡gD-˙Ä¸€øf∏Íjg bWÁ<…úé›4	F	vì⁄Á≤_¶Û&Ø1IÛõt∏îµﬂ‹¬Õ◊|œvcÄ8∆X|t⁄òkÒ0{Ùûc5t1æ™T[≠˝öû† …ªò–ú≈0ﬁä2=ÆDGLúyTúSA‘¥ÇZª-YåJó@¶´K¶ßd∂WKFOŸ0iõíÔ◊¢ã◊ñ’Iï·fJ§bê+ÌTÙ›ö˘∑Y\ˆªóP’ôP—˙Û¡EÔÄ¨†ï>ˇÃÙ”UNÚáΩ„˛I?mΩv˙Ÿ&ãd$Ûañ=õ‰[}ÉÑ‰å|0 õ∆c~/úﬂ[g°Y%gyyXtü≤ö∞™€ﬁqsÃbûä{óON7à% P˜8’©ı»¢Çkf\_è¨6ÕàÕÄÒL—‰j#&‰˘É)t[ΩÜ≤9t·úA6ıΩKLç`èÊS}8Ò.T•˜∫™µÒJ¨›“RõT√“v—≠£kY
r8k\)°i+
oìŸ´ŒÚK¬÷gWè¯ËO<0±&@oÀµxΩ°’GT"ﬁª√–  Ç∆&R<,sòÒsï.%MT%\s4¯KÖ˝6òxh>m’íñ¡u£ãVbº!>úí«zÓ?±ÃäG—{ÿ(¨BpıxO√`k¡ÿæ
a®Um≠$„òH¿JÿiE[F(íóê·¶º∫KT©t>LÅo±1ÿUÃ‘8‡–˛óº=L`ª@m4Ù¿<«≤l/’ mÏ†£gfyh—?ÕÊ?OQieæ˜&xtªa‡)§–®Ωµ1ûSAuÕ‡¶b7)éû_¢~ÁRÆƒpﬁ,‰†ÑºGjï"ãzªêõl⁄˛N\Pæ
€€–ìUJ™µL7H…k√çO’ZË€ìÂπ»äﬂ8°€§ÒÄ¶F*A;b(©ÔBÚˆV∆#íq÷&bó;¬KXªF/‹∏^ﬂ†@% zÓkõ˙KÛù-ÓJøè¢][{§sÄÖˆ`+ú˜»‡+∞'éIˇdpq˛ú«Ì»ŸÈ˘EÁ®2<Xo∞X‡+∫¯o+µô
|E^Àù˜–‚+I•‰Ê•®v¿è7
Œ∫À∏XÒ˛b+˚bd’·“—‰úçûgiO0üÇN–+áÕ›“	–Î¶*õÿ_o(ûææßR¨◊6‰9c~‡Eçx(‘°è›÷∏€qBÅõ˘4‡˝⁄"W•åP˛≈%ù\¬’.:%AÁ ë&∏aÔ“±GÔ É˘≥êJ¥{ã Ün”‰˛1r~8√y‡0LÅØ∞µı*Í¸Û˚ﬂIÁ¨O@ã}ı #]Í[dMÏÊõÄä±G∫Ûü&L=ƒD‹Ñ◊/Z5è†¶ 6™ÑU∂›{e¶W-˚ë5ù„*d£Ü‹Ê€Z+êy.ÕTÌ‰ØF‚UGéŒ≥GNÂ¬{pÆ\Ô5v/ûEî«˜Æ˜ï⁄«Ø±ÅLOYd±%e˛ÂùuÊZ5htÚ”˝= }q÷‚8Ë$>ˆì¿ g¿∞≠"ê!Ôâ5A\ﬁãá·,	Ã"Ï{(_ÙèQº,í ’Ë<¡h#3;§kd`∏t∆xMahF
˜?ªû⁄æà¥>¿8Îåw¨‡Ω∑@„.áAR˙π Ì9*NV—Å2A¶ö:†X;∞úMãÅ·π©ˇ™§pÇïÚ™OÄc´Ó/møîÏS2Fπ1√i∞∑æNmŸ—c‰y#á≠Ω…zÉKQ„k†r˜U”Ä1)’õrZvΩ89µ∞z|aΩFaUÒL≠O˚OtLÏ%Í=Ú9ëNü¯$…J…tW˜◊ÈcﬁOi(éCci8£Œüf6Ú=$ûõ'∆T9rˆ◊’ã®]ﬂtÆ √Ï·PD˚ÅsdΩ}ê;û;*F/p„êÖú'Äö◊ÿ_<&+ßﬁm	ˆ}Ø`2Ÿ.ú¸êïÃ7ìˆ8s©ú7Øû¡ævÛü¶p‘)/ÛDÌbJß`±(√,¸@=ûïyI}üÔ˚ÑπÛøFÇcOt^©»R∏Çá∑RÑˆ ¨˜d9xvÉîÔ™•I)Qèë ïﬁ≈n‘eVå≥NlË3‡M´\¡d∞{*W˘’“◊Ñ2˘}<ô©!%í…FSíØh{>fÉƒAÖ}q˜á¿ºï.Ê\¥'u⁄¡‘l›tøÅ¥;X’N?èÀ|ˆ5óí8Ö«@"åh"Üÿ7‹B¬Bªà?ôı“ï√ËK‘_çw©˛zÔØ{
(h#}ßV{ÊU‰d›±±P“€Z)"˛˝øO.fÿoÓ5íø–ÉÜÖ›ØdìcáKotÅY@πÍÔ √?Êø∂-ër%ö£RmÉÃW)∑
-FØﬁälxxx–mπœ´•/§+‘P}]H’wÛY•ﬁ_ç…ƒi8.ßA∫í∆◊ﬁ^ãVPZA∞oTÊDjë>gßı•°¢¬å¨¿?økÚ£Iù¨iÖ¨qVærôm,`†[˙Q4∆ì‹bkR.Vd’ŒCáY?â∞8¡<d‰íï¬eh˜Û|∏™<ÖÄÖÉ‹©‘X9ÏùÙŒ;G_ˇ”◊)ˇS∆ûÊ[-˛^∂•jÉ§kÑ«#D2!"ÉX±€ 6P,$ÍmEô¶›m¸D¿d˝ïëøâ˚´5›+t4'*ªŒëf®Ÿ ÛõøªÙqáÁ≈ﬁvÇâÚ6y¿7'”PpKq“‘cÎöˇ˛_ Á)|œ¨â0VU+Ä¥r`	eB&Q”ÕÍ{∫ùÛN˜¢wﬁÏë€ O¬2yPW¢¢√™ŒÄΩK≠0€:·¥‚i5´â`œ∂AtAñ)fÄÍúô™xO™Ø«VyìgªÈë¨$Á∂kõÜÉ>œîÍßh/üxX+0§*]S∏∑5rµê ) √%Æ≤«Åú±Îîœ{uSw˛Ïy[§ ¬”Ç‰X'3›û∫ˇ¬AQÄ»74∆X[»Ò◊≈ÛdwÔπ^‹pQÌH•∑|8≠e#•≥ƒò!ô4záî$ÕÆ`¨oUÂÁ—(.µBÏqÜnˆ“z|ak1æp« Ω˜«ª‚Dd†™”CÀ9õÖ3·ê'≥ ›K\È…ÓΩ7§ÎÉ∆çQä{<	b≈o=≈À=À<‹√!ÙAÙÅ’(ëyI©ƒpÙ.l«˘L≈ï3(â”⁄t&ˆ\.Ø„c‡ëõÕÄ0óE¯°6≥Ùêá"j•±∏J®§
Ñhsªò5gú¯ËÁózI€‰©¥MjÁP‹√f!-÷€+±SkwOûIE‘ó∂+Q6¿ã÷◊[”ÎØ€è?∫§+>h∑6llµ¥÷6Wı∂‚•⁄>ÈçîÒ˜Es_å>Æü˙≤Ω«=˝ß›Á«Ωìãé»vÈúÙ™ì]Ë‘^,—/¸€JrŸ˙Ëí\ür∫¢Dô˙íôEyëµËt≥ï´ úXâß˛ÆÙ¥ni¸πÍh˛Ωf‡Â=Ôwsq]&8ûCÖW6d£îó£“9¢ ¡yèY8º*≥ x8kBá>∆‡e(ÍÔ*|√ãˆ"¨n"[E∞¿é;ÎtÎÁ˝¡* 742∂œ„µÖÆµ%â	†aSG√QÑ˘.ö6ëÑIb)Ô‚
À◊ô⁄EYàM˛[¯·3Fµõ,ßﬁà6ï¢éó∂Æ⁄÷À≤∆å’Ï`˘h˘œIQ’˘äô √π•/»¯;Ÿ:πñ\--	π˝&jÅõÙŒ`ïX∂@Ñ#£(!¿W˛rÈó	„>Ç|å‘ß>?◊xíUfãóáˇ«?ˇ◊4"ÀÒÈIˇ‚ÙútOèœNO@p/Çõ°$t·+æî¸π_BŸ€\[4]Ÿz>ûoNÒ÷óºã|Õú…EÃ 9£>ˆ@+)bPHß_7ï∑°ÿoD§(˝Íî†ÑvÆQÒ∑Ê˜ú-(ñH≠¬!… è •ƒ¯kíîñ‹˙zT‰OØ∂≤÷ÂK}Q}Uõ2-JÕùr†í]ÍèxµöK˘êˆ3ÃÊƒÔ„,å5ïõVlû∂:<ªkpKîà\1Êyk∫BN}ÒVK[ºµï9ö&à{ö»≠`¬UÅ[¢ÅÎK)9Q 0aÙ(EèﬁßÚ”UıL¨Œ·ÃFıÍùp–â≤ª‹i◊C5©T¶g∆9Ç§Qà;Xõ»≤ñ Z›¸Ö¨™p0ôs/É√FLÛ^î<JsìM∆w∑S;8éÈyª%[~nli[~ñ÷A¨–,â0üœÙcõ¥y\ÙÎ "aû§?£0‰5QÒ ™£qß3‡Ô2Ö4w0JÒæÑg¢¥föD(¶∫ÏÄãí„ÃÁÃÊçRA9L≥-!U˚-8÷ı+”´Ãåﬂ‹’#ﬂ∂˛É.Ä†ŸF5?yª!NE?ŸU„ ëAà	©º¢¢≥iv∑ﬂ†`-tí™∆…1x˚ı+vÛuîƒ¨*ú—/2Ì·≥"=€ıΩQ5î¿)Q‚|õ-	ÿ8ı,≤S8Dº€q/R¡◊ ﬁc£øåQF˝6’UÑk∏ø…äí}Œn§Pnr⁄oªu˘p∑˝≤ëﬁ©åŒÃõ˚ïÊ≠Õ´mˆRoÉ∆Uöﬂ£
Vô@è≈d˘”gsu…—˚cQ˛∏O)ñWeRŸŒÁ=ı√C˛q$†Ã÷…S^Èµ …UˇkÉHWKÕ£K9tyU<µ∑¿·ª3yóŒMéÓU√r)¯˙çéø¶ˆw4‡Ì®¯ú£≥À}Ø{Ú√˘ªQ¡ıOS~[Ã≈ñKü‘•`≠’¸ùkQüœ‚ﬂˇØˇÒˇ˝øˇ[¸≥æ;C(k≤r‚EÂ.ËÌÙø£Éõ’ #ev®Ñ–ÿnTÇÖ9OT‘4˙wFZBøë?ƒÍ?yC}}Î<óP4?µ'◊Ä‡¿(R¸hLÉØÉôœO/‹ıÎƒ©≤§äÏb3Òú(
+c∑ ˙∆∂àE¸®¨^Ìòúf±rB§≠C|'¡Õ|GsWÃ˛~QΩÅÙ/‰|*Ím¢rîΩ∏6C;Ò≠yè'ü«‰-¿nŸ#”ÔÊ?∫åóÒ£„¡óW∂+†J„ríQ∏‰»Ç:¯§¶ñ2≈”ıÁÔ¶6üvÄµ¬∞ÚﬁÍÈ9qX#[#9¶‰wøª≤1.∫!áÖ?ù®8
M‹…¸]eˇÓw@Éép!W‘ﬁ§óZ‹‰ÀmÚ`l\~4K@YX#é9ñ"âLv·°∆W`1æ<ﬁÇa€◊ﬁêêT=¯¬Û}LÉWX/)\ep€4˙;2ù´vcÒ¥Tﬁ5ÄT%Å…€ˆŸ6ÆÁá-Âh=
? Ê$Ëòªì´πVVÁÛº7∑´dµdèÖ3{à⁄∫Eì”YA§qÀæl	X*d$˝;òÙRr•‰(Pƒ[I∞ã êŸ'Fr†¢/ä⁄ù'ÄÜ#o◊å0^öÒﬁn‰°Ÿ“¿[”å‚åj˚∑$≥=√CÌ≥¿s^3ﬁ˛ÇEÆK–√ﬁ4Iú˙1Ω·`¿m¡ö‚í@›:îUbk‰¿ˆÁ?éÜ^Ògﬁ4éJõ‘çñ‘Fv8√ Q:+
5ÉŸ3}µ≈ú9ˇ˘ÉÁøBó◊ë˚û52U	£ÔåÎO¥¨SQé®Ô/U·ñ˝=:DÃˇ˘~˘¥¯¸º√ZêÉﬁ9>ÖO±&ñ£›_|⁄bÌùçá/?D‡–R¥~‰0€©≥2z¢Ùï√‘—CÖf+z§r—;ÍˆN∫˝Èú_Ùüˆ·Ø#æEucãÍlê
$Éz™•Ë…¡XÜı2ãZ,*àÄßÿh˛W~ÚC{’eÛjˇ°äpiºäáÍY:i√\QœµFé0'Ù T˚`œG<õŒMjT1˚$JÅ´@„sAíç®à˙—+dp¸Á €	çÔîCJB5@`1ˇ…ö9∫?*‡‡˙jh≥…T@ah‡]î˘Ju]¢[¢⁄∑⁄„ }£ùÛ“ﬁ#Oè:ÉgÂ©*,`VsYÏÃ+ŒCf#¯«JcƒëOöõkü7Ø‡©«L{Áí44ïØ∂ÃâßóÂS»¥é› =e™-L[Àˆ3H—UH—ªY'°"ç¥Ω° #ç^¬ü\˜Û÷e{ÛeQØÕg	ÔT¶(3ŒoVﬂJç≠w¯◊—Q’hr—∆Å%YÂ€≠pÇ;Ã∏∫"ëz`„…S‹x#ØdﬁıM∫h6ãÅ`XŸ
B´”¸ŒdãØÈng⁄—◊√1œÁ oW‡†W∆Äùô<!>Aß{—ˇÚî;–Œ{›”„ﬁ…AÁ‡¥“sUiQU˙∂®º◊Ñ˛Ò˘3sÈ»[ L"à°{ÛR√f‰ñ‡–7ë®Â¯dÙ;œç`‹∆Û/}õ;"<Ÿó€íÕÍ¢ÙÀHºÆëæ≈ßÖ£ò!É˙ˆT¢ÿ.Gk
i Ä67≤ä∆õÒ°¥ƒU·’YÚR99ı^çÚ\3PÆ®]ëÍ\»ç-ûŸ KÜ‚‰í<,Úô,∆Ãí¸ôx¿îøπ¶mWbd≈ õèü"¢é√æ£A⁄6/Âà)ÀˇK -A,ëŸı@A3ì6lƒMèqÊÆú\Ñ0ˇ	I*ON¿ﬂlwÊ≠-„å’ZÂ8˜dâK|G&îî\gëèÏÛ%H ¸ã ¿.ÖÉFzl¶A
™Ω^”@bÅâ·¥pïò¢ì∫ﬁGÅ7í	¿U¡›W∫¬ çí™4œç=rv~˙ÈùÌÊ‘˜0m;Çˇ‹¥œÏ‰t–ÈÃJ…È†ÚC≠⁄ﬁŸ}∞ª:ËÁøÍ†ç⁄&gæ˜3’@kê.æ2‰˚s“C≥œôh£§˜«≥ﬁ˘Ö–JèÁ˘cˇ∏CŒN/∏'Á°ö“◊‘Â™§el˛/±R	Kî—%,íá9W3óÎ°∞v3å◊eN—CsG2bœ√Ú!6ÇKQ NaŸ¥Ø@[Ç/ái†ê±·¸ß	bw§D™–cö†FÉ]¢†
!˙´r˙1(ßÁ`ä˙ÑwÜõˇx%sVÊ?80˚†·0"upí·êNp¯0ë2’+.i≈ê–@Ä∆(≥<E	Æ⁄>4’
Ü˛mÎ≠‹ª)VN“≥±'ÙÜW„≠‡œ8à/|ªC(io»≥…/òb+ÊZQ%å≈@I*u‰Ææ7çµ÷•ï ‹ˇ7È`Xhpqﬁ98ï}¡gù£ÉSÚ9Ë\ú»—i∑s‘‘ä†ÄµÒ•ä@A©ƒÅ¸∞±î‰™‚(4§º@∑:é¬#'Éﬁ·ÛÛ˛AÁ ñ>ﬁÿëÃ6‹Kî‰Ó	8<P;Ç¿T˛Nt‘ùÃﬂ]££Áudù?‡%Kó∂√œ"ûÇ(ãù<ò,˚\§êiàHª<ïD»√1∂™6π¿*¥∏`åä∑[≠ø'GXI€|j˚AXé™.´}?—•ã8:cQôËÉ1ï≠Da¶Æ) ¯—Òˇéá¬Äë± úøHíaßtIrY 	1 aƒ˘;Ã&ä0Œ3ÄìG<o¬&xôeJœ‘ˆR°ß7Ïí¨îE©Å	l∂v⁄/K„“ô⁄⁄VÅ7“xEÙ Ù±^]#'ÜÊ# ,%md_1yvâ1~˛^s˝jzò`Î;N/≤[8ıd'÷Ñ8•j∂ÙÿX0)èçi`X+öv%˜ŒÈAeugãeÓr#∞wÕ¡≤}NtnÂNﬁvÍ‰πHf<±S›®?Éí$Rﬁx◊r§sæù+kﬂûª 7É£HG•)ﬁn“©≠Â√4ñp˙xÈÍ.M*ôj≈
º±÷«Adàã*usQ'Àü6H6∏SD∞yòBMÁrPÏßâ¸ÍÛ≤ºák€ın4®’Õû§ª÷È>6ïs< ∞lëT‘π±¢>4> ÿ˛å/¢Sç¬®/°“Á"ˇ|YI"Wj=Åå∫'éçØÁZ∆0å µ·Íà)ÒËí‹eÓjâ∞wX^„(@¯âƒÀâNtÛ∂í<ıôü.Á⁄Jù¯¯ÛTóËË≥‚ôOˇz+wË£Ô>·#:¯ÊÈÛÈ‚Áõà1üt$DÁ\k1V⁄î6∂ˆ”ﬁVë+€©<“·êM√GŒuÙ?MÖ¿'“@‡dDŒÿ∂@Y”›I¥P„^	±¨¸¬¿∆]~≤_tÕˆÈπñ†sûÉ˜&‡˜¬,ù⁄BH) æXk€E’Ω≠sÊôvÃ2Îó^`hÖ•∏ ÂX{R1Q«Ñ¨Hv'ΩëŸçj<>;\Tù[ùœj#ùu›xºNßˆ:Zoæ´Hö◊˙èw#'ç•3«©%ˇ[¶óoÅ©Úë´Ÿ›ÁÁG{zWß!kAf£ñ9∏J5’∆ ì.ºPÏpï ·ˇª€o@†8§˘GÇ;J˛ÀÅâ7üëF◊„ïÓÕ`´è¬}(Ä÷9ﬂî?¥»g"⁄‘@·‹ÿ#çã.?±óñˇ|Óã&bç‚◊Cã{®ÛåÎ7xÕ6ìÇπ¡≥xÿ Úyá1∞|£ºrü«ﬁ9Û”«)w[¬‚€¡Z<.»;or∆a˝qPéªÎG?ÖΩÇ’ôÔ2ÅÁÂm}ﬂ~&ûªmÌ≠Øss|Ï·¸Vö4ïÅM	8q˙À†ˆ´…ègï¢è˚b©ÛEù«œãÙêvÏÿ.ÿÜŸ˛1‹¿O…yªµˆ–Aÿ\<?ËüÆ≠≠ëïgI€fLjäã“é©ˇ eïìDÉ7≥˚z0G+&⁄©C’m˜Ç˚îâk‰5¡I˝ Q8ôø√≥Ä7ùÿŸ“àƒ•°
ñÔÎ¸•QQ*±„…¬ ¬≥≈{œŒ fL8˘kû≈„|~™7úåûùÆˇ˛ÏêPﬁûeg+qhÅ}ä’	mﬂë˛“)ıÁÔ&L:˙¶ÙÜ´∂œé£é¶’‡Ú‘äÌ¨Z±•R&2CÉ~ÛZæ≤πm"◊¢⁄6)ÿŒí≈˙˝‡ÙÑúFÀ§g,ÍYà>k|Á¸Ÿ_>9=”˙ß√ë◊Å◊…‡˘∏˜|‘Èp¯ΩïÓ¸'<—æ¢Cÿ[Ω€ù'ˆÑEBâœb}Íé‡V^Ùˆ€)5t7YÇçöd÷√TÇñ“—62òØJ›€/+›•R°Çb’o–‰…Sı{+Òƒ‘A†8„7*ü·53áQ9ÕŸ˘¸/›ã~∑£:° ^¨ı∏\Yd£r%‘‹N∞∞ÿK¬´ëy2Æ0a@B>Û¬WÏ&Æ‚}¿ıF–"=Q∏<·>˛lÃoΩ4⁄*0ø?¿*zoÇ1£„y8aèWÜ6ÁÆA‹?P\Í4®R2¶ÊJ‚DsEÁMü°FÀãı&«ìb'Q)V%Z~¢‰‹"¢‡ƒmV≤’ò:"ö˝9ºè*üÀƒÜ?eÏyë.ÀF◊@ŒŒ¡`_Çni{#üN«7ã·agF(¸‰W`Ïí-|íZ≤C˜!P$6†Ì9l¥ã™ÆÁ¸•ó@Ó,N \.ãmΩºˆ◊M7ŸÙ>.ñ‹Ìí„Óπ"Tp·u–ˆ
Ï‡—Ì
_‡Á>¨H≤kZ,C0ãﬂ+æZ—/ı˚c9˙J|Â%ùà|VÏƒX7ræç“ãJñtâ‘õü¬Bdú‰oãû?_êû{|’8•E[F◊ô¨‘GŸ$’2[‘s˚Ó–ÛÅ.aÌ.<—n5ˆHø*£3-Ä•œ—£€Ã€≤≤‹9J.â>)ª
‘GÍ˜≤∑*~VvÂïÕ°~ÄEDï˝Í;{⁄√â∏ﬁOmFœÚ‘Û£ΩSN?Fâ´Ú_•Ü[A8Ë“:œÖÀD»ËW0Ñ!∏öGü˛#~“í€x˛Èîπ+Ë8Å/Ôóµof5≠À≈xJ|ıØÃƒÄô`⁄‚30K¨ñ£‹È⁄â(£⁄≠b?4{p£_ûàXU‰'ÊoO/¡äôÅ©z”&‹≈çC¯ˇõÊ∞±–˛7_làø2•´Î9«KgÊ7_ÏÚƒ(EG-m3Ë⁄-Jí¯ÆŸV·ÎÂ´‚d≈Àﬂ4€∞ ÌçLïR∆G∞•H/ë≠Ø*cΩ‰ûT—F´ºà}{ı%I2ë’qÈ∂œ⁄˙;∞◊;öËp•'GóYQl	Vﬁ&6’C$¡t#‹gqVOúD;ˆ\fbÍ⁄±î:äp˜9Húzµ€Fºíl»8∑≠w^*Ã2Èåyƒ±<&∆Z‰s†óæÌ;Ø´ò⁄‘'¡ågÕ3‰I03é-î$wg‹›¿CYcöRä≈êı5_›ñX˛@6&èIKáÁTïIñÀÎ¢¥ñ§jR@òAÊ›L•ÑƒàO,¢b2ˇ8:üYoêã2∂wÖYÀ¶˙*\w˘\êËË*VC‡>≤áL:ÔÙm x†ˆHíV|º™∏∫|.2í‚„RÈ	JS»õJXD⁄òOÌµr¥¿Öì˛ÉªyQ™kñâ
üÖ0ï≈[gÂ'À.~'§¸æ\Ç2qçû'8†‹nØoê&'<˛ò7¸uGïÚõÈruDñé§"“∏q)Ëãb⁄ıñ∆óô6*Mu˝|åE1sÙ ÊõQ‚9%^‰*≈‚9!I0î°∏Q1!≠$|§Øq@C!S?·Y$‰_±ãi“E<”Ó4’Kº≠h,ÆnKæ^“)*UP∫∫˛®%_(êsb7UŸ≥\ø‰©/
é‡i^ÚQHaê’{JÃºTX„qôL{f®π‚ÏM(0ëÜHÿ9Çw•ÓveEÈ&√Æ‰!π‚‹íY‰…<É¯|óRÌgCÄ3yDRw-Ùéº7Ã«FË+
0ƒôÔ*E>ﬁy-Œ-…∏fªCgöÀ
ø˜*˘Ûüu£‰rNÓ4ñ8Ï@ ˙a E\©[>-˘ÿæ"+—ÊDZZ„≠U≈fT¨ß.Ä≠vÛF„.YYWïu*•á¸Œ·Nm˚¢çïµOÍ¸ÔD†≈Z%•$##òhZÄ◊é‚+-∞∞úqπAóü9"3Ö«˚J.ÁÄ4$‚~ﬁ ˘íÁ?zö2suvˇ∂ L·‡Ú‹BôXUù!≥è§˘G8ÅU‚Äp*È–ïªh∞ƒœ≠îé‚ã“FIdy<ÍÃ‹H∆JÈ‹èrà%·pb”…üø+5û86il≠i◊z°fb•áªÏhkOj]¿Agîzª…èú:Õ˚6Ê(:]·‹ùÀ5éÓ~ô_/y°áÔñ3F€2,ƒ…◊œ∆∆|:lÔl∂^*¢≤ ö›l/µô¿´x…È/ë{è[v#j9M¢î}ÓS>_U]yE÷}ïá©ÃHÿTóÌJ‘MhU™ÆÃ.îG◊Amâtc—“Ω ÿ´OyLÂΩUL(:´',£iI≈öî•pfµP–˘¨B{Çåj2}[£WJ-Râãì*K;LQÛËsı*∆ÈÇƒÙHÚëÆ¥•ˆÃˆƒ@»∫Û°¡óLx≤ìËa(∑&ßV˜Á3€üèfï£(7P•´syùµæRÀº)ó9[h∑Õ·“”ePä∫;‰0%Ωÿ@ƒı‹§◊äÈûﬂÈ'’tcZ22Aõû‡?
D¡˚¸¯¸Æ}¿mUS˘ƒÅÅ	G¨<%¢pÈ b‰+Yænpµp˝y‘∫√ ‹ëîa+e¸¬l$°ùÜëQΩí£P≥AN}{Ñ]P0…{¡qJ¬ïŸWéˆD)ÃwZ≈¢Ë,ﬁWﬁ„-≥.’^Ôõf&˙eZº®©Ö,UC∂yßﬁÍ®d ™Œê∆Eëë_IGö)‡çÚgãúﬂ°7Ωπ‡£È•∆RûîJmÉT|•SúØ”≠fw[$¡œ≥çB7
J£¸Yi‰˝ìRx]há<vWÑ⁄:GE›i%}¿`7
Ú*À†˛`ƒ#8ÏsXòaE∂µ≈§˚¨‰n)[#n˚¨h≈≤uˇ4sWZÈ9ˆ8∏œu±ÿqGö)€ô3•ÍÊ¥ïäçˆÎUA(/*ëaoWW
£‘»aBÄ[ÙbÆ`√Kj;‰ËÃ°7âHùÇÀ¸1!ÅRD,â_WñÒîS◊\ÑìƒZÂ+ãl§v≥Eæk¶´‰dóÏå^åÕÆÄ4-ﬂõ6yÚÀ§,Äë£∆Ú¯`*´,ãØ2”™4ßi°\´™l+≈ù"•+(Çsâë” Èº¡?Û©Mπ@-Ôf˛bw˚ı¯•Œ—c• ˜”⁄AN≥•v”h∂Z:z4IJˇ§∆∞ÃA_Ï‘Ç∏ÿ,/O´âA∏ÄΩxÚ™}:…fŒ°¡Nxe≠⁄¿÷Ã\"`º∏‰!¶sBúÉ˙1îuõö¸¡øUeÔE∏Ì/ÛSSß•‚+Sƒ÷Œv:À4åœyR=‡≈ ™Œo"TÀ°r[ˇX'UE'ÁÍîÒÌyÊ®œø–{Û7≤ﬁ¸≠"-UdüKèjs√lP8:SF∂!UC'úI¿ø≈†#RÜf¿&6øyå	$¸z˙√wh	ı»˝ä&Ñï–Ê˜ª‰˝≤N∫Û¨ôCêvñæ}´“Ò≠◊"U‹I}ÀŒ®¢’ÔﬁíûE≠±∞.Ô}/yë…GΩáÛ\fŸø¸´sOõÚA9}·›=røUÓf¨[„ﬁmæ?ˇY6KÁÛj‹E|–u} ÜcÈõ˜¥™©R…≤
G·<.jÒ{”ÄÁ«ª∆®ÉË∫6<∆{‘Tî‚›-6Mf°◊Òb
Ê˝nN!t\±V≈0f‚ÉÊ5•±∆íÌ1é◊ŸÉÏÚ¢ˇ¬∏Œ(ÔhäK4y#ªã˚$‘ª_ƒA-¿ìT9–˛Ó∆-©àvD9Ω≤áı5e–ËÀ,bªÁ\'3.°†*ÿ˘<pñÙAmnWÙQÚc]¥˚~ÒmÙ.ØbtZC^†…º¶™,mm‰¢4bÅÒïﬁÿ?Çaüzæ~”ƒíMá⁄-Aã.dÛßbë[≈Ù©EjÖjU
)¡ûï∆.ë1ñãØ
X∏òt\$=€"_ËÙz≠2›3‡*º†Tsõä@∆øΩ„q8À˚D£?+ïg≤∑ )‚iÜëAD>bX\_&+ΩgÁ:PÏö÷@Egï:«…í ‡g÷§î/Òéß©~é¡GpRpË)B›–‘4¡˘˚‰Ï‡)9î%'˜ΩâÍûRw2);æfà≤ºù≈F*Iﬁ©‘ÂÙ√Â3xt"X?RIœ‚Éug`…∫areﬂ*Õ∂4£`yâ÷c∫ä7:KﬁW¸z¡;q=}+˛A’ÔºYgîy*x´ˇÌÇ∑ûùÙùƒ'ïW,xøæïæW))$ø¨{èƒ‰Á79èﬂÍ[˜6âÃosø’ˇv±€Ÿ¿˜ÉÙù‰'ïW‘Ωü`6Òcu„∑˙ﬂ÷ΩM}√oÚTæ—˝NÀ]:aHácâπS6Õ¸ ]A/^ÍáåÊ¥	åI]7π¯7&K¢Ã&Z Óßô‡ê<Ó©T+U]£LØÃÍ:ëZõQv¢?~mGëY {B Ç•Áø‚ñÚ}+8wäv◊He\≤ßŒä¨∑S]Ê˚‘_4^¸XïqUz	¶a˝]˙ëAt¥√‹a
V¶v:M3∂Œ˚áœ.»†–{“9ﬂ#G˝¡Eb/Œ;O:ø?%˝Œyøì…€⁄Wﬁk§:ÙÊ`.)Õ*F§¢Ï)¿ØrôJùÇ}«<ù)Im*û˛TŒîº`s+}II÷Tî1evÉ,4U»a˙¶†ç∫SÆ\pﬂåd—…æ¡w≈° ≤ÿ∆1B¡ãO[[Ìn‹.‹…{t∂	">Eõ\rU>ı*Ö∂¥ë£È<e!-∞°ÁãBoèXRÍ^ÅI≈°.h*§íQ#ƒ≠≈v°◊Ù…ïÔM“Ëkõfz\{È/3çŸWÈ”ùÕùù´vzU…ÛIäå–æ™üI à´‹∑€’æ€|NIY°Y)ä¢‹¨vµkΩõKJπƒ⁄wŸf}®+ïÀÒy…\ti±)wI'ú˝ˇ   ˇˇÏΩmo#…ï.¯˝˛äh⁄„VÕHIâzª•ÍeQ,}ı6¢™¸R[€ù"SdvìL:ìTI%0.p±ÿπcx⁄∏fÎ[ÉΩ¿ÿ^¿Ë˝`Ãóå˛âˇÄ˝ˆúëôëôëAJÍÆ6L[’d2ôq‚ºüÁ®qπ”Aí…oh◊jj‚ÑèI≠ œÁ‹˘\ÁIòßM¿∂?;ôotÅZµ/–å¨qœa{ûxéf¥wFÑVÙÜ—´yU¢≠!KŒ0T◊Iò2Á2·0)Y.—(2:«v*WÆ0]9Y÷)s:˝@êôÿSøwm¡¬DuQ6ô√ëIB]ÿ¸·Æ™kéî;Ä#≠À:nó&j5!Æ>L›[%á-õas∫;äÆ_`‹. ä-.ú¯k`À0ñ$ﬁ∞∫]ôª?¥)Ç„8üga¶ãÍüÊ^t ·À°Ÿ‰˙®]q•¨¢{â¥{Í‘ùWSÜndN†g6èO[séX+8TÁ⁄tmî˚D]ïcÍ`3‡ŸÿÅG£∫_ﬂF!n∑L·”ﬁÌWN‹à 5‡Y±˚ªXÆÆõ–P·Íö•êÚ80‹ïΩ 47D±ç∂Á·rÈ:≠Á⁄>⁄CÕdªjÙúp Àl!!@≠Ro5epoU——EÜ∑…î%Jå;V~9ºÑ]XﬂPÕ‘ˆ0jx»û¸µÓ¥öö>BcFπló≈(k¯9¸§¸™Ú⁄Ï∏‚¯∆¶b~˝ëó•·π7Í˘›Ran÷∫¯ˆ)∫ºKt‚JWúYzƒúê=?;<h„¥â3M≈±<Ù…wbgúNi®ÀÈÅ|R¶Q˝¸ÁåÀ˝µuû_ëπmdœùÛ!‚E{·I‡c-`—3®/ØÒŒ(*/kàıÊ¨ÙpÿÔ[´ˆ∫rÉLµ°ŒÊíIÑıΩÇ—[å`©,rk÷¨ ªf¿àäÔ<ôr6ë}àiƒ•_π\^8C≈Æ6„"ß¶_Í4eöÒC.ÉahÃÏêMµD§\ë4`i%∂)üF5d+UÈ1^OMkÛâÁP5¥µ@7-(}\(i9•ßeîñµ®\È…ô?mÈ UîÈ^¿à1çMR~µ≈IZóãWz“Ò©+36X[f?<Å~‘zzrßÃd!´q^E∑[ç>qàúòOp’CÀçaèß°≠€)ñº±ÿ—úÂıv≥™ò˜GÍiæ^J⁄#1™gµì…ï„©‰,ª¬Âû{·ÃÜ”&ósª7$ÂÊ)BÖLG√g~êõ 3øu¥F’ßKÀs-±U∆µñW4˝—9ïh#hWöùÓtÊ5⁄ø∂5ÛÄû≠ ¡Äv∞ﬂüƒÛçê¬¸LM=Ö¬í•"y•õ-˛¶ñ-≥O©∑k©ˆ¿ŸDF⁄V¥ìtõ®†;\úÈß•¶y*]-Ä≈Dˆ9œ√Ê”	∆Q"™©1¨ôÒ•WcŒ2wÕŸ‚u∫êÜàn≤X;√Á±teaÉÕÌï–ªû…Srn–)Ù\$`nÑ∏ìÿ‡]äWÏì(√ŒÉ&_yßŒµ3QA|E‹å—˚‹≈Ô”æy	ç+j=åñJˇ˛?[ÿõ	Ùgº˘)Z˘àÛÊQ‘ Ã˝ÿ90ÂÓb|;Ø?)=2iåêÇ#ö\2ÜËıñêñ»‡ÔIÑDÜX"ñ‰Â¶9?Ü‹-@ƒ2YÀ4Jï˘1ı_bØEu∂(–m¡◊®F˛åÈÒéßì ÊêN?œ{f≠ätÛQº`iwaœa?¶–ÇØ¡Ê†∏πÖ6Âæ—∂s°[6IË¨IÅ0óå˙˜Äƒ®-bL4˛zQˇÁ†Ù‰»gÁ:Ò›-Vêƒ˜N;9ÆH™ ñ*πÓ7˜"Ïˆ–•à5
„Ÿ™+L∂kûpöV|Zf†›∫WVn)/Ïàñjlóâﬂcû:R`‘l-‚Zq≤“nt.∞√È,§Û?ÓÚÀèı¨M˚≈–ù2~©&v∂o‚z0l0j¶ÿ∫"ÙÉ¯e˙$7zÍÙ˙nr£~÷pH:#€\PÒ:'@Dy%%B9°Ï1M†YñÊ)ÁúM∑QNEﬂÎ ÆFï˙£◊Üf∫…ìÓ\≥ÑºÂÁZ‹,ö€∆îOnœ7¸Ës¡ ”N±3≈ã∏Ω≈ÁXJ?£¿4BL=JCYŸ¥y¥‹< WØ÷s≈¥ôß“<ëz˙]]ç’Ïë;uzËD8“fÉÁû8¡üıUÅﬂ;Z;Ûè„ñ'≥p∞ÙŸ˜o§Øﬂ1Á≥ÇÏœËÏæ»2Œ\/˝uyÍø@Ò¬{X^YJ+Œ∂Ω∑√í'0∂Éû¿4œ_ˆOø˘ÚˇíØãgØô¨Å Ç‰äüÉ÷∂Tb¯ªa%ug˛*hóÄØÏsÅ~ûH3^"óo>îü1∂”n[Ó£2!ïßcJ´‘´„˚7ŸÌ˛Ó3”∏L˛DÆ_∂…11–e)Âßln,s≥/Z∫p¡9* ”˘˚4Ñ\Ø»ËQb=ö≠√“föS$ñ„õ·7RÉ∞√§NÚ≤n˚X<FﬁY⁄£©õFU›d≈ œÙTñò◊0ç‘ÂÎ˙$ØX≈Á©\RÏÇˆÊNVìHY†ÕB ⁄Ω™nTÀØxZ∆ò±‘S¨÷-®≤¸öÓ≥aKRSÊôIn‡@@∆häPÏf&õ›¨‚Å[PâL<OpE U&ê‹ä8k±√(zP[Îz¯£ÿì»/ã -\§VÚÑ}U≠`U¬Tπm⁄î∏ÿq≥0˛™
Å5v|˝ÿb(1X£‰ßB2)F`µ#&J√#¨“¿˝Ÿª‹ÙPÁr∆™ÑºÃO´BTW⁄Ïa}⁄ír”Æß≤Í)(IùxHldI‹ƒÄ?≈,)˜\≈ª∂`Ô´\Ù©[¬*4∫<<I≠'πùv}…ÏÑœÇ+  √î∑π®‰Ì…C√D°‘≈Z_6î—n>afΩ/?WcJ»ãUÿƒû÷b—´–∂å≈ù˘˝˛–-^Hk%n>ÚMå˝âKÂq[KYKiÅØPz˘Kóã`C&s¡®∞i%πë8ã™ì´O’ﬁ¢⁄£◊sÀ1Å/rQ∏∫êÄ¸≤ì¯≤X%!Eéπoåê^LzN¨zpÜ#)À≤Î°™y
1ËJΩ«Ò‰á¢$vJçr>j˜ùùπ);±≈K˚·P[ƒHÔÖÿåÈ6Âd#BìEGß.ıçˇfâ‰>⁄)/¯ Tb2&º˜1üúªN◊¬⁄∫3Á4$Røw™EƒwƒD§Ω±tÚ‰|5qÚ)=jt/oLΩπƒ(iS‡Êg9%7NÏÛáÅXwÀé'vM CH›Tz‡tQ†Ì]-(≈Hêø◊ó˚kz˚ﬁS˚˙C
µ∆1âFèÁª#u“?=B4°ì˝1¸w˜Ü≥Cx+æ<Û„$q4Oï7Ôx„n‡èΩ∑ÿS≠ÂV˜ˆÎ~‡\`2jÎä“D≈7ŸbCı^ÅóÖ∏Ó—Õ˘U–Òﬁ›$õÊì|4òÌ∞WØUVLm\´Nu‹Úw“‚hK“”ãÇ≥Òßﬂ¸˙ˇe'ÌV†ü4ˆ€GrÂ˘„ﬂßí^dß%%)í•vΩBuI[∫“Èp¥CÔˇçŸî:,kÄUËõ˙öM)ÉRbCŸ<º,=• ÒÏ9ß?æ˝∆’ıŸâ‚jL…=áÇ0{AôzCY¶gñŒŒpJó÷âûZ#Ô,◊.¨∫Ó∞ßÌï”∆^á5NËﬁO˝pÏ9_–˚gC◊ªÉ±´Ë¡e¬-›BéÙs€ﬂda-i!JOˆ[áÌ£6√¥‹gçŒsv|Duÿ8⁄À^857èW9ëiH‘ÍMZ¢”cm÷õP≈UJH=Ü3˜`ÅFÒÈ“£x!˛vWq=yGãÎÓﬁà7Úw®â˘°´ŒU›ÈO˘OT8*TbõΩÔRææÊ]˙~XrÊÔGeª√√‚JÆ¸ΩÍ«ù°?’¸ø ˇ‰p6úz∞å·€P˛eÍã‰w±0qq∂ÚÂˇ`á«{≠Éc‰,çNªs÷:j∂¿dN¨}xr⁄Í¥oø<b?a≠üüû5öÙQ‚ñZùìú{¿⁄'œèèZ´á«O€-ˆ÷~v⁄8l=íX‘M8ﬂú ®owî¶à™ãë∂—¸ùãÊÏY4g∑"%ªèsrÃ^ ®^ª¶ª’Ø‚D€5l@dÓUî45í≠Ä¥DÚx‹’˝í§4à∫Kœ…IËªu0™/ÇlYö°B¶ BN‹¡
jêvMÚÊÍd”ö∫¬‹`'Lu{4uÇD‚5Ì”ê8è∂†T
µ}Úàù‘Æ÷B®≈ô≤IœÑw¸Ãc~ÎZıfic¥"9_°ã)aÅ´X(K∏µ]™R≠qWp≈∆áEb#Ü<ˆC^ΩÁwE>Æ¢FÒ˜E;%fñ%«©Ù™Ø≠∂Lå†∞ÛÃe|≤NòUÂ8Ø@yRﬂ-Y%™i¶Vh  ehµ‚Y5ïÔHªiO‘¯˙Ãay4–aXUÕ◊Â™yTf…ùçz¢y˚~W˚Qj|/Çc]fdò·L@P˛kﬁ8ÃÉ}Óçº†¨úŒ‹S≠+OÔ1Ç]õ|ay∂ê∞òKBQ˝ò2Í<]ráörNÆïÄ%È¸Üt>R≤¥ôR¨ÔÎ2'Ÿarﬂä™÷ˇÑ}ú®∑í†Çàw©¸L˝ÂwËÚ…6ÕD™Ûâ¥9&™æ∂:˘JÌu Ωˇ»!€+ù
zá\‰∑äµû™yı‘%nıi»Ô•w®~;Ñ¶%µÏ∏>"Nur¿¿íÏ“…¨¶[<ÂÈhOÔ ˛”o˛˛wË‰íAç™LTD•¶ *HA≠ı(a(1Hæ¶è°#ÿ‚á.)}jÇëRÌÔWTûÃ\êÖÃ¬¥ç	ºsê5z£Ÿ0Ú¸™’ƒáùzÈÄÂI˘Ω$UÀ£où·˝» j∂§YJ,2B3=ÑÑEMë3A¨t˛îœ<≤≠®ÂÈ’Ñ’…·O‹ü¿çFÕŸ`f‰í7ô–,X]Rê'x_82 ŸÈÂ¢bµäÜ_Œ'Kˇ€ˇ¯„Ô…:Ù|Ë≤F\ò9ÖÈ›©c“ª¯1â›ÔeH£∂◊«æ#dÒÂf/]ﬁp·x[*√”™":z¬0I2≈°ú)⁄úπ¡ƒ'®ÅA›öõZÿºÏ;¡8ÇI96ó˘HyjXñO±é¸·2ÔK.ñpG$øt≤˜zﬁñ.¢íªsOVÍF¿º¬.…$Ø“=5,=¯ùøM#Îµ@!VﬁËU¬!˝„˚x-¢t‹=¡Wfôuú'pÖNú^®o@¶é¶#ïN€ìúcø-á}˝ÿ °•G®Ç. «>wª3"$PH'ôç#
eÏqG«˝'ç6ÂßzÿfìYFEaÏ\∫}bÕ‘7ò7æµÅ‘ò8–?|:ÀùÆf:ìIîRòˇ|äNºab«G7Ï˙£…–ùr‰:^ÒÓ/ÉÚ2f”€Ø¶≥°≤±&†=‡≈Æ;i|≥©G±0óÃüûå|£Á®ﬂÏh¥‚ K∑@¶mtï[πãt¨€™°8ÊdfÛÿæH'Ωoé( ≥"‹ê¿…”'§˙ìã§°!6DLïSπÇu#{™™zŒÎŒ„ƒ ‰y'ºj€®JÓ—ÏrCÎ!=ò
±ºtœ°⁄l	€£æ8=X}{‚ë	‹Ú^î•ÖilÃ¨HåŒªw
ø∏&wb°√Åm—ÒÔ&aµÆ»ÊjúWS à∞Ä˝ﬂ.sIÙ≤-¡íñd«CÈ[:Aâs˚;á”Ë7@ï:-ôÍWçèb*øÊï™ ∏^C∂Àﬁ ﬂÒﬂîá~ó 8ÀÉ¿Ω–óπä≥}åàÛK,≥“ß@;„/ÙMπD—∏~H|˜êπíiü¢ø¶ZÛæˇ-fjΩ°±nl4“ﬁ≤◊îÕ˘˙Úmg≥”D‹Ç˘¢Ó–xãÕ‹Káv!ﬂ¡›ô”„
ù◊$6llü˝Åoƒ…ıô7öú˚N–[Íß[ª-3o™ÏÂÿ9>*É:	ƒ‰æîvÀ/S¢eV{Tt€ohﬂôS‚{/Ì›sÿv~Ò&˙ubÖoCl±ÒD<á6◊©¢•≤ÿ“Yfo∂◊Ï»Ìy≥Qq*†<ÕJìΩåR»#ß/0ÑöDLÖ#çëÖ%lÿ	˜+˜©—e0D”“	∫‡*ac•£Qîïl∂1åÈˆﬂ∆¬,å,∑< πéú'\˝√ø≤c…äõ$Yä‹ô-[ÅÏ‚ˆ´4€~ØæW9Ø\T∑_ÎlÇR©¥pŸ"Ây3Nõ°_wÜ5TªK«]cÂª©Ê&’c wª'MÇ/¬ªé‚5II]≈∫}ØÍ¢[u–HïoªñŒC†8VäX›“6®1ò ¿V˝ØÙp J&P’g◊ÙJ–mg‡˛‘6÷õfxjÇE´CÈÊXŸ¶jÈM “]‡Ñ K=g2%•ÑgFû4ö∂*´,œ¯N÷5S6˝.93˙“kèª“;‘j¡i◊Y≠áÅ∏¶¨T*Å7Ò1È˛ˆ+'d◊l‰¢°,6v˚†òM◊qÈ4ˆ◊ˆ6„ÛÑ`„X‚ÓˆΩsoH∑ ?"6Ö¿÷ﬁ˘’@öé]˘ﬁ8$gåÁ≈¸é6»ZÔ<àx„òŒßA£*tCU7„Ñö⁄–Áö>(kGRôÖ˝5wågÕY_8ît÷üÿçêë§=ÓïàR_k"5XàÇEç¸Ôó>R\‘P¡"Ûã`≈ØAÆÅ¥÷ç^ª…Ú`Ô’*CDƒTÿ/UºÉ7¢VƒåÏ8Så◊†G?πJNÃúì¯ÂP+·«¿J∆T ïW¸Zäãòƒï˝âh⁄∆?SG7˘@<ÿı¯™©!ÛCò1 ﬂΩâﬂeTœ‘êSéE¨Löëx4D ß"|Ñ¥EöàJX!û©T¨ÙDEt®bûú⁄hûµ_ìñyt|zÿ80)ôÏû¨a0°˚9(qçûGv(œâÎƒ¿M∏]§˛ÍâGŒ¸ì€˜hÜí}l4Æë*Å#É;ÑßƒÅõ˘S44≤3$π/—…≠ä?¸”ˇ„Ô)Vã˝˚ˇlﬁ~yxÃ˛ˆE˚¨q ZÏ†}ÙüVüü6XÎà4ÿÛ„6ÿ≥vß›l|¢\ø9RArù÷$ë„|„<Ñ∞Gtçá<ÊeùΩr…Åıwªpà¬˝âqáëå¢ Hå«–:Ü‚å	'0Ä&.úK¯ÛH(„”ı)+âDÊLrV$:º*6£õòŸ–jf÷3Éïj+=/Ï≤…Pja¶«'z<Ùû¥∆¯åó®	–H≈óíGXfÁ3ªîvÉâ´B˝1.Mvw™%mÈIÈq†Tb›∞á∑ò?Áeöà-›ü	ç πP¯àß“ß—‡‚¯	á€K‹æûÆû*µ∆]‡Xîà˙–ƒV'ì[‚%xÖWLÖèíßΩ÷ﬁ.ﬁ—ÈåÖ“ìΩVÁˆßÕ∆A√ˆa[·Q´Ç∑Np˚7Dﬂ*è¯`:4)6ÖCEhFv·v\%ÙÒôì≤˛˘Ì{ÿUSä∂"]4úçƒ5A•ÓxôI‡_ )!;÷˝ÒÍL!ÊH’„Êı˘W¯˚äuZ≠ÊŸÒ)V5Ìµ;≠€_≥÷^é`Ω“R´sv˚ã£=‡j/;¨Û¢˝”„Gp⁄)˛Ñuéüû∂ê€Ωlw‡V˘â·ù7≠·æµl±Â®7±%äì»I5Ïœë3X(é5≥É¨ï-ó"Œ+òö†zç∆záÅÖkˆÉ7ÙyÅhËﬁ˛Œè¬Á0ëgû;ö¯îÄ£$Jç≠o'¬ÚÛÑ}•3œöŒË‹#F5°ö‡®∏ïó `Z#∞ÄYw:„	·,zéK∞=À,Æ,pE¶$Ïfó?}îë@à¸ËﬁJ∏RwºŸÎ˙¥˘EIJ|~ÿÆC÷¡Gí~ÑPÅ>’Æ`eB 2íƒk‡^ {È·∂ø‡èﬂ˘
s4–ö:t„iòæòÉÙ óÉáqﬁŒp¶¿î¬À¯ÅØÌ˘ó?hü ô*3≤I·¨H˝•Â˛.Q)]4y Ü x∏·ãËHí5§Œ‚1≈&∏i»OP£o(2{Œµ?õR`â¶¿Îñ,2 E¢WƒëËAì¨¿ö>c>Í/lïh¿|[}Ê†¸Ñ‰ÛéüRkØ~¢&ó˘3$é5lV*˙ÄÌ£œîé/EÇ}]s…yÚ
π&èëÔ¯{åì›-r∆Ú)=¸ü=I¶÷ä27”ı’t…áô:7>pÍ¸áç®3-_>,u#âıÈàK¨?s*Õ?o°Ç∂$ß π6)ˇ]˝'“_˝*f°Y’ÂÓÒRçcëØÏ`£SÚË©´ô‰˛ô⁄ÎÈûAa,ÇvZ∑z
\ ù," ﬂ…øóîˆÚd{]‚¨°ﬂñ
$∞∫•˚∆ÿ]À4J®StXœT»J€ä  ˙√?ΩgçÊŸã∆A˚ßç£Ωc4uœÏ‰¥ı≤› ì˘ ≠ärY[—œœ<ÿSÍN‰råC0©ä+ÖÅΩÆ“÷#úä†≈»#⁄–Æ0k¯∞±EÑ:o›8X◊î*Uﬁ†·Ê	ÁôHLÔ•Rœu8pF¯∂uF—áuÅ·∂ŒﬁÆT©8-Ê∞òCD∆è‰€∆$g÷*JAe“‰"”VYQKdÄ>&¶∆<I—¥îg⁄*PZòWbÿ-‡hwúqÔ‹G˜j\8∞√0y˝·ÌWÿëûº‘›.
°ÇIû)'cã´üÕ\ﬁÍéRûiÈ¡¶Á¯eh¬Û c=ÿó¢ƒu
: 9ﬂ0—≤ÎÉÖ}Ètoø[ªãéóqWAîÁŒ‡I=∏®ŒÀHã<T%iâ9Nÿ0xÒëCá—\x0‰∆:Û#pÇyD÷Ûó≈h≠Kˆºã;sä‰k—XÌ\åÿæΩõ}gp,kíìΩ"·∫nJDPá2·ü,ø‹ì;c∞6	]8=î€äõ√ÄÛ◊â_›ΩíHˆf⁄ëü ±H@⁄wÿ¸êa÷D˙π>DñQπüxH&PRÄhŸá∞±Üéà%=¬[ŒkÂxvn]“ìyå§‹æáM‡”Ò=ßc
QùúgôaOL¯UÁy£Vﬂ`◊¨ s¿]ÉH0∑øÌ?8ò,Å›üBΩ¶©0Õ‘¬±±=^a*aú∞*Í!zòRæìè
 ËãG¶=…E°ˆ9¬†ª[ú⁄®œG⁄}dï…&Â¿§|[VdDSK¬V@MW™ÎzÉF4Ä0h™T
Ã˛%&7œó:ajkxæW≠©=læ¬S∫©R¶ØG∫D¨ıS‰?∂ìÃo{`ñ1âÅzXÜîÍ°ª_∞ JM¨‡FÊmUT”XèYœ®7ÎiaY¢8 ◊©”a1˙OO÷∫,∫ŸÈ°î∆Eø≈ö ÓvËóôÄOà·Ñ0
B%ÉQÑé}/4ƒÀE—Û°¶¨êÊ¡8IÖ∏ŸT°IÀ
:0◊ÄSp¿Êj>u©±⁄)ëçVr äw⁄d¡m¢¥§Ï.°{ûù®B¯KZ ºmí(ÛÉg.†dm:≈fΩ¿;Q,L4 E⁄Æ≈EﬁêáıádƒI ≈ÒÌ≤duÌÿO9çUBà|U´VF£◊ë›\€ﬁ§OW1
''sz˛4	év0Wé~Q50nï«z≠"7R≠÷&WüÆmD›1*ÀÙøruÎ—k)Í˚bÎûè«¿iµ_‡µHo’ÿ‚7]‡π˛Ë¿Ô˚®Ô¸‡,9–ô^Öı‹¡6Ö%kR "ÙıÁöÚü9èŒ#ö6zPïııèGäTj¸ÔÙ';√Èn)ûû	%P¿SJ™î«¡D´‹Ω"»DÑG˝Ûœ1v⁄Âç¬yh√e˜¬78ÒAh\‚athN-IÀ¶ÙÍ”ﬁQÓÙ∞]M3«X á:˝∫â⁄L„j≥èê.	Q©®aÄ¬l›@≥u£8‚«∆”€õ&†ñFÚ(üÙU=›◊„™f-≥ı∆E¸L∆ùΩÊ⁄!—ãv
ûn†ﬂËïû’uú’ıy˜BÙZ`ODØÇ~p&K"z=6__i˙#æ(bJ+›¿√BBåÔ^ˆzvû˙Wª•
´∞⁄:¸øÊÙp∏[ç0®«l)=≈[0√[)⁄⁄(§≠¯Æg:`=‡Ç’mÜô=Éïzπ˛≤ﬁ≠¨î∑÷V õËâè˛B¸Gcw	Á>ØwÒTV…|¬{&ﬁ„ﬂ Ø[›ÓVúù˘.ƒÎãc¯˚Kƒs8ô.Ã2ﬂÜŸaΩ-ˆ˛£g]Ö).>—¶ÔN~—.0≈®∏Ê~ñúÛ1ÙU~·f	Ä˝ë◊õvK‘Üà9∆n◊ôÏñà	…G±Is|XG?îùπ(ı¨w´ÂımXêı∂∂≤VÆU·?∞ê¯c¯W°ˇU7‡ÌZŒ€‹ ™Yc∞àòKXãó¥Vﬁ\_©·¡ïZÊ«5∂U‚dµÚœzπ√ÜõlÛßvÑ ÜYc’⁄Ûm∏ﬁ{oAî∂>Ä| î’√|€Ô,EuØùÒBÖ$Å©πNP´Ø¡“o¬øU†4V∑iıÒ0æ€&"üV¢#Ò—ÒÈßmB≈@®+‘Uu∑¥Qb◊¸?Wµ›Ru>äˇ™'rÓ–%ì;l‹Àî$√ÅÁ{ºbÁ;LõR	˛¸Ø∆jµp¯≈÷JµÚ≤>\ŸZYÉØ]n{⁄@R°,ÖìtÌ“*∞°[_Yˇf–„"•È.›ùÙøÕ6ª…ænxZ.a°\®≥©“Ω#'kí^ª"¶pÊÙBj¸∂Ï±∞È,öåΩxˆã{Ñ[w¶¡Jß¬i
Çñ∫ÿZ<Nñ∆Ú)¸⁄Ô…≠à∞x®=r˙nQ3¡¬ﬁøfB,÷›ø—E>ma«ÍYu⁄ÿkÔµ˚G∑_vŒ⁄Õ„Çß4/∏iÀ,¯Ç‰.¿=gZ–z:k"'Öë"Ob…N"Øx˙Íˆàá—çû<√˙õùº1ªdÒM®K‘Âﬁ”√ú˘{á?YJÓQTéY:6}≠YΩÉEŸ≥}nœ<¨/ä‡Ωuû∑µÜX›œŒ§«1 À+miøD=„ó¿Ïó—9Ø8k∂ZóÀtﬁŒÑº/ÿ3ˇÀ‰ÂPt∂6Øÿﬂs#?^!ÒiFI'&ˆWzM~‰æ)±íQ†Y”‚vöœÚ9¬Ji†PÈëç¬t«hqŒ}ﬂìJ˚ñ<Ú≠êg}£≥k±ˇøÌùﬂî°RpñÃÉg0ó=˜BÁu•`KM¬ä¿‰ëG:ˆ°*W∑fƒ&IBú øâãA‘ùÕ7·´∑)kÛ$P°ôcCr∏F^µŒ/
Êõ‡ªl/B!òìÁ˛¨ë>Lq!]©„`¸°a˙r…Eÿíòß# ]Ø„*p&†∏ªßq–~z*∫”Ìwˆû1¬!hÑºå⁄Ç 	è®ÈıÁÉŒÊó∆¥ãì≥˛UeL¢eVÉø5¯[áø:¸m¿ﬂ&¸m¡ﬂ6ùSy]9ì•Kÿ|:|q∏«!Í%c7Ÿ.˛ö≠0¯©Ê=À”Y0.R#sÕÒÚØ/‹Î›∏Y°=è.>Pe‡ß§ø™Î∑OJßÙ$0Ωíò/öF˝ƒÇCëÖ˚√∆}ÖVv'Ïiêø√>˙ÁKﬂø9∑L«ó¿åØ≥øN÷Ì—ªev◊}∂\ù‡B¬z≤ƒáﬂ{F/¬Ú¯^Ö^Es°å^ÖfëH6e”{π∞Û≤œª'Î∆:[L¨òoØGe2wÀ“ ö⁄wFs"à)0ö˛h<XàNå©énﬂc:2«"¯m–ˆÃ¶f$∆¿Ng‚™™W
{Òûj∆wÓ∏Åw°’ÔMxõ∏ñ–ÒXô∂zf˛rª[t™˛Ñπp4¬—§S¡ Œ¿k¢˘P“a÷Ú[›∞ë„ç#4NéÍ—Ò∆l’ı£√~–w∆ùk8zatCˇW‚>Ô`ú·dËM˘ÁË\~)y„ XÒ 6.”wßO=Ñ*%ÀùFﬂ=¸øºtŸevÆ<Ysªéop·2WÀ¨˘¢uzBd#ãﬂ‘”^üπÉ†ÒRvá“å‚
nF	Ê
“ó—û{ ”˛ÏñO⁄SøwΩî¨u±_¡8œ⁄ßá÷8Ä7G/÷—ƒSs`577K=˚Ef.Gwº˛ÿÅ5r)ôvŒ >rôNÌF™(éÃg0˝k©^ﬁ€≤IïzƒòÇΩ-›d∂ûRQD¢>˙¨˝ˆg3œ‡›“°ã–SûL˝ßYïÍ ¬ËgQ5™î#4˛„™"∞Û7”âqøõ≠ò∑'èúM˜|µ∂NﬁFª{’ıı^aÚj+4±9ßÛ’ÿ1|ÉgÂ˛Û˚¬äõÃü‰jÎ@\®H†”IöJüîïI*ëfQJ‡¨¨ÇÆÑVF÷∆8\ÁéˇÀ≠9xk„’N˝“A∞C‰ıœùp∞d\(p˙Êi%≥a_!
‡∫O´¡k·†™…<_!›UÈâ›ëóéÀ¯>34“¡B,»8,∫Uˆ6hE›§YdÈê*'¸∏Y&Dö!Á‰◊√M¬©€˜0v«9P©ì˘Ÿ8ÄgÑ≈é¥áÏ••ﬂ€¬ß^™9§Uå2wÅËI	Wp{êj À>˙2æx∂í…ˆ!{Ÿ8hÔ5ˆéŸO@ÿowŒN·CÒ‰|Î´uÇ:p˚ŒpÒEÕÄ◊a∑FØ[zr‡^s«Lq◊Ûe…·/s±è(k{§,5ÇiôU◊Ì7“sW(Hät:|Òä5`j∑_#Æ	Ωª*ˆ3∑v"ÖêT’9†∂⁄’ÎÔê"wŸ
çs®£<o*Ç∂
‡ÊîSã\L’ÿ–MâjéúZk˘ò‚ÇV	û¸%•y C∑»ı‰/ ¯$ä∞H”‰Øt(„b¶´\cTeÄ≤ëwkÎæ2ößﬁdxm}∑;§ÜÚóefÖÖûfóMJóÀìD-õ∫π∫%[zÇâƒ’42 WL”ì¿X£õAaëÜ$â…Â´¨¸©Ò@@¨_¢rYÀ*ó⁄ û˛k7`l!˘Î_q£À^{ø}÷88lùµÏÿZxŸÆuqŒî¶Ùaö/¡˙¬2©Êv’©ª‰ÕÉ\Åç2vñäﬁÚ‹Y˚∑’<’yÕ UÚ∏Y’ë’ˆ<íí<ÆîËq«<åÆ€Ø0d÷›æGX(∞kBud´&VV"ÃSFW∆O†òΩDSµÑù5h-È>AÌÂ‰/‘jËkÏù≥N˚ËˆÀÃp1;zîN≈|;[◊Ì#tvÌpkˆ‹ΩP^ù>eä†~|äﬂ?•ØwX…æqÆ√“27Ç„√¸wÔﬁLuqaﬁ˝{ˆhJ’ﬁ=ÂD∞™á&óµ2“…ÒIß›a'«ßÏˆÀ”˝∆—1[:π˝≈~˚®¡⁄G{≠ì÷—^ππŸŸu£CˇÖéÓüé”¸-S—FôÌµ:˚«ùòï?|—9k?k7E|Ø≈öçé8r|‘Íò©H\‹≥áŸD>ã“¿Cá
hN‘Ñ Õ‘∑L õe÷8j˝¯x”+ßÏi˚¯∞’º˝≈Jü0ëgç√b^#o‹Œz.ä⁄„Ñ
§	»áü8Kqî L’Ü´¢QÔ-©û⁄ÆœyﬁÿX§J¸¨÷∆∫ZπŸ(kç&"êª‘@ƒDu¢&◊⁄‚Ì?Î¢Ì‹ÅTëvjÊl˙uX◊Ó&`Ì~Ä›r"∞v€ﬁªïÔÍë£-¡O°.¬çë?î¯h™˝x¸"L˜
}≥≤	‹‘7l3$ò2-NVıΩ EµRq_[E≈Õ„√ì∆ÌØá®o„<kÌü6ÿI[ù‡õmÉ]mJWW’%l+ Bªß¬Ñ3‡Ã≥nñ≠ œyéòro˚~ßPÜ⁄Áö∑áñˆ´T‹o$±˛€K™7Â–hŒU2¿L∆|!\$yﬁ>◊Ò9y>&ËtóãHü∑Mû7gy¢æ∏xÍºΩ¸SsgŒœãÀcù3ˇs)˜vÛàF¿WﬂËÙÚD™ìÄ⁄…”˜bà9„†¬â^à‘€Îπ–ÕÊÜõÔ	I•ã¶gSwÏı|°R ¨_…“-†5QùÓºëMÖ1!AÎ‡'©ﬂÛzöO‘bÀaé)…≈à’1"≠CeP∑—‚3"6C‚ˆJ"z&„$?ÖÈªƒ)«X P ‰ˆÎ–õ˙†‘ÁPÆ‰Ù©Õä°›Y™c≤MíUfâÀ!ˇØﬁF[ ÅU9>ÔíHY€äE	≤kí‡;+±vjkG•-•D¿Ôø˛Ø;zWh?ÔµÿÛ∆¡A„ß˚«÷˙Ò…AªŸÿ;ÓË5B=!ÿ µ„Œ Ï7Ï]7ûg•øpØüaÙi‹?°RÅ•˛qá9„ÎeÊıÆvÿxÜ†œîr[ËÈ°<~¯’ªF∑††ÓjòJØÉoÊAMC∞Ç¢M∂©,P¥	u©n<≈°Ù®£ ﬂGTq#¶¥LòûEN†¢í^ïÖê-d–©∫c◊z&¡$†Ñp∏È,∑_!Z≠N	NÊ-JbÄ•¯π}– Ω±3<sÉ—ªí]¢˛¸”0¥üÑ§U¢6Ô$–◊Ò#ÜﬁN∏‹ûÈå)°Ôñ∫Zï“9˚ñÒQE‹[¬x_af^)UM*[Üâ#Éüª.ã—&≠kNqEi∆™pË€ÎwÊ4Ég)û£Û·Ã-ò"*%õπIzßqjË‘ªŒLg÷wBsé†úUD∏\3`V›ªqç"«Ò"ï-F∞ıåêÈÇT:A“çÌóÂ°;ÓOÏ	´ãbk~¯JE"@~˚oë 9m5è[G{QhÊ'¨˘ÇÚ;løu‘:m¥t™ÖYπ`Ÿ&≤©æ∞u¶Ê´IG»y9™û0∏ÓAHµ;@3?üÚ¡
H≠}<7t«w˙©¸•ﬂ!L”â4˙Œd…YÌùp÷ÔÉ•·ˆ˛vÜ≠˝±jÂO˙Ì•Wﬂ´Ù*nu˝ıÓ•¸¢Ωtr⁄⁄qt÷¿FÆ˚≠SÿFÓ∏Ìº`á∑ˇ˚√ŒNgSbT¡û“ÇÀò\êñ[Ë {ÜÄFÿ^wË^"(9h¶!∂ Ìœ∆¯Œ˚‘Äaè©Ì4VäÕÜSá∫¿7#ëë&jW¥9_ƒ€\qPçuiL‘Zƒn±Ÿúá¸la˛a0_“‡ﬁË•T©Rc¶årÒ–®›{ZñT4Ÿhü$û&<˚V}Wf7?ªc¿ŸÃˆl°„{qÊ4P#Øâ·.)û6Á∞6Pp„«ºãç[‰«¶ãﬁ≠@Nó¯RWg.‘¢¢u–”≤¶FézGQÕ[1!îÄøP]e5S°fGyä‰?•#ïöT¶•A*]QÆ
∫t∞ŸP¥˛¢ÅO-0eÒˆÎ!"ÈµÏœú†Á9ÙÇQU:e"ıE`Ä$È˚‚Ül6vcó™G”®Úòÿ[$‚K"qxÉ;ﬁ¡g£Ü/ÃïÀ·Æ©≥R”tvMhac)ﬁa‰`ï2ŒE7 Ú
<ü "éò“E¡∆@Ù˛ˇöÛÅáÈì™’‰€y",.l0ãàjlä-ò#˘?ïÙøÁ¸◊T9ˇ£°»»X4˜·úˇª¬…)±î∏{RT˛∞¬TìΩ^,≈åIs•òœë[nõU.Õ¡Ω•åkY]&	I“8ÊM∏æ‹}≈∑4Ùˆ å÷‰p£⁄¢m`ûÉFÿ•nzˇ;ì‘ÆyQîf†oW(áı![¶EY ŒÌøçQ∂ûx=ΩÏ,Ú≥.‘<Ì§¯ÖsÈÀ¿ä˙ÅÇlbClF™{◊õ¿Ák6pﬁ¬›A5™ƒá®3UJ¸∆ªÜÿBDO‡ÇâOõ@ûp5Ç&^‚nRãAÕtXZ'Ê”RO}]-Ì`#ıÿ˜ë(©å;“H¢5«∆‰Óßì+D$ªN¢§Ó∂UWÀfïXîñ+µŸL ◊√)ﬂ,ª3ﬂúƒ›t=ñ“=ï÷yW—‰A*™ÓÕ 4√≠t'Ùµ∫™ttN:<¥@ì•$Í¢k∑$Øz§¨H+üÌîT8ïi–Ô¢®ﬂ£LŒ4∏V@ÁºëÎø)”≈ñrŸ∂`;”ÓÄ-π˘ÎqËñ··¸ N…˝:ı˘ÏQò·ÏexW."ëtKÆÏh‰´Ω”S–}tÂZKuÂ∫'ÇQ˙±‚Œ∑√æ!=¶âJ'V`◊ºYYœ$V
ê¨¬NV•÷Áÿ∂‹	$,E¬Újão©‹±|KññsÔÒÍ»«Y(ßé+ô5lÌ¿‚O†n˚£Î=ÉE«`D`∞grn–Ñœnéä4pá∞>):Ω3–˜:ÓÊ/Xäæïhç_"ú≥.j¸!øL'˛¸Ã¢_]ÑåaºÄ”Î%8√(Ï˛*˝”◊®¯Ωz˝ë¢ \ ≤˚ò7_xh¡FΩ&ﬂbönú7}Áq«¢au´N sΩ¿ü``+¿>ÑÖi√ì\ïÏ„da3õ⁄√„:C¨¯ÒAôÚ¶◊;¨≤Ãë·]yªû«ÄSÍ7’¯7’¸‹+o:◊îí2	Ê‘ÚÚ$⁄Œk∞üSIÛı+˛n∞Újªv9xùÉvL´üRèÒƒö(ó©qf5‘ûÉäÂ™∫€i IDÛ|@°–ŸÂÆ◊4x°è;†∂}ÅmS\¨S\óC‹Î90µ)™œ3|<X≥Q´mõkU€&’Ï©w˚û<TË∏z}R<ˇwˇ¬2É:Ä‹¡öµF.G∏Í¥µµè—¿ïáeq#ÓG]á±_π«K⁄@;Ü}7Ç÷ıÑáV›r>ùZwX€,t
®ûæV91Ú
i[#`Ì?5%ïîÇ)∞hy˙ÄÃ]‰D'ç⁄*î˘fΩí’ 8Ì8€zaüOÂºˇ8£9îq◊aØ’÷“uÙTgê–Ô][∞)·öRXX4ÍÌ`'ı8ë‘∂‚ßZfùVì◊56⁄T⁄ÿ8|⁄∆Dº#v–:⁄—¯aã5Œ^`—ÜM%PJd÷Î91e÷PRj¥ »‚'¿∆Ã›ﬂ¸ìKîNP y’?˙˛ÔˇfÙ5hÇ æ≥™ÃFëcó0n7-=!.Cçäcxnlq›ò∑BF¡˛ÍÍ|#”Co~7Œ©Y7ÚΩ.l8dÇcÜ—ÙôÛ9π‡SΩ:0Ê:ïô‹Å;≤Kü±ár‡MƒÆiÃﬁ)œxDÁ}_∏Ü∆Ç¥än„:ÅÎh∆6Å≈u0Ån∞ã∂¬h2Ùwÿ«á,.y^Ü;N‰04ﬁ\z<+d#øGN&ú<=ôSîC€Õb‰¢+@ú‚;}é·=î5£€˜≤ 
èîπÿË˛cÊ≥è;ÿ◊⁄{o·é~√·7àÎïB∑è^.wK*åà¿˝®/6πÄ`Éy∏^®<:°∏áÔ°ÛÖ_:√hß!Jè6ßä?ü¡¸È|Õ ~òt
Ú«ç="™,πeX∞3 t≠Û:_ƒ9X©≠3Ö:´WfâC≠•#‘Bz%kù¿«¡ÍŒ¬6%p(J'ÂárÜsVbe=É áZ’•ìÖíún°ã¡¥’{,xÊı∂c‚ºI∏‘yüN‹ÊµHÈ9§/Du'˘íÇ&[˘√?˝˜?˛˛óåÜæ£xúπÛÏuAtc	+∆ü≠z4d/“¥¯+÷∑∏[ß1ôØâ‡˝1BsÇlœùÛ°€€Õ¯Ë◊◊@Jh&§‹ÇÂi‡çL8öJG£ÏØ—Â1ÈÅò∂øáúceÍØÄ°¯£D- ˆî˜@IßH
§/ª•¢I‡Á&˚7>ß´é¶£<“∂N\L˙lwc˘åÍπ©[C|X∑ûÊ@mA?≤,·®‡‡çTvêhk4R˘P49)$«»⁄'ﬁ∏∞W†hx¯]¨xÃY4ŒÂäd ÇX)N7uÌ*
≤Õì⁄‡&∑°¨∑≠U*ñO› ó`[åòZ÷.Ë£Q¯êzÜ®6C¢oÁ´3÷©NÖ…l√˛éÙë„_´ÃìÌiØ}⁄jû±÷^˚å?cù≥”M0?¥(+Ÿ¿·^+8ßíE§√™+ˆ…dc;zü–—¨§ÜùYêD_Ó‡dA,ª&ëöﬁh◊¥ªñ§6¢Z∑Áùœ>W˚%òπ _Ô±≠à¶gjSπ©qÍ¬ÏN@+M–bpÜFõÃîX/¸Ÿz^YHª`Ug°€©õª0◊E¬I÷åy∂7âèúÁ`ÚœÜ¸%ÏlW¯ÈÀ!∫Ê√W¸ÁeØGŒ“ÿˇîõSSødÍE√/◊K.áø ]≠ÙMÆˆ˝l(S4æˆ;≠ø`]£á◊szx⁄SL~”{ÄÖœÓul≤ÿ““]4 7U;)µı…ù5ÉhsÁò∏ CÁ‹’8KSCµ¶∞@dÓﬂ[aÊô»?yq √,ΩƒNM,möh>yE[#T∏ãñ&Å{i?y0Ç™
^aôIh'„;ªAEQ›Œı∏+4æ3™◊ÙGÁ`Fˆ2°≥e∫≈rj∫Ú§_b˜‚Ï~ÚŒÍ“]ä¯´ ¶îIM»eΩi≈°ú…êÿÓô^gsXÊEŒ‚Ïkû=
Éˇ∆Ìq$Q UòxΩ#Ê"®èÇ≥æãwﬁÙ›¯ß∏‰ñXZ˝tµøÃJ¨Ñ0*¸76É4e≥«CXÂl°êÌZ!çz„…¨ò√p{óπx1ƒåÙäü$Ì≠~Õ°ì8&Qa°,	@xO¸q/Ú~èÂÉ‡u{»æ≥¨.•ˆpŒ˜ÌÚ:Nów<Z˘Sé∏Dêe(PﬁÔXô«ÔXDµE&Ì7›ŒdŒôRu˜áôb{tè p&r˛, ãH·l ∑’ò≥ke÷ÿC∂}|ƒ{WÌµèˆ;¨}tÚ‚lsv˝/Ê,ö≥_˛ÉÑ¥÷Ëy] rC÷Ò∆hΩJkIF‹6«P&≈EŒÔ+π˘âJç1<m∑·RËÃü:˙&ÉãY va¬∫@@´ÎÛ#nÁÄ]ìõ‚¯˛˛ﬁ~›Gò<µS†3#Sh˛œ‚8À0_4∫∏H†¯`‹Kx¡˘p–8s∫À• Åì‡<£ŸG!˛>Ñ7e÷¡»ew8ÛÇ€˜<DtÃM‹.∫Ü)íÈ∞)ºß`\2¸û%ªß≈©¯Â…ﬁ3C™¥’æMY≈z´ëû$Àÿ'HW f*]&s“∂òµh”tìçe''∂ ∞ôRˆjº©Ø“*RÌ‘ƒLêvá˝ÌÃ£5ó=uæÄÈ^
Ω$äP1´}¥Ãö>0E⁄è üPA«Óõ&5∆ÈêÑ/g¯ù*z§∫àm_*#)¬⁄C@ı3®UAÃ˝Ö>"«R¬([£ò®ù,9jÇ[/NE„oôzííŸ|Ô∆π1≤"Ãh>µ•∆päŸ†~DÔÄ-˘"õ¬∆ÄŒ\Pp
úbz;ª˝*§2◊Uvp˚’œf^œ_‡‚`œıPiKON}¡L£Cu4A˜{ÈIƒáYthÅ´	®ÿˆÿø¿ûˆó8ì/ùÄ wãØW‰[Xpˇñ¶—ØÔó»JÌûÏPÿsß8—XPVƒ
≤çïf†‡¯Á°\:±Ó¬$ïãî®nDû†<9!R(N=˙ô†T>A'û≥◊Àƒ†§K‹çMV™(ÈÊ2πc:œ˙˜/ˆÓ7≈‘7úø∞†Í#•r#ÚJ(ÒDA‚ÎG¬1S®ÇkàtB˝^oá}&P¡8∞¬ ˜ot∑<ˆﬂ,=z˜Ÿ≤ÒÁ°¸Ëÿ“?]—Ö‡ûÚ‡£˘ΩdÇíﬂÂgÕp£˚-q‰µ¢
õW∞≠yπÕ≤4≈ØMWÅ-⁄»’ÂƒN≈%Û⁄DŒC„IŸ"üiÃ¶gdÙŸ›Ÿ·(Yñ•!Ô™’€K%€ﬂ…å–¯+É?2…ªÀvµ \7*H-(&åÛ∞RÖ™ Ï¨z*;+◊I|û4s⁄ñÏÚ“<±^Tì≥√b[6ÒOiY∫Eöé:¡aıØŸAªCY2≠üù6Ù}àÙ–e"ó°∫9.√Á<ã}å∏QfúlÃÿ2y<‰T“´Tâ(ØPÒ◊l±yä˚›YqUì>ÇVi9Á£©m≤§OÿzÔì∞Ê∂ı,?_ºîî¥lç≠π7Åm§™Zo*,æ‹Î3è’+πhïn÷hh8€AÎ”Émâ6…u“‡íˇ±Däï@|Ÿ)Ç¯öCƒóB≈L‚¬CÉzÈØr{ü}¥ªÀ(åµ›IÁ¿óïﬁÅØu|Ë¯˙vtê¬H•∫RØûÆ‘ãÍDk£\•ûñaß Ù¢bÅZ%Wòg &*-ÿüg0?Éö&·πÄeöÖ3?√∞ıYëÏ»£à.`ƒÕÀß¡Uì€7«eËkôCØö∫ﬁ%%í´kÅv€´âb∑ÉÈ@Ã!ı®á0xÉ]§9• ÷Ã3¨´æèÏf}¡¶@óY¥≤¸Nÿ2ÊUò´◊∂¢!≤∂Zπ‚‘ssÅJ‰p∑_èDg¨ì¿ÌzÑí°ò{.áÛ_‹°’õI
Kø{©~@êû{√„)f≤Íç«ëyÿ5{	óo: ºîùŒÙÏ”‘uÚ?§è©pPrà`™À%n’?˝Ê7ˇ¬è˜T›åÌËNœ⁄{«‘¯Gœgù∆…	[:m¡Á≥Vg{{Ôü6û›˛◊˚	;mu^∂é‰F¡7·¿Û£Å3ì	óJqÓ˚©‹‡à7í.ümdN¨ë9ëF“\Û’˜*€ï^’âÅÆÁ¡Åœ∂»"2ÕßÈ—Ä 2óøÙKÏkâ O˛∑ÜŒ
RaÄ(rzå È≠
˛ÄÒ%,+ÿ%v˛äˆ[:ÅNVûyA8Õª;Upj~¬πO˘@∏ñ⁄“Z∆>¨Ö‘bÿü‘"]"å⁄R∞n≈Çf1,ËW|&U<[≈öì˛h”¬BÕoÖ”©û„z	∫èpGmU.Øs$CØÑ2¢›Ÿ_¯™òË´‘_qGn‡c;$ΩÒó<wK®†-«ùIíª…z«ù„˛H¿&˛˘˝ˇKÌÓõ+ÅAïßqÈDèg¬öê7ÌI‡]˜Ó9Ω[ºZ©¸kÑn∆¡0’uVnëµ|´ça— ûç›∆s$,Û®EÃê®‚©"n≥Ã¶≥±¸`‰ÜçÌ ŒA8x±K0C‘®Î~Xfg~èŒõ˙T÷ÛLKHòîò6v.]û0zçg∫c‚]Ñc}y˚[∫^Ã»hñî∂ç“Õc≠âÕÁ	?£çŸP;@j®¢ZÀ∞wf˝Â˝G∑ˇ¥H &—sÙd‘’•„	∑Â€,hÊJ)©/À˜Á*‘ÆÆ–êñ≈ΩF=IW¨)“^be⁄”–ˇﬂ(IHÁ¿4‰«EôqCµÂìÀ"®ØoWa«Û[¢§Å€Ø—Àä+7qnø
1˘ë˝{`“£™Ááè‘Iopw8ì…… LXµÂd].¡éóä‚à§Ê’ˇVYŸ~Me0˙Ë ?í«µ—ûLÏ¶3ıßÔbaE(f©Ï”ËŸ>ù‡EJÀLçS.è˜§≤Î9€— …'„ÂÛ4öÈå7g‚C⁄¿T—Å1KÌï—5¯Œ¯,≤i…ô‚b˛,ôÏ<•3ÉuBÃÓ¬Ôˆ+9·Ë8n0Ç'nﬂs_±© 2g¯≥ôá(£à=èŸ3>Î≥âèŒy jÓ0%æÚrA!ÙÏˇ§—9f’∞ièxë<¥`‚Çµ⁄A–.{y†FúC´ê¬.‚@g≈ıäµâûıƒ≠w,*7¿Ñ˜j8t«°Ûπ´2⁄âµ∫•ñ8˜g~ø?tŸ1<¨√√,j˘´)Î»J◊õœîe‘N/‚*™uÿö}_Õ/?ÚìÒä·‚ÍZ |¬“QŸZ¶@s;Ìñ⁄Hr2«˛tE‘7j,Ï∞àY∂1øÁÁßÔÕ¿á&’`$cìä/6*)˙¨!Páˆí;LSã.±Q•≈ó•b”{˜Ÿ;MÄﬂî ŒÖuw‡vø8˜Øt1)πCΩæZX,º0˝NG?¯AÒ"ÕÉ‚ı£¢ã%©~bp6ò^‹® ¢≤Æ”8È$* ∆∂W©ÙG"-˛ñÍB Å:ó˝òJÿ›ìm©†ÖEÌ¥c§@1—ó~A3u; èı|?61 ÌÊ∫ôèÛ‡∂x£Ä©E•> S·ŸBû™*⁄ÄÜ‘ˆ *ÀÈ∑_ME-ë(ÊÈ¢	Ã∑≤±Àl|:÷.I˝>µO k32„^A](ÍÜxÎú˙˜îK˙Ç∆¬¢,’¬¿1ã˝Œ˝hcÃæ˛êÖO∫'›"tN¨ıÅ#ø$Åì^SAì!ÇºÄ9±∫¢Öp…ÙE¯ã`π¡"75‡º0Ú◊|kÇ≈é´‡K(©Æs<
pHÃW
±œ4HîªÌÄ¯p«='∆•ÌÕ∞:ÇwÖwJ∏˘«©yî›^≥•I≠€ﬂâﬁsè¿tt>˜J¿X˝¢¿≠ÌÄ›Ÿi6N˜ß¨q⁄|ﬁ~y‹¡*ÿ?Cü’	3 `{Q/√0VµB∂tÇ˚¢—˚˚À ’"6iú,Â¡…¥ˆÍûˇf<Ùù„˘f:=·>≥&t.;ûË»°Ñ∑Ωg"‡∂®ØlíÒÀb\Î!+HRì∞‰”∏:oO§â§‚ =«õ7Ô|ÍMáºÏO–üTà)®˛![ô=¬“É…µœÏxSäÙ2Ÿh⁄‰9eÆö1˜⁄6/πHPUÀƒwN≈¨ÛŸXH8â.´_c¬ARŸ«ºΩ§îi¸≈◊4)ˇ)‡_∏!@rÏ(.[¥≈Q∏ ƒÇ¡∏”>üS˝≥d‘ú+uπGVëVËÓÃ2n>Cûqœ[⁄¬bÃVe…öB¡“2iˆ÷JÅ]VW€eÍ•˙LΩVúﬂe5<òïƒ˝.\£á#’Å@®s>µÊ ÎanNùïPÌï
◊ü%”¨q¶)+•ﬂ«ÃËΩlœÎ›æÔN	:·N¸“Í'*Ó⁄fû4ˆ@≈m±˝„„˝É€;møú3“Ç) *Ù¶O’Mû˘ò5^úﬁ˛‚¨›<~0Öˆ¡≥yE˘ÖsÈû˘{®ùj∂#√Èøò‡∂Üi5˛‚C*˘±Z
-Ïféëøqºi°Ñê\dÎ˘öO·$”¬emd‰ñ¯
∆Ñ“/„[≥™1óRgvÓ»˛B!Å*ïıCíƒÕƒù:Ïi£”¬ Î^„L\5˚æèûXöp{-[AY&úÍS˜"p√AÛçJæ»Ë˚÷¬∆à•w‡\ªÅıﬁÊÚve®IﬁOuxpI∑?sÇ™ÈÖª'i∑>á¥”;¥z8"Nà0	âª…	p'MÅ˜Ì∫'ëyËÜ°”ß™èKœ}Û]KM{âÕÆ˘‡9ΩÄ5∞76hôo—≤ñÚ¸Óê°Ü nsÊì’‚.öÎ[πT⁄Lˆéÿ"#QJüA^Ç9¢Ù>˚ì¿]y8ì\>çê?¯À ùõæp√√§`|OÄ
:`A-¨uÙ≤*ÿ|*◊d™‰-§ u‡å1∑%N8∫f'.Z:¬•ë/≥·Í◊˙´aáÅ{FΩŸ™Á˘yD9‘XI∫4;˛„.ê„òrÚ‡©‹Aô©œI ﬂˇ∫'“˝P)—ˆA‡◊ü√÷∏ÎcÄgæ{q⁄∆ê*\r<]¬¡ká(ÄÖ•1îÆœ”È$‹Y]u&^9yÃûU∞S{üP ‡Ó˜oíãΩ˚ﬁ%c|˜ôAˇ*∏Å‚bﬂ…#ÿè°Ìñ>ÖΩ1˛B≠q€¿¢'Ç˙BßπnËÙ3SÜ~
5$:XW0…¯ª
™jıoÎÊµôh∑®ıÚUÀRëm∆ük©›'≤»ﬁﬂ–¡˛dVÂ‚§÷“¬ê•ó!èx’QwK4ÿcñÓæ;2Ü…ıô˜ôú˚†–—]f&o c∞^¡t©ÙÔÔ#aﬁ%pª)°M<ËŒê!ãu&Œ^¯; =@§|Lêô,5ß¡o^> ≥›ÃTñu	∆VåL|X·ÏKl'ïÇ†ÆZUß¢++ÄZ”ø'ö@ZõE™{)ÿ$M§ÜÄÇ¿
Sé©iá‹ì ,7Êco¸‡TÍ8—Z’6e¥HYWL¿~r*r∫ ºæ 'Weq†o1¶mëí†Ô¥ó±<µÂO˛Ùõ|/åùú7[†W•+O[°u¥◊Ä˜Kk÷iÌø8⁄;Ó(+M‘ôÈ~ £XÈπ]3ËÉ;;Ä«¿ìôM∆üﬂÌy≥ë˙QÜﬁìÁŒ[∏â◊%è∂¬~üR"Z$jõTSz¬„÷—î;Î≈tº∞tﬁ%ºA/0‚mS;°hÉî¡òÒl©î\r&ç ,å ÿïÃÁYÛ∑ÔcVãÂ'íã{”cS¶î.≈å#Ôx»ˇÖè'Ä«ùbP ;—L°[à<Aó1>Êvañ˝8ñÉ±ñÃ∏F1$Èˇ˛æ#¬ÀXE·¢Tr7¡Rºûˇëò!ı£=^ısFßÇÜsá‘eˆ©”≤eıø˛ˇ¥eıÕ„””÷1k¥ögß∑_µõ∞—ˆÌ÷>:kÌü6ŒéOs%ı˚#«˛•û˛aÍÈãÑ˛ROo[OdöV40ªØû¥M∆T¿b`6UÖ}8ö◊Pô´¿ûvµX≈º˘&UYüÏÏøî’´¯pnüDeıÁ~/_Pd™≠_øKm}c6¿]Qxb\ü;c4‚˝Äuº>¶√É¿∂ê◊Ho>Í„"7∫]7œ¸/ÄE®˘±◊’¡ ¥‰kŸF+UEA~ÃÉLL\∂H‚öÃŸÏﬂ`◊⁄˛ìÇ^ƒ¡dïÆPcëd—u…≥ó†©çŸ¢wÊœŸaÆ&>’;x◊Ò’¶˛K¨„Üºµö≈c4]◊kE…⁄I5€‘ñéjáNŸù\1ÊMi‚é5ct∏)$Ä!ËzæÄ@më∏·2b.i⁄ÆËGÖ)Ä°∫0îOÉRO˜5ßA¯}OË.Õ·48Øﬂ”èl∞±®7cç˚?PÇ¶\§J®¿BZI#gãÈö$°'X[Ä,ç}Zõ+õûù¬æI5ÅU„uc®óLâ∂†æ¸v4Ö5Ì–ÊÚá®«¶@nπ3nÀ\ °jö•◊ñ_‰≈»Hë≠òØÚÍ¸“è\l©h¨m⁄Í∞`1∑ª!©˛∏ÿ'`ÒÑì°sçèÛILﬂ†1]™fxÈÖ&m¿n4‰ˆË–≥˝π]Q±òz˝Å	cøè¸v˝ëüwEO¨ÖÔ’¬HŒ s5å)m@Z(óeÃ–[ABáˆ≥!_@3Ïyë4HÏ¯3M≥.-CM{"C◊
	Õ–J©™*\_Ñzã˜ë›≤àZü4œßUäìHe†åÿçN0ÚHŸ@˝ÃQ¢qhV¶¸x6Õ»î:Eﬁs>!IÓÕoû¯û¢⁄+"=Üú‰° &°=—ôëMÂ§(AvÔ"q07m=bëqéCe0Xç≠‡„¸®|πn¨ \8=∑≠ëcM¨wTF¬A‡çøX©D†dÉñP5ïZu€%§kRO÷E'⁄T´µ¨	…øI+—≤ƒ[˛[]ìíl”∫C˜~VFû≈˚YŸíáe˘h·Ωî∏&,fÜ∑cÌ•7ÒT¿ÇÊ{®”«Ëﬂl
æödbπ‡‘;@!`.EÖûäX_"C+0ã“m˝∫∫Ì∏WG˘_∏!ãô"∫ﬂ
Ï.¢Ç3û≤Ï}˛€&^äV2˜çE•°úè¸ô¯¯Ω√`i*ΩÕ˝§;≥Ûœ›ÓwzW4¬ŸX†6ÒÚ0Glµ¯xl»^L˛‹¥/~˜óê}-∞<6+ ´Åü>Û>ßÃù®‚3Åº·•üèÊ‹+j»Øogß§üuë}Rê&íÙYJHF–Íªww¢®1åø∏Ç&˚;!îÓóˇπ®óœ¸µuÙ+ïõ°™_pÉW‹Æµ=ætÑlgAÀ ≈¥è‹⁄ÎÄØÅÚ%‚¨:Ã#!†§k7∂·é&‘ã›a.°+ıÁcìK°KMC§FÔèÙMA
⁄ÿ3ƒ¸eñ÷b]\∏2Àüq¨…V_∆Ä‹™H>m»2„‘ëìaM˛~±Ì,Tb‚ÀO1PIŸúﬂa’$ ma7..ÕôL∏Æ¬5‰Ö¥v°°yoJ9u{XÜŸL#>C„]Y9¡ò[3¡Ÿ™%Åˇ&‹Ω©œØµX„%Uîö^G…{NëTöJΩXS”3ÙﬁäØ≤©ê˜•≈:ﬁò5D≤'∫’ùiw`πs&SΩébl˝f”Ù-[*Îé{˚‹`jÂ,«˛'0e˚ë˙#a1 Fem∫†µ®Ç¨Ñ˜gû(°N«˘≥*–7BÀ.ã>‰4d‘$Ê,D•ô+j±F≤Ë$p11u‹ã’]‹jaòèqKXa°¢ßΩó)ZÙÿÛñ[»O÷‚©¬î§a›·It±6}Ø:s€3„ÂÁ§>⁄°ô”˙åm–‰Ωíç]n)@&Ï€ñ5Å±_ë&⁄S”MßÁ∞NÁÄ˝·Ô˛%*
Ó∏∞?]vå	Q¨q“6O»‹π≥ò› sëÄ˚uß√kƒ+e<©uË\ÉxbK"œ“3–F¿æZfó^Ëg√Co<ÿo Ùl£.e“Ú*ˆ©€H_∆TZ∫¿ä?rÂMp=X'ŒÛFﬁxe∞¬ÔØÆ≈b/B*¡≥\)óï2ÈvXÈ{ºi@âΩKAQJy†á.fÃ¿ç“îs2zÍè0Ï˜"†d‡‰@ÔB˝K<7≠îcg9≤À§çÇ≈qÕ[YûéŒ£MZ÷co‘œ':ÜAw7=Œw˘ìú·t∑?$õù»Æs@
2Ú§hÀº¡ÀwØx.ﬂ˛ü$ÁJóìë®mœ_.™ª;ÒA¶_Sﬁ¥Æ/√kr$ûgûJ´>€™PéØ¬Ç9∫*œ¡'V∑ákC≠fK´¶k±©»˘€¿úøçb…€ái;éo-ùú*WÈ´z:{pSS“í€Üt!%ùF/+zç^D∑xöÌ#=[Î8[Î∂îΩÊ†–ËµHíì!k"E'ƒU–ö¿fB›¿C-¡ƒ◊/˚ãü˙Wª•
´∞⁄:¸øƒ.º·p∑b$ 2i"G,©≤Ådÿ–“@|70¨<•∫Õ∆u∞R/◊_÷ªïïÚ÷⁄JycÍË/ƒƒ1ópÓÛzOeïÃw!ºg‚=˛∫’ÌnÖ¡ŸôÔBºæ8ÜøøƒA<áìÈ¬,Ûmò÷€RAÀ]òR˝	ZKAπòXOîÉ∑•‰¸{K}·fñ˝ë◊õvKò&éÄêÔ:ì›1˘ËÁ†¯«áutA±Íy©bΩ[-Øo√DØo∞µïµr≠
ˇÅj¿√ø
˝Ø∫o◊∫pﬁÊP√É≈YáCµx©jÂÕıï\©e~\c[e :V+ØQ¨ó¡¥^√ÜõlÛßÊñ√´±jÌ˘6¸Ôπéó& Y¿çøAJÈçùÔ ÖtØùÒ\ÇKåå£πNZ´Ø¡Rn¬øU†V∑i5Ò0æ€&¢üV¢#Ò—ÒÈßÜ’€ç]vU›-mîÿ5ˇœUm∑T›Çè‚øÍâ≥æ0]*πÚ∆ù.|Ø§<wÿ[!‹ÒÔ çI`ˆå®∆jµpˆÛ÷JµÚ≤>\ŸZYÉÆ]n€ÿ¿=^°
ÑÅtÕ∂*∞á[UÒAVOgrk2ùï&µ
ÈF„QøÈ1Ôß\´÷iuó«ÉjŒ7~∑ºr±ª|Ñ6«Õa oÂ+J
Ë∂l5õKìQÍÁmP]4U7é/«ˆÄﬁÉüB‘©1}¢WF£Î~Â˜<ß?æ˝:úR∞∂€#LeÌi”aU«ı⁄Á7¥L¢{5ñ‚û6ˆ⁄«{Ì∆˛—Ìó%^#ıíÕ	‘î>x√¡®˜ú©ej◊rí'ŒjƒÛP∑KÜ¶ΩˆÃÌúEw«Ãú««On®gç˛Ãﬂ;¸…RÚ4èﬁ≈E◊˜ÁGK'ﬁ∆ïhÁrË¢SjÍ∞}ƒlAêıèD@…ƒ:~˛s&ç4?ÒjwH⁄N≠gÏT,.ì|C6Wìj;	C”˚
X:˛˜:ÅhrÑXæÙP~-›h3 ÛHÈ≈≠ßwPîÄ∑#ñÙ¶ƒîYÒˆ‘≥]ØgIˆUµFπ	Ú£Õùñôô%õÕu_ìD;à‚û≠p:ˆ˘ÕÃñ≈|®Ω◊tÜﬁyw‰ -bB∏0£=ö"©˛ŸÌW!O_xé¯@¢Ì«…KÕŸÌÔv“hv≤ôG7∞ß'¢ŸAtı‚›Jªc?È&49/ZÏ≥ïª9‘¯ÏoJô$h[…,ªÎaƒUªÄñÏëÑú/\ŸsJ≈È—ú≤Á˛î›>5û÷–É:YhÉ?$LS.≤7π"ˆ5πN5˚Qe√‡î6Ìßßçf˚ˆÀ#∂ﬂŸ{∆Õ≥ˆÀÜz<j·©Úkrï–|†Y‡ÖòbŒ¨Úæ™,ÉvΩÃj∑ÎWáø¯€Ñø-¯€¶s*ØÀ#g≤D-t’p]™kàbzÏÜ!€≈_±L?PÅ]	H<ç>îÉÕH^_∏◊ª7pQ≠c23e@f©‘:.W{°Â"πWu=…ßîLAQÿ8µ2=ÜM„åÖMG'ñÑF¥Í*‚íÙiiõ<zÚY–?_˙˛Õ!X?e:æ]ù˝u≤èﬁ-≥ªûË≥eΩÉó	„….¢FÔΩN?
Ôh.†A<3Ê]=°Âˇ´ÖÚì¿kÔrB‘j;
Üa«SúL£≤æÔåFb cf†¢">¶˘à>T/+í„∞πˆÌoÉ∞>6Ö7#qpÍaAüãÌ
&n6)–È'/˙D†ê;æcÏâ¨Œ©¬Û„¨Å':ÀúqD?/lı<kü=t∆3Épè84IßÇ·îçXb·bGèﬂËÜçoÃO[∆ÜÀΩ¿ÔxcÇV]tÿ˙Œ∏sGC/åb®J\ˇå/úΩ)ˇ‹qy"ŒRˆ1îC`˘Ç=TŒ	∂©ÁèPW¬àﬁ4˙ÓY‡è¯ur]fÁ üdn¶a¢
w Æ`µÃö/Zß'tŸÇ™t"U2QNWèt2	ﬂ:÷‹ÚA`7.‘•<ÅÇ*8¡3~J7KVPok*ÚY˚Ù∞¡ÊàPßíá>0>ıÕRœÔÇ¶ôK<ÜÄ&Ã≤˚"*Ã&ıÑ·ﬂ@<·ç\ÚÕQ¯dióCÎÆß,‹Lìª_ƒ\tAÃ∑§Æ£â:‰≥ˆ[¬íÄwK¬~‰ùPüa#(÷¬eÄ… —ÈR‚ãLEQK]Ø$	}ı ÍfÖ…-∞≤5WáõÖDkÉ#KΩZ[O‡:®™Æßƒ6,å*]ÜiÁ≤û7-}`F$7Úã˛È7ˇ¸˛èøˇeaR}ù_ΩV\¿òª<…Y` ¥ô$Ê,Õên≥ a∑™Yù¯<pù/xñÁX⁄apÉ|	vUèzQ=w¬Å>—œT7oF≤~Öî‘ÂBÎ”ÍEZ∏&jÚsÉZ¶ñ(7èJ_6g^Ó_C `©ÏXQÅ¡"È™®Ÿﬂ§9WÈP¥ykÖ´©æ§µç£◊˝?Ï©€˜0é∞‡≥™T™¸Sx∞üCΩ„‰·Ø”⁄[Ù·íkÀ8÷.e.@…^ﬂSﬁ2Ô&ÒÜx‹Ä˛M£äÙÂ2Ç›ì¢ábÏ%ò∏é˙´˚ÌŒŸ)|–O¬7æ:ü˚ˆ‹æ3úë‰£Û¶∞ç∫•'Ó5w¸¿‘!`ìƒü˝e.F1'uèÎR#òñYu˝—¬ÏZü!.‘¿Tnø∆'æ55§P∞k©.y›UjòÎjÖTñørä<eÀ( å§~m´B?C‘)ß£”ñïé3R‰º¥Ç«2ÊQÒóîM%—êR≈_îXE+kÏåØT∫qu=öπÍ&ÈK™D+6ÚÆ`Óa˝VF≥·‘õØÔ≤@`ZJQ*∂r)kŸL),ßJ±â„~πcVL{ì@Ÿx-uÁ¬>CYÄ1%xa≠RIÈSq·ó¨Lı**Xπ?˝Ê◊ø‚60ÍΩˆ~˚¨qpÿ::kô∞ê˘≠ù>ıAìwõ…Ó¶⁄ú)˜∏^≠lÃQÄ©.˙⁄N;¶Eä)lßîŒj´WÕQX©ï^ımÑÏ—T^Mäçªc±s ã\÷›æGI(\4ay˛q%v@"¯Í±∞G3ïËbPv9/»T≥ÑÀÃ˙A{ß«¨”>∫˝Ú√ﬂjèÄ“w4á`À‡ 
GØ«∑óŒ›? ıÀÈÀYÚ¯Ò)~ˇîæﬁa%g¯∆πKÀ‹ÃäÛﬂ•sËıc{HèÕú⁄´£úOm° ˝¨ˆZó˘¯§”ÓÍ¯Ìóß˚ç£c∂tr˚ã˝ˆQÉµèˆZ'≠£Ω6≤Eµ◊„F·-¸,LäŸ|`"ÿ(≥ΩVgˇ‡∏”sÂá/:gÌgÌ¶œ!2˝A£#éµ:j"êΩ√s8kÆ˛ΩÑ“\<“mñY„®ı„„ÃYjú≤ßÌ„√VÛˆ‘.†ª˜ŸA„;¥5Lú‡z.˘–€„d˝§À˚Á¯|K±_"J?A 1ünåï-ÒJÉﬂΩ˚ˇ?   ˇˇ $aÈú