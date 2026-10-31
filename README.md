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

## Pendiente

- Cuentas con email y contraseña, NX_KEY para Premium, API key única por cuenta con regeneración y dominio, panel de admin para generar keys.
- Macros `NXT_LPH_PROTECCION` y `NXT_LPH_OPTIMIZACION`.
- Varargs, `for` genérico y retornos múltiples en el compilador.
- Migración de base de datos para el nuevo esquema de `users` (generar con `pnpm db:push` en un entorno con base de datos).
