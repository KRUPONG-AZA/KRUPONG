export type AtomElement = 'H' | 'O' | 'C';

export interface AtomPoint {
  element: AtomElement;
  x: number;
  y: number;
  z: number;
}

export interface BondPair {
  a: number;
  b: number;
  order: 1 | 2;
}

export interface MoleculeSceneSpec {
  id: 'water_before' | 'ethanol_before' | 'compare_pair' | 'hbond_after';
  title: string;
  atoms: AtomPoint[];
  bonds: BondPair[];
  styleMode: 'spacefill' | 'compare' | 'hbond';
  hBondSegment?: {
    start: [number, number, number];
    end: [number, number, number];
  };
  /** Split index between H2O atoms (0..split-1) and C2H5OH atoms (split..end) for compare_pair */
  compareSplitIndex?: number;
}

function rotatePoint(
  p: [number, number, number],
  rx: number,
  ry: number,
  rz: number,
): [number, number, number] {
  let [x, y, z] = p;
  // Rotate X
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  // Rotate Y
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  // Rotate Z
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return [x, y, z];
}

function buildWaterMolecule(
  offset: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): { atoms: AtomPoint[]; bonds: BondPair[] } {
  const halfAngle = (104.5 * Math.PI) / 360;
  const oh = 0.96;
  const local: { element: AtomElement; pos: [number, number, number] }[] = [
    { element: 'O', pos: [0, 0, 0] },
    { element: 'H', pos: [oh * Math.sin(halfAngle), oh * Math.cos(halfAngle), 0] },
    { element: 'H', pos: [-oh * Math.sin(halfAngle), oh * Math.cos(halfAngle), 0] },
  ];
  const atoms = local.map((item) => {
    const [rx, ry, rz] = rotatePoint(item.pos, rot[0], rot[1], rot[2]);
    return {
      element: item.element,
      x: Number((rx + offset[0]).toFixed(4)),
      y: Number((ry + offset[1]).toFixed(4)),
      z: Number((rz + offset[2]).toFixed(4)),
    };
  });
  const bonds: BondPair[] = [
    { a: 0, b: 1, order: 1 },
    { a: 0, b: 2, order: 1 },
  ];
  return { atoms, bonds };
}

function buildEthanolMolecule(
  offset: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): { atoms: AtomPoint[]; bonds: BondPair[] } {
  // Realistic 3D ethanol geometry (C1-C2-O-H + 5 H)
  const local: { element: AtomElement; pos: [number, number, number] }[] = [
    { element: 'C', pos: [-1.18, -0.22, 0.0] }, // 0: methyl C
    { element: 'C', pos: [0.24, 0.34, 0.0] },   // 1: methylene C
    { element: 'O', pos: [1.18, -0.74, 0.0] },  // 2: hydroxyl O
    { element: 'H', pos: [2.08, -0.39, 0.0] },  // 3: hydroxyl H (points +x)
    { element: 'H', pos: [-1.89, 0.61, 0.0] },  // 4: methyl H1
    { element: 'H', pos: [-1.36, -0.83, 0.89] },// 5: methyl H2
    { element: 'H', pos: [-1.36, -0.83, -0.89] },// 6: methyl H3
    { element: 'H', pos: [0.42, 0.96, 0.89] },  // 7: methylene H1
    { element: 'H', pos: [0.42, 0.96, -0.89] }, // 8: methylene H2
  ];
  const atoms = local.map((item) => {
    const [rx, ry, rz] = rotatePoint(item.pos, rot[0], rot[1], rot[2]);
    return {
      element: item.element,
      x: Number((rx + offset[0]).toFixed(4)),
      y: Number((ry + offset[1]).toFixed(4)),
      z: Number((rz + offset[2]).toFixed(4)),
    };
  });
  const bonds: BondPair[] = [
    { a: 0, b: 1, order: 1 },
    { a: 1, b: 2, order: 1 },
    { a: 2, b: 3, order: 1 },
    { a: 0, b: 4, order: 1 },
    { a: 0, b: 5, order: 1 },
    { a: 0, b: 6, order: 1 },
    { a: 1, b: 7, order: 1 },
    { a: 1, b: 8, order: 1 },
  ];
  return { atoms, bonds };
}

function mergeMolecules(
  mols: { atoms: AtomPoint[]; bonds: BondPair[] }[],
): { atoms: AtomPoint[]; bonds: BondPair[] } {
  const atoms: AtomPoint[] = [];
  const bonds: BondPair[] = [];
  for (const m of mols) {
    const base = atoms.length;
    atoms.push(...m.atoms);
    for (const b of m.bonds) {
      bonds.push({ a: b.a + base, b: b.b + base, order: b.order });
    }
  }
  return { atoms, bonds };
}

export function getAllMoleculeScenes(): MoleculeSceneSpec[] {
  // 1. 5 H2O molecules before mixing (compact space-filling with small gaps)
  const waterBefore = mergeMolecules([
    buildWaterMolecule([-1.6, 1.1, 0.2], [0.4, 0.2, 0.5]),
    buildWaterMolecule([1.5, 1.2, -0.3], [-0.3, 0.9, -0.4]),
    buildWaterMolecule([0.0, -0.1, 0.6], [0.8, -0.4, 0.2]),
    buildWaterMolecule([-1.4, -1.4, -0.4], [-0.5, 0.6, 1.1]),
    buildWaterMolecule([1.6, -1.2, 0.3], [0.2, -0.9, -0.6]),
  ]);

  // 2. 4 C2H5OH molecules before mixing (bulky chains creating larger voids)
  const ethanolBefore = mergeMolecules([
    buildEthanolMolecule([-2.5, 1.8, 0.4], [0.3, 0.4, -0.2]),
    buildEthanolMolecule([2.4, 1.9, -0.6], [-0.4, 2.2, 0.5]),
    buildEthanolMolecule([-2.2, -1.9, -0.5], [0.6, -1.1, 0.8]),
    buildEthanolMolecule([2.5, -1.7, 0.6], [-0.2, -2.5, -0.4]),
  ]);

  // 3. Side-by-side comparison: H2O (left) vs C2H5OH (right)
  const compareWater = buildWaterMolecule([-2.3, 0.0, 0.0], [0.15, 0.25, -0.1]);
  const compareEthanol = buildEthanolMolecule([1.6, 0.0, 0.0], [0.1, -0.3, 0.15]);
  const comparePair = mergeMolecules([compareWater, compareEthanol]);

  // 4. Hydrogen bond after mixing: Ethanol -O-H pointing directly toward Water O
  // Ethanol O at (1.18 - 1.95 = -0.77, -0.74 + 0.39 = -0.35, 0)
  // Ethanol H (hydroxyl) at (2.08 - 1.95 = 0.13, -0.39 + 0.39 = 0.00, 0)
  const hbondEthanol = buildEthanolMolecule([-1.95, 0.39, 0.0], [0, 0, 0]);
  // Water O placed at (1.92, 0.0, 0.0) -> H···O distance = 1.92 - 0.13 = 1.79 A
  // Water H atoms point outward to +x/+y and +x/-y
  const hbondWater = buildWaterMolecule([1.92, 0.0, 0.0], [0, 0, -Math.PI / 2]);
  const hbondAfter = mergeMolecules([hbondEthanol, hbondWater]);

  const donorH = hbondEthanol.atoms[3];
  const acceptorO = hbondWater.atoms[0];

  return [
    {
      id: 'water_before',
      title: '1) น้ำก่อนผสม (5 โมเลกุล H₂O)',
      atoms: waterBefore.atoms,
      bonds: waterBefore.bonds,
      styleMode: 'spacefill',
    },
    {
      id: 'ethanol_before',
      title: '2) เอทิลแอลกอฮอล์ก่อนผสม (4 โมเลกุล C₂H₅OH)',
      atoms: ethanolBefore.atoms,
      bonds: ethanolBefore.bonds,
      styleMode: 'spacefill',
    },
    {
      id: 'compare_pair',
      title: '3) เปรียบเทียบโครงสร้างและขนาด',
      atoms: comparePair.atoms,
      bonds: comparePair.bonds,
      styleMode: 'compare',
      compareSplitIndex: compareWater.atoms.length,
    },
    {
      id: 'hbond_after',
      title: '4) การเกิดพันธะไฮโดรเจนหลังผสม',
      atoms: hbondAfter.atoms,
      bonds: hbondAfter.bonds,
      styleMode: 'hbond',
      hBondSegment: {
        start: [donorH.x, donorH.y, donorH.z],
        end: [acceptorO.x, acceptorO.y, acceptorO.z],
      },
    },
  ];
}

/**
 * Generates an MDL SDF (V2000) block so 3Dmol.js renders exact covalent bonds and spheres.
 */
export function toSDF(scene: MoleculeSceneSpec): string {
  const lines: string[] = [
    scene.id,
    '  ChemSim3D',
    '',
  ];
  const atomCount = String(scene.atoms.length).padStart(3, ' ');
  const bondCount = String(scene.bonds.length).padStart(3, ' ');
  lines.push(`${atomCount}${bondCount}  0  0  0  0  0  0  0  0999 V2000`);

  for (const atom of scene.atoms) {
    const x = atom.x.toFixed(4).padStart(10, ' ');
    const y = atom.y.toFixed(4).padStart(10, ' ');
    const z = atom.z.toFixed(4).padStart(10, ' ');
    const elem = atom.element.padEnd(3, ' ');
    lines.push(`${x}${y}${z} ${elem} 0  0  0  0  0  0  0  0  0  0  0  0`);
  }

  for (const bond of scene.bonds) {
    const a = String(bond.a + 1).padStart(3, ' ');
    const b = String(bond.b + 1).padStart(3, ' ');
    const order = String(bond.order).padStart(3, ' ');
    lines.push(`${a}${b}${order}  0  0  0  0`);
  }

  lines.push('M  END');
  lines.push('$$$$');
  return lines.join('\n');
}
