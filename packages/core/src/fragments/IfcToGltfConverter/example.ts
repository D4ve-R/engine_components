/* MD
  ## 🎁 Converting IFC to glTF
  ---
  This tutorial covers loading an IFC model, converting it into Fragments and exporting the resulting geometry as a binary GLB file. By the end, you'll have a complete IFC-to-glTF pipeline that can generate portable assets for other 3D workflows.

  ### 🖖 Importing our Libraries
  First things first, let's install all necessary dependencies to make this example work:
*/

import * as BUI from "@thatopen/ui";
import * as OBC from "../..";

/* MD
  ### 🌎 Setting up a Simple Scene
  We will create a simple scene so the converted model can be previewed before exporting it:
*/

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;

const container = document.getElementById("container")!;
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.OrthoPerspectiveCamera(components);
await world.camera.controls.setLookAt(78, 20, -2.2, 26, -4, 25);

components.init();
components.get(OBC.Grids).create(world);

/* MD
  ### ✨ Setting up IFC loading and glTF export
  The IFC is first converted into Fragments and loaded into the viewer. Once the model is available, the `IfcToGltfConverter` can export the same geometry as a `.glb` file.
*/

const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    path: "https://unpkg.com/web-ifc@0.0.77/",
    absolute: true,
  },
});

const workerUrl = await OBC.FragmentsManager.getWorker();
const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

world.camera.controls.addEventListener("update", () => fragments.core.update());

fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
});

const converter = components.get(OBC.IfcToGltfConverter);

const loadIfc = async (path: string) => {
  const response = await fetch(path);
  const data = new Uint8Array(await response.arrayBuffer());
  await ifcLoader.load(data, false, "example");
};

const downloadGlb = async () => {
  const [model] = fragments.list.values();
  if (!model) return;

  const buffer = await converter.export(model, { binary: true });
  if (!(buffer instanceof ArrayBuffer)) return;

  const file = new File([buffer], `${model.modelId}.glb`);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
};

/* MD
  ### 🧩 Adding some UI
  Let's add a simple interface to load an IFC and download the converted GLB:
*/

BUI.Manager.init();

const [panel, updatePanel] = BUI.Component.create<BUI.PanelSection, {}>((_) => {
  const [model] = fragments.list.values();

  return BUI.html`
    <bim-panel active label="IfcToGltfConverter Tutorial" class="options-menu">
      <bim-panel-section label="Controls">
        <bim-button
          label="Load IFC"
          @click=${async ({ target }: { target: BUI.Button }) => {
            target.label = "Loading IFC...";
            target.loading = true;
            await loadIfc(
              "https://thatopen.github.io/engine_components/resources/ifc/school_str.ifc",
            );
            target.loading = false;
            target.label = "Load IFC";
          }}>
        </bim-button>
        ${model ? BUI.html`
          <bim-button label="Download GLB" @click=${downloadGlb}></bim-button>
        ` : ""}
      </bim-panel-section>
    </bim-panel>
  `;
}, {});

document.body.append(panel);
fragments.list.onItemSet.add(() => updatePanel());

const button = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
      <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
        @click="${() => {
          if (panel.classList.contains("options-menu-visible")) {
            panel.classList.remove("options-menu-visible");
          } else {
            panel.classList.add("options-menu-visible");
          }
        }}">
      </bim-button>
    `;
});

document.body.append(button);
