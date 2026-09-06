/**
 * SOPHENIC DESIGN — parse des pièces demandées explicitement dans un prompt
 * (« trois chambres », « deux salles de bain »…).
 */
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parseRoomRequests(instruction: string): Array<{ name: string; usage: string }> {
  const text = norm(instruction);
  const word: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7 };
  const count = (singular: string, plural: string) => {
    const match = text.match(new RegExp(`(?:\\b(\\d+)\\b|\\b(un|une|deux|trois|quatre|cinq|six|sept)\\b)\\s+${plural}`));
    if (match) return Number(match[1] || word[match[2]] || 0);
    return new RegExp(`\\b${singular}\\b`).test(text) ? 1 : 0;
  };
  const rooms: Array<{ name: string; usage: string }> = [];
  if (/salon|sejour|séjour|living/.test(text)) rooms.push({ name: "Salon", usage: "living" });
  if (/cuisine/.test(text)) rooms.push({ name: "Cuisine", usage: "kitchen" });
  if (/salle a manger|salle à manger|dining/.test(text)) rooms.push({ name: "Salle à manger", usage: "dining" });
  const bedrooms = count("chambre", "chambres?");
  for (let index = 1; index <= bedrooms; index += 1) rooms.push({ name: bedrooms === 1 ? "Chambre" : `Chambre ${index}`, usage: "bedroom" });
  const bathrooms = Math.max(count("salle de bain", "salles? de bains?"), count("sdb", "sdb"));
  for (let index = 1; index <= bathrooms; index += 1) rooms.push({ name: bathrooms === 1 ? "Salle de bain" : `Salle de bain ${index}`, usage: "bathroom" });
  if (/bureau|office/.test(text)) rooms.push({ name: "Bureau", usage: "office" });
  if (/garage/.test(text)) rooms.push({ name: "Garage", usage: "garage" });
  if (/terrasse/.test(text)) rooms.push({ name: "Terrasse", usage: "terrace" });
  return rooms.slice(0, 20);
}
