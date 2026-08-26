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
- [x] Generar loader con URL pública estable y opción de script_key cuando corresponda
- [x] No presentar la protección básica como Luraph; dejar adapter preparado para API oficial/licenciada

- [x] Añadir botón o acción real de descarga para el loader o el script alojado
- [x] Crear pruebas Vitest para hostedScripts.create y hostedScripts.list con acceso autenticado y no autenticado

- [x] Añadir scriptKey opcional al modelo de scripts alojados y al loader generado
- [x] Crear una interfaz de adapter de proveedor que deje claro cuándo existe una integración oficial licenciada

- [x] Exponer official/provider del adapter en providerStatus y mostrarlo en el panel
- [x] Probar fallback local y adapter oficial registrado sin sugerir compatibilidad falsa con Luraph

- [x] Diagnosticar por qué el bot aparece apagado y documentar el proceso de ejecución persistente
- [x] Crear modelo de licencias con keys automáticas de 10 dígitos y tipo trial separado de key
- [x] Implementar generación, eliminación, revocación y reset de HWID
- [x] Implementar blacklist de usuarios con motivo y estado
- [x] Implementar whitelist de usuarios y roles de Discord
- [x] Implementar pantalla Setup para configurar script, permisos, trial y canal
- [x] Añadir endpoints protegidos para administrar licencias y listas de acceso
- [x] Rediseñar la UI del panel con navegación y estados reales para cada función
- [x] Añadir pruebas de autorización, generación de keys, trial, blacklist, whitelist y reset HWID

- [x] Verificar si el estado “apagado” corresponde a proceso no iniciado, token, intents, comandos no sincronizados o indicador del panel
- [x] Corregir la causa comprobable sin activar Reserved Hosting por suposición

- [x] Mantener sin cambios el hosting G/script loader mientras se depura Discord
- [x] Diagnosticar exclusivamente el estado apagado del bot y sus comandos slash

- [x] Documentar en el proyecto cómo se inicia y verifica el Gateway del bot Discord
- [x] Implementar borrado real de licencias separado de revocación
- [x] Completar Setup con script, permisos, trial y canal Discord
- [x] Añadir pruebas de no autenticado, reset HWID, revocación y borrado

- [x] Integrar en Setup los campos de script, permisos, trial y canal Discord en una sola vista
- [x] Añadir persistencia local y validación visible del estado de configuración de Setup
- [x] Añadir prueba verificable de la configuración integrada de Setup

- [x] Mostrar en Setup un estado visible de guardado y validez del canal/configuración
- [x] Crear prueba específica de Setup para persistencia local y updateChannel

- [x] Añadir prueba frontend o helper de Setup para localStorage, estado visible y updateChannel con ID válido o null

- [x] Replicar la división visual del /panel del video con botones View Script, Redeem Key, Stats, Get Buyer Role y Reset HWID
- [x] Implementar todos los comandos slash del bot como acciones funcionales y autorizadas
- [x] Permitir cargar scripts Lua desde archivos además de pegar source
- [x] Restringir la consulta de source a la cuenta propietaria y mantener endpoints públicos sin source visible
- [x] Añadir pruebas de permisos, acciones Discord, carga de archivos y privacidad de source
- [x] Verificar responsive y regresiones del hosting, licencias, blacklist, whitelist y Setup

- [x] Mantener la source visible solo desde la web privada del propietario; retirar cualquier propuesta de /viewscript en Discord
- [x] Rediseñar /panel con mensaje explicativo y botones Redeem Key, Get Script, Get Role, Reset HWID y Get Stats según la referencia
- [x] Añadir /generatekeyrol para configurar el rol autorizado a generar y eliminar keys
- [x] Permitir que el rol configurado ejecute generación y eliminación de keys con auditoría y límites
- [x] Responder el flujo whitelist con embed de resumen, conteos y canal de acceso como en la referencia

- [x] Persistir la source original separada del artefacto protegido y exponerla solo al propietario autenticado
- [x] Añadir pruebas owner-only para hostedScripts.source, autenticación y comandos slash
- [x] Implementar auditoría y límites reales para generación/eliminación de keys por rol delegado
- [x] Calcular conteos reales de whitelist y manejar duplicados y fallos

- [x] Ajustar /panel para que publique el embed público con título, descripción, colores, filas y textos equivalentes a la referencia
- [x] Añadir prueba del contenido visible del embed y del orden exacto de botones del panel

- [x] Probar explícitamente título, descripción, color y filas del embed final de /panel
- [x] Probar que la publicación de /panel sea pública y responda una sola vez sin 40060

- [x] Probar el handler real de /panel con una interacción simulada y respuesta pública única
- [x] Investigar los logs recientes y eliminar el origen real de DiscordAPIError 40060 antes del checkpoint

- [x] Exponer y probar el handler completo de InteractionCreate para /panel con una única respuesta pública
- [x] Reproducir en prueba una interacción ya reconocida y confirmar que el guard anti-40060 evita una segunda respuesta

- [x] Separar Overview como vista informativa sin acciones de administración
- [x] Reorganizar el menú lateral en Workspace, Protection, Panels, Keys y Settings
- [x] Eliminar comandos slash globales antiguos y sincronizar solo el conjunto nuevo por servidor
- [x] Implementar /addtime, /warn, /dropkey y /prices con acciones reales
- [x] Mostrar estado Gateway online/connecting/offline con reintentos automáticos
- [x] Guardar y mostrar avatar, nombre, apodo e ID de Discord
- [x] Implementar Create New Panel y Manage Panels con persistencia y publicación real
- [x] Añadir pruebas de contratos de opciones obligatorias/opcionales y paneles persistidos

- [x] Añadir reconexión automática del bot para errores y desconexiones posteriores al arranque y probarla
- [x] Completar Manage Panels con republicar, actualizar o eliminar paneles persistidos y probar las acciones

- [x] Añadir prueba Vitest explícita del gate de reconexión ante Error y ShardDisconnect, incluyendo un único reintento
- [x] Añadir pruebas owner-only de discord.republishPanel y discord.deletePanel y manejo de panel inexistente
- [x] Añadir edición de configuración de panel persistido o documentar y probar que Manage Panels ofrece republicar y eliminar como acciones soportadas

- [x] Clasificar Unknown Channel como 404/403 y mostrar una guía accionable sin afirmar la causa exacta del canal concreto
- [x] Validar acceso real del bot al canal antes de guardar o publicar paneles
- [x] Mostrar un error accionable y no persistir IDs de canal inaccesibles
- [x] Añadir pruebas para canal desconocido, canal accesible y limpieza del estado guardado

- [x] Documentar que Unknown Channel se clasifica como 404/403 y no afirmar la causa exacta del canal concreto sin una comprobación real
- [x] Añadir prueba del helper de Setup que limpia el canal rechazado y persiste channel vacío tras fallo de updateChannel

- [x] Documentar explícitamente en docs el manejo de Unknown Channel, causas posibles y pasos de corrección

- [x] Crear README.md raíz con enlace y resumen del diagnóstico de canales Discord

- [x] Auditar errores actuales, logs y duplicados de comandos/configuración
- [x] Verificar y corregir sincronización de slash commands por servidor
- [x] Verificar redirect URI y callback OAuth de Discord en preview y dominio publicado
- [x] Corregir estado del bot y manejo de reconexión sin falsos OFFLINE
- [x] Mejorar la presentación de estados de carga, error y conexión del bot en la interfaz
- [x] Añadir pruebas de regresión para bot, OAuth, duplicados y errores reportados
- [x] Ejecutar validación completa y publicar solo después de pasarla

- [x] Probar que el inicio OAuth genera el callback correcto para preview y dominio publicado
- [x] Probar el callback completo con state válido usando el host dinámico sin exponer secretos

- [x] Revisar el flujo y las funciones visibles de la página de referencia de obfuscación
- [x] Comparar obfuscación, carga de source, protección y resultados con Vanta.vs Protector
- [x] Proponer mejoras priorizadas sin copiar secretos ni afirmar compatibilidad no verificada

- [x] Verificar la redirección mostrada en el video; no era el dashboard propio, sino My Browser de Manus
- [x] Identificar el origen observado: la carga detenida pertenece a My Browser de Manus, no a Vanta.vs Protector
- [x] Documentar que esta incidencia no se corrige dentro de Vanta.vs Protector y debe reportarse al soporte de Manus
- [x] Añadir comprobaciones de regresión para carga del dashboard y navegación visible de Vanta.vs Protector

- [x] Añadir una prueba verificable de Home para carga básica, navegación visible, Overview sin duplicados y estado del bot
- [x] Documentar en docs que el spinner de manus.im/my-browser?step=settings pertenece a My Browser/Manus y debe reportarse a soporte

- [x] Corregir el rechazo del canal Discord guardado para distinguir ID inválido, canal inexistente y permisos insuficientes
- [x] Añadir recuperación visible en Setup y evitar reintentos automáticos con un canal rechazado
- [x] Añadir pruebas de regresión para los mensajes y estados 404/403 del canal Discord

- [x] Analizar el video compartido y comparar el flujo visible con el dashboard actual
- [x] Cambiar FFA mode para que represente trial global sin key individual
- [x] Hacer que el modo no FFA exija key individual antes de ejecutar el script
- [x] Rediseñar la duración de licencias para días, meses y años, incluyendo addtime
- [x] Corregir el diagnóstico de permisos del canal Discord para no afirmar falta de permisos sin prueba
- [x] Añadir pruebas de acceso FFA/key, duraciones y mensajes de permisos

- [x] Permitir pegar un enlace completo de Discord en Setup, conservar servidor/canal y extraer el ID del canal para validación
- [x] Añadir pruebas para enlaces válidos, enlaces incompletos y entradas numéricas compatibles

- [x] Eliminar el nombre automático Banta lagger y usar el nombre escrito por el usuario para scripts y paneles
- [x] Mejorar el formulario de creación y la estética visual del dashboard con estados más claros
- [x] Añadir sonido de entrada opcional y controlado por el usuario, sin autoplay bloqueado por el navegador
- [x] Añadir pruebas de regresión para nombre personalizado, copy visual y sonido opcional

- [x] Añadir formulario de Prices con nombre y descripción personalizados
- [x] Mostrar vista previa profesional del mensaje Prices antes de publicarlo
- [x] Conectar el formulario con la publicación Discord y cubrirlo con pruebas

- [x] Usar la referencia visual del embed compartido para organizar título, etiqueta APP, bloques de precios y pie de autor
- [x] Permitir editar nombre y descripción del mensaje Prices con una vista previa equivalente al embed de Discord
- [x] Publicar Prices usando el contenido configurado, sin conservar el título fijo anterior

- [x] Añadir una prueba frontend de Prices que confirme la mutación con título y descripción
- [x] Reemplazar el textarea libre por bloques de precios editables y estructurados
- [x] Alinear la preview con el payload real del embed de Discord
- [x] Eliminar el título fijo Accepted Payments del embed publicado o hacerlo configurable

- [x] Añadir comando slash /updates para publicar actualizaciones en Discord
- [x] Crear formulario editable de título y contenido de actualizaciones con preview profesional
- [x] Conectar /updates con el canal configurado y cubrirlo con pruebas

- [x] Añadir prueba del router publishUpdates con canal configurado, validación y llamada al bot
- [x] Añadir prueba frontend del editor Updates con título y descripción enviados a la mutación

- [x] Añadir prueba de interacción del editor Prices en Home con la mutación tRPC real mockeada
- [x] Alinear la etiqueta APP de la preview de Prices con el embed publicado en Discord
- [x] Añadir prueba de interacción del editor Updates en Home con la mutación tRPC real mockeada

- [x] Cubrir interacción real del editor Prices en Home con tRPC mockeado
- [x] Cubrir interacción real del editor Updates en Home con tRPC mockeado

- [x] Documentar los hallazgos concretos del video y su impacto en FFA, trial y acceso por key
- [x] Unificar duración de licencias en web y slash commands con unidad días/meses/años
- [x] Persistir y usar el guildId extraído del enlace Discord, o documentar explícitamente que solo se valida el canal

- [x] Refactorizar parseDuration del bot para reutilizar shared/duration.ts
- [x] Añadir pruebas que comparen duración web y slash para días, meses y años

- [x] Diagnosticar por qué checkDiscordChannel termina en error de contacto con Discord
- [x] Diferenciar timeout, fallo de red, token ausente y respuestas HTTP en el mensaje de Setup
- [x] Añadir reintento controlado y pruebas del fallo de contacto sin propagar un error genérico

- [x] Crear catálogo Prices con planes Free, Pro y Premium y límites de obfuscaciones, scripts y keys
- [x] Mostrar los planes en un embed/panel visual claro y configurable
- [x] Auditar por qué /panel no funciona como el flujo del video
- [x] Corregir botones Redeem Key, Get Script, Get Role, Reset HWID y Get Stats de /panel
- [x] Añadir pruebas de límites del catálogo y de interacciones completas de /panel

- [ ] Comparar el video de /panel con el embed y botones actualmente publicados
- [ ] Ajustar el diseño de /panel al formato visual del video, sin títulos fijos ni redirecciones a la web
- [ ] Hacer que Get Script entregue directamente el loader y la key del usuario autorizado
- [ ] Verificar con pruebas que las cinco acciones del panel responden una sola vez y con datos reales

- [x] Corregir /whitelabel para usar selector nativo de usuario o rol según el tipo elegido
- [x] Quitar el ID manual y cargar opciones válidas del guild actual
- [x] Añadir pruebas de opciones y persistencia de whitelist por usuario/rol seleccionado

- [ ] Vincular de forma segura la cuenta Discord del propietario como owner, sin inventar ni hardcodear un ID
- [x] Añadir apartado privado Generate / Manage para crear keys Free, Pro y Premium
- [x] Aplicar cuotas reales de obfuscaciones, scripts y keys por plan
- [ ] Mostrar duración, cantidad, plan y resultado de las keys generadas
- [x] Añadir pruebas de autorización, cuotas y generación de keys por plan

- [x] Permitir editar la source privada de un script alojado
- [x] Permitir eliminar scripts y reemplazar/publicar una nueva versión
- [x] Reparar la subida de archivos Lua desde el dashboard con validación visible
- [x] Verificar que el loader público siempre sirva la versión actual sin exponer la source
- [ ] Hacer que el modo protegido rechace accesos sin key automática válida
- [x] Mostrar `script_key = "trial"` únicamente para el trial global cuando corresponda
- [ ] Confirmar y documentar el formato final de keys automáticas antes de cambiarlo

- [x] Tratar FFA como trial global y generar automáticamente `script_key = "trial"` para el loader de scripts en modo trial
- [x] Impedir que se creen o escriban keys trial manuales
- [ ] Hacer que el modo protegido rechace cualquier ejecución sin key automática activa, vinculada al script y validada por HWID
- [x] Mantener el formulario de generación sin campo editable de dígitos; el servidor debe generar la key

- [x] Diagnosticar el error `El Gateway Discord no está conectado` reportado al publicar o administrar desde la web
- [x] Corregir la reconexión del Gateway y evitar que el estado connecting bloquee mutaciones recuperables
- [x] Añadir prueba de estado Gateway desconectado y mensaje accionable en la interfaz

- [ ] Mostrar la sección Owner y la administración de keys únicamente a la cuenta Discord vinculada del propietario
- [ ] Mostrar claramente en Scripts los controles Editar, Reemplazar, Eliminar, Loader y Logs
- [ ] Añadir una vista de logs de protección y acceso con acciones de eliminar restringidas al owner
- [x] Hacer que la subida de source Lua procese automáticamente el artefacto protegido y actualice el loader
- [ ] Rediseñar visualmente Planes, Prices y Generate / Manage con una experiencia compacta y profesional inspirada en herramientas de protección Lua
- [ ] Añadir pruebas de visibilidad owner-only, gestión de logs y flujo automático de subida

- [ ] Corregir el rechazo `No tienes permiso para hacer un drop` para la cuenta owner vinculada
- [x] Permitir descarga directa de source únicamente al owner y mantener loader protegido para los demás
- [ ] Añadir pruebas de autorización de dropkey y descarga privada de source

- [x] Mostrar en cada script acciones visibles para editar source, subir nueva versión, eliminar, ver loader y consultar logs
- [x] Mantener la misma URL del loadstring al reemplazar su source y evitar duplicados
- [ ] Añadir pruebas de render móvil y de las acciones visibles de Scripts
