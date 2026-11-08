# NextOfuscator

Ofuscador de scripts Lua. Compila el código a bytecode de una VM propia y genera un archivo Lua autocontenido que contiene el runtime y el bytecode, con una tabla de opcodes distinta en cada ejecución.

## Estructura

- `server/obfuscator/`: motor de ofuscación (lexer, parser, compilador, VM de referencia, runtime Lua y generador de archivos).
- `server/routers.ts`: API tRPC (`auth` y `obfuscator.run`).
- `client/src/pages/Home.tsx`: pantalla del ofuscador.

## Validación local

```bash
pnpm check
pnpm test
pnpm build
```

Las pruebas de equivalencia con Lua real se activan con `NX_LUA_BIN=lua5.1 pnpm test` (requiere un intérprete Lua 5.1 instalado).

Benchmark de la VM (compara Lua nativo, VM por defecto y VM con macros en cargas típicas):

```bash
NX_LUA_BIN=lua5.1 RUNS=5 pnpm tsx scripts/bench/run.ts
```

Los números dependen de la máquina y del intérprete. Compara siempre variantes en el mismo entorno.

## Macros de control

- `--NXT_LPH_OPTIMIZACION` ... `--NXT_LPH_OPTIMIZACION_END`: el bloque se emite como Lua nativo, sin virtualizar. Es la opción recomendada para código que se ejecuta muchas veces.
- `--NXT_LPH_PROTECCION` ... `--NXT_LPH_PROTECCION_END`: si el archivo tiene alguno, solo esos bloques se virtualizan y el resto queda como Lua normal.
- Los comentarios de los bloques nativos se eliminan en la salida.
- Las variables locales no pueden cruzar los límites de un bloque nativo.
- Los macros deben ir a nivel principal. Si uno queda dentro de una función o de un bloque, el error indica la línea exacta del macro.
- Para bucles calientes, lo recomendado es marcarlos con `--NXT_LPH_OPTIMIZACION`. En el benchmark, marcar los bucles deja el tiempo casi igual al de Lua nativo, mientras que el resto del código sigue en la VM.
- Las ramas de código muerto solo se insertan en sentencias de nivel principal. Dentro de bucles y funciones se ejecutarían en cada vuelta o llamada, y su costo variaba mucho según la semilla (hasta el doble en una función caliente). Esto reduce el ruido del bytecode dentro de funciones: es un cambio de protección que se hizo a propósito por rendimiento.

## Lenguaje soportado

- Expresiones, aritmética, concatenación, comparaciones, `and`/`or`/`not` con cortocircuito.
- Variables locales y globales, tablas (constructores, `.`, `[]`, `#`), métodos con `:`.
- Control de flujo: `if`/`elseif`/`else`, `while`, `repeat`/`until`, `for` numérico, `for` genérico (`in`), `break`.
- Funciones, recursión, closures con captura de variables, `...` (varargs), retornos múltiples y expansión de listas en llamadas, tablas y asignaciones.
- Metatablas completas: `setmetatable`/`getmetatable`/`rawget`/`rawset`/`rawequal`, herencia con `__index`
  (tabla o función), `__newindex`, y sobrecarga de operadores (`__add`, `__sub`, `__mul`, `__div`, `__mod`,
  `__pow`, `__unm`, `__concat`, `__eq`, `__lt`, `__le`, `__len`, `__call`, `__tostring`). Esto es lo que
  necesita cualquier patrón de clases/herencia en Lua 5.1 (`setmetatable({}, {__index = Base})`).
- Cadenas de los opcodes, nombres globales y constantes de texto van cifrados en la salida.

No soportado todavía: sintaxis de Lua 5.2+ (`goto`/etiquetas, escapes `\x`/`\z`), de Lua 5.3+
(operadores bitwise, `//`) ni de Lua 5.4 (atributos `<const>`/`<close>`). El objetivo actual es Lua 5.1.

## Límites conocidos

- `#` sobre tablas con huecos (nil en medio del arreglo) puede devolver un valor distinto al de Lua nativo. Las tablas sin huecos funcionan igual.
- La VM es mucho más lenta que Lua nativo: en el benchmark, unas 22 veces en total (medido con texlua, no con Lua 5.1). Para código que se ejecuta muchas veces, usa `--NXT_LPH_OPTIMIZACION`.
- La verificación de equivalencia se hizo contra Lua 5.3 (`texlua`). Antes de usarlo en producción, ejecuta `NX_LUA_BIN=lua5.1 pnpm test` con un intérprete Lua 5.1.
- Las cadenas y nombres no son un secreto frente a quien lea el archivo de salida: la clave de descifrado viaja junto al runtime. La ofuscación dificulta la lectura, no impide el análisis.

## Pendiente

- Cuentas con email y contraseña, NX_KEY para Premium, API key única por cuenta con regeneración y dominio, panel de admin para generar keys.
- Reducir el costo del despacho en la VM: hoy cada instrucción se resuelve con un árbol de comparaciones y se ejecutan unas 26 instrucciones por iteración en un bucle simple. Siguientes pasos: fusionar secuencias frecuentes (por ejemplo `LOCAL_GET + CONST + BIN`) y dar más peso a las instrucciones comunes en el árbol. Medir antes y después con el benchmark.
- Migración de base de datos para el nuevo esquema de `users` (generar con `pnpm db:push` en un entorno con base de datos).
