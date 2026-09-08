/**
 * SOPHENIC DESIGN — canon des matériaux : normalise un matériau libre
 * (« walnut clair », « travertine »…) vers le nom canonique du projet.
 */
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const MATERIAL_CANON: Array<[RegExp, string]> = [
  [/travertin|travertine/, "Travertin ivoire"],
  [/marbre|marble|calacatta|carrara/, "Marbre Calacatta clair"],
  [/noyer|walnut/, "Noyer fumé"],
  [/ch[eê]ne|oak/, "Chêne naturel"],
  [/laiton|brass|gold|dor/, "Laiton brossé"],
  [/velours|velvet/, "Velours ivoire"],
  [/boucl/, "Bouclé sable"],
  [/verre|glass/, "Verre extra-clair"],
  [/pierre calcaire|limestone/, "Pierre calcaire"],
  [/lin|linen/, "Lin ivoire"],
  [/cuir|leather/, "Cuir cognac"],
  [/b[eé]ton|concrete/, "Béton ciré chaud"],
  [/bronze/, "Bronze patiné"],
  [/m[eé]tal noir|black metal/, "Métal noir satiné"]
];

export function canonicalMaterialText(value: string): string | null {
  const clean = norm(value).replace(/[.;]/g, "").trim();
  if (!clean || clean.length > 60) return null;
  for (const [pattern, name] of MATERIAL_CANON) if (pattern.test(clean)) return name;
  const pretty = value.trim().replace(/\s+/g, " ");
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : null;
}
