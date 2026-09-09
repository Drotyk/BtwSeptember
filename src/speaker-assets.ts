import { resolve } from "node:path";

export interface SpeakerAsset {
  id: string;
  name: string;
  filename: string;
  contentType: "image/jpeg";
}

/**
 * Фото, які постачаються разом із застосунком.
 * У БД зберігаємо лише стабільний ідентифікатор `asset:<id>`, а не шлях із
 * файлової системи. Це дозволяє безпечно використовувати ті самі assets у
 * development і в Docker.
 */
export const SPEAKER_ASSETS: readonly SpeakerAsset[] = [
  {
    id: "serhiy-prytula",
    name: "Сергій Притула",
    filename: "Serhiy_Prytula.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "oleksandr-grabovsky",
    name: "Олександр Грабовський",
    filename: "Grabovsky_Oleksandr.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "borovik-konstantin",
    name: "Костянтин Боровик",
    filename: "Borovik_Konstantin.jpg",
    contentType: "image/jpeg",
  },
  {
    id: "serhiy-androschuk",
    name: "Сергій Андрощук",
    filename: "Serhiy_Androschuk.jpg",
    contentType: "image/jpeg",
  },
];

export function getSpeakerAsset(id: string): SpeakerAsset | undefined {
  return SPEAKER_ASSETS.find((asset) => asset.id === id);
}

export function speakerAssetId(value: string): string | null {
  const prefix = "asset:";
  if (!value.startsWith(prefix)) return null;
  const id = value.slice(prefix.length);
  return getSpeakerAsset(id) ? id : null;
}

export function speakerAssetPath(asset: SpeakerAsset): string {
  return resolve(process.cwd(), "seeker", asset.filename);
}
