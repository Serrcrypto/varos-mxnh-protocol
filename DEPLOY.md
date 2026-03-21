# Deploy — Varos MXNH Protocol

Guia de deploy para el hackathon Hedera Apex 2026.

---

## 1. Backend en Railway

### Prerequisitos
- Cuenta en [railway.app](https://railway.app)
- Repo subido a GitHub

### Pasos

1. Ve a **railway.app → New Project → Deploy from GitHub repo**
2. Selecciona `varos-mxnh-protocol`
3. Railway detectara automaticamente el `railway.json` y `nixpacks.toml`
4. En la pantalla de settings del servicio, ve a **Variables** y agrega:

```
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.8214279
HEDERA_OPERATOR_PRIVATE_KEY=<tu key>
HEDERA_TREASURY_ID=0.0.8252102
HEDERA_TREASURY_PRIVATE_KEY=<tu key>
HEDERA_COMPLIANCE_ID=0.0.8252126
HEDERA_COMPLIANCE_PRIVATE_KEY=<tu key>
HEDERA_FEE_COLLECTOR_ID=0.0.8252168
HEDERA_FEE_COLLECTOR_KEY=<tu key>
HEDERA_MXNH_TOKEN_ID=0.0.8252633
HEDERA_HCS_TOPIC_ID=<tu topic>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
SDK_ADMIN_KEY=<genera con: openssl rand -hex 32>
TEST_API_KEY=vr_live_<genera con: openssl rand -hex 16>
DATABASE_URL=postgresql://...
NODE_ENV=production
CORS_ORIGIN=https://<tu-proyecto>.vercel.app
```

5. Railway asignara una URL tipo: `https://varos-mxnh-protocol-production.up.railway.app`
6. Verifica el health check: `GET https://tu-url.railway.app/health`
   - Respuesta esperada: `{"status":"ok","message":"🚀 Varos MXNH Protocol API running"}`

### Verificar endpoints criticos

```bash
# Health
curl https://tu-url.railway.app/health

# FX Rate
curl https://tu-url.railway.app/fx/rate

# Reserve
curl -H "x-api-key: TU_TEST_API_KEY" https://tu-url.railway.app/hedera/reserve
```

---

## 2. Frontend en Vercel

### Prerequisitos
- Cuenta en [vercel.com](https://vercel.com)
- Backend de Railway ya desplegado y con URL

### Pasos

1. Ve a **vercel.com → New Project → Import Git Repository**
2. Selecciona `varos-mxnh-protocol`
3. En **Root Directory** escribe: `apps/web`
4. Framework: Vite (se detecta automaticamente)
5. En **Environment Variables** agrega:

```
VITE_API_URL=https://tu-url.railway.app
VITE_API_KEY=<mismo valor que TEST_API_KEY del backend>
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_HEDERA_NETWORK=testnet
VITE_HEDERA_APP_NAME=Varos MXNH Protocol
VITE_HEDERA_APP_DESCRIPTION=Protocolo de peso mexicano nativo en Hedera
VITE_WALLETCONNECT_PROJECT_ID=<de cloud.walletconnect.com>
VITE_HCS_TOPIC_ID=<mismo que HEDERA_HCS_TOPIC_ID>
VITE_FEE_COLLECTOR_ID=0.0.8252168
```

6. Click **Deploy**
7. Vercel generara una URL tipo: `https://varos-mxnh-protocol.vercel.app`

### Post-deploy: actualizar CORS en Railway

Una vez que tengas la URL de Vercel, ve a Railway y actualiza:
```
CORS_ORIGIN=https://varos-mxnh-protocol.vercel.app
```

Si tienes un dominio custom (ej. varos.mx), agrega ambas:
```
CORS_ORIGIN=https://varos.mx,https://varos-mxnh-protocol.vercel.app
```

Railway reiniciara el servicio automaticamente.

---

## 3. Checklist final de verificacion

- [ ] `GET /health` responde `{"status":"ok"}`
- [ ] `GET /fx/rate` devuelve tipo de cambio MXN/USD
- [ ] Dashboard en Vercel carga sin errores de CORS
- [ ] `/dashboard` muestra: circulacion, reserva, ratio, tipo de cambio
- [ ] HashConnect abre el modal de wallets
- [ ] Stripe Elements carga en `/pay`
- [ ] `.env` NO esta en el repo (verificar `.gitignore`)

---

## 4. Stripe Webhook en produccion

Para que `POST /payments/webhook` funcione en Railway:

1. Ve a **dashboard.stripe.com → Developers → Webhooks → Add endpoint**
2. URL: `https://tu-url.railway.app/payments/webhook`
3. Eventos a escuchar: `payment_intent.succeeded`
4. Copia el **Signing secret** y ponlo como `STRIPE_WEBHOOK_SECRET` en Railway

---

## 5. Notas de seguridad

- Las keys de Hedera (PRIVATE_KEY) nunca van en el repo
- El `.env` esta en `.gitignore`
- En produccion CORS esta restringido al dominio de Vercel
- `SDK_ADMIN_KEY` y `TEST_API_KEY` deben ser strings largos y aleatorios
