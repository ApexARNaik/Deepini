"use client";

import { useState, useMemo, useEffect } from "react";
import { ComponentWithTotals, isPersonalItem } from "@/lib/api";
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Bot, 
  FileText, 
  Code, 
  FileSpreadsheet,
  Package,
  Wrench,
  ShoppingCart,
  Layers,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export type ExportPromptTemplate = "projects" | "purchases" | "all_in_one" | "raw";
export type ExportFormat = "markdown" | "text" | "json" | "csv";
export type ExportScope = "components" | "current_view" | "all";
export type ExportStockFilter = "in_stock" | "all";

interface ExportInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: ComponentWithTotals[];
  currentViewMode?: "components" | "personal";
}

function extractSpecs(customFields: Record<string, unknown> | undefined): Record<string, string> {
  if (!customFields) return {};
  const specs: Record<string, string> = {};
  for (const [key, val] of Object.entries(customFields)) {
    if (key === "item_type") continue;
    if (val === null || val === undefined) continue;
    if (typeof val === "object" && val !== null) {
      const obj = val as { type?: string; value?: unknown };
      if (obj.type === "image" || obj.type === "file") continue;
      if (obj.value !== undefined && obj.value !== null && String(obj.value).trim() !== "") {
        specs[key] = String(obj.value).trim();
      }
    } else if (String(val).trim() !== "") {
      specs[key] = String(val).trim();
    }
  }
  return specs;
}

export function ExportInventoryModal({
  isOpen,
  onClose,
  components,
  currentViewMode = "components"
}: ExportInventoryModalProps) {
  const [promptTemplate, setPromptTemplate] = useState<ExportPromptTemplate>("all_in_one");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>("components");
  const [stockFilter, setStockFilter] = useState<ExportStockFilter>("in_stock");
  
  const [includeSpecs, setIncludeSpecs] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeDatasheets, setIncludeDatasheets] = useState(true);
  const [includeLocations, setIncludeLocations] = useState(false);

  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter items
  const filteredComponents = useMemo(() => {
    return components.filter((item) => {
      // Scope filter
      if (scope === "components" && isPersonalItem(item)) return false;
      if (scope === "current_view") {
        if (currentViewMode === "components" && isPersonalItem(item)) return false;
        if (currentViewMode === "personal" && !isPersonalItem(item)) return false;
      }
      // Stock filter
      if (stockFilter === "in_stock") {
        const inStorage = item.totals?.in_storage_qty ?? 0;
        if (inStorage <= 0) return false;
      }
      return true;
    });
  }, [components, scope, currentViewMode, stockFilter]);

  // Total quantity in storage
  const totalUnits = useMemo(() => {
    return filteredComponents.reduce((acc, c) => acc + (c.totals?.in_storage_qty ?? 0), 0);
  }, [filteredComponents]);

  // Generate output text/content
  const generatedContent = useMemo(() => {
    const timestamp = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    // 1. JSON Format
    if (exportFormat === "json") {
      interface JsonExportItem {
        name: string;
        in_storage_qty: number;
        checked_out_qty: number;
        total_owned_qty: number;
        tags: string[];
        specifications?: Record<string, string>;
        notes?: string;
        datasheet_url?: string;
        storage_locations?: { quantity: number; location: string }[];
      }

      interface JsonExportPayload {
        title: string;
        export_date: string;
        ai_prompt?: string;
        summary: {
          total_distinct_items: number;
          total_units_in_storage: number;
          filtered_stock_only: boolean;
        };
        inventory: JsonExportItem[];
      }

      const payload: JsonExportPayload = {
        title: "Hardware Inventory Export for AI Assistant",
        export_date: timestamp,
        summary: {
          total_distinct_items: filteredComponents.length,
          total_units_in_storage: totalUnits,
          filtered_stock_only: stockFilter === "in_stock"
        },
        inventory: []
      };

      if (promptTemplate === "projects") {
        payload.ai_prompt = "Act as an expert electronics engineer and maker mentor. Analyze this hardware inventory and suggest 3 to 5 feasible, high-impact DIY electronics/maker projects I can build primarily using my in-stock components. For each project, list difficulty, BOM from my inventory, optional complementary parts, circuit/interface notes, and recommended firmware libraries.";
      } else if (promptTemplate === "purchases") {
        payload.ai_prompt = "Act as an expert electronics procurement and component specialist. Analyze my hardware inventory to identify bottlenecks and missing complementary components. Recommend a prioritized list of high-leverage parts to purchase next (Tier 1 Essentials, Tier 2 Modules, Tier 3 Upgrades) that will maximize the number of new projects I can build.";
      } else if (promptTemplate === "all_in_one") {
        payload.ai_prompt = "Act as an expert electronics engineer and maker mentor. 1) Suggest 3 to 5 realistic maker projects I can build with components currently in stock, detailing BOM, difficulty, and circuit/firmware recommendations. 2) Perform an inventory gap analysis and recommend high-leverage component purchases to unlock maximum new project possibilities.";
      }

      payload.inventory = filteredComponents.map(c => {
        const itemObj: JsonExportItem = {
          name: c.name,
          in_storage_qty: c.totals?.in_storage_qty ?? 0,
          checked_out_qty: c.totals?.checked_out_qty ?? 0,
          total_owned_qty: c.totals?.total_owned_qty ?? 0,
          tags: c.tags?.map(t => t.name) || []
        };
        if (includeSpecs) {
          const specs = extractSpecs(c.custom_fields);
          if (Object.keys(specs).length > 0) itemObj.specifications = specs;
        }
        if (includeNotes && c.notes) itemObj.notes = c.notes;
        if (includeDatasheets && c.datasheet_link) itemObj.datasheet_url = c.datasheet_link;
        if (includeLocations && c.locations && c.locations.length > 0) {
          itemObj.storage_locations = c.locations.map(l => ({
            quantity: l.quantity,
            location: l.fullLabel || l.label || "Storage"
          }));
        }
        return itemObj;
      });

      return JSON.stringify(payload, null, 2);
    }

    // 2. CSV Format
    if (exportFormat === "csv") {
      const headers = [
        "Component Name",
        "In Storage Qty",
        "Total Owned Qty",
        "Tags",
        includeSpecs ? "Specifications" : null,
        includeNotes ? "Notes" : null,
        includeDatasheets ? "Datasheet" : null,
        includeLocations ? "Locations" : null
      ].filter(Boolean);

      const rows = filteredComponents.map(c => {
        const specs = includeSpecs ? Object.entries(extractSpecs(c.custom_fields)).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
        const tags = c.tags?.map(t => t.name).join(", ") || "";
        const locations = includeLocations && c.locations ? c.locations.map(l => `${l.quantity} in ${l.fullLabel || l.label}`).join("; ") : "";

        const rowValues = [
          c.name,
          c.totals?.in_storage_qty ?? 0,
          c.totals?.total_owned_qty ?? 0,
          tags,
          includeSpecs ? specs : null,
          includeNotes ? (c.notes || "") : null,
          includeDatasheets ? (c.datasheet_link || "") : null,
          includeLocations ? locations : null
        ].filter(v => v !== null);

        return rowValues.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
      });

      let prefix = "";
      if (promptTemplate !== "raw") {
        let promptText = "";
        if (promptTemplate === "projects") {
          promptText = "AI Instruction: Analyze this inventory CSV and suggest 3-5 realistic electronics/maker projects I can build with available parts, including BOM, circuit notes, and required firmware.";
        } else if (promptTemplate === "purchases") {
          promptText = "AI Instruction: Analyze this inventory CSV to identify missing components and recommend high-leverage parts to purchase next to expand my project capabilities.";
        } else {
          promptText = "AI Instruction: 1) Suggest maker projects I can build with in-stock parts. 2) Recommend high-leverage component purchases to unlock new projects.";
        }
        prefix = `# ${promptText}\n\n`;
      }

      return prefix + [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
    }

    // 3. Markdown / Plain Text Format
    let promptHeader = "";
    if (promptTemplate === "projects") {
      promptHeader = `# Electronics Inventory & Project Recommendations Request

You are an expert electronics engineer, embedded systems developer, and hardware maker mentor.
Below is the catalog of my current electronic components and hardware inventory.

## Objectives:
1. **Analyze My In-Stock Components**: Review the microcontrollers, sensors, ICs, passives, displays, and actuators listed below.
2. **Suggest 3 to 5 Feasible Maker Projects**: Propose realistic, fun, or practical projects I can build right now primarily with components currently in stock.
3. **For each project idea, provide**:
   - **Project Name & Overview**: What it does and its real-world utility or learning value.
   - **Difficulty Level**: (Beginner, Intermediate, Advanced).
   - **BOM from My Inventory**: The exact components to use and required quantities.
   - **Complementary / Optional Parts**: Any minor parts (e.g. specific resistor, battery, enclosure) that could enhance it, with simple substitutions if possible.
   - **Hardware & Wiring Concept**: High-level pin connections, interface protocols (I2C, SPI, UART, PWM, ADC), and power requirements (3.3V vs 5V).
   - **Software & Firmware**: Recommended development platform (Arduino, ESP-IDF, PlatformIO, MicroPython) and key open-source libraries.
4. **Quick-Start Recommendation**: Which project is the best to build first this weekend and what are the initial 3 steps to test the hardware.

---
`;
    } else if (promptTemplate === "purchases") {
      promptHeader = `# Electronics Inventory Gap Analysis & Component Purchase Guide

You are an expert electronics procurement and component advisor for embedded engineers, hardware hackers, and makers.
Below is the catalog of my current electronic components inventory.

## Objectives:
1. **Analyze Inventory Gaps**: Look across categories (microcontrollers, sensors, power management, motor/relay drivers, passives, communication) and identify critical missing links or bottlenecks that limit what I can build.
2. **Recommend High-Leverage Component Purchases**:
   - **Tier 1 (High Priority Essentials)**: Inexpensive, fundamental parts (e.g., missing voltage regulators, common resistor/capacitor assortments, logic-level MOSFETs, essential diodes, op-amps) that immediately unlock dozens of new circuits.
   - **Tier 2 (Versatile Modules & ICs)**: Popular breakout boards, display modules (OLED/e-paper), motor drivers, or communication shields that pair synergistically with my existing microcontrollers.
   - **Tier 3 (Nice-to-Have Upgrades)**: Prototyping conveniences, battery charging/management ICs, or specialized sensors.
3. **For each recommendation, explain**:
   - Recommended generic part number or module type (e.g., "TP4056 Li-Ion Charger", "IRLZ44N N-MOSFET", "SSD1306 0.96\\" I2C OLED").
   - Why it is worth buying and what new projects it enables with my existing inventory.

---
`;
    } else if (promptTemplate === "all_in_one") {
      promptHeader = `# Electronics Maker Studio: Projects & Strategic Purchase Guide

You are an elite electronics engineer, embedded systems architect, and maker mentor.
Below is the full catalog of my current electronic components and hardware inventory.

## Objectives:
Please review my inventory and provide a comprehensive consultation with two core sections:

### Part 1: Projects I Can Build Right Now
- Suggest 3 to 5 realistic, high-value projects that make maximum use of the components I currently have in stock.
- For each project include: Name, difficulty level, Bill of Materials (from my inventory with quantities), circuit/wiring concept, and recommended firmware libraries.
- Note any minor complementary parts needed (if any) and how to substitute them.

### Part 2: Strategic Component Purchases to Unlock More Builds
- Identify the biggest gaps in my inventory (e.g. missing motor drivers, logic converters, passives, display modules, power supplies).
- Recommend the top 5 to 10 most versatile, cost-effective components or modules I should buy next to complement what I already have.
- Explain what new projects each purchase unlocks.

---
`;
    }

    // Markdown Table and List
    const tableHeader = `## Current Inventory (${filteredComponents.length} Items, ${totalUnits} In-Stock Units)\n\n`;

    let table = `| Component Name | In Stock | Total Owned | Tags / Categories | Specifications & Notes | Datasheet |\n`;
    table += `| :--- | :---: | :---: | :--- | :--- | :---: |\n`;

    filteredComponents.forEach(c => {
      const inStorage = c.totals?.in_storage_qty ?? 0;
      const totalOwned = c.totals?.total_owned_qty ?? 0;
      const tags = c.tags?.map(t => t.name).join(", ") || "-";
      
      const specParts: string[] = [];
      if (includeSpecs) {
        const specs = extractSpecs(c.custom_fields);
        Object.entries(specs).forEach(([k, v]) => specParts.push(`${k}: ${v}`));
      }
      if (includeNotes && c.notes) {
        specParts.push(c.notes.replace(/\r?\n/g, " "));
      }
      if (includeLocations && c.locations && c.locations.length > 0) {
        const locStr = c.locations.map(l => `${l.quantity}x @ ${l.fullLabel || l.label}`).join(", ");
        specParts.push(`Loc: ${locStr}`);
      }
      
      const details = specParts.length > 0 ? specParts.join(" | ") : "-";
      const datasheet = includeDatasheets && c.datasheet_link ? `[Link](${c.datasheet_link})` : "-";

      table += `| **${c.name.replace(/\|/g, "\\|")}** | ${inStorage} | ${totalOwned} | ${tags.replace(/\|/g, "\\|")} | ${details.replace(/\|/g, "\\|")} | ${datasheet} |\n`;
    });

    let detailedList = `\n### Detailed Item Breakdown\n\n`;
    filteredComponents.forEach(c => {
      const inStorage = c.totals?.in_storage_qty ?? 0;
      const totalOwned = c.totals?.total_owned_qty ?? 0;
      detailedList += `- **${c.name}**\n`;
      detailedList += `  - **Stock**: ${inStorage} available in storage (${totalOwned} total owned)\n`;
      if (c.tags && c.tags.length > 0) {
        detailedList += `  - **Categories**: ${c.tags.map(t => t.name).join(", ")}\n`;
      }
      if (includeSpecs) {
        const specs = extractSpecs(c.custom_fields);
        if (Object.keys(specs).length > 0) {
          detailedList += `  - **Specifications**: ${Object.entries(specs).map(([k, v]) => `${k} = ${v}`).join(", ")}\n`;
        }
      }
      if (includeNotes && c.notes) {
        detailedList += `  - **Notes**: ${c.notes}\n`;
      }
      if (includeDatasheets && c.datasheet_link) {
        detailedList += `  - **Datasheet**: ${c.datasheet_link}\n`;
      }
      if (includeLocations && c.locations && c.locations.length > 0) {
        detailedList += `  - **Storage Location**: ${c.locations.map(l => `${l.quantity} in ${l.fullLabel || l.label}`).join("; ")}\n`;
      }
    });

    if (exportFormat === "text") {
      // Clean plain text version without markdown formatting symbols
      return (promptHeader ? promptHeader.replace(/[#*|]/g, "") + "\n\n" : "") +
        `INVENTORY CATALOG (${filteredComponents.length} items, ${totalUnits} units in stock)\n` +
        `========================================================================\n\n` +
        filteredComponents.map(c => {
          const lines = [
            `ITEM: ${c.name}`,
            `  In-Stock: ${c.totals?.in_storage_qty ?? 0} | Total Owned: ${c.totals?.total_owned_qty ?? 0}`
          ];
          if (c.tags && c.tags.length > 0) lines.push(`  Categories: ${c.tags.map(t => t.name).join(", ")}`);
          if (includeSpecs) {
            const specs = extractSpecs(c.custom_fields);
            if (Object.keys(specs).length > 0) {
              lines.push(`  Specs: ${Object.entries(specs).map(([k, v]) => `${k}=${v}`).join(", ")}`);
            }
          }
          if (includeNotes && c.notes) lines.push(`  Notes: ${c.notes}`);
          if (includeDatasheets && c.datasheet_link) lines.push(`  Datasheet: ${c.datasheet_link}`);
          if (includeLocations && c.locations && c.locations.length > 0) {
            lines.push(`  Location: ${c.locations.map(l => `${l.quantity} in ${l.fullLabel || l.label}`).join("; ")}`);
          }
          return lines.join("\n");
        }).join("\n\n");
    }

    return promptHeader + tableHeader + table + detailedList;
  }, [
    exportFormat,
    promptTemplate,
    filteredComponents,
    totalUnits,
    stockFilter,
    includeSpecs,
    includeNotes,
    includeDatasheets,
    includeLocations
  ]);

  // Estimated tokens (approx 4 characters per token)
  const tokenEstimate = useMemo(() => {
    return Math.max(1, Math.round(generatedContent.length / 4));
  }, [generatedContent]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(generatedContent);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = generatedContent;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard. You can download the file instead.");
    }
  };

  // Download file
  const handleDownload = () => {
    try {
      const ext = exportFormat === "markdown" ? "md" : exportFormat === "json" ? "json" : exportFormat === "csv" ? "csv" : "txt";
      const mimeTypes: Record<string, string> = {
        md: "text/markdown;charset=utf-8",
        txt: "text/plain;charset=utf-8",
        json: "application/json;charset=utf-8",
        csv: "text/csv;charset=utf-8"
      };

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `inventory-for-ai-${promptTemplate}-${dateStr}.${ext}`;

      const blob = new Blob([generatedContent], { type: mimeTypes[ext] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
      alert("Error generating download file.");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-[#171513] border border-[#332f2a] rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-brand-text relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#332f2a] bg-[#1d1a17] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-brand-gold/15 border border-brand-gold/30 rounded-lg text-brand-gold shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-bold tracking-wide text-white">
                  Export Inventory for AI
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#2a2622] text-brand-gold border border-brand-gold/20 rounded">
                  ChatGPT / Claude
                </span>
              </div>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Generate prompt-ready inventory files to get build ideas and smart restock recommendations.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#252320] rounded-md transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: AI Prompt Objective / Goal */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-gold mb-2.5">
              1. Choose AI Objective / Prompt Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* All in One */}
              <button
                type="button"
                onClick={() => setPromptTemplate("all_in_one")}
                className={`p-3 rounded-lg border text-left transition-all relative ${
                  promptTemplate === "all_in_one"
                    ? "bg-[#252019] border-brand-accent shadow-sm"
                    : "bg-[#141211] border-[#2c2824] hover:border-[#443e38]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded ${promptTemplate === "all_in_one" ? "bg-brand-accent text-white" : "bg-[#201d1a] text-brand-gold"}`}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Maker Studio</span>
                </div>
                <p className="text-[11px] text-brand-text-muted leading-tight">
                  Projects to build now <strong className="text-brand-text">+</strong> smart component purchases.
                </p>
              </button>

              {/* Project Suggestions */}
              <button
                type="button"
                onClick={() => setPromptTemplate("projects")}
                className={`p-3 rounded-lg border text-left transition-all relative ${
                  promptTemplate === "projects"
                    ? "bg-[#252019] border-brand-accent shadow-sm"
                    : "bg-[#141211] border-[#2c2824] hover:border-[#443e38]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded ${promptTemplate === "projects" ? "bg-brand-accent text-white" : "bg-[#201d1a] text-brand-gold"}`}>
                    <Wrench className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Project Ideas</span>
                </div>
                <p className="text-[11px] text-brand-text-muted leading-tight">
                  Suggest feasible DIY builds based primarily on components on-hand.
                </p>
              </button>

              {/* Purchase Recommendations */}
              <button
                type="button"
                onClick={() => setPromptTemplate("purchases")}
                className={`p-3 rounded-lg border text-left transition-all relative ${
                  promptTemplate === "purchases"
                    ? "bg-[#252019] border-brand-accent shadow-sm"
                    : "bg-[#141211] border-[#2c2824] hover:border-[#443e38]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded ${promptTemplate === "purchases" ? "bg-brand-accent text-white" : "bg-[#201d1a] text-brand-gold"}`}>
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Purchase Advice</span>
                </div>
                <p className="text-[11px] text-brand-text-muted leading-tight">
                  Analyze inventory gaps and suggest high-leverage parts to buy next.
                </p>
              </button>

              {/* Raw Inventory */}
              <button
                type="button"
                onClick={() => setPromptTemplate("raw")}
                className={`p-3 rounded-lg border text-left transition-all relative ${
                  promptTemplate === "raw"
                    ? "bg-[#252019] border-brand-accent shadow-sm"
                    : "bg-[#141211] border-[#2c2824] hover:border-[#443e38]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded ${promptTemplate === "raw" ? "bg-brand-accent text-white" : "bg-[#201d1a] text-brand-gold"}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Raw Catalog</span>
                </div>
                <p className="text-[11px] text-brand-text-muted leading-tight">
                  Clean inventory table and details without system prompt instructions.
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Format & Filters Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#141211] border border-[#2a2622] rounded-lg">
            {/* Format */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setExportFormat("markdown")}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded border flex items-center justify-center gap-1.5 transition-all ${
                    exportFormat === "markdown"
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Markdown (.md)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("text")}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded border flex items-center justify-center gap-1.5 transition-all ${
                    exportFormat === "text"
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Text (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("json")}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded border flex items-center justify-center gap-1.5 transition-all ${
                    exportFormat === "json"
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  JSON (.json)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded border flex items-center justify-center gap-1.5 transition-all ${
                    exportFormat === "csv"
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV (.csv)
                </button>
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                Item Scope
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setScope("components")}
                  className={`w-full px-2.5 py-1.5 text-xs font-medium rounded border text-left transition-all ${
                    scope === "components"
                      ? "bg-brand-accent/20 text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  Electronics Components Only
                </button>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`w-full px-2.5 py-1.5 text-xs font-medium rounded border text-left transition-all ${
                    scope === "all"
                      ? "bg-brand-accent/20 text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  All Items (Include Personal)
                </button>
              </div>
            </div>

            {/* Stock Availability */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-text-muted mb-2">
                Stock Filter
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setStockFilter("in_stock")}
                  className={`w-full px-2.5 py-1.5 text-xs font-medium rounded border text-left transition-all ${
                    stockFilter === "in_stock"
                      ? "bg-brand-accent/20 text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  In-Stock Only (Qty &gt; 0)
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter("all")}
                  className={`w-full px-2.5 py-1.5 text-xs font-medium rounded border text-left transition-all ${
                    stockFilter === "all"
                      ? "bg-brand-accent/20 text-white border-brand-accent"
                      : "bg-[#1c1a17] text-brand-text-muted border-[#332f2a] hover:text-white"
                  }`}
                >
                  All Items (Include 0 Stock)
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Extra Field Toggles */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-text-muted mb-2">
              Details to Include
            </label>
            <div className="flex flex-wrap gap-2.5">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141211] border border-[#2a2622] rounded cursor-pointer hover:border-[#3d3832] transition-colors text-xs text-brand-text">
                <input
                  type="checkbox"
                  checked={includeSpecs}
                  onChange={(e) => setIncludeSpecs(e.target.checked)}
                  className="rounded border-[#332f2a] bg-[#1a1816] text-brand-accent focus:ring-0 focus:ring-offset-0"
                />
                Custom Specifications (voltage, package, etc.)
              </label>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141211] border border-[#2a2622] rounded cursor-pointer hover:border-[#3d3832] transition-colors text-xs text-brand-text">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded border-[#332f2a] bg-[#1a1816] text-brand-accent focus:ring-0 focus:ring-offset-0"
                />
                Notes & Descriptions
              </label>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141211] border border-[#2a2622] rounded cursor-pointer hover:border-[#3d3832] transition-colors text-xs text-brand-text">
                <input
                  type="checkbox"
                  checked={includeDatasheets}
                  onChange={(e) => setIncludeDatasheets(e.target.checked)}
                  className="rounded border-[#332f2a] bg-[#1a1816] text-brand-accent focus:ring-0 focus:ring-offset-0"
                />
                Datasheet Links
              </label>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141211] border border-[#2a2622] rounded cursor-pointer hover:border-[#3d3832] transition-colors text-xs text-brand-text">
                <input
                  type="checkbox"
                  checked={includeLocations}
                  onChange={(e) => setIncludeLocations(e.target.checked)}
                  className="rounded border-[#332f2a] bg-[#1a1816] text-brand-accent focus:ring-0 focus:ring-offset-0"
                />
                Storage Room & Drawer Locations
              </label>
            </div>
          </div>

          {/* Section 4: Live Preview & Stats */}
          <div className="border border-[#2e2a25] rounded-lg overflow-hidden bg-[#121110]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1816] border-b border-[#2e2a25]">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-brand-accent" />
                  {filteredComponents.length} items
                </span>
                <span className="text-brand-text-muted">•</span>
                <span className="text-brand-gold">
                  {totalUnits} units in stock
                </span>
                <span className="text-brand-text-muted">•</span>
                <span className="text-brand-text-muted">
                  ~{tokenEstimate.toLocaleString()} tokens
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-xs text-brand-text-muted hover:text-white transition-colors"
              >
                <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
                {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {showPreview && (
              <div className="p-3 max-h-56 overflow-y-auto font-mono text-[11px] text-[#cfcac2] whitespace-pre-wrap select-all leading-relaxed bg-[#0d0c0b]">
                {generatedContent}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer / Action Bar */}
        <div className="px-6 py-4 border-t border-[#332f2a] bg-[#1d1a17] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-brand-text-muted flex items-center gap-1.5 self-start sm:self-auto">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Ready to upload or paste into ChatGPT, Claude, or any AI assistant.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-[#282522] hover:bg-[#35312c] text-white border border-[#403b34]"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-white" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy for AI</span>
                </>
              )}
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-xs font-bold uppercase tracking-wider rounded transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Download .{exportFormat === "markdown" ? "md" : exportFormat}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}