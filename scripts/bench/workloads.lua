-- Cargas de referencia para medir la VM. Cada bloque imprime un checksum para verificar que
-- la salida ofuscada coincide con la nativa.

-- 1) Llamadas recursivas.
local function fib(n)
  if n < 2 then return n end
  return fib(n - 1) + fib(n - 2)
end
print("fib", fib(22))

-- 2) Bucle numérico con aritmética y comparaciones.
local acc = 0
for i = 1, 300000 do
  if i % 3 == 0 then acc = acc + i * 2
  elseif i % 5 == 1 then acc = acc - i
  else acc = acc + 1 end
end
print("loop", acc)

-- 3) Tablas: llenado y suma.
local t = {}
for i = 1, 60000 do t[i] = i * 2 end
local s = 0
for i = 1, #t do s = s + t[i] end
print("tabla", s)

-- 4) Closures con upvalues.
local function counter()
  local c = 0
  return function(d) c = c + d return c end
end
local inc = counter()
local last
for i = 1, 60000 do last = inc(1) end
print("closure", last)

-- 5) Objetos con metatablas y métodos.
local Point = {}
Point.__index = Point
function Point.new(x, y) return setmetatable({ x = x, y = y }, Point) end
function Point:add(o) return Point.new(self.x + o.x, self.y + o.y) end
local p = Point.new(0, 0)
for i = 1, 20000 do p = p:add(Point.new(1, 2)) end
print("objeto", p.x, p.y)

-- 6) Cadenas.
local parts = {}
for i = 1, 5000 do parts[#parts + 1] = "x" .. i end
print("cadena", #table.concat(parts, ","))
