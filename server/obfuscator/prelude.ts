// Bloque previo al runtime: en Roblox espera dos Heartbeat antes de ejecutar el script protegido.
// Los nombres de la API de Roblox se escriben como códigos de carácter, así no aparecen como texto.
// Queda desactivado fuera de Roblox, donde `game` no existe.

// Convierte un nombre en una llamada N(0x..,0x..) que devuelve la cadena.
const N = (name: string): string =>
  `N(${[...name].map((c) => "0x" + c.charCodeAt(0).toString(16)).join(",")})`;

// Dos formas equivalentes de esperar dos Heartbeat; la semilla elige una en cada compilación.
// Variante 0: cuenta los disparos y espera con task.wait. Variante 1: usa Wait dos veces.
const WAIT_VARIANTS = [
  `local function N(...)
  local t = { ... }
  for i = 1, #t do t[i] = string.char(t[i]) end
  return table.concat(t)
end
if game ~= nil and type(game[${N("GetService")}]) == "function" then
  do
    local ran = 0
    local svc = game[${N("GetService")}](game, ${N("RunService")})
    local hb = svc[${N("Heartbeat")}]
    local conn = hb[${N("Connect")}](hb, function()
      ran = ran + 1
    end)
    repeat
      task[${N("wait")}]()
    until ran >= 2
    conn[${N("Disconnect")}](conn)
  end
end
`,
  `local function N(...)
  local t = { ... }
  for i = 1, #t do t[i] = string.char(t[i]) end
  return table.concat(t)
end
if game ~= nil and type(game[${N("GetService")}]) == "function" then
  do
    local hb = game[${N("GetService")}](game, ${N("RunService")})[${N("Heartbeat")}]
    hb[${N("Wait")}](hb)
    hb[${N("Wait")}](hb)
  end
end
`,
];

export function preludeLua(seed: number): string {
  return WAIT_VARIANTS[seed % WAIT_VARIANTS.length];
}
