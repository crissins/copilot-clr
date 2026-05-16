# BICEP - INFRASTRUCTURE AS CODE PARA CLRA

## 🚀 QUICK START (5 minutos)

### Requisitos
```bash
# Verificar que tienes Azure CLI y Bicep
az --version
az bicep version

# Si no tienes Bicep
az bicep install
```

### Desplegar en DEV (TODO en 5 minutos)

```bash
# 1. Hacer el script ejecutable
chmod +x deploy.sh

# 2. Ejecutar deployment
./deploy.sh dev

# 3. Esperar 3-5 minutos...

# 4. Copiar valores para .env
# Los outputs aparecerán al terminar
```

---

## 📁 ARCHIVOS BICEP INCLUIDOS

```
BICEP_INFRASTRUCTURE_GUIDE.md  ← Esta guía completa
main.bicep                      ← Archivo principal (orquestación)
parameters.dev.json            ← Valores para DEV
deploy.sh                       ← Script automatizado
```

---

## 🏗️ QUÉ SE CREA

El deployment automático crea:

✅ **Almacenamiento:**
   - Azure Blob Storage (para documentos)
   - 1 container: documents

✅ **Base de Datos:**
   - Azure Cosmos DB (modo Serverless)
   - Database: clradb
   - Containers: users, operations

✅ **Monitoreo:**
   - Application Insights
   - Logs y métricas en vivo

✅ **Backend:**
   - App Service Plan (B1)
   - App Service (backend Python)
   - App Identity (Managed)

✅ **Seguridad:**
   - Azure Key Vault
   - (Tú agregas secretos manualmente después)

---

## 📊 COSTOS ESTIMADOS (DEV)

| Recurso | SKU | Costo/mes |
|---------|-----|----------|
| App Service | B1 | $10 USD |
| Cosmos DB | Serverless | $0.25-2 USD |
| Storage | LRS | $0.50 USD |
| Key Vault | Standard | $0.67 USD |
| App Insights | | Gratis (primeros 5GB) |
| **TOTAL** | | **~$11-13 USD/mes** |

---

## 💡 USO EN EL HACKATHON

### Día 1: Setup Completo
```bash
# Mañana del Día 1
./deploy.sh dev

# Outputs te dan todo para completar .env
# ¡Listo para comenzar a codificar!
```

### Después de Coding
```bash
# Antes de demo
# Ejecuta desde el backend
python -m uvicorn main:app --port 3000

# Todo funciona porque está conectado a Azure
```

### Después del Hackathon
```bash
# Limpiar todo (no pagar más)
az group delete -g clra-dev-rg --yes
```

---

## 🔧 COMANDOS ÚTILES

### Ver recursos creados
```bash
az resource list -g clra-dev-rg -o table
```

### Ver App Service logs
```bash
az webapp log tail -g clra-dev-rg -n clra-app-dev-XXXX
```

### Obtener connection strings
```bash
az cosmosdb keys list --name clra-cosmos-dev-XXXX \
  --resource-group clra-dev-rg
```

### Cambiar SKU del App Service
```bash
# Editar main.bicep, cambiar "B1" a otro SKU, y redeploy
./deploy.sh dev
```

---

## ⚙️ PERSONALIZACIÓN

### Cambiar location
```json
// En parameters.dev.json
"location": {
  "value": "westus2"  // O tu región
}
```

### Cambiar environment
```bash
# Para PROD
./deploy.sh prod

# Requiere: parameters.prod.json
```

### Agregar más recursos
```bicep
// En main.bicep, agregar más recursos Bicep
resource myResource 'Microsoft.Service/resource@version' = {
  // ...
}
```

---

## 🎯 FLUJO COMPLETO

```
┌─────────────────┐
│  ./deploy.sh dev │  ← Ejecutas en terminal
└────────┬────────┘
         ↓
┌──────────────────────┐
│ Azure CLI autentica  │
│ y valida Bicep       │
└────────┬─────────────┘
         ↓
┌──────────────────────────────┐
│ Bicep se compila a           │
│ ARM Template (JSON)          │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Azure Resource Manager       │
│ crea todos los recursos:     │
│ - Storage                    │
│ - Cosmos DB                  │
│ - App Service                │
│ - App Insights               │
│ - Key Vault                  │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│ Outputs con valores para:    │
│ - .env file                  │
│ - Connection strings         │
│ - URLs                       │
│ - API keys                   │
└──────────────────────────────┘
```

---

## ✅ CHECKLIST

- [ ] Instalé Azure CLI y Bicep
- [ ] Ejecuté `az login`
- [ ] Copié archivos (main.bicep, parameters.dev.json, deploy.sh)
- [ ] Ejecuté `chmod +x deploy.sh`
- [ ] Ejecuté `./deploy.sh dev`
- [ ] Esperé 3-5 minutos
- [ ] Copié outputs a .env
- [ ] Ejecuté backend y verificó que conecta
- [ ] ¡Comenzé a codificar!

---

## 🆘 TROUBLESHOOTING

### Error: "bicep: command not found"
```bash
az bicep install
az bicep upgrade
```

### Error: "ResourceGroupNotFound"
```bash
# El script debe crear el grupo automáticamente
# Si falla, crea manualmente:
az group create -n clra-dev-rg -l eastus
```

### Error: "QuotaExceeded"
```bash
# Cambiar SKU en main.bicep:
# "B1" → "Free" (más lento, pero gratis)
```

### Error: "Unauthorized"
```bash
# Re-autenticar
az logout
az login
```

---

## 📚 RECURSOS

- Bicep Docs: https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/
- Bicep Playground: https://aka.ms/bicep
- Azure CLI Docs: https://learn.microsoft.com/en-us/cli/azure/

---

## 🎉 VENTAJAS DE BICEP EN EL HACKATHON

✅ **Setup en 5 minutos** (no horas de click-click-click)
✅ **Reproducible** (mismo código = mismo resultado siempre)
✅ **Versionable** (en Git, track de cambios)
✅ **Fácil destruir** (no olvidar recursos = sin costos extras)
✅ **Profesional** (los jurados ven código, no clicks)
✅ **Escalable** (dev → prod solo cambiar parámetros)

---

## 💪 RECOMENDACIÓN FINAL

**Usa Bicep desde el Día 1 del hackathon.**

Esto te libera para:
1. Enfocar en código (backend + frontend)
2. No perder tiempo en Azure Portal
3. Tener infraestructura reproducible
4. Mostrar profesionalismo a los jurados

**Time saved = More coding = Better demo = Better ranking** 🚀

---

**¡Infrastructure as Code te hace un super equipo! 💚**
