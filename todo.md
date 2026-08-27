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

- [x] Comparar el video de /panel con el embed y botones actualmente publicados
- [x] Ajustar el diseño de /panel al formato visual del video, sin títulos fijos ni redirecciones a la web
- [x] Hacer que Get Script entregue directamente el loader y la key del usuario autorizado
- [x] Verificar con pruebas que las cinco acciones del panel responden una sola vez y con datos reales

- [x] Corregir /whitelabel para usar selector nativo de usuario o rol según el tipo elegido
- [x] Quitar el ID manual y cargar opciones válidas del guild actual
- [x] Añadir pruebas de opciones y persistencia de whitelist por usuario/rol seleccionado

- [x] Vincular de forma segura la cuenta Discord del propietario como owner, sin inventar ni hardcodear un ID
- [x] Añadir apartado privado Generate / Manage para crear keys Free, Pro y Premium
- [x] Aplicar cuotas reales de obfuscaciones, scripts y keys por plan
- [x] Mostrar duración, cantidad, plan y resultado de las keys generadas
- [x] Añadir pruebas de autorización, cuotas y generación de keys por plan

- [x] Permitir editar la source privada de un script alojado
- [x] Permitir eliminar scripts y reemplazar/publicar una nueva versión
- [x] Reparar la subida de archivos Lua desde el dashboard con validación visible
- [x] Verificar que el loader público siempre sirva la versión actual sin exponer la source
- [x] Hacer que el modo protegido rechace accesos sin key automática válida
- [x] Mostrar `script_key = "trial"` únicamente para el trial global cuando corresponda
- [x] Confirmar y documentar el formato final de keys automáticas antes de cambiarlo

- [x] Tratar FFA como trial global y generar automáticamente `script_key = "trial"` para el loader de scripts en modo trial
- [x] Impedir que se creen o escriban keys trial manuales
- [x] Hacer que el modo protegido rechace cualquier ejecución sin key automática activa, vinculada al script y validada por HWID
- [x] Mantener el formulario de generación sin campo editable de dígitos; el servidor debe generar la key

- [x] Diagnosticar el error `El Gateway Discord no está conectado` reportado al publicar o administrar desde la web
- [x] Corregir la reconexión del Gateway y evitar que el estado connecting bloquee mutaciones recuperables
- [x] Añadir prueba de estado Gateway desconectado y mensaje accionable en la interfaz

- [x] Mostrar la sección Owner y la administración de keys únicamente a la cuenta Discord vinculada del propietario
- [x] Mostrar claramente en Scripts los controles Editar, Reemplazar, Eliminar, Loader y Logs
- [x] Añadir una vista de logs de protección y acceso con acciones de eliminar restringidas al owner
- [x] Hacer que la subida de source Lua procese automáticamente el artefacto protegido y actualice el loader
- [x] Rediseñar visualmente Planes, Prices y Generate / Manage con una experiencia compacta y profesional inspirada en herramientas de protección Lua
- [x] Añadir pruebas de autorización owner-only, gestión de logs y flujo automático de subida

- [x] Corregir el rechazo `No tienes permiso para hacer un drop` para la cuenta owner vinculada
- [x] Permitir descarga directa de source únicamente al owner y mantener loader protegido para los demás
- [x] Añadir pruebas de autorización de dropkey y descarga privada de source

- [x] Mostrar en cada script acciones visibles para editar source, subir nueva versión, eliminar, ver loader y consultar logs
- [x] Mantener la misma URL del loadstring al reemplazar su source y evitar duplicados
- [x] Añadir pruebas de render móvil y de las acciones visibles de Scripts

- [x] Alinear el redirect URI de Discord OAuth con el dominio publicado `vanta-prot-hfw5hmym.manus.space`
- [x] Verificar el callback `/api/discord/callback` y mostrar un error accionable si Discord no tiene registrada la URL exacta
- [x] Confirmar con pruebas que sin key el modo protegido rechaza la ejecución y FFA exige `key=trial`

- [x] Revisar el flujo OAuth del dominio publicado y dejar instrucciones de redirect URI exactas
- [x] Mantener la regla de una key protegida por un único HWID y rechazar dispositivos distintos
- [x] Completar el owner-only explícito cuando la cuenta Discord quede vinculada
- [x] Pulir visualmente los paneles de planes, precios y generación de keys

- [x] Retirar Owner Sources privado del alcance por solicitud del usuario
- [x] No informar ni implementar acceso Owner Sources, porque fue retirado del alcance
- [x] Crear Owner Key privado para generar keys automáticas asociadas a Free, Pro o Premium
- [x] Implementar canje de Owner Key para activar el plan y las cuotas del workspace del usuario
- [x] Impedir reutilización, falsificación o canje de una key por un usuario no autorizado
- [x] Añadir pruebas de privacidad, canje, activación de plan y límites por workspace

- [x] Cambiar las Owner Key al formato automático `FREE-...`, `PRO-...` y `PREMIUM-...`
- [x] Aumentar la longitud de almacenamiento y validación para prefijos más identificador aleatorio
- [x] Hacer que canje y hosting acepten el nuevo formato sin permitir edición manual
- [x] Añadir pruebas de prefijo, unicidad, canje y compatibilidad con keys existentes

- [x] Separar Plans de Prices en la navegación y el menú lateral
- [x] Crear la vista Plans con tarjetas Free, Pro y Premium y sus beneficios
- [x] Añadir formulario para canjear la key y refrescar automáticamente el workspace
- [x] Mostrar uso y saldo restante de ofuscaciones, scripts y keys por plan
- [x] Validar la sección Plans en móvil y añadir pruebas del canje y los saldos

- [x] Simplificar /whitelist a selector de script hosteado, tipo User/Role y destino dinámico
- [x] Mostrar únicamente scripts hosteados por la web como opciones del comando
- [x] Cargar usuarios al elegir User y roles al elegir Role mediante autocomplete
- [x] Eliminar IDs o nombres manuales y mantener un máximo de tres opciones principales
- [x] Añadir pruebas del registro, autocomplete y ejecución de whitelist/unwhitelist

- [x] Quitar cualquier tarjeta, métrica o texto de planes del módulo Prices
- [x] Mantener toda la información, canje y saldos de planes únicamente en Plans
- [x] Dejar Generate / Manage solo para keys normales
- [x] Dejar Plan Keys como único generador privado de keys PRO/PREMIUM del owner
- [x] Hacer que las keys normales sean exactamente de 10 dígitos
- [x] Hacer que el mensaje de generación normal muestre únicamente la key
- [x] Pulir UI y sonidos sin volver a mezclar responsabilidades entre módulos
- [x] Añadir pruebas de separación, formato y respuesta limpia

- [x] Corregir Get Script para reconocer la key canjeada y resolver el script asociado
- [x] Mantener las Plan Keys separadas de las licencias normales y no listarlas en Generate / Manage
- [x] Ocultar Free como opción generable en Plan Keys; Free debe ser el plan inicial
- [x] Dejar Prices únicamente con nombre, descripción y preview
- [x] Añadir pruebas de Get Script, separación de keys y ausencia de Free generable

- [x] Usar únicamente paneles existentes en /panel, Prices y Updates
- [x] Mostrar un estado vacío claro cuando no exista ningún panel creado
- [x] Añadir selección manual de canal/panel a Prices y Updates sin valor automático
- [x] Hacer que /panel reutilice uno de los paneles existentes, sin crear otro
- [x] Eliminar Setup de la navegación visible sin borrar datos de configuración
- [x] Añadir pruebas de selección manual, estado vacío y ausencia de Setup

- [x] Tratar Unknown Message al editar o eliminar paneles Discord como estado recuperable
- [x] Sincronizar o limpiar paneles cuyo mensaje ya no existe
- [x] Corregir la validación de channelId para IDs numéricos válidos en Prices, Updates y paneles
- [x] Añadir pruebas de Unknown Message y channelId válido/inválido

- [x] Auditar el flujo completo de /panel, no solo respuestas aisladas
- [x] Permitir canal automático configurable y canal manual elegido por el owner
- [x] Asegurar que todas las acciones del panel usen la misma key activa y su script asociado
- [x] Corregir Get Script cuando la key no tiene script definido o la relación está incompleta
- [x] Añadir selector de script al generar keys normales
- [x] Mostrar en cada key el script hosteado al que pertenece
- [x] Añadir pruebas end-to-end de Redeem Key, Get Script, Get Role, Stats y Reset HWID

- [x] Cambiar keys normales a identificadores alfanuméricos aleatorios de mínimo 32 caracteres
- [x] Actualizar validadores de canje, hosting y panel Discord al nuevo formato
- [x] Mantener Plan Keys separadas y con sus prefijos PRO/PREMIUM
- [x] Actualizar textos y placeholders que todavía indiquen 10 dígitos
- [x] Añadir pruebas de longitud, alfabeto, unicidad y compatibilidad del nuevo formato

- [x] Mantener Free como plan inicial automático sin key generable ni canjeable
- [x] Mostrar y generar Plan Keys únicamente para Pro y Premium en su módulo privado
- [x] Corregir Upload Lua/Source para que cargue el archivo seleccionado en el formulario
- [x] Actualizar Redeem Key para aceptar keys alfanuméricas de mínimo 32 caracteres
- [x] Corregir eliminación real de paneles y limpiar el registro cuando el mensaje ya no existe
- [x] Auditar botones y formularios para eliminar funciones solo visuales o mezcladas
- [x] Añadir pruebas de regresión para todos los flujos corregidos

- [x] Diagnosticar el error Failed to fetch al cargar Home
- [x] Verificar servidor, endpoint tRPC, logs de red y consultas iniciales
- [x] Corregir la causa de conexión o estabilizar el manejo de errores de API
- [x] Añadir prueba de regresión para la carga inicial del dashboard

- [x] Actualizar todas las etiquetas y mensajes que todavía indiquen keys de 10 números
- [x] Mostrar claramente que las keys normales tienen 32 caracteres alfanuméricos
- [x] Añadir autocopiado de keys normales con confirmación visual
- [x] Añadir autocopiado de Plan Keys sin mezclar listas ni módulos
- [x] Añadir pruebas de formato visual y copiado al portapapeles

- [x] Cambiar Block Builder para admitir bloques de Lua y bloques de texto
- [x] Mantener el orden de los bloques al construir la source final
- [x] Validar y previsualizar la salida Lua resultante
- [x] Añadir pruebas de composición Lua/texto y separación del módulo

- [x] Eliminar Block Builder del menú y del proyecto visible
- [x] Corregir la carga real de archivos Lua hacia el editor y hosting
- [x] Hacer que Get Script entregue script y key activa juntos
- [x] Rechazar key ausente, revocada, expirada o con HWID incompatible con mensajes claros
- [x] Mantener el loader sin exponer source y con respuesta utilizable por el juego
- [x] Añadir pruebas de upload, Get Script, key ausente y HWID inválido

- [x] Cambiar /getrole para mostrar roles seleccionables del servidor
- [x] Hacer que el rol configurado se entregue mediante Get Role del panel
- [x] Persistir la key, script y estado de acceso del panel entre reinicios del bot mediante licencias vinculadas en DB y resolución del script por hostedScriptId
- [x] Evitar pedir de nuevo una key activa después de reiniciar Discord mediante getActiveLicensesByDiscordUserId
- [x] Auditar comandos slash y botones del panel; las acciones críticas tienen handlers backend y pruebas existentes
- [x] Añadir pruebas del selector nativo de /getrole y del loader con key activa

- [x] Mostrar la key activa junto al loadstring en Get Script
- [x] Mantener el copiado acotado a las respuestas de generación y Get Script, según el alcance confirmado; no añadir botones en listas
- [x] Mantener Plan Keys sin botones de lista y mostrar copiado solo en las respuestas solicitadas, según el alcance confirmado
- [x] Añadir pruebas del loader de Get Script con key activa y mantener el copiado acotado a las respuestas

- [x] Generación de key: mostrar la key en una respuesta copiable con mini botón, sin modificar Get Script ni las listas

- [x] Get Script: mostrar key activa junto al loadstring y permitir copiar la key
- [x] Generate Key: conservar key visible con mini botón de copia

- [x] Crear API key persistente por cuenta al iniciar sesión
- [x] Añadir /apikey para mostrar la API key de la cuenta vinculada
- [x] Mostrar la API key en Overview con botón de copiar
- [x] Diagnosticar y corregir HTTP 403 del loader Lua en la línea 2 aceptando HWID por query desde Roblox
- [x] Añadir pruebas para API key, /apikey, Overview y acceso del loader

- [x] Get Script: copiar únicamente el bloque completo script_key + loadstring, sin mostrar key separada
- [x] Verificar que /apikey se registre y aparezca en la sincronización de comandos Discord
- [x] Reparar el error actual de Conectar con Discord y validar el callback OAuth
- [x] Añadir pruebas de formato copiable, /apikey y OAuth Discord

- [x] Reparar resolución de cuenta web vinculada en /apikey mediante Discord OAuth y bootstrap seguro para el owner del servidor
- [x] Validar que el callback persista la identidad antes de redirigir; el callback guarda linkDiscordIdentity antes de /?discord=connected
- [x] Añadir cobertura de /apikey en el registro slash y resolución DB; el owner no vinculado se repara automáticamente

- [x] Permitir al owner vinculado generar keys sin exigir Administrator en el comando slash
- [x] Permitir al owner vinculado configurar /getrole sin exigir Administrator
- [x] Añadir pruebas de autorización por owner para generatekeyrol y generación de keys mediante el contrato de comandos y la suite de autorización existente

- [x] Mejorar ofuscador interno con una capa byte-shift dependiente del checksum en Fortified y salida protegida sin afirmar integración Luraph
- [x] Hacer whitelist multiusuario y multirrol por script, con selector web de script, altas/bajas persistentes y soporte existente en Discord
- [x] Restaurar generación y entrega de Plan Keys Pro/Premium solo para owner, con key visible, copia rápida y lista separada
- [x] Revisar y probar flujos relacionados y mejorar detalles seguros; TypeScript y 115 pruebas Vitest pasan

- [x] Generar loader visible compacto de dos líneas con URL opaca, sin exponer el parámetro HWID en el snippet
- [x] Mantener validación server-side de key y HWID mediante una segunda etapa del loader
- [x] Añadir pruebas del nuevo loader compacto, FFA, key inválida y HWID bloqueado

- [x] Corregir el loader compacto para que funcione en el executor real sin volver al snippet grande mediante endpoint de segunda etapa firmado
- [x] Cambiar el acceso principal de la web a Discord OAuth y conservar la vinculación de cuenta
- [x] Añadir pruebas del loader compacto funcional y del login principal por Discord
