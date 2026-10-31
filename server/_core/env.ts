export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Secreto HMAC para NX_KEY y API keys. Sin él no se puede emitir ni validar ninguna clave.
  keySecret: process.env.NX_KEY_SECRET ?? "",
};
