export const LUA_SOURCE_LIMIT = 150_000;

export function validateLuaFile(file: Pick<File, "name" | "size">) {
  if (!file.name.toLowerCase().endsWith(".lua")) return "Selecciona un archivo .lua";
  if (file.size > LUA_SOURCE_LIMIT) return "El archivo supera el límite de 150 KB";
  return null;
}
