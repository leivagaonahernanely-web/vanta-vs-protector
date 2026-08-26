export const LUA_SOURCE_LIMIT = 150_000;

export function validateLuaFile(file: Pick<File, "name" | "size">) {
  if (!file.name.toLowerCase().endsWith(".lua")) return "Selecciona un archivo .lua";
  if (file.size > LUA_SOURCE_LIMIT) return "El archivo supera el límite de 150 KB";
  return null;
}

export function readLuaFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Formato de archivo no compatible"));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo Lua"));
    reader.readAsText(file);
  });
}
