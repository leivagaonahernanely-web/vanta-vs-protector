

## Comprobación visual posterior a la corrección

El dashboard propio carga correctamente en escritorio y móvil. Overview muestra solo la explicación de Vanta.vs Protector, sin acciones de administración. La navegación de escritorio ya no repite la entrada Generate / Manage bajo Keys; permanece una sola entrada bajo Protection. El encabezado muestra `BOT ONLINE · Protectorscripts` en la instancia de desarrollo. En móvil, el encabezado compacto conserva el menú y el estado online, y las tarjetas Overview se apilan sin desbordamiento visible.

## Incidencia externa: My Browser de Manus

La pantalla con spinner observada en `manus.im/my-browser?step=settings` corresponde a la configuración de **My Browser de Manus**, no a una ruta del dashboard de Vanta.vs Protector. Por tanto, no debe diagnosticarse como un fallo de `Home.tsx`, del router tRPC ni del bot de Discord. La acción recomendada es reportarla en [help.manus.im](https://help.manus.im) con la URL, el paso `settings`, el dispositivo móvil y una captura; esta aplicación no puede reparar una pantalla perteneciente al producto externo.
