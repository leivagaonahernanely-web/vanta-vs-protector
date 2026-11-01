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

## Macros de control

- `--NXT_LPH_OPTIMIZACION` ... `--NXT_LPH_OPTIMIZACION_END`: el bloque se emite como Lua nativo, sin virtualizar. Es la opción recomendada para código que se ejecuta muchas veces.
- `--NXT_LPH_PROTECCION` ... `--NXT_LPH_PROTECCION_END`: si el archivo tiene alguno, solo esos bloques se virtualizan y el resto queda como Lua normal.
- Los comentarios de los bloques nativos se eliminan en la salida.
- Las variables locales no pueden cruzar los límites de un bloque nativo.

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
- La VM es más lenta que Lua nativo. Para código que se ejecuta muchas veces, usa `--NXT_LPH_OPTIMIZACION`.
- La verificación de equivalencia se hizo contra Lua 5.3 (`texlua`). Antes de usarlo en producción, ejecuta `NX_LUA_BIN=lua5.1 pnpm test` con un intérprete Lua 5.1.

## Pendiente

- Cuentas con email y contraseña, NX_KEY para Premium, API key única por cuenta con regeneración y dominio, panel de admin para generar keys.
- Reducir el costo por llamada en la VM: cada cierre crea una tabla `{...}` y usa `select`. Los argumentos extra ya no se copian, pero el costo principal es el despacho de instrucciones, que es estructural en un intérprete escrito en Lua.
- Migración de base de datos para el nuevo esquema de `users` (generar con `pnpm db:push` en un entorno con base de datos).
