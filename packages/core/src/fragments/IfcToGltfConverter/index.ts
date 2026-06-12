import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Component, Components, Disposable, Event } from "../../core";
import { IfcToGltfExportOptions, IfcToGltfExportResult } from "./src";

export * from "./src";

/**
 * Converts Fragments models produced from IFC data into glTF or GLB assets. 📕 [Tutorial](https://docs.thatopen.com/Tutorials/Components/Core/IfcToGltfConverter). 📘 [API](https://docs.thatopen.com/api/@thatopen/components/classes/IfcToGltfConverter).
 */
export class IfcToGltfConverter extends Component implements Disposable {
  /**
   * A unique identifier for the component.
   * This UUID is used to register the component within the Components system.
   */
  static readonly uuid = "7d5a0f17-3f7d-4df8-9ec3-3185376bc7cb" as const;

  /** {@link Disposable.onDisposed} */
  readonly onDisposed = new Event<string>();

  /** {@link Component.enabled} */
  enabled = true;

  constructor(components: Components) {
    super(components);
    this.components.add(IfcToGltfConverter.uuid, this);
  }

  /** {@link Disposable.dispose} */
  dispose() {
    this.onDisposed.trigger(IfcToGltfConverter.uuid);
    this.onDisposed.reset();
  }

  /**
   * Exports a Fragments model as glTF JSON or binary GLB.
   *
   * @param model - The Fragments model to export.
   * @param options - Export options for the conversion.
   *
   * @returns The generated GLB as an ArrayBuffer when `binary` is true,
   * otherwise the serialized glTF JSON string.
   */
  async export(
    model: FRAGS.FragmentsModel,
    options: IfcToGltfExportOptions = {},
  ): Promise<IfcToGltfExportResult> {
    const exportRoot = await this.getExportRoot(model, options);
    const exporter = new GLTFExporter();
    const { localIds: _localIds, includeIfcGuids: _includeIfcGuids, ...exporterOptions } = options;

    try {
      const result = await exporter.parseAsync(exportRoot, {
        binary: true,
        onlyVisible: false,
        trs: true,
        ...exporterOptions,
      });

      if (result instanceof ArrayBuffer) {
        return result;
      }

      return JSON.stringify(result);
    } finally {
      this.disposeExportRoot(exportRoot);
    }
  }

  private async getExportRoot(
    model: FRAGS.FragmentsModel,
    options: IfcToGltfExportOptions,
  ) {
    const localIds = options.localIds ?? await model.getItemsIdsWithGeometry();
    const includeIfcGuids = options.includeIfcGuids ?? true;

    const [itemsGeometry, materialsByLocalId, guids] = await Promise.all([
      model.getItemsGeometry(localIds),
      this.getMaterialsByLocalId(model, localIds),
      includeIfcGuids ? model.getGuidsByLocalIds(localIds) : Promise.resolve([]),
    ]);

    const defaultMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c8c8c8"),
      metalness: 0,
      roughness: 1,
    });

    const exportRoot = new THREE.Group();
    exportRoot.name = model.modelId;
    exportRoot.userData = { modelId: model.modelId };

    model.object.updateWorldMatrix(true, true);
    exportRoot.matrix.copy(model.object.matrixWorld);
    exportRoot.matrixAutoUpdate = false
    for (const [index, localId] of localIds.entries()) {
      const meshes = itemsGeometry[index];
      if (!meshes) continue;

      const material = materialsByLocalId.get(localId) ?? defaultMaterial;
      const ifcGuid = includeIfcGuids ? guids[index] : null;

      for (const [meshIndex, meshData] of meshes.entries()) {
        if (!meshData.positions || meshData.positions.length === 0) continue;

        const geometry = this.getGeometry(meshData);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.matrix.copy(meshData.transform);
        mesh.matrixAutoUpdate = false;
        mesh.name = ifcGuid
          ? `${ifcGuid}-${meshIndex}`
          : `${model.modelId}-${localId}-${meshIndex}`;
        mesh.userData = {
          modelId: model.modelId,
          localId,
          ...(ifcGuid ? { ifcGuid } : {}),
        };
        exportRoot.add(mesh);
      }
    }

    exportRoot.updateMatrixWorld(true);
    return exportRoot;
  }

  private async getMaterialsByLocalId(
    model: FRAGS.FragmentsModel,
    localIds: number[],
  ) {
    const definitions = await model.getItemsMaterialDefinition(localIds);
    const materialByKey = new Map<string, THREE.MeshStandardMaterial>();
    const materialsByLocalId = new Map<number, THREE.MeshStandardMaterial>();

    for (const { definition, localIds: materialLocalIds } of definitions) {
      const key = [
        definition.color.getHexString(),
        definition.opacity,
        definition.transparent,
        definition.renderedFaces,
      ].join(":");

      let material = materialByKey.get(key);

      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: definition.color,
          metalness: 0,
          roughness: 1,
          opacity: definition.opacity,
          transparent: definition.transparent,
          side: definition.renderedFaces === FRAGS.RenderedFaces.TWO
            ? THREE.DoubleSide
            : THREE.FrontSide,
          depthTest: definition.depthTest ?? true,
          depthWrite: definition.depthWrite ?? true,
        });

        materialByKey.set(key, material);
      }

      for (const localId of materialLocalIds) {
        materialsByLocalId.set(localId, material);
      }
    }

    return materialsByLocalId;
  }

  private getGeometry(meshData: FRAGS.MeshData) {
    const geometry = new THREE.BufferGeometry();
    const positions = meshData.positions;

    if (!positions) {
      return geometry;
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions instanceof Float32Array ? positions : Float32Array.from(positions),
        3,
      ),
    );

    if (meshData.normals) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(meshData.normals, 3, true),
      );
    } else {
      geometry.computeVertexNormals();
    }

    if (meshData.indices) {
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }

  private disposeExportRoot(root: THREE.Group) {
    const materials = new Set<THREE.Material>();

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.geometry.dispose();

      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          materials.add(material);
        }
      } else {
        materials.add(child.material);
      }
    });

    for (const material of materials) {
      material.dispose();
    }
  }
}
