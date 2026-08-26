# Project TODO

- [x] Landing pública responsive con la marca exacta “Vanta.vs Protector”
- [x] Estética brutalista: fondo negro, tipografía sans-serif condensada blanca, divisor rojo de ancho completo y layout centrado
- [x] Propuesta de valor y llamadas a la acción claras
- [x] Flujo de acceso mediante la autenticación existente del proyecto
- [x] Panel de usuario para iniciar una protección de script Lua
- [x] Editor para pegar código Lua y opciones visibles de protección
- [x] Área de resultados con estado, previsualización, copia y descarga
- [x] Persistencia de protecciones y actividad por usuario
- [x] Integración de Client ID y Client Secret únicamente en variables de entorno del servidor
- [x] Servicio servidor para ejecutar la protección y manejar estados de éxito, fallo y revisión
- [x] Notificación al propietario cuando una protección falle o requiera revisión
- [x] Pruebas Vitest para protección, persistencia, errores y seguridad de configuración
- [x] Validación visual responsive y revisión de consola/red

- [x] Conectar un proveedor real en servidor usando VANTA_CLIENT_ID y VANTA_CLIENT_SECRET, con endpoint autenticado y handshake verificable
- [x] Hacer que mode y obfuscateStrings transformen materialmente el artefacto Lua, no solo sus comentarios
- [x] Manejar notifyOwner() con reintento o fallback no bloqueante y validar su resultado
- [x] Añadir pruebas Vitest para create, history, persistencia, estados y notificaciones

- [x] Configurar la conexión servidor-servidor con el bot de Discord usando sus credenciales privadas
- [x] Definir el canal o método de Discord para avisos de fallos y revisiones

- [x] Crear callback OAuth de Discord con state/nonce y cookies seguras
- [x] Añadir botón de acceso de Discord y mostrar la identidad autenticada en el panel
- [x] Asociar la cuenta Discord con el usuario y evitar exponer Client Secret en el cliente
- [x] Añadir pruebas del callback OAuth y de rechazo de state inválido

- [x] Confirmar conexión del bot instalado con un aviso de prueba sin exponer el token
- [x] Añadir en el panel un campo de ID de canal por usuario y validarlo antes de enviar avisos

- [x] Hacer que obfuscateStrings cambie materialmente el artefacto y cubrirlo con una prueba comparativa
- [x] Persistir discordChannelId como preferencia por usuario y reutilizarlo automáticamente
- [x] Comprobar el resultado de los avisos y registrar cuando fallen ambos canales
- [x] Añadir cobertura de tests para create/history y un aviso Discord simulado sin exponer el token

- [x] Añadir tests Vitest para protections.create y protections.history con appRouter.createCaller y estados protected/review/failed
- [x] Añadir tests de persistencia para updateDiscordChannelId, createProtection y getProtectionsByUser

- [x] Añadir pruebas directas de db.ts para updateDiscordChannelId, createProtection y getProtectionsByUser con mock de Drizzle

- [x] Mostrar explícitamente el nombre o ID de Discord vinculado dentro del panel
- [x] Añadir test del camino exitoso del callback OAuth con intercambio de token y vinculación de identidad

- [x] Añadir una prueba de éxito del callback Discord que simule token, identidad y vinculación

- [x] Rediseñar la pantalla pública y el panel hacia un dashboard oscuro, compacto y limpio inspirado en la nueva referencia
- [x] Añadir hosting persistente de scripts Lua con slug o ID público y endpoint GET de contenido
- [x] Generar y mostrar el loader exacto `loadstring(game:HttpGet("URL"))()` con copiar y descargar
- [x] Añadir pruebas de creación, lectura pública y control de acceso de scripts alojados
- [x] Validar el video y comparar visualmente el flujo de hosting con la referencia

- [x] Cambiar el flujo de hosting para mostrar una página pública sin source y solo loader
- [x] Añadir vista privada de dashboard para administrar scripts alojados
- [ ] Generar loader con URL pública estable y opción de script_key cuando corresponda
- [ ] No presentar la protección básica como Luraph; dejar adapter preparado para API oficial/licenciada

- [x] Añadir botón o acción real de descarga para el loader o el script alojado
- [x] Crear pruebas Vitest para hostedScripts.create y hostedScripts.list con acceso autenticado y no autenticado
