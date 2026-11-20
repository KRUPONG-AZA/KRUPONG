import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AtomElement,
  getAllMoleculeScenes,
  MoleculeSceneSpec,
  toSDF,
} from '../logic/molecularData';

declare global {
  interface Window {
    $3Dmol?: {
      createViewer: (
        element: HTMLElement,
        config: Record<string, unknown>,
      ) => ThreeDmolViewer;
    };
  }
}

interface ThreeDmolViewer {
  addModel: (data: string, format: string) => unknown;
  setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
  addCylinder: (spec: Record<string, unknown>) => void;
  zoomTo: () => void;
  render: () => void;
  resize: () => void;
  clear: () => void;
}

const ELEMENT_COLORS: Record<AtomElement, number> = {
  O: 0xef4444,
  C: 0x94a3b8,
  H: 0xf8fafc,
};

const COVALENT_RADII: Record<AtomElement, number> = {
  O: 0.34,
  C: 0.38,
  H: 0.22,
};

const VDW_RADII: Record<AtomElement, number> = {
  O: 1.08,
  C: 1.22,
  H: 0.78,
};

let scriptLoadPromise: Promise<boolean> | null = null;

function load3DmolScript(timeoutMs = 3500): Promise<boolean> {
  if (window.$3Dmol) return Promise.resolve(true);
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-3dmol-cdn="true"]',
    );
    if (existing && window.$3Dmol) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://3Dmol.org/build/3Dmol-min.js';
    script.async = true;
    script.dataset['3dmolCdn'] = 'true';

    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(Boolean(window.$3Dmol));
      }
    }, timeoutMs);

    script.onload = () => {
      window.clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(Boolean(window.$3Dmol));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(false);
      }
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

const isSoftwareGl = (() => {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

interface ViewportHandle {
  resetView: () => void;
  resize: () => void;
  dispose: () => void;
}

export class MolecularViewerGrid {
  private containers: Map<MoleculeSceneSpec['id'], HTMLElement>;
  private handles: ViewportHandle[] = [];
  private initialized = false;
  private initializing = false;
  private backend: 'none' | '3dmol' | 'threejs' = 'none';
  private onBackendReady?: (backend: '3dmol' | 'threejs') => void;

  constructor(
    containers: Map<MoleculeSceneSpec['id'], HTMLElement>,
    onBackendReady?: (backend: '3dmol' | 'threejs') => void,
  ) {
    this.containers = containers;
    this.onBackendReady = onBackendReady;
  }

  public getBackend(): string {
    return this.backend;
  }

  public async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      this.resizeAll();
      return;
    }
    if (this.initializing) return;
    this.initializing = true;

    const scenes = getAllMoleculeScenes();
    // Ensure containers are visible & have non-zero dimensions before mounting WebGL
    const has3Dmol = await load3DmolScript();

    if (has3Dmol && window.$3Dmol) {
      try {
        for (const scene of scenes) {
          const el = this.containers.get(scene.id);
          if (!el) continue;
          const handle = this.mount3DmolViewport(el, scene);
          this.handles.push(handle);
        }
        this.backend = '3dmol';
        this.initialized = true;
        this.initializing = false;
        this.onBackendReady?.('3dmol');
        return;
      } catch (err) {
        console.warn('3Dmol initialization failed, switching to Three.js fallback:', err);
        this.disposeHandles();
      }
    }

    for (const scene of scenes) {
      const el = this.containers.get(scene.id);
      if (!el) continue;
      const handle = this.mountThreeViewport(el, scene);
      this.handles.push(handle);
    }
    this.backend = 'threejs';
    this.initialized = true;
    this.initializing = false;
    this.onBackendReady?.('threejs');
  }

  public resetAllViews(): void {
    for (const h of this.handles) {
      h.resetView();
    }
  }

  public resizeAll(): void {
    for (const h of this.handles) {
      h.resize();
    }
  }

  private mount3DmolViewport(
    el: HTMLElement,
    sceneSpec: MoleculeSceneSpec,
  ): ViewportHandle {
    el.innerHTML = '';
    const $3Dmol = window.$3Dmol!;
    const viewer = $3Dmol.createViewer(el, {
      backgroundColor: '0x0b1220',
      antialias: !isSoftwareGl,
    });

    const sdf = toSDF(sceneSpec);
    viewer.addModel(sdf, 'sdf');

    if (sceneSpec.styleMode === 'spacefill') {
      viewer.setStyle({}, { sphere: { scale: 0.78 } });
    } else if (sceneSpec.styleMode === 'compare') {
      viewer.setStyle(
        {},
        {
          stick: { radius: 0.14 },
          sphere: { scale: 0.28 },
        },
      );
      viewer.setStyle(
        { elem: 'O' },
        { stick: { radius: 0.14 }, sphere: { scale: 0.72, opacity: 0.35 } },
      );
      viewer.setStyle(
        { elem: 'C' },
        { stick: { radius: 0.14 }, sphere: { scale: 0.75, opacity: 0.35 } },
      );
      viewer.setStyle(
        { elem: 'H' },
        { stick: { radius: 0.12 }, sphere: { scale: 0.62, opacity: 0.3 } },
      );
    } else {
      // hbond
      viewer.setStyle(
        {},
        {
          stick: { radius: 0.14 },
          sphere: { scale: 0.28 },
        },
      );
      if (sceneSpec.hBondSegment) {
        const { start, end } = sceneSpec.hBondSegment;
        const pStart = new THREE.Vector3(...start);
        const pEnd = new THREE.Vector3(...end);
        const dir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
        pStart.addScaledVector(dir, 0.28);
        pEnd.addScaledVector(dir, -0.4);
        const dashes = 3;
        for (let i = 0; i < dashes; i++) {
          const t0 = i / dashes + 0.04;
          const t1 = (i + 0.68) / dashes;
          viewer.addCylinder({
            start: {
              x: pStart.x + (pEnd.x - pStart.x) * t0,
              y: pStart.y + (pEnd.y - pStart.y) * t0,
              z: pStart.z + (pEnd.z - pStart.z) * t0,
            },
            end: {
              x: pStart.x + (pEnd.x - pStart.x) * t1,
              y: pStart.y + (pEnd.y - pStart.y) * t1,
              z: pStart.z + (pEnd.z - pStart.z) * t1,
            },
            radius: 0.08,
            color: '0xfbbf24',
            fromCap: 1,
            toCap: 1,
          });
        }
      }
    }

    viewer.zoomTo();
    viewer.render();

    return {
      resetView: () => {
        viewer.zoomTo();
        viewer.render();
      },
      resize: () => {
        viewer.resize();
        viewer.render();
      },
      dispose: () => {
        viewer.clear();
        el.innerHTML = '';
      },
    };
  }

  private mountThreeViewport(
    el: HTMLElement,
    sceneSpec: MoleculeSceneSpec,
  ): ViewportHandle {
    el.innerHTML = '';
    const width = Math.max(220, el.clientWidth || 320);
    const height = Math.max(200, el.clientHeight || 240);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, 7);
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.9);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const initialCamPos =
      sceneSpec.id === 'ethanol_before'
        ? new THREE.Vector3(0.4, 0.8, 11.2)
        : sceneSpec.id === 'water_before'
          ? new THREE.Vector3(0.3, 0.6, 7.6)
          : new THREE.Vector3(0, 0.6, 7.2);
    camera.position.copy(initialCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 18;

    const moleculeGroup = new THREE.Group();
    const disposables: { dispose: () => void }[] = [];

    const sphereGeo = new THREE.SphereGeometry(1, isSoftwareGl ? 18 : 28, isSoftwareGl ? 14 : 22);
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
    disposables.push(sphereGeo, cylGeo);

    const matCache = new Map<string, THREE.Material>();
    const getAtomMat = (element: AtomElement, translucent: boolean): THREE.Material => {
      const key = `${element}-${translucent ? 't' : 's'}`;
      const existing = matCache.get(key);
      if (existing) return existing;
      const mat = new THREE.MeshStandardMaterial({
        color: ELEMENT_COLORS[element],
        roughness: element === 'C' ? 0.48 : 0.3,
        metalness: 0.08,
        transparent: translucent,
        opacity: translucent ? 0.28 : 1.0,
        depthWrite: !translucent,
      });
      matCache.set(key, mat);
      disposables.push(mat);
      return mat;
    };

    const bondMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.38,
      metalness: 0.15,
    });
    disposables.push(bondMat);

    // Atoms
    for (const atom of sceneSpec.atoms) {
      if (sceneSpec.styleMode === 'spacefill') {
        const mesh = new THREE.Mesh(sphereGeo, getAtomMat(atom.element, false));
        mesh.position.set(atom.x, atom.y, atom.z);
        mesh.scale.setScalar(VDW_RADII[atom.element]);
        moleculeGroup.add(mesh);
      } else {
        const core = new THREE.Mesh(sphereGeo, getAtomMat(atom.element, false));
        core.position.set(atom.x, atom.y, atom.z);
        core.scale.setScalar(COVALENT_RADII[atom.element]);
        moleculeGroup.add(core);

        if (sceneSpec.styleMode === 'compare') {
          const shell = new THREE.Mesh(sphereGeo, getAtomMat(atom.element, true));
          shell.position.set(atom.x, atom.y, atom.z);
          shell.scale.setScalar(VDW_RADII[atom.element]);
          moleculeGroup.add(shell);
        }
      }
    }

    // Covalent bonds for compare / hbond modes
    if (sceneSpec.styleMode !== 'spacefill') {
      const up = new THREE.Vector3(0, 1, 0);
      for (const bond of sceneSpec.bonds) {
        const a = sceneSpec.atoms[bond.a];
        const b = sceneSpec.atoms[bond.b];
        const pA = new THREE.Vector3(a.x, a.y, a.z);
        const pB = new THREE.Vector3(b.x, b.y, b.z);
        const dir = new THREE.Vector3().subVectors(pB, pA);
        const len = dir.length();
        const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);

        const stick = new THREE.Mesh(cylGeo, bondMat);
        stick.position.copy(mid);
        stick.quaternion.setFromUnitVectors(up, dir.normalize());
        stick.scale.set(0.11, len, 0.11);
        moleculeGroup.add(stick);
      }
    }

    // Glowing yellow dashed cylinder for Hydrogen Bond
    if (sceneSpec.styleMode === 'hbond' && sceneSpec.hBondSegment) {
      const { start, end } = sceneSpec.hBondSegment;
      const rawStart = new THREE.Vector3(...start);
      const rawEnd = new THREE.Vector3(...end);
      const dir = new THREE.Vector3().subVectors(rawEnd, rawStart).normalize();
      // Start and end outside the H (r=0.22) and O (r=0.34) spheres so all dashes are visible
      const pStart = rawStart.clone().addScaledVector(dir, 0.28);
      const pEnd = rawEnd.clone().addScaledVector(dir, -0.4);
      const up = new THREE.Vector3(0, 1, 0);

      const hBondMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.0,
        roughness: 0.25,
      });
      disposables.push(hBondMat);

      const dashes = 3;
      for (let i = 0; i < dashes; i++) {
        const t0 = i / dashes + 0.04;
        const t1 = (i + 0.68) / dashes;
        const a = new THREE.Vector3().lerpVectors(pStart, pEnd, t0);
        const b = new THREE.Vector3().lerpVectors(pStart, pEnd, t1);
        const dashLen = a.distanceTo(b);
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

        const dashMesh = new THREE.Mesh(cylGeo, hBondMat);
        dashMesh.position.copy(mid);
        dashMesh.quaternion.setFromUnitVectors(up, dir);
        dashMesh.scale.set(0.085, dashLen, 0.085);
        moleculeGroup.add(dashMesh);
      }
    }

    // Center molecule group
    const box = new THREE.Box3().setFromObject(moleculeGroup);
    const center = box.getCenter(new THREE.Vector3());
    moleculeGroup.position.sub(center);
    scene.add(moleculeGroup);

    // On-demand render loop with software-WebGL pacing
    let renderBusy = false;
    let renderDirty = false;
    let frameId = 0;

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        gl.flush();
        const poll = () => {
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    controls.addEventListener('change', requestRender);
    requestRender();

    return {
      resetView: () => {
        camera.position.copy(initialCamPos);
        controls.target.set(0, 0, 0);
        controls.update();
        requestRender();
      },
      resize: () => {
        const w = Math.max(220, el.clientWidth || 320);
        const h = Math.max(200, el.clientHeight || 240);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      },
      dispose: () => {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        el.innerHTML = '';
      },
    };
  }

  private disposeHandles(): void {
    for (const h of this.handles) {
      h.dispose();
    }
    this.handles = [];
  }

  public dispose(): void {
    this.disposeHandles();
    this.initialized = false;
  }
}
