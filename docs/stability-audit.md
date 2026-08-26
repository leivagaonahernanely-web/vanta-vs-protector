

## Corrección del canal Discord rechazado

La mutación `discord.updateChannel` ahora trata la respuesta 404/403 de Discord como un resultado controlable: limpia el `discordChannelId` persistido y devuelve `{ ok: false, status, message }` en lugar de lanzar un `TRPCClientError`. Setup borra también el valor local y muestra la guía accionable como aviso de interfaz. Un canal accesible sigue devolviendo `{ ok: true, channelId }`. La creación o republicación de paneles continúa bloqueándose cuando Discord no permite publicar, porque esas acciones no pueden completarse sin acceso real al canal.
