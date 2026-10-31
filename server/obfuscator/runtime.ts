// Runtime de la VM escrito en Lua 5.1. Se incrusta en cada archivo de salida junto con el
// bytecode. Debe ser compatible con Lua 5.1: sin goto, sin enteros, sin operadores de bits.
// Replica la semántica de la VM de referencia en vm.ts.
export const RUNTIME_LUA = `local function nx_run(P)
  local protos, consts, names, bops = P.protos, P.consts, P.names, P.ops
  local opnames = P.opnames
  local max_steps = P.max_steps or 1000000
  local unpack = unpack or table.unpack
  local fmt = string.format
  local env = _G
  local depth, steps = 0, 0
  local run_proto

  local function fail(msg) error(msg, 0) end

  local function typename(v)
    if v == nil then return "nil" end
    return type(v)
  end

  local function number(v, what)
    if type(v) ~= "number" then
      fail("intento de " .. what .. " sobre un valor de tipo " .. typename(v))
    end
    return v
  end

  local function tostr(v)
    local t = type(v)
    if t == "string" then return v end
    if t == "number" then return fmt("%.14g", v) end
    if v == nil then return "nil" end
    return tostring(v)
  end

  local function concatpart(v)
    if type(v) == "string" or type(v) == "number" then return tostr(v) end
    fail("intento de concatenar un valor de tipo " .. typename(v))
  end

  local function truthy(v)
    return v ~= nil and v ~= false
  end

  local function binary(op, l, r)
    if op == "+" then return number(l, "sumar") + number(r, "sumar")
    elseif op == "-" then return number(l, "restar") - number(r, "restar")
    elseif op == "*" then return number(l, "multiplicar") * number(r, "multiplicar")
    elseif op == "/" then return number(l, "dividir") / number(r, "dividir")
    elseif op == "%" then
      local a = number(l, "calcular módulo")
      local b = number(r, "calcular módulo")
      return a - math.floor(a / b) * b
    elseif op == "^" then return number(l, "elevar") ^ number(r, "elevar")
    elseif op == ".." then return concatpart(l) .. concatpart(r)
    elseif op == "==" then return l == r
    elseif op == "~=" then return l ~= r
    elseif op == "<" or op == "<=" or op == ">" or op == ">=" then
      local tl, tr = type(l), type(r)
      if tl ~= tr or (tl ~= "number" and tl ~= "string") then
        fail("no se puede comparar " .. typename(l) .. " con " .. typename(r))
      end
      if op == "<" then return l < r
      elseif op == "<=" then return l <= r
      elseif op == ">" then return l > r
      end
      return l >= r
    end
    fail("operador binario desconocido " .. tostring(op))
  end

  local function unary(op, v)
    if op == "-" then return -number(v, "negar") end
    if op == "not" then return not truthy(v) end
    if op == "#" then
      if type(v) == "string" then return string.len(v) end
      if type(v) == "table" then
        local n = 0
        while v[n + 1] ~= nil do n = n + 1 end
        return n
      end
      fail("intento de obtener longitud de un valor de tipo " .. typename(v))
    end
    fail("operador unario desconocido " .. tostring(op))
  end

  local function index(obj, key)
    if type(obj) == "table" then return obj[key] end
    if type(obj) == "string" then
      local lib = env.string
      if type(lib) == "table" then return lib[key] end
      return nil
    end
    fail("intento de indexar un valor de tipo " .. typename(obj))
  end

  local function setindex(obj, key, value)
    if type(obj) ~= "table" then
      fail("intento de asignar a un valor de tipo " .. typename(obj))
    end
    if key == nil then fail("índice nil") end
    if key ~= key then fail("índice NaN") end
    obj[key] = value
  end

  local function call(callee, args, n)
    if type(callee) ~= "function" then
      fail("se intentó llamar a un valor de tipo " .. typename(callee))
    end
    return (callee(unpack(args, 1, n)))
  end

  local function make_closure(index_, ups)
    local proto = protos[index_]
    return function(...)
      return run_proto(proto, ups, { ... }, select("#", ...))
    end
  end

  run_proto = function(proto, ups, args, nargs)
    depth = depth + 1
    if depth > 200 then fail("desbordamiento de la pila de llamadas") end

    local code = proto.code
    local cells = {}
    for i = 0, proto.slots - 1 do cells[i] = {} end
    for i = 0, proto.params - 1 do cells[i] = { v = args[i + 1] } end

    local stack, sp = {}, 0
    local function push(v)
      sp = sp + 1
      stack[sp] = v
    end
    local function pop()
      if sp == 0 then fail("pila vacía") end
      local v = stack[sp]
      stack[sp] = nil
      sp = sp - 1
      return v
    end

    local pc = 0
    while true do
      steps = steps + 1
      if steps > max_steps then fail("límite de ejecución superado") end
      local id, a = code[2 * pc + 1], code[2 * pc + 2]
      pc = pc + 1
      local op = opnames[id + 1]

      if op == "CONST" then push(consts[a + 1])
      elseif op == "LOCAL_GET" then push(cells[a].v)
      elseif op == "LOCAL_SET" then cells[a].v = pop()
      elseif op == "DECL" then cells[a] = { v = pop() }
      elseif op == "GLOBAL_GET" then push(env[names[a + 1]])
      elseif op == "GLOBAL_SET" then env[names[a + 1]] = pop()
      elseif op == "UP_GET" then push(ups[a + 1].v)
      elseif op == "UP_SET" then ups[a + 1].v = pop()
      elseif op == "BIN" then
        local r = pop()
        local l = pop()
        push(binary(bops[a + 1], l, r))
      elseif op == "UN" then push(unary(bops[a + 1], pop()))
      elseif op == "JMP" then pc = a
      elseif op == "JMPF" then
        if not truthy(pop()) then pc = a end
      elseif op == "JMPT" then
        if truthy(pop()) then pc = a end
      elseif op == "DUP" then
        local v = pop()
        push(v)
        push(v)
      elseif op == "POP" then pop()
      elseif op == "SWAP" then
        local b = pop()
        local c = pop()
        push(b)
        push(c)
      elseif op == "CALL" then
        local args_ = {}
        for i = a, 1, -1 do args_[i] = pop() end
        local callee = pop()
        push(call(callee, args_, a))
      elseif op == "RET" then
        depth = depth - 1
        return pop()
      elseif op == "CLOSURE" then
        local child = protos[a + 1]
        local child_ups = {}
        for i = 1, #child.up do
          local d = child.up[i]
          if d[1] == 1 then child_ups[i] = cells[d[2]]
          else child_ups[i] = ups[d[2] + 1] end
        end
        push(make_closure(a + 1, child_ups))
      elseif op == "NEWTABLE" then push({})
      elseif op == "INDEX" then
        local key = pop()
        local obj = pop()
        push(index(obj, key))
      elseif op == "SETINDEX" then
        local value = pop()
        local key = pop()
        local obj = pop()
        setindex(obj, key, value)
      else
        fail("operación desconocida " .. tostring(id))
      end
    end
  end

  return run_proto(protos[1], {}, {}, 0)
end
`;
