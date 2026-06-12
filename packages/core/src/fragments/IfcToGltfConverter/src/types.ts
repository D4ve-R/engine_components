import type { GLTFExporterOptions } from "three/examples/jsm/exporters/GLTFExporter.js";

/**
 * Options to export a Fragments model as glTF or GLB.
 */
export interface IfcToGltfExportOptions extends GLTFExporterOptions {
  /**
   * Optional subset of local IDs to export.
   * If omitted, all items with geometry will be exported.
   */
  localIds?: number[];

  /**
   * When true, the exported nodes include their IFC GUID inside `extras`.
   * @default true
   */
  includeIfcGuids?: boolean;
}

/**
 * Result of exporting a Fragments model as glTF or GLB.
 * Binary exports return an ArrayBuffer (`.glb`) and JSON exports return a string (`.gltf`).
 */
export type IfcToGltfExportResult = ArrayBuffer | string;
